import type { CoverageSummary, MutantResult, ProofSummary } from '../types.ts';
import { OPERATORS } from '../proof/operators.ts';

/**
 * Renders ONE self-contained HTML file. Rules:
 *  - no network requests (no CDN fonts, no scripts from elsewhere): MNC security teams open these offline
 *  - no response bodies or user data in the report, only element names, endpoints and test titles
 *  - every number shows its denominator ("23 of 37"), never a bare percentage
 */

export interface ReportInput {
  project: string;
  coverage?: CoverageSummary;
  proof?: ProofSummary;
}

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const pct = (n: number) => `${Math.round(n)}%`;

function meter(value: number, tone: 'cov' | 'proof'): string {
  const v = Math.max(0, Math.min(100, value));
  return `<div class="meter meter-${tone}" role="img" aria-label="${pct(v)}"><span style="width:${v}%"></span></div>`;
}

export function endpointLabel(r: MutantResult): string {
  try {
    const u = new URL(r.mutant.pattern);
    return `${r.mutant.method} ${u.pathname}`;
  } catch {
    return `${r.mutant.method} ${r.mutant.pattern}`;
  }
}

const OUTCOME_TEXT: Record<string, string> = {
  killed: 'Caught',
  survived: 'Slipped through',
  'not-reached': 'Not reached',
  'not-applicable': 'Not applicable',
  error: 'Run error',
};

export const REACHED_BY_URL = 'Destination visited by URL, link never clicked';
export const NEVER_ENABLED = 'Not applicable: never enabled';
const NEVER_ENABLED_HINT = 'Seen only while disabled or busy, so no test could use it. Not counted in the score.';

function coverageSection(c: CoverageSummary): string {
  const views = c.views
    .map((v) => {
      const untested = v.elements.filter((e) => !e.tested);
      const tested = v.elements.filter((e) => e.tested);
      const ratio = v.total ? (v.tested / v.total) * 100 : 0;
      return `<article class="view">
        <header>
          <h4><code>${esc(v.view)}</code></h4>
          <p class="muted">${v.tested} of ${v.total} elements touched</p>
        </header>
        ${meter(ratio, 'cov')}
        ${
          untested.length
            ? `<p class="label">Never touched by a test</p>
               <ul class="chips">${untested
                 .map(
                   (e) =>
                     `<li class="chip chip-gap" title="${esc(e.path)}"><span class="role">${esc(e.role)}</span> ${esc(e.name || e.testId || e.path)}${
                       e.reachedByUrl ? ` <span class="chip-note">${REACHED_BY_URL}</span>` : ''
                     }</li>`,
                 )
                 .join('')}</ul>`
            : v.total
              ? '<p class="ok">Every interactive element on this view was touched.</p>'
              : ''
        }
        ${
          v.neverEnabled.length
            ? `<p class="label" title="${NEVER_ENABLED_HINT}">${NEVER_ENABLED}</p>
               <ul class="chips">${v.neverEnabled
                 .map(
                   (e) =>
                     `<li class="chip chip-na" title="${esc(e.path)}"><span class="role">${esc(e.role)}</span> ${esc(e.name || e.testId || e.path)}</li>`,
                 )
                 .join('')}</ul>`
            : ''
        }
        ${
          tested.length
            ? `<details><summary>${tested.length} touched</summary><ul class="chips">${tested
                .map(
                  (e) =>
                    `<li class="chip" title="Touched by: ${esc(e.testedBy.join(', '))}"><span class="role">${esc(e.role)}</span> ${esc(e.name || e.testId || e.path)}</li>`,
                )
                .join('')}</ul></details>`
            : ''
        }
      </article>`;
    })
    .join('');

  const links = c.untestedLinks.length
    ? `<h3>Pages no test visits</h3>
       <ul class="plain">${c.untestedLinks
         .map((l) => `<li><code>${esc(l.href)}</code> <span class="muted">linked from ${l.from.map(esc).join(', ')}</span></li>`)
         .join('')}</ul>`
    : '';

  return `<section id="coverage">
    <h2>UI coverage</h2>
    <p class="lede">What your tests touched. An element counts once a test clicks, types into, or changes it. Links count only when clicked. Elements only ever seen disabled or busy are not applicable and stay out of the score.</p>
    <div class="views">${views}</div>
    ${links}
  </section>`;
}

