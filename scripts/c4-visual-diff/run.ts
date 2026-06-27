/* eslint-disable no-console -- CLI tool, console output is intentional */

/**
 * c4:visual-diff orchestrator.
 *
 * Renders the C4 corpus on a BASE ref and the WORKING TREE, pixel-diffs them, and writes a
 * before|after|diff gallery (out/index.html + out/summary.md + out/sheets/). The base ref is
 * rendered from a persistent git worktree under the system temp dir so the working tree is never
 * disturbed and repeat runs are fast. Servers are stopped by tracked PID in a finally block.
 *
 *   pnpm c4:visual-diff                          # working tree vs upstream/develop
 *   pnpm c4:visual-diff --base HEAD~3 --open
 *   pnpm c4:visual-diff --skip-base-install      # base worktree deps already present
 *   pnpm c4:visual-diff --push-assets            # also push the gallery to c4-proof-assets
 */

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cp, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

import { startOrAdoptDevServer, isPortFree, type ManagedServer } from './server-utils.ts';
import { renderCorpus } from './render.ts';
import { diffAll } from './diff.ts';
import { buildGallery } from './gallery.ts';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, '..', '..');

function git(args: string[], cwd: string = repoRoot): string {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

function sanitizeRef(ref: string): string {
  return ref.replace(/[^a-zA-Z0-9._-]/g, '-');
}

async function preflightChromium(): Promise<void> {
  try {
    const browser = await chromium.launch({ headless: true });
    await browser.close();
  } catch (err) {
    console.error('[c4:visual-diff] Playwright Chromium failed to launch.');
    console.error('  Run once: npx playwright install chromium');
    console.error(`  (${err instanceof Error ? err.message : err})`);
    process.exit(1);
  }
}

function ensureBaseWorktree(basePath: string, baseRef: string): void {
  if (existsSync(join(basePath, '.git'))) {
    console.log(`[c4:visual-diff] reusing base worktree ${basePath}`);
    git(['checkout', '--detach', baseRef], basePath);
    return;
  }
  console.log(`[c4:visual-diff] creating base worktree ${basePath} @ ${baseRef}`);
  git(['worktree', 'add', '--detach', basePath, baseRef]);
}

function ensureBaseDeps(basePath: string, skip: boolean): void {
  if (existsSync(join(basePath, 'node_modules'))) {
    return;
  }
  if (skip) {
    console.warn(
      `[c4:visual-diff] --skip-base-install set but ${basePath}/node_modules is missing; ` +
        `the base server will fail to start. Install deps there or drop the flag.`
    );
    return;
  }
  // Fast path: identical lockfile => symlink the working tree's node_modules trees.
  const workLock = existsSync(join(repoRoot, 'pnpm-lock.yaml'))
    ? execFileSync('cat', [join(repoRoot, 'pnpm-lock.yaml')], { encoding: 'utf8' })
    : '';
  let baseLock = '';
  try {
    baseLock = git(['show', 'HEAD:pnpm-lock.yaml'], basePath);
  } catch {
    /* no lockfile at base */
  }
  if (workLock && baseLock && workLock.trim() === baseLock.trim()) {
    console.log('[c4:visual-diff] lockfile matches base; symlinking node_modules (no install)');
    const nmDirs = execFileSync(
      'find',
      ['.', '-maxdepth', '3', '-name', 'node_modules', '-type', 'd', '-not', '-path', '*/node_modules/*'],
      { cwd: repoRoot, encoding: 'utf8' }
    )
      .split('\n')
      .map((l) => l.replace(/^\.\//, '').trim())
      .filter(Boolean);
    for (const rel of nmDirs) {
      const target = join(repoRoot, rel);
      const linkPath = join(basePath, rel);
      execFileSync('mkdir', ['-p', dirname(linkPath)]);
      execFileSync('ln', ['-sfn', target, linkPath]);
    }
    return;
  }
  console.log('[c4:visual-diff] installing base worktree deps (pnpm install --prefer-offline)...');
  execFileSync('pnpm', ['install', '--prefer-offline'], { cwd: basePath, stdio: 'inherit' });
}

async function pushAssets(outDir: string, baseRef: string, workRef: string): Promise<void> {
  const assetsPath = join(tmpdir(), 'c4-assets');
  if (!existsSync(join(assetsPath, '.git'))) {
    git(['worktree', 'add', assetsPath, 'c4-proof-assets']);
  } else {
    git(['checkout', 'c4-proof-assets'], assetsPath);
  }
  const stamp = sanitizeRef(workRef);
  const dest = join(assetsPath, `vd-${stamp}`);
  await mkdir(dest, { recursive: true });
  for (const sub of ['sheets', 'diff', 'base', 'work']) {
    if (existsSync(join(outDir, sub))) {
      await cp(join(outDir, sub), join(dest, sub), { recursive: true });
    }
  }
  await cp(join(outDir, 'index.html'), join(dest, 'index.html'));
  await cp(join(outDir, 'summary.md'), join(dest, 'summary.md'));
  git(['add', '-A'], assetsPath);
  git(['commit', '-m', `c4:visual-diff proof - base:${baseRef} work:${workRef}`], assetsPath);
  git(['push', 'origin', 'c4-proof-assets'], assetsPath);
  const remote = git(['remote', 'get-url', 'origin'], assetsPath).replace(/\.git$/, '');
  console.log(`[c4:visual-diff] pushed gallery to c4-proof-assets: ${remote}/tree/c4-proof-assets/vd-${stamp}`);
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      base: { type: 'string', default: 'upstream/develop' },
      'port-work': { type: 'string', default: '9180' },
      'port-base': { type: 'string', default: '9181' },
      corpus: { type: 'string' },
      out: { type: 'string' },
      threshold: { type: 'string', default: '0.1' },
      'push-assets': { type: 'boolean', default: false },
      'skip-base-install': { type: 'boolean', default: false },
      'clean-base': { type: 'boolean', default: false },
      open: { type: 'boolean', default: false },
    },
    strict: false,
  });

  const baseRef = values.base as string;
  const portWork = Number(values['port-work']);
  const portBase = Number(values['port-base']);
  const threshold = Number(values.threshold);
  const corpusDir = values.corpus ? resolve(values.corpus as string) : join(scriptDir, 'corpus');
  const outDir = values.out ? resolve(values.out as string) : join(scriptDir, 'out');
  const baseDir = join(outDir, 'base');
  const workDir = join(outDir, 'work');
  const diffDir = join(outDir, 'diff');
  const basePath = join(tmpdir(), `c4-vd-base-${sanitizeRef(baseRef)}`);

  await preflightChromium();
  for (const [label, port] of [
    ['port-work', portWork],
    ['port-base', portBase],
  ] as const) {
    if (!(await isPortFree(port))) {
      console.log(`[c4:visual-diff] note: ${label} :${port} is busy (will adopt if it is a dev server)`);
    }
  }

  const workRef = `${git(['rev-parse', '--abbrev-ref', 'HEAD'])}@${git(['rev-parse', '--short', 'HEAD'])}`;
  const baseSha = git(['rev-parse', '--short', baseRef]);

  const servers: ManagedServer[] = [];
  let cleaned = false;
  const cleanup = async (): Promise<void> => {
    if (cleaned) {
      return;
    }
    cleaned = true;
    for (const s of servers) {
      await s.stop();
    }
    if (values['clean-base'] && existsSync(join(basePath, '.git'))) {
      try {
        git(['worktree', 'remove', '--force', basePath]);
      } catch {
        /* leave it */
      }
    }
  };
  process.on('SIGINT', () => void cleanup().then(() => process.exit(130)));
  process.on('SIGTERM', () => void cleanup().then(() => process.exit(143)));

  try {
    console.log(`[c4:visual-diff] base ${baseRef} (${baseSha})  vs  work ${workRef}`);

    // 1. Render the working tree.
    const workServer = await startOrAdoptDevServer(repoRoot, portWork);
    servers.push(workServer);
    await renderCorpus({ corpusDir, outDir: workDir, port: portWork });
    if (!workServer.adopted) {
      await workServer.stop();
      servers.splice(servers.indexOf(workServer), 1);
    }

    // 2. Render the base ref from a persistent worktree.
    ensureBaseWorktree(basePath, baseRef);
    ensureBaseDeps(basePath, values['skip-base-install'] as boolean);
    const baseServer = await startOrAdoptDevServer(basePath, portBase);
    servers.push(baseServer);
    await renderCorpus({ corpusDir, outDir: baseDir, port: portBase });
    if (!baseServer.adopted) {
      await baseServer.stop();
      servers.splice(servers.indexOf(baseServer), 1);
    }

    // 3. Diff + gallery.
    const names = (await readdir(corpusDir))
      .filter((f) => f.endsWith('.mmd'))
      .map((f) => f.replace(/\.mmd$/, ''))
      .sort();
    const results = await diffAll(names, baseDir, workDir, diffDir, threshold);
    const meta = {
      baseRef: `${baseRef} (${baseSha})`,
      workRef,
      generatedAt: new Date().toISOString(),
    };
    const { changed, sheets } = await buildGallery(results, outDir, meta);

    const identical = results.length - changed;
    console.log('');
    console.log(`[c4:visual-diff] corpus ${results.length} tiles  changed ${changed}  identical ${identical}`);
    console.log(`[c4:visual-diff] gallery: ${join(outDir, 'index.html')}`);
    console.log(`[c4:visual-diff] sheets:  ${sheets.length} under ${join(outDir, 'sheets')}`);
    console.log(`[c4:visual-diff] open:    open ${join(outDir, 'index.html')}`);

    if (values['push-assets']) {
      await pushAssets(outDir, `${baseRef} (${baseSha})`, workRef);
    }
    if (values.open) {
      const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
      try {
        execFileSync(opener, [join(outDir, 'index.html')]);
      } catch {
        /* headless; ignore */
      }
    }
  } finally {
    await cleanup();
  }
}

void main().catch((err) => {
  console.error('[c4:visual-diff] fatal:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
