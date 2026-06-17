import { labelHelper, updateNodeBounds, getNodeClasses } from './util.js';
import intersect from '../intersect/index.js';
import type { Node } from '../../types.js';
import { styles2String } from './handDrawnShapeStyles.js';
import type { D3Selection } from '../../../types.js';

/**
 * C4 queue shape: a horizontal pipe/capsule (Structurizr "Pipe") that grows
 * vertically to contain its label, used for C4 *Queue elements. Always
 * self-sizes from the label so the multi-line C4 text sits inside the body.
 */
export async function c4Queue<T extends SVGGraphicsElement>(parent: D3Selection<T>, node: Node) {
  const { labelStyles, nodeStyles } = styles2String(node);
  node.labelStyle = labelStyles;

  const { shapeSvg, bbox, label } = await labelHelper(parent, node, getNodeClasses(node));

  const padding = node.padding ?? 20;
  const h = Math.max(bbox.height + padding * 2, 40);
  const ry = h / 2;
  // Horizontal cap radius (elliptical ends), proportional to the height.
  const rx = Math.max(Math.min(h * 0.22, 24), 8);
  const w = Math.max(bbox.width + padding * 2 + rx * 2, 80);
  const left = -w / 2;
  const right = w / 2;
  const top = -h / 2;

  const group = shapeSvg.insert('g', ':first-child').attr('class', 'basic label-container');

  const body = [
    `M${left + rx},${top}`,
    `L${right - rx},${top}`, // top edge
    `A${rx},${ry} 0,0,1 ${right - rx},${top + h}`, // right cap
    `L${left + rx},${top + h}`, // bottom edge
    `A${rx},${ry} 0,0,1 ${left + rx},${top}`, // left cap
    `Z`,
  ].join(' ');

  group.append('path').attr('d', body).attr('style', nodeStyles);
  // Seam showing the pipe opening at the right end.
  group
    .append('path')
    .attr('d', `M${right - rx},${top} A${rx},${ry} 0,0,0 ${right - rx},${top + h}`)
    .attr('style', nodeStyles)
    .style('fill', 'none');

  updateNodeBounds(node, group);

  // Label centred on the origin; the `rx` padding on each side keeps the text
  // clear of the elliptical caps and the seam.
  label.attr(
    'transform',
    `translate(${-(bbox.width / 2) - (bbox.x - (bbox.left ?? 0))}, ${-(bbox.height / 2) - (bbox.y - (bbox.top ?? 0))})`
  );

  node.intersect = function (point) {
    return intersect.rect(node, point);
  };

  return shapeSvg;
}
