import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Proofline talks between processes through files, not sockets:
 * Playwright workers write one JSON file per test, the CLI/reporter reads the folder.
 * This survives parallel workers, sharded CI jobs (upload/download the folder) and crashes.
 */
export const ROOT = resolve(process.env.PROOFLINE_DIR ?? '.proofline');

export const paths = {
  root: ROOT,
  coverage: join(ROOT, 'raw', 'coverage'),
  network: join(ROOT, 'raw', 'network'),
  mutant: (id: string) => join(ROOT, 'raw', 'mutants', id),
  report: join(ROOT, 'report'),
};

export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function resetDir(dir: string): string {
  rmSync(dir, { recursive: true, force: true });
  return ensureDir(dir);
}

export function safeFileName(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 120);
}

export function writeJson(dir: string, name: string, data: unknown): void {
  ensureDir(dir);
  writeFileSync(join(dir, `${safeFileName(name)}.json`), JSON.stringify(data, null, 2));
}

export function readJsonDir<T>(dir: string): T[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as T);
}
