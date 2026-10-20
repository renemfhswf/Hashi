import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  PAGE,
  GAP,
  MIN_CELL_MM,
  cellSizeMm,
  bestLayout,
  groupIntoPages,
} from '../js/layout.js';

const puzzle = (cols, rows) => ({ cols, rows });

describe('Rätselheft – Seitenaufteilung', () => {
  test('A6-Nutzfläche passt in das Blatt', () => {
    assert.ok(PAGE.width <= 105, 'Nutzfläche darf nicht breiter als A6 sein');
    assert.ok(PAGE.height <= 148, 'Nutzfläche darf nicht höher als A6 sein');
    assert.ok(GAP > 0);
  });

  test('ein einzelnes Rätsel nutzt die ganze Seite', () => {
    const size = cellSizeMm(puzzle(9, 9), 'row', 1);
    assert.ok(size > 8, `erwartet > 8 mm, war ${size.toFixed(2)}`);
  });

  test('zwei Rätsel nebeneinander sind kleiner als allein', () => {
    const single = cellSizeMm(puzzle(9, 9), 'row', 1);
    const stacked = cellSizeMm(puzzle(9, 9), 'row', 2);
    const side = cellSizeMm(puzzle(9, 9), 'col', 2);
    assert.ok(stacked < single);
    assert.ok(side < single);
  });

  test('breite Raster werden gestapelt, hohe nebeneinander', () => {
    // Sehr breites Raster: stapeln bringt mehr
    assert.equal(bestLayout([puzzle(14, 4), puzzle(14, 4)]), 'row');
    // Sehr hohes Raster: nebeneinander bringt mehr
    assert.equal(bestLayout([puzzle(4, 14), puzzle(4, 14)]), 'col');
  });

  test('ein einzelnes Rätsel nutzt die Zeilen-Anordnung', () => {
    assert.equal(bestLayout([puzzle(9, 9)]), 'row');
  });

  test('hochaufgelöste Rätsel landen einzeln auf einer Seite', () => {
    const pages = groupIntoPages([puzzle(14, 13), puzzle(14, 13), puzzle(14, 13)], 2);
    assert.equal(pages.length, 3, 'jedes Rätsel braucht eine eigene Seite');
    assert.ok(pages.every((p) => p.length === 1));
  });

  test('kleinere Rätsel teilen sich die Seite', () => {
    const pages = groupIntoPages([puzzle(6, 5), puzzle(6, 5), puzzle(6, 5), puzzle(6, 5)], 2);
    assert.equal(pages.length, 2);
    assert.ok(pages.every((p) => p.length === 2));
  });

  test('maxPerPage = 1 erzwingt eine Seite pro Rätsel', () => {
    const pages = groupIntoPages([puzzle(6, 5), puzzle(6, 5), puzzle(6, 5)], 1);
    assert.equal(pages.length, 3);
    assert.ok(pages.every((p) => p.length === 1));
  });

  test('alle Rätsel landen auf genau einer Seite', () => {
    const puzzles = [puzzle(6, 5), puzzle(9, 7), puzzle(12, 11), puzzle(7, 6)];
    const pages = groupIntoPages(puzzles, 2);
    const flat = pages.flat();
    assert.equal(flat.length, puzzles.length);
    assert.deepEqual(flat, puzzles, 'Reihenfolge und Inhalt bleiben erhalten');
  });

  test('keine Seite enthält mehr als zwei Rätsel', () => {
    const puzzles = Array.from({ length: 20 }, (_, i) => puzzle(4 + (i % 8), 4 + (i % 7)));
    const pages = groupIntoPages(puzzles, 2);
    assert.ok(pages.every((p) => p.length <= 2));
  });

  test('die Schwelle für lesbare Rasterzellen wird eingehalten', () => {
    // Ein Raster, das unterhalb der Schwelle liegt, muss einzeln gedruckt werden
    const tiny = puzzle(20, 20);
    assert.ok(cellSizeMm(tiny, 'row', 2) < MIN_CELL_MM);
    const pages = groupIntoPages([tiny, tiny], 2);
    assert.equal(pages.length, 2);
  });
});
