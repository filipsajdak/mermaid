import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBpmn } from './parser/bpmn.parser.js';
import { BPMN_DIRECTIONS, EVENT_TRIGGERS, TASK_TYPES } from './types.js';

// The prompt on the syntax page is written by hand, so it is checked against the grammar:
// it names every direction, trigger and task type, and its example parses.

const HEADING = '## Writing a diagram with a language model';

/** Run from the repository root or from `packages/mermaid`, so both are tried. */
const page = [
  resolve(process.cwd(), 'packages/mermaid/src/docs/syntax/bpmn.md'),
  resolve(process.cwd(), 'src/docs/syntax/bpmn.md'),
].find((candidate) => existsSync(candidate));

const prompt = (): string => {
  if (!page) {
    throw new Error('the bpmn syntax page was not found');
  }
  const markdown = readFileSync(page, 'utf8');
  const section = markdown.slice(markdown.indexOf(HEADING));
  const fence = /^```text\r?\n([\S\s]*?)\r?\n```$/m.exec(section);
  if (!markdown.includes(HEADING) || !fence) {
    throw new Error(`no text block under "${HEADING}"`);
  }
  return fence[1];
};

const words = (text: string) => new Set(text.split(/[^\w-]+/));

describe('bpmn prompt', () => {
  it.each([...BPMN_DIRECTIONS, ...EVENT_TRIGGERS.filter((trigger) => trigger !== 'none')])(
    'names %s',
    (word) => {
      expect(words(prompt()).has(word)).toBe(true);
    }
  );

  it.each(TASK_TYPES)('names the %s task type', (type) => {
    expect(words(prompt()).has(type)).toBe(true);
  });

  it('gives an example that parses', () => {
    const example = prompt().split(/^EXAMPLE\r?\n/m)[1];
    expect(example).toMatch(/^bpmn-beta /);
    expect(() => parseBpmn(example)).not.toThrow();
  });
});
