import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildBoard, edgesCross, isConnected, findIslandAt } from '../js/board.js';

const island = (r, c, num) => ({ id: `${r}-${c}`, r, c, num });

describe('buildBoard', () => {
  test('bildet Kanten zwischen benachbarten Inseln einer Zeile', () => {
    const board = buildBoard([island(0, 0, 1), island(0, 2, 1), island(0, 4, 1)], 5, 3);
    const horizontal = board.edges.filter((e) => e.dir === 'h');
    assert.equal(horizontal.length, 2);
    assert.deepEqual(
      horizontal.map((e) => [e.c1, e.c2]),
      [
        [0, 2],
        [2, 4],
      ],
    );
  });

  test('bildet Kanten zwischen benachbarten Inseln einer Spalte', () => {
    const board = buildBoard([island(0, 1, 1), island(2, 1, 1), island(4, 1, 1)], 3, 5);
    const vertical = board.edges.filter((e) => e.dir === 'v');
    assert.equal(vertical.length, 2);
  });

  test('überspringt Inseln: nur direkte Nachbarn werden verbunden', () => {
    // Inseln bei c=0, c=2 und c=4 -> zwei Kanten, nicht eine von 0 nach 4
    const board = buildBoard([island(0, 0, 1), island(0, 2, 1), island(0, 4, 1)], 5, 3);
    assert.equal(board.edges.length, 2);
    for (const e of board.edges) {
      assert.equal(Math.abs(e.c2 - e.c1), 2);
    }
  });

  test('erkennt sich kreuzende Kanten', () => {
    // Waagerechte Kante in Zeile 1, senkrechte Kante in Spalte 2 über Zeile 1
    const board = buildBoard([island(1, 0, 1), island(1, 4, 1), island(0, 2, 1), island(2, 2, 1)], 5, 3);
    const h = board.edges.find((e) => e.dir === 'h');
    const v = board.edges.find((e) => e.dir === 'v');
    assert.ok(h && v);
    assert.ok(edgesCross(h, v), 'horizontale und vertikale Kante sollten sich kreuzen');
  });

  test('parallel verlaufende Kanten kreuzen sich nicht', () => {
    const board = buildBoard([island(0, 0, 1), island(0, 4, 1), island(2, 0, 1), island(2, 4, 1)], 5, 3);
    for (let i = 0; i < board.edges.length; i++) {
      for (let j = i + 1; j < board.edges.length; j++) {
        assert.ok(!edgesCross(board.edges[i], board.edges[j]));
      }
    }
  });

  test('Kanten, die sich nur am Rand berühren, kreuzen sich nicht', () => {
    const board = buildBoard([island(0, 0, 1), island(0, 2, 1), island(2, 2, 1)], 3, 3);
    for (let i = 0; i < board.edges.length; i++) {
      for (let j = i + 1; j < board.edges.length; j++) {
        assert.ok(!edgesCross(board.edges[i], board.edges[j]));
      }
    }
  });

  test('Inzidenz- und Nachbarschaftslisten stimmen', () => {
    const board = buildBoard([island(0, 0, 1), island(0, 2, 1), island(2, 0, 1)], 3, 3);
    assert.equal(board.incident.length, 3);
    assert.equal(board.incident[0].length, 2, 'Insel (0,0) hat zwei Kanten');
    assert.equal(board.incident[1].length, 1, 'Insel (0,2) hat eine Kante');
    assert.equal(board.incident[2].length, 1, 'Insel (2,0) hat eine Kante');
    assert.equal(board.neighbors[0].length, 2);
  });

  test('Kanten-IDs sind eindeutig', () => {
    const board = buildBoard(
      [island(0, 0, 1), island(0, 2, 1), island(2, 2, 1), island(4, 0, 1), island(4, 2, 1)],
      3,
      5,
    );
    const ids = new Set(board.edges.map((e) => e.id));
    assert.equal(ids.size, board.edges.length);
  });
});

describe('isConnected', () => {
  test('erkennt ein vollständig verbundenes Netz', () => {
    const board = buildBoard([island(0, 0, 1), island(0, 2, 1), island(0, 4, 1)], 5, 3);
    assert.equal(isConnected(board, [1, 1]), true);
  });

  test('erkennt ein getrenntes Netz', () => {
    const board = buildBoard([island(0, 0, 1), island(0, 2, 1), island(0, 4, 1)], 5, 3);
    assert.equal(isConnected(board, [1, 0]), false);
    assert.equal(isConnected(board, [0, 0]), false);
  });

  test('leeres Brett gilt als verbunden', () => {
    const board = buildBoard([], 3, 3);
    assert.equal(isConnected(board, []), true);
  });
});

describe('findIslandAt', () => {
  test('findet Inseln anhand ihrer Koordinaten', () => {
    const islands = [island(1, 1, 3), island(2, 4, 5)];
    assert.equal(findIslandAt(islands, 1, 1).num, 3);
    assert.equal(findIslandAt(islands, 2, 4).num, 5);
    assert.equal(findIslandAt(islands, 0, 0), null);
  });
});
