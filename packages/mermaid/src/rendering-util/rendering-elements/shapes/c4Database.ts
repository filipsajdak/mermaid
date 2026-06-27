import { labelHelper, updateNodeBounds, getNodeClasses } from './util.js';
import intersect from '../intersect/index.js';
import type { Node } from '../../types.js';
import { styles2String } from './handDrawnShapeStyles.js';
import type { D3Selection } from '../../../types.js';

/**
 * C4 database shape: a vertical cylinder that grows to contain its label, used
 * for C4 *Db elements. Unlike the shared `cylinder` shape it always self-sizes
 * from the label (no pre-set width/height branch), so the multi-line C4 label
 * (name + stereotype + description) sits fully inside the body.
 */
export async function c4Database<T extends SVGGraphicsElement>(parent: D3Selection<T>, node: Node) {
  const { labelStyles, nodeStyles } = styles2String(node);
  node.labelStyle = labelStyles;

  const { shapeSvg, bbox, label } = await labelHelper(parent, node, getNodeClasses(node));

  const padding = node.padding ?? 20;
  const w = Math.max(bbox.width + padding * 2, 80);
  // Cap radius, matching the proportions of the shared cylinder shape.
  const ry = Math.max(Math.min(w * 0.12, 18), 8);
  const bodyHeight = bbox.height + padding * 2;
  const totalHeight = bodyHeight + 2 * ry;
  const topY = -totalHeight / 2 + ry; // centre of the top ellipse
  const x = -w / 2;

  const group = shapeSvg.insert('g', ':first-child').attr('class', 'basic label-container');

  const body = [
    `M${x},${topY}`,
    `a${w / 2},${ry} 0,0,0 ${w},0`, // top rim (back half)
    `a${w / 2},${ry} 0,0,0 ${-w},0`, // top rim (front half)
    `l0,${bodyHeight}`, // left side down
    `a${w / 2},${ry} 0,0,0 ${w},0`, // bottom front arc
    `l0,${-bodyHeight}`, // right side up
  ].join(' ');

  group.append('path').attr('d', body).attr('style', nodeStyles);

  updateNodeBounds(node, group);

  // Centre the label between the cap front-curves, not on the body rectangle: the top
  // cap dips `ry` into the body while the bottom cap adds `ry` of space below, so nudge
  // the label down by `ry` to balance the clear space above and below it on the side.
  label.attr(
    'transform',
    `translate(${-(bbox.width / 2) - (bbox.x - (bbox.left ?? 0))}, ${-(bbox.height / 2) - (bbox.y - (bbox.top ?? 0)) + ry})`
  );

  node.intersect = function (point) {
    return intersect.rect(node, point);
  };

  return shapeSvg;
}
