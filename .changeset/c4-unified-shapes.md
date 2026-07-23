---
'mermaid': patch
---

fix: render C4 elements through the unified shape system. Element labels render as SVG text (no HTML foreignObject) and person/database/queue elements use the shared shapes. Existing element colours (`<type>_bg_color`/`<type>_border_color`, `UpdateElementStyle`) and per-element font config are preserved; label wrapping is opt-in via the root `wrap` config.
