/**
 * Bogen-Imposition für das Rätselheft.
 *
 * Ein DIN-A4-Bogen wird einmal geschnitten und zweimal gefaltet:
 *
 *     ┌─────────────┬─────────────┐
 *     │   Seite 8   │   Seite 1   │   obere Hälfte: Aussenlage
 *     ├─────────────┼─────────────┤   ← Schnitt (durchgezogen)
 *     │   Seite 6   │   Seite 3   │   untere Hälfte: Innenlage
 *     └─────────────┴─────────────┘
 *                   ↑
 *                 Falte
 *
 * Nach dem Schnitt entstehen zwei A5-Streifen. Jeder Streifen wird an der
 * gestrichelten Linie gefaltet; die Innenlage kommt in die Aussenlage.
 * Zusammengeklammert ergibt das ein A6-Heft mit acht Seiten pro Bogen.
 *
 * Reines Rechenmodul ohne DOM-Abhängigkeiten – dadurch direkt testbar.
 */

/** Masse eines Bogens in Millimetern (DIN A4). */
export const SHEET_MM = { width: 210, height: 297 };

/** Masse einer Heftseite in Millimetern (DIN A6, auf den Bogen gerechnet). */
export const PANEL_MM = { width: 105, height: 148.5 };

/** Seiten pro Bogen: zwei Streifen mit je vier Seiten. */
export const PAGES_PER_SHEET = 8;

/**
 * Verteilt die Seiten eines Hefts auf A4-Bögen (Vorder- und Rückseite).
 *
 * @param {Array<object|null>} pages  Seiten in Leserichtung (1, 2, 3 …)
 * @returns {{sheets: Array<{index:number, front:Array, back:Array}>, pageCount:number}}
 *   `front` und `back` enthalten je vier Seiten in der Reihenfolge
 *   oben-links, oben-rechts, unten-links, unten-rechts. Fehlende Seiten
 *   werden mit `null` aufgefüllt (leere Seite).
 */
export function impose(pages) {
  const used = Array.isArray(pages) ? pages : [];
  // Auf volle Bögen auffüllen: ein Heft hat immer 8, 16, 24 … Seiten.
  const pageCount = Math.max(
    PAGES_PER_SHEET,
    Math.ceil(used.length / PAGES_PER_SHEET) * PAGES_PER_SHEET,
  );
  const seq = Array.from({ length: pageCount }, (_, i) => used[i] ?? null);

  const sheets = [];
  for (let k = 0; k < pageCount / PAGES_PER_SHEET; k++) {
    // Die vier vorderen Seiten des Bogens (1, 2, 3, 4 beim äussersten) und
    // die vier hinteren (16, 15, 14, 13 beim äussersten).
    const low = [0, 1, 2, 3].map((i) => seq[4 * k + i]);
    const high = [0, 1, 2, 3].map((i) => seq[pageCount - 4 * (k + 1) + i]);

    sheets.push({
      index: k,
      // Oben-links, oben-rechts, unten-links, unten-rechts.
      front: [high[3], low[0], high[1], low[2]],
      back: [low[1], high[2], low[3], high[0]],
    });
  }

  return { sheets, pageCount };
}
