---
'mermaid': minor
---

feat(bpmn): refuse an element left out of its flow. In a flow with a start event every element must be reached from one, and in a flow with an end event every element must reach one; a flow with neither, such as a fragment, is not checked. A boundary event starts a path of its own, and a pair of link events carries one across.
