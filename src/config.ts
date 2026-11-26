import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AggregateOptions } from './coverage/aggregate.ts';

const FILE = 'proofline.config.json';

function invalid(message: string): never {
  throw new Error(`Invalid ${FILE}. ${message}`);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function strings(value: unknown, key: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || !item.trim())) {
    invalid(`${key} must be an array of nonempty strings.`);
  }
  return value;
}

export function parseCoverageConfig(value: unknown): AggregateOptions {
  if (!isObject(value)) invalid('Expected a JSON object.');
  const options: AggregateOptions = {};
  for (const key of Object.keys(value)) {
    if (key === 'ignoreViews' || key === 'ignoreElements') {
      options[key] = strings(value[key], key);
    } else if (key === 'viewRules') {
      const rules = value.viewRules;
      if (!Array.isArray(rules)) invalid('viewRules must be an array of rules.');
      options.viewRules = rules.map((rule: unknown, index: number) => {
        const field = `viewRules[${index}]`;
        if (!isObject(rule) || typeof rule.pattern !== 'string' || typeof rule.name !== 'string' || !rule.name.trim() ||
            Object.keys(rule).some((property) => property !== 'pattern' && property !== 'name')) {
          invalid(`${field} must contain a regex pattern and a nonempty view name.`);
        }
        try {
          new RegExp(rule.pattern);
        } catch {
          invalid(`${field}.pattern is not a valid regular expression.`);
        }
        return { pattern: rule.pattern, name: rule.name };
      });
    } else {
      invalid(`Unknown option "${key}".`);
    }
  }
  return options;
}

export function loadCoverageConfig(cwd = process.cwd()): AggregateOptions {
  let contents: string;
  try {
    contents = readFileSync(join(cwd, FILE), 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return {};
    throw error;
  }
  let config: unknown;
  try {
    config = JSON.parse(contents.replace(/^\uFEFF/, ''));
  } catch {
    invalid('Expected valid JSON.');
  }
  return parseCoverageConfig(config);
}
