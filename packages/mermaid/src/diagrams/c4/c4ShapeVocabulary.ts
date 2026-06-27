import type { ShapeID } from '../../rendering-util/rendering-elements/shapes.js';

/**
 * Shared C4 shape vocabulary - the keyword -> unified-shape mapping and icon
 * handling used by both the legacy C4 renderer (c4LayoutData) and the c4-beta
 * renderer, so the two syntaxes resolve Structurizr-style shape keywords the
 * same way and stay one visual language.
 */

/** Element types (legacy typeC4Shape values) that render as a database cylinder. */
export const DB_SHAPES = new Set([
  'system_db',
  'external_system_db',
  'container_db',
  'external_container_db',
  'component_db',
  'external_component_db',
]);

/** Element types (legacy typeC4Shape values) that render as a queue (horizontal cylinder). */
export const QUEUE_SHAPES = new Set([
  'system_queue',
  'external_system_queue',
  'container_queue',
  'external_container_queue',
  'component_queue',
  'external_component_queue',
]);

/** Structurizr-style shape keywords accepted via $shape, $sprite, $tags or `style shape:`. */
export const SHAPE_KEYWORDS: Record<string, ShapeID> = {
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

/** Resolves a shape keyword (case-insensitive) to a unified shape ID, or undefined. */
export const keywordShape = (value: string | undefined): ShapeID | undefined =>
  value ? SHAPE_KEYWORDS[value.toLowerCase()] : undefined;

/**
 * The unified renderer's icon shape (reads node.icon and resolves it against the
 * icon packs the user registered via registerIconPacks). Used when a $sprite or
 * $shape is not a built-in keyword but an icon name (e.g. "logos:aws-lambda").
 */
export const ICON_SHAPE: ShapeID = 'iconRounded';

/**
 * A non-empty $shape/$sprite that is NOT a recognised keyword is treated as an
 * icon name; returns the trimmed name, or undefined when empty / a keyword.
 */
export const iconName = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  return trimmed && !keywordShape(trimmed) ? trimmed : undefined;
};

/** The render shape for a C4 element, plus an optional icon name for the icon shape. */
export interface ResolvedShape {
  shape: ShapeID;
  icon?: string;
}
