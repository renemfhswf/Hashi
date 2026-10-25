import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PAGE, CHROME, availableBox, cellSizeMm, pagesOf } from '../js/layout.js';

const puzzle = (cols, rows) => ({ cols, rows });

describe('Rätselheft – Seitenaufteilung', () => {
  test('die Nutzfläche passt in eine A5-Seite', () => {
    assert.ok(PAGE.width <= 148, 'Nutzfläche darf nicht breiter als A5 sein');
    assert.ok(PAGE.height <= 210, 'Nutzfläche darf nicht höher als A5 sein');
    // Der Platz wird auch ausgenutzt (6 mm Rand ringsum).
    assert.ok(PAGE.width >= 130, `Nutzbreite nur ${PAGE.width} mm`);
    assert.ok(PAGE.height >= 190, `Nutzhöhe nur ${PAGE.height} mm`);
  });

  test('das Spielfeld lässt Platz für die Fusszeile', () => {
    const box = availableBox();
    assert.equal(box.width, PAGE.width);
    assert.ok(box.height < PAGE.height);
    assert.ok(box.height > PAGE.height - 2 * CHROME);
  });

  test('ein grosses Raster bleibt lesbar', () => {
    // 23 × 21 ist das grösste Heft-Raster.
    const size = cellSizeMm(puzzle(23, 21));
    assert.ok(size >= 5.5, `Rasterzelle nur ${size.toFixed(2)} mm`);
  });

  test('pro Seite steht genau ein Rätsel', () => {
    const puzzles = [puzzle(6, 5), puzzle(9, 7), puzzle(12, 11)];
    const pages = pagesOf(puzzles);
    assert.equal(pages.length, 3);
    assert.ok(pages.every((page) => page.length === 1));
    assert.deepEqual(pages.flat(), puzzles, 'Reihenfolge und Inhalt bleiben erhalten');
  });

  test('ohne Rätsel entstehen keine Seiten', () => {
    assert.deepEqual(pagesOf([]), []);
  });
});
