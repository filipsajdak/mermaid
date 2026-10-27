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

const FLOW_NODE_KINDS = new Set<ParsedNode['kind']>(['event', 'gateway', 'activity']);

const isEvent = (node: ParsedNode, keyword: string, qualifier?: string): boolean =>
  node.kind === 'event' && node.keyword === keyword && (!qualifier || node.qualifier === qualifier);

/** A boundary event is set off by its host, and a link event picks up where its pair left off. */
const beginsAPath = (node: ParsedNode): boolean =>
  isEvent(node, 'start') || isEvent(node, 'boundary') || isEvent(node, 'intermediate', 'link');

/** A link event hands its path on to its pair. */
const closesAPath = (node: ParsedNode): boolean =>
  isEvent(node, 'end') || isEvent(node, 'throw', 'link');

const named = (node: ParsedNode): string =>
  `the ${node.keyword}${node.kind === 'event' ? ' event' : ''} "${node.id}"`;

/** Every node a walk along `next` reaches from `from`, `from` included. */
const reachedFrom = (from: string[], next: Map<string, string[]>): Set<string> => {
  const reached = new Set(from);
  const pending = [...from];
  for (let id = pending.pop(); id !== undefined; id = pending.pop()) {
    for (const neighbour of next.get(id) ?? []) {
      if (!reached.has(neighbour)) {
        reached.add(neighbour);
        pending.push(neighbour);
      }
    }
  }
  return reached;
};

/**
 * In a flow that has a start event, every element is reached from one, and in a flow that has
 * an end event, every element reaches one. A flow is the elements one chain of sequence flows
 * joins, so two flows in one lane are checked apart, and a flow written with neither a start
 * nor an end event, such as a fragment, is not checked.
 */
function* reachabilityViolations(nodes: ParsedNode[], flows: ParsedFlow[]): Generator<Violation> {
  const flowNodes = nodes.filter((node) => FLOW_NODE_KINDS.has(node.kind));
  const ids = new Set(flowNodes.map((node) => node.id));
  const forward = new Map<string, string[]>();
  const backward = new Map<string, string[]>();
  const joined = new Map<string, string[]>();
  const link = (graph: Map<string, string[]>, from: string, to: string) => {
    graph.set(from, [...(graph.get(from) ?? []), to]);
  };
  for (const { kind, from, to } of flows) {
    if (kind === 'sequence' && ids.has(from) && ids.has(to)) {
      link(forward, from, to);
      link(backward, to, from);
      link(joined, from, to);
      link(joined, to, from);
    }
  }

  const flowOf = new Map<string, Set<string>>();
  for (const { id } of flowNodes) {
    if (!flowOf.has(id)) {
      const members = reachedFrom([id], joined);
      members.forEach((member) => flowOf.set(member, members));
    }
  }
  const firstIn = (members: Set<string> | undefined, keyword: string) =>
    flowNodes.find((node) => isEvent(node, keyword) && members?.has(node.id));

  const fromAStart = reachedFrom(
    flowNodes.filter(beginsAPath).map((node) => node.id),
    forward
  );
  const toAnEnd = reachedFrom(
    flowNodes.filter(closesAPath).map((node) => node.id),
    backward
  );
  for (const node of flowNodes) {
    const start = firstIn(flowOf.get(node.id), 'start');
    if (start && !fromAStart.has(node.id)) {
      yield {
        at: node,
        message: `no start event reaches ${named(node)}, though "${start.id}" starts its flow. Connect it, for example "${start.id} --> ${node.id}".`,
      };
    }
    const end = firstIn(flowOf.get(node.id), 'end');
    if (end && !toAnEnd.has(node.id)) {
      yield {
        at: node,
        message: `${named(node)} reaches no end event, though "${end.id}" ends its flow. Connect it, for example "${node.id} --> ${end.id}".`,
      };
    }
  }
}

/**
 * Every rule of the notation the diagram breaks, in the order the parser refuses them: each
 * flow in the order it was written, then each element. A wrong flow is often why an element
 * is left unreached, so it is named first. The parser stops at the first.
 */
export function* violationsOf({ nodes, flows }: ParsedDiagram): Generator<Violation> {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  for (const flow of flows) {
    yield* flowViolations(flow, byId);
  }
  yield* reachabilityViolations(nodes, flows);
}
