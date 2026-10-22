import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  LEVEL_BANDS,
  METRICS,
  bandDistance,
  gridFor,
  achievableRange,
  label,
} from '../js/difficulty.js';
import { CALIBRATION } from '../js/data/difficulty.js';
import { generatePuzzle, BOOKLET_FORMAT } from '../js/generator.js';
import { buildBoard } from '../js/board.js';
import { findSolutions } from '../js/solver.js';

describe('Schwierigkeitsbänder', () => {
  test('die Bänder sind lückenlos und überdecken [0, 1]', () => {
    const bands = Object.values(LEVEL_BANDS);
    assert.equal(bands[0][0], 0);
    assert.equal(bands[bands.length - 1][1], 1);
    for (let i = 1; i < bands.length; i++) {
      assert.ok(
        Math.abs(bands[i][0] - bands[i - 1][1]) < 0.01,
        `Lücke zwischen ${bands[i - 1][1]} und ${bands[i][0]}`,
      );
    }
  });

  test('bandDistance misst den Abstand zum Band', () => {
    assert.equal(bandDistance(0.5, [0.4, 0.6]), 0);
    assert.ok(Math.abs(bandDistance(0.3, [0.4, 0.6]) - 0.1) < 1e-9);
    assert.ok(Math.abs(bandDistance(0.7, [0.4, 0.6]) - 0.1) < 1e-9);
    assert.equal(bandDistance(0.5, null), 0);
  });

  test('gridFor hält die gewünschte Dichte ein', () => {
    const [cols, rows] = gridFor(100, 16);
    assert.equal(cols, rows);
    const cells = cols * rows;
    assert.ok(cells >= 100 && cells < 100 * 16 * 1.3, `unerwartete Dichte: ${cells}`);
  });

  test('jede Inselzahl-Bündel kennt seinen erreichbaren Bereich', () => {
    for (const [id, entry] of Object.entries(CALIBRATION.buckets)) {
      const range = achievableRange(entry);
      assert.ok(range[0] <= range[1], `Bereich verdreht in ${id}`);
      assert.ok(range[0] >= 0 && range[1] <= 1, `Bereich ausserhalb [0,1] in ${id}`);
    }
  });
});

describe('Generator mit Schwierigkeitsvorgabe', () => {
  test('das Zielband wird bei einer machbaren Kombination getroffen', () => {
    // 40 Inseln im Band "mittel" sind gut erreichbar.
    const band = LEVEL_BANDS.medium;
    for (let i = 0; i < 3; i++) {
      const puzzle = generatePuzzle({
        difficulty: 'medium',
        seed: `ZIEL-${i}`,
        islands: 40,
        format: BOOKLET_FORMAT,
        keep: 1,
        target: 'medium',
      });
      assert.ok(
        puzzle.difficultyScore >= band[0] && puzzle.difficultyScore <= band[1],
        `Schwierigkeit ${puzzle.difficultyScore} ausserhalb ${band}`,
      );
      // und es bleibt ein gültiges Rätsel
      const board = buildBoard(
        puzzle.islands.map((x) => ({ id: x.id, r: x.r, c: x.c, num: x.num })),
        puzzle.cols,
        puzzle.rows,
      );
      assert.equal(findSolutions(board, 2).length, 1);
    }
  });

  test('ohne Vorgabe wird die Schwierigkeit trotzdem gemessen', () => {
    const puzzle = generatePuzzle({ difficulty: 'medium', seed: 'OHNE' });
    assert.ok(puzzle.difficultyScore >= 0 && puzzle.difficultyScore <= 1);
    assert.equal(typeof puzzle.difficultyText, 'string');
  });

  test('die gemessene Stufe passt zum Wert', () => {
    const puzzle = generatePuzzle({ difficulty: 'hard', seed: 'TEXTE' });
    const b = CALIBRATION.bands;
    const erwartet = label(puzzle.difficultyScore, b);
    assert.equal(puzzle.difficultyText, erwartet);
  });
});
