import type { CoverageSummary, ProofSummary } from '../types.ts';
import { OPERATORS } from '../proof/operators.ts';
import { REACHED_BY_URL } from './html.ts';

/** Short Markdown for $GITHUB_STEP_SUMMARY or a PR comment. Keep it under ~40 lines. */
export function renderMarkdown(c?: CoverageSummary, p?: ProofSummary): string {
  const lines: string[] = ['## Proofline', ''];
  if (c) {
    const na = c.neverEnabled ? `, ${c.neverEnabled} not applicable (never enabled)` : '';
    lines.push(`**UI coverage ${Math.round(c.score)}%** · ${c.tested} of ${c.total} interactive elements touched by ${c.tests} tests${na}`);
  }
  if (p) lines.push(`**Fault check ${Math.round(p.score)}%** · ${p.killed} of ${p.killed + p.survived} injected faults caught`);
  lines.push('');

  const slipped = p?.results.filter((r) => r.outcome === 'survived') ?? [];
  if (slipped.length) {
    lines.push('### Faults no test noticed', '', '| Endpoint | Fault | Tests that stayed green | Replay |', '|---|---|---|---|');
    for (const r of slipped.slice(0, 10)) {
      const path = (() => {
        try {
          return new URL(r.mutant.pattern).pathname;
        } catch {
          return r.mutant.pattern;
        }
      })();
      lines.push(
        `| \`${r.mutant.method} ${path}\` | ${OPERATORS[r.mutant.operator].label} | ${r.survivors.map((t) => t.title).join('<br>')} | \`npx proofline replay ${r.mutant.id}\` |`,
      );
    }
    if (slipped.length > 10) lines.push('', `…and ${slipped.length - 10} more in the HTML report.`);
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
        .map((e) => (e.name || e.role) + (e.reachedByUrl ? ' †' : ''));
      byUrl ||= names.some((n) => n.endsWith(' †'));
      lines.push(`- \`${v.view}\`: ${v.tested}/${v.total} touched. Untouched: ${names.join(', ')}`);
    }
    if (byUrl) lines.push('', `† ${REACHED_BY_URL}.`);
  }
  return lines.join('\n') + '\n';
}
