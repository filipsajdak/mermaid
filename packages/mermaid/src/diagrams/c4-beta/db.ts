import { getConfig } from '../../config.js';
import type { DiagramDB } from '../../diagram-api/types.js';
import { log } from '../../logger.js';
import type { Edge, LayoutData, Node } from '../../rendering-util/types.js';
import { keywordShape } from '../c4/c4ShapeVocabulary.js';
import { resolveIdentity } from '../c4/c4Palette.js';
import {
  buildElementLabel as buildSharedElementLabel,
  buildRelationshipLabel as buildSharedRelationshipLabel,
  escapeHtml,
} from '../c4/c4Labels.js';
import {
  clear as commonClear,
  getAccDescription,
  getAccTitle,
  getDiagramTitle,
  setAccDescription,
  setAccTitle,
  setDiagramTitle,
} from '../common/commonDb.js';
import type {
  C4BetaElement,
  C4BetaLegendItem,
  C4BetaRelationship,
  C4BetaTagStyle,
  C4DiagramKind,
  C4Direction,
  C4ElementKind,
  C4LinePattern,
} from './types.js';

// Element kinds that get a legend swatch (those with a theme identity colour).
// Groups and deployment nodes render as unfilled boundaries, so they are
// omitted. The swatch colour itself is resolved from the theme at render time.
const LEGEND_KINDS = new Set<C4ElementKind>([
  'person',
  'softwareSystem',
  'container',
  'component',
  'infrastructureNode',
]);

// Human-readable C4 type names rendered as the element stereotype label.
// `group` has no stereotype: it is a plain boundary, not a C4 type.
const ELEMENT_DISPLAY_NAMES: Partial<Record<C4ElementKind, string>> = {
  person: 'Person',
  softwareSystem: 'Software System',
  container: 'Container',
  component: 'Component',
  deploymentNode: 'Deployment Node',
  infrastructureNode: 'Infrastructure Node',
};
// Element kinds that are unexpected for a given diagram kind. They still
// render (forgiving WYSIWYG), but we warn so authors can spot mistakes.
const UNEXPECTED_ELEMENT_KINDS: Record<C4DiagramKind, C4ElementKind[]> = {
  // A System Landscape is a wider-scope context view: same element expectations.
  landscape: ['container', 'component', 'deploymentNode'],
  context: ['container', 'component', 'deploymentNode'],
  container: ['component', 'deploymentNode'],
  component: ['deploymentNode'],
  dynamic: ['deploymentNode'],
  deployment: ['person'],
};

const LINE_PATTERNS = new Set<string>(['solid', 'dashed', 'dotted']);

const isLinePattern = (value: string): value is C4LinePattern => LINE_PATTERNS.has(value);

// The element label uses the shared C4 builder so c4-beta and legacy C4 render the
// same `<b>Name</b>` / `[Stereotype: tech]` / description markup (one visual language).
const buildElementLabel = (element: C4BetaElement): string =>
  buildSharedElementLabel({
    name: element.name,
    stereotype: ELEMENT_DISPLAY_NAMES[element.kind] ?? element.kind,
    technology: element.technology,
    description: element.description,
  });

const buildRelationshipLabel = (
  relationship: C4BetaRelationship,
  step?: number
): string | undefined => {
  if (!relationship.description && step === undefined) {
    return undefined;
  }
  // The c4-beta relationship "label" is its (optionally step-numbered) description;
  // the shared builder escapes it and adds the `[technology]` line, so legacy C4 and
  // c4-beta render relationship labels identically.
  const labelParts: string[] = [];
  if (step !== undefined) {
    labelParts.push(`${step}.`);
  }
  if (relationship.description) {
    labelParts.push(relationship.description);
  }
  return buildSharedRelationshipLabel({
    label: labelParts.join(' '),
    technology: relationship.technology,
  });
};

