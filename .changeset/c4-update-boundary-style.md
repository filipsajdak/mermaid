---
'mermaid': minor
---

feat(c4): support UpdateBoundaryStyle

C4 diagrams can now restyle a boundary with
`UpdateBoundaryStyle(alias, $bgColor=..., $fontColor=..., $borderColor=...)`,
mirroring `UpdateElementStyle` for boundaries. The colors are stored on the
boundary in the C4 db and applied to the boundary node through the unified
layout pipeline (fill / stroke / text).
