---
'mermaid': minor
---

feat(c4): add SoftwareSystemInstance and ContainerInstance to deployment diagrams

C4Deployment diagrams now accept the Structurizr deployment-instance keywords
`SoftwareSystemInstance` and `ContainerInstance` inside a `Deployment_Node`.
Each is rendered as a plain (rounded) element box carrying its label and a
Structurizr stereotype (`[Software System Instance]` / `[Container Instance]`),
and borrows its defining element's identity colour. An optional `$instances`
attribute (e.g. `ContainerInstance(api, "API", $instances="3")`) is surfaced as
a small `(xN)` annotation on the box.

This is a pragmatic approximation: the flat C4 db has no reference-vs-definition
distinction, so an instance is drawn as a new box rather than a true reference to
a previously defined element (see docs/adr/c4-deployment-instances.md).
