/**
 * Compares engine output with demo/expected.json.
 * Shared by scripts/calibrate.ts (engine without the runner) and
 * scripts/check-demo-scan.ts (the real Playwright runner), so both are held to the same rules.
 */
import { readFileSync } from 'node:fs';
import type { CoverageSummary, MutantOutcome, MutantResult, ProofSummary } from '../src/types.ts';

export interface GroundTruth {
  coverage: {
    counts: Pick<CoverageSummary, 'tests' | 'neverEnabled'>;
    untested: string[];
    tested: string[];
  };
  /** Tests whose failure keeps their coverage out of the summary. */
  testsExcluded?: number;
  /** Exact set of view keys the coverage summary must contain. */
  views: string[];
  /** Links that must be untested with reachedByUrl on every view they appear on. */
  reachedByUrl?: string[];
  /** Exact scored element keys per view: no phantoms (busy labels, file names), no duplicates. */
  elements: Record<string, string[]>;
  /** Exact tested element keys per view. */
  testedIn: Record<string, string[]>;
  /** Synthetic field values and URL parameters that may never appear in artifacts. */
  privateMarkers?: string[];
  /** Exact element path per view and key (paths are for humans; they must read right). */
  paths?: Record<string, Record<string, string>>;
  /** Collapsed list elements per view and key, with how many distinct items they stand for. */
  seen?: Record<string, Record<string, number>>;
  /** Elements that must be "not applicable: never enabled", outside the score. */
  neverEnabled?: string[];
  proof: Record<string, Record<string, MutantOutcome>>;
  /** Exact set of faults the planner rules out as "already failing in baseline", per endpoint. */
  alreadyFailing?: Record<string, string[]>;
  weakestTest: string;
}

export function loadGroundTruth(): GroundTruth {
  return JSON.parse(readFileSync(new URL('../demo/expected.json', import.meta.url), 'utf8')) as GroundTruth;
}

export function checkArtifactPrivacy(expected: GroundTruth, artifacts: Record<string, string>): string[] {
  const failures: string[] = [];
  for (const [name, content] of Object.entries(artifacts)) {
    if (expected.privateMarkers?.some((marker) => content.includes(marker))) {
      failures.push(`privacy: ${name} contains a synthetic private value`);
    }
  }
  return failures;
}

function checkNumbers<K extends string>(
  failures: string[], section: string, expected: Record<K, number>, actual: Record<NoInfer<K>, number>,
): void {
  for (const key of Object.keys(expected) as K[]) {
    if (actual[key] !== expected[key]) failures.push(`${section}: ${key} expected ${expected[key]}, got ${actual[key]}`);
  }
}

function faultLabel({ mutant }: MutantResult): string {
  // The expectations are shared by local runs regardless of the demo server origin.
  return `${mutant.method} ${new URL(mutant.pattern).pathname} ${mutant.operator}`;
}

