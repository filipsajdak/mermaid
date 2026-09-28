---
'mermaid': patch
---

docs(bpmn): prompt-ready spec, tolerant-input and validation notes, determinism guarantees

Document, on the BPMN syntax page, the tolerant input (case-insensitive keywords and synonyms, resolved only in the keyword position — a keyword word is still usable as an id or flow endpoint), the opt-in validation catalogue reached through `mermaid.parse` with `bpmn.strict` (set globally or in a diagram's frontmatter), and a condensed paste-into-a-system-prompt spec of the grammar whose rules match the implemented behaviour exactly (reachability per connected component over flow nodes; pool crossing only between two pooled nodes). Correct the element-reference page, which previously said keywords could not be ids and that gateway synonyms were rejected. Add determinism tests that pin the true contract: deterministic parse and layout for a given configuration, and byte-identical SVG for the same source and the same diagram id — including a `deterministicIds` path and an auto-id (`mermaid.run`) path.
