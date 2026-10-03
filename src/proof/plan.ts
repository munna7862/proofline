import { shortHash } from '../util/normalize.ts';
import { DEFAULT_OPERATORS, OPERATORS } from './operators.ts';
import type {
  Mutant,
  MutantHitRecord,
  MutantResult,
  OperatorId,
  ProofSummary,
  TestNetworkRecord,
  TestRef,
} from '../types.ts';

export interface PlanOptions {
  operators?: OperatorId[];
  /** Hard cap on mutants. Selection is deterministic (sorted by id), never random. */
  maxMutants?: number;
  /** Only endpoints whose pattern includes one of these substrings */
  include?: string[];
  exclude?: string[];
}

/** Faults that turn a response into a failure. On an endpoint that already fails they change nothing. */
const FAILURE_OPERATORS = new Set<OperatorId>(['http-500', 'network-fail']);

/** Reason text when every baseline response was an error, else undefined. Mixed endpoints are still faulted. */
export function alreadyFailing(statuses: number[]): string | undefined {
  if (!statuses.length || statuses.some((s) => s < 400)) return undefined;
  return `already failing in baseline (${[...new Set(statuses)].sort((a, b) => a - b).join(', ')})`;
}

/** The result for a mutant the planner already ruled out, so the scan loop can skip running it. */
export function plannedResult(mutant: Mutant): MutantResult | undefined {
  if (!mutant.notApplicable) return undefined;
  return { mutant, outcome: 'not-applicable', reason: mutant.notApplicable, survivors: [], killers: [], durationMs: 0 };
}

/** Baseline records -> mutants. Only tests that PASSED the baseline are used. */
export function planMutants(baseline: TestNetworkRecord[], opts: PlanOptions = {}): Mutant[] {
  const operators = opts.operators ?? DEFAULT_OPERATORS;
  const byEndpoint = new Map<
    string,
    { method: string; pattern: string; json: boolean; tests: TestRef[]; statuses: Set<number>; statusKnown: boolean }
  >();

  for (const rec of baseline) {
    if (rec.status && rec.status !== 'passed') continue;
    const ref: TestRef = { testId: rec.testId, title: rec.title, file: rec.file, line: rec.line };
    for (const ep of rec.endpoints) {
      if (opts.include?.length && !opts.include.some((s) => ep.pattern.includes(s))) continue;
      if (opts.exclude?.some((s) => ep.pattern.includes(s))) continue;
      const entry = byEndpoint.get(ep.key) ?? {
        method: ep.method,
        pattern: ep.pattern,
        json: false,
        tests: [],
        statuses: new Set<number>(),
        statusKnown: true,
      };
      entry.json ||= ep.json;
      // A record without statuses (older baseline) makes the endpoint's status unknown: never n/a.
      if (ep.statuses?.length) for (const s of ep.statuses) entry.statuses.add(s);
      else entry.statusKnown = false;
      if (!entry.tests.some((t) => t.testId === ref.testId)) entry.tests.push(ref);
      byEndpoint.set(ep.key, entry);
    }
  }

  const mutants: Mutant[] = [];
  for (const [key, ep] of byEndpoint) {
    const failing = alreadyFailing(ep.statusKnown ? [...ep.statuses] : []);
    for (const opId of operators) {
      const op = OPERATORS[opId];
      if (op.needsJson && !ep.json) continue;
      const mutant: Mutant = {
        id: shortHash(`${key}|${opId}`),
        operator: opId,
        method: ep.method,
        pattern: ep.pattern,
        tests: ep.tests,
      };
      if (failing && FAILURE_OPERATORS.has(opId)) mutant.notApplicable = failing;
      mutants.push(mutant);
    }
  }
  mutants.sort((a, b) => a.pattern.localeCompare(b.pattern) || a.operator.localeCompare(b.operator));
  return opts.maxMutants ? mutants.slice(0, opts.maxMutants) : mutants;
}

/** Decide the outcome of one mutant from the per-test hit records. */
export function judgeMutant(mutant: Mutant, hits: MutantHitRecord[], durationMs: number): MutantResult {
  const relevant = hits.filter((h) => h.hit);
  if (hits.length === 0) {
    return { mutant, outcome: 'error', survivors: [], killers: [], durationMs };
  }
  if (relevant.length === 0) {
    return { mutant, outcome: 'not-reached', survivors: [], killers: [], durationMs };
  }
  if (!relevant.some((h) => h.changed)) {
    return { mutant, outcome: 'not-applicable', reason: 'no data of that kind in the response', survivors: [], killers: [], durationMs };
  }
  const ref = (h: MutantHitRecord): TestRef => ({ testId: h.testId, title: h.title, file: h.file, line: h.line });
  const killers = relevant.filter((h) => h.status !== 'passed' && h.status !== 'skipped').map(ref);
  const survivors = relevant.filter((h) => h.status === 'passed' && h.changed).map(ref);
  return {
    mutant,
    outcome: killers.length > 0 ? 'killed' : 'survived',
    survivors,
    killers,
    durationMs,
  };
}

/** One-line CLI result. A score over zero judged faults is meaningless, so it reads "n/a" instead of 0%. */
export function proofHeadline(p: ProofSummary): string {
  const na = p.notApplicable ? `, ${p.notApplicable} not applicable` : '';
  if (p.killed + p.survived === 0) return `Fault check n/a (0 judged)${na}.`;
  return `Fault check ${Math.round(p.score)}%: ${p.killed} caught, ${p.survived} slipped through${na}.`;
}

export function summarizeProof(results: MutantResult[]): ProofSummary {
  const count = (o: MutantResult['outcome']) => results.filter((r) => r.outcome === o).length;
  const killed = count('killed');
  const survived = count('survived');

  const weak = new Map<string, { test: TestRef; survivedFaults: number }>();
  for (const r of results) {
    for (const t of r.survivors) {
      const entry = weak.get(t.testId) ?? { test: t, survivedFaults: 0 };
      entry.survivedFaults++;
      weak.set(t.testId, entry);
    }
  }

  const strength = new Map<string, { test: TestRef; faults: number; caught: number }>();
  for (const r of results) {
    if (r.outcome !== 'killed' && r.outcome !== 'survived') continue;
    for (const t of r.killers) {
      const e = strength.get(t.testId) ?? { test: t, faults: 0, caught: 0 };
      e.faults++;
      e.caught++;
      strength.set(t.testId, e);
    }
    for (const t of r.survivors) {
      const e = strength.get(t.testId) ?? { test: t, faults: 0, caught: 0 };
      e.faults++;
      strength.set(t.testId, e);
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    score: killed + survived ? Math.round((killed / (killed + survived)) * 1000) / 10 : 0,
    killed,
    survived,
    notReached: count('not-reached'),
    notApplicable: count('not-applicable'),
    errors: count('error'),
    results,
    weakestTests: [...weak.values()].sort((a, b) => b.survivedFaults - a.survivedFaults),
    testStrength: [...strength.values()].sort((a, b) => a.caught / a.faults - b.caught / b.faults),
  };
}
