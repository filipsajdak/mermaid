import { hsl } from 'd3';
import type { MermaidConfig } from '../../config.type.js';
import type { ShapeID } from '../../rendering-util/rendering-elements/shapes.js';
import type { Edge, LayoutData, Node } from '../../rendering-util/types.js';

/**
 * Adapter that converts the legacy C4 db state (c4ShapeArray / boundaries / rels)
 * into the unified renderer's LayoutData format. Lives in a separate file so the
 * legacy c4Db keeps its exact shape (and so the JS to TS conversion in #7829 is
 * not duplicated here).
 */

interface C4Text {
  text: string;
}

interface C4Shape {
  alias: string;
  label: C4Text;
  typeC4Shape: C4Text;
  parentBoundary: string;
  techn?: C4Text;
  descr?: C4Text;
  // Optional deployment instance count, e.g. `$instances="3"` on a
  // SoftwareSystemInstance / ContainerInstance. The db stores it as `{ text }`
  // when it lands in the descr/techn slot, or as a raw string via the generic
  // attribute path, so accept both forms.
  instances?: C4Text | string;
  bgColor?: string;
  fontColor?: string;
  borderColor?: string;
  link?: string;
  shape?: string;
  sprite?: string;
  tags?: string;
  shadowing?: string;
  legendText?: string;
}

interface C4Boundary {
  alias: string;
  label: C4Text;
  type: C4Text;
  parentBoundary: string;
  descr?: C4Text;
  nodeType?: string;
  bgColor?: string;
  fontColor?: string;
  borderColor?: string;
  link?: string | null;
}

interface C4Rel {
  type: string;
  from: string;
  to: string;
  label: C4Text;
  techn?: C4Text;
  descr?: C4Text;
  textColor?: string;
  lineColor?: string;
  tags?: string;
}

interface C4ElementTag {
  tagName: string;
  bgColor?: string;
  fontColor?: string;
  borderColor?: string;
  shape?: string;
}

interface C4RelTag {
  tagName: string;
  textColor?: string;
  lineColor?: string;
}

interface C4Db {
  getC4ShapeArray: (parentBoundary?: string) => C4Shape[];
  getBoundaries: (parentBoundary?: string) => C4Boundary[];
  getRels: () => C4Rel[];
  getElementTags: () => C4ElementTag[];
  getRelTags: () => C4RelTag[];
  getC4Type: () => string | undefined;
  getDirection: () => string;
}

const QUEUE_SHAPES = new Set([
  'system_queue',
  'external_system_queue',
  'container_queue',
  'external_container_queue',
  'component_queue',
  'external_component_queue',
]);

const DB_SHAPES = new Set([
  'system_db',
  'external_system_db',
  'container_db',
  'external_container_db',
  'component_db',
  'external_component_db',
]);

// Structurizr-style shape keywords accepted via $shape, $sprite or $tags.
const SHAPE_KEYWORDS: Record<string, ShapeID> = {
  person: 'c4-person',
  box: 'rounded',
  rounded: 'rounded',
  folder: 'c4-folder',
  directory: 'c4-folder',
  cylinder: 'c4-database',
  database: 'c4-database',
  db: 'c4-database',
  queue: 'c4-queue',
  pipe: 'c4-queue',
  bucket: 'c4-bucket',
  blob: 'c4-bucket',
  s3: 'c4-bucket',
  terminal: 'c4-terminal',
  console: 'c4-terminal',
  browser: 'c4-browser',
  spa: 'c4-browser',
  component: 'fr-rect',
};

const keywordShape = (value: string | undefined): ShapeID | undefined =>
  value ? SHAPE_KEYWORDS[value.toLowerCase()] : undefined;

// The unified renderer's icon shape (reads node.icon and resolves it against the
// icon packs the user registered via registerIconPacks). Used when a $sprite or
// $shape is not a built-in keyword but an icon name (e.g. "logos:aws-lambda").
const ICON_SHAPE: ShapeID = 'iconRounded';

