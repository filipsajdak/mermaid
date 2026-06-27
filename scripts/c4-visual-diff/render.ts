/* eslint-disable no-console -- CLI tool, console output is intentional */

/**
 * Render the C4 visual-diff corpus to PNGs via Playwright + a running dev server.
 *
 * Extends the single-file pattern in scripts/verify-diagram/verify.mjs with a batch mode, a
 * per-tile config sidecar, and the determinism settings used by the Cypress harness
 * (cypress/helpers/util.ts + cypress.config.ts): courier font, fixed seeds, scale factor 1,
 * 1440x1024 viewport. The screenshot clips the rendered #output so tile size tracks the diagram.
 *
 * Standalone:
 *   tsx scripts/c4-visual-diff/render.mts --batch-dir corpus --out-dir out/work --port 9180
 *   tsx scripts/c4-visual-diff/render.mts --file corpus/CHAR.person.mmd --output /tmp/p.png --port 9180
 */

import { chromium, type Browser } from 'playwright';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

/** Determinism defaults mirrored from cypress/helpers/util.ts (NOT imported - that pulls Cypress). */
const DETERMINISM_DEFAULTS = {
  startOnLoad: false,
  theme: 'default',
  fontFamily: 'courier',
  fontSize: '16px',
  handDrawnSeed: 1,
  architecture: { seed: 1 },
  cynefin: { seed: 1 },
};

const VIEWPORT = { width: 1440, height: 1024 };
const CLIP_PADDING = 32;

export interface TileResult {
  name: string;
  ok: boolean;
  error?: string;
  width?: number;
  height?: number;
}

export interface RenderCorpusOptions {
  corpusDir: string;
  outDir: string;
  port: number;
  timeoutMs?: number;
}

function buildHtml(serverUrl: string, diagramText: string, config: Record<string, unknown>): string {
  const safeDiagram = diagramText.replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Embed config as JSON in a script tag; only `<` needs escaping to avoid closing the tag.
  const safeConfig = JSON.stringify(config).replace(/</g, '\\u003c');
  const useElk = config.layout === 'elk';
  return `<!DOCTYPE html>
<html>
<head>
<style>
  body { margin: 16px; background: white; }
  #error { color: red; font-family: monospace; white-space: pre-wrap; display: none; }
</style>
<script type="application/json" id="mmconfig">${safeConfig}</script>
<script type="module">
import mermaid from '${serverUrl}/mermaid.esm.mjs';
${useElk ? `import elkLayouts from '${serverUrl}/mermaid-layout-elk.esm.mjs';\nmermaid.registerLayoutLoaders(elkLayouts);` : ''}
const config = JSON.parse(document.getElementById('mmconfig').textContent);
mermaid.initialize(config);
try {
  const { svg } = await mermaid.render('c4vd', document.getElementById('source').textContent);
  document.getElementById('output').innerHTML = svg;
  window.__rendered = true;
} catch (e) {
  document.getElementById('error').textContent = 'Render error: ' + (e && e.message ? e.message : e);
  document.getElementById('error').style.display = 'block';
  window.__renderError = (e && e.message ? e.message : String(e));
  window.__rendered = true;
}
</script>
</head>
<body>
<pre id="source" style="display:none">${safeDiagram}</pre>
<div id="output"></div>
<div id="error"></div>
</body>
</html>`;
}

async function renderOne(
  browser: Browser,
  serverUrl: string,
  name: string,
  diagramText: string,
  config: Record<string, unknown>,
  outPath: string,
  timeoutMs: number
): Promise<TileResult> {
  const page = await browser.newPage();
  try {
    await page.setViewportSize(VIEWPORT);
    await page.setContent(buildHtml(serverUrl, diagramText, config), {
      waitUntil: 'networkidle',
      timeout: 60_000,
    });
    await page.waitForFunction(() => (window as unknown as { __rendered?: boolean }).__rendered === true, {
      timeout: timeoutMs,
    });
    const renderError = (await page.evaluate(
      () => (window as unknown as { __renderError?: string }).__renderError
    )) as string | undefined;

    const box = await page.locator('#output').boundingBox();
    if (box && box.width > 0 && box.height > 0) {
      await page.screenshot({
        path: outPath,
        clip: {
          x: 0,
          y: 0,
          width: Math.ceil(box.x + box.width + CLIP_PADDING),
          height: Math.ceil(box.y + box.height + CLIP_PADDING),
        },
      });
    } else {
      // Nothing rendered (likely an error) - capture the page so the tile shows the failure.
      await page.screenshot({ path: outPath });
    }
    return renderError
      ? { name, ok: false, error: renderError }
      : { name, ok: true, width: box?.width, height: box?.height };
  } catch (err) {
    await page.screenshot({ path: outPath }).catch(() => {});
    return { name, ok: false, error: err instanceof Error ? err.message : String(err) };
  } finally {
    await page.close();
  }
}

