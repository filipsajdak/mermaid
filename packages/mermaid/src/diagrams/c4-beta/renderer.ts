import { getConfig } from '../../diagram-api/diagramAPI.js';
import type { DiagramRenderer, DrawDefinition, SVG } from '../../diagram-api/types.js';
import { log } from '../../logger.js';
import { getDiagramElement } from '../../rendering-util/insertElementsForSize.js';
import { getRegisteredLayoutAlgorithm, render } from '../../rendering-util/render.js';
import { setupViewPortForSVG } from '../../rendering-util/setupViewPortForSVG.js';
import utils from '../../utils.js';
import type { C4BetaDB } from './db.js';
import type { C4BetaLegendItem } from './types.js';

const LEGEND_ROW_HEIGHT = 18;
const LEGEND_SWATCH_SIZE = 12;

/**
 * Appends the auto-generated legend below the bottom-left corner of the
 * rendered diagram as plain SVG (no layout engine involvement). Must run
 * before setupViewPortForSVG so the viewBox includes the legend.
 */
const insertLegend = (svg: SVG, items: C4BetaLegendItem[]) => {
  if (items.length === 0) {
    return;
  }
  const diagramBounds = svg.node()!.getBBox();
  const legend = svg.append('g').attr('class', 'c4-legend');
  legend.append('text').attr('x', 0).attr('y', 0).attr('font-weight', 'bold').text('Legend');
  items.forEach((item, index) => {
    const rowBaseline = (index + 1) * LEGEND_ROW_HEIGHT;
    legend
      .append('rect')
      .attr('x', 0)
      .attr('y', rowBaseline - LEGEND_SWATCH_SIZE)
      .attr('width', LEGEND_SWATCH_SIZE)
      .attr('height', LEGEND_SWATCH_SIZE)
      .attr('fill', item.fill ?? 'none')
      .attr('stroke', item.stroke ?? item.fill ?? 'none');
    legend
      .append('text')
      .attr('x', LEGEND_SWATCH_SIZE + 6)
      .attr('y', rowBaseline)
      .text(item.label);
  });
  const legendBounds = legend.node()!.getBBox();
  legend.attr(
    'transform',
    `translate(${diagramBounds.x}, ${
      diagramBounds.y + diagramBounds.height + LEGEND_ROW_HEIGHT - legendBounds.y
    })`
  );
};

const draw: DrawDefinition = async function (_text, id, _version, diag) {
  log.debug('Drawing c4-beta diagram', id);
  const { securityLevel, layout, c4beta: conf } = getConfig();
  const db = diag.db as C4BetaDB;

  // getData extracts the parsed structure into the unified Layout data format.
  const data4Layout = db.getData();

  // Create the root SVG
  const svg = getDiagramElement(id, securityLevel);

  data4Layout.type = diag.type;
  data4Layout.layoutAlgorithm = getRegisteredLayoutAlgorithm(layout);
  data4Layout.direction = db.getDirection();
  // Extra node spacing keeps sibling deployment-node headers from overlapping.
  data4Layout.nodeSpacing = 80;
  data4Layout.rankSpacing = 60;
  // Reserve vertical space for the (multi-line) deployment-node header labels so
  // they do not overlap nested content. The dagre layout reads this from the
  // per-diagram config; clusters otherwise reserve no space for their label.
  data4Layout.config.flowchart = {
    ...data4Layout.config.flowchart,
    subGraphTitleMargin: { top: 40, bottom: 0 },
  };
  data4Layout.markers = ['point'];
  data4Layout.diagramId = id;

  await render(data4Layout, svg);

  if (db.isLegendEnabled()) {
    insertLegend(svg, db.getLegendItems());
  }

  utils.insertTitle(svg, 'c4TitleText', 30, db.getDiagramTitle());
  setupViewPortForSVG(svg, conf?.diagramPadding ?? 10, 'c4beta', conf?.useMaxWidth ?? true);
};

export const renderer: DiagramRenderer = { draw };
