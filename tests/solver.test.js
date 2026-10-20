import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildBoard } from '../js/board.js';
import { Solver, findSolutions, analyzeBoard, propagationStatus } from '../js/solver.js';

const island = (r, c, num) => ({ id: `${r}-${c}`, r, c, num });
const boardOf = (islands, cols = 6, rows = 6) => buildBoard(islands, cols, rows);

describe('Solver', () => {
  test('findet die einzige Lösung einer einfachen Kette', () => {
    // A(1,0)=1  B(1,2)=2  C(1,4)=1
    const board = boardOf([island(1, 0, 1), island(1, 2, 2), island(1, 4, 1)], 5, 3);
    const solutions = findSolutions(board, 5);
    assert.equal(solutions.length, 1);
    assert.deepEqual(solutions[0], [1, 1]);
  });

  test('erkennt Mehrdeutigkeit im 2x2-Block', () => {
    // Vier direkt benachbarte Inseln; zwei Lösungen sind möglich
    const board = boardOf([island(0, 0, 2), island(0, 1, 2), island(1, 0, 3), island(1, 1, 3)], 2, 2);
    const solutions = findSolutions(board, 10);
    assert.ok(solutions.length > 1, 'Block sollte mehrdeutig sein');
  });

  test('ein 2x2-Quadrat mit gleichen Zahlen ist eindeutig', () => {
    // Alle vier Inseln mit 2: die beiden "alternativen" Lösungen wären
    // nicht zusammenhängend und fallen damit weg.
    const board = boardOf([island(0, 0, 2), island(0, 1, 2), island(1, 0, 2), island(1, 1, 2)], 2, 2);
    assert.equal(findSolutions(board, 10).length, 1);
  });

  test('löst eine Doppelbrücke', () => {
    // Zwei Inseln, beide mit 2 -> Doppelbrücke ist die einzige Lösung
    const board = boardOf([island(1, 0, 2), island(1, 2, 2)], 3, 3);
    const solutions = findSolutions(board, 5);
    assert.equal(solutions.length, 1);
    assert.deepEqual(solutions[0], [2]);
  });

  test('erkennt ein unlösbares Brett', () => {
    // A(1,0)=1 und B(1,2)=3 -> drei Brücken sind zwischen zwei Inseln unmöglich
    const board = boardOf([island(1, 0, 1), island(1, 2, 3)], 3, 3);
    assert.equal(findSolutions(board, 5).length, 0);
  });

  test('löst ein Brett mit mehreren Inseln und Querbezügen', () => {
    const board = boardOf(
      [island(0, 0, 2), island(0, 2, 2), island(1, 0, 1), island(1, 2, 1)],
      3,
      2,
    );
    const solutions = findSolutions(board, 5);
    assert.equal(solutions.length, 1);
    const counts = solutions[0];
    // Die obere horizontale Kante trägt genau eine Brücke
    const top = board.edges.find((e) => e.dir === 'h' && e.r1 === 0);
    assert.equal(counts[board.edges.indexOf(top)], 1);
    // Die untere horizontale Kante bleibt leer, sonst wäre das Netz getrennt
    const bottom = board.edges.find((e) => e.dir === 'h' && e.r1 === 1);
    assert.equal(counts[board.edges.indexOf(bottom)], 0);
  });

  test('respektiert die maximale Anzahl von zwei Brücken pro Kante', () => {
    const board = boardOf([island(1, 0, 2), island(1, 2, 2)], 3, 3);
    const solutions = findSolutions(board, 1);
    assert.equal(solutions.length, 1);
    assert.ok(solutions[0].every((c) => c >= 0 && c <= 2));
  });

  test('verbindet alle Inseln in der Lösung', () => {
    const board = boardOf([island(1, 0, 1), island(1, 2, 2), island(1, 4, 1)], 5, 3);
    const solutions = findSolutions(board, 1);
    assert.equal(solutions.length, 1);
    const [solution] = solutions;
    // Jede Insel muss über Brücken erreichbar sein
    const adj = board.islands.map(() => []);
    board.edges.forEach((e, i) => {
      if (solution[i] > 0) {
        adj[e.a].push(e.b);
        adj[e.b].push(e.a);
      }
    });
    const seen = new Set([0]);
    const stack = [0];
    while (stack.length) {
      const cur = stack.pop();
      for (const nb of adj[cur]) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    assert.equal(seen.size, board.islands.length);
  });

  test('begrenzt die Suche auf die angeforderte Anzahl Lösungen', () => {
    const board = boardOf([island(0, 0, 2), island(0, 1, 2), island(1, 0, 3), island(1, 1, 3)], 2, 2);
    assert.equal(findSolutions(board, 1).length, 1);
    assert.ok(findSolutions(board, 2).length <= 2);
  });

  test('hasUniqueSolution() liefert true/false korrekt', () => {
    const unique = boardOf([island(1, 0, 1), island(1, 2, 2), island(1, 4, 1)], 5, 3);
    assert.equal(new Solver(unique).hasUniqueSolution(), true);

    const ambiguous = boardOf([island(0, 0, 2), island(0, 1, 2), island(1, 0, 3), island(1, 1, 3)], 2, 2);
    assert.equal(new Solver(ambiguous).hasUniqueSolution(), false);
  });
});

describe('analyzeBoard', () => {
  test('meldet Eindeutigkeit und Lösung', () => {
    const board = boardOf([island(1, 0, 1), island(1, 2, 2), island(1, 4, 1)], 5, 3);
    const result = analyzeBoard(board);
    assert.equal(result.unique, true);
    assert.equal(result.count, 1);
    assert.deepEqual(result.solution, [1, 1]);
  });

  test('meldet Mehrdeutigkeit', () => {
    const board = boardOf([island(0, 0, 2), island(0, 1, 2), island(1, 0, 3), island(1, 1, 3)], 2, 2);
    const result = analyzeBoard(board);
    assert.equal(result.unique, false);
    assert.ok(result.count > 1);
  });
});

describe('propagationStatus', () => {
  test('eine reine Kette ist allein durch Logik lösbar', () => {
    const board = boardOf([island(1, 0, 1), island(1, 2, 2), island(1, 4, 1)], 5, 3);
    const status = propagationStatus(board);
    assert.equal(status.consistent, true);
    assert.equal(status.complete, true);
    assert.deepEqual(status.counts, [1, 1]);
  });

  test('das mehrdeutige Quadrat wird nicht allein durch Logik aufgelöst', () => {
    const board = boardOf([island(0, 0, 2), island(0, 2, 2), island(2, 0, 2), island(2, 2, 2)], 3, 3);
    const status = propagationStatus(board);
    assert.equal(status.complete, false);
  });

  test('vollständige Propagation garantiert genau eine Lösung', () => {
    const board = boardOf(
      [island(0, 0, 1), island(0, 2, 2), island(1, 0, 1), island(1, 2, 1)],
      3,
      3,
    );
    const status = propagationStatus(board);
    if (status.complete) {
      assert.equal(findSolutions(board, 5).length, 1);
    }
  });
});
