---
'mermaid': major
---

feat(c4)!: source C4 element colours from theme variables

BREAKING CHANGE: the per-element `config.c4.*_bg_color` / `*_border_color`
configuration keys are removed. C4 element colours now come from theme
variables (`c4PersonBkg`, `c4SystemBkg`, `c4ContainerBkg`, `c4ComponentBkg`,
`c4ExternalBkg`, `c4InfrastructureBkg`, `c4BoundaryBorder`), defined in every
theme so C4 adapts to default/dark/forest/neutral like other diagram types.
Recolour C4 by overriding these via `themeVariables`; see the migration table
in the C4 documentation. Per-element overrides via `UpdateElementStyle` /
`AddElementTag` are unchanged.