// A non-empty $shape/$sprite that is NOT a recognised keyword is treated as an
// icon name; returns the trimmed name, or undefined when empty / keyword.
const iconName = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && !keywordShape(trimmed) ? trimmed : undefined;
};

/** The render shape for a C4 element, plus an optional icon name for the icon shape. */
interface ResolvedShape {
  shape: ShapeID;
  icon?: string;
}

/**
 * Resolves the render shape for a C4 element: explicit $shape/$sprite first
 * (a built-in keyword maps to a c4 shape; any other non-empty value is treated
 * as an icon name rendered via the unified icon shape), then a $tags token
 * (a defined AddElementTag shape, then a built-in keyword), then the element type.
 */
const resolveNodeShape = (
  shape: C4Shape,
  elementTags: Map<string, C4ElementTag>
): ResolvedShape => {
  const explicit = keywordShape(shape.shape) ?? keywordShape(shape.sprite);
  if (explicit) {
    return { shape: explicit };
  }
  // A non-keyword $shape/$sprite is an icon name (e.g. "logos:aws-lambda"): render
  // the element with the unified icon shape. $sprite is the icon-bearing attribute,
  // so it wins over $shape when both carry a non-keyword value.
  const icon = iconName(shape.sprite) ?? iconName(shape.shape);
  if (icon) {
    return { shape: ICON_SHAPE, icon };
  }
  if (shape.tags) {
    for (const raw of shape.tags.split(',')) {
      const tag = raw.trim();
      const definedShape = keywordShape(elementTags.get(tag)?.shape);
      const tagged = definedShape ?? keywordShape(tag);
      if (tagged) {
        return { shape: tagged };
      }
    }
  }
  const typeC4Shape = shape.typeC4Shape.text;
  if (typeC4Shape === 'person' || typeC4Shape === 'external_person') {
    return { shape: 'c4-person' };
  }
  if (DB_SHAPES.has(typeC4Shape)) {
    return { shape: 'c4-database' };
  }
  if (QUEUE_SHAPES.has(typeC4Shape)) {
    return { shape: 'c4-queue' };
  }
  return { shape: 'rounded' };
};

const STEREOTYPE_NAMES: Record<string, string> = {
  person: 'Person',
  system: 'Software System',
  container: 'Container',
  component: 'Component',
  // Structurizr deployment instances (rendered as approximated element boxes).
  system_instance: 'Software System Instance',
  container_instance: 'Container Instance',
};

// Structurizr-style stereotype, e.g. `Software System` for system / system_db / external_system.
const stereotypeLabel = (typeC4Shape: string): string => {
  const base = typeC4Shape.replace(/^external_/, '').replace(/_(db|queue)$/, '');
  return STEREOTYPE_NAMES[base] ?? base.replace(/_/g, ' ');
};

// Deployment instances have no palette entry of their own; they borrow their
// defining element's identity colour (an instance of a system looks like the
// system, an instance of a container like the container).
const PALETTE_BASE: Record<string, string> = {
  system_instance: 'system',
  container_instance: 'container',
};
const paletteKey = (typeC4Shape: string): string => PALETTE_BASE[typeC4Shape] ?? typeC4Shape;

const isExternal = (typeC4Shape: string): boolean => typeC4Shape.startsWith('external_');

// An element carries a drop shadow when UpdateElementStyle set `$shadowing` to a
// truthy value (the parser hands over a string; treat the literal 'false' as off).
const hasShadow = (shadowing: string | undefined): boolean =>
  shadowing !== undefined && shadowing !== '' && shadowing !== 'false';

const escapeHtml = (txt: string): string =>
  txt.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const buildNodeLabel = (shape: C4Shape): string => {
  const stereotype = stereotypeLabel(shape.typeC4Shape.text);
  const type = shape.techn?.text
    ? `[${escapeHtml(stereotype)}: ${escapeHtml(shape.techn.text)}]`
    : `[${escapeHtml(stereotype)}]`;
  const lines: string[] = [
    `<b>${escapeHtml(shape.label.text)}</b>`,
    `<span class="c4-type">${type}</span>`,
  ];
  if (shape.descr?.text) {
    lines.push(`<span class="c4-descr">${escapeHtml(shape.descr.text)}</span>`);
  }
  // Deployment instance count (e.g. `$instances="3"`) shown as a small annotation.
  const instances = typeof shape.instances === 'string' ? shape.instances : shape.instances?.text;
  if (instances) {
    lines.push(`<span class="c4-instances">(x${escapeHtml(instances)})</span>`);
  }
  return lines.join('<br/>');
};

