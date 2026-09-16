import {
  dedupeConsecutivePoints,
  orthogonalizePolyline,
  pointInsideRect,
  rectFromCenterSize,
  rectOfNodeBounds,
  samePoint,
  sameX,
  sameY,
  simplifyPolyline,
} from './geometry.js';
import type { Point, RectBounds } from './geometry.js';

const EPS = 1e-3;
const INSIDE_EPS = 0.5;
const CORNER_CLEARANCE = 4;

type NodeRect = RectBounds;

type BorderSide = 'top' | 'bottom' | 'left' | 'right';

interface EndpointEdge {
  isLayoutOnly?: boolean;
  points?: Point[];
  start?: string;
  end?: string;
}

/**
 * The border a line should stop on, which is the one that is drawn.
 *
 * A shape reserving room for a caption it does not fill - a gateway, an event - is wider
 * and taller than the diamond or ring a reader sees, and stopping on the reserved border
 * leaves the arrow short of the shape by however long the label happened to be. A line
 * already stopping outside the drawn border is left alone: this moves an endpoint in to
 * meet the shape, never out to the box.
 */
function endpointRectOf(node: any): RectBounds | undefined {
  const drawn = node?.metadata?.drawnExtent;
  if (
    drawn &&
    typeof drawn.width === 'number' &&
    typeof drawn.height === 'number' &&
    Number.isFinite(drawn.width) &&
    Number.isFinite(drawn.height) &&
    typeof node.x === 'number' &&
    typeof node.y === 'number'
  ) {
    return rectFromCenterSize(node.x, node.y, drawn.width, drawn.height);
  }
  return rectOfNodeBounds(node);
}

function endpointContextFor(edge: unknown, nodeByIdMap: Map<string, any>, minPoints: number) {
  const candidate = edge as EndpointEdge;
  if (candidate.isLayoutOnly || !candidate.points || candidate.points.length < minPoints) {
    return undefined;
  }
  const src = candidate.start ? nodeByIdMap.get(candidate.start) : undefined;
  const dst = candidate.end ? nodeByIdMap.get(candidate.end) : undefined;
  return {
    edge: candidate,
    points: candidate.points,
    srcRect: src ? endpointRectOf(src) : undefined,
    dstRect: dst ? endpointRectOf(dst) : undefined,
  };
}

// Given an axis-aligned segment from outside a rect to inside it, return the
// point where the segment enters the rect boundary.
function segmentEnterPoint(outside: Point, inside: Point, r: NodeRect): Point {
  if (sameY(outside, inside, EPS)) {
    const x = outside.x < r.left ? r.left : r.right;
    return { x, y: outside.y };
  }
  if (sameX(outside, inside, EPS)) {
    const y = outside.y < r.top ? r.top : r.bottom;
    return { x: outside.x, y };
  }
  return {
    x: Math.min(r.right, Math.max(r.left, outside.x)),
    y: Math.min(r.bottom, Math.max(r.top, outside.y)),
  };
}

function clipEndpoint(points: Point[], rect: NodeRect, atStart: boolean): Point[] {
  const step = atStart ? 1 : -1;
  let outsideIndex = atStart ? 0 : points.length - 1;
  while (
    outsideIndex >= 0 &&
    outsideIndex < points.length &&
    pointInsideRect(points[outsideIndex], rect, INSIDE_EPS)
  ) {
    outsideIndex += step;
  }
  if (outsideIndex < 0 || outsideIndex >= points.length) {
    return points;
  }

  const insideIndex = outsideIndex - step;
  if (insideIndex < 0 || insideIndex >= points.length) {
    return points;
  }

  const entry = segmentEnterPoint(points[outsideIndex], points[insideIndex], rect);
  return atStart
    ? [entry, ...points.slice(outsideIndex)]
    : [...points.slice(0, outsideIndex + 1), entry];
}

