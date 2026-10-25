import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { impose, PAGES_PER_SHEET, SHEET_MM, PANEL_MM } from '../js/impose.js';

/** Seiten 1 … n als Platzhalter-Objekte. */
const pages = (n) => Array.from({ length: n }, (_, i) => ({ no: i + 1 }));

const numbers = (list) => list.map((p) => p?.no ?? null);

describe('Bogen-Imposition', () => {
  test('die Masse ergeben einen A4-Bogen (quer) mit zwei A5-Seiten', () => {
    assert.equal(PANEL_MM.width * 2, SHEET_MM.width);
    assert.equal(PANEL_MM.height, SHEET_MM.height);
    assert.equal(PAGES_PER_SHEET, 2 * 2, 'zwei Seiten pro Blattseite');
  });

  test('vier Seiten ergeben einen Bogen', () => {
    const { sheets, pageCount } = impose(pages(4));
    assert.equal(sheets.length, 1);
    assert.equal(pageCount, 4);
  });

  test('Aussenseite und Innenseite liegen richtig', () => {
    const [sheet] = impose(pages(4)).sheets;
    // Vorderseite: links die Rückseite des Hefts, rechts das Titelblatt.
    assert.deepEqual(numbers(sheet.front), [4, 1]);
    // Rückseite: die beiden Innenseiten.
    assert.deepEqual(numbers(sheet.back), [2, 3]);
  });

  test('jede Seite kommt genau einmal vor', () => {
    for (const n of [4, 8, 12]) {
      const { sheets } = impose(pages(n));
      const seen = sheets.flatMap((s) => [...s.front, ...s.back]).map((p) => p?.no);
      assert.deepEqual([...seen].sort((a, b) => a - b), pages(n).map((p) => p.no));
    }
  });

  test('acht Seiten werden zu zwei verschachtelten Bögen', () => {
    const { sheets } = impose(pages(8));
    assert.equal(sheets.length, 2);
    // Äusserster Bogen: Seite 1 aussen, Seite 8 als Rückseite.
    assert.deepEqual(numbers(sheets[0].front), [8, 1]);
    assert.deepEqual(numbers(sheets[0].back), [2, 7]);
    // Nächster Bogen kommt nach innen.
    assert.deepEqual(numbers(sheets[1].front), [6, 3]);
    assert.deepEqual(numbers(sheets[1].back), [4, 5]);
  });

  test('die Leserichtung wird eingehalten', () => {
    // Seite 1 aussen rechts; danach je Doppelseite: Innenseite aussen,
    // dann die nächste Lage, zuletzt die Rückseite des Hefts.
    const { sheets } = impose(pages(8));
    const order = [
      sheets[0].front[1], // 1 – Titel
      sheets[0].back[0], // 2 – Innenseite des Umschlags
      sheets[1].front[1], // 3
      sheets[1].back[0], // 4
      sheets[1].back[1], // 5
      sheets[1].front[0], // 6
      sheets[0].back[1], // 7
      sheets[0].front[0], // 8 – Rückseite
    ].map((p) => p.no);
    assert.deepEqual(order, [1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('fehlende Seiten werden leer aufgefüllt', () => {
    const { sheets, pageCount } = impose(pages(3));
    assert.equal(pageCount, 4);
    assert.deepEqual(numbers(sheets[0].front), [null, 1]);
    assert.deepEqual(numbers(sheets[0].back), [2, 3]);
  });

  test('ohne Seiten entsteht ein leerer Bogen', () => {
    const { sheets, pageCount } = impose([]);
    assert.equal(pageCount, 4);
    assert.equal(sheets.length, 1);
    assert.ok([...sheets[0].front, ...sheets[0].back].every((p) => p === null));
  });

  test('jeder Bogen hat zwei Seiten pro Blattseite', () => {
    const { sheets } = impose(pages(9));
    assert.equal(sheets.length, 3);
    for (const sheet of sheets) {
      assert.equal(sheet.front.length, 2);
      assert.equal(sheet.back.length, 2);
    }
  });
});
