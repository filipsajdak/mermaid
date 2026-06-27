---
'mermaid': minor
---

feat(c4): render a non-keyword `$sprite`/`$shape` as an icon

A C4 element whose `$sprite` (or `$shape`) is not a recognised shape keyword is
now treated as an icon name and rendered with the unified renderer's icon shape
(e.g. `System(s, "S", "Desc", $sprite="logos:aws-lambda")`). Recognised keyword
shapes (browser, cylinder, queue, bucket, terminal, ...) are unchanged. Icon
names resolve against icon packs you register via `mermaid.registerIconPacks(...)`;
mermaid does not bundle icon packs, so a referenced-but-unregistered pack renders
the placeholder "unknown" icon.
