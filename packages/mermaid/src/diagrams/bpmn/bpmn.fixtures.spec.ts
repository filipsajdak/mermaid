import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { extractFrontMatter } from '../../diagram-api/frontmatter.js';
import { parseBpmn } from './parser/bpmn.parser.js';

// A rule of the notation that refuses a fixture the e2e tests draw would turn that drawing
// into the error diagram, which only a browser run would show. Every fixture is parsed here.

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../');
const fixtureFolders = [
  'e2e/platform/dev-diagrams/diagrams/bpmn',
  'e2e/platform/dev-diagrams/layout-tests/bpmn',
  'e2e/diagrams/bpmn',
];

const fixtures = fixtureFolders.flatMap((folder) =>
  readdirSync(join(repoRoot, folder), { recursive: true, encoding: 'utf8' })
    .filter((name) => name.endsWith('.mmd'))
    .map((name) => relative(repoRoot, join(repoRoot, folder, name)))
);

describe('bpmn e2e fixtures', () => {
  it('finds the fixtures', () => {
    expect(fixtures.length).toBeGreaterThan(0);
  });

  it.each(fixtures)('parses %s', (fixture) => {
    const { text } = extractFrontMatter(readFileSync(join(repoRoot, fixture), 'utf8'));
    expect(() => parseBpmn(text)).not.toThrow();
  });
});
