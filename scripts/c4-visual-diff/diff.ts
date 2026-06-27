/* eslint-disable no-console -- CLI tool, console output is intentional */

/**
 * Pixel-diff base vs work PNGs for the C4 visual-diff harness.
 *
 * sharp decodes each PNG to a raw RGBA buffer; pixelmatch (the same engine cy.matchImageSnapshot
 * uses, via cypress-image-snapshot -> jest-image-snapshot) computes the changed-pixel count and a
 * red heat-map; sharp re-encodes the heat-map. Mismatched sizes (a layout change can grow the
 * diagram) are white-padded to the larger of the two before diffing so the comparison never throws.
 */

import sharp from 'sharp';
import pixelmatch from 'pixelmatch';
import { writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

export interface DiffResult {
  name: string;
  changed: number;
  total: number;
  pct: number;
  baseSize: [number, number];
  workSize: [number, number];
  identical: boolean;
  missingBase?: boolean;
  missingWork?: boolean;
}

/** Decode a PNG to RGBA and pad to (width,height) with white, top-left anchored. */
async function decodePadded(path: string, width: number, height: number): Promise<Buffer> {
  const img = sharp(path).ensureAlpha();
  const meta = await img.metadata();
  if (meta.width === width && meta.height === height) {
    return img.raw().toBuffer();
  }
  return sharp(path)
    .ensureAlpha()
    .extend({
      top: 0,
      left: 0,
      bottom: Math.max(0, height - (meta.height ?? 0)),
      right: Math.max(0, width - (meta.width ?? 0)),
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    })
    .raw()
    .toBuffer();
}

async function rawMeta(path: string): Promise<{ width: number; height: number }> {
  const meta = await sharp(path).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0 };
}

export async function diffTile(
  name: string,
  basePath: string,
  workPath: string,
  diffPath: string,
  threshold: number
): Promise<DiffResult> {
  const missingBase = !existsSync(basePath);
  const missingWork = !existsSync(workPath);
  if (missingBase || missingWork) {
    // Render the side that exists as the diff so the gallery still shows something.
    const present = missingBase ? workPath : basePath;
    if (existsSync(present)) {
      await mkdir(dirname(diffPath), { recursive: true });
      await sharp(present).toFile(diffPath);
      const m = await rawMeta(present);
      return {
        name,
        changed: m.width * m.height,
        total: m.width * m.height,
        pct: 100,
        baseSize: missingBase ? [0, 0] : [m.width, m.height],
        workSize: missingWork ? [0, 0] : [m.width, m.height],
        identical: false,
        missingBase,
        missingWork,
      };
    }
  }

  const baseMeta = await rawMeta(basePath);
  const workMeta = await rawMeta(workPath);
  const width = Math.max(baseMeta.width, workMeta.width);
  const height = Math.max(baseMeta.height, workMeta.height);

  const [baseBuf, workBuf] = await Promise.all([
    decodePadded(basePath, width, height),
    decodePadded(workPath, width, height),
  ]);

  const diffBuf = Buffer.alloc(width * height * 4);
  const changed = pixelmatch(baseBuf, workBuf, diffBuf, width, height, {
    threshold,
    includeAA: false,
    alpha: 0.4,
    diffColor: [255, 0, 0],
  });

  await mkdir(dirname(diffPath), { recursive: true });
  await sharp(diffBuf, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(diffPath);

  const total = width * height;
  return {
    name,
    changed,
    total,
    pct: total === 0 ? 0 : (changed / total) * 100,
    baseSize: [baseMeta.width, baseMeta.height],
    workSize: [workMeta.width, workMeta.height],
    identical: changed === 0,
  };
}

export async function diffAll(
  names: string[],
  baseDir: string,
  workDir: string,
  diffDir: string,
  threshold: number
): Promise<DiffResult[]> {
  const results: DiffResult[] = [];
  for (const name of names) {
    const result = await diffTile(
      name,
      `${baseDir}/${name}.png`,
      `${workDir}/${name}.png`,
      `${diffDir}/${name}.png`,
      threshold
    );
    await writeFile(
      `${diffDir}/${name}.json`,
      JSON.stringify(result, null, 2) + '\n'
    );
    results.push(result);
  }
  return results;
}
