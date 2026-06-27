---
'mermaid': minor
'@mermaid-js/parser': minor
---

feat(c4-beta): converge the c4-beta diagram on the C4 OUTLINE visual language and round it out with config, grammar and legend support:

- Render elements in the outline style: a white/background fill with an identity-coloured border and matching label text (for example a dark-blue Person border, a grey external system), driven by the `c4*Bkg` theme variables (`c4PersonBkg`, `c4SystemBkg`, `c4ContainerBkg`, `c4ComponentBkg`, `c4ExternalBkg`, `c4BoundaryBorder`) across all themes, instead of solid fills. Dark themes get adjusted, readable values; tag style overrides still win over the theme defaults.
- Add an auto-generated legend below the diagram listing the element kinds and style tags in use, with outline swatches that match the rendered elements. The legend is enabled by default and can be disabled with the `legend off` statement.
- Add a `c4beta` config section with `useMaxWidth` (default `true`) and `diagramPadding` (default `10`), overridable via frontmatter config.
- Allow element kind keywords (`person`, `softwareSystem`, `container`, `component`, `group`, `deploymentNode`, `infrastructureNode`) to be used as element ids and relationship endpoints, and add the `infrastructureNode` element kind for deployment diagrams.

The legacy C4 syntax is unaffected.
