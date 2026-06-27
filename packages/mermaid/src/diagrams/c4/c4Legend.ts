import type { Selection } from 'd3';
import type { MermaidConfig } from '../../config.type.js';
import type { C4LegendItem } from './c4LayoutData.js';

/**
 * Shared C4 legend renderer. Appends a `<g class="c4-legend">` to the diagram
 * with one row per legend item: a small swatch in the item's outline color over
 * a white fill, followed by the item's label. Plain SVG (d3) so it matches the
 * outline element style and stays free of theme coupling.
 *
 * This module is deliberately self-contained (it takes the already-derived
 * legend items, not a db) so the C4 syntaxes (legacy here, and the planned
 * c4-beta) can share it.
 *
 * Call this BEFORE setupViewPortForSVG so the legend is captured inside the
 * computed viewBox.
 */
export const insertLegend = (
  svg: Selection<SVGSVGElement, unknown, Element | null, unknown>,
  legendItems: C4LegendItem[],
  config: MermaidConfig
): void => {
  if (!legendItems || legendItems.length === 0) {
    return;
  }

  const background = config.themeVariables?.background ?? '#ffffff';
  const swatchSize = 14;
  const rowHeight = 20;
  const gap = 24;
  const labelOffset = swatchSize + 8;

  // Anchor the legend at the bottom-left of the existing diagram content. The
  // current bounding box is read before the viewBox is (re)computed, so the
  // legend ends up just below the diagram. getBBox is unavailable in jsdom, so
  // fall back to the origin there (only affects unit tests, not the browser).
  let originX = 0;
  let originY = 0;
  try {
    const bbox = svg.node()?.getBBox();
    if (bbox) {
      originX = bbox.x;
      originY = bbox.y + bbox.height + gap;
    }
  } catch {
    // jsdom: getBBox not implemented; keep the origin fallback.
  }

  const group = svg
    .append('g')
    .attr('class', 'c4-legend')
    .attr('transform', `translate(${originX}, ${originY})`);

  // A bold "Legend" header above the rows; the rows then start one row down.
  group
    .append('text')
    .attr('class', 'c4-legend-title')
    .attr('x', 0)
    .attr('y', 0)
    .attr('font-weight', 'bold')
    .text('Legend');

  legendItems.forEach((item, index) => {
    const row = group.append('g').attr('transform', `translate(0, ${(index + 1) * rowHeight})`);
    row
      .append('rect')
      .attr('class', 'c4-legend-swatch')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', swatchSize)
      .attr('height', swatchSize)
      .attr('rx', 3)
      .attr('ry', 3)
      .attr('fill', background)
      .attr('stroke', item.color);
    row
      .append('text')
      .attr('class', 'c4-legend-label')
      .attr('x', labelOffset)
      .attr('y', swatchSize - 3)
      .attr('fill', item.color)
      .text(item.label);
  });
};

export default {
  insertLegend,
};
