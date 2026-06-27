---
'mermaid': minor
---

Add the `InfrastructureNode` element to legacy C4 deployment diagrams

Legacy C4 (`C4Deployment`) now accepts `InfrastructureNode(alias, label, ?techn, ?descr, ...)`
as a leaf element inside a `Deployment_Node`, matching the C4-beta keyword. An infrastructure
node (DNS, load balancer, firewall, ...) renders as a plain outline box with an
`[Infrastructure Node: <Tech>]` stereotype, consistent with the unified C4 renderer.
