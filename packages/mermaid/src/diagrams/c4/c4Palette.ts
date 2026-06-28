import type { MermaidConfig } from '../../config.type.js';

/**
 * Shared C4 colour resolver. Theme variables are the single source of truth for
 * C4 element colour, for BOTH the legacy `C4Context` syntax and `c4-beta`. Users
 * recolour C4 by overriding these `themeVariables` (the old `config.c4.*_bg_color`
 * palette has been removed). Keeping the kind-to-variable mapping in one module
 * guarantees elements, decorative shape parts and legend swatches always agree.
 */

/** Canonical C4 element kind mapped to the theme variable for its identity colour. */
export const KIND_TO_THEME_VAR: Record<string, string> = {
  person: 'c4PersonBkg',
  // Both syntaxes' names for a Software System.
  system: 'c4SystemBkg',
  softwareSystem: 'c4SystemBkg',
  container: 'c4ContainerBkg',
  component: 'c4ComponentBkg',
  infrastructureNode: 'c4InfrastructureBkg',
  // Every external element renders in the single muted grey (external = a tag).
  external: 'c4ExternalBkg',
};

/** Last-ditch identity colour for a kind with no mapped theme variable. */
export const DEFAULT_IDENTITY = '#6b6b6b';

/**
 * Resolve an element kind to its identity colour (the outline border + label
 * text) from the active theme. Falls back to a neutral grey only when neither a
 * mapped variable nor a theme value exists.
 */
export const resolveIdentity = (
  kind: string,
  themeVariables: MermaidConfig['themeVariables']
): string => {
  const varName = KIND_TO_THEME_VAR[kind];
  const value = varName
    ? (themeVariables as Record<string, unknown> | undefined)?.[varName]
    : undefined;
  return typeof value === 'string' ? value : DEFAULT_IDENTITY;
};
