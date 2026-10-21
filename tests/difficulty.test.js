import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  METRICS,
  WEIGHTS,
  BUCKETS,
  bucketFor,
  measure,
  score,
  label,
} from '../js/difficulty.js';
import { CALIBRATION } from '../js/data/difficulty.js';
import { buildBoard } from '../js/board.js';
import { Solver } from '../js/solver.js';
import { generatePuzzle, DIFFICULTY_IDS } from '../js/generator.js';

describe('Schwierigkeitsmessung', () => {
  test('die Gewichte summieren sich auf 1', () => {
    const sum = Object.values(WEIGHTS).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - 1) < 1e-9, `Gewichte summieren auf ${sum}`);
    for (const metric of METRICS) {
      assert.ok(WEIGHTS[metric] > 0, `${metric} ohne Gewicht`);
    }
  });

  test('jedes Inselzahl-Bündel hat Kalibrierdaten', () => {
    assert.ok(CALIBRATION.global, 'globale Referenzbereiche fehlen');
    for (const metric of METRICS) {
      const range = CALIBRATION.global[metric];
      assert.ok(Array.isArray(range), `${metric} fehlt in den globalen Referenzen`);
      assert.ok(range[0] <= range[1], `Bereich verdreht: ${metric}`);
    }
    for (const bucket of BUCKETS) {
      const entry = CALIBRATION.buckets[bucket.id];
      assert.ok(entry, `Kalibrierdaten für ${bucket.id} fehlen`);
      for (const metric of METRICS) {
        assert.ok(Array.isArray(entry[metric]), `${metric} fehlt in ${bucket.id}`);
        assert.ok(entry[metric][0] <= entry[metric][1], `Bereich verdreht in ${bucket.id}`);
      }
    }
  });

  test('die Bänder für die Beschriftung sind aufsteigend', () => {
    assert.ok(Array.isArray(CALIBRATION.bands), 'Bänder fehlen');
    assert.equal(CALIBRATION.bands.length, 4);
    for (let i = 1; i < CALIBRATION.bands.length; i++) {
      assert.ok(CALIBRATION.bands[i] > CALIBRATION.bands[i - 1], 'Bänder nicht aufsteigend');
    }
  });

  test('bucketFor bildet die Bündel korrekt ab', () => {
    assert.equal(bucketFor(5), '10-19');
    assert.equal(bucketFor(12), '10-19');
    assert.equal(bucketFor(19), '10-19');
    assert.equal(bucketFor(20), '20-29');
    assert.equal(bucketFor(50), '40-59');
    assert.equal(bucketFor(100), '80-120');
    assert.equal(bucketFor(500), '80-120');
  });

  test('die Metriken liegen in sinnvollen Bereichen', () => {
    const puzzle = generatePuzzle({ difficulty: 'medium', seed: 'METRIK' });
    const board = buildBoard(
      puzzle.islands.map((i) => ({ id: i.id, r: i.r, c: i.c, num: i.num })),
      puzzle.cols,
      puzzle.rows,
    );
    const solver = new Solver(board);
    solver.findSolutions(2);
    const m = measure(board, solver, solver.ruleSteps);
    assert.ok(m.nodes >= 0, 'Knotenlogarithmus negativ');
    assert.ok(m.logicShare >= 0 && m.logicShare <= 1, `Logikanteil ${m.logicShare}`);
    assert.ok(m.avgNumber >= 1 && m.avgNumber <= 8, `mittlere Zahl ${m.avgNumber}`);
    assert.ok(m.density > 0 && m.density < 1, `Dichte ${m.density}`);
  });

  test('score liefert einen Wert zwischen 0 und 1', () => {
    const puzzle = generatePuzzle({ difficulty: 'hard', seed: 'SCORE' });
    const board = buildBoard(
      puzzle.islands.map((i) => ({ id: i.id, r: i.r, c: i.c, num: i.num })),
      puzzle.cols,
      puzzle.rows,
    );
    const solver = new Solver(board);
    solver.findSolutions(2);
    const m = measure(board, solver, solver.ruleSteps);
    const s = score(m, CALIBRATION.global);
    assert.ok(s >= 0 && s <= 1, `Score ${s} ausserhalb [0,1]`);
  });

  test('score bleibt bei fehlenden Kalibrierdaten im gültigen Bereich', () => {
    const s = score({ nodes: 1, logicShare: 0.5, avgNumber: 2, density: 0.2 }, null);
    assert.equal(s, 0.5);
  });

  test('ein leichteres Rätsel bekommt einen niedrigeren Wert', () => {
    // Gleiche Metriken, aber mehr Logikanteil -> leichter
    const bounds = CALIBRATION.buckets['20-29'];
    const leicht = score({ ...bounds, nodes: bounds.nodes[0], logicShare: 1, avgNumber: 2, density: 0.2 }, bounds);
    const schwer = score({ ...bounds, nodes: bounds.nodes[1], logicShare: 0.1, avgNumber: 2, density: 0.2 }, bounds);
    assert.ok(leicht < schwer, `${leicht} sollte kleiner als ${schwer} sein`);
  });

  test('die Beschriftung passt zum Wert', () => {
    const b = CALIBRATION.bands;
    assert.equal(label(b[0] - 0.01, b), 'sehr leicht');
    assert.equal(label(b[1] - 0.01, b), 'leicht');
    assert.equal(label(b[2] - 0.01, b), 'mittel');
    assert.equal(label(b[3] - 0.01, b), 'schwer');
    assert.equal(label(b[3] + 0.01, b), 'sehr schwer');
  });
});

describe('Schwierigkeitsgrad der erzeugten Rätsel', () => {
  test('jede Stufe liefert einen gültigen Wert', () => {
    for (const difficulty of DIFFICULTY_IDS) {
      const puzzle = generatePuzzle({ difficulty, seed: `SW-${difficulty}` });
      assert.ok(
        puzzle.difficultyScore >= 0 && puzzle.difficultyScore <= 1,
        `${difficulty}: Schwierigkeit ${puzzle.difficultyScore}`,
      );
      assert.equal(typeof puzzle.difficultyText, 'string');
      assert.equal(puzzle.difficulty, difficulty, 'die Stufen-Kennung bleibt unveraendert');
      assert.ok(puzzle.difficultyText.length > 0);
    }
  });

  test('grössere Rätsel sind im Schnitt schwerer', () => {
    const leicht = [];
    const schwer = [];
    for (let i = 0; i < 5; i++) {
      leicht.push(generatePuzzle({ difficulty: 'easy', seed: `VGL-${i}` }).difficultyScore);
      schwer.push(generatePuzzle({ difficulty: 'expert', seed: `VGH-${i}` }).difficultyScore);
    }
    const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
    assert.ok(
      avg(schwer) > avg(leicht),
      `Experte (${avg(schwer).toFixed(2)}) sollte schwerer sein als Leicht (${avg(leicht).toFixed(2)})`,
    );
  });

  test('die gemessene Schwierigkeit steigt mit der Inselzahl', () => {
    // Gleiche Stufe, aber wachsende Inselzahl -> steigender Wert
    const werte = [];
    for (const n of [14, 24, 35, 50]) {
      const p = generatePuzzle({ difficulty: 'medium', seed: `RAMP-${n}`, islands: n, keep: 1 });
      werte.push(p.difficultyScore);
    }
    for (let i = 1; i < werte.length; i++) {
      assert.ok(
        werte[i] > werte[i - 1],
        `Werte sollten steigen: ${werte.map((v) => v.toFixed(2)).join(' -> ')}`,
      );
    }
  });
});
