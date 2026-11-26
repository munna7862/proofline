import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { CoverageSummary, TestCoverageRecord } from '../src/types.ts';

const CLI = resolve('src/cli.ts');
const REPORTER = pathToFileURL(resolve('src/playwright/reporter.ts')).href;

test('scan survives a Playwright run that prints more than 1 MB (chatty webServer)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'proofline-cli-'));
  try {
    writeFileSync(join(dir, 'package.json'), '{"name":"fixture","private":true}');
    const pw = join(dir, 'node_modules', '@playwright', 'test');
    mkdirSync(pw, { recursive: true });
    writeFileSync(join(pw, 'package.json'), '{"name":"@playwright/test","version":"0.0.0"}');
    // Fake runner: 2 MB of server log lines on stdout and stderr, no test records.
    writeFileSync(join(pw, 'cli.js'), "const l = 'x'.repeat(1023) + '\\n'; for (let i = 0; i < 2048; i++) { process.stdout.write(l); process.stderr.write(l); }");

    const env = { ...process.env };
    delete env.PROOFLINE_DIR;
    const res = spawnSync(process.execPath, [CLI, 'scan'], { cwd: dir, encoding: 'utf8', env });
    assert.doesNotMatch(res.stderr, /ENOBUFS/);
    assert.match(res.stderr, /No passing tests recorded/);
    assert.equal(res.status, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('report and the Playwright reporter share the project coverage file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'proofline-config-'));
  try {
    const env = { ...process.env };
    delete env.PROOFLINE_DIR;
    env.PROOFLINE_MODE = 'coverage';
    const config = join(dir, 'proofline.config.json');
    writeFileSync(config, '\uFEFF' + JSON.stringify({
      ignoreViews: ['Skip view'],
      ignoreElements: ['File skip'],
      viewRules: [
        { pattern: '^/settings$', name: 'Account settings' },
        { pattern: '^/private/', name: 'Skip view' },
      ],
    }));
    const control = (name: string) => ({ tag: 'button', role: 'button', name, key: `button|${name}|`, path: 'button' });
    const record: TestCoverageRecord = {
      testId: 'sample', title: 'Sample', file: 'sample.spec.ts', line: 1, status: 'passed',
      views: ['/settings', '/private/console'],
      inventory: {
        '/settings': [control('Save'), control('File skip'), control('Manual skip')],
        '/private/console': [control('Debug')],
      },
      interactions: { '/settings': ['button|Save|'] },
    };
    const raw = join(dir, '.proofline', 'raw', 'coverage');
    mkdirSync(raw, { recursive: true });
    writeFileSync(join(raw, 'sample.json'), JSON.stringify(record));
    const report = join(dir, '.proofline', 'report', 'coverage-summary.json');
    const read = () => JSON.parse(readFileSync(report, 'utf8')) as CoverageSummary;
    const run = (args: string[]) => spawnSync(process.execPath, args, { cwd: dir, env, encoding: 'utf8' });
    const reporter = (options = {}) => run([
      '--input-type=module', '--eval',
      `const { default: Reporter } = await import(${JSON.stringify(REPORTER)}); await new Reporter(${JSON.stringify(options)}).onEnd();`,
    ]);
    const cli = run([CLI, 'report']);
    assert.equal(cli.status, 0, cli.stderr);
    const summary = read();
    assert.equal(summary.tested, 1);
    assert.equal(summary.total, 2);
    assert.deepEqual(summary.views.map(({ view }) => view), ['Account settings']);
    assert.deepEqual(summary.views[0]!.elements.map(({ name }) => name).sort(), ['Manual skip', 'Save']);

    const standard = reporter();
    assert.equal(standard.status, 0, standard.stderr);
    assert.deepEqual({ ...read(), generatedAt: summary.generatedAt }, summary);
    const override = reporter({ ignoreElements: ['Manual skip'] });
    assert.equal(override.status, 0, override.stderr);
    assert.deepEqual(read().views[0]!.elements.map(({ name }) => name).sort(), ['File skip', 'Save']);

    const previous = readFileSync(report, 'utf8');
    writeFileSync(config, JSON.stringify({ viewRules: [{ pattern: '[', name: 'Invalid' }] }));
    const malformed = run([CLI, 'report']);
    assert.equal(malformed.status, 2);
    assert.match(malformed.stderr, /viewRules\[0\]\.pattern is not a valid regular expression/);
    assert.equal(readFileSync(report, 'utf8'), previous);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
