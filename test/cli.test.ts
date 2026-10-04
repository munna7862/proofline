import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const CLI = resolve('src/cli.ts');

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
