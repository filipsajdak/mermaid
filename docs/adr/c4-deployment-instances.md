# ADR: C4 deployment instances (SoftwareSystemInstance / ContainerInstance)

## Status

Accepted (pragmatic approximation; a richer deployment model is deferred).

## Context

Structurizr's deployment view has two element types that only appear inside a
deployment node: `SoftwareSystemInstance` and `ContainerInstance`. Each is a
*reference* to an already-defined software system / container, placed inside a
`Deployment_Node` to show "this is where (and how many copies of) that element
run". In the Structurizr model an instance is a distinct entity that points back
at its definition and can carry a deployment instance count and health checks.

The legacy mermaid C4 db (`c4Db.ts`) is intentionally flat: every element is an
entry in a single `c4ShapeArray`, keyed by `alias`, with a `typeC4Shape` string
and a `parentBoundary`. There is no notion of "a reference to another element":
`addPersonOrSystem` / `addContainer` create (or look up by alias and mutate) a
box. Faithfully modelling the reference-vs-definition split would mean teaching
the db, the layout adapter and the unified renderer a new entity kind, which is
out of scope for the Wave-D deployment slice.

## Decision

Approximate a deployment instance as a normal element box rather than a true
reference:

- **Grammar** (`parser/c4Diagram.jison`): add lexer tokens
  `"SoftwareSystemInstance"` (-> `SYSTEM_INSTANCE`) and `"ContainerInstance"`
  (-> `CONTAINER_INSTANCE`), each with its own `%x` start state
  (`system_instance` / `container_instance`). Those states are added to the
  `EOF_IN_STRUCT` rule and to the three attribute-open/close rules so the
  existing `(...)` attribute lexer works inside them. `ContainerInstance` is
  listed before `Container` (and `SoftwareSystemInstance` near `System`) for
  clarity; longest-match would pick the instance keyword regardless. Two new
  `diagramStatement` rules reuse the existing add functions:
  `SYSTEM_INSTANCE` -> `yy.addPersonOrSystem('system_instance', ...)` and
  `CONTAINER_INSTANCE` -> `yy.addContainer('container_instance', ...)`.

- **Db** (`c4Db.ts`): no new code. `addPersonOrSystem` / `addContainer` already
  accept any `typeC4Shape` string and store it verbatim, and a named
  `$instances` attribute is stored by the existing generic attribute handling
  (as `{ text }` when it lands in the descr/techn slot, or as a raw string via
  `assignAttributes` otherwise).

- **Layout adapter** (`c4LayoutData.ts`):
  - `STEREOTYPE_NAMES` maps `system_instance` -> `Software System Instance` and
    `container_instance` -> `Container Instance`.
  - The render shape falls through to `rounded` (the default for any
    non-person/db/queue type), so instances are plain boxes.
  - Instances have no palette entry of their own, so `paletteKey` maps
    `system_instance` -> `system` and `container_instance` -> `container`: an
    instance borrows its defining element's outline (identity) colour.
  - `buildNodeLabel` appends a small `(xN)` annotation when an `$instances`
    count is present (tolerating both the `{ text }` and raw-string storage
    forms).

## Consequences

- An instance is drawn as a *new* box, not a reference to a previously declared
  element. If an author declares both a `System(...)` and a
  `SoftwareSystemInstance(...)` for "the same" thing, they appear as two boxes;
  there is no automatic link or deduplication.
- The instance count is a display-only annotation; it does not affect layout,
  fan-out, or relationships.
- The keyword surface and stereotypes match Structurizr, so a future richer
  deployment model (true references, replicated instances, health checks) can
  replace this approximation without changing the author-facing syntax.
