---
'mermaid': minor
---

feat(bpmn): refuse a flow the notation does not allow: a sequence flow into a start event, out of an end event or from one pool to another, and a message flow inside one pool. Each is refused at the flow's line and column, and the message names the fix.
