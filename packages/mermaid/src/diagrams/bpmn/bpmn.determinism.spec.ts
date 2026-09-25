import { describe, it, expect, beforeEach } from 'vitest';
import { addDiagrams } from '../../diagram-api/diagram-orchestration.js';
import { mermaidAPI } from '../../mermaidAPI.js';
import mermaid from '../../mermaid.js';
import { jsdomIt } from '../../tests/util.js';
import { db } from './bpmnDb.js';

// An AI eval loop, and a diagram checked into version control, both rely on the same source
// producing the same output. The honest contract is: for a given configuration the parse and
// layout are deterministic (stable node/edge order, per-parse generated ids), and the rendered
// SVG is byte-identical when the diagram is given the same id. When the id is generated (as
// `mermaid.run` does), `deterministicIds` keeps it — and every internal id — stable. These tests
// pin exactly that, and nothing stronger.

const SOURCE = `bpmn-beta LR
  pool "Order handling"
    lane "Sales"
      start message s1 "Order received"
      user task t1 "Approve order"
      xor gw "Approved?"
    lane "Warehouse"
      service task t2 "Pick items"
      end e1 "Shipped"
  s1 --> t1 --> gw
  gw -- yes --> t2 --> e1`;

// A source that leans on generated ids (anonymous elements): the per-parse counter must be seeded
// the same way every run, or two runs would drift apart.
const ANON_SOURCE = `bpmn-beta LR
  lane "L"
    task "First"
    task "Second"
    xor "Which?"`;

const layoutOf = (source: string) => {
  db.clear();
  db.parse(source);
  return db.getData();
};

describe('bpmn determinism — parse and layout', () => {
  beforeEach(() => db.clear());

  it('produces identical layout data across runs', () => {
    expect(layoutOf(SOURCE)).toEqual(layoutOf(SOURCE));
  });

  it('emits nodes and edges in a stable order', () => {
    const first = layoutOf(SOURCE);
    const second = layoutOf(SOURCE);
    expect(second.nodes.map((n) => n.id)).toEqual(first.nodes.map((n) => n.id));
    expect(second.edges.map((e) => e.id)).toEqual(first.edges.map((e) => e.id));
  });

  it('assigns the same generated ids to anonymous elements every run', () => {
    const first = layoutOf(ANON_SOURCE).nodes.map((n) => n.id);
    const second = layoutOf(ANON_SOURCE).nodes.map((n) => n.id);
    expect(second).toEqual(first);
    // The ids come from the element kind and a per-parse counter, not from time or randomness.
    expect(first).toContain('task-2');
    expect(first).toContain('task-3');
  });
});

describe('bpmn determinism — rendered SVG', () => {
  beforeEach(() => {
    addDiagrams();
    db.clear();
  });

  jsdomIt('renders byte-identical SVG for the same source and the same id', async () => {
    const { svg: first } = await mermaidAPI.render('bpmn-determinism', SOURCE);
    const { svg: second } = await mermaidAPI.render('bpmn-determinism', SOURCE);
    expect(second).toBe(first);
  });

  jsdomIt('stays byte-identical for the same id with deterministicIds enabled', async () => {
    mermaidAPI.initialize({ deterministicIds: true });
    const { svg: first } = await mermaidAPI.render('bpmn-deterministic-ids', SOURCE);
    const { svg: second } = await mermaidAPI.render('bpmn-deterministic-ids', SOURCE);
    expect(second).toBe(first);
  });

  // The auto-id path: `mermaid.run` generates the ids itself. With deterministicIds on, two runs of
  // the same source render byte-identical output — the guarantee an unattended render loop needs.
  jsdomIt(
    'renders byte-identical through the auto-id path (mermaid.run) with deterministicIds',
    async () => {
      const runOnce = async (): Promise<string> => {
        document.body.innerHTML = `<pre class="mermaid">${SOURCE}</pre>`;
        mermaid.initialize({ startOnLoad: false, deterministicIds: true });
        await mermaid.run({ querySelector: '.mermaid' });
        return document.querySelector('.mermaid')?.innerHTML ?? '';
      };
      const first = await runOnce();
      const second = await runOnce();
      expect(first).not.toBe('');
      expect(second).toBe(first);
    }
  );
});
