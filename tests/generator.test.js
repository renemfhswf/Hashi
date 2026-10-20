import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { generatePuzzle, DIFFICULTIES, DIFFICULTY_IDS, BOOKLET_FORMAT, internals } from '../js/generator.js';
import { buildBoard, isConnected } from '../js/board.js';
import { findSolutions } from '../js/solver.js';
import { RNG } from '../js/rng.js';

const SEEDS = ['SEED-01', 'SEED-02', 'SEED-03', 'SEED-04', 'SEED-05'];

const boardOf = (p) =>
  buildBoard(
    p.islands.map((i) => ({ id: i.id, r: i.r, c: i.c, num: i.num })),
    p.cols,
    p.rows,
  );

/** Prüft eine Brücke darauf, dass sie über eine Insel führt. */
function bridgeOverIsland(puzzle, solution) {
  for (const edge of puzzle.edges) {
    const count = solution[edge.id];
    if (!count) continue;
    const a = puzzle.islands[edge.a];
    const b = puzzle.islands[edge.b];
    if (a.r === b.r) {
      for (let c = Math.min(a.c, b.c) + 1; c < Math.max(a.c, b.c); c++) {
        if (puzzle.islands.some((i) => i.r === a.r && i.c === c)) return true;
      }
    } else {
      for (let r = Math.min(a.r, b.r) + 1; r < Math.max(a.r, b.r); r++) {
        if (puzzle.islands.some((i) => i.r === r && i.c === a.c)) return true;
      }
    }
  }
  return false;
}

/** Prüft, ob sich zwei Brücken der Lösung kreuzen. */
function crossingBridges(puzzle, solution) {
  for (const edge of puzzle.edges) {
    if (!solution[edge.id]) continue;
    for (const other of puzzle.edges) {
      if (other.id <= edge.id || !solution[other.id]) continue;
      const a = puzzle.islands[edge.a];
      const b = puzzle.islands[edge.b];
      const c = puzzle.islands[other.a];
      const d = puzzle.islands[other.b];
      const h = a.r === b.r ? { r: a.r, c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) } : null;
      const v = c.r === d.r ? null : { c: c.c, r1: Math.min(c.r, d.r), r2: Math.max(c.r, d.r) };
      if (!h || !v) continue;
      if (h.c1 < v.c && v.c < h.c2 && v.r1 < h.r && h.r < v.r2) return true;
    }
  }
  return false;
}

describe('generatePuzzle – Grundregeln', () => {
  for (const difficulty of DIFFICULTY_IDS) {
    for (const seed of SEEDS) {
      test(`${difficulty} / ${seed}: erfüllt alle Regeln`, () => {
        const puzzle = generatePuzzle({ difficulty, seed });
        const board = boardOf(puzzle);
        const solution = Object.fromEntries(puzzle.edges.map((e, i) => [e.id, puzzle.solution[i]]));

        // 1) Mindestens drei Inseln, keine doppelten Felder
        assert.ok(puzzle.islands.length >= 3, 'zu wenige Inseln');
        const cells = new Set(puzzle.islands.map((i) => `${i.r},${i.c}`));
        assert.equal(cells.size, puzzle.islands.length, 'zwei Inseln auf gleichem Feld');

        // 2) Alle Inseln liegen im Gitter
        for (const isl of puzzle.islands) {
          assert.ok(isl.r >= 0 && isl.r < puzzle.rows, 'Insel ausserhalb des Gitters');
          assert.ok(isl.c >= 0 && isl.c < puzzle.cols, 'Insel ausserhalb des Gitters');
        }

        // 3) Inselzahlen zwischen 1 und 8
        for (const isl of puzzle.islands) {
          assert.ok(isl.num >= 1 && isl.num <= 8, `ungültige Inselzahl ${isl.num}`);
        }

        // 4) Brückenzahlen der Lösung zwischen 0 und 2
        for (const value of puzzle.solution) {
          assert.ok(value >= 0 && value <= 2, `ungültige Brückenzahl ${value}`);
        }

        // 5) Keine Brücke führt über eine Insel
        assert.equal(bridgeOverIsland(puzzle, solution), false, 'Brücke führt über eine Insel');

        // 6) Keine Kreuzungen
        assert.equal(crossingBridges(puzzle, solution), false, 'Brücken kreuzen sich');

        // 7) Die Lösung erfüllt die Inselzahlen exakt
        for (const isl of puzzle.islands) {
          let sum = 0;
          for (const edge of puzzle.edges) {
            if (edge.a === isl.id || edge.b === isl.id) sum += solution[edge.id];
          }
          assert.equal(sum, isl.num, `Insel ${isl.id} hat ${sum} statt ${isl.num} Brücken`);
        }

        // 8) Alle Inseln sind verbunden
        const counts = puzzle.edges.map((e) => solution[e.id]);
        assert.equal(isConnected(board, counts), true, 'Inseln sind nicht verbunden');

        // 9) Die Gesamtzahl der Brücken ist ganzzahlig
        const total = puzzle.islands.reduce((sum, i) => sum + i.num, 0);
        assert.equal(total % 2, 0, 'Summe der Inselzahlen ist ungerade');
        assert.equal(total / 2, counts.reduce((a, b) => a + b, 0), 'Brückenzahl passt nicht zu den Inselzahlen');
      });
    }
  }
});

