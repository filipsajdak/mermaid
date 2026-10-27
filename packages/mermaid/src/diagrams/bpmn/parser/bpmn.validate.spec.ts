import { describe, expect, it } from 'vitest';
import { parseBpmn } from './bpmn.parser.js';

const TWO_POOLS = `bpmn-beta LR
  pool shop "Shop"
    task a "A"
    task b "B"
  pool bank "Bank"
    task c "C"
`;

describe('bpmn flow rules', () => {
  describe('a start event', () => {
    it('refuses a sequence flow into it', () => {
      expect(() => parseBpmn('bpmn-beta LR\n  task a "A"\n  start s "S"\n  a --> s\n')).toThrow(
        'BPMN error at line 4, column 3: the flow "a --> s" enters the start event "s", but nothing flows into a start event. Make "s" an intermediate event, or end the flow elsewhere.'
      );
    });

    it('takes a message flow into it', () => {
      expect(() => parseBpmn(`${TWO_POOLS}    start message s "S"\n  a -.-> s\n`)).not.toThrow();
    });
  });

  describe('an end event', () => {
    it('refuses a sequence flow out of it', () => {
      expect(() => parseBpmn('bpmn-beta LR\n  end e "E"\n  task a "A"\n  e --> a\n')).toThrow(
        'BPMN error at line 4, column 3: the flow "e --> a" leaves the end event "e", but nothing flows out of an end event. Make "e" a throw event, or start the flow elsewhere.'
      );
    });

    it('sends a message flow out of it', () => {
      expect(() => parseBpmn(`${TWO_POOLS}    end message e "E"\n  e -.-> a\n`)).not.toThrow();
    });
  });

  describe('a sequence flow', () => {
    it('stays inside one pool', () => {
      expect(() => parseBpmn(`${TWO_POOLS}  a --> b\n`)).not.toThrow();
    });

    it('refuses to cross from one pool to another', () => {
      expect(() => parseBpmn(`${TWO_POOLS}  a --> c\n`)).toThrow(
        'BPMN error at line 7, column 3: the sequence flow "a --> c" crosses from the pool "Shop" to the pool "Bank". A sequence flow stays inside one pool; draw a message flow, "a -.-> c".'
      );
    });

    it('is refused across pools whatever lanes it passes through', () => {
      const source = `bpmn-beta LR
  pool "Shop"
    lane "Sales"
      task a "A"
  pool "Bank"
    lane "Desk"
      task c "C"
  a -- pay --> c
`;
      expect(() => parseBpmn(source)).toThrow(/crosses from the pool "Shop" to the pool "Bank"/);
    });

    it('is not checked when one end sits in no pool', () => {
      expect(() =>
        parseBpmn(
          'bpmn-beta LR\n  lane "L"\n    task a "A"\n  pool "P"\n    task b "B"\n  a --> b\n'
        )
      ).not.toThrow();
    });
  });

  describe('a message flow', () => {
    it('runs between pools', () => {
      expect(() => parseBpmn(`${TWO_POOLS}  a -.-> c\n`)).not.toThrow();
    });

    it('runs to a pool drawn as a black box', () => {
      expect(() =>
        parseBpmn(`${TWO_POOLS}  pool ext "External"\n  a -.-> ext\n  ext -.-> b\n`)
      ).not.toThrow();
    });

    it('refuses to stay inside one pool', () => {
      expect(() => parseBpmn(`${TWO_POOLS}  a -.-> b\n`)).toThrow(
        'BPMN error at line 7, column 3: the message flow "a -.-> b" stays inside the pool "Shop". A message flow runs between pools; draw a sequence flow, "a --> b".'
      );
    });

    it('refuses to run between a pool and what it holds', () => {
      expect(() => parseBpmn(`${TWO_POOLS}  shop -.-> a\n`)).toThrow(
        /"shop -\.-> a" stays inside the pool "Shop"/
      );
    });

    it('runs between lanes that are in no pool', () => {
      expect(() =>
        parseBpmn(
          'bpmn-beta LR\n  lane "A"\n    task a "A"\n  lane "B"\n    task b "B"\n  a -.-> b\n'
        )
      ).not.toThrow();
    });
  });

  it('refuses the first flow that breaks a rule', () => {
    expect(() => parseBpmn(`${TWO_POOLS}  a --> b\n  a -.-> b\n  a --> c\n`)).toThrow(/line 8,/);
  });

  it('locates a refused flow inside a chain', () => {
    expect(() => parseBpmn(`${TWO_POOLS}  a --> b --> c\n`)).toThrow(
      /^BPMN error at line 7, column 9: the sequence flow "b --> c"/
    );
  });

  it('leaves associations alone', () => {
    expect(() =>
      parseBpmn(`${TWO_POOLS}    data d "D"\n    start s "S"\n  d ..> s\n  a ... c\n`)
    ).not.toThrow();
  });
});

