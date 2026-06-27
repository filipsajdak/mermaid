# C4 visual-diff harness (`pnpm c4:visual-diff`)

A local, Argos-free visual regression check for the C4 diagram work. It renders a fixed corpus of
C4 diagrams on a **base ref** and on the **working tree**, pixel-diffs them, and writes a
`before | after | diff` gallery you can open in a browser or paste into a PR. It exists so C4
rendering changes stay reviewable while the project is out of Argos screenshot credits.

## Usage

```bash
npx playwright install chromium          # one-time: install the browser binary

pnpm c4:visual-diff                       # working tree vs upstream/develop
pnpm c4:visual-diff --base HEAD~3 --open  # vs 3 commits back, open the gallery
pnpm c4:visual-diff --base origin/feature/c4-migrate-edges
pnpm c4:visual-diff --push-assets         # also push the gallery to the c4-proof-assets branch
```

Then open `scripts/c4-visual-diff/out/index.html`, or paste `out/summary.md` into a PR comment.

### Flags

| Flag | Default | Meaning |
| --- | --- | --- |
| `--base <ref>` | `upstream/develop` | git ref rendered as the "before" baseline |
| `--port-work <n>` | `9180` | dev-server port for the working tree |
| `--port-base <n>` | `9181` | dev-server port for the base worktree |
| `--threshold <f>` | `0.1` | pixelmatch per-pixel threshold (0-1) |
| `--skip-base-install` | off | reuse the base worktree's existing `node_modules` |
| `--clean-base` | off | remove the temp base worktree afterwards (default keeps it for fast reruns) |
| `--push-assets` | off | commit + push the gallery to the `c4-proof-assets` branch |
| `--open` | off | open `index.html` when done |

## How it works

1. `render.ts` (Playwright + the `pnpm dev` server) renders each `corpus/*.mmd` to a PNG, using the
   same determinism settings as the Cypress harness (courier font, fixed seeds, 1440x1024, scale 1).
2. The base ref is rendered from a **persistent** git worktree under the system temp dir
   (`c4-vd-base-<ref>`) so the working tree is never touched and reruns are fast. When the base
   lockfile matches the working tree it symlinks `node_modules` instead of installing.
3. `diff.ts` pixel-diffs base vs work with `pixelmatch` (the engine `cy.matchImageSnapshot` uses),
   white-padding mismatched sizes.
4. `gallery.ts` composes `before|after|diff` sheets (via `composeSheet` from
   `scripts/argos-batch-sheets.ts`) plus a self-contained `index.html` and a `summary.md`.

Output lands in `scripts/c4-visual-diff/out/` (gitignored). Servers are always stopped by tracked
PID in a `finally` block - the harness never uses `pkill`, which would kill every worktree's server.

## Reviewing a feature branch

The harness lives on its own branch. To review a C4 feature branch, run it from that branch's
worktree (merge/cherry-pick this `scripts/c4-visual-diff/` tree in if needed) with
`--base upstream/develop`; the gallery then shows that branch's rendering change against develop.

See `corpus/README.md` for the corpus and how to keep it in sync with the characterization matrix.
