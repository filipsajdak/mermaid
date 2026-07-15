import { getConfig } from '../../diagram-api/diagramAPI.js';

const C4_ELEMENT_TYPES = [
  'person',
  'system',
  'system_db',
  'system_queue',
  'container',
  'container_db',
  'container_queue',
  'component',
  'component_db',
  'component_queue',
].flatMap((type) => [type, `external_${type}`]);

// Config values land in a stylesheet; strip characters that could terminate
// the declaration or the rule so a value stays a single CSS value.
const cssValue = (value) => String(value).replace(/[!;<>{}]/g, '');

// Per-element-type font rules from the c4 config (personFontFamily and friends).
const elementFontStyles = () => {
  const c4 = getConfig().c4 ?? {};
  return C4_ELEMENT_TYPES.map((type) => {
    const fontFamily = c4[`${type}FontFamily`];
    const fontSize = c4[`${type}FontSize`];
    const fontWeight = c4[`${type}FontWeight`];
    const props = [
      fontFamily ? `    font-family: ${cssValue(fontFamily)};` : '',
      fontSize
        ? `    font-size: ${typeof fontSize === 'number' ? `${fontSize}px` : cssValue(fontSize)};`
        : '',
      fontWeight ? `    font-weight: ${cssValue(fontWeight)};` : '',
    ].filter(Boolean);
    if (props.length === 0) {
      return '';
    }
    return `  .c4-shape.c4-${type} .label {\n${props.join('\n')}\n  }`;
  })
    .filter(Boolean)
    .join('\n');
};

const getStyles = (options) =>
  `.person {
    stroke: ${options.personBorder};
    fill: ${options.personBkg};
  }
${elementFontStyles()}

  /* C4 outline style (c4model.com): the element's identity colour is set inline
     per element (fill + stroke + color), and the label text inherits it. */
  .c4-shape .label,
  .c4-shape .label text {
    color: inherit;
    fill: currentColor;
  }
  /* Structurizr typography: bold name, smaller stereotype/type and description lines. */
  .c4-shape .label .c4-name {
    font-weight: bold;
  }
  .c4-shape .label .c4-type {
    font-size: 0.75em;
  }
  .c4-shape .label .c4-descr {
    font-size: 0.82em;
  }
  /* Outline boxes: a 2px coloured border over a light fill. */
  .c4-shape .basic,
  .c4-shape rect,
  .c4-shape path,
  .c4-shape circle,
  .c4-shape ellipse,
  .c4-shape line {
    stroke-width: 2px;
  }
`;

export default getStyles;
