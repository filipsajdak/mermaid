import { imgSnapshotTest, renderGraph } from '../../../helpers/util.ts';

describe('C4 multi-diagram page', () => {
  // A C4 diagram next to a flowchart and a class diagram on one page proves that
  // each diagram's CSS (e.g. C4's `.node rect { fill }` and outline rules) is
  // scoped to its own diagram id and does not leak into the others.
  const diagrams = [
    `
    c4-beta context
    title System Context
    person customer "Banking Customer"
    softwareSystem banking "Internet Banking System"
    softwareSystem email "E-mail System" :::external
    customer --> banking : "Uses"
    banking --> email : "Sends e-mails using" "SMTP"
    `,
    `
    flowchart TD
      A[Start] --> B{Decision}
      B -->|Yes| C[Do thing]
      B -->|No| D[Skip]
    `,
    `
    classDiagram
      class Account {
        +String owner
        +deposit(amount)
      }
      Account <|-- SavingsAccount
    `,
  ];

  it('renders a C4 diagram alongside a flowchart and a class diagram', () => {
    imgSnapshotTest(diagrams, {});
  });

  it('scopes C4 outline classes to the C4 diagram only', () => {
    renderGraph(diagrams, {});
    cy.get('svg').should('have.length', 3);
    // The C4 outline classes exist only under the C4 diagram's SVG.
    cy.get('.c4-shape').should('have.length.greaterThan', 0);
    cy.get('svg')
      .eq(1)
      .within(() => {
        cy.get('.c4-shape').should('not.exist');
      });
    // The flowchart keeps its own node rendering (not blanked by C4 fill rules).
    cy.get('svg').eq(1).find('.node').should('have.length.greaterThan', 0);
  });
});