export function clipEdgeEndpointsToNodeBoundaries(edges: unknown[], nodeByIdMap: Map<string, any>) {
  for (const edge of edges) {
    const context = endpointContextFor(edge, nodeByIdMap, 2);
    if (!context) {
      continue;
    }

    let next = [...context.points];
    if (context.srcRect) {
      next = clipEndpoint(next, context.srcRect, true);
    }
    if (context.dstRect) {
      next = clipEndpoint(next, context.dstRect, false);
    }
    next = simplifyPolyline(orthogonalizePolyline(next));
    next = clearStraightEndpointCornerConnections(next, context.srcRect, context.dstRect);
    context.edge.points = simplifyPolyline(orthogonalizePolyline(next));
  }
}

function snapEndpointToBoundary(
  inner: Point,
  endpoint: Point,
  r: NodeRect,
  useApproachSide = false
): Point {
  if (sameY(inner, endpoint, EPS)) {
    if (endpoint.y < r.top - EPS || endpoint.y > r.bottom + EPS) {
      return endpoint;
    }
    if (useApproachSide) {
      if (inner.x < r.left - EPS) {
        return { x: r.left, y: inner.y };
      }
      if (inner.x > r.right + EPS) {
        return { x: r.right, y: inner.y };
      }
    }
    const toLeft = Math.abs(endpoint.x - r.left) <= Math.abs(endpoint.x - r.right);
    return { x: toLeft ? r.left : r.right, y: inner.y };
  }
  if (sameX(inner, endpoint, EPS)) {
    if (endpoint.x < r.left - EPS || endpoint.x > r.right + EPS) {
      return endpoint;
    }
    if (useApproachSide) {
      if (inner.y < r.top - EPS) {
        return { x: inner.x, y: r.top };
      }
      if (inner.y > r.bottom + EPS) {
        return { x: inner.x, y: r.bottom };
      }
    }
    const toTop = Math.abs(endpoint.y - r.top) <= Math.abs(endpoint.y - r.bottom);
    return { x: inner.x, y: toTop ? r.top : r.bottom };
  }
  return endpoint;
}

function firstDistinctAdjacent(
  points: Point[],
  endpointIndex: number,
  step: 1 | -1
): Point | undefined {
  const endpoint = points[endpointIndex];
  for (let index = endpointIndex + step; index >= 0 && index < points.length; index += step) {
    const candidate = points[index];
    if (!samePoint(candidate, endpoint, EPS)) {
      return candidate;
    }
  }
  return points[endpointIndex + step];
}

function cornerClearanceRange(min: number, max: number): { lo: number; hi: number } {
  const lo = min + CORNER_CLEARANCE;
  const hi = max - CORNER_CLEARANCE;
  return lo <= hi ? { lo, hi } : { lo: (min + max) / 2, hi: (min + max) / 2 };
}

function clampToCornerClearance(value: number, min: number, max: number): number {
  const { lo, hi } = cornerClearanceRange(min, max);
  return Math.min(hi, Math.max(lo, value));
}

function intersectRanges(
  ranges: { lo: number; hi: number }[]
): { lo: number; hi: number } | undefined {
  const lo = Math.max(...ranges.map((range) => range.lo));
  const hi = Math.min(...ranges.map((range) => range.hi));
  if (lo > hi) {
    return undefined;
  }
  return { lo, hi };
}

function clearanceRangeForSide(r: NodeRect, side: BorderSide): { lo: number; hi: number } {
  return side === 'left' || side === 'right'
    ? cornerClearanceRange(r.top, r.bottom)
    : cornerClearanceRange(r.left, r.right);
}

