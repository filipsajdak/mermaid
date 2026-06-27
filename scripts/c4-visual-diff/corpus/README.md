# C4 visual-diff corpus

One `.mmd` per C4 feature, used by `pnpm c4:visual-diff` to render a before/after gallery.

The `CHAR.*` tiles mirror the characterization feature matrix
(`packages/mermaid/src/diagrams/c4/c4-feature-matrix.md` +
`cypress/integration/rendering/c4/c4-characterization.spec.js`, PR #7876) so every C4 feature
that the renderer must preserve gets its own visual tile. `internet-banking-context.mmd` is the
canonical c4model.com System Context example as a realistic end-to-end check.

An optional sidecar `<tile>.json` next to a `.mmd` overrides the per-tile mermaid config
(merged over the determinism defaults), e.g. `{ "theme": "dark" }` or `{ "layout": "elk" }`.

**Maintenance:** when a new `CHAR.*` case is added to the characterization spec, add a matching
`.mmd` here so the feature keeps a visual tile. This duplication is intentional - the corpus is
the reference for the visual-diff harness; the spec is the reference for the Cypress run.
