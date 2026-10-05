/**
 * Checks the REAL Playwright runner against demo/expected.json.
 *
 *   npm run demo && npm run demo:scan && node scripts/check-demo-scan.ts
 *
 * Calibration proves the engine; this proves the adapter (fixture, reporter, CLI scan loop)
 * reports the same outcomes when Playwright drives the demo suite.
 */
import { existsSync, readFileSync } from 'node:fs';
import { compareWithGroundTruth, loadGroundTruth } from './ground-truth.ts';
import type { CoverageSummary, ProofSummary } from '../src/types.ts';

const REPORT = new URL('../demo/.proofline/report/', import.meta.url);

function read<T>(name: string): T | undefined {
  const file = new URL(name, REPORT);
  return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : undefined;
}

const coverage = read<CoverageSummary>('coverage-summary.json');
const proof = read<ProofSummary>('proof-summary.json');
const failures: string[] = [];
if (!coverage) failures.push('missing demo/.proofline/report/coverage-summary.json (run `npm run demo` first)');
if (!proof) failures.push('missing demo/.proofline/report/proof-summary.json (run `npm run demo:scan` first)');
failures.push(...compareWithGroundTruth(loadGroundTruth(), coverage, proof));

if (coverage && proof) {
  console.log(`Real runner: UI coverage ${coverage.tested}/${coverage.total} | Fault check ${proof.killed} caught, ${proof.survived} slipped, ${proof.unstable ?? 0} unstable, ${proof.notApplicable} n/a`);
}
if (failures.length) {
  console.error('\nDEMO SCAN CHECK FAILED\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Demo scan check passed: real runner matches demo/expected.json');
