/**
 * Proofline Lens (Phase 4 skeleton, not yet run).
 * Shows a CodeLens above each test that appears in .proofline/report/proof-summary.json:
 *   "Caught 0 of 8 faults · replay"      (red when under 50%)
 * Data comes only from local files written by `proofline scan`. No network, no telemetry.
 */
import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

interface Strength { test: { title: string; file: string; line: number }; faults: number; caught: number }
interface ProofSummary { testStrength: Strength[]; results: { mutant: { id: string; tests: { file: string; line: number }[] }; outcome: string }[] }

function loadSummary(root: string): ProofSummary | undefined {
  const file = path.join(root, '.proofline', 'report', 'proof-summary.json');
  if (!fs.existsSync(file)) return undefined;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as ProofSummary;
  } catch {
    return undefined;
  }
}

class ProoflineLens implements vscode.CodeLensProvider {
  private changed = new vscode.EventEmitter<void>();
  readonly onDidChangeCodeLenses = this.changed.event;
  refresh() { this.changed.fire(); }

  provideCodeLenses(doc: vscode.TextDocument): vscode.CodeLens[] {
    const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
    if (!folder) return [];
    const summary = loadSummary(folder.uri.fsPath);
    if (!summary) return [];
    const rel = path.relative(folder.uri.fsPath, doc.uri.fsPath).replace(/\\/g, '/');
    return summary.testStrength
      .filter((s) => rel.endsWith(s.test.file) || s.test.file.endsWith(rel))
      .map((s) => {
        const line = Math.max(0, s.test.line - 1);
        const range = new vscode.Range(line, 0, line, 0);
        const ratio = s.faults ? s.caught / s.faults : 1;
        const firstSurvivor = summary.results.find(
          (r) => r.outcome === 'survived' && r.mutant.tests.some((t) => t.line === s.test.line && rel.endsWith(t.file)),
        );
        const label = `${ratio < 0.5 ? '⚠ ' : ''}Proofline: caught ${s.caught} of ${s.faults} faults`;
        return new vscode.CodeLens(range, {
          title: firstSurvivor ? `${label} · replay one it missed` : label,
          command: firstSurvivor ? 'proofline.replay' : 'proofline.openReport',
          arguments: firstSurvivor ? [firstSurvivor.mutant.id] : [],
        });
      });
  }
}

export function activate(context: vscode.ExtensionContext) {
  const lens = new ProoflineLens();
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider([{ language: 'typescript' }, { language: 'javascript' }], lens),
    vscode.commands.registerCommand('proofline.openReport', () => {
      const root = vscode.workspace.workspaceFolders?.[0]?.uri;
      if (root) vscode.env.openExternal(vscode.Uri.joinPath(root, '.proofline', 'report', 'index.html'));
    }),
    vscode.commands.registerCommand('proofline.replay', (id: string) => {
      const term = vscode.window.createTerminal('Proofline replay');
      term.show();
      term.sendText(`npx proofline replay ${id}`);
    }),
  );
  const watcher = vscode.workspace.createFileSystemWatcher('**/.proofline/report/*.json');
  watcher.onDidChange(() => lens.refresh());
  watcher.onDidCreate(() => lens.refresh());
  context.subscriptions.push(watcher);
}

export function deactivate() {}
