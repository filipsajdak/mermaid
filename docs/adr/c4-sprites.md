# ADR: C4 $sprite / $shape icons via the unified renderer

## Status

Accepted (capability wired; icon packs are the user's responsibility).

## Context

C4 (and Structurizr) let an author attach a visual to an element with `$sprite`
(and, by extension, a non-keyword `$shape`). The unified C4 renderer (PR3 layout
migration) maps a small set of Structurizr-style keywords to dedicated C4 shapes:
`$sprite="browser"` -> `c4-browser`, `cylinder`/`db` -> `c4-database`,
`queue`/`pipe` -> `c4-queue`, `bucket`/`s3` -> `c4-bucket`, `terminal` ->
`c4-terminal`, and so on (see `SHAPE_KEYWORDS` in `c4LayoutData.ts`).

Before this change, a `$sprite` (or `$shape`) that was NOT one of those keywords
simply fell through to the element-type shape, so an arbitrary sprite/icon name
(e.g. `logos:aws-lambda`) was silently ignored.

The unified renderer already ships an icon shape (`iconRounded`, registered as
the `iconRounded` ShapeID) used by flowchart and architecture diagrams. It reads
`node.icon` and resolves the name against icon packs the user registered with
`mermaid.registerIconPacks(...)` (Iconify). `getIconSVG` never throws: if the
referenced pack is not registered it logs and renders a placeholder "unknown"
icon (a blue square with a "?").

## Decision

When a C4 element carries a `$sprite` (or `$shape`) whose value is NOT a
recognised keyword and is non-empty, treat it as an **icon name**:

- set the node's shape to the unified icon shape (`iconRounded`), and
- set `node.icon` to that sprite/shape string.

`$sprite` wins over `$shape` when both carry a non-keyword value, since `$sprite`
is the icon-bearing attribute. A recognised keyword (in either slot) still maps
to its dedicated C4 shape, so all existing behaviour is preserved: keyword
shapes, `$tags`-defined shapes, and the element-type fallback are unchanged. The
resolution is factored in `resolveNodeShape`, which now returns both the shape
and an optional icon name.

We do NOT bundle icon packs. Rendering an icon requires the user to register the
referenced pack themselves, e.g.:

```js
mermaid.registerIconPacks([
  {
    name: 'logos',
    loader: () =>
      fetch('https://unpkg.com/@iconify-json/logos/icons.json').then((res) => res.json()),
  },
]);
```

with a diagram such as:

```
C4Context
System(s, "Lambda", "Serverless compute", $sprite="logos:aws-lambda")
```

Be explicit about the trade-off: WITHOUT a registered pack for the referenced
prefix, the icon will render as the renderer's placeholder "unknown" glyph rather
than the intended icon. The capability is wired; supplying the icon pack is the
user's responsibility (and keeps mermaid from shipping large icon bundles by
default).

## Consequences

- `resolveNodeShape` returns `{ shape, icon? }`; `getData` spreads the icon onto
  the node. Nodes without a non-keyword `$sprite`/`$shape` leave `node.icon`
  undefined and are unaffected.
- A minimal CSS rule (`.c4-shape .icon-shape2`) keeps the icon shape's rounded
  outline in the element identity colour over a light fill, matching the C4
  outline look.
- The icon name is passed through verbatim; pack prefixes (`logos:`, `mdi:`,
  etc.) and pack registration are the user's responsibility, consistent with how
  flowchart and architecture diagrams already consume `registerIconPacks`.
- `$legendSprite` (a per-element legend icon) remains deferred (see
  `buildLegendData`); this ADR only covers the element body icon.
