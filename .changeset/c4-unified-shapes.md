---
'mermaid': patch
---

fix: render C4 elements through the unified shape system. Element labels render as SVG text (no HTML foreignObject), person/database/queue elements use the shared shapes, and element text wraps to fit `c4.width`.