/**
 * Derives the legend entries for a diagram: one entry per element kind in
 * use (external variants are listed separately, with their grey palette)
 * followed by one entry per user-defined style tag.
 */
export const buildLegendItems = (
  elements: C4BetaElement[],
  styles: Map<string, C4BetaTagStyle>
): C4BetaLegendItem[] => {
  const items: C4BetaLegendItem[] = [];
  const seenLabels = new Set<string>();
  for (const element of elements) {
    // `external` is a convention tag; external elements share the grey identity.
    const isExternal = element.tags.includes('external');
    if (!LEGEND_KINDS.has(element.kind)) {
      continue;
    }
    // Human-readable row label matching the element boxes ("Software System"),
    // not the raw grammar identifier ("softwareSystem").
    const displayName = ELEMENT_DISPLAY_NAMES[element.kind] ?? element.kind;
    const label = isExternal ? `External ${displayName}` : displayName;
    if (seenLabels.has(label)) {
      continue;
    }
    seenLabels.add(label);
    // Carry the kind only; the renderer resolves the outline swatch colour from
    // the active theme so the legend matches the rendered elements.
    items.push({ label, kind: element.kind, external: isExternal });
  }
  for (const [tag, style] of styles) {
    items.push({ label: tag, fill: style.fill, stroke: style.stroke ?? style.fill });
  }
  return items;
};

export class C4BetaDB implements DiagramDB {
  private elements: C4BetaElement[] = [];
  private relationships: C4BetaRelationship[] = [];
  private styles = new Map<string, C4BetaTagStyle>();
  private direction: C4Direction = 'TB';
  private kind: C4DiagramKind = 'context';
  private legendEnabled = true;

  public addElement(element: C4BetaElement) {
    this.elements.push(element);
  }

  public addRelationship(relationship: C4BetaRelationship) {
    this.relationships.push(relationship);
  }

  public getElements(): C4BetaElement[] {
    return this.elements;
  }

  public getRelationships(): C4BetaRelationship[] {
    return this.relationships;
  }

  public addStyle(tag: string, entries: { key: string; value: string }[]) {
    const style: C4BetaTagStyle = this.styles.get(tag) ?? {};
    for (const { key, value } of entries) {
      if (key === 'fill' || key === 'stroke' || key === 'color') {
        style[key] = value;
      } else if (key === 'shape' && value === 'cylinder') {
        style.shape = value;
      } else if (key === 'line' && isLinePattern(value)) {
        style.line = value;
      } else {
        log.warn(`c4-beta: unsupported style "${key}:${value}" for tag "${tag}"; ignoring it`);
      }
    }
    this.styles.set(tag, style);
  }

  public getStyles(): Map<string, C4BetaTagStyle> {
    return this.styles;
  }

  public setDirection(direction: C4Direction) {
    this.direction = direction;
  }

  public getDirection(): C4Direction {
    return this.direction;
  }

  public setKind(kind: C4DiagramKind) {
    this.kind = kind;
  }

  public getKind(): C4DiagramKind {
    return this.kind;
  }

  public setLegendEnabled(enabled: boolean) {
    this.legendEnabled = enabled;
  }

  public isLegendEnabled(): boolean {
    return this.legendEnabled;
  }

  public getLegendItems(): C4BetaLegendItem[] {
    return buildLegendItems(this.elements, this.styles);
  }

