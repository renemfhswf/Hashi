/**
 * Erzeugt die Referenzbereiche für die Schwierigkeitsmessung.
 *
 *   npm run calibrate
 *
 * Für jedes Inselzahl-Bündel werden einige hundert Rätsel erzeugt und
 * gelöst. Aus den Verteilungen der Metriken werden die 5- und
 * 95-Perzentile berechnet – sie bilden die Normierungsgrundlage.
 *
 * Das Ergebnis landet in js/data/difficulty.json und wird von
 * js/difficulty.js gelesen. Nach jeder Änderung am Generator sollte die
 * Kalibrierung neu laufen.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generatePuzzle, DIFFICULTIES, DIFFICULTY_IDS, BOOKLET_FORMAT } from '../js/generator.js';
import { buildBoard } from '../js/board.js';
import { Solver } from '../js/solver.js';
import { BUCKETS, METRICS, WEIGHTS, measure, bucketFor, score } from '../js/difficulty.js';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(here, '..', 'js', 'data', 'difficulty.js');

/** Zielgrössen der Stichprobe je Bündel. */
const SAMPLES = 160;

/** Rätselgrössen, die je Bündel erzeugt werden. */
const SIZES = {
  '10-19': [12, 16],
  '20-29': [20, 26],
  '30-39': [30, 38],
  '40-59': [44, 56],
  '60-79': [60, 75],
  '80-120': [85, 100],
};

function percentile(sorted, p) {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

const samples = new Map();

for (const bucket of BUCKETS) {
  const [min, max] = SIZES[bucket.id] ?? [bucket.min, bucket.max];
  const collected = [];
  let levelIndex = 0;

  while (collected.length < SAMPLES) {
    const level = DIFFICULTY_IDS[levelIndex % DIFFICULTY_IDS.length];
    levelIndex++;
    const cfg = DIFFICULTIES[level];
    const islands = min + (collected.length % (max - min + 1));
    const useBooklet = islands > 60;
    const puzzle = generatePuzzle({
      difficulty: level,
      seed: `CAL-${bucket.id}-${collected.length}-${level}`,
      islands,
      format: useBooklet ? BOOKLET_FORMAT : cfg,
      keep: 1,
    });
    const board = buildBoard(
      puzzle.islands.map((i) => ({ id: i.id, r: i.r, c: i.c, num: i.num })),
      puzzle.cols,
      puzzle.rows,
    );
    const solver = new Solver(board);
    solver.findSolutions(2);
    collected.push(measure(board, solver, solver.ruleSteps));
    if (collected.length % 20 === 0) {
      process.stdout.write(`\r  ${bucket.id}: ${collected.length}/${SAMPLES} `);
    }
  }
  samples.set(bucket.id, collected);
  process.stdout.write(`\r  ${bucket.id}: ${SAMPLES}/${SAMPLES} ✓\n`);
}

const calibration = { global: {}, buckets: {} };

// Globale Referenz: über alle Grössen hinweg. Nur so sind die Werte
// zwischen verschiedenen Brettgrössen vergleichbar.
const allRows = [...samples.values()].flat();
for (const metric of METRICS) {
  const values = allRows.map((r) => r[metric]).sort((a, b) => a - b);
  calibration.global[metric] = [
    Number(percentile(values, 0.02).toFixed(4)),
    Number(percentile(values, 0.98).toFixed(4)),
  ];
}

// Referenzen je Inselzahl-Bündel: damit lässt sich ein Rätsel relativ zu
// gleich grossen Rätseln einordnen ("schwerer als 95 % der 30er").
for (const [id, rows] of samples) {
  calibration.buckets[id] = {};
  for (const metric of METRICS) {
    const values = rows.map((r) => r[metric]).sort((a, b) => a - b);
    calibration.buckets[id][metric] = [
      Number(percentile(values, 0.05).toFixed(4)),
      Number(percentile(values, 0.95).toFixed(4)),
    ];
  }
  // Der tatsächlich erreichbare Schwierigkeitsbereich dieser Inselzahl.
  // Gespeichert werden die Perzentile, damit sich ablesen lässt, welche
  // Stufen mit dieser Inselzahl überhaupt erreichbar sind.
  const scores = rows.map((r) => score(r, calibration.global)).sort((a, b) => a - b);
  calibration.buckets[id].scorePercentiles = [0.05, 0.2, 0.5, 0.8, 0.95].map((p) =>
    Number(percentile(scores, p).toFixed(4)),
  );
  const nodes = rows.map((r) => r.nodes).sort((a, b) => a - b);
  const logic = rows.map((r) => r.logicShare).sort((a, b) => a - b);
  console.log(
    `  ${id.padEnd(8)} Knoten median=${percentile(nodes, 0.5).toFixed(2)} ` +
    `Logikanteil median=${(percentile(logic, 0.5) * 100).toFixed(0)}% ` +
    `Schwierigkeit p20–p80: ${calibration.buckets[id].scorePercentiles[1].toFixed(2)}–${calibration.buckets[id].scorePercentiles[3].toFixed(2)}`,
  );
}
console.log(
  `  global    Knoten [${calibration.global.nodes[0]}, ${calibration.global.nodes[1]}] ` +
  `Logikanteil [${calibration.global.logicShare[0]}, ${calibration.global.logicShare[1]}]`,
);

// Bänder für die textliche Einordnung: die Grenzen liegen auf den
// Perzentilen der selbst berechneten Werte. Damit verteilen sich die
// Beschriftungen gleichmässig über die tatsächliche Verteilung.
const scored = allRows.map((row) => score(row, calibration.global)).sort((a, b) => a - b);
calibration.bands = [0.2, 0.4, 0.6, 0.8].map((p) => Number(percentile(scored, p).toFixed(4)));
console.log(`  Bänder (20/40/60/80. Perzentil): ${calibration.bands.join(', ')}`);
console.log(
  `  Werteverteilung: min=${scored[0].toFixed(3)} median=${percentile(scored, 0.5).toFixed(3)} max=${scored[scored.length - 1].toFixed(3)}`,
);

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(
  OUT,
  `/**
 * Referenzbereiche für die Schwierigkeitsmessung – erzeugt von
 * \`npm run calibrate\`. Bitte nach Änderungen am Generator neu erzeugen.
 *
 * Je Inselzahl-Bündel die 5- und 95-Perzentile der Metriken.
 */

export const CALIBRATION = ${JSON.stringify(calibration, null, 2)};

export default CALIBRATION;
`,
);console.log(`\nKalibrierung geschrieben: ${OUT}`);
