# ADR: C4 Level 4 (Code) - minimal `C4Code` prototype

## Status

Proposed (deliberately minimal prototype; candidate to drop). This is the most
de-prioritised C4 view and overlaps mermaid's existing class diagram - see
"Consequences" for why a maintainer may reasonably decline to merge it.

## Context

The C4 model has four levels: Context (1), Container (2), Component (3) and
Code (4). Level 4 zooms into a single component and shows how it is implemented
in code - typically as a UML-style class diagram (classes, interfaces, their
attributes/methods and relationships).

Simon Brown (C4's author) explicitly de-prioritises Level 4: he recommends most
teams *skip* it, says it is rarely worth the maintenance cost, and notes it
largely duplicates a UML class diagram that can be generated from the IDE on
demand. mermaid already ships a dedicated `classDiagram` that covers the
class/attribute/method/visibility use case far better than the C4 pipeline could.

So a full Level-4 implementation (method/attribute compartments, visibility
markers, generics, etc.) would (a) duplicate `classDiagram` and (b) invest heavily
in the least-used C4 view. The Wave-D goal here is instead a *small, honest*
prototype that completes the C4 level set and reuses the existing unified C4
pipeline, so a maintainer can accept it cheaply or drop it without regret.

## Decision

Add a `C4Code` diagram type and a single `Code(...)` element, wired exactly like
the existing `Component` element so it inherits the whole unified C4 stack
(boundaries, relationships, outline styling, legend, sprites/tags/links).

- **Grammar** (`parser/c4Diagram.jison`):
  - New header token `"C4Code"` -> `C4_CODE`, plus a `graphConfig` production
    `C4_CODE NEWLINE statements EOF { yy.setC4Type($1) }` mirroring `C4Context`.
  - New element token `"Code"` -> `CODE` with its own `%x code` start state, added
    to the `EOF_IN_STRUCT` rule and the three attribute open/close rules so the
    shared `(...)` attribute lexer works inside it.
  - One `diagramStatement` rule: `CODE attributes -> yy.addContainer('code', ...)`.
    `addContainer` (not `addComponent`, though either works - identical signature)
    gives the element `techn` / `descr` / `sprite` / `tags` / `link` for free.
  - Because `C4Code` accepts the same `statements` set as every other C4 header,
    a Code diagram can also use `Rel`, boundaries, and any other element keyword.

- **Detector** (`c4Detector.ts`): add `C4Code` to the detection regex.

- **Db** (`c4Db.ts`): no new code. `addContainer` stores any `typeC4Shape`
  string verbatim (`'code'`).

- **Layout adapter** (`c4LayoutData.ts`):
  - `STEREOTYPE_NAMES['code'] = 'Code'`, so the element reads `[Code: <Type>]`
    where `<Type>` is the author-supplied kind (class / interface / function),
    carried in the `techn` slot.
  - `resolveNodeShape` returns `fr-rect` (a *framed* rectangle) for `code`. This
    is the one visual departure from `Component` (which is a plain `rounded`
    box): the frame reads as a "code box" / class-frame without implying the full
    UML compartments. An explicit `$shape` / `$sprite` / tag still overrides it.
  - `code` gets its own palette identity colour via new config keys
    `code_bg_color` (`#B0D4F5`) and `code_border_color` (`#9DC3E6`) - the
    lightest step of the C4 blue ramp (person -> system -> container ->
    component -> code). Without a palette key it would fall back to the neutral
    grey `DEFAULT_IDENTITY`; a dedicated colour keeps the level visually distinct.
  - `LEGEND_ORDER` places the `Code` legend row directly after `Component`.

- **Tests** (`c4LayoutData.spec.ts`): a `C4Code` diagram parses and sets the
  type; a `Code(...)` element yields a node with the `Code` stereotype and the
  `fr-rect` shape; a `Rel` between two Code elements yields an edge; Code
  elements get their palette outline colour and a legend row.

## Sample

```mermaid
C4Code
title Code diagram for the Order component

Code(controller, "OrderController", "class", "Accepts HTTP order requests")
Code(service, "OrderService", "class", "Coordinates order placement")
Code(repo, "OrderRepository", "interface", "Persistence boundary")
Code(jpaRepo, "JpaOrderRepository", "class", "JPA implementation")

Rel(controller, service, "Calls")
Rel(service, repo, "Loads and saves orders")
Rel(jpaRepo, repo, "Implements")
```

## Consequences

- **Overlaps `classDiagram`.** For real class-level modelling (attributes,
  methods, visibility, generics, inheritance arrows) `classDiagram` is the right
  tool. `C4Code` intentionally offers only labelled boxes + relationships.
- **Deliberately minimal / candidate to drop.** Given Simon Brown's own
  de-prioritisation of Level 4, a maintainer may reasonably decline this. It is
  scoped so that dropping it removes one diagram type and one element keyword with
  no impact on the other C4 levels.
- **No new entity semantics.** A `Code` element is just another `c4ShapeArray`
  box; there is no link back to the `Component` it implements, and no
  containment rule enforcing "Code lives inside one Component".

### What a fuller implementation would add

- Method / attribute / visibility compartments (i.e. real class boxes), almost
  certainly by *reusing* `classDiagram`'s rendering rather than re-implementing it.
- Distinct element kinds (class vs interface vs enum vs function) with their own
  shapes/stereotype glyphs instead of a free-text `Type`.
- Inheritance / implementation / composition arrow styles (open triangle,
  diamond) rather than the single C4 relationship arrow.
- A containment rule tying a `C4Code` view to the parent `Component`, mirroring
  how Structurizr scopes a code view to one component.
