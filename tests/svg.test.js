import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SVG_DEFAULTS } from '../js/svg.js';
import { buildBoard } from '../js/board.js';
import { generatePuzzle, DIFFICULTY_IDS } from '../js/generator.js';
import { findSolutions } from '../js/solver.js';

/**
 * Minimaler DOM-Ersatz, damit der SVG-Renderer ohne Browser getestet
 * werden kann. Er bildet die wenigen APIs ab, die das Modul nutzt.
 */
function createFakeDom() {
  const make = (tag) => {
    const node = {
      tagName: tag,
      children: [],
      attributes: {},
      textContent: '',
      setAttribute(name, value) {
        this.attributes[name] = String(value);
      },
      getAttribute(name) {
        return this.attributes[name] ?? null;
      },
      appendChild(child) {
        this.children.push(child);
        return child;
      },
    };
    return node;
  };
  return {
    createElementNS: (_ns, tag) => make(tag),
  };
}

describe('SVG-Renderer', () => {
  test('Standardwerte sind sinnvoll', () => {
    assert.equal(SVG_DEFAULTS.islandFill, '#ffffff');
    assert.equal(SVG_DEFAULTS.islandText, '#000000');
    assert.equal(SVG_DEFAULTS.islandStroke, '#111111');
    assert.ok(SVG_DEFAULTS.islandRadius > 0 && SVG_DEFAULTS.islandRadius < 0.5);
    assert.ok(SVG_DEFAULTS.bridgeWidth < SVG_DEFAULTS.islandRadius);
  });

  test('erzeugt Inseln, Hilfsraster und Rahmen', async () => {
    const dom = createFakeDom();
    globalThis.document = dom;
    const { boardToSvgElement } = await import('../js/svg.js');

    const board = buildBoard(
      [
        { id: 0, r: 0, c: 0, num: 1 },
        { id: 1, r: 0, c: 2, num: 2 },
        { id: 2, r: 2, c: 1, num: 2 },
      ],
      3,
      3,
    );
    const svg = boardToSvgElement(board);

    assert.equal(svg.tagName, 'svg');
    assert.ok(svg.getAttribute('viewBox'));

    // Gruppen: Hilfsraster, Rahmen, Inseln
    const groups = svg.children.filter((c) => c.tagName === 'g');
    assert.ok(groups.length >= 2, 'Hilfsraster- und Insel-Gruppe erwartet');

    // In der Insel-Gruppe: pro Insel ein Kreis und ein Text
    const nodeGroup = groups.find((g) => g.children.some((c) => c.tagName === 'circle'));
    assert.ok(nodeGroup);
    assert.equal(nodeGroup.children.filter((c) => c.tagName === 'circle').length, 3);
    assert.equal(nodeGroup.children.filter((c) => c.tagName === 'text').length, 3);

    delete globalThis.document;
  });

  test('zeichnet keine Brücken, wenn keine übergeben werden', async () => {
    const dom = createFakeDom();
    globalThis.document = dom;
    const { boardToSvgElement, SVG_DEFAULTS } = await import('../js/svg.js');

    const board = buildBoard(
      [
        { id: 0, r: 0, c: 0, num: 1 },
        { id: 1, r: 0, c: 2, num: 1 },
      ],
      3,
      3,
    );
    const svg = boardToSvgElement(board);
    const lines = svg.children.flatMap((g) => g.children ?? []).filter((c) => c.tagName === 'line');
    // Nur die Hilfslinien (3 vertikal + 3 horizontal), keine Brücken
    assert.equal(lines.length, 6);
    delete globalThis.document;
  });

  test('zeichnet Brücken passend zur Anzahl', async () => {
    const dom = createFakeDom();
    globalThis.document = dom;
    const { boardToSvgElement, SVG_DEFAULTS } = await import('../js/svg.js');

    const board = buildBoard(
      [
        { id: 0, r: 0, c: 0, num: 2 },
        { id: 1, r: 0, c: 2, num: 2 },
      ],
      3,
      3,
    );
    // Brücken und Durchstreichungen getrennt zählen
    const countBridges = (svg) => {
      const group = svg.children.find(
        (g) => g.tagName === 'g' && g.getAttribute('stroke-width') === String(SVG_DEFAULTS.bridgeWidth),
      );
      return group ? group.children.filter((c) => c.tagName === 'line').length : 0;
    };

    const single = boardToSvgElement(board, { bridges: new Map([['e0', 1]]) });
    assert.equal(countBridges(single), 1, 'eine Brücke erwartet');

    const double = boardToSvgElement(board, { bridges: new Map([['e0', 2]]) });
    assert.equal(countBridges(double), 2, 'zwei Brücken (Doppelbrücke) erwartet');
    delete globalThis.document;
  });

  test('erfüllte Inseln werden durchgestrichen', async () => {
    const dom = createFakeDom();
    globalThis.document = dom;
    const { boardToSvgElement } = await import('../js/svg.js');

    const board = buildBoard(
      [
        { id: 0, r: 0, c: 0, num: 2 },
        { id: 1, r: 0, c: 2, num: 2 },
      ],
      3,
      3,
    );
    // Beide Inseln sind mit der Doppelbrücke erfüllt -> zwei Striche
    const solved = boardToSvgElement(board, { bridges: new Map([['e0', 2]]) });
    const nodeGroup = solved.children.find((g) => g.children.some((c) => c.tagName === 'circle'));
    const strikes = nodeGroup.children.filter((c) => c.tagName === 'line');
    assert.equal(strikes.length, 2, 'beide Inseln sollten durchgestrichen sein');

    // Ohne Brücken ist keine Insel erfüllt
    const empty = boardToSvgElement(board);
    const emptyGroup = empty.children.find((g) => g.children.some((c) => c.tagName === 'circle'));
    assert.equal(emptyGroup.children.filter((c) => c.tagName === 'line').length, 0);

    // Abschaltbar
    const noMark = boardToSvgElement(board, {
      bridges: new Map([['e0', 2]]),
      markComplete: false,
    });
    const noMarkGroup = noMark.children.find((g) => g.children.some((c) => c.tagName === 'circle'));
    assert.equal(noMarkGroup.children.filter((c) => c.tagName === 'line').length, 0);
    delete globalThis.document;
  });
});

describe('Rätselheft', () => {
  test('jedes Rätsel im Heft ist gültig und eindeutig lösbar', () => {
    for (const difficulty of DIFFICULTY_IDS) {
      for (let i = 1; i <= 4; i++) {
        const puzzle = generatePuzzle({ difficulty, seed: `HEFT-${difficulty}-${i}` });
        const board = buildBoard(
          puzzle.islands.map((isl) => ({ id: isl.id, r: isl.r, c: isl.c, num: isl.num })),
          puzzle.cols,
          puzzle.rows,
        );
        const solutions = findSolutions(board, 3);
        assert.equal(solutions.length, 1, `Heft-Rätsel ${puzzle.seed} ist nicht eindeutig`);
        assert.deepEqual(solutions[0], puzzle.solution);
      }
    }
  });
});
