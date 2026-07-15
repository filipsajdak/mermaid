const getStyles = (options) =>
  `.person {
    stroke: ${options.personBorder};
    fill: ${options.personBkg};
  }

  /* C4 outline style (c4model.com): the element's identity colour is set inline
     per element (fill + stroke + color), and the label text inherits it. */
  .c4-shape .label,
  .c4-shape .label text {
    color: inherit;
    fill: currentColor;
  }
  /* Structurizr typography: bold name, smaller stereotype/type and description lines.
     The tspan selector is needed for the weight: each created tspan carries a
     font-weight presentation attribute, which inherited values do not override. */
  .c4-shape .label .c4-name tspan {
    font-weight: bold;
  }
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
`;

export default getStyles;