/** Returns one line per disagreement; empty means the output matches ground truth. */
export function compareWithGroundTruth(
  expected: GroundTruth,
  coverage: CoverageSummary | undefined,
  proof: ProofSummary | undefined,
): string[] {
  const failures: string[] = [];
  if (coverage) {
    const { tests, neverEnabled: expectedNeverEnabled } = expected.coverage.counts;
    checkNumbers(failures, 'coverage', { tests, neverEnabled: expectedNeverEnabled }, coverage);

    const got = coverage.views.map((v) => v.view).sort();
    const want = [...expected.views].sort();
    if (got.join('\n') !== want.join('\n')) failures.push(`coverage: views expected [${want.join(', ')}], got [${got.join(', ')}]`);

    let total = 0;
    let tested = 0;
    let complete = true;
    for (const view of want) {
      const elements = expected.elements[view];
      const testedIn = expected.testedIn[view];
      if (!elements) failures.push(`coverage: no expected inventory for ${view}`);
      if (!testedIn) failures.push(`coverage: no expected tested controls for ${view}`);
      if (!elements || !testedIn) {
        complete = false;
        continue;
      }
      total += elements.length;
      tested += testedIn.length;
    }
    if (complete) {
      const score = total ? Math.round((tested / total) * 1000) / 10 : 0;
      checkNumbers(failures, 'coverage', { tested, total, score }, coverage);
    }

    let neverEnabled = 0;
    for (const view of coverage.views) {
      checkNumbers(failures, `coverage ${view.view}`, {
        tested: view.elements.filter((element) => element.tested).length,
        total: view.elements.length,
      }, view);
      neverEnabled += view.neverEnabled.length;
    }
    if (neverEnabled !== expectedNeverEnabled) {
      failures.push(`coverage: never enabled inventory expected ${expectedNeverEnabled}, got ${neverEnabled}`);
    }
  }
  if (coverage && expected.testsExcluded !== undefined && coverage.testsExcluded !== expected.testsExcluded) {
    failures.push(`coverage: testsExcluded expected ${expected.testsExcluded}, got ${coverage.testsExcluded}`);
  }
  if (coverage && expected.reachedByUrl) {
    for (const key of expected.reachedByUrl) {
      const els = coverage.views.flatMap((v) => v.elements).filter((e) => e.key === key);
      if (!els.length) failures.push(`coverage: link "${key}" not found in inventory`);
      else if (els.some((e) => e.tested || !e.reachedByUrl)) failures.push(`coverage: "${key}" should be untested with reachedByUrl`);
    }
  }
  if (coverage) {
    for (const [view, keys] of Object.entries(expected.elements)) {
      const v = coverage.views.find((x) => x.view === view);
      const got = (v?.elements ?? []).map((e) => e.key).sort();
      const want = [...keys].sort();
      if (got.join('\n') !== want.join('\n')) failures.push(`coverage: ${view} elements expected [${want.join(', ')}], got [${got.join(', ')}]`);
    }
  }
  if (coverage) {
    for (const [view, keys] of Object.entries(expected.testedIn)) {
      const v = coverage.views.find((x) => x.view === view);
      const got = (v?.elements ?? []).filter((e) => e.tested).map((e) => e.key).sort();
      const want = [...keys].sort();
      if (got.join('\n') !== want.join('\n')) failures.push(`coverage: ${view} tested expected [${want.join(', ')}], got [${got.join(', ')}]`);
    }
  }
  if (coverage && expected.paths) {
    for (const [view, byKey] of Object.entries(expected.paths)) {
      const v = coverage.views.find((x) => x.view === view);
      for (const [key, path] of Object.entries(byKey)) {
        const got = v?.elements.find((e) => e.key === key)?.path;
        if (got !== path) failures.push(`coverage: ${view} "${key}" path expected "${path}", got "${got}"`);
      }
    }
  }
  if (coverage && expected.seen) {
    for (const [view, byKey] of Object.entries(expected.seen)) {
      const v = coverage.views.find((x) => x.view === view);
      for (const [key, n] of Object.entries(byKey)) {
        const got = v?.elements.find((e) => e.key === key)?.seen;
        if (got !== n) failures.push(`coverage: ${view} "${key}" expected ${n} seen, got ${got}`);
      }
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
    const expectedFaults = new Map<string, MutantOutcome>();
    for (const [endpoint, ops] of Object.entries(expected.proof)) {
      for (const [op, outcome] of Object.entries(ops)) {
        expectedFaults.set(`${endpoint} ${op}`, outcome);
      }
    }
    const seen = new Set<string>();
    for (const result of proof.results) {
      const label = faultLabel(result);
      if (seen.has(label)) failures.push(`proof: duplicate mutant for ${label}`);
      seen.add(label);
      const outcome = expectedFaults.get(label);
      if (outcome === undefined) failures.push(`proof: unexpected mutant for ${label}`);
      else if (result.outcome !== outcome) failures.push(`proof: ${label} expected ${outcome}, got ${result.outcome}`);
    }
    for (const label of expectedFaults.keys()) {
      if (!seen.has(label)) failures.push(`proof: no mutant for ${label}`);
    }
    const outcomes = [...expectedFaults.values()];
    const count = (outcome: MutantOutcome) => outcomes.filter((value) => value === outcome).length;
    const killed = count('killed');
    const survived = count('survived');
    const judged = killed + survived;
    checkNumbers(failures, 'proof', {
      killed,
      survived,
      unstable: count('unstable'),
      notReached: count('not-reached'),
      notApplicable: count('not-applicable'),
      errors: count('error'),
      score: judged ? Math.round((killed / judged) * 1000) / 10 : 0,
    }, proof);
    if (expected.alreadyFailing) {
      const got = proof.results.filter((r) => r.reason?.startsWith('already failing in baseline')).map(faultLabel).sort();
      const want = Object.entries(expected.alreadyFailing).flatMap(([ep, ops]) => ops.map((op) => `${ep} ${op}`)).sort();
      if (got.join('\n') !== want.join('\n')) failures.push(`proof: already failing in baseline expected [${want.join(', ')}], got [${got.join(', ')}]`);
    }
    if (proof.weakestTests[0]?.test.title !== expected.weakestTest) {
      failures.push(`proof: weakest test expected "${expected.weakestTest}", got "${proof.weakestTests[0]?.test.title}"`);
    }
  }
  return failures;
}