const buildBoundaryLabel = (boundary: C4Boundary): string => {
  const lines: string[] = [`<b>${escapeHtml(boundary.label.text)}</b>`];
  const type = boundary.type?.text;
  const implicit = type?.toLowerCase();
  if (type && implicit !== 'system' && implicit !== 'container') {
    lines.push(`<span class="c4-type">[${escapeHtml(type)}]</span>`);
  }
  return lines.join('<br/>');
};

const buildEdgeLabel = (rel: C4Rel): string => {
  const lines: string[] = [`<b>${escapeHtml(rel.label.text)}</b>`];
  if (rel.techn?.text) {
    lines.push(`<small><i>[${escapeHtml(rel.techn.text)}]</i></small>`);
  }
  if (rel.descr?.text) {
    lines.push(`<small>${escapeHtml(rel.descr.text)}</small>`);
  }
  return lines.join('<br/>');
};

const elementCssStyles = (
  element: Pick<C4Shape, 'bgColor' | 'fontColor' | 'borderColor'>
): string[] => {
  const styles: string[] = [];
  if (element.bgColor) {
    styles.push(`fill:${element.bgColor}`);
  }
  if (element.borderColor) {
    styles.push(`stroke:${element.borderColor}`);
  }
  if (element.fontColor) {
    styles.push(`color:${element.fontColor}`);
  }
  return styles;
};

/**
 * Fill/border/text styles contributed by an element's `$tags` (comma-separated)
 * that match a defined `AddElementTag`. Applied after the palette outline and
 * before per-element `UpdateElementStyle`, so an explicit element style wins.
 */
const elementTagStyles = (
  tags: string | undefined,
  elementTags: Map<string, C4ElementTag>
): string[] => {
  const styles: string[] = [];
  if (!tags) {
    return styles;
  }
  for (const raw of tags.split(',')) {
    const tag = elementTags.get(raw.trim());
    if (!tag) {
      continue;
    }
    if (tag.bgColor) {
      styles.push(`fill:${tag.bgColor}`);
    }
    if (tag.borderColor) {
      styles.push(`stroke:${tag.borderColor}`);
    }
    if (tag.fontColor) {
      styles.push(`color:${tag.fontColor}`);
    }
  }
  return styles;
};

/**
 * Line/text styles contributed by a relationship's `$tags` that match a defined
 * `AddRelTag`. Applied before per-relationship `UpdateRelStyle` so it wins.
 */
const relTagStyles = (
  tags: string | undefined,
  relTags: Map<string, C4RelTag>
): { style: string[]; labelStyle: string[] } => {
  const style: string[] = [];
  const labelStyle: string[] = [];
  if (tags) {
    for (const raw of tags.split(',')) {
      const tag = relTags.get(raw.trim());
      if (!tag) {
        continue;
      }
      if (tag.lineColor) {
        style.push(`stroke:${tag.lineColor}`);
      }
      if (tag.textColor) {
        labelStyle.push(`color:${tag.textColor}`);
      }
    }
  }
  return { style, labelStyle };
};

// Clamp a palette color dark enough to read as text/border on a light fill.
const ensureReadable = (color: string): string => {
  const c = hsl(color);
  if (Number.isNaN(c.l)) {
    return color;
  }
  c.l = Math.min(c.l, 0.42);
  return c.formatHex();
};

// Neutral identity color used when a kind has no palette entry (e.g. deployment
// nodes) or its `<type>_bg_color` is unset.
const DEFAULT_IDENTITY = '#6b6b6b';

