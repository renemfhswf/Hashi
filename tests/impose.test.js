import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { impose, PAGES_PER_SHEET, SHEET_MM, PANEL_MM } from '../js/impose.js';

/** Seiten 1 … n als Platzhalter-Objekte. */
const pages = (n) => Array.from({ length: n }, (_, i) => ({ no: i + 1 }));

describe('Bogen-Imposition', () => {
  test('die Masse ergeben einen A4-Bogen mit vier A6-Seiten', () => {
    assert.equal(PANEL_MM.width * 2, SHEET_MM.width);
    assert.equal(PANEL_MM.height * 2, SHEET_MM.height);
    assert.equal(PAGES_PER_SHEET, 4 * 2, 'zwei Streifen mit je vier Seiten');
  });

  test('acht Seiten ergeben einen Bogen', () => {
    const { sheets, pageCount } = impose(pages(8));
    assert.equal(sheets.length, 1);
    assert.equal(pageCount, 8);
  });

  test('Aussenlage liegt aussen, Innenlage innen', () => {
    const { sheets } = impose(pages(8));
    const [sheet] = sheets;
    // Vorderseite: oben-links, oben-rechts, unten-links, unten-rechts
    assert.deepEqual(
      sheet.front.map((p) => p?.no),
      [8, 1, 6, 3],
    );
    // Rückseite: Innenseiten der beiden Lagen
    assert.deepEqual(
      sheet.back.map((p) => p?.no),
      [2, 7, 4, 5],
    );
  });

  test('jede Seite kommt genau einmal vor', () => {
    for (const n of [8, 16, 24]) {
      const { sheets } = impose(pages(n));
      const seen = sheets.flatMap((s) => [...s.front, ...s.back]).map((p) => p?.no);
      assert.deepEqual([...seen].sort((a, b) => a - b), pages(n).map((p) => p.no));
    }
  });

  test('16 Seiten werden zu zwei verschachtelten Bögen', () => {
    const { sheets } = impose(pages(16));
    assert.equal(sheets.length, 2);
    // Äusserster Bogen: Seite 1 aussen, Seite 16 als Rückseite.
    assert.deepEqual(sheets[0].front.map((p) => p?.no), [16, 1, 14, 3]);
    assert.deepEqual(sheets[0].back.map((p) => p?.no), [2, 15, 4, 13]);
    // Nächster Bogen kommt nach innen.
    assert.deepEqual(sheets[1].front.map((p) => p?.no), [12, 5, 10, 7]);
    assert.deepEqual(sheets[1].back.map((p) => p?.no), [6, 11, 8, 9]);
  });

  test('die Leserichtung wird eingehalten', () => {
    // Seite 1 steht als Titelblatt aussen rechts, Seite 2 auf der Rückseite
    // oben links, Seite 3 im Bogen unten rechts usw.
    const { sheets } = impose(pages(8));
    const order = [
      sheets[0].front[1],
      sheets[0].back[0],
      sheets[0].front[3],
      sheets[0].back[2],
      sheets[0].back[3],
      sheets[0].front[2],
      sheets[0].back[1],
      sheets[0].front[0],
    ].map((p) => p.no);
    assert.deepEqual(order, [1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('fehlende Seiten werden leer aufgefüllt', () => {
    const { sheets, pageCount } = impose(pages(5));
    assert.equal(pageCount, 8);
    assert.deepEqual(
      sheets[0].front.map((p) => p?.no ?? null),
      [null, 1, null, 3],
    );
    assert.deepEqual(
      sheets[0].back.map((p) => p?.no ?? null),
      [2, null, 4, 5],
    );
  });

  test('ohne Seiten entsteht ein leerer Bogen', () => {
    const { sheets, pageCount } = impose([]);
    assert.equal(pageCount, 8);
    assert.equal(sheets.length, 1);
    assert.ok([...sheets[0].front, ...sheets[0].back].every((p) => p === null));
  });

  test('jeder Bogen hat vier Seiten pro Seite', () => {
    const { sheets } = impose(pages(13));
    assert.equal(sheets.length, 2);
    for (const sheet of sheets) {
      assert.equal(sheet.front.length, 4);
      assert.equal(sheet.back.length, 4);
    }
  });
});
