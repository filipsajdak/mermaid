---
'mermaid': minor
---

feat(c4): render legacy C4 syntax through the unified layout pipeline

Legacy C4 syntax (`C4Context` / `C4Container` / `C4Component` / `C4Dynamic` /
`C4Deployment` and the `*_Ext` variants) now lays out through the same unified
dagre pipeline as the rest of mermaid: graph-based positioning, alternative
layout engines via `registerLayoutLoaders` (e.g. ELK), and the shared C4 outline
visual style. The legacy row-based renderer and its helpers (`c4Renderer.ts`,
`svgDraw.ts`, `c4ShapeAdapter.ts`) are removed.
