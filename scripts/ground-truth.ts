/**
 * Compares engine output with demo/expected.json.
 * Shared by scripts/calibrate.ts (engine without the runner) and
 * scripts/check-demo-scan.ts (the real Playwright runner), so both are held to the same rules.
 */
import { readFileSync } from 'node:fs';
import type { CoverageSummary, ProofSummary } from '../src/types.ts';

interface GroundTruth {
  coverage: { untested: string[]; tested: string[] };
  proof: Record<string, Record<string, string>>;
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
    if (proof.weakestTests[0]?.test.title !== expected.weakestTest) {
      failures.push(`proof: weakest test expected "${expected.weakestTest}", got "${proof.weakestTests[0]?.test.title}"`);
    }
  }
  return failures;
}
