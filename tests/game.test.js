import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../js/game.js';
import { buildBoard } from '../js/board.js';
import { generatePuzzle } from '../js/generator.js';

/** Brett mit drei Inseln in einer Reihe: Kanten e0 und e1. */
function simpleGame() {
  const board = buildBoard(
    [
      { id: 0, r: 0, c: 0, num: 1 },
      { id: 1, r: 0, c: 2, num: 2 },
      { id: 2, r: 0, c: 4, num: 1 },
    ],
    5,
    3,
  );
  return new Game(board, [1, 1]);
}

describe('Game – Brücken setzen', () => {
  test('setzt und entfernt Brücken', () => {
    const game = simpleGame();
    game.setBridge('e0', 1);
    assert.equal(game.bridges.get('e0'), 1);
    assert.equal(game.bridgeTotal, 1);

    game.setBridge('e0', 2);
    assert.equal(game.bridges.get('e0'), 2);
    assert.equal(game.bridgeTotal, 2);

    game.setBridge('e0', 0);
    assert.equal(game.bridges.has('e0'), false);
    assert.equal(game.bridgeTotal, 0);
  });

  test('cycleEdge schaltet 0 -> 1 -> 2 -> 0', () => {
    const game = simpleGame();
    game.cycleEdge('e0');
    assert.equal(game.bridges.get('e0'), 1);
    game.cycleEdge('e0');
    assert.equal(game.bridges.get('e0'), 2);
    game.cycleEdge('e0');
    assert.equal(game.bridges.has('e0'), false);
  });

  test('ein unveränderter Zug wird nicht protokolliert', () => {
    const game = simpleGame();
    game.setBridge('e0', 1);
    assert.equal(game.history.length, 1);
    game.setBridge('e0', 1);
    assert.equal(game.history.length, 1);
  });
});

describe('Game – Undo/Redo', () => {
  test('undo stellt den vorherigen Zustand wieder her', () => {
    const game = simpleGame();
    game.setBridge('e0', 1);
    game.setBridge('e1', 2);
    assert.equal(game.bridges.get('e0'), 1);
    assert.equal(game.bridges.get('e1'), 2);

    // Der letzte Zug (e1) wird zuerst zurückgenommen
    assert.equal(game.undo(), true);
    assert.equal(game.bridges.has('e1'), false, 'e1 hätte entfernt werden müssen');
    assert.equal(game.bridges.get('e0'), 1, 'e0 hätte unverändert bleiben müssen');

    assert.equal(game.undo(), true);
    assert.equal(game.bridges.has('e0'), false);
    assert.equal(game.bridgeTotal, 0);
  });

  test('undo bei leerem Verlauf tut nichts', () => {
    const game = simpleGame();
    assert.equal(game.undo(), false);
  });

  test('redo stellt den zurückgenommenen Zug wieder her', () => {
    const game = simpleGame();
    game.setBridge('e0', 2);
    game.undo();
    assert.equal(game.bridges.has('e0'), false);
    assert.equal(game.redo(), true);
    assert.equal(game.bridges.get('e0'), 2);
  });

  test('ein neuer Zug leert die Redo-Kette', () => {
    const game = simpleGame();
    game.setBridge('e0', 1);
    game.undo();
    assert.equal(game.future.length, 1);
    game.setBridge('e1', 1);
    assert.equal(game.future.length, 0);
  });

  test('undo/redo über mehrere Züge hinweg', () => {
    const game = simpleGame();
    game.setBridge('e0', 1);
    game.setBridge('e0', 2);
    game.setBridge('e1', 1);

    game.undo();
    assert.equal(game.bridges.has('e1'), false);
    game.undo();
    assert.equal(game.bridges.get('e0'), 1);
    game.undo();
    assert.equal(game.bridges.has('e0'), false);

    game.redo();
    assert.equal(game.bridges.get('e0'), 1);
    game.redo();
    assert.equal(game.bridges.get('e0'), 2);
    game.redo();
    assert.equal(game.bridges.get('e1'), 1);
  });
});

