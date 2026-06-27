# ADR: C4 auto-generated legend (key)

## Status

Accepted (implementation: opt-in).

## Context

Simon Brown's C4 RFC (mermaid-js #7844) MANDATES that a C4 diagram carries a
key/legend so a reader who does not know the C4 notation can still decode the
shapes and colors. The unified C4 renderer (PR3 layout migration) draws each
element as an outline shape whose border/text color is its palette identity and
whose shape encodes its kind (person, database, queue, box). Without a legend
those conventions are implicit.

We therefore generate the legend automatically from the diagram content: one row
per DISTINCT element kind actually used (person, software system, container,
component, database, queue, external and deployment node, as applicable), each
with its Structurizr display label and the same outline color the elements use.
Authors never hand-maintain it.

The open question is the DEFAULT: should the legend render automatically, or
only when the author asks for it?

## Decision

The legend is **opt-in**, enabled per diagram with the `SHOW_LEGEND()`
statement. It is **OFF by default**.

Rationale:

- **Legacy back-compat.** The legacy C4 syntax has shipped for years without a
  legend. Turning it on by default would change the rendered output (size and
  layout) of every existing legacy C4 diagram in the wild, which is a surprising,
  non-opt-in visual regression for current users.
- **RFC #7844 is satisfied** in capability: the key the RFC mandates is
  available and is auto-generated; we expose it through an explicit statement
  rather than forcing it on. New diagrams add one line (`SHOW_LEGEND()`) to get
  the mandated key.
- **On-by-default is a follow-up maintainer decision.** Whether the legend
  should eventually default to ON (for legacy, for the c4-beta syntax, or both)
  is intentionally deferred to the maintainers. It is a separate, larger policy
  change that can ride on a major version or land first in the new c4-beta
  syntax (which has no back-compat constraint) before being reconsidered for
  legacy. This ADR only commits to the opt-in default for the legacy syntax.

## Consequences

- `SHOW_LEGEND()` sets `showLegend` in the C4 db; the renderer appends a
  `<g class="c4-legend">` (via the shared `c4Legend.ts` `insertLegend`) before
  the viewBox is computed, so the legend is captured inside it.
- The legend derivation (`buildLegendData`) and the renderer
  (`insertLegend`) are split so the planned c4-beta syntax can reuse the same
  legend module later.
- If the maintainers later choose on-by-default, only the default of
  `showLegend` (and/or a config flag) changes; the derivation and rendering are
  already in place.
