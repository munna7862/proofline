/**
 * Playwright Test adapter.
 *
 *   import { test, expect } from 'proofline/playwright';
 *
 * One auto fixture does everything, switched by PROOFLINE_MODE:
 *   coverage (default)  record UI coverage for the HTML report
 *   record              record which API endpoints each test depends on (used by `proofline scan`)
 *   mutant              inject the fault in PROOFLINE_MUTANT and record whether it was hit
 *   off                 do nothing
 *
 * Verified in the real Playwright runner on the demo suite (coverage, scan and replay, Sprint 1).
 */
import { test as base, expect } from '@playwright/test';
import { relative } from 'node:path';
import { attachCoverage, CoverageRecorder, flushCoverage } from '../coverage/collector.ts';
import { injectMutant, NetworkRecorder } from '../proof/inject.ts';
import { paths, writeJson } from '../util/store.ts';
import type { Mutant, MutantHitRecord, TestNetworkRecord } from '../types.ts';

type Mode = 'coverage' | 'record' | 'mutant' | 'off';

function currentMode(): Mode {
  const m = (process.env.PROOFLINE_MODE ?? 'coverage').toLowerCase();
  return (['coverage', 'record', 'mutant', 'off'].includes(m) ? m : 'coverage') as Mode;
}

let cachedMutant: Mutant | undefined;
function currentMutant(): Mutant | undefined {
  if (cachedMutant) return cachedMutant;
  const raw = process.env.PROOFLINE_MUTANT;
  if (!raw) return undefined;
  cachedMutant = JSON.parse(raw) as Mutant;
  return cachedMutant;
}

export const test = base.extend<{ _proofline: void }>({
  _proofline: [
    async ({ context }, use, testInfo) => {
      const mode = currentMode();
      if (mode === 'off') {
        await use();
        return;
      }

      const ref = {
        testId: testInfo.testId,
        title: testInfo.titlePath.slice(1).join(' › '),
        file: relative(process.cwd(), testInfo.file).replace(/\\/g, '/'),
        line: testInfo.line,
      };

      if (mode === 'coverage') {
        const recorder = new CoverageRecorder();
        await attachCoverage(context, recorder);
        await use();
        await flushCoverage(context);
        writeJson(paths.coverage, ref.testId, recorder.toRecord({ ...ref, status: testInfo.status }));
        return;
      }

      if (mode === 'record') {
        const net = new NetworkRecorder();
        net.attach(context);
        await use();
        const rec: TestNetworkRecord = { ...ref, status: testInfo.status, endpoints: net.endpoints() };
        writeJson(paths.network, ref.testId, rec);
        return;
      }

      // mutant
      const mutant = currentMutant();
      if (!mutant) throw new Error('PROOFLINE_MODE=mutant but PROOFLINE_MUTANT is not set');
      const state = await injectMutant(context, mutant);
      await use();
      const hit: MutantHitRecord = {
        ...ref,
        mutantId: mutant.id,
        hit: state.hit,
        changed: state.changed,
        status: testInfo.status ?? 'unknown',
      };
      writeJson(paths.mutant(mutant.id), ref.testId, hit);
    },
    { auto: true },
  ],
});

export { expect };
