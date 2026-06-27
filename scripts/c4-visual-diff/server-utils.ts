/* eslint-disable no-console -- CLI tool, console output is intentional */

/**
 * Dev-server lifecycle for the C4 visual-diff harness.
 *
 * Spawns `pnpm dev` with an explicit MERMAID_DEV_PORT (the server otherwise hashes its port
 * from the worktree path, which is unpredictable for a temp base worktree), or ADOPTS an
 * already-running server on that port. Readiness is probed against `/mermaid.esm.mjs` (the
 * bundle endpoint), not `/` - the server starts listening before esbuild finishes the first
 * build. Shutdown kills the spawned process GROUP by PID; it never uses pkill (a broad pkill
 * kills every worktree's dev server, a known footgun in this repo).
 */

import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

export interface ManagedServer {
  port: number;
  pid: number | undefined;
  /** True when we attached to a pre-existing server; stop() is then a no-op. */
  adopted: boolean;
  stop: () => Promise<void>;
}

const POLL_INTERVAL_MS = 500;
const DEFAULT_READY_TIMEOUT_MS = 90_000;
const STOP_GRACE_MS = 5000;

export function esmUrl(port: number): string {
  return `http://localhost:${port}/mermaid.esm.mjs`;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True if nothing is listening on the port (we can bind it ourselves). */
export async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once('error', () => resolve(false));
    srv.once('listening', () => srv.close(() => resolve(true)));
    srv.listen(port, '127.0.0.1');
  });
}

/** True if a mermaid dev server is serving the bundle on this port. */
export async function probeMermaid(port: number): Promise<boolean> {
  try {
    const res = await fetch(esmUrl(port), { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function waitForServer(
  port: number,
  timeoutMs = DEFAULT_READY_TIMEOUT_MS
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastErr = 'no response';
  while (Date.now() < deadline) {
    if (await probeMermaid(port)) {
      return;
    }
    lastErr = 'bundle not ready';
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error(
    `Dev server on port ${port} did not serve /mermaid.esm.mjs within ${timeoutMs}ms (${lastErr})`
  );
}

/**
 * Start a `pnpm dev` server in `cwd` on `port`, or adopt an existing one already serving there.
 * Throws if the port is occupied by a non-mermaid process.
 */
export async function startOrAdoptDevServer(cwd: string, port: number): Promise<ManagedServer> {
  if (!(await isPortFree(port))) {
    if (await probeMermaid(port)) {
      console.log(`[c4:visual-diff] adopting existing dev server on :${port}`);
      return { port, pid: undefined, adopted: true, stop: async () => {} };
    }
    throw new Error(`Port ${port} is in use by a non-mermaid process. Pass a different --port-*.`);
  }

  console.log(`[c4:visual-diff] starting dev server on :${port} (cwd ${cwd})`);
  const child = spawn('pnpm', ['dev'], {
    cwd,
    env: { ...process.env, MERMAID_DEV_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true, // own process group so stop() can signal the whole tree
  });

  let exited = false;
  child.once('exit', (code) => {
    exited = true;
    if (code && code !== 0 && code !== null) {
      console.warn(`[c4:visual-diff] dev server on :${port} exited early with code ${code}`);
    }
  });

  const stop = async (): Promise<void> => {
    if (exited || child.pid === undefined) {
      return;
    }
    try {
      process.kill(-child.pid, 'SIGTERM'); // negative pid => process group
    } catch {
      /* already gone */
    }
    const deadline = Date.now() + STOP_GRACE_MS;
    while (!exited && Date.now() < deadline) {
      await sleep(100);
    }
    if (!exited && child.pid !== undefined) {
      try {
        process.kill(-child.pid, 'SIGKILL');
      } catch {
        /* already gone */
      }
    }
  };

  try {
    await waitForServer(port);
  } catch (err) {
    await stop();
    throw err;
  }

  return { port, pid: child.pid, adopted: false, stop };
}