  private validateElements() {
    const unexpected = UNEXPECTED_ELEMENT_KINDS[this.kind];
    // Reference validation (forgiving, like the rest of this method): warn on
    // duplicate element ids (later nodes clobber earlier ones in the layout) and
    // on relationships whose endpoints were never declared (they render phantom
    // edges) - both are almost always authoring typos.
    const seenIds = new Set<string>();
    for (const element of this.elements) {
      if (seenIds.has(element.id)) {
        log.warn(
          `c4-beta: duplicate element id "${element.id}"; later declarations clobber earlier ones - use unique ids`
        );
      }
      seenIds.add(element.id);
    }
    for (const rel of this.relationships) {
      for (const endpoint of [rel.sourceId, rel.targetId]) {
        if (!seenIds.has(endpoint)) {
          log.warn(
            `c4-beta: relationship endpoint "${endpoint}" is not a declared element id - check for a typo`
          );
        }
      }
    }
    for (const element of this.elements) {
      if (unexpected.includes(element.kind)) {
        log.warn(
          `c4-beta: element "${element.id}" of kind "${element.kind}" is unexpected in a "${this.kind}" diagram; rendering it anyway`
        );
      }
      // In C4 a person and a software system are black boxes: technology only
      // belongs on containers, components and deployment nodes. Drop it so it
      // is not rendered in the label.
      if (element.technology && (element.kind === 'person' || element.kind === 'softwareSystem')) {
        log.warn(
          `c4-beta: technology "${element.technology}" on ${element.kind} "${element.id}" is ignored; technology only applies to container, component and deploymentNode elements`
        );
        element.technology = undefined;
      }
      // An instance count only makes sense on a deployment node (how many copies
      // of that node are deployed). Drop it elsewhere so it is not rendered.
      if (element.instances && element.kind !== 'deploymentNode') {
        log.warn(
          `c4-beta: instances "${element.instances}" on ${element.kind} "${element.id}" is ignored; instances only apply to deploymentNode elements`
        );
        element.instances = undefined;
      }
    }
  }

