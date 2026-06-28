import { labelHelper, updateNodeBounds, getNodeClasses } from './util.js';
import intersect from '../intersect/index.js';
import type { Node } from '../../types.js';
import { styles2String } from './handDrawnShapeStyles.js';
import type { D3Selection } from '../../../types.js';
import {
  C4_BROWSER_TRAFFIC_RADIUS,
  C4_BROWSER_ADDRESS_BAR_STROKE_WIDTH,
  C4_BROWSER_ADDRESS_BAR_OPACITY,
} from './c4ShapeConstants.js';

/** C4 browser shape: a rounded box with a window chrome bar, for single-page applications. */
export async function c4Browser<T extends SVGGraphicsElement>(parent: D3Selection<T>, node: Node) {
  const { labelStyles, nodeStyles } = styles2String(node);
  node.labelStyle = labelStyles;

  const { shapeSvg, bbox, label } = await labelHelper(parent, node, getNodeClasses(node));

  const padding = node.padding ?? 12;
  const barHeight = 18;
  const w = Math.max(bbox.width + padding * 2, 90);
  const h = bbox.height + padding * 2 + barHeight;
  const top = -h / 2;
  const accent = node.c4Accent ?? 'currentColor';

  const group = shapeSvg.insert('g', ':first-child').attr('class', 'basic label-container');

  group
    .append('rect')
    .attr('x', -w / 2)
    .attr('y', top)
    .attr('width', w)
    .attr('height', h)
    .attr('rx', 12)
    .attr('ry', 12)
    .attr('style', nodeStyles);

  group
    .append('line')
    .attr('x1', -w / 2)
    .attr('y1', top + barHeight)
    .attr('x2', w / 2)
    .attr('y2', top + barHeight)
    .attr('style', nodeStyles);

  for (let i = 0; i < 3; i++) {
    group
      .append('circle')
      .attr('cx', -w / 2 + 12 + i * 9)
      .attr('cy', top + barHeight / 2)
      .attr('r', C4_BROWSER_TRAFFIC_RADIUS)
      .attr('style', `fill:${accent};stroke:none`);
  }

  // Address-bar hint to the right of the traffic lights.
  group
    .append('rect')
    .attr('class', 'c4-address-bar')
    .attr('x', -w / 2 + 44)
    .attr('y', top + 4)
    .attr('width', Math.max(w - 56, 10))
    .attr('height', barHeight - 8)
    .attr('rx', 3)
    .attr('ry', 3)
    .attr(
      'style',
      `fill:none;stroke:${accent};stroke-width:${C4_BROWSER_ADDRESS_BAR_STROKE_WIDTH}px;opacity:${C4_BROWSER_ADDRESS_BAR_OPACITY}`
    );

  updateNodeBounds(node, group);

  const bodyCenterY = top + barHeight + (h - barHeight) / 2;
  label.attr(
    'transform',
    `translate(${-(bbox.width / 2) - (bbox.x - (bbox.left ?? 0))}, ${bodyCenterY - bbox.height / 2 - (bbox.y - (bbox.top ?? 0))})`
  );

  node.intersect = function (point) {
    return intersect.rect(node, point);
  };

  return shapeSvg;
}