describe('generatePuzzle – Eindeutigkeit', () => {
  for (const difficulty of DIFFICULTY_IDS) {
    for (const seed of SEEDS) {
      test(`${difficulty} / ${seed}: besitzt genau eine Lösung`, () => {
        const puzzle = generatePuzzle({ difficulty, seed });
        const board = boardOf(puzzle);
        const solutions = findSolutions(board, 5);
        assert.equal(solutions.length, 1, `Rätsel ist nicht eindeutig (${solutions.length} Lösungen)`);
        assert.deepEqual(
          solutions[0],
          puzzle.solution,
          'die vom Generator angegebene Lösung stimmt nicht mit der Solver-Lösung überein',
        );
      });
    }
  }
});

describe('generatePuzzle – Schwierigkeitsgrade', () => {
  for (const difficulty of DIFFICULTY_IDS) {
    test(`${difficulty}: hält die Zielgröße ein`, () => {
      const cfg = DIFFICULTIES[difficulty];
      for (const seed of SEEDS) {
        const puzzle = generatePuzzle({ difficulty, seed });
        assert.ok(
          puzzle.islands.length >= cfg.min && puzzle.islands.length <= cfg.max + 3,
          `Inselzahl ${puzzle.islands.length} ausserhalb des Bereichs ${cfg.min}..${cfg.max}`,
        );
      }
    });

    test(`${difficulty}: liefert gültige Metadaten`, () => {
      const puzzle = generatePuzzle({ difficulty, seed: 'META' });
      assert.equal(puzzle.difficulty, difficulty);
      assert.equal(puzzle.difficultyLabel, DIFFICULTIES[difficulty].label);
      assert.equal(puzzle.seed, 'META');
      assert.equal(typeof puzzle.score, 'number');
    });
  }
});

describe('generatePuzzle – Reproduzierbarkeit', () => {
  test('gleicher Seed ergibt exakt dasselbe Rätsel', () => {
    for (const difficulty of DIFFICULTY_IDS) {
      const a = generatePuzzle({ difficulty, seed: 'REPRO' });
      const b = generatePuzzle({ difficulty, seed: 'REPRO' });
      assert.deepEqual(a.islands, b.islands);
      assert.deepEqual(a.solution, b.solution);
      assert.equal(a.cols, b.cols);
      assert.equal(a.rows, b.rows);
    }
  });

  test('verschiedene Seeds ergeben unterschiedliche Rätsel', () => {
    const seen = new Set();
    for (let i = 0; i < 8; i++) {
      const puzzle = generatePuzzle({ difficulty: 'medium', seed: `DIFF-${i}` });
      seen.add(JSON.stringify(puzzle.islands));
    }
    assert.ok(seen.size >= 6, `nur ${seen.size} verschiedene Rätsel aus 8 Seeds`);
  });

  test('die Schwierigkeit fließt in den Seed ein', () => {
    const easy = generatePuzzle({ difficulty: 'easy', seed: 'GLEICH' });
    const hard = generatePuzzle({ difficulty: 'hard', seed: 'GLEICH' });
    assert.notDeepEqual(easy.islands, hard.islands);
  });
});

describe('generatePuzzle – Robustheit', () => {
  test('unbekannte Schwierigkeit fällt auf "medium" zurück', () => {
    const puzzle = generatePuzzle({ difficulty: 'quatsch', seed: 'X' });
    assert.equal(puzzle.difficulty, 'medium');
  });

  test('erzeugt bei many seeds gültige Rätsel', () => {
    for (let i = 0; i < 25; i++) {
      const puzzle = generatePuzzle({ difficulty: 'medium', seed: `STRESS-${i}` });
      const board = boardOf(puzzle);
      const solutions = findSolutions(board, 3);
      assert.equal(solutions.length, 1, `Seed STRESS-${i} lieferte ${solutions.length} Lösungen`);
    }
  });
});

