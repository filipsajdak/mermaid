import type { LayoutData } from '../../../types.js';

type LayoutNode = NonNullable<LayoutData['nodes']>[number] & { swimlaneContentTop?: number };

/** The room left between two participants, which is where a link between them is drawn. */
export const PARTICIPANT_GAP = 36;

/** Whether a band stands for a participant of its own rather than a division of one. */
const isParticipant = (node: LayoutNode): boolean =>
  Boolean(node.isGroup) &&
  !node.parentId &&
  (node as { metadata?: { laneRole?: string } }).metadata?.laneRole === 'pool';

/**
 * Moves each participant clear of the one before it.
 *
 * Lanes divide a single participant and share their borders, so the bands are laid out
 * as one run. Separate participants are drawn apart, and a message flow between two of
 * them has nowhere to be drawn while they touch. Everything inside a participant moves
 * with it, including the flows between its own nodes.
 *
 * A flow between two participants moves too, point by point, each with the band it is
 * drawn in. Only a flow that ends on a band is left alone here, because that one is
 * redrawn from the borders afterwards; a flow between two nodes is not redrawn by
 * anything, so leaving it behind strands it a gap away from what it points at.
 */
export function separateParticipants(layout: LayoutData, direction?: string): void {
  const nodes = (layout.nodes ?? []) as LayoutNode[];
  const participants = nodes.filter((node) => isParticipant(node));
  if (participants.length < 2) {
    return;
  }

  const childrenOf = new Map<string, LayoutNode[]>();
  for (const node of nodes) {
    if (node.parentId) {
      childrenOf.set(node.parentId, [...(childrenOf.get(node.parentId) ?? []), node]);
    }
  }
  const within = (rootId: string): Set<string> => {
    const held = new Set<string>([rootId]);
    const pending = [rootId];
    while (pending.length > 0) {
      for (const child of childrenOf.get(pending.pop()!) ?? []) {
        if (!held.has(child.id)) {
          held.add(child.id);
          pending.push(child.id);
        }
      }
    }
    return held;
  };

  // Laid out across the page a participant is a band with the next one below it; laid out
  // downwards the bands are columns and the next one stands to its right.
  const axis: 'x' | 'y' = direction === 'LR' || direction === 'RL' ? 'y' : 'x';
  const extentOf = (node: LayoutNode) => (axis === 'y' ? (node.height ?? 0) : (node.width ?? 0));
  const startOf = (node: LayoutNode) => (node[axis] ?? 0) - extentOf(node) / 2;

  const inOrder = [...participants].sort((a, b) => startOf(a) - startOf(b));

  // Read before anything moves: what each participant is about to move by, and the run
  // it occupies now. A flow is translated against these, so they have to be the geometry
  // it was routed against rather than what the moves below leave behind.
  const shiftOfNode = new Map<string, number>();
  const runs: { from: number; shift: number }[] = [];
  for (const [index, participant] of inOrder.entries()) {
    const shift = index * PARTICIPANT_GAP;
    for (const id of within(participant.id)) {
      shiftOfNode.set(id, shift);
    }
    runs.push({ from: startOf(participant), shift });
  }

  /**
   * What a point at this coordinate moves by.
   *
   * The runs tile the axis and are read in order, so a point takes the shift of the last
   * run beginning at or before it. That keeps the mapping monotone, which is what stops a
   * crossing segment from turning back on itself.
   */
  const shiftAt = (coord: number): number => {
    let shift = runs[0].shift;
    for (const run of runs) {
      if (coord >= run.from) {
        shift = run.shift;
      }
    }
    return shift;
  };

  for (const [index, participant] of inOrder.entries()) {
    const shift = index * PARTICIPANT_GAP;
    if (shift === 0) {
      continue;
    }
    const held = within(participant.id);
    for (const node of nodes) {
      if (!held.has(node.id) || typeof node[axis] !== 'number') {
        continue;
      }
      node[axis] += shift;
      if (axis === 'y') {
        if (typeof node.swimlaneContentTop === 'number') {
          node.swimlaneContentTop += shift;
        }
        if (node.groupTitleRect) {
          node.groupTitleRect.top += shift;
          node.groupTitleRect.bottom += shift;
        }
      } else if (node.groupTitleRect) {
        node.groupTitleRect.left += shift;
        node.groupTitleRect.right += shift;
      }
    }
  }

  for (const edge of layout.edges ?? []) {
    const start = typeof edge.start === 'string' ? edge.start : undefined;
    const end = typeof edge.end === 'string' ? edge.end : undefined;
    const points = (edge as { points?: { x: number; y: number }[] }).points;
    if (!start || !end || !points) {
      continue;
    }
    const from = shiftOfNode.get(start);
    const to = shiftOfNode.get(end);
    // An end outside every participant did not move, so moving the line to meet it would
    // strand the other end instead. A link onto a band is in the same position: it is
    // redrawn from the borders once these moves have settled.
    if (from === undefined || to === undefined) {
      continue;
    }
    if (from === to) {
      for (const point of points) {
        point[axis] += from;
      }
      continue;
    }
    // A flow between two participants. Each point moves with the band it is drawn in,
    // which lengthens the segment crossing between them rather than tilting it: the
    // bands are separated along one axis and that segment runs along the same one.
    for (const point of points) {
      point[axis] += shiftAt(point[axis]);
    }
  }
}
