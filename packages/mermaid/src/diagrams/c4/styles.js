const getStyles = (options) =>
  `.person {
    stroke: ${options.personBorder};
    fill: ${options.personBkg};
  }

  /* Unified renderer DOM wiring (node / label) - the shapes/clusters are drawn by
     the shared rendering-elements, which emit .node/.label/.cluster classes. */
  .label {
    font-family: ${options.fontFamily};
    color: ${options.nodeTextColor || options.textColor};
  }
  .label text,
  .label span {
    fill: ${options.nodeTextColor || options.textColor};
    color: ${options.nodeTextColor || options.textColor};
  }
  .node rect,
  .node circle,
  .node path {
    fill: ${options.mainBkg};
    stroke: ${options.nodeBorder};
    stroke-width: 1px;
  }
  .node .label {
    text-align: center;
  }
  .node.clickable {
    cursor: pointer;
  }

  /* C4 outline style (c4model.com): the element's identity colour is set inline
     per element (fill + stroke + color), and the label text inherits it. */
  .c4-shape .label,
  .c4-shape .label text,
  .c4-shape .label span,
  .c4-shape .label p {
    color: inherit;
    fill: currentColor;
  }
  .c4-shape .label small {
    font-size: 0.75em;
  }
  /* Structurizr typography: a smaller stereotype/type line and a smaller description.
     NOTE: no \`opacity\` here on purpose - opacity < 1 promotes the span to its own
     compositing layer, which (because the shape is drawn at the origin and then
     translated into place) keeps the stale origin position and paints the line in the
     top-left corner. Keep the stereotype muted via colour, not opacity. */
  .c4-shape .label .c4-type {
    font-size: 0.75em;
  }
  .c4-shape .label .c4-descr {
    font-size: 0.82em;
  }
  /* Outline boxes: a 2px coloured border over a light fill, generously rounded. */
  .c4-shape .basic,
  .c4-shape rect,
  .c4-shape path,
  .c4-shape circle,
  .c4-shape ellipse,
  .c4-shape line {
    stroke-width: 2px;
  }
  .c4-shape rect {
    rx: 12px;
    ry: 12px;
  }

  /* Relationships: dashed lines with an arrowhead, as on c4model.com. */
  .edgePaths .path,
  path.c4-rel {
    stroke: ${options.lineColor ?? '#666666'};
    fill: none;
    stroke-width: 1.5px;
    stroke-dasharray: 6 4;
  }
  .edgePaths .marker {
    fill: ${options.lineColor ?? '#666666'};
    stroke: ${options.lineColor ?? '#666666'};
  }
  /* Relationship labels: smaller, on an opaque background so they stay legible over lines. */
  .edgeLabel {
    font-size: 0.85em;
    background-color: ${options.background ?? '#ffffff'};
  }
  .edgeLabel .label foreignObject {
    overflow: visible;
  }
  .edgeLabel rect {
    fill: ${options.background ?? '#ffffff'};
    opacity: 1;
  }

  /* C4 boundaries are light dashed, mostly-transparent clusters. */
  .cluster rect {
    fill: none;
    stroke: ${options.nodeBorder};
    stroke-dasharray: 5 5;
    stroke-width: 1px;
    stroke-opacity: 0.6;
  }
  .cluster .cluster-label {
    font-family: ${options.fontFamily};
    text-anchor: start;
  }
  .cluster text {
    fill: ${options.titleColor};
  }
  .cluster span {
    color: ${options.titleColor};
  }

  .c4TitleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${options.textColor};
    font-family: ${options.fontFamily};
  }

  /* Auto-generated legend (RFC #7844): swatches in the element identity colour
     over a white fill, with a matching label, mirroring the outline style. */
  .c4-legend {
    font-family: ${options.fontFamily};
    font-size: 0.85em;
  }
  .c4-legend .c4-legend-swatch {
    stroke-width: 2px;
  }
  .c4-legend .c4-legend-label {
    dominant-baseline: middle;
  }
`;

export default getStyles;
