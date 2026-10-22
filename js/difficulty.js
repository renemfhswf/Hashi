/**
 * Schwierigkeitsmessung für Hashi-Rätsel.
 *
 * Angelehnt an die Idee des Projekts
 * https://github.com/erthium/hashiwokakero (GPL-3.0): die Schwierigkeit
 * ergibt sich aus dem *Solver-Aufwand* plus wenigen Strukturmetriken,
 * normiert gegen Referenzbereiche. Die Umsetzung hier ist eigenständig in
 * JavaScript; das Projekt steht unter MIT.
 *
 * Anpassungen gegenüber dem Vorbild:
 *   - Statt einer mitgelieferten Kalibrierdatei je Geometrie wird nach
 *     Inselzahl-Bündeln normiert. Das Brett wird auf seinen kleinsten
 *     umschliessenden Rechteck beschnitten, die Geometrie wechselt also
 *     ständig – ein Bündel nach Inselzahl bleibt dagegen stabil.
 *   - Die Metrik "Inseln unter 7" entfällt: in diesem Projekt liegen die
 *     Inselzahlen fast immer zwischen 1 und 5, die Metrik hat also keine
 *     Unterscheidungskraft.
 *   - Statt der absoluten Regelschrittzahl zählt der *Anteil* der rein
 *     logisch bestimmbaren Kanten – er ist unabhängig von der Brettgrösse.
 *   - Die Normierung erfolgt gegen die Gesamtverteilung, damit die Werte
 *     zwischen verschiedenen Brettgrössen vergleichbar bleiben.
 */

import { CALIBRATION } from './data/difficulty.js';

/** Metriken, die in die Bewertung eingehen. */
export const METRICS = ['nodes', 'logicShare', 'avgNumber', 'density'];

/** Gewichte der Metriken (Summe = 1). */
export const WEIGHTS = {
  nodes: 0.4, // Verzweigungsschritte des Solvers – die eigentliche Härte
  logicShare: 0.3, // Anteil der allein durch Logik bestimmten Kanten
  avgNumber: 0.2, // mittlere Inselzahl
  density: 0.1, // Inseldichte
};

/** Grenzen der Inselzahl-Bündel für die relative Einordnung. */
export const BUCKETS = [
  { id: '10-19', min: 10, max: 19 },
  { id: '20-29', min: 20, max: 29 },
  { id: '30-39', min: 30, max: 39 },
  { id: '40-59', min: 40, max: 59 },
  { id: '60-79', min: 60, max: 79 },
  { id: '80-120', min: 80, max: 120 },
];

/**
 * Bänder der gemessenen Schwierigkeit, aufgeschlüsselt nach Stufe.
 *
 * Die Grenzen sind die Perzentile aus der Kalibrierung
 * (`calibration.bands`) – sie liegen also dort, wo die Rätselpopulation
 * tatsächlich umkippt. Wer den Generator ändert, sollte die Kalibrierung
 * neu laufen lassen.
 */
const BANDS = Array.isArray(CALIBRATION?.bands) && CALIBRATION.bands.length === 4
  ? CALIBRATION.bands
  : [0.2, 0.4, 0.6, 0.8];

export const LEVEL_BANDS = {
  easy: [0, BANDS[1]],
  medium: [BANDS[1], BANDS[2]],
  hard: [BANDS[2], BANDS[3]],
  expert: [BANDS[3], 1],
};

/**
 * Zellen je Insel, die zu den Schwierigkeitsbändern passen.
 *
 * Grund: die Schwierigkeit hängt vor allem an der *Dichte* des Brettes
 * ab, nicht an der absoluten Inselzahl. 100 Inseln auf 23 × 21 Feldern sind
 * sehr schwer, dieselben 100 Inseln auf 42 × 40 Feldern nur mittel.
 */
export const CELLS_PER_ISLAND = {
  easy: 16.0,
  medium: 10.5,
  hard: 7.0,
  expert: 4.6,
};

/**
 * Abstand eines Wertes zum Zielband (0 = im Band).
 * @param {number} value
 * @param {[number, number]} band
 */
export function bandDistance(value, band) {
  if (!band) return 0;
  const [lo, hi] = band;
  if (value < lo) return lo - value;
  if (value > hi) return value - hi;
  return 0;
}

/**
 * Rastergrösse für eine gewünschte Dichte.
 *
 * @param {number} islands  gewünschte Inselzahl
 * @param {number} factor   Rasterfelder je Insel (größer = luftiger = leichter)
 * @returns {[number, number]}
 */
export function gridFor(islands, factor) {
  const cells = Math.max(islands + 4, Math.round(islands * factor));
  const side = Math.max(3, Math.round(Math.sqrt(cells)));
  return [side, side];
}

/**
 * Rastergrössen, die für eine gewünschte Schwierigkeit in Frage kommen –
 * von eng (schwer) bis weit (leicht).
 *
 * @param {number} islands  gewünschte Inselzahl
 * @param {string} level   'easy' | 'medium' | 'hard' | 'expert'
 * @returns {Array<[number, number]>}
 */