/** One lane, so only the sequence flows written after it decide what is reached. */
const lane = (...lines: string[]) =>
  `bpmn-beta LR\n  lane "L"\n${lines.map((line) => `    ${line}\n`).join('')}`;

describe('bpmn reachability', () => {
  it('takes a flow from a start event to an end event', () => {
    expect(() =>
      parseBpmn(lane('start s "S"', 'task a "A"', 'end e "E"') + '  s --> a --> e\n')
    ).not.toThrow();
  });

  it('refuses an element no start event reaches', () => {
    const source =
      lane('start s "S"', 'task a "A"', 'user task b "B"', 'end e "E"') +
      '  s --> a --> e\n  b --> e\n';
    expect(() => parseBpmn(source)).toThrow(
      'BPMN error at line 5, column 5: no start event reaches the task "b", though "s" starts its flow. Connect it, for example "s --> b".'
    );
  });

  it('refuses an element that reaches no end event', () => {
    const source =
      lane('start s "S"', 'task a "A"', 'xor g "G"', 'end e "E"') + '  s --> a --> e\n  s --> g\n';
    expect(() => parseBpmn(source)).toThrow(
      'BPMN error at line 5, column 5: the xor "g" reaches no end event, though "e" ends its flow. Connect it, for example "g --> e".'
    );
  });

  it('names an event by its position', () => {
    const source =
      lane('start s "S"', 'intermediate timer w "W"', 'end e "E"') + '  s --> e\n  s --> w\n';
    expect(() => parseBpmn(source)).toThrow(/the intermediate event "w" reaches no end event/);
  });

  it('leaves a flow with neither a start nor an end event alone', () => {
    expect(() => parseBpmn(lane('task a "A"', 'task b "B"') + '  a --> b\n')).not.toThrow();
  });

  it('checks each connected flow on its own', () => {
    const source =
      lane('start s "S"', 'task a "A"', 'task b "B"', 'end e "E"') + '  s --> a\n  b --> e\n';
    expect(() => parseBpmn(source)).not.toThrow();
  });

  it('leaves an element no sequence flow touches alone', () => {
    const source =
      lane('start s "S"', 'task a "A"', 'end e "E"', 'task idle "Idle"') + '  s --> a --> e\n';
    expect(() => parseBpmn(source)).not.toThrow();
  });

  it('starts a path at a boundary event', () => {
    const source =
      lane('start s "S"', 'task t "T"', '  boundary timer b "B"', 'task x "X"', 'end e "E"') +
      '  s --> t --> e\n  b --> x --> e\n';
    expect(() => parseBpmn(source)).not.toThrow();
  });

  it('carries a path through a pair of link events', () => {
    const source =
      lane(
        'start s "S"',
        'xor g "G"',
        'throw link out "Out"',
        'intermediate link in "In"',
        'end e "E"'
      ) + '  s --> g\n  g --> e\n  g --> out\n  in --> e\n';
    expect(() => parseBpmn(source)).not.toThrow();
  });

  it('does not count a message flow as reaching an element', () => {
    const source = `bpmn-beta LR
  pool "Shop"
    start s "S"
    task a "A"
    end e "E"
  pool "Bank"
    start s2 "S2"
    intermediate message m "M"
    end e2 "E2"
  s --> a --> e
  s2 --> e2
  m --> e2
  a -.-> m
`;
    expect(() => parseBpmn(source)).toThrow(/no start event reaches the intermediate event "m"/);
  });

  it('refuses a flow before an element it leaves unreached', () => {
    const source =
      lane('start s "S"', 'task a "A"', 'end e "E"', 'task b "B"') +
      '  s --> a --> e\n  b --> e\n  e --> s\n';
    expect(() => parseBpmn(source)).toThrow(/the flow "e --> s"/);
  });
});