function proofSection(p: ProofSummary): string {
  const order: Record<string, number> = { survived: 0, killed: 1, error: 2, 'not-reached': 3, 'not-applicable': 4 };
  const shown = p.results.filter((r) => r.outcome === 'killed' || r.outcome === 'survived' || r.outcome === 'error');
  // Faults the planner ruled out get their reason spelled out; the rest stay a one-line count.
  const ruledOut = p.results.filter((r) => r.outcome === 'not-applicable' && r.mutant.notApplicable);
  const skipped = p.results.length - shown.length - ruledOut.length;
  const ruledOutList = ruledOut.length
    ? `<h3>Not applicable</h3>
       <ul class="plain">${[...ruledOut]
         .sort((a, b) => a.mutant.pattern.localeCompare(b.mutant.pattern) || a.mutant.operator.localeCompare(b.mutant.operator))
         .map((r) => `<li><code>${esc(endpointLabel(r))}</code> ${esc(OPERATORS[r.mutant.operator].label)}: <span class="muted">${esc(r.reason ?? '')}</span></li>`)
         .join('')}</ul>`
    : '';
  const rows = [...shown]
    .sort((a, b) => order[a.outcome] - order[b.outcome] || a.mutant.pattern.localeCompare(b.mutant.pattern))
    .map((r) => {
      const who =
        r.outcome === 'survived'
          ? `<ul class="plain">${r.survivors.map((t) => `<li>${esc(t.title)} <span class="muted">${esc(t.file)}:${t.line}</span></li>`).join('')}</ul>`
          : r.outcome === 'killed'
            ? `<span class="muted">${r.killers.map((t) => esc(t.title)).join(', ')}</span>`
            : '';
      return `<tr data-outcome="${r.outcome}">
        <td data-label="Endpoint"><code>${esc(endpointLabel(r))}</code></td>
        <td data-label="Fault">${esc(OPERATORS[r.mutant.operator].label)}</td>
        <td data-label="Result"><span class="badge badge-${r.outcome}">${OUTCOME_TEXT[r.outcome]}</span></td>
        <td data-label="Tests">${who}</td>
        <td data-label="Replay"><button class="copy" data-copy="npx proofline replay ${esc(r.mutant.id)}" aria-label="Copy replay command for ${esc(r.mutant.id)}">${esc(r.mutant.id)}</button></td>
      </tr>`;
    })
    .join('');

  return `<section id="proof">
    <h2>Fault check</h2>
    <p class="lede">Proofline broke each API your tests depend on, one way at a time, and re-ran only the tests that call it. A fault that slips through means no test noticed the app was broken.</p>
    <div class="filters" role="group" aria-label="Filter faults">
      <button class="filter is-on" data-filter="all">All</button>
      <button class="filter" data-filter="survived">Slipped through (${p.survived})</button>
      <button class="filter" data-filter="killed">Caught (${p.killed})</button>
    </div>
    <div class="table-wrap"><table>
      <thead><tr><th>Endpoint</th><th>Fault</th><th>Result</th><th>Tests</th><th>Replay</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    ${skipped ? `<p class="muted note">${skipped} more faults were skipped: the response had no data of that kind, or no test reached the endpoint.</p>` : ''}
    ${ruledOutList}
  </section>`;
}

