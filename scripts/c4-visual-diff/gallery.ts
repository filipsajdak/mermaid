/* eslint-disable no-console -- CLI tool, console output is intentional */

/**
 * Build the C4 visual-diff gallery: composite before|after|diff sheets (reusing composeSheet from
 * scripts/argos-batch-sheets.ts), a self-contained index.html, and a summary.md for PR comments.
 */

import { composeSheet, type Sheet } from '../argos-batch-sheets.ts';
import type { DiffResult } from './diff.ts';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

/** Per-cell slot in the gallery sheets (smaller than the Cypress 1440x1024 to keep sheets light). */
const TILE_WIDTH = 700;
const TILE_IMAGE_HEIGHT = 520;
const ROWS_PER_SHEET = 8;
/** A tile counts as "changed" above this percentage of differing pixels (ignores AA noise). */
const CHANGED_PCT = 0.02;

export interface GalleryMeta {
  baseRef: string;
  workRef: string;
  generatedAt: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function isChanged(d: DiffResult): boolean {
  return !d.identical && d.pct >= CHANGED_PCT;
}

/** Build before|after|diff composite sheets under outDir/sheets/. */
async function buildSheets(results: DiffResult[], outDir: string): Promise<string[]> {
  const sheetsDir = join(outDir, 'sheets');
  await mkdir(sheetsDir, { recursive: true });
  const written: string[] = [];

  for (let start = 0, page = 1; start < results.length; start += ROWS_PER_SHEET, page++) {
    const chunk = results.slice(start, start + ROWS_PER_SHEET);
    const tiles = chunk.flatMap((d, row) => [
      { index: row * 3, row, col: 0, name: `${d.name} [before]`, source: `base/${d.name}.png` },
      { index: row * 3 + 1, row, col: 1, name: `${d.name} [after]`, source: `work/${d.name}.png` },
      { index: row * 3 + 2, row, col: 2, name: `${d.name} [diff]`, source: `diff/${d.name}.png` },
    ]);
    const output = `c4-diff-${String(page).padStart(3, '0')}.png`;
    const plan: Sheet = { group: 'c4-visual-diff', index: page - 1, output, cols: 3, tiles };
    const { buffer } = await composeSheet(plan, {
      inputDir: outDir,
      tileWidth: TILE_WIDTH,
      tileImageHeight: TILE_IMAGE_HEIGHT,
    });
    await writeFile(join(sheetsDir, output), buffer);
    written.push(output);
  }
  return written;
}

function buildIndexHtml(results: DiffResult[], meta: GalleryMeta): string {
  const changedCount = results.filter(isChanged).length;
  const rows = results
    .map((d) => {
      const changed = isChanged(d);
      const note = d.missingBase ? ' (new in work)' : d.missingWork ? ' (removed in work)' : '';
      return `<tr class="${changed ? 'changed' : 'same'}">
  <td class="name">${escapeHtml(d.name)}${note}</td>
  <td><img loading="lazy" src="base/${encodeURIComponent(d.name)}.png" alt="before"></td>
  <td><img loading="lazy" src="work/${encodeURIComponent(d.name)}.png" alt="after"></td>
  <td><img loading="lazy" src="diff/${encodeURIComponent(d.name)}.png" alt="diff"></td>
  <td class="pct">${d.pct.toFixed(2)}%</td>
</tr>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>C4 visual diff</title>
<style>
  body { font-family: sans-serif; margin: 24px; background: #fafafa; color: #222; }
  h1 { font-size: 20px; }
  .meta { color: #555; font-size: 13px; margin-bottom: 16px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #ddd; padding: 6px; vertical-align: top; text-align: center; }
  th { background: #f0f0f0; position: sticky; top: 0; }
  td.name { text-align: left; font-family: monospace; font-size: 12px; max-width: 180px; word-break: break-all; }
  td.pct { font-family: monospace; white-space: nowrap; }
  img { max-width: 360px; max-height: 280px; height: auto; background: #fff; border: 1px solid #eee; }
  tr.changed td.name { border-left: 4px solid #d33; }
  tr.changed td:nth-child(4) img { outline: 3px solid #d33; }
  tr.same td.pct { color: #2a2; }
</style>
</head>
<body>
<h1>C4 visual diff &mdash; ${changedCount} of ${results.length} tiles changed</h1>
<div class="meta">base: <code>${escapeHtml(meta.baseRef)}</code> &nbsp; work: <code>${escapeHtml(meta.workRef)}</code> &nbsp; ${escapeHtml(meta.generatedAt)}</div>
<table>
<thead><tr><th>tile</th><th>before (base)</th><th>after (work)</th><th>diff</th><th>changed</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
</body>
</html>`;
}

function buildSummaryMd(results: DiffResult[], meta: GalleryMeta): string {
  const changed = results.filter(isChanged);
  const lines: string[] = [];
  lines.push(`# C4 visual diff`);
  lines.push('');
  lines.push(`- base: \`${meta.baseRef}\``);
  lines.push(`- work: \`${meta.workRef}\``);
  lines.push(`- generated: ${meta.generatedAt}`);
  lines.push(`- **${changed.length} of ${results.length} tiles changed**`);
  lines.push('');
  lines.push('| tile | changed % | status |');
  lines.push('| --- | --- | --- |');
  for (const d of results) {
    const status = d.missingBase
      ? 'new'
      : d.missingWork
        ? 'removed'
        : isChanged(d)
          ? 'changed'
          : 'same';
    lines.push(`| \`${d.name}\` | ${d.pct.toFixed(2)}% | ${status} |`);
  }
  lines.push('');
  if (changed.length) {
    lines.push('## Changed tiles');
    lines.push('');
    for (const d of changed) {
      lines.push(`### \`${d.name}\` (${d.pct.toFixed(2)}%)`);
      lines.push('');
      lines.push(`before | after | diff`);
      lines.push(`--- | --- | ---`);
      lines.push(
        `![before](base/${d.name}.png) | ![after](work/${d.name}.png) | ![diff](diff/${d.name}.png)`
      );
      lines.push('');
    }
  }
  return lines.join('\n') + '\n';
}

export async function buildGallery(
  results: DiffResult[],
  outDir: string,
  meta: GalleryMeta
): Promise<{ changed: number; sheets: string[] }> {
  const sheets = await buildSheets(results, outDir);
  await writeFile(join(outDir, 'index.html'), buildIndexHtml(results, meta));
  await writeFile(join(outDir, 'summary.md'), buildSummaryMd(results, meta));
  return { changed: results.filter(isChanged).length, sheets };
}
