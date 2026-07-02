import { getConfig } from '../../diagram-api/diagramAPI.js';
import type { DiagramRenderer, DrawDefinition } from '../../diagram-api/types.js';
import { log } from '../../logger.js';
import { getDiagramElement } from '../../rendering-util/insertElementsForSize.js';
import { getRegisteredLayoutAlgorithm, render } from '../../rendering-util/render.js';
import { setupViewPortForSVG } from '../../rendering-util/setupViewPortForSVG.js';
import utils from '../../utils.js';
import type { C4BetaDB } from './db.js';
import { insertLegend } from '../c4/c4Legend.js';
import { resolveIdentity } from '../c4/c4Palette.js';

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
  // Reserve vertical space for the (multi-line) deployment-node header labels so
  // they do not overlap nested content, and set the layout rhythm. Spacing MUST
  // go through config.flowchart: the dagre layout resolves nodesep/ranksep as
  // config.nodeSpacing || config.flowchart.nodeSpacing || data4Layout.nodeSpacing,
  // and the flowchart schema defaults always exist, so a bare
  // data4Layout.nodeSpacing/rankSpacing assignment is a silent no-op. The rank
  // gap is sized so multi-line relationship labels fit between ranks instead of
  // overlapping node text; a user nodeSpacing/rankSpacing in frontmatter
  // (top-level config) still wins.
  data4Layout.config.flowchart = {
    ...data4Layout.config.flowchart,
    subGraphTitleMargin: { top: 40, bottom: 0 },
    nodeSpacing: 80,
    rankSpacing: 120,
  };
  data4Layout.markers = ['point'];
  data4Layout.diagramId = id;

  await render(data4Layout, svg);

  // Raise relationship labels above the element nodes. The shared layout draws
  // nodes last, so a label that overlaps a node (common in tight vertically
  // stacked container/deployment diagrams) would be painted behind it and become
  // invisible. Re-appending each edgeLabels group after its sibling nodes (this
  // also covers nested-cluster sub-graphs) keeps such labels readable over their
  // opaque background.
  svg.selectAll('g.edgeLabels').each(function (this: SVGGElement) {
    this.parentNode?.appendChild(this);
  });

  if (db.isLegendEnabled()) {
    // Map c4-beta legend items onto the shared C4LegendItem shape (outline colour).
    // Element-kind rows resolve their colour from the active theme so the legend
    // swatches match the rendered elements; tag rows keep their explicit colour.
    const themeVariables = getConfig().themeVariables;
    const legendItems = db.getLegendItems().map((i) => ({
      label: i.label,
      color:
        i.stroke ??
        i.fill ??
        resolveIdentity(i.external ? 'external' : (i.kind ?? ''), themeVariables),
    }));
    insertLegend(svg, legendItems, getConfig());
  }

  utils.insertTitle(svg, 'c4TitleText', 30, db.getDiagramTitle());
  setupViewPortForSVG(svg, conf?.diagramPadding ?? 10, 'c4beta', conf?.useMaxWidth ?? true);
};

export const renderer: DiagramRenderer = { draw };
