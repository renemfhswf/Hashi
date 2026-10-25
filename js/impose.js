/**
 * Bogen-Imposition für das Rätselheft.
 *
 * Ein DIN-A4-Bogen (quer) wird einmal gefaltet und ergibt ein DIN-A5-Heft:
 *
 *     ┌──────────────┬──────────────┐
 *     │   Seite 4    │   Seite 1    │   Aussenseite
 *     ├──────────────┼──────────────┤   ↑ Falte in der Mitte
 *     │   Seite 2    │   Seite 3    │   Innenseite (Rückseite des Bogens)
 *     └──────────────┴──────────────┘
 *
 * Der Bogen wird also beidseitig bedruckt, einmal in der Mitte gefaltet und
 * im Falz geklammert. Schneiden ist nicht mehr nötig.
 *
 * Reines Rechenmodul ohne DOM-Abhängigkeiten – dadurch direkt testbar.
 */

/** Masse eines Bogens in Millimetern (DIN A4 quer). */
export const SHEET_MM = { width: 297, height: 210 };

/** Masse einer Heftseite in Millimetern (DIN A5). */
export const PANEL_MM = { width: 148.5, height: 210 };

/** Seiten pro Bogen: zwei Seiten pro Blattseite. */
export const PAGES_PER_SHEET = 4;

/**
 * Verteilt die Seiten eines Hefts auf A4-Bögen (Vorder- und Rückseite).
 *
 * @param {Array<object|null>} pages  Seiten in Leserichtung (1, 2, 3 …)
 * @returns {{sheets: Array<{index:number, front:Array, back:Array}>, pageCount:number}}
 *   `front` und `back` enthalten je zwei Seiten in der Reihenfolge links,
 *   rechts. Fehlende Seiten werden mit `null` aufgefüllt (leere Seite).
 */
export function impose(pages) {
  const used = Array.isArray(pages) ? pages : [];
  // Auf volle Bögen auffüllen: ein Heft hat immer 4, 8, 12 … Seiten.
  const pageCount = Math.max(
    PAGES_PER_SHEET,
    Math.ceil(used.length / PAGES_PER_SHEET) * PAGES_PER_SHEET,
  );
  const seq = Array.from({ length: pageCount }, (_, i) => used[i] ?? null);

  const sheets = [];
  for (let k = 0; k < pageCount / PAGES_PER_SHEET; k++) {
    // Aussenlage: hinten rechts die letzte Seite, vorne links die erste.
    // Innenlage: die beiden mittleren Seiten.
    sheets.push({
      index: k,
      front: [seq[pageCount - 2 * k - 1], seq[2 * k]],
      back: [seq[2 * k + 1], seq[pageCount - 2 * k - 2]],
    });
  }

  return { sheets, pageCount };
}
