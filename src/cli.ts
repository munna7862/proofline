#!/usr/bin/env node
/**
 * proofline <command>
 *
 *   report                     rebuild the HTML report from .proofline/raw
 *   scan [opts] [-- pw args]   fault check: baseline run, then one targeted run per injected fault
 *   replay <mutantId>          re-run one fault headed, to watch the test stay green
 *   check [--min-coverage N] [--min-proof N]   CI gate, exits 1 below thresholds
 *   init                       print the two lines to add to your project
 *
 * Zero runtime dependencies on purpose: node:util parseArgs, node:child_process.
 */
import { parseArgs } from 'node:util';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { aggregateCoverage } from './coverage/aggregate.ts';
import { judgeMutant, planMutants, summarizeProof } from './proof/plan.ts';
import { DEFAULT_OPERATORS, OPERATORS } from './proof/operators.ts';
import { loadSummaries, writeReport } from './report/write.ts';
import { displayPath, paths, readJsonDir, resetDir } from './util/store.ts';
import type { MutantHitRecord, MutantResult, OperatorId, TestCoverageRecord, TestNetworkRecord } from './types.ts';

const argv = process.argv.slice(2);
const dashDash = argv.indexOf('--');
const own = dashDash === -1 ? argv : argv.slice(0, dashDash);
const passThrough = dashDash === -1 ? [] : argv.slice(dashDash + 1);
const [command, ...rest] = own;

function playwrightCommand(): { cmd: string; prefix: string[]; shell: boolean } {
  // Resolve the project's own Playwright so versions always match. Works on Windows without .cmd shims.
  try {
    const req = createRequire(join(process.cwd(), 'package.json'));
    const cli = req.resolve('@playwright/test/cli');
    return { cmd: process.execPath, prefix: [cli], shell: false };
  } catch {
    return { cmd: process.platform === 'win32' ? 'npx.cmd' : 'npx', prefix: ['playwright'], shell: process.platform === 'win32' };
  }
}

function runPlaywright(args: string[], env: Record<string, string>, inherit = false): number {
  const pw = playwrightCommand();
  const res = spawnSync(pw.cmd, [...pw.prefix, 'test', ...args], {
    stdio: inherit ? 'inherit' : 'pipe',
    env: { ...process.env, ...env },
    shell: pw.shell,
    encoding: 'utf8',
  });
  if (res.error) throw res.error;
  return res.status ?? 1;
}

function cmdReport(): void {
  const records = readJsonDir<TestCoverageRecord>(paths.coverage);
  const coverage = records.length ? aggregateCoverage(records) : undefined;
  const file = writeReport({ coverage });
  console.log(`Report: ${displayPath(file)}`);
}

