---
'mermaid': minor
---

feat(c4): add an opt-in auto-generated legend to C4 diagrams via `SHOW_LEGEND()`

C4 diagrams can now render a key/legend (RFC #7844). Add `SHOW_LEGEND()` to a
diagram to show one row per distinct element kind in use (person, software
system, container, component, database, queue, external and deployment node),
each with its Structurizr label and palette outline color. The legend is
opt-in (off by default) for back-compatibility with existing C4 diagrams.