function terminalSideForSegment(
  endpoint: Point,
  adjacent: Point,
  r: NodeRect
): BorderSide | undefined {
  const yWithin = endpoint.y >= r.top - EPS && endpoint.y <= r.bottom + EPS;
  const xWithin = endpoint.x >= r.left - EPS && endpoint.x <= r.right + EPS;
  if (sameY(endpoint, adjacent, EPS) && yWithin) {
    if (Math.abs(endpoint.x - r.left) < EPS) {
      return 'left';
    }
    if (Math.abs(endpoint.x - r.right) < EPS) {
      return 'right';
    }
  }
  if (sameX(endpoint, adjacent, EPS) && xWithin) {
    if (Math.abs(endpoint.y - r.top) < EPS) {
      return 'top';
    }
    if (Math.abs(endpoint.y - r.bottom) < EPS) {
      return 'bottom';
    }
  }
  return undefined;
}

function isHorizontalSide(side: BorderSide): boolean {
  return side === 'left' || side === 'right';
}

function straightClearanceRange(
  start: Point,
  end: Point,
  srcRect: NodeRect | undefined,
  dstRect: NodeRect | undefined,
  horizontal: boolean
): { lo: number; hi: number } | undefined {
  const ranges: { lo: number; hi: number }[] = [];
  const srcSide = srcRect ? terminalSideForSegment(start, end, srcRect) : undefined;
  const dstSide = dstRect ? terminalSideForSegment(end, start, dstRect) : undefined;

  if (srcRect && srcSide && isHorizontalSide(srcSide) === horizontal) {
    ranges.push(clearanceRangeForSide(srcRect, srcSide));
  }
  if (dstRect && dstSide && isHorizontalSide(dstSide) === horizontal) {
    ranges.push(clearanceRangeForSide(dstRect, dstSide));
  }

  return ranges.length > 0 ? intersectRanges(ranges) : undefined;
}

function clearStraightEndpointCornerAxis(
  start: Point,
  end: Point,
  srcRect: NodeRect | undefined,
  dstRect: NodeRect | undefined,
  horizontal: boolean
): Point[] | undefined {
  const range = straightClearanceRange(start, end, srcRect, dstRect, horizontal);
  if (!range) {
    return undefined;
  }

  const current = horizontal ? start.y : start.x;
  const next = Math.min(range.hi, Math.max(range.lo, current));
  if (Math.abs(next - current) < EPS) {
    return undefined;
  }

  return horizontal
    ? [
        { x: start.x, y: next },
        { x: end.x, y: next },
      ]
    : [
        { x: next, y: start.y },
        { x: next, y: end.y },
      ];
}

function clearStraightEndpointCornerConnections(
  points: Point[],
  srcRect?: NodeRect,
  dstRect?: NodeRect
): Point[] {
  if (points.length !== 2) {
    return points;
  }

  const [start, end] = points;
  if (sameY(start, end, EPS)) {
    return clearStraightEndpointCornerAxis(start, end, srcRect, dstRect, true) ?? points;
  }

  if (sameX(start, end, EPS)) {
    return clearStraightEndpointCornerAxis(start, end, srcRect, dstRect, false) ?? points;
  }

  return points;
}

function cornerClearedEndpoint(endpoint: Point, r: NodeRect, side: BorderSide): Point {
  return isHorizontalSide(side)
    ? { x: endpoint.x, y: clampToCornerClearance(endpoint.y, r.top, r.bottom) }
    : { x: clampToCornerClearance(endpoint.x, r.left, r.right), y: endpoint.y };
}

function moveCollinearEndpointRun(
  points: Point[],
  endpointIndex: number,
  step: 1 | -1,
  endpoint: Point,
  adjusted: Point,
  horizontalTerminal: boolean
): Point[] {
  const next = points.map((point) => ({ ...point }));
  for (let index = endpointIndex; index >= 0 && index < points.length; index += step) {
    const point = points[index];
    if (horizontalTerminal && !sameY(point, endpoint, EPS)) {
      break;
    }
    if (!horizontalTerminal && !sameX(point, endpoint, EPS)) {
      break;
    }
    if (horizontalTerminal) {
      next[index].y = adjusted.y;
    } else {
      next[index].x = adjusted.x;
    }
  }
  return next;
}

