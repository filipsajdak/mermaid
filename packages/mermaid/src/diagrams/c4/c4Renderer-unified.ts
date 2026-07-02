import { getConfig } from '../../diagram-api/diagramAPI.js';
import { log } from '../../logger.js';
import { getDiagramElement } from '../../rendering-util/insertElementsForSize.js';
import { getRegisteredLayoutAlgorithm, render } from '../../rendering-util/render.js';
import { setupViewPortForSVG } from '../../rendering-util/setupViewPortForSVG.js';
import utils from '../../utils.js';
import { buildLegendData, getData } from './c4LayoutData.js';
import { insertLegend } from './c4Legend.js';

/**
 * Renders a C4 diagram through the unified rendering pipeline (dagre by default,
 * other layout algorithms via registerLayoutLoaders). This is the sole renderer
 * for legacy C4 syntax: the legacy row-based renderer (c4Renderer.ts / svgDraw.ts)
 * has been removed.
 */
export const draw = async function (_text: string, id: string, _version: string, diag: any) {
  log.debug('Drawing C4 diagram (unified)', id);
  const config = getConfig();
  const { securityLevel, layout } = config;
  const c4Config = config.c4;

  const data4Layout = getData(diag.db, config);

  const svg = getDiagramElement(id, securityLevel);

  data4Layout.type = diag.type;
  data4Layout.layoutAlgorithm = getRegisteredLayoutAlgorithm(layout);
  // direction comes from db.getDirection() via getData(); default defensively.
  data4Layout.direction = data4Layout.direction ?? 'TB';
  data4Layout.markers = ['point'];
  data4Layout.diagramId = id;
  // Reserve vertical room above cluster children for the boundary title (needs the
  // dagre subGraphTitleMargin support; paired with the cluster-label-reserve fix).
  // Spacing MUST go through config.flowchart: the dagre layout resolves
  // nodesep/ranksep as config.nodeSpacing || config.flowchart.nodeSpacing ||
  // data4Layout.nodeSpacing, and the flowchart schema defaults always exist, so
  // a bare data4Layout.nodeSpacing/rankSpacing assignment is a silent no-op.
  // The rank gap is sized so multi-line relationship labels fit between ranks
  // instead of overlapping node text; a user nodeSpacing/rankSpacing in
  // frontmatter (top-level config) still wins.
  data4Layout.config = {
    ...data4Layout.config,
    flowchart: {
      ...(data4Layout.config?.flowchart ?? {}),
      subGraphTitleMargin: { top: 40, bottom: 0 },
      // Defaults resolve to 80/120 (c4ShapeMargin defaults to 50), matching
      // c4-beta so both syntaxes share one layout rhythm.
      nodeSpacing: (c4Config?.c4ShapeMargin ?? 50) + 30,
      rankSpacing: (c4Config?.c4ShapeMargin ?? 50) + 70,
    },
  };

  await render(data4Layout, svg);

  // Opt-in auto-generated legend (RFC #7844). Inserted before the viewBox is
  // computed so it is captured inside it.
  if (diag.db.getShowLegend?.()) {
    insertLegend(svg, buildLegendData(diag.db, config), config);
  }

  const padding = c4Config?.diagramMarginY ?? 10;
  utils.insertTitle(svg, 'c4TitleText', padding, diag.db.getTitle());
  setupViewPortForSVG(svg, padding, 'c4', c4Config?.useMaxWidth ?? true);
};

export default {
  draw,
};