// Outline identity color for an element type: the readable palette color used as
// border + text. Mirrors configColorStyles' stroke/text choice.
const identityColor = (typeC4Shape: string, c4Config: Record<string, any>): string => {
  const bg = c4Config[`${paletteKey(typeC4Shape)}_bg_color`];
  return typeof bg === 'string' ? ensureReadable(bg) : DEFAULT_IDENTITY;
};

/**
 * Outline styling for an element type: the c4 palette color becomes the border
 * and text (the element's identity), over a light fill, as on c4model.com.
 */
const configColorStyles = (
  typeC4Shape: string,
  c4Config: Record<string, any>,
  background: string
): string[] => {
  const styles: string[] = [`fill:${background}`];
  const bg = c4Config[`${paletteKey(typeC4Shape)}_bg_color`];
  if (typeof bg === 'string') {
    const identity = ensureReadable(bg);
    styles.push(`stroke:${identity}`, `color:${identity}`);
  }
  return styles;
};

export const getData = (db: C4Db, config: MermaidConfig): LayoutData => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const c4Config: Record<string, any> = config.c4 ?? {};
  const background = config.themeVariables?.background ?? '#ffffff';
  // Generous internal padding so labels never crowd the element borders.
  const shapePadding = typeof c4Config.c4ShapePadding === 'number' ? c4Config.c4ShapePadding : 20;
  // C4Dynamic numbers each relationship in declaration order (1: ..., 2: ...).
  const isDynamic = db.getC4Type() === 'C4Dynamic';

  // Named styles defined via AddElementTag / AddRelTag, keyed by tag name.
  const elementTagMap = new Map(db.getElementTags().map((tag) => [tag.tagName, tag]));
  const relTagMap = new Map(db.getRelTags().map((tag) => [tag.tagName, tag]));

  const boundaries = db.getBoundaries().filter((boundary) => boundary.alias !== 'global');
  const boundaryAliases = new Set(boundaries.map((boundary) => boundary.alias));

  const parentIdOf = (parentBoundary: string): string | undefined =>
    parentBoundary && parentBoundary !== 'global' && boundaryAliases.has(parentBoundary)
      ? parentBoundary
      : undefined;

  for (const boundary of boundaries) {
    const isDeploymentNode = boundary.nodeType !== undefined;
    nodes.push({
      id: boundary.alias,
      label: buildBoundaryLabel(boundary),
      isGroup: true,
      shape: 'rect',
      parentId: parentIdOf(boundary.parentBoundary),
      cssClasses: isDeploymentNode ? 'c4-boundary c4-deployment-node' : 'c4-boundary',
      cssStyles: elementCssStyles(boundary),
      link: boundary.link ?? undefined,
      look: config.look,
    });
  }

  for (const shape of db.getC4ShapeArray()) {
    const type = shape.typeC4Shape.text;
    const { shape: nodeShape, icon } = resolveNodeShape(shape, elementTagMap);
    nodes.push({
      id: shape.alias,
      label: buildNodeLabel(shape),
      isGroup: false,
      shape: nodeShape,
      icon,
      parentId: parentIdOf(shape.parentBoundary),
      padding: shapePadding,
      cssClasses: `c4-shape c4-${type}${isExternal(type) ? ' c4-external' : ''}${
        hasShadow(shape.shadowing) ? ' c4-shadow' : ''
      }`,
      cssStyles: [
        ...configColorStyles(type, c4Config, background),
        ...elementTagStyles(shape.tags, elementTagMap),
        ...elementCssStyles(shape),
      ],
      link: shape.link,
      look: config.look,
    });
  }

  db.getRels().forEach((rel, index) => {
    const isBidirectional = rel.type === 'birel';
    const isBack = rel.type === 'rel_b';
    // C4Dynamic prepends a 1-based step number to the relationship label.
    const labelRel = isDynamic
      ? { ...rel, label: { ...rel.label, text: `${index + 1}: ${rel.label.text}` } }
      : rel;
    const { style: tagStyle, labelStyle: tagLabelStyle } = relTagStyles(rel.tags, relTagMap);
    const style: string[] = [...tagStyle];
    const labelStyle: string[] = [...tagLabelStyle];
    if (rel.lineColor) {
      style.push(`stroke:${rel.lineColor}`);
    }
    if (rel.textColor) {
      labelStyle.push(`color:${rel.textColor}`);
    }
    edges.push({
      id: `c4-edge-${index}-${rel.from}-${rel.to}`,
      start: rel.from,
      end: rel.to,
      label: buildEdgeLabel(labelRel),
      arrowTypeStart: isBidirectional || isBack ? 'arrow_point' : undefined,
      arrowTypeEnd: isBack ? undefined : 'arrow_point',
      style,
      labelStyle,
      classes: 'c4-rel',
      // Straight lines matching c4model.com. labelpos 'c' centers the label on
      // the line instead of dagre's default side offset.
      curve: 'linear',
      labelpos: 'c',
      look: config.look,
    });
  });

  return {
    nodes,
    edges,
    config,
    direction: db.getDirection(),
  };
};

