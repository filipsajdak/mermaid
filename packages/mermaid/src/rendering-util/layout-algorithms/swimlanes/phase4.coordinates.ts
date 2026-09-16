import type { Graph, OrderedLayers, Coordinates, NodeId, EdgeRef } from './helpers.js';
import { COORDINATES } from './config.js';
import { createTopLaneResolver, resolveTopLaneOrder } from './phase2.options.js';
import { anchorFootprints } from './anchoredNodes.js';

export interface CoordOptions {
  layerGap?: number; // vertical distance between layers
  nodeGap?: number; // horizontal gap between siblings inside a lane
  laneGap?: number; // horizontal gap between lanes (clusters)
  direction?: 'TB' | 'LR' | 'BT' | 'RL'; // layout direction for proper spacing
  /** Whether a lane may hold several nodes in one layer, so their own extent matters. */
  spreadByOwnExtent?: boolean;
  /** Whether the gap asked for is room between shapes rather than room they may share. */
  gapIsRoomBetween?: boolean;
  laneOrder?: string[];
}

export function assignCoordinates(
  ordered: OrderedLayers,
  gWithDummies: Graph,
  opts?: CoordOptions
): Coordinates {
  const layerGap = opts?.layerGap ?? COORDINATES.DEFAULT_LAYER_GAP;
  const nodeGap = opts?.nodeGap ?? COORDINATES.DEFAULT_NODE_GAP;
  const laneGap = opts?.laneGap ?? nodeGap * 2;
  const direction = opts?.direction ?? 'TB';
  const isHorizontal = direction === 'LR' || direction === 'RL';

  const layers = ordered.layers;

  const x: Record<NodeId, number> = Object.create(null);
  const y: Record<NodeId, number> = Object.create(null);

  const getNode = (id: NodeId) => gWithDummies.nodeById.get(id) as any;
  const getWidth = (id: NodeId) => getNode(id)?.width ?? 0;
  const getHeight = (id: NodeId) => getNode(id)?.height ?? 0;
  /**
   * How much room a node needs across a layer.
   *
   * Coordinates are assigned with layers running down the page, so the cross axis is x
   * and a node takes up its width. An LR or RL transform turns that axis into y, where
   * the same node takes up its height instead, and a narrow box whose label has wrapped
   * tall then reserves too little room and lands on its neighbour.
   *
   * This governs how nodes sharing a layer are spread. A lane that holds one node per
   * layer never spreads anything, so the correction is asked for by the diagrams whose
   * lanes hold several; the room reserved for the lane itself is left on width, where
   * being generous costs space but never an overlap.
   */
  const spreadByOwnExtent = opts?.spreadByOwnExtent ?? false;
  const crossExtent = (id: NodeId) =>
    isHorizontal && spreadByOwnExtent ? getHeight(id) : getWidth(id);
  /**
   * Nodes that an edge starts or ends at.
   *
   * Nodes sharing a layer are spread around their lane's centre so that branches running
   * beside each other stay centred on the flow they belong to. A node no edge touches is
   * in no branch, so counting it in that centring moves the whole flow sideways for every
   * loose node the lane happens to declare - a note written next to a process should not
   * shift the process. Such nodes are placed after the ones that are centred.
   */
  const inSomeFlow = new Set<NodeId>();
  for (const e of gWithDummies.edges) {
    inSomeFlow.add(e.src);
    inSomeFlow.add(e.dst);
  }

  const topLaneOf = createTopLaneResolver(gWithDummies);
  const laneOrderGlobal = resolveTopLaneOrder(gWithDummies, opts?.laneOrder);

  const layerHeights: number[] = layers.map((layer) =>
    layer.reduce((m, v) => Math.max(m, getHeight(v)), 0)
  );

  // LR/RL transforms turn width into horizontal span, so widen layer gaps up front.
  const extraLayerGaps: number[] = [];
  if (isHorizontal) {
    for (let i = 0; i + 1 < layers.length; i++) {
      const thisLayerMaxWidth = layers[i].reduce((m, v) => Math.max(m, getWidth(v)), 0);
      const nextLayerMaxWidth = layers[i + 1].reduce((m, v) => Math.max(m, getWidth(v)), 0);
      const thisLayerMaxHeight = layerHeights[i];
      const nextLayerMaxHeight = layerHeights[i + 1];

      const normalSpacing = thisLayerMaxHeight / 2 + nextLayerMaxHeight / 2;
      // Plus the gap itself, where the diagram asked for it that way: the room a layer
      // needs is what the shapes occupy and then the space between them. Without it a
      // narrow gap seats two shapes edge to edge and the flow joining them has nowhere
      // left to be drawn.
      const requiredSpacing =
        (thisLayerMaxWidth + nextLayerMaxWidth) / 2 + (opts?.gapIsRoomBetween ? layerGap : 0);
      const extraNeeded = Math.max(0, requiredSpacing - normalSpacing - layerGap);
      extraLayerGaps.push(extraNeeded);
    }
  }

  const lanesUsedSet = new Set<string | null>();
  for (const layer of layers) {
    for (const id of layer) {
      lanesUsedSet.add(topLaneOf(id));
    }
  }
  const hasNullLane = lanesUsedSet.has(null);
  const lanesUsed = laneOrderGlobal.filter((L) => lanesUsedSet.has(L));
  const laneOrderColumns: (string | null)[] = [...(hasNullLane ? [null] : []), ...lanesUsed];

  /**
   * How much of its lane a node needs across the lane.
   *
   * A node standing off another's border - an artifact beside the activity it annotates -
   * is placed from that host rather than laid out, so it is absent from the graph and
   * nothing here can see it. Its reach past the border is added to the host instead, or
   * the lane is sized to contents it does not in fact contain, and the artifact is drawn
   * over its neighbour or outside the band altogether.
   */
  const footprints = anchorFootprints(gWithDummies.layout?.nodes ?? [], direction);
  const reachOf = (id: NodeId) => footprints.get(id)?.beyond ?? 0;

  /**
   * How a lane's members in one layer sit either side of the lane's flow axis.
   *
   * A layer's nodes are centred as a run, and an artifact standing beside the last of
   * them reaches past the end of that run. So a lane is not symmetric about its flow: it
   * needs `left` on one side and `left` plus everything trailing on the other. Sizing it
   * by one number instead forces a choice between a flow that jogs layer to layer and an
   * artifact drawn outside the band - which is both of the things this is here to stop.
   *
   * Sizing and placement read the same function, so the room reserved and the run that
   * fills it cannot drift apart.
   */
  const runHalves = (
    ids: NodeId[],
    extentOf: (id: NodeId) => number
  ): { spread: NodeId[]; beside: NodeId[]; left: number; right: number } => {
    const centred = ids.filter((id) => inSomeFlow.has(id));
    const loose = ids.filter((id) => !inSomeFlow.has(id));
    const spread = centred.length > 0 ? centred : loose;
    const beside = centred.length > 0 ? loose : [];

    const extents = spread.map(extentOf);
    const reaches = spread.map(reachOf);
    // Room between two members pushes them apart; room past the last one does not, so it
    // belongs to the trailing side rather than to the run that is centred.
    const total =
      extents.reduce((a, b) => a + b, 0) +
      reaches.slice(0, -1).reduce((a, b) => a + b, 0) +
      nodeGap * Math.max(0, spread.length - 1);
    let tail = reaches.length > 0 ? reaches[reaches.length - 1] : 0;
    for (const id of beside) {
      tail += nodeGap + extentOf(id) + reachOf(id);
    }
    return { spread, beside, left: total / 2, right: total / 2 + tail };
  };

  // Lane room is measured on whichever axis asks for more. Spreading follows the axis the
  // direction transform will lay the nodes along, but being generous with the band itself
  // costs space and never an overlap.
  const laneSizeExtent = (id: NodeId) => Math.max(getWidth(id), crossExtent(id));

  const laneHalves = new Map<string | null, { left: number; right: number }>();
  for (const L of laneOrderColumns) {
    laneHalves.set(L, { left: 0, right: 0 });
  }
  for (const layer of layers) {
    const perLane = new Map<string | null, NodeId[]>();
    for (const id of layer) {
      const L = topLaneOf(id);
      perLane.set(L, [...(perLane.get(L) ?? []), id]);
    }
    for (const [L, ids] of perLane) {
      const half = laneHalves.get(L);
      if (!half) {
        continue;
      }
      const { left, right } = runHalves(ids, (id) =>
        L === null ? getWidth(id) : laneSizeExtent(id)
      );
      half.left = Math.max(half.left, left);
      half.right = Math.max(half.right, right);
    }
  }

  // Where a lane's flow runs. Offset from the band's centre by however lopsided the band
  // had to be, so every layer centres on the same line and the flow stays straight.
  const laneAxis = new Map<string | null, number>();
  {
    const widths = laneOrderColumns.map((L) => {
      const half = laneHalves.get(L);
      return (half?.left ?? 0) + (half?.right ?? 0);
    });
    const totalW =
      widths.reduce((a, b) => a + b, 0) + laneGap * Math.max(0, laneOrderColumns.length - 1);
    let cursor = -totalW / 2;
    for (let i = 0; i < laneOrderColumns.length; i++) {
      const L = laneOrderColumns[i];
      const w = widths[i] ?? 0;
      laneAxis.set(L, cursor + (laneHalves.get(L)?.left ?? w / 2));
      cursor += w;
      if (i < laneOrderColumns.length - 1) {
        cursor += laneGap;
      }
    }
  }

  let yOffset = 0;
  for (const [li, layer] of layers.entries()) {
    const layerH = layerHeights[li] ?? 0;

    const byLane = new Map<string | null, NodeId[]>();
    for (const id of layer) {
      const laneId = topLaneOf(id);
      const arr = byLane.get(laneId) ?? [];
      arr.push(id);
      byLane.set(laneId, arr);
    }

    for (const L of laneOrderColumns) {
      const nodesInLane = byLane.get(L) ?? [];
      if (nodesInLane.length === 0) {
        continue;
      }
      // Preserve phase 3 order while spreading nodes around the lane's flow axis.
      // Only nodes belonging to a lane. The rest are the layout's own dummies, whose
      // width is a label's width - keeping them on it spreads stacked edge labels
      // further apart, which is what keeps them legible.
      const extentOf = (id: NodeId) => (L === null ? getWidth(id) : crossExtent(id));
      const axis = laneAxis.get(L) ?? 0;
      const { spread, beside, left } = runHalves(nodesInLane, extentOf);

      const extents = spread.map(extentOf);
      const reaches = spread.map(reachOf);
      let start = axis - left;
      for (const [i, id] of spread.entries()) {
        const w = extents[i];
        // Left-aligned in its slot, so the room an artifact needs follows the host it
        // stands beside rather than being handed to the next node along.
        x[id] = start + w / 2;
        y[id] = yOffset + layerH / 2;
        start += w;
        if (i < spread.length - 1) {
          start += reaches[i] + nodeGap;
        }
      }
      start += reaches.length > 0 ? reaches[reaches.length - 1] : 0;
      for (const id of beside) {
        const w = extentOf(id);
        start += nodeGap;
        x[id] = start + w / 2;
        y[id] = yOffset + layerH / 2;
        start += w + reachOf(id);
      }
    }

    const extraGap = extraLayerGaps[li] ?? 0;
    yOffset += layerH + layerGap + extraGap;
  }

  // Align dummy chains for each original edge: set dummy x to midpoint between src and dst.
  const byRef = new Map<string, EdgeRef[]>();
  for (const e of gWithDummies.edges) {
    const rid = e.ref.id;
    if (!byRef.has(rid)) {
      byRef.set(rid, []);
    }
    byRef.get(rid)!.push(e);
  }
  for (const [, chainEdges] of byRef) {
    if (chainEdges.length === 0) {
      continue;
    }
    const ref = chainEdges[0].ref;
    const src = ref.start!;
    const dst = ref.end!;
    if (src == null || dst == null) {
      continue;
    }
    const midX = Math.round(((x[src] ?? 0) + (x[dst] ?? 0)) / 2);
    const involved = new Set<NodeId>();
    for (const e of chainEdges) {
      involved.add(e.src);
      involved.add(e.dst);
    }
    for (const vid of involved) {
      if (vid === src || vid === dst) {
        continue;
      }
      const node = gWithDummies.nodeById.get(vid) as any;
      if (node?.isDummy) {
        x[vid] = midX;
      }
    }
  }

  return { x, y };
}