describe('Game – Prüfen und Hinweise', () => {
  test('check meldet falsche Brücken', () => {
    const game = simpleGame();
    game.setBridge('e0', 2); // falsch, Lösung ist 1
    const result = game.check();
    assert.equal(result.placed, 1);
    assert.equal(result.wrong, 1);
    assert.ok(game.wrong.has('e0'));
  });

  test('check meldet "alles korrekt"', () => {
    const game = simpleGame();
    game.setBridge('e0', 1);
    game.setBridge('e1', 1);
    const result = game.check();
    assert.equal(result.wrong, 0);
    assert.equal(result.placed, 2);
  });

  test('Hinweis ergänzt eine fehlende Brücke', () => {
    const game = simpleGame();
    const hint = game.hint();
    assert.ok(hint);
    assert.equal(hint.edgeId, 'e0');
    assert.equal(game.bridges.get('e0'), 1);
    assert.equal(game.hintsUsed, 1);
    assert.ok(game.hints.has('e0'));
  });

  test('Hinweis korrigiert zuerst eine falsche Brücke', () => {
    const game = simpleGame();
    game.setBridge('e0', 2);
    const hint = game.hint();
    assert.equal(hint.edgeId, 'e0');
    assert.equal(hint.from, 2);
    assert.equal(hint.to, 1);
    assert.equal(game.bridges.get('e0'), 1);
  });

  test('Hinweis bei vollständiger Lösung liefert null', () => {
    const game = simpleGame();
    game.setBridge('e0', 1);
    game.setBridge('e1', 1);
    assert.equal(game.hint(), null);
  });

  test('Hinweise lassen sich zurücknehmen', () => {
    const game = simpleGame();
    game.hint();
    assert.equal(game.bridges.get('e0'), 1);
    game.undo();
    assert.equal(game.bridges.has('e0'), false);
  });
});

describe('Game – Lösung und Sieg', () => {
  test('solve setzt die vollständige Lösung', () => {
    const game = simpleGame();
    game.solve();
    assert.equal(game.bridges.get('e0'), 1);
    assert.equal(game.bridges.get('e1'), 1);
    assert.equal(game.revealed, true);
  });

  test('isSolved erkennt die vollständige Lösung', () => {
    const game = simpleGame();
    assert.equal(game.isSolved(), false);
    game.solve();
    assert.equal(game.isSolved(), true);
  });

  test('isSolved bleibt falsch bei falschen Brücken', () => {
    const game = simpleGame();
    game.setBridge('e0', 2);
    game.setBridge('e1', 1);
    assert.equal(game.isSolved(), false);
  });

  test('reset leert das Brett', () => {
    const game = simpleGame();
    game.setBridge('e0', 1);
    game.reset();
    assert.equal(game.bridgeTotal, 0);
    assert.equal(game.history.length, 0);
    assert.equal(game.solved, false);
  });
});

describe('Game – mit echten Generator-Rätseln', () => {
  test('die Lösung des Rätsels führt zum Sieg', () => {
    const puzzle = generatePuzzle({ difficulty: 'easy', seed: 'GAME-TEST' });
    const board = buildBoard(
      puzzle.islands.map((i) => ({ id: i.id, r: i.r, c: i.c, num: i.num })),
      puzzle.cols,
      puzzle.rows,
    );
    const game = new Game(board, puzzle.solution);

    // Lösung in beliebiger Reihenfolge setzen
    for (const [edgeId, count] of game.solution) {
      if (count > 0) game.setBridge(edgeId, count);
    }
    assert.equal(game.isSolved(), true);
    assert.equal(game.check().wrong, 0);
  });

  test('ein falscher Zug verhindert den Sieg', () => {
    const puzzle = generatePuzzle({ difficulty: 'easy', seed: 'GAME-TEST-2' });
    const board = buildBoard(
      puzzle.islands.map((i) => ({ id: i.id, r: i.r, c: i.c, num: i.num })),
      puzzle.cols,
      puzzle.rows,
    );
    const game = new Game(board, puzzle.solution);
    const first = game.solution.get('e0') ?? 0;
    game.setBridge('e0', first === 1 ? 2 : 1);
    assert.equal(game.isSolved(), false);
  });
});