/** One auto-generated legend row: a display label and its outline color. */
export interface C4LegendItem {
  label: string;
  color: string;
}

// Stable display order for the legend categories (RFC #7844 key).
const LEGEND_ORDER: Record<string, number> = {
  person: 0,
  system: 1,
  container: 2,
  component: 3,
  database: 4,
  queue: 5,
  external: 6,
  deploymentNode: 7,
};

/**
 * Collapses an element type to its legend category. External elements share the
 * grey "External" row, database/queue variants share their shape rows, and the
 * remaining types keep their Structurizr stereotype name.
 */
const legendCategory = (typeC4Shape: string): { key: string; label: string } => {
  if (DB_SHAPES.has(typeC4Shape)) {
    return { key: 'database', label: 'Database' };
  }
  if (QUEUE_SHAPES.has(typeC4Shape)) {
    return { key: 'queue', label: 'Queue' };
  }
  if (isExternal(typeC4Shape)) {
    return { key: 'external', label: 'External' };
  }
  const base = typeC4Shape.replace(/_(db|queue)$/, '');
  return { key: base, label: STEREOTYPE_NAMES[base] ?? stereotypeLabel(typeC4Shape) };
};

/**
 * Derives the legend entries for a diagram: one row per DISTINCT element kind in
 * use (person, software system, container, component, database, queue, external
 * and deployment node, as applicable), each with its Structurizr display label
 * and its outline color from the C4 palette. Rows are ordered stably so the
 * legend is deterministic regardless of declaration order.
 */
export const buildLegendData = (db: C4Db, config: MermaidConfig): C4LegendItem[] => {
  const c4Config: Record<string, any> = config.c4 ?? {};
  const seen = new Map<string, C4LegendItem & { order: number }>();
  // Custom legend rows contributed by an element's `UpdateElementStyle($legendText)`.
  // De-duped by text and ordered after the kind rows (1000+ keeps them last).
  // NOTE: `$legendSprite` (a per-element legend icon) is deferred until the C4
  // renderer gains icon-pack support; only the legend *text* is honoured here.
  const custom = new Map<string, C4LegendItem & { order: number }>();
  let customOrder = 0;

  for (const shape of db.getC4ShapeArray()) {
    const type = shape.typeC4Shape.text;
    if (shape.legendText) {
      if (!custom.has(shape.legendText)) {
        custom.set(shape.legendText, {
          label: shape.legendText,
          color: identityColor(type, c4Config),
          order: 1000 + customOrder++,
        });
      }
      continue;
    }
    const { key, label } = legendCategory(type);
    if (seen.has(key)) {
      continue;
    }
    seen.set(key, { label, color: identityColor(type, c4Config), order: LEGEND_ORDER[key] ?? 99 });
  }

  const hasDeploymentNode = db.getBoundaries().some((boundary) => boundary.nodeType !== undefined);
  if (hasDeploymentNode && !seen.has('deploymentNode')) {
    seen.set('deploymentNode', {
      label: 'Deployment Node',
      color: DEFAULT_IDENTITY,
      order: LEGEND_ORDER.deploymentNode,
    });
  }

  return [...seen.values(), ...custom.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ label, color }) => ({ label, color }));
};
