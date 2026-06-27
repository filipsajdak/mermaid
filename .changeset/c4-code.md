---
'mermaid': minor
---

Add a minimal `C4Code` (Level 4 - Code) diagram type to legacy C4

Legacy C4 now accepts a `C4Code` diagram header and a single `Code(alias, "Name", "Type", ?descr, ...)`
element, where `Type` is the code-element kind (e.g. `class`, `interface`, `function`) shown as the
`[Code: <Type>]` stereotype. Code elements render as framed rectangles, reuse the existing unified C4
pipeline (relationships, boundaries, outline styling, legend) and carry their own `code_bg_color` /
`code_border_color` palette entry (the lightest step of the C4 blue ramp). This is a deliberately
minimal Level 4 prototype: boxes and relationships only, with no method/attribute compartments (that
overlaps the existing class diagram). See `docs/adr/c4-code-level.md`.