function clearEndpointCornerConnection(points: Point[], r: NodeRect, atStart: boolean): Point[] {
  if (points.length < 2) {
    return points;
  }

  const endpointIndex = atStart ? 0 : points.length - 1;
  const step = atStart ? 1 : -1;
  const endpoint = points[endpointIndex];
  const adjacent = firstDistinctAdjacent(points, endpointIndex, step);
  if (!adjacent) {
    return points;
  }

  const side = terminalSideForSegment(endpoint, adjacent, r);
  if (!side) {
    return points;
  }

  const horizontalTerminal = isHorizontalSide(side);
  const adjusted = cornerClearedEndpoint(endpoint, r, side);
  if (samePoint(endpoint, adjusted, EPS)) {
    return points;
  }

  return moveCollinearEndpointRun(
    points,
    endpointIndex,
    step,
    endpoint,
    adjusted,
    horizontalTerminal
  );
}

function borderSideForSegment(a: Point, b: Point, r: NodeRect): BorderSide | undefined {
  const xWithin = Math.min(a.x, b.x) >= r.left - EPS && Math.max(a.x, b.x) <= r.right + EPS;
  const yWithin = Math.min(a.y, b.y) >= r.top - EPS && Math.max(a.y, b.y) <= r.bottom + EPS;
  if (Math.abs(a.y - r.top) < EPS && Math.abs(b.y - r.top) < EPS && xWithin) {
    return 'top';
  }
  if (Math.abs(a.y - r.bottom) < EPS && Math.abs(b.y - r.bottom) < EPS && xWithin) {
    return 'bottom';
  }
  if (Math.abs(a.x - r.left) < EPS && Math.abs(b.x - r.left) < EPS && yWithin) {
    return 'left';
  }
  if (Math.abs(a.x - r.right) < EPS && Math.abs(b.x - r.right) < EPS && yWithin) {
    return 'right';
  }
  return undefined;
}

function leavesOutward(side: BorderSide, from: Point, to: Point, r: NodeRect): boolean {
  switch (side) {
    case 'top':
      return sameX(from, to, EPS) && to.y < r.top - EPS;
    case 'bottom':
      return sameX(from, to, EPS) && to.y > r.bottom + EPS;
    case 'left':
      return sameY(from, to, EPS) && to.x < r.left - EPS;
    case 'right':
      return sameY(from, to, EPS) && to.x > r.right + EPS;
  }
}

function collapseOwnBorderStub(points: Point[], r: NodeRect, atStart: boolean): Point[] {
  if (points.length < 3) {
    return points;
  }
  if (atStart) {
    const side = borderSideForSegment(points[0], points[1], r);
    if (side && leavesOutward(side, points[1], points[2], r)) {
      return points.slice(1);
    }
    return points;
  }

  const last = points.length - 1;
  const side = borderSideForSegment(points[last - 1], points[last], r);
  if (side && leavesOutward(side, points[last - 1], points[last - 2], r)) {
    return points.slice(0, last);
  }
  return points;
}

function snapAndCollapseEndpoints(
  points: Point[],
  srcRect?: NodeRect,
  dstRect?: NodeRect
): Point[] {
  let next = points;
  if (srcRect) {
    const adjacent = firstDistinctAdjacent(next, 0, 1);
    if (adjacent) {
      const snapped = snapEndpointToBoundary(adjacent, next[0], srcRect);
      if (snapped !== next[0]) {
        next = [snapped, ...next.slice(1)];
      }
    }
    next = collapseOwnBorderStub(next, srcRect, true);
  }
  if (dstRect) {
    const last = next.length - 1;
    const adjacent = firstDistinctAdjacent(next, last, -1);
    if (adjacent) {
      const snapped = snapEndpointToBoundary(adjacent, next[last], dstRect, true);
      if (snapped !== next[last]) {
        next = [...next.slice(0, last), snapped];
      }
    }
    next = collapseOwnBorderStub(next, dstRect, false);
  }

  const straightCleared = clearStraightEndpointCornerConnections(next, srcRect, dstRect);
  if (straightCleared !== next || next.length === 2) {
    return straightCleared;
  }

  if (srcRect) {
    next = clearEndpointCornerConnection(next, srcRect, true);
  }
  if (dstRect) {
    next = clearEndpointCornerConnection(next, dstRect, false);
  }
  return next;
}

