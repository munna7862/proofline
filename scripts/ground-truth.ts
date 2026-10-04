/**
 * Compares engine output with demo/expected.json.
 * Shared by scripts/calibrate.ts (engine without the runner) and
 * scripts/check-demo-scan.ts (the real Playwright runner), so both are held to the same rules.
 */
import { readFileSync } from 'node:fs';
import type { CoverageSummary, ProofSummary } from '../src/types.ts';

interface GroundTruth {
  coverage: { untested: string[]; tested: string[] };
  /** Exact set of view keys the coverage summary must contain. */
  views?: string[];
  /** Links that must be untested with reachedByUrl on every view they appear on. */
  reachedByUrl?: string[];
  /** Exact scored element keys per view: no phantoms (busy labels, file names), no duplicates. */
  elements?: Record<string, string[]>;
  /** Exact tested element keys per view, for keys that appear on more than one view. */
  testedIn?: Record<string, string[]>;
  /** Elements that must be "not applicable: never enabled", outside the score. */
  neverEnabled?: string[];
  proof: Record<string, Record<string, string>>;
  /** Exact set of faults the planner rules out as "already failing in baseline", per endpoint. */
  alreadyFailing?: Record<string, string[]>;
  weakestTest: string;
}

export function loadGroundTruth(): GroundTruth {
  return JSON.parse(readFileSync(new URL('../demo/expected.json', import.meta.url), 'utf8')) as GroundTruth;
}

/** Returns one line per disagreement; empty means the output matches ground truth. */
export function compareWithGroundTruth(
  expected: GroundTruth,
  coverage: CoverageSummary | undefined,
  proof: ProofSummary | undefined,
): string[] {
  const failures: string[] = [];
  if (coverage && expected.views) {
    const got = coverage.views.map((v) => v.view).sort();
    const want = [...expected.views].sort();
    if (got.join('\n') !== want.join('\n')) failures.push(`coverage: views expected [${want.join(', ')}], got [${got.join(', ')}]`);
  }
  if (coverage && expected.reachedByUrl) {
    for (const key of expected.reachedByUrl) {
      const els = coverage.views.flatMap((v) => v.elements).filter((e) => e.key === key);
      if (!els.length) failures.push(`coverage: link "${key}" not found in inventory`);
      else if (els.some((e) => e.tested || !e.reachedByUrl)) failures.push(`coverage: "${key}" should be untested with reachedByUrl`);
    }
  }
  if (coverage && expected.elements) {
    for (const [view, keys] of Object.entries(expected.elements)) {
      const v = coverage.views.find((x) => x.view === view);
      const got = (v?.elements ?? []).map((e) => e.key).sort();
      const want = [...keys].sort();
      if (got.join('\n') !== want.join('\n')) failures.push(`coverage: ${view} elements expected [${want.join(', ')}], got [${got.join(', ')}]`);
    }
  }
  if (coverage && expected.testedIn) {
    for (const [view, keys] of Object.entries(expected.testedIn)) {
      const v = coverage.views.find((x) => x.view === view);
      const got = (v?.elements ?? []).filter((e) => e.tested).map((e) => e.key).sort();
      const want = [...keys].sort();
      if (got.join('\n') !== want.join('\n')) failures.push(`coverage: ${view} tested expected [${want.join(', ')}], got [${got.join(', ')}]`);
    }
  }
  if (coverage && expected.neverEnabled) {
    const na = coverage.views.flatMap((v) => v.neverEnabled.map((e) => e.key));
    const scored = coverage.views.flatMap((v) => v.elements.map((e) => e.key));
    for (const key of expected.neverEnabled) {
      if (!na.includes(key)) failures.push(`coverage: "${key}" should be not applicable (never enabled)`);
      if (scored.includes(key)) failures.push(`coverage: "${key}" is never enabled and must not be scored`);
    }
  }
  if (coverage) {
    const allEls = coverage.views.flatMap((v) => v.elements);
    for (const [keys, shouldBeTested] of [[expected.coverage.untested, false], [expected.coverage.tested, true]] as const) {
      for (const key of keys) {
        const el = allEls.find((e) => e.key === key);
        if (!el) failures.push(`coverage: element "${key}" not found in inventory`);
        else if (el.tested !== shouldBeTested) failures.push(`coverage: "${key}" should be ${shouldBeTested ? 'tested' : 'untested'}`);
      }
    }
  }
  if (proof) {
    for (const [endpoint, ops] of Object.entries(expected.proof)) {
      for (const [op, outcome] of Object.entries(ops)) {
        const r = proof.results.find((x) => `${x.mutant.method} ${new URL(x.mutant.pattern).pathname}` === endpoint && x.mutant.operator === op);
        if (!r) failures.push(`proof: no mutant for ${endpoint} ${op}`);
        else if (r.outcome !== outcome) failures.push(`proof: ${endpoint} ${op} expected ${outcome}, got ${r.outcome}`);
      }
    }
    if (expected.alreadyFailing) {
      const label = (r: ProofSummary['results'][number]) => `${r.mutant.method} ${new URL(r.mutant.pattern).pathname} ${r.mutant.operator}`;
      const got = proof.results.filter((r) => r.reason?.startsWith('already failing in baseline')).map(label).sort();
      const want = Object.entries(expected.alreadyFailing).flatMap(([ep, ops]) => ops.map((op) => `${ep} ${op}`)).sort();
      if (got.join('\n') !== want.join('\n')) failures.push(`proof: already failing in baseline expected [${want.join(', ')}], got [${got.join(', ')}]`);
    }
    if (proof.weakestTests[0]?.test.title !== expected.weakestTest) {
      failures.push(`proof: weakest test expected "${expected.weakestTest}", got "${proof.weakestTests[0]?.test.title}"`);
    }
  }
  return failures;
}