  public getData(): LayoutData {
    const config = getConfig();
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    this.validateElements();

    // Any element containing other elements is rendered as a boundary cluster.
    // Deployment nodes are always clusters, even when they are empty.
    const boundaryIds = new Set(
      this.elements.flatMap((element) => [
        ...(element.kind === 'deploymentNode' ? [element.id] : []),
        ...(element.parentId === undefined ? [] : [element.parentId]),
      ])
    );

    for (const element of this.elements) {
      if (boundaryIds.has(element.id)) {
        let label: string;
        if (element.kind === 'deploymentNode') {
          // The name (with an optional "xN" instances badge) on top, and the technology
          // in brackets on a smaller line below (Structurizr notation). Keeping the name
          // on its own line stays narrow enough to fit inside the box without overlapping
          // sibling nodes; nodes without a technology show just the name.
          let nameLine = `<b>${escapeHtml(element.name)}</b>`;
          if (element.instances) {
            nameLine += ` <span class="c4-instances">x${escapeHtml(element.instances)}</span>`;
          }
          label = element.technology
            ? `${nameLine}<br/><small>[${escapeHtml(element.technology)}]</small>`
            : nameLine;
        } else {
          label = escapeHtml(element.name);
        }
        nodes.push({
          id: element.id,
          label,
          parentId: element.parentId,
          isGroup: true,
          shape: 'rect',
          cssClasses:
            element.kind === 'deploymentNode' ? 'c4-boundary c4-deploymentNode' : 'c4-boundary',
          cssStyles: [],
          padding: 8,
          look: config.look,
        });
        continue;
      }
      // `external` is a built-in convention tag: it adds the `c4-external` class
      // so the outline grey from CSS wins over the per-kind identity colour.
      const isExternal = element.tags.includes('external');
      const cssClasses = ['c4-shape', `c4-${element.kind}`];
      if (isExternal) {
        cssClasses.push('c4-external');
      }
      // Element colours (white/background fill with an identity-coloured outline
      // and text) all come from the themed class rules in styles.ts. Only tag
      // styles are emitted inline, so they win over the class-based defaults.
      const cssStyles: string[] = [];
      let shape: Node['shape'] = element.kind === 'person' ? 'c4-person' : 'rect';
      // Identity colour for decorative shape parts (e.g. the c4-person arms): the
      // theme variable for this kind, or the shared grey for external. A tag's
      // explicit stroke override (below) wins so the decoration matches the rect.
      let accent = isExternal
        ? resolveIdentity('external', config.themeVariables)
        : resolveIdentity(element.kind, config.themeVariables);
      // Tag styles are emitted inline so they override the themed class colors.
      // A user `style external fill:#...` therefore beats the default `.c4-external` rule.
      for (const tag of element.tags) {
        cssClasses.push(`c4-tag-${tag}`);
        const style = this.styles.get(tag);
        if (!style) {
          continue;
        }
        for (const key of ['fill', 'stroke', 'color'] as const) {
          if (style[key]) {
            cssStyles.push(`${key}: ${style[key]}`);
          }
        }
        if (style.stroke) {
          accent = style.stroke;
        }
        if (style.shape) {
          // Resolve the keyword through the shared C4 shape vocabulary so c4-beta
          // and legacy C4 render the same shape (e.g. cylinder -> the c4-database shape).
          shape = keywordShape(style.shape) ?? style.shape;
        }
      }
      nodes.push({
        id: element.id,
        label: buildElementLabel(element),
        parentId: element.parentId,
        isGroup: false,
        shape,
        cssClasses: cssClasses.join(' '),
        cssStyles,
        c4Accent: accent,
        padding: 8,
        look: config.look,
      });
    }

    // In dynamic diagrams relationships are numbered in declaration order.
    // An explicit `N:` prefix overrides the counter; a number repeated across
    // several relationships marks them as parallel interactions (they all keep
    // the same N). Auto-numbering then resumes from the highest number used + 1.
    let maxStep = 0;
    this.relationships.forEach((relationship, index) => {
      if (boundaryIds.has(relationship.sourceId) && boundaryIds.has(relationship.targetId)) {
        log.warn(
          `c4-beta: relationship "${relationship.sourceId} ${relationship.arrow} ${relationship.targetId}" connects two clusters; relationships should connect leaf elements`
        );
      }
      let step: number | undefined;
      if (this.kind === 'dynamic') {
        step = relationship.step ?? maxStep + 1;
        maxStep = Math.max(maxStep, step);
      }
      const classes = ['c4-rel'];
      const style: string[] = [];
      let pattern = 'solid';
      for (const tag of relationship.tags) {
        classes.push(`c4-tag-${tag}`);
        const tagStyle = this.styles.get(tag);
        if (!tagStyle) {
          continue;
        }
        if (tagStyle.stroke) {
          style.push(`stroke: ${tagStyle.stroke}`);
        }
        if (tagStyle.color) {
          style.push(`color: ${tagStyle.color}`);
        }
        if (tagStyle.line) {
          pattern = tagStyle.line;
        }
      }
      edges.push({
        id: `c4-edge-${index}`,
        start: relationship.sourceId,
        end: relationship.targetId,
        type: 'normal',
        label: buildRelationshipLabel(relationship, step),
        // Straight lines with the label centred on the line (matching legacy C4);
        // a curved edge would pull the centred label sideways onto nearby nodes.
        curve: 'linear',
        labelpos: 'c',
        classes: classes.join(' '),
        style,
        arrowTypeStart: relationship.arrow === '-->' ? 'none' : 'arrow_point',
        arrowTypeEnd: relationship.arrow === '<--' ? 'none' : 'arrow_point',
        arrowheadStyle: 'fill: #333',
        thickness: 'normal',
        pattern,
        look: config.look,
      });
    });

    return { nodes, edges, other: {}, config, direction: this.direction };
  }

  public clear() {
    commonClear();
    this.elements = [];
    this.relationships = [];
    this.styles = new Map();
    this.direction = 'TB';
    this.kind = 'context';
    this.legendEnabled = true;
  }

  public setAccTitle = setAccTitle;
  public getAccTitle = getAccTitle;
  public setDiagramTitle = setDiagramTitle;
  public getDiagramTitle = getDiagramTitle;
  public getAccDescription = getAccDescription;
  public setAccDescription = setAccDescription;
}
