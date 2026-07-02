/**
 * Decorative geometry/typography constants for the C4 element shapes. Kept in one
 * place so the magic numbers behind the terminal glyph and browser chrome are
 * named and shared rather than scattered as inline literals.
 */

// Terminal: the monospace ">_" prompt glyph.
export const C4_TERMINAL_GLYPH_FONT_FAMILY = 'monospace';
export const C4_TERMINAL_GLYPH_FONT_WEIGHT = 'bold';
// Relative so it scales with the inherited node font size.
export const C4_TERMINAL_GLYPH_FONT_SIZE = '0.9em';

// Browser: window-chrome traffic lights and address bar.
export const C4_BROWSER_TRAFFIC_RADIUS = 2.5;
export const C4_BROWSER_ADDRESS_BAR_STROKE_WIDTH = 1;
export const C4_BROWSER_ADDRESS_BAR_OPACITY = 0.6;
