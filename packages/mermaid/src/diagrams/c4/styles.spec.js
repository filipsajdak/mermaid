import { describe, it, expect } from 'vitest';
import getStyles from './styles.js';

const options = {
  fontFamily: 'sans-serif',
  textColor: '#111111',
  nodeTextColor: '#222222',
  mainBkg: '#eeeeee',
  nodeBorder: '#333333',
  lineColor: '#444444',
  titleColor: '#666666',
  background: '#ffffff',
  edgeLabelBackground: '#dddddd',
  c4ExternalBkg: '#999999',
  c4BoundaryBorder: '#777777',
};

describe('legacy C4 getStyles', () => {
  const css = getStyles(options);

  it('drives external elements, relationships and clusters from theme variables', () => {
    // External elements use the theme grey, not a hardcoded #8c8c8c.
    expect(css).toContain('#999999');
    // Relationship lines use lineColor.
    expect(css).toContain('#444444');
    // Cluster border uses the boundary theme variable.
    expect(css).toContain('#777777');
  });

  it('contains no leftover hardcoded element colours', () => {
    // The old hardcoded external grey is gone (now driven by c4ExternalBkg).
    expect(css).not.toContain('#8c8c8c');
  });

  it('uses a relative, theme-scaled title font size', () => {
    expect(css).toContain('font-size: 1.5em');
    expect(css).not.toContain('font-size: 18px');
  });
});