function cmdScan(): void {
  const { values } = parseArgs({
    args: rest,
    options: {
      'max-mutants': { type: 'string', default: '60' },
      operators: { type: 'string' },
      include: { type: 'string', multiple: true },
      exclude: { type: 'string', multiple: true },
      workers: { type: 'string', default: '2' },
      'min-proof': { type: 'string' },
    },
  });
  const operators = (values.operators?.split(',').map((s) => s.trim()) ?? DEFAULT_OPERATORS) as OperatorId[];
  for (const op of operators) if (!OPERATORS[op]) throw new Error(`Unknown operator "${op}". Known: ${Object.keys(OPERATORS).join(', ')}`);

  console.log('1/3 Baseline run: recording which APIs each test depends on…');
  resetDir(paths.network);
  runPlaywright(['--reporter=dot', '--retries=0', `--workers=${values.workers}`, ...passThrough], { PROOFLINE_MODE: 'record' });
  const baseline = readJsonDir<TestNetworkRecord>(paths.network);
  const passing = baseline.filter((b) => b.status === 'passed');
  if (!passing.length) {
    console.error('No passing tests recorded. Check that tests import { test } from "proofline/playwright" and pass on their own.');
    process.exit(2);
  }

  const mutants = planMutants(baseline, {
    operators,
    maxMutants: Number(values['max-mutants']),
    include: values.include,
    exclude: values.exclude,
  });
  console.log(`2/3 Planned ${mutants.length} faults across ${new Set(mutants.map((m) => m.pattern)).size} endpoints for ${passing.length} passing tests.`);

  const results: MutantResult[] = [];
  mutants.forEach((m, i) => {
    const started = Date.now();
    resetDir(paths.mutant(m.id));
    const targets = [...new Set(m.tests.map((t) => `${t.file}:${t.line}`))];
    runPlaywright(['--reporter=dot', '--retries=0', `--workers=${values.workers}`, ...passThrough, ...targets], {
      PROOFLINE_MODE: 'mutant',
      PROOFLINE_MUTANT: JSON.stringify(m),
    });
    const hits = readJsonDir<MutantHitRecord>(paths.mutant(m.id));
    const result = judgeMutant(m, hits, Date.now() - started);
    results.push(result);
    const path = new URL(m.pattern).pathname;
    console.log(`   [${i + 1}/${mutants.length}] ${m.method} ${path} ${OPERATORS[m.operator].label}: ${result.outcome}`);
  });

  const proof = summarizeProof(results);
  const file = writeReport({ proof });
  console.log(`3/3 Fault check ${Math.round(proof.score)}%: ${proof.killed} caught, ${proof.survived} slipped through.`);
  console.log(`Report: ${displayPath(file)}`);
  if (values['min-proof'] && proof.score < Number(values['min-proof'])) {
    console.error(`Fault check ${proof.score}% is below --min-proof ${values['min-proof']}`);
    process.exit(1);
  }
}

function cmdReplay(): void {
  const id = rest[0];
  const { proof } = loadSummaries();
  const result = proof?.results.find((r) => r.mutant.id === id);
  if (!result) {
    console.error(`Fault "${id}" not found. Run "proofline scan" first, then copy an id from the report.`);
    process.exit(2);
  }
  const m = result.mutant;
  console.log(`Replaying ${m.method} ${m.pattern} with "${OPERATORS[m.operator].label}" (headed)…`);
  const targets = [...new Set(m.tests.map((t) => `${t.file}:${t.line}`))];
  const code = runPlaywright(['--headed', '--retries=0', '--workers=1', ...passThrough, ...targets], {
    PROOFLINE_MODE: 'mutant',
    PROOFLINE_MUTANT: JSON.stringify(m),
  }, true);
  process.exit(code);
}

function cmdCheck(): void {
  const { values } = parseArgs({ args: rest, options: { 'min-coverage': { type: 'string' }, 'min-proof': { type: 'string' } } });
  const { coverage, proof } = loadSummaries();
  let failed = false;
  if (values['min-coverage']) {
    const s = coverage?.score ?? 0;
    const ok = s >= Number(values['min-coverage']);
    console.log(`UI coverage ${s}% (min ${values['min-coverage']}%): ${ok ? 'ok' : 'FAIL'}`);
    failed ||= !ok;
  }
  if (values['min-proof']) {
    const s = proof?.score ?? 0;
    const ok = s >= Number(values['min-proof']);
    console.log(`Fault check ${s}% (min ${values['min-proof']}%): ${ok ? 'ok' : 'FAIL'}`);
    failed ||= !ok;
  }
  process.exit(failed ? 1 : 0);
}

function cmdInit(): void {
  console.log(`Two changes and you're done:

1. In your tests, change the import:
     import { test, expect } from 'proofline/playwright';

2. In playwright.config.ts, add the reporter:
     reporter: [['list'], ['proofline/reporter']],

Then:
  npx playwright test        -> UI coverage report in .proofline/report/index.html
  npx proofline scan         -> adds the fault check
  npx proofline check --min-coverage 50 --min-proof 70   -> CI gate`);
}

const commands: Record<string, () => void> = { report: cmdReport, scan: cmdScan, replay: cmdReplay, check: cmdCheck, init: cmdInit };
const run = commands[command ?? ''];
if (!run) {
  console.log('Usage: proofline <report|scan|replay|check|init>');
  process.exit(command ? 2 : 0);
}
run();
