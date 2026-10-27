import type { ParsedDiagram, ParsedFlow, ParsedNode } from './bpmn.parser.js';

/** A rule the notation sets that the diagram breaks, and the node or flow that breaks it. */
export interface Violation {
  at: ParsedNode | ParsedFlow;
  message: string;
}

const written = (flow: ParsedFlow): string =>
  `${flow.from} ${flow.kind === 'message' ? '-.->' : '-->'} ${flow.to}`;

/** The pool a node belongs to, a pool being its own; a node in no pool has none. */
const poolOf = (node: ParsedNode, byId: Map<string, ParsedNode>): ParsedNode | undefined => {
  for (let cursor: ParsedNode | undefined = node; cursor; ) {
    if (cursor.kind === 'pool') {
      return cursor;
    }
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return undefined;
};

function* flowViolations(flow: ParsedFlow, byId: Map<string, ParsedNode>): Generator<Violation> {
  const from = byId.get(flow.from);
  const to = byId.get(flow.to);
  if (!from || !to || flow.kind === 'association') {
    return;
  }
  if (flow.kind === 'sequence' && to.kind === 'event' && to.keyword === 'start') {
    yield {
      at: flow,
      message: `the flow "${written(flow)}" enters the start event "${to.id}", but nothing flows into a start event. Make "${to.id}" an intermediate event, or end the flow elsewhere.`,
    };
  }
  if (flow.kind === 'sequence' && from.kind === 'event' && from.keyword === 'end') {
    yield {
      at: flow,
      message: `the flow "${written(flow)}" leaves the end event "${from.id}", but nothing flows out of an end event. Make "${from.id}" a throw event, or start the flow elsewhere.`,
    };
  }
  // A node in no pool, such as one in a lane written at the top level, belongs to no
  // participant, so there is no boundary for the flow to cross or to keep to.
  const fromPool = poolOf(from, byId);
  const toPool = poolOf(to, byId);
  if (!fromPool || !toPool) {
    return;
  }
  if (flow.kind === 'sequence' && fromPool !== toPool) {
    yield {
      at: flow,
      message: `the sequence flow "${written(flow)}" crosses from the pool "${fromPool.label}" to the pool "${toPool.label}". A sequence flow stays inside one pool; draw a message flow, "${flow.from} -.-> ${flow.to}".`,
    };
  }
  if (flow.kind === 'message' && fromPool === toPool) {
    yield {
      at: flow,
      message: `the message flow "${written(flow)}" stays inside the pool "${fromPool.label}". A message flow runs between pools; draw a sequence flow, "${flow.from} --> ${flow.to}".`,
    };
  }
}

/**
 * Every rule of the notation the diagram breaks, in the order the parser refuses them: each
 * flow in the order it was written. The parser stops at the first.
 */
export function* violationsOf({ nodes, flows }: ParsedDiagram): Generator<Violation> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const flow of flows) {
    yield* flowViolations(flow, byId);
  }
}
