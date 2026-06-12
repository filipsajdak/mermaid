import * as khroma from 'khroma';

export interface C4BetaStyleOptions {
  arrowheadColor: string;
  edgeLabelBackground: string;
  fontFamily: string;
  lineColor: string;
  mainBkg: string;
  nodeBorder: string;
  nodeTextColor: string;
  textColor: string;
  titleColor: string;
  strokeWidth?: string;
  c4PersonBkg: string;
  c4PersonBorder: string;
  c4SystemBkg: string;
  c4SystemBorder: string;
  c4ContainerBkg: string;
  c4ContainerBorder: string;
  c4ComponentBkg: string;
  c4ComponentBorder: string;
  c4ExternalBkg: string;
  c4ExternalBorder: string;
  c4BoundaryBorder: string;
  c4TextColor: string;
}

const fade = (color: string, opacity: number) => {
  // @ts-ignore TODO: incorrect types from khroma
  const channel = khroma.channel;

  const r = channel(color, 'r');
  const g = channel(color, 'g');
  const b = channel(color, 'b');

  // @ts-ignore incorrect types from khroma
  return khroma.rgba(r, g, b, opacity);
};

const getStyles = (options: C4BetaStyleOptions) =>
  `.label {
    font-family: ${options.fontFamily};
    color: ${options.nodeTextColor || options.textColor};
  }

  .label text,span {
    fill: ${options.nodeTextColor || options.textColor};
    color: ${options.nodeTextColor || options.textColor};
  }

  .node rect,
  .node path {
    fill: ${options.mainBkg};
    stroke: ${options.nodeBorder};
    stroke-width: ${options.strokeWidth ?? 1}px;
  }

  /* Default per-kind colors, driven by the theme. Tag styles emitted by the
   * db as inline styles still win over these class-based rules. */
  .c4-person rect,
  .c4-person path,
  .c4-person circle {
    fill: ${options.c4PersonBkg};
    stroke: ${options.c4PersonBorder};
  }
  .c4-softwareSystem rect,
  .c4-softwareSystem path,
  .c4-softwareSystem circle {
    fill: ${options.c4SystemBkg};
    stroke: ${options.c4SystemBorder};
  }
  .c4-container rect,
  .c4-container path,
  .c4-container circle {
    fill: ${options.c4ContainerBkg};
    stroke: ${options.c4ContainerBorder};
  }
  .c4-component rect,
  .c4-component path,
  .c4-component circle {
    fill: ${options.c4ComponentBkg};
    stroke: ${options.c4ComponentBorder};
  }
  /* Last so it wins over the kind rules for external elements. */
  .c4-external rect,
  .c4-external path,
  .c4-external circle {
    fill: ${options.c4ExternalBkg};
    stroke: ${options.c4ExternalBorder};
  }

  .c4-shape .label {
    color: ${options.c4TextColor};
  }
  .c4-shape .label text,
  .c4-shape .label span {
    fill: ${options.c4TextColor};
    color: ${options.c4TextColor};
  }
  .c4-shape .label small {
    font-size: 0.75em;
  }

  .c4-external rect,
  .c4-external path,
  .c4-external circle {
    fill: #999999;
    stroke: #8A8A8A;
  }

  path.c4-rel {
    fill: none;
    stroke: ${options.lineColor};
  }

  .arrowheadPath {
    fill: ${options.arrowheadColor};
  }

  .edgeLabel {
    background-color: ${options.edgeLabelBackground};
    p {
      background-color: ${options.edgeLabelBackground};
    }
    rect {
      opacity: 0.5;
      background-color: ${options.edgeLabelBackground};
      fill: ${options.edgeLabelBackground};
    }
    text-align: center;
  }

  /* For html labels only */
  .labelBkg {
    background-color: ${fade(options.edgeLabelBackground, 0.5)};
  }

  .cluster rect {
    fill: none;
    stroke: ${options.c4BoundaryBorder};
    stroke-dasharray: 7 7;
    stroke-width: 1px;
  }

  .cluster small {
    font-size: 0.75em;
    opacity: 0.85;
  }

  .cluster text {
    fill: ${options.titleColor};
  }

  .cluster span {
    color: ${options.titleColor};
  }

  .c4-instances {
    font-size: 0.75em;
    font-weight: bold;
    opacity: 0.7;
  }

  .c4-legend text {
    font-family: ${options.fontFamily};
    font-size: 12px;
    fill: ${options.textColor};
  }

  .c4TitleText {
    text-anchor: middle;
    font-size: 18px;
    fill: ${options.textColor};
  }
`;

export default getStyles;
