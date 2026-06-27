---
'mermaid': minor
---

feat(c4): support AddElementTag / AddRelTag styling and external-as-tag

C4 diagrams can now define named styles with `AddElementTag(name, $bgColor=...,
$fontColor=..., $borderColor=..., $shape=...)` and `AddRelTag(name,
$textColor=..., $lineColor=...)`. Elements and relationships that reference a tag
via their `$tags` attribute pick up the tag's colors (and an element tag's shape
keyword) through the unified layout pipeline. Tag styles sit between the C4
palette outline and an explicit `UpdateElementStyle` / `UpdateRelStyle`, so an
explicit per-element style still wins.

External elements (the `*_Ext` keywords) now render in the conventional C4 grey
(white fill, grey border and grey text) via an explicit `.c4-external` style,
even when no `external_*_bg_color` palette key is configured. External remains a
rendering convention (a CSS class), not a separate C4 abstraction.