function fixFirst(c?: CoverageSummary, p?: ProofSummary): string {
  const items: string[] = [];
  const weak = (p?.testStrength ?? []).filter((t) => t.faults > 0 && t.caught / t.faults < 0.5).slice(0, 3);
  for (const w of weak) {
    items.push(
      `<li><strong>${esc(w.test.title)}</strong> caught ${w.caught} of ${w.faults} faults in the APIs it calls. It passes even when its data is broken, so assert on what the page shows. <span class="muted">${esc(w.test.file)}:${w.test.line}</span></li>`,
    );
  }
  const worstView = c?.views.find((v) => v.total > 0 && v.tested < v.total);
  if (worstView) {
    const gaps = worstView.elements.filter((e) => !e.tested).slice(0, 3).map((e) => esc(e.name || e.role));
    items.push(`<li><strong><code>${esc(worstView.view)}</code></strong> has ${worstView.total - worstView.tested} elements no test touches, starting with ${gaps.join(', ')}.</li>`);
  }
  if (!items.length) return '';
  return `<section id="fix-first"><h2>Fix these first</h2><ol class="fix">${items.join('')}</ol></section>`;
}

export function renderReport(input: ReportInput): string {
  const { coverage: c, proof: p } = input;
  const generated = new Date(p?.generatedAt ?? c?.generatedAt ?? Date.now()).toLocaleString();

  const scoreCards = [
    c
      ? `<div class="score">
          <p class="score-name">UI coverage</p>
          <p class="score-value">${pct(c.score)}</p>
          ${meter(c.score, 'cov')}
          <p class="muted">${c.tested} of ${c.total} interactive elements touched by ${c.tests} tests${c.neverEnabled ? `, ${c.neverEnabled} not applicable (never enabled)` : ''}</p>
        </div>`
      : '',
    p
      ? `<div class="score">
          <p class="score-name">Fault check</p>
          <p class="score-value">${p.killed + p.survived ? pct(p.score) : 'n/a'}</p>
          ${meter(p.score, 'proof')}
          <p class="muted">${p.killed} of ${p.killed + p.survived} injected faults caught${p.notReached ? `, ${p.notReached} not reached` : ''}${p.notApplicable ? `, ${p.notApplicable} not applicable` : ''}</p>
        </div>`
      : '',
  ].join('');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Proofline report: ${esc(input.project)}</title>
<style>
:root{--paper:#f4f6f8;--card:#fff;--ink:#17202b;--muted:#5b6876;--line:#d7dde3;--brand:#2a3fd6;--cov:#2a3fd6;--good:#17795a;--good-bg:#e3f4ec;--bad:#b42318;--bad-bg:#fde8e6;--warn:#8a5a00;--warn-bg:#fdf3dc}
@media (prefers-color-scheme:dark){:root{--paper:#11161c;--card:#19212a;--ink:#e6ebf0;--muted:#97a3b0;--line:#2c3742;--brand:#8b9bff;--cov:#8b9bff;--good:#5fd0a5;--good-bg:#12382b;--bad:#ff8a7a;--bad-bg:#43191a;--warn:#f2c46b;--warn-bg:#3a2d12}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:15px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
code,.copy{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em}
main{max-width:1080px;margin:0 auto;padding:28px 20px 64px}
.top{display:flex;justify-content:space-between;align-items:baseline;gap:16px;flex-wrap:wrap;border-bottom:2px solid var(--ink);padding-bottom:14px}
.brand{font-weight:800;font-size:22px;letter-spacing:-.02em;margin:0}
.brand span{color:var(--brand)}
.muted{color:var(--muted)}
.scores{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:24px 0}
.score{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:18px 20px}
.score-name{margin:0;font-weight:600}
.score-value{margin:4px 0 10px;font-size:44px;font-weight:800;letter-spacing:-.03em;line-height:1}
.meter{height:8px;background:var(--line);border-radius:4px;overflow:hidden}
.meter span{display:block;height:100%}
.meter-cov span{background:var(--cov)}
.meter-proof span{background:var(--good)}
h2{font-size:20px;margin:40px 0 6px}
h3{font-size:16px;margin:28px 0 8px}
h4{margin:0;font-size:15px}
.lede{color:var(--muted);max-width:70ch;margin:0 0 16px}
.views{display:grid;gap:12px}
.view{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.view header{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px}
.view header p{margin:0}
.label{margin:12px 0 6px;font-weight:600;font-size:13px}
.ok{color:var(--good);margin:10px 0 0}
.chips{list-style:none;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid var(--line);border-radius:6px;padding:3px 8px;font-size:13px;background:var(--paper)}
.chip-gap{border-color:var(--bad);background:var(--bad-bg)}
.chip-na{border-style:dashed;color:var(--muted)}
.role{color:var(--muted);font-size:12px}
.chip-note{color:var(--muted);font-size:12px}
details{margin-top:10px}
summary{cursor:pointer;color:var(--muted);font-size:13px}
details .chips{margin-top:8px}
.plain{margin:0;padding-left:18px}
.fix{padding-left:20px;margin:8px 0 0}
.fix li{margin:6px 0}
.filters{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}
.filter{border:1px solid var(--line);background:var(--card);color:var(--ink);border-radius:999px;padding:5px 12px;font:inherit;font-size:13px;cursor:pointer}
.filter.is-on{border-color:var(--ink);font-weight:600}
.table-wrap{overflow-x:auto;background:var(--card);border:1px solid var(--line);border-radius:10px}
table{border-collapse:collapse;width:100%;min-width:720px}
th,td{text-align:left;padding:10px 12px;border-bottom:1px solid var(--line);vertical-align:top;font-size:14px}
th{font-size:12px;color:var(--muted);font-weight:600}
tr:last-child td{border-bottom:0}
.badge{display:inline-block;border-radius:6px;padding:2px 8px;font-size:12px;font-weight:600;white-space:nowrap}
.badge-killed{background:var(--good-bg);color:var(--good)}
.badge-survived{background:var(--bad-bg);color:var(--bad)}
.badge-not-reached,.badge-not-applicable,.badge-error{background:var(--warn-bg);color:var(--warn)}
.copy{border:1px dashed var(--line);background:transparent;color:var(--ink);border-radius:6px;padding:3px 8px;cursor:pointer}
.copy.done{border-style:solid;border-color:var(--good);color:var(--good)}
button:focus-visible{outline:2px solid var(--brand);outline-offset:2px}
.note{font-size:13px;margin:10px 0 0}
@media (max-width:640px){
  table{min-width:0}
  thead{display:none}
  tr{display:block;padding:10px 4px;border-bottom:1px solid var(--line)}
  tr:last-child{border-bottom:0}
  td{display:flex;gap:12px;border:0;padding:3px 10px}
  td::before{content:attr(data-label);flex:0 0 72px;color:var(--muted);font-size:12px;padding-top:2px}
  .score-value{font-size:38px}
}
footer{margin-top:48px;color:var(--muted);font-size:13px}
</style>
</head>
<body>
<main>
  <div class="top">
    <p class="brand">Proof<span>line</span></p>
    <p class="muted">${esc(input.project)}, generated ${esc(generated)}</p>
  </div>
  <div class="scores">${scoreCards}</div>
  ${fixFirst(c, p)}
  ${p ? proofSection(p) : ''}
  ${c ? coverageSection(c) : ''}
  <footer>Generated locally by Proofline. No test data left this machine.</footer>
</main>
<script>
document.querySelectorAll('.filter').forEach(function(b){b.addEventListener('click',function(){
  document.querySelectorAll('.filter').forEach(function(x){x.classList.toggle('is-on',x===b)});
  var f=b.getAttribute('data-filter');
  document.querySelectorAll('tbody tr').forEach(function(r){r.hidden=!(f==='all'||r.getAttribute('data-outcome')===f)});
})});
document.querySelectorAll('.copy').forEach(function(b){b.addEventListener('click',function(){
  var t=b.getAttribute('data-copy');
  (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(function(){
    var old=b.textContent;b.textContent='Copied';b.classList.add('done');setTimeout(function(){b.textContent=old;b.classList.remove('done')},1400)
  }).catch(function(){window.prompt('Copy this command',t)});
})});
</script>
</body>
</html>`;
}
