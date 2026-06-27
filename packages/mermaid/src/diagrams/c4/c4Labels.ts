/**
 * Shared C4 label builders used by both the legacy C4 renderer (c4LayoutData) and
 * the c4-beta renderer, so the two syntaxes produce the same label markup and stay
 * one visual language. Each renderer maps its own element/relationship data onto the
 * generic `*Parts` shapes below and calls these builders.
 *
 * Stereotype notation: `[Stereotype: technology]` (or `[Stereotype]` when there is
 * no technology), as on c4model.com / the legacy C4 renderer.
 */

export const escapeHtml = (txt: string): string =>
  txt.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export interface ElementLabelParts {
  /** The element's display name (bold first line). */
  name: string;
  /** The C4 stereotype, e.g. 'Software System' / 'Container'. Omitted for plain groups. */
  stereotype?: string;
  /** Technology, shown inside the stereotype bracket on container/component/node. */
  technology?: string;
  /** Optional description line. */
  description?: string;
  /** Optional deployment instance count (renders as `(xN)`). */
  instances?: string;
}

/** A C4 element label: bold name, a `[Stereotype: tech]` line, then optional description / instances. */
export const buildElementLabel = (parts: ElementLabelParts): string => {
  const lines: string[] = [`<b>${escapeHtml(parts.name)}</b>`];
  if (parts.stereotype) {
    const type = parts.technology
      ? `[${escapeHtml(parts.stereotype)}: ${escapeHtml(parts.technology)}]`
      : `[${escapeHtml(parts.stereotype)}]`;
    lines.push(`<span class="c4-type">${type}</span>`);
  }
  if (parts.description) {
    lines.push(`<span class="c4-descr">${escapeHtml(parts.description)}</span>`);
  }
  if (parts.instances) {
    lines.push(`<span class="c4-instances">(x${escapeHtml(parts.instances)})</span>`);
  }
  return lines.join('<br/>');
};

export interface RelationshipLabelParts {
  label: string;
  technology?: string;
  description?: string;
}

/** A C4 relationship label: bold label, then optional `[technology]` and description. */
export const buildRelationshipLabel = (parts: RelationshipLabelParts): string => {
  const lines: string[] = [`<b>${escapeHtml(parts.label)}</b>`];
  if (parts.technology) {
    lines.push(`<small><i>[${escapeHtml(parts.technology)}]</i></small>`);
  }
  if (parts.description) {
    lines.push(`<small>${escapeHtml(parts.description)}</small>`);
  }
  return lines.join('<br/>');
};

export interface BoundaryLabelParts {
  label: string;
  /** The boundary type, e.g. 'ENTERPRISE'. The implicit system/container types are not shown. */
  type?: string;
}

/** A C4 boundary label: bold label, then the boundary type (unless it is the implicit system/container). */
export const buildBoundaryLabel = (parts: BoundaryLabelParts): string => {
  const lines: string[] = [`<b>${escapeHtml(parts.label)}</b>`];
  const implicit = parts.type?.toLowerCase();
  if (parts.type && implicit !== 'system' && implicit !== 'container') {
    lines.push(`<span class="c4-type">[${escapeHtml(parts.type)}]</span>`);
  }
  return lines.join('<br/>');
};