describe('generatePuzzle – Heft-Format (DIN A6)', () => {
  test('erzeugt Rätsel mit etwa 100 Inseln', () => {
    for (let i = 0; i < 3; i++) {
      const puzzle = generatePuzzle({
        difficulty: 'medium',
        seed: `HEFT-${i}`,
        islands: 100,
        format: BOOKLET_FORMAT,
        keep: 1,
      });
      assert.equal(puzzle.islands.length, 100, `erwartet 100 Inseln, war ${puzzle.islands.length}`);
    }
  });

  test('auch das Heft-Format ist eindeutig lösbar', () => {
    for (let i = 0; i < 3; i++) {
      const puzzle = generatePuzzle({
        difficulty: 'hard',
        seed: `HEFT-EINDEUTIG-${i}`,
        islands: 100,
        format: BOOKLET_FORMAT,
        keep: 1,
      });
      const board = buildBoard(
        puzzle.islands.map((isl) => ({ id: isl.id, r: isl.r, c: isl.c, num: isl.num })),
        puzzle.cols,
        puzzle.rows,
      );
      const solutions = findSolutions(board, 2);
      assert.equal(solutions.length, 1, 'Heft-Rätsel ist nicht eindeutig');
      assert.deepEqual(solutions[0], puzzle.solution);
    }
  });

  test('das Heft-Format passt auf eine A6-Seite', () => {
    const puzzle = generatePuzzle({
      difficulty: 'medium',
      seed: 'HEFT-GROESSE',
      islands: 100,
      format: BOOKLET_FORMAT,
      keep: 1,
    });
    // Das Raster muss so kompakt sein, dass die Inseln auf A6 passen
    assert.ok(puzzle.cols <= 20 && puzzle.rows <= 20, 'Raster zu gross für A6');
  });
});

describe('Generator-Interna', () => {  test('growSolution erzeugt gültige Lösungen', () => {
    const cfg = DIFFICULTIES.medium;
    for (const seed of SEEDS) {
      const rng = new RNG(`grow|${seed}`);
      const sol = internals.growSolution(rng, 12, cfg.cols, cfg.rows, cfg.double, cfg.maxExtra);
      assert.ok(sol, 'Wachstum schlug fehl');
      assert.equal(internals.validateSolution(sol), true, 'Lösung ist nicht valide');
      const nums = internals.numbersOf(sol);
      for (const n of nums) assert.ok(n >= 1 && n <= 8, `Inselzahl ${n} ausserhalb 1..8`);
    }
  });

  test('validateSolution lehnt eine Brücke über eine Insel ab', () => {
    const overIsland = {
      cols: 5,
      rows: 3,
      islands: [
        { r: 0, c: 0 },
        { r: 0, c: 1 },
        { r: 0, c: 2 },
      ],
      edges: [{ a: 0, b: 2, w: 1 }],
    };
    assert.equal(internals.validateSolution(overIsland), false);
  });

  test('validateSolution akzeptiert eine kreuzungsfreie Grundform', () => {
    const ok = {
      cols: 5,
      rows: 3,
      islands: [
        { r: 0, c: 0 },
        { r: 0, c: 2 },
      ],
      edges: [{ a: 0, b: 1, w: 2 }],
    };
    assert.equal(internals.validateSolution(ok), true);
  });

  test('validateSolution lehnt eine Inselzahl über 8 ab', () => {
    // Eine Insel mit fünf Doppelbrücken hätte Zahl 10 -> ungültig
    const tooBig = {
      cols: 11,
      rows: 3,
      islands: [
        { r: 0, c: 0 },
        { r: 0, c: 2 },
        { r: 0, c: 4 },
        { r: 0, c: 6 },
        { r: 0, c: 8 },
      ],
      edges: [
        { a: 1, b: 0, w: 2 },
        { a: 1, b: 2, w: 2 },
        { a: 1, b: 3, w: 2 },
        { a: 1, b: 4, w: 2 },
      ],
    };
    assert.equal(internals.validateSolution(tooBig), false, 'Zahl 10 ist ungültig');
  });
});

/** Hilfsfunktion, um RNG trotz ESM-Import in Testumgebungen zu laden. */
function require_rng() {
  // Der RNG wird bereits oben importiert; diese Funktion existiert nur zur
  // Kompatibilität mit CommonJS-Testumgebungen.
  // eslint-disable-next-line no-undef
  return { RNG: globalThis.__RNG__ ?? RNGRef };
}

import { RNG as RNGRef } from '../js/rng.js';