export function prepareEdgeEndpointsForRenderer(edges: unknown[], nodeByIdMap: Map<string, any>) {
  for (const edge of edges) {
    const context = endpointContextFor(edge, nodeByIdMap, 2);
    if (!context) {
      continue;
    }

    const input = dedupeConsecutivePoints(context.points, EPS);
    const newPts = snapAndCollapseEndpoints(input, context.srcRect, context.dstRect);
    if (newPts.length < 3) {
      context.edge.points = newPts;
      continue;
    }
    const duplicated = [
      newPts[0],
      { ...newPts[0] },
      ...newPts.slice(1, -1),
      newPts[newPts.length - 1],
      { ...newPts[newPts.length - 1] },
    ];
    context.edge.points = duplicated;
  }
}

/**
 * Drops a point the line runs past and comes back from.
 *
 * Bringing a line onto a corner can leave the rail it used to start at sitting behind the
 * new one: three points on a line, the middle of them not between the other two. The run
 * out to it and back is drawn as a step beside the shape, and it is never load bearing -
 * removing it keeps the line inside the ground it already covered.
 */
function dropAxisBacktracks(points: Point[]): Point[] {
  const out = [...points];
  let i = 1;
  while (i < out.length - 1) {
    const [a, b, c] = [out[i - 1], out[i], out[i + 1]];
    const flat = Math.abs(a.y - b.y) < 1e-6 && Math.abs(b.y - c.y) < 1e-6;
    const upright = Math.abs(a.x - b.x) < 1e-6 && Math.abs(b.x - c.x) < 1e-6;
    const backtracks =
      (flat && (b.x - a.x) * (c.x - b.x) < 0) || (upright && (b.y - a.y) * (c.y - b.y) < 0);
    if (backtracks) {
      out.splice(i, 1);
      i = Math.max(1, i - 1);
      continue;
    }
    i++;
  }
  return out;
}

/** The four points where a rhombus touches the box that contains it. */
const VERTEX_SIDES = ['top', 'bottom', 'left', 'right'] as const;
type VertexSide = (typeof VERTEX_SIDES)[number];

/**
 * Whether a node's outline meets its box only at the midpoint of each side.
 *
 * A rhombus does. Scoped to the shapes that also carry a drawn extent, so a shape whose
 * box is the mark it draws keeps the geometry its own routes were tuned against.
 */
function meetsAtVertices(node: any): boolean {
  return node?.shape === 'bpmn-gateway' && Boolean(node?.metadata?.drawnExtent);
}

function vertexOf(node: any, side: VertexSide): Point | undefined {
  const drawn = node?.metadata?.drawnExtent;
  const cx = node?.x;
  const cy = node?.y;
  if (typeof cx !== 'number' || typeof cy !== 'number' || !drawn) {
    return undefined;
  }
  const halfWidth = (drawn.width ?? 0) / 2;
  const halfHeight = (drawn.height ?? 0) / 2;
  if (halfWidth <= 0 || halfHeight <= 0) {
    return undefined;
  }
  switch (side) {
    case 'top':
      return { x: cx, y: cy - halfHeight };
    case 'bottom':
      return { x: cx, y: cy + halfHeight };
    case 'left':
      return { x: cx - halfWidth, y: cy };
    case 'right':
      return { x: cx + halfWidth, y: cy };
  }
}

