---
'mermaid': patch
---

fix(c4): honour an element `$link` attribute in the unified renderer

C4 elements declared with a `$link` attribute (e.g. `Person(p, "P", "desc",
$link="https://example.com")`) are now rendered as clickable elements. The link
flows from the legacy C4 db through the unified layout pipeline, which wraps the
node in an `<a xlink:href>`, so the whole element becomes a hyperlink.
