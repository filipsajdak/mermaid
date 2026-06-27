# ADR: External is a rendering convention (tag), not a C4 abstraction

- Status: Accepted
- Date: 2026-06-27
- Context: C4 contribution to the mermaid-js fork (Wave-B slice B2)

## Context

The legacy mermaid C4 grammar exposes a large family of `*_Ext` keywords
(`Person_Ext`, `System_Ext`, `SystemDb_Ext`, `Container_Ext`, `Component_Ext`,
and the queue/db variants). Historically each `*_Ext` keyword was treated as a
distinct element kind with its own palette key (`external_*_bg_color`) and its
own legacy-renderer code path.

The C4 model itself (RFC #7844, with Simon Brown's guidance) is explicit that
"external" is **not** a separate abstraction. The core C4 abstractions are
Person, Software System, Container and Component. Whether an element is internal
or external is a property of the *view* - a convention used to shade elements
that are outside the scope of the thing being described. In Structurizr this is
expressed as a tag (`External`), and the rendering applies a muted grey style.

## Decision

In the unified rendering pipeline, "external" is treated as a **rendering
convention**, not a C4 abstraction:

- The `_Ext` suffix (and, equivalently, an `external` tag) maps an element to the
  `c4-external` CSS class. `getData()` already attaches `c4-external` to any
  element whose resolved type starts with `external_`.
- `styles.js` carries an explicit `.c4-external` rule that renders external
  elements in the conventional C4 grey (white fill, grey border, grey text). This
  is the fallback identity; a configured `external_*_bg_color` palette key
  (applied inline by `getData()`) or an explicit `UpdateElementStyle` still
  overrides it.
- We do **not** introduce a separate C4 abstraction, node type, or shape for
  "external". An external system is still a Software System; it is only shaded
  differently.

This composes cleanly with the new `AddElementTag` support: `external` is simply
the canonical, built-in tag whose styling lives in CSS instead of in a
user-defined `AddElementTag`.

## Consequences

- The shape of an external element is resolved exactly like its internal
  counterpart (`resolveNodeShape` strips the `external_` prefix conceptually via
  the type fallbacks), keeping db/queue/person shapes consistent across the
  internal/external boundary.
- External styling no longer depends on a palette key being present; the grey
  convention always applies as a baseline.
- Future work can expose an explicit `external` tag in the grammar without a new
  abstraction, since the class-based mechanism already exists.

## References

- RFC #7844 (mermaid C4 redesign; external = tag, not keyword/shape).
- https://c4model.com/ (external elements shaded grey, outside scope).
