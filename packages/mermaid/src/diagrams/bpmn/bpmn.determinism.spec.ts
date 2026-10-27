import { beforeEach, describe, expect, it } from 'vitest';
import { addDiagrams } from '../../diagram-api/diagram-orchestration.js';
import { mermaidAPI } from '../../mermaidAPI.js';
import mermaid from '../../mermaid.js';
import { jsdomIt } from '../../tests/util.js';
import { BpmnDb } from './bpmnDb.js';

// A diagram kept in version control, or generated and checked in a loop, needs the same source
// to give the same output. What holds: for one configuration, the parse and the layout data are
// the same every time, and the SVG is byte for byte the same when the diagram gets the same id.
// When the id is generated, as `mermaid.run` does, `deterministicIds` keeps it stable. These
// tests pin that, and nothing stronger.

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

/** Elements with no id of their own, so every id here comes from the per-parse counter. */
const ANONYMOUS = `bpmn-beta LR
  lane "L"
    task "First"
    task "Second"
    xor "Which?"`;

const layoutOf = (source: string) => {
  const db = new BpmnDb();
  db.parse(source);
  return db.getData();
};

describe('bpmn determinism: parse and layout', () => {
  it('gives the same layout data on every parse', () => {
    expect(layoutOf(SOURCE)).toEqual(layoutOf(SOURCE));
  });

  it('keeps nodes and edges in the same order', () => {
    const first = layoutOf(SOURCE);
    const second = layoutOf(SOURCE);
    expect(second.nodes.map((node) => node.id)).toEqual(first.nodes.map((node) => node.id));
    expect(second.edges.map((edge) => edge.id)).toEqual(first.edges.map((edge) => edge.id));
  });

  it('generates the same ids for elements written without one', () => {
    const first = layoutOf(ANONYMOUS).nodes.map((node) => node.id);
    expect(layoutOf(ANONYMOUS).nodes.map((node) => node.id)).toEqual(first);
    expect(first).toEqual(['lane-1', 'task-2', 'task-3', 'xor-4']);
  });
});

describe('bpmn determinism: rendered SVG', () => {
  beforeEach(() => {
    addDiagrams();
  });

  jsdomIt('renders the same SVG for the same source and id', async () => {
    const { svg: first } = await mermaidAPI.render('bpmn-determinism', SOURCE);
    const { svg: second } = await mermaidAPI.render('bpmn-determinism', SOURCE);
    expect(second).toBe(first);
  });

  jsdomIt('renders the same SVG for the same id with deterministicIds', async () => {
    mermaidAPI.initialize({ deterministicIds: true });
    const { svg: first } = await mermaidAPI.render('bpmn-deterministic-ids', SOURCE);
    const { svg: second } = await mermaidAPI.render('bpmn-deterministic-ids', SOURCE);
    expect(second).toBe(first);
  });

  // `mermaid.run` makes up the id itself, so only deterministicIds keeps two runs the same.
  jsdomIt('renders the same SVG through mermaid.run with deterministicIds', async () => {
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
  });
});