export function gridSizesFor(islands, level) {
  const base = CELLS_PER_ISLAND[level] ?? CELLS_PER_ISLAND.medium;
  return [1, 1.45, 0.72].map((f) => gridFor(islands, base * f));
}

/** Welches Bündel gehört zu einer bestimmten Inselzahl? */
export function bucketFor(islandCount) {
  for (const bucket of BUCKETS) {
    if (islandCount >= bucket.min && islandCount <= bucket.max) return bucket.id;
  }
  return islandCount < BUCKETS[0].min ? BUCKETS[0].id : BUCKETS[BUCKETS.length - 1].id;
}

/**
 * Erhebt die Rohmetriken eines Rätsels.
 *
 * Die Knotenzahl des Solvers ist stark schief verteilt (typisch 1 bis 3 bei
 * kleinen, aber auch 350 bei grossen Brettern). Eine lineare Normalisierung
 * verstärkt solche kleinen Unterschiede extrem, deshalb wird der Logarithmus
 * verwendet: er verteilt die Werte gleichmässig und macht die Perzentilgrenzen
 * aussagekräftig.
 *
 * @param {object} board      Brettmodell
 * @param {object} solver     Solver, der das Brett bereits gelöst hat
 * @param {number} ruleSteps  Propagationsdurchläufe des Solvers
 */
export function measure(board, solver, ruleSteps = 0) {
  const islands = board.islands;
  const count = Math.max(1, islands.length);
  const total = islands.reduce((sum, i) => sum + i.num, 0);
  const determined = solver.propagationStatus().determined;
  return {
    nodes: Math.log10(1 + solver.nodes),
    ruleSteps,
    logicShare: board.edges.length ? determined / board.edges.length : 1,
    avgNumber: total / count,
    density: islands.length / (board.cols * board.rows),
  };
}

/** Linear auf [0, 1] normieren und klemmen. */
function normalise(value, lo, hi) {
  if (hi === lo) return 0;
  const raw = (value - lo) / (hi - lo);
  return raw < 0 ? 0 : raw > 1 ? 1 : raw;
}

/**
 * Berechnet den Schwierigkeitsgrad aus den Metriken und den
 * Referenzbereichen.
 *
 * @param {object} metrics  Rohmetriken
 * @param {object} bounds   Referenzbereiche: { metric: [lo, hi] }
 * @returns {number} 0 (sehr leicht) bis 1 (sehr schwer)
 */
export function score(metrics, bounds) {
  if (!bounds) return 0.5;
  let result = 0;
  for (const metric of METRICS) {
    const range = bounds[metric];
    if (!range) continue;
    let value = normalise(metrics[metric], range[0], range[1]);
    // Der Logikanteil ist invertiert: viel Logik = leicht.
    if (metric === 'logicShare') value = 1 - value;
    result += value * WEIGHTS[metric];
  }
  return Math.min(1, Math.max(0, result));
}

/**
 * Schwierigkeitsgrad im Verhältnis zu gleich grossen Rätseln.
 * "1.0" heisst: härter als 95 % der Rätsel dieser Grösse.
 */
export function relativeScore(metrics, bounds) {
  return score(metrics, bounds);
}

/**
 * Schwierigkeitsbereich, der mit einer Inselzahl überhaupt erreichbar ist.
 *
 * Die Kalibrierung merkt sich je Inselzahl-Bündel den tatsächlich
 * beobachteten Bereich. Ein 40-Inseln-Rätsel ist z. B. nie so schwer wie
 * ein 100-Inseln – die Bänder der globalen Skala greifen dort nicht.
 *
 * @param {object} bounds  Referenzbereiche eines Bündels
 * @returns {[number, number]}
 */
export function achievableRange(bounds) {
  if (!bounds) return [0, 1];
  if (Array.isArray(bounds.scoreRange)) return bounds.scoreRange;
  // Näherung aus den Metrikbereichen, falls keine Messreihe vorliegt.
  const easiest = {};
  const hardest = {};
  for (const metric of METRICS) {
    const range = bounds[metric];
    if (!range) continue;
    // Der Logikanteil ist invers zur Schwierigkeit.
    const inverted = metric === 'logicShare';
    easiest[metric] = inverted ? range[1] : range[0];
    hardest[metric] = inverted ? range[0] : range[1];
  }
  return [score(easiest, bounds), score(hardest, bounds)];
}

/**
 * Textliche Einordnung des Schwierigkeitsgrads.
 *
 * Die Grenzen stammen aus der Kalibrierung (`calibration.bands`): sie liegen
 * auf den 20-/40-/60-/80-Perzentilen der tatsächlichen Verteilung. Damit
 * verteilen sich die Beschriftungen gleichmässig, statt an starren Grenzen
 * zu kleben.
 *
 * @param {number} value    Schwierigkeitsgrad
 * @param {number[]} bands  Grenzwerte aus der Kalibrierung
 */
export function label(value, bands = null) {
  const b = Array.isArray(bands) && bands.length === 4 ? bands : [0.2, 0.4, 0.6, 0.8];
  if (value < b[0]) return 'sehr leicht';
  if (value < b[1]) return 'leicht';
  if (value < b[2]) return 'mittel';
  if (value < b[3]) return 'schwer';
  return 'sehr schwer';
}
