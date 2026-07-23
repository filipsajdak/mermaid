---
'mermaid': minor
---

feat(c4): render C4 elements in the c4model.com outline style (a light fill with the element's identity colour as the border and text). The identity colour comes from the existing per-element `<type>_bg_color` palette; `UpdateElementStyle` overrides still apply. This is the visual redesign split out of the C4 shape migration.
