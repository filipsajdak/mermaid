import { describe, it, expect } from 'vitest';
import type { MermaidConfig } from '../../config.type.js';
import { resolveIdentity, KIND_TO_THEME_VAR, DEFAULT_IDENTITY } from './c4Palette.js';

const tv = (vars: Record<string, string>): MermaidConfig['themeVariables'] =>
  vars as unknown as MermaidConfig['themeVariables'];

describe('c4Palette.resolveIdentity', () => {
  it('maps each known kind to its theme variable value', () => {
    const vars = tv({
      c4PersonBkg: '#08427B',
      c4SystemBkg: '#1168BD',
      c4ContainerBkg: '#438DD5',
      c4ComponentBkg: '#85BBF0',
      c4InfrastructureBkg: '#6b6b6b',
      c4ExternalBkg: '#999999',
    });
    expect(resolveIdentity('person', vars)).toBe('#08427B');
    expect(resolveIdentity('softwareSystem', vars)).toBe('#1168BD');
    expect(resolveIdentity('system', vars)).toBe('#1168BD');
    expect(resolveIdentity('container', vars)).toBe('#438DD5');
    expect(resolveIdentity('component', vars)).toBe('#85BBF0');
    expect(resolveIdentity('infrastructureNode', vars)).toBe('#6b6b6b');
    expect(resolveIdentity('external', vars)).toBe('#999999');
  });

  it('adapts to the active theme (default vs dark person colour)', () => {
    expect(resolveIdentity('person', tv({ c4PersonBkg: '#08427B' }))).toBe('#08427B');
    // A dark theme lightens the value; the resolver simply returns whatever the
    // theme provides.
    expect(resolveIdentity('person', tv({ c4PersonBkg: '#0a52a0' }))).toBe('#0a52a0');
  });

  it('falls back to the neutral grey when the kind or theme value is missing', () => {
    expect(resolveIdentity('person', tv({}))).toBe(DEFAULT_IDENTITY);
    expect(resolveIdentity('unknownKind', tv({ c4PersonBkg: '#08427B' }))).toBe(DEFAULT_IDENTITY);
    expect(resolveIdentity('person', undefined)).toBe(DEFAULT_IDENTITY);
  });

  it('maps both syntaxes name for a software system to the same variable', () => {
    expect(KIND_TO_THEME_VAR.system).toBe('c4SystemBkg');
    expect(KIND_TO_THEME_VAR.softwareSystem).toBe('c4SystemBkg');
  });
});
