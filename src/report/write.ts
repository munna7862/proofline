import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { ensureDir, paths } from '../util/store.ts';
import { renderReport } from './html.ts';
import { renderMarkdown } from './markdown.ts';
import type { CoverageSummary, ProofSummary } from '../types.ts';

const COVERAGE_FILE = () => join(paths.report, 'coverage-summary.json');
const PROOF_FILE = () => join(paths.report, 'proof-summary.json');

function readIf<T>(file: string): T | undefined {
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : undefined;
}

export function loadSummaries(): { coverage?: CoverageSummary; proof?: ProofSummary } {
  const coverage = readIf<CoverageSummary>(COVERAGE_FILE());
  return { coverage: coverage && upgradeCoverage(coverage), proof: readIf<ProofSummary>(PROOF_FILE()) };
}

/**
 * Fills fields added after a summary was written, so a coverage summary left on disk by an
 * older Proofline still renders when `scan` re-renders the combined report after an upgrade.
 */
export function upgradeCoverage(c: CoverageSummary): CoverageSummary {
  return {
    ...c,
    neverEnabled: c.neverEnabled ?? 0,
    testsExcluded: c.testsExcluded ?? 0,
    views: c.views.map((v) => ({ ...v, neverEnabled: v.neverEnabled ?? [] })),
  };
}

/** Save whichever summary changed, then re-render the combined report from both. */
export function writeReport(update: { coverage?: CoverageSummary; proof?: ProofSummary }, project = basename(process.cwd())): string {
  ensureDir(paths.report);
  if (update.coverage) writeFileSync(COVERAGE_FILE(), JSON.stringify(update.coverage, null, 2));
  if (update.proof) writeFileSync(PROOF_FILE(), JSON.stringify(update.proof, null, 2));
  const { coverage, proof } = loadSummaries();
  const htmlPath = join(paths.report, 'index.html');
  writeFileSync(htmlPath, renderReport({ project, coverage, proof }));
  writeFileSync(join(paths.report, 'summary.md'), renderMarkdown(coverage, proof));
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      writeFileSync(process.env.GITHUB_STEP_SUMMARY, renderMarkdown(coverage, proof), { flag: 'a' });
    } catch {
      /* not fatal */
    }
  }
  return htmlPath;
}
