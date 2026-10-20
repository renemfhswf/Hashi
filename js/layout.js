/**
 * Seitenaufteilung für das Rätselheft (DIN A6).
 *
 * Reines Rechenmodul ohne DOM-Abhängigkeiten – dadurch direkt testbar.
 *
 * Grundregeln:
 *   - Ein A6-Blatt misst 105 × 148 mm, nutzbar sind ca. 93 × 136 mm.
 *   - Höchstens zwei Rätsel passen auf eine Seite.
 *   - Sind die Raster zu gross, wird nur ein Rätsel pro Seite gesetzt.
 *   - Die Anordnung (untereinander / nebeneinander) richtet sich nach der
 *     Form des Rasters: breite Raster stapeln, hohe Raster nebeneinander.
 */

import { SVG_VIEW_PAD } from './svg.js';

/** Nutzbare Fläche einer A6-Seite in Millimetern. */
export const PAGE = { width: 93, height: 136 };

/** Abstand zwischen zwei Rätseln auf derselben Seite (mm). */
export const GAP = 4;

/** Platz, den Kopf- und Fusszeile eines Rätsels brauchen (mm). */
export const CHROME = 8;

/** Kleinste noch lesbare Rasterzelle in Millimetern. */
export const MIN_CELL_MM = 6;

/** Anordnung der Rätsel auf einem Bogen. */
export const LAYOUTS = {
  row: { cols: 1, rows: 2 }, // untereinander
  col: { cols: 2, rows: 1 }, // nebeneinander
};

/**
 * Verfügbarer Platz (in mm) für das Spielfeld eines Rätsels.
 * @param {number} count  Anzahl Rätsel auf dem Bogen
 * @param {'row'|'col'} layout
 */
export function availableBox(count, layout) {
  const grid = count <= 1 ? { cols: 1, rows: 1 } : LAYOUTS[layout];
  const width = (PAGE.width - (grid.cols - 1) * GAP) / grid.cols;
  const height = (PAGE.height - (grid.rows - 1) * GAP) / grid.rows;
  return { width, height: height - CHROME };
}

/**
 * Grössere einer Rasterzelle in Millimetern bei der gewählten Anordnung.
 * @param {{cols:number, rows:number}} puzzle
 * @param {'row'|'col'} layout
 * @param {number} count  Anzahl Rätsel auf dem Bogen
 */
export function cellSizeMm(puzzle, layout, count) {
  const box = availableBox(count, layout);
  // Das SVG enthält einen kleinen Rand um das Spielfeld
  return Math.min(
    box.width / (puzzle.cols + 2 * SVG_VIEW_PAD),
    box.height / (puzzle.rows + 2 * SVG_VIEW_PAD),
  );
}

/**
 * Wählt die Anordnung, bei der die Rasterzellen am grössten werden.
 * @param {Array<{cols:number, rows:number}>} puzzles
 * @returns {'row'|'col'}
 */
export function bestLayout(puzzles) {
  if (puzzles.length < 2) return 'row';
  let best = 'row';
  let bestSize = -Infinity;
  for (const layout of ['row', 'col']) {
    const size = Math.min(...puzzles.map((p) => cellSizeMm(p, layout, 2)));
    if (size > bestSize) {
      bestSize = size;
      best = layout;
    }
  }
  return best;
}

/**
 * Verteilt die Rätsel auf Seiten: höchstens zwei pro Seite, bei zu grossen
 * Rastern nur eines.
 *
 * @param {Array<object>} puzzles
 * @param {number} maxPerPage 1 oder 2
 * @returns {Array<Array<object>>} Seiten mit den enthaltenen Rätseln
 */
export function groupIntoPages(puzzles, maxPerPage = 2) {
  const pages = [];
  let i = 0;
  while (i < puzzles.length) {
    const first = puzzles[i];
    const second = puzzles[i + 1];
    const fitsTwo =
      maxPerPage >= 2 &&
      second &&
      cellSizeMm(first, 'row', 2) >= MIN_CELL_MM &&
      cellSizeMm(second, 'row', 2) >= MIN_CELL_MM;
    if (fitsTwo) {
      pages.push([first, second]);
      i += 2;
    } else {
      pages.push([first]);
      i += 1;
    }
  }
  return pages;
}
