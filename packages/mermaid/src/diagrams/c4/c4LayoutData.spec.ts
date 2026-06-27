// @ts-ignore: JISON doesn't support types
import c4 from './parser/c4Diagram.jison';
import c4Db from './c4Db.js';
import { buildLegendData, getData } from './c4LayoutData.js';
import { setConfig } from '../../config.js';
import type { MermaidConfig } from '../../config.type.js';

setConfig({
  securityLevel: 'strict',
});

describe('C4 getData LayoutData adapter', () => {
  beforeEach(() => {
    c4.parser.yy = c4Db;
    c4.parser.yy.clear();
  });

  const parse = (text: string) => {
    c4.parser.parse(text);
  };

  const data = () => getData(c4Db, { c4: {} } as MermaidConfig);

  it('maps elements to nodes with parentId from their boundary', () => {
    parse(`C4Context
title System Context diagram for Internet Banking System
Enterprise_Boundary(b0, "BankBoundary0") {
  Person(customerA, "Banking Customer A", "A customer of the bank.")
  System(SystemAA, "Internet Banking System", "Allows customers to view information.")
  Enterprise_Boundary(b1, "BankBoundary") {
    System_Ext(SystemC, "E-mail system", "The internal Microsoft Exchange e-mail system.")
  }
}
Person_Ext(customerC, "Banking Customer C")
`);
    const { nodes } = data();
    const byId = new Map(nodes.map((n) => [n.id, n]));

    expect(byId.get('b0')).toMatchObject({ isGroup: true, parentId: undefined });
    expect(byId.get('b1')).toMatchObject({ isGroup: true, parentId: 'b0' });
    expect(byId.get('customerA')).toMatchObject({ isGroup: false, parentId: 'b0' });
    expect(byId.get('SystemAA')).toMatchObject({ isGroup: false, parentId: 'b0' });
    expect(byId.get('SystemC')).toMatchObject({ isGroup: false, parentId: 'b1' });
    expect(byId.get('customerC')?.parentId).toBeUndefined();
  });

  it('maps relationship types to edges with correct arrows', () => {
    parse(`C4Context
Person(a, "A")
System(b, "B")
System(c, "C")
BiRel(a, b, "Uses")
Rel(b, c, "Sends e-mails", "SMTP")
`);
    const { edges } = data();
    expect(edges).toHaveLength(2);
    expect(edges[0]).toMatchObject({
      start: 'a',
      end: 'b',
      arrowTypeStart: 'arrow_point',
      arrowTypeEnd: 'arrow_point',
    });
    expect(edges[1]).toMatchObject({
      start: 'b',
      end: 'c',
      arrowTypeStart: undefined,
      arrowTypeEnd: 'arrow_point',
    });
    expect(edges[1].label).toContain('Sends e-mails');
    expect(edges[1].label).toContain('SMTP');
  });

  it('preserves UpdateElementStyle and UpdateRelStyle as css styles', () => {
    parse(`C4Context
Person(a, "A")
System(b, "B")
Rel(a, b, "Uses")
UpdateElementStyle(a, $fontColor="red", $bgColor="grey", $borderColor="blue")
UpdateRelStyle(a, b, $textColor="blue", $lineColor="green", $offsetX="5")
`);
    const { nodes, edges } = data();
    const a = nodes.find((n) => n.id === 'a');
    expect(a?.cssStyles).toEqual(expect.arrayContaining(['fill:grey', 'stroke:blue', 'color:red']));
    expect(edges[0].style).toEqual(expect.arrayContaining(['stroke:green']));
    expect(edges[0].labelStyle).toEqual(expect.arrayContaining(['color:blue']));
  });

  it('sets node.link from an element `$link` attribute (clickable element)', () => {
    // A descr-present form so the named `$link` lands in the parsed slot.
    parse(`C4Context
Person(p, "P", "desc", $link="https://example.com")
`);
    const { nodes } = data();
    expect(nodes.find((n) => n.id === 'p')?.link).toBe('https://example.com');
  });

  it('adds the c4-shadow class when UpdateElementStyle sets $shadowing', () => {
    parse(`C4Context
System(a, "A")
System(b, "B")
UpdateElementStyle(a, $shadowing="true")
UpdateElementStyle(b, $shadowing="false")
`);
    const { nodes } = data();
    expect(nodes.find((n) => n.id === 'a')?.cssClasses).toContain('c4-shadow');
    // The literal 'false' is treated as shadow off.
    expect(nodes.find((n) => n.id === 'b')?.cssClasses).not.toContain('c4-shadow');
  });

  it('applies UpdateBoundaryStyle colors to a boundary node', () => {
    parse(`C4Context
Enterprise_Boundary(b0, "Bank") {
  System(s, "S")
}
UpdateBoundaryStyle(b0, $bgColor="#445566", $fontColor="#ffffff", $borderColor="#000000")
`);
    const { nodes } = data();
    expect(nodes.find((n) => n.id === 'b0')?.cssStyles).toEqual(
      expect.arrayContaining(['fill:#445566', 'stroke:#000000', 'color:#ffffff'])
    );
  });

  it('applies the configured C4 palette as an outline (border + text) over a light fill', () => {
    parse(`C4Context
Person(a, "A")
System_Ext(b, "B")
`);
    const { nodes } = getData(c4Db, {
      c4: { person_bg_color: '#08427B', external_system_bg_color: '#999999' },
    } as MermaidConfig);
    // #08427B is already dark, so it is used verbatim as border and text.
    expect(nodes.find((n) => n.id === 'a')?.cssStyles).toEqual(
      expect.arrayContaining(['fill:#ffffff', 'stroke:#08427b', 'color:#08427b'])
    );
    // #999999 is too light for text on white, so it is darkened for legibility.
    const ext = nodes.find((n) => n.id === 'b')?.cssStyles ?? [];
    expect(ext).toContain('fill:#ffffff');
    expect(ext.some((s) => /^stroke:#[\da-f]{6}$/.test(s) && s !== 'stroke:#999999')).toBe(true);
  });

  it('applies a defined AddElementTag colors to a tagged element', () => {
    parse(`C4Context
Person(a, "A", "Customer", $tags="v1")
AddElementTag("v1", $bgColor="#ff0000", $borderColor="#00ff00", $fontColor="#0000ff")
`);
    const { nodes } = data();
    const a = nodes.find((n) => n.id === 'a');
    expect(a?.cssStyles).toEqual(
      expect.arrayContaining(['fill:#ff0000', 'stroke:#00ff00', 'color:#0000ff'])
    );
  });

  it('lets an explicit UpdateElementStyle win over a tag color', () => {
    parse(`C4Context
System(s, "S", "Desc", $tags="v1")
AddElementTag("v1", $bgColor="#ff0000")
UpdateElementStyle(s, $bgColor="#123456")
`);
    const { nodes } = data();
    const styles = nodes.find((n) => n.id === 's')?.cssStyles ?? [];
    // Both fills are present; the explicit one is appended last so it wins.
    expect(styles.lastIndexOf('fill:#123456')).toBeGreaterThan(styles.indexOf('fill:#ff0000'));
  });

  it('marks an external (*_Ext) element with the c4-external cssClass', () => {
    parse(`C4Context
System_Ext(ext, "External system")
System(internal, "Internal system")
`);
    const { nodes } = data();
    expect(nodes.find((n) => n.id === 'ext')?.cssClasses).toContain('c4-external');
    expect(nodes.find((n) => n.id === 'internal')?.cssClasses).not.toContain('c4-external');
  });

  it('maps element variants to dedicated shapes', () => {
    parse(`C4Context
SystemDb(db1, "Database")
SystemQueue(q1, "Queue")
System(s1, "System")
Person(p1, "Person")
`);
    const { nodes } = data();
    expect(nodes.find((n) => n.id === 'db1')?.shape).toBe('c4-database');
    expect(nodes.find((n) => n.id === 'q1')?.shape).toBe('c4-queue');
    expect(nodes.find((n) => n.id === 's1')?.shape).toBe('rounded');
    expect(nodes.find((n) => n.id === 'p1')?.shape).toBe('c4-person');
  });

  it('resolves an explicit $shape over the element type', () => {
    parse(`C4Context
System(s1, "System")
SystemDb(s2, "Store")
UpdateElementStyle(s1, $shape="folder")
UpdateElementStyle(s2, $shape="browser")
`);
    const { nodes } = data();
    expect(nodes.find((n) => n.id === 's1')?.shape).toBe('c4-folder');
    expect(nodes.find((n) => n.id === 's2')?.shape).toBe('c4-browser');
  });

  it('resolves a recognised $sprite keyword when no $shape is set', () => {
    parse(`C4Context
System(s1, "S1", "Desc", $sprite="bucket")
System(s2, "S2", "Desc", $sprite="terminal")
`);
    const { nodes } = data();
    expect(nodes.find((n) => n.id === 's1')?.shape).toBe('c4-bucket');
    expect(nodes.find((n) => n.id === 's2')?.shape).toBe('c4-terminal');
  });

  it('renders a non-keyword $sprite as an icon (icon shape + node.icon)', () => {
    parse(`C4Context
System(s, "S", "Desc", $sprite="logos:aws-lambda")
`);
    const node = data().nodes.find((n) => n.id === 's');
    expect(node?.shape).toBe('iconRounded');
    expect(node?.icon).toBe('logos:aws-lambda');
  });

  it('renders a non-keyword $shape as an icon when $sprite is absent', () => {
    parse(`C4Context
System(s, "S", "Desc", $shape="mdi:database")
`);
    const node = data().nodes.find((n) => n.id === 's');
    expect(node?.shape).toBe('iconRounded');
    expect(node?.icon).toBe('mdi:database');
  });

  it('keeps a keyword $sprite as a c4 shape (no icon) over a non-keyword $shape', () => {
    parse(`C4Context
System(s, "S", "Desc", $sprite="cylinder", $shape="logos:aws-lambda")
`);
    const node = data().nodes.find((n) => n.id === 's');
    // A recognised keyword (in either slot) still maps to its c4 shape.
    expect(node?.shape).toBe('c4-database');
    expect(node?.icon).toBeUndefined();
  });

  it('leaves node.icon undefined for plain elements with no sprite/shape', () => {
    parse(`C4Context
System(s, "S")
`);
    const node = data().nodes.find((n) => n.id === 's');
    expect(node?.shape).toBe('rounded');
    expect(node?.icon).toBeUndefined();
  });

  it('renders Structurizr-style node labels', () => {
    parse(`C4Container
Container(c1, "API", "Spring Boot", "Handles requests")
System(s1, "Mainframe")
`);
    const { nodes } = data();
    const c1 = nodes.find((n) => n.id === 'c1');
    expect(c1?.label).toContain('<b>API</b>');
    expect(c1?.label).toContain('[Container: Spring Boot]');
    expect(c1?.label).toContain('Handles requests');
    expect(nodes.find((n) => n.id === 's1')?.label).toContain('[Software System]');
  });

  it('marks deployment nodes as group nodes', () => {
    parse(`C4Deployment
Deployment_Node(n1, "AWS", "Cloud") {
  Container(c1, "API", "Java")
}
`);
    const { nodes } = data();
    expect(nodes.find((n) => n.id === 'n1')).toMatchObject({ isGroup: true });
    expect(nodes.find((n) => n.id === 'c1')).toMatchObject({ isGroup: false, parentId: 'n1' });
  });

  it('parses SoftwareSystemInstance / ContainerInstance inside a Deployment_Node', () => {
    parse(`C4Deployment
Deployment_Node(n1, "AWS", "Cloud") {
  SoftwareSystemInstance(ssi, "Banking System")
  ContainerInstance(ci, "API", "Spring Boot")
}
`);
    const { nodes } = data();
    const ssi = nodes.find((n) => n.id === 'ssi');
    const ci = nodes.find((n) => n.id === 'ci');
    // Both are approximated as plain (rounded) element boxes parented to the node.
    expect(ssi).toMatchObject({ isGroup: false, parentId: 'n1', shape: 'rounded' });
    expect(ci).toMatchObject({ isGroup: false, parentId: 'n1', shape: 'rounded' });
    // Each carries its Structurizr stereotype.
    expect(ssi?.label).toContain('[Software System Instance]');
    expect(ci?.label).toContain('[Container Instance: Spring Boot]');
  });

  it('annotates a deployment instance with its $instances count', () => {
    parse(`C4Deployment
Deployment_Node(n1, "AWS", "Cloud") {
  ContainerInstance(ci, "API", $instances="3")
}
`);
    const ci = data().nodes.find((n) => n.id === 'ci');
    expect(ci?.label).toContain('(x3)');
  });

  it('emits the db direction into LayoutData (defaults to TB)', () => {
    parse(`C4Context
Person(a, "A")
`);
    expect(data().direction).toBe('TB');
  });

  it('honours a top-level `direction` statement parsed from the diagram', () => {
    parse(`C4Context
direction LR
Person(a, "A")
`);
    expect(data().direction).toBe('LR');
  });

  it.each(['TB', 'BT', 'LR', 'RL'])('parses `direction %s` and emits it into LayoutData', (dir) => {
    parse(`C4Context
direction ${dir}
Person(a, "A")
System(b, "B")
`);
    expect(data().direction).toBe(dir);
  });

  it('prefixes relationship labels with a 1-based step number in C4Dynamic diagrams', () => {
    parse(`C4Dynamic
Person(a, "A")
System(b, "B")
Rel(a, b, "Calls")
Rel(b, a, "Returns")
`);
    const { edges } = data();
    expect(edges[0].label).toContain('1: Calls');
    expect(edges[1].label).toContain('2: Returns');
  });

  describe('auto-generated legend', () => {
    it('defaults getShowLegend() to false', () => {
      parse(`C4Context
Person(a, "A")
`);
      expect(c4Db.getShowLegend()).toBe(false);
    });

    it('SHOW_LEGEND() sets getShowLegend() to true', () => {
      parse(`C4Context
Person(a, "A")
System(b, "B")
SHOW_LEGEND()
`);
      expect(c4Db.getShowLegend()).toBe(true);
    });

    it('clear() resets the legend flag', () => {
      parse(`C4Context
Person(a, "A")
SHOW_LEGEND()
`);
      expect(c4Db.getShowLegend()).toBe(true);
      c4Db.clear();
      expect(c4Db.getShowLegend()).toBe(false);
    });

    it('buildLegendData returns one row per distinct kind for a mixed diagram', () => {
      parse(`C4Container
Person(p, "Customer")
Person_Ext(pe, "Partner")
System(s, "Banking System")
Container(c, "API", "Spring Boot")
ContainerDb(db, "Database", "PostgreSQL")
ContainerQueue(q, "Events", "Kafka")
`);
      const items = buildLegendData(c4Db, { c4: {} } as MermaidConfig);
      const labels = items.map((i) => i.label);
      // Person, Software System, Container, Database, Queue and External, each once,
      // in the stable category order.
      expect(labels).toEqual([
        'Person',
        'Software System',
        'Container',
        'Database',
        'Queue',
        'External',
      ]);
    });

    it('deduplicates repeated kinds and carries the palette outline color', () => {
      parse(`C4Context
Person(a, "A")
Person(b, "B")
System(s, "S")
`);
      const items = buildLegendData(c4Db, {
        c4: { person_bg_color: '#08427B' },
      } as MermaidConfig);
      expect(items).toHaveLength(2);
      expect(items[0]).toEqual({ label: 'Person', color: '#08427b' });
    });

    it('adds a Deployment Node row when the diagram uses one', () => {
      parse(`C4Deployment
Deployment_Node(n1, "AWS", "Cloud") {
  Container(c1, "API", "Java")
}
`);
      const labels = buildLegendData(c4Db, { c4: {} } as MermaidConfig).map((i) => i.label);
      expect(labels).toContain('Deployment Node');
      expect(labels).toContain('Container');
    });

    it('contributes a custom legend row for an element $legendText', () => {
      parse(`C4Context
Person(a, "A")
System(s, "S")
UpdateElementStyle(s, $legendText="My custom system")
`);
      const labels = buildLegendData(c4Db, { c4: {} } as MermaidConfig).map((i) => i.label);
      // The element with $legendText contributes its own row (after the kind rows);
      // an element without one still contributes its kind row.
      expect(labels).toContain('My custom system');
      expect(labels).toContain('Person');
    });

    it('de-duplicates repeated $legendText rows', () => {
      parse(`C4Context
System(s1, "S1")
System(s2, "S2")
UpdateElementStyle(s1, $legendText="Shared")
UpdateElementStyle(s2, $legendText="Shared")
`);
      const labels = buildLegendData(c4Db, { c4: {} } as MermaidConfig).map((i) => i.label);
      expect(labels.filter((l) => l === 'Shared')).toHaveLength(1);
    });
  });
});
