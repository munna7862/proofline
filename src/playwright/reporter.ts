/**
 * Playwright reporter. Add to playwright.config.ts:
 *   reporter: [['list'], ['proofline/reporter']]
 *
 * Verified in the real Playwright runner on the demo suite (Sprint 1).
 */
import type { Reporter } from '@playwright/test/reporter';
import { aggregateCoverage } from '../coverage/aggregate.ts';
import { displayPath, paths, readJsonDir, resetDir } from '../util/store.ts';
import { writeReport } from '../report/write.ts';
import type { TestCoverageRecord } from '../types.ts';

export interface ProoflineReporterOptions {
  ignoreViews?: string[];
  ignoreElements?: string[];
}

export default class ProoflineReporter implements Reporter {
  private options: ProoflineReporterOptions;
  private active: boolean;

  constructor(options: ProoflineReporterOptions = {}) {
    this.options = options;
    const mode = (process.env.PROOFLINE_MODE ?? 'coverage').toLowerCase();
    this.active = mode === 'coverage';
  }

  onBegin(): void {
    if (this.active) resetDir(paths.coverage);
  }

  async onEnd(): Promise<void> {
    if (!this.active) return;
    const records = readJsonDir<TestCoverageRecord>(paths.coverage);
    if (!records.length) {
      console.log('[proofline] No coverage recorded. Did your tests import { test } from "proofline/playwright"?');
      return;
    }
    const summary = aggregateCoverage(records, this.options);
    const file = writeReport({ coverage: summary });
    console.log(
      `[proofline] UI coverage ${Math.round(summary.score)}% (${summary.tested}/${summary.total} elements${summary.neverEnabled ? `, ${summary.neverEnabled} not applicable` : ''}). Report: ${displayPath(file)}`,
    );
  }

  printsToStdio(): boolean {
    return false;
  }
}
