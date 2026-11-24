/**
 * Checks the REAL Playwright runner against demo/expected.json.
 *
 *   npm run demo && npm run demo:scan && node scripts/check-demo-scan.ts
 *
 * Calibration proves the engine; this proves the adapter (fixture, reporter, CLI scan loop)
 * reports the same outcomes when Playwright drives the demo suite.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { checkArtifactPrivacy, compareWithGroundTruth, loadGroundTruth } from './ground-truth.ts';
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
const expected = loadGroundTruth();
failures.push(...compareWithGroundTruth(expected, coverage, proof));

const artifacts: Record<string, string> = {};
for (const name of ['coverage-summary.json', 'proof-summary.json', 'index.html', 'summary.md']) {
  const file = new URL(name, REPORT);
  if (existsSync(file)) artifacts[name] = readFileSync(file, 'utf8');
  else if (name === 'index.html' || name === 'summary.md') failures.push(`missing report/${name}`);
}
const rawCoverage = new URL('../raw/coverage/', REPORT);
const records = existsSync(rawCoverage) ? readdirSync(rawCoverage).filter((name) => name.endsWith('.json')) : [];
if (!records.length) failures.push('missing raw coverage records (run `npm run demo` first)');
for (const name of records) {
  artifacts[`raw/coverage/${name}`] = readFileSync(new URL(name, rawCoverage), 'utf8');
}
failures.push(...checkArtifactPrivacy(expected, artifacts));

if (coverage && proof) {
  console.log(`Real runner: UI coverage ${coverage.tested}/${coverage.total} | Fault check ${proof.killed} caught, ${proof.survived} slipped, ${proof.unstable ?? 0} unstable, ${proof.notApplicable} n/a`);
}
if (failures.length) {
  console.error('\nDEMO SCAN CHECK FAILED\n- ' + failures.join('\n- '));
  process.exit(1);
}
console.log('Demo scan check passed: real runner matches demo/expected.json');
