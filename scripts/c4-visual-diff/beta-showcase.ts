/* eslint-disable no-console */
// Renders the c4-beta corpus on the working tree (converge) as a "new syntax"
// showcase - c4-beta does not exist on develop, so a before/after diff does not
// apply; this is a standalone gallery of the new syntax rendering.
import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startOrAdoptDevServer } from './server-utils.ts';
import { renderCorpus } from './render.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      corpus: { type: 'string', default: join(scriptDir, 'corpus-beta') },
      out: { type: 'string', default: 'out/beta' },
      port: { type: 'string', default: '9190' },
    },
    strict: false,
  });
  const corpusDir = resolve(values.corpus as string);
  const outDir = resolve(values.out as string);
  const port = Number(values.port);
  await mkdir(outDir, { recursive: true });

  const repoRoot = resolve(scriptDir, '..', '..');
  const server = await startOrAdoptDevServer(repoRoot, port);
  let results;
  try {
    results = await renderCorpus({ corpusDir, outDir: join(outDir, 'img'), port, timeoutMs: 30_000 });
  } finally {
    await server.stop();
  }
  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    console.warn(`[beta-showcase] ${failed.length}/${results.length} FAILED:`);
    for (const f of failed) {
      console.warn(`    ${f.name}: ${f.error}`);
    }
  }
  const tiles = (await readdir(join(outDir, 'img'))).filter((f) => f.endsWith('.png')).sort();
  const cells = tiles
    .map((t) => {
      const src = relative(outDir, join(outDir, 'img', t));
      return `<figure><figcaption>${t.replace(/\.png$/, '')}</figcaption><img src="${src}" alt="${t}"></figure>`;
    })
    .join('\n');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>c4-beta showcase</title>
<style>body{font-family:system-ui,sans-serif;margin:24px;background:#fafafa}h1{font-size:18px}
.grid{display:flex;flex-wrap:wrap;gap:20px}figure{margin:0;background:#fff;border:1px solid #e5e5e5;border-radius:8px;padding:12px}
figcaption{font-size:12px;font-weight:600;margin-bottom:8px;color:#333}img{display:block;max-width:520px;height:auto}</style>
</head><body><h1>c4-beta - new structurizr-style syntax (${tiles.length} diagrams, converge @006352830)</h1>
<div class="grid">
${cells}
</div></body></html>`;
  const indexPath = join(outDir, 'index.html');
  await writeFile(indexPath, html, 'utf8');
  console.log(`[beta-showcase] ${tiles.length} tiles -> ${indexPath}`);
}

void main();
