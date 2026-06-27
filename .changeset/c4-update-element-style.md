---
'mermaid': minor
---

feat(c4): honour UpdateElementStyle `$shadowing` and `$legendText`

`UpdateElementStyle` now supports two more Structurizr attributes through the
unified C4 pipeline:

- `$shadowing="true"` adds a `c4-shadow` class so the element renders with a
  subtle drop shadow (the literal `"false"` is treated as off).
- `$legendText="..."` contributes a custom row to the auto-generated legend
  (`SHOW_LEGEND()`) using that text and the element's identity color, in
  addition to the per-kind rows. Repeated texts are de-duplicated.

`$legendSprite` (a per-element legend icon) is deferred until the C4 renderer
gains icon-pack support.
