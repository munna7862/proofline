/** Shared data contracts. Every file Proofline writes to disk uses these shapes. */

export interface ElementInfo {
  /** Stable key within a view: role|name|testid */
  key: string;
  tag: string;
  role: string;
  name: string;
  testId?: string;
  /** Normalized destination view for links */
  href?: string;
  /** Short CSS path, for humans to locate the element */
  path: string;
  /** Seen only while `disabled` or inside `aria-busy="true"` (a busy label such as "Processing..."). */
  disabled?: boolean;
}

export type AgentMessage =
  | { type: 'view'; view: string; url: string }
  | { type: 'inventory'; view: string; elements: ElementInfo[] }
  | { type: 'interaction'; view: string; key: string; event: string };

/** Everything one test touched. Written per test to .proofline/raw/coverage/<testId>.json */
export interface TestCoverageRecord {
  testId: string;
  title: string;
  file: string;
  line: number;
  status?: string;
  views: string[];
  inventory: Record<string, ElementInfo[]>;
  interactions: Record<string, string[]>; // view -> element keys
}

export interface ElementCoverage extends ElementInfo {
  tested: boolean;
  testedBy: string[];
  /** Untested link whose destination view some test opened another way (page.goto, redirect). */
  reachedByUrl?: boolean;
}

export interface ViewCoverage {
  view: string;
  visitedBy: string[];
  elements: ElementCoverage[];
  tested: number;
  total: number;
  /** Not applicable, never enabled: seen only while disabled or busy. Outside the score, shown in the report. */
  neverEnabled: ElementInfo[];
}

export interface CoverageSummary {
  generatedAt: string;
  tests: number;
  score: number; // 0..100
  tested: number;
  total: number;
  /** Elements outside the score because no test ever saw them enabled. */
  neverEnabled: number;
  views: ViewCoverage[];
  untestedLinks: { href: string; from: string[] }[];
}

/** One API endpoint a test called during the baseline run. */
export interface EndpointUse {
  key: string; // "GET http://host/api/products"
  method: string;
  pattern: string; // origin + normalized path
  json: boolean;
}

export interface TestRef {
  testId: string;
  title: string;
  file: string;
  line: number;
}

export interface TestNetworkRecord extends TestRef {
  status?: string;
  endpoints: EndpointUse[];
}

export type OperatorId = 'http-500' | 'network-fail' | 'empty-json' | 'shift-numbers' | 'blank-strings';

export interface Mutant {
  id: string;
  operator: OperatorId;
  method: string;
  pattern: string;
  /** Tests that called this endpoint during baseline; only these run for this mutant. */
  tests: TestRef[];
}

export type MutantOutcome = 'killed' | 'survived' | 'not-reached' | 'not-applicable' | 'error';

export interface MutantResult {
  mutant: Mutant;
  outcome: MutantOutcome;
  /** Tests that stayed green while the fault was active: the actionable list. */
  survivors: TestRef[];
  killers: TestRef[];
  durationMs: number;
}

/** What the fixture writes per test during a mutant run. */
export interface MutantHitRecord extends TestRef {
  mutantId: string;
  hit: boolean;
  changed: boolean;
  status: string;
}

export interface ProofSummary {
  generatedAt: string;
  score: number; // killed / (killed + survived), 0..100
  killed: number;
  survived: number;
  notReached: number;
  notApplicable: number;
  errors: number;
  results: MutantResult[];
  /** Tests ranked by how many faults they let through */
  weakestTests: { test: TestRef; survivedFaults: number }[];
  /** Per test: faults that reached it and how many made it fail. Feeds the VS Code lens. */
  testStrength: { test: TestRef; faults: number; caught: number }[];
}
