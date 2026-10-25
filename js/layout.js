/**
 * Seitenaufteilung für das Rätselheft (DIN A5).
 *
 * Reines Rechenmodul ohne DOM-Abhängigkeiten – dadurch direkt testbar.
 *
 * Grundregeln:
 *   - Eine Heftseite misst 148 × 210 mm (DIN A5), nutzbar sind 136 × 198 mm.
 *   - Pro Seite steht genau ein Rätsel: dadurch wird das Raster doppelt so
 *     gross wie im früheren A6-Heft und lässt sich gedruckt gut lesen.
 */

import { SVG_VIEW_PAD } from './svg.js';

/** Nutzbare Fläche einer A5-Seite in Millimetern (6 mm Rand ringsum). */
export const PAGE = { width: 136, height: 198 };

/** Platz, den die Fusszeile eines Rätsels braucht (mm). */
export const CHROME = 8;

/**
 * Verfügbarer Platz (in mm) für das Spielfeld eines Rätsels.
 */
export function availableBox() {
  return { width: PAGE.width, height: PAGE.height - CHROME };
}

/**
 * Grösse einer Rasterzelle in Millimetern.
 * @param {{cols:number, rows:number}} puzzle
 */
export function cellSizeMm(puzzle) {
  const box = availableBox();
  // Das SVG enthält einen kleinen Rand um das Spielfeld
  return Math.min(
    box.width / (puzzle.cols + 2 * SVG_VIEW_PAD),
    box.height / (puzzle.rows + 2 * SVG_VIEW_PAD),
  );
}

/**
 * Verteilt die Rätsel auf Seiten: genau ein Rätsel pro Seite.
 *
 * @param {Array<object>} puzzles
 * @returns {Array<Array<object>>} Seiten mit den enthaltenen Rätseln
 */
export function pagesOf(puzzles) {
  return puzzles.map((puzzle) => [puzzle]);
}
