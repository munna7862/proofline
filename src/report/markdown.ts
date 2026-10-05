import type { CoverageSummary, ProofSummary } from '../types.ts';
import { OPERATORS } from '../proof/operators.ts';
import { endpointLabel, REACHED_BY_URL } from './html.ts';

/** Short Markdown for $GITHUB_STEP_SUMMARY or a PR comment. Keep it under ~40 lines. */
export function renderMarkdown(c?: CoverageSummary, p?: ProofSummary): string {
  const lines: string[] = ['## Proofline', ''];
  if (c) {
    const na = c.neverEnabled ? `, ${c.neverEnabled} not applicable (never enabled)` : '';
    lines.push(`**UI coverage ${Math.round(c.score)}%** · ${c.tested} of ${c.total} interactive elements touched by ${c.tests} tests${na}`);
    if (c.testsExcluded) lines.push('', `${c.testsExcluded} ${c.testsExcluded === 1 ? 'test' : 'tests'} failed; their coverage is not counted.`);
  }
  if (p) {
    const judged = p.killed + p.survived;
    const na = (p.unstable ? `, ${p.unstable} unstable (flaky test)` : '') + (p.notApplicable ? `, ${p.notApplicable} not applicable` : '');
    lines.push(`**Fault check ${judged ? `${Math.round(p.score)}%` : 'n/a'}** · ${p.killed} of ${judged} injected faults caught${na}`);
  }
  lines.push('');

  const slipped = p?.results.filter((r) => r.outcome === 'survived') ?? [];
  if (slipped.length) {
    lines.push('### Faults no test noticed', '', '| Endpoint | Fault | Tests that stayed green | Replay |', '|---|---|---|---|');
    for (const r of slipped.slice(0, 10)) {
      lines.push(
        `| \`${endpointLabel(r)}\` | ${OPERATORS[r.mutant.operator].label} | ${r.survivors.map((t) => t.title).join('<br>')} | \`npx proofline replay ${r.mutant.id}\` |`,
      );
    }
    if (slipped.length > 10) lines.push('', `…and ${slipped.length - 10} more in the HTML report.`);
    lines.push('');
  }

  const unstable = p?.results.filter((r) => r.outcome === 'unstable') ?? [];
  if (unstable.length) {
    lines.push('### Unstable: caught only by a flaky test', '', 'Outside the score. The test that failed with the fault passed when re-run with it.', '');
    for (const r of unstable.slice(0, 5)) {
      lines.push(`- \`${endpointLabel(r)}\` ${OPERATORS[r.mutant.operator].label}: ${r.reason}. Replay: \`npx proofline replay ${r.mutant.id}\``);
    }
    if (unstable.length > 5) lines.push(`- …and ${unstable.length - 5} more in the HTML report.`);
    lines.push('');
  }

  const ruledOut = p?.results.filter((r) => r.outcome === 'not-applicable' && r.mutant.notApplicable) ?? [];
  if (ruledOut.length) {
    lines.push('### Not applicable', '');
    for (const r of ruledOut.slice(0, 5)) lines.push(`- \`${endpointLabel(r)}\` ${OPERATORS[r.mutant.operator].label}: ${r.reason}`);
    if (ruledOut.length > 5) lines.push(`- …and ${ruledOut.length - 5} more in the HTML report.`);
    lines.push('');
  }

  const gaps = c?.views.filter((v) => v.tested < v.total).slice(0, 5) ?? [];
  if (gaps.length) {
    lines.push('### Least-covered views', '');
    let byUrl = false;
    for (const v of gaps) {
      const names = v.elements
        .filter((e) => !e.tested)
        .slice(0, 4)
        .map((e) => (e.seen ? `${e.role} ${e.name}` : e.name || e.role) + (e.reachedByUrl ? ' †' : ''));
      byUrl ||= names.some((n) => n.endsWith(' †'));
      lines.push(`- \`${v.view}\`: ${v.tested}/${v.total} touched. Untouched: ${names.join(', ')}`);
    }
    if (byUrl) lines.push('', `† ${REACHED_BY_URL}.`);
  }
  return lines.join('\n') + '\n';
}
