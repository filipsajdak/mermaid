/**
 * Decorative geometry/typography constants for the C4 element shapes. Kept in one
 * place so the magic numbers behind the person arms, terminal glyph and browser
 * chrome are named and shared rather than scattered as inline literals.
 */

// Person: faint arms in the lower body.
export const C4_PERSON_ARM_OPACITY = 0.4;
export const C4_PERSON_ARM_STROKE_WIDTH = 2;

// Terminal: the monospace ">_" prompt glyph.
export const C4_TERMINAL_GLYPH_FONT_FAMILY = 'monospace';
export const C4_TERMINAL_GLYPH_FONT_WEIGHT = 'bold';
// Relative so it scales with the inherited node font size.
export const C4_TERMINAL_GLYPH_FONT_SIZE = '0.9em';

// Browser: window-chrome traffic lights and address bar.
export const C4_BROWSER_TRAFFIC_RADIUS = 2.5;
export const C4_BROWSER_ADDRESS_BAR_STROKE_WIDTH = 1;
export const C4_BROWSER_ADDRESS_BAR_OPACITY = 0.6;
