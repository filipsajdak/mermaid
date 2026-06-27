---
'mermaid': minor
---

C4Dynamic: honour the explicit step number given to `RelIndex(N, from, to, ...)`.

A relationship declared as `RelIndex(3, a, b, "Calls")` now renders with the label
`3: Calls`, using the author-supplied number. Plain `Rel(...)` relationships in a
`C4Dynamic` diagram keep their automatic 1-based numbering; the auto counter only
advances for un-indexed relationships, so explicit numbers do not consume a slot.

Behavior change: previously the `RelIndex` number was silently dropped (the first
attribute was spliced away) and every dynamic relationship was auto-numbered. The
explicit number is now displayed.