/** The corners a line coming from `toward` would prefer, best first. */
function preferredSides(node: any, toward: Point): VertexSide[] {
  const dx = toward.x - (node?.x ?? 0);
  const dy = toward.y - (node?.y ?? 0);
  const score: Record<VertexSide, number> = {
    right: dx,
    left: -dx,
    bottom: dy,
    top: -dy,
  };
  return [...VERTEX_SIDES].sort((a, b) => score[b] - score[a]);
}

/**
 * Brings every line into a rhombus at one of its four corners, one line to a corner.
 *
 * Each side of a diamond closes to a single point, so a line stopping anywhere else along
 * a side stops beside the shape rather than on it, and the run from there across to the
 * corner the renderer docks at is the hook a reader sees under the mark. A line going up
 * meets the top corner, one going down the bottom, and so on round.
 *
 * Corners are handed out one to a line, incoming first. A gateway's answer leaving by the
 * same point the question arrived at reads as one line passing through rather than a
 * decision being made, which is the whole thing the shape is there to show.
 */
export function meetDiamondsAtTheirVertex(edges: unknown[], nodeByIdMap: Map<string, any>) {
  interface Contact {
    edge: { points?: Point[] };
    atStart: boolean;
    neighbour: Point;
    incoming: boolean;
  }
  const byNode = new Map<string, Contact[]>();

  for (const edge of edges) {
    const candidate = edge as {
      points?: Point[];
      start?: string;
      end?: string;
      isLayoutOnly?: boolean;
    };
    if (candidate.isLayoutOnly || !candidate.points || candidate.points.length < 2) {
      continue;
    }
    for (const atStart of [true, false]) {
      const id = atStart ? candidate.start : candidate.end;
      if (!id || !meetsAtVertices(nodeByIdMap.get(id))) {
        continue;
      }
      const points = candidate.points;
      const neighbour = atStart ? points[1] : points[points.length - 2];
      byNode.set(id, [
        ...(byNode.get(id) ?? []),
        { edge: candidate, atStart, neighbour, incoming: !atStart },
      ]);
    }
  }

  for (const [id, contacts] of byNode) {
    const node = nodeByIdMap.get(id);
    const taken = new Set<VertexSide>();
    // Incoming first: an answer may be moved off its natural corner, a question may not.
    const ordered = [...contacts].sort((a, b) => Number(b.incoming) - Number(a.incoming));

    for (const contact of ordered) {
      const prefs = preferredSides(node, contact.neighbour);
      const side = prefs.find((s) => !taken.has(s)) ?? prefs[0];
      taken.add(side);
      const vertex = vertexOf(node, side);
      const points = contact.edge.points;
      if (!vertex || !points || points.length < 2) {
        continue;
      }
      const alongY = side === 'top' || side === 'bottom';
      const away = side === 'top' || side === 'left' ? -1 : 1;

      // The rest of the line, read from the corner inwards.
      const rest = contact.atStart ? points.slice(1) : points.slice(0, -1);
      const inward = contact.atStart ? rest : [...rest].reverse();

      // A corner is a point, so the line has to leave it along the corner's own axis
      // before it may turn. Start from the first place the line has actually cleared the
      // corner on that axis: anything before it was drawn beside the shape, going the
      // wrong way to reach a point it had already been given.
      const cleared = inward.findIndex((p) =>
        alongY ? (p.y - vertex.y) * away > 1e-6 : (p.x - vertex.x) * away > 1e-6
      );
      const tail = cleared >= 0 ? inward.slice(cleared) : inward;
      const first = tail[0] ?? vertex;
      const corner = alongY ? { x: vertex.x, y: first.y } : { x: first.x, y: vertex.y };
      const needsCorner =
        Math.abs(corner.x - first.x) > 1e-6 || Math.abs(corner.y - first.y) > 1e-6;

      const ordered = [vertex, ...(needsCorner ? [corner] : []), ...tail];
      const joined = contact.atStart ? ordered : [...ordered].reverse();
      contact.edge.points = dropAxisBacktracks(joined);
    }
  }
}