export async function renderCorpus(options: RenderCorpusOptions): Promise<TileResult[]> {
  const { corpusDir, outDir, port } = options;
  const timeoutMs = options.timeoutMs ?? 30_000;
  const serverUrl = `http://localhost:${port}`;
  await mkdir(outDir, { recursive: true });

  const files = (await readdir(corpusDir)).filter((f) => f.endsWith('.mmd')).sort();
  const browser = await chromium.launch({
    headless: true,
    args: ['--force-device-scale-factor=1', `--window-size=${VIEWPORT.width},${VIEWPORT.height}`],
  });

  const results: TileResult[] = [];
  try {
    // Warm up: the esbuild dev server compiles the module graph lazily on the first render,
    // which can blow the per-tile timeout. Render a throwaway diagram first (generous timeout).
    const warmup = await browser.newPage();
    try {
      await warmup.setContent(
        buildHtml(serverUrl, 'C4Context\nPerson(a, "A")\n', DETERMINISM_DEFAULTS),
        { waitUntil: 'networkidle', timeout: 90_000 }
      );
      await warmup
        .waitForFunction(() => (window as unknown as { __rendered?: boolean }).__rendered === true, {
          timeout: 90_000,
        })
        .catch(() => {});
    } finally {
      await warmup.close();
    }

    for (const file of files) {
      const name = basename(file, '.mmd');
      const diagramText = await readFile(join(corpusDir, file), 'utf8');
      const sidecar = join(corpusDir, `${name}.json`);
      const overrides = existsSync(sidecar)
        ? (JSON.parse(await readFile(sidecar, 'utf8')) as Record<string, unknown>)
        : {};
      const config = { ...DETERMINISM_DEFAULTS, ...overrides };
      const outPath = join(outDir, `${name}.png`);
      const result = await renderOne(browser, serverUrl, name, diagramText, config, outPath, timeoutMs);
      results.push(result);
      console.log(
        `[c4:visual-diff] ${result.ok ? 'ok  ' : 'ERR '} ${name}${result.error ? ` - ${result.error}` : ''}`
      );
    }
  } finally {
    await browser.close();
  }
  return results;
}

// --- CLI ---

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      'batch-dir': { type: 'string' },
      'out-dir': { type: 'string' },
      file: { type: 'string' },
      output: { type: 'string' },
      port: { type: 'string', default: '9180' },
      timeout: { type: 'string', default: '15000' },
    },
    strict: false,
  });
  const port = Number(values.port);
  const timeoutMs = Number(values.timeout);

  if (values['batch-dir']) {
    const results = await renderCorpus({
      corpusDir: resolve(values['batch-dir'] as string),
      outDir: resolve((values['out-dir'] as string) ?? 'out/work'),
      port,
      timeoutMs,
    });
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      console.error(`[c4:visual-diff] ${failed.length}/${results.length} tiles failed to render`);
      process.exitCode = 1;
    }
    return;
  }

  if (!values.file) {
    console.error('Pass --batch-dir <dir> or --file <mmd>.');
    process.exit(1);
  }
  const browser = await chromium.launch({
    headless: true,
    args: ['--force-device-scale-factor=1'],
  });
  try {
    const name = basename(values.file as string, '.mmd');
    const text = await readFile(values.file as string, 'utf8');
    const res = await renderOne(
      browser,
      `http://localhost:${port}`,
      name,
      text,
      DETERMINISM_DEFAULTS,
      resolve((values.output as string) ?? '/tmp/c4-visual-diff.png'),
      timeoutMs
    );
    if (!res.ok) {
      console.error(`Render failed: ${res.error}`);
      process.exitCode = 1;
    } else {
      console.log('Saved', values.output ?? '/tmp/c4-visual-diff.png');
    }
  } finally {
    await browser.close();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  void main();
}
