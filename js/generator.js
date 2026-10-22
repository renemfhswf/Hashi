/**
 * Rätselgenerator für Hashiwokakero.
 *
 * Kernidee: Ein Rätsel, das bereits durch *reine Constraint-Propagation*
 * vollständig bestimmt wird, besitzt garantiert genau eine Lösung –
 * Propagation entfernt nur Werte, die in keiner Lösung vorkommen können.
 * Solche Rätsel sind zusätzlich "ohne Raten" lösbar, wie es gute
 * Hashiwokakero-Puzzles auszeichnet.
 *
 * Pipeline:
 *   1. `growSolution` erzeugt per Zufall eine gültige *Lösung*:
 *      Inseln wachsen zu einem Baum, Brücken verbinden sie kreuzungsfrei.
 *      Aus den Brücken ergeben sich die Inselzahlen.
 *   2. `propagationStatus` prüft, wie weit das Rätsel allein durch Logik
 *      bestimmbar ist.
 *   3. `repair` mutiert die Lösung (Hill-Climbing), bis die Propagation
 *      das Brett vollständig auflöst -> eindeutig lösbares Rätsel.
 *   4. Aus mehreren Kandidaten wird der interessanteste gewählt.
 *
 * Erzeugte Rätsel erfüllen immer:
 *   - alle Inseln liegen auf verschiedenen Feldern
 *   - keine Brücke kreuzt eine andere, keine Brücke liegt über einer Insel
 *   - jede Insel trägt 1..8 Brücken
 *   - es existiert genau eine Lösung
 *   - alle Inseln sind in dieser Lösung verbunden
 */

import { RNG, randomSeed } from './rng.js';
import { buildBoard, isConnected } from './board.js';
import { findSolutions, propagationStatus, Solver } from './solver.js';
import { measure, score, relativeScore, bucketFor, label as difficultyLabel } from './difficulty.js';
import { LEVEL_BANDS, CELLS_PER_ISLAND, bandDistance, gridFor } from './difficulty.js';
import { CALIBRATION } from './data/difficulty.js';

/**
 * Referenzbereiche der Schwierigkeitsmessung. Sie werden beim ersten
 * Aufruf von `npm run calibrate` erzeugt – ohne sie arbeitet der Generator
 * ebenfalls, die Messung fällt dann auf einen neutralen Wert zurück.
 */
const CAL = CALIBRATION && typeof CALIBRATION === 'object' ? CALIBRATION : {};
const GLOBAL_BOUNDS = CAL.global ?? null;
const BUCKET_BOUNDS = CAL.buckets ?? {};
const BANDS = Array.isArray(CAL.bands) ? CAL.bands : null;

export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    label: 'Leicht',
    min: 12,
    max: 16,
    cols: 11,
    rows: 11,
    double: 0.25,
    maxExtra: 1,
    maxLen: 4,
    noAdjacent: true,
    tries: 60,
    maxRepair: 220,
    repairLimit: 40,
    keep: 3,
  },
  medium: {
    id: 'medium',
    label: 'Mittel',
    min: 20,
    max: 26,
    cols: 13,
    rows: 13,
    double: 0.25,
    maxExtra: 1,
    maxLen: 4,
    noAdjacent: true,
    tries: 70,
    maxRepair: 140,
    repairLimit: 40,
    keep: 3,
  },
  hard: {
    id: 'hard',
    label: 'Schwer',
    min: 30,
    max: 38,
    cols: 16,
    rows: 16,
    double: 0.22,
    maxExtra: 2,
    maxLen: 4,
    noAdjacent: true,
    tries: 90,
    maxRepair: 70,
    repairLimit: 32,
    keep: 2,
  },
  expert: {
    id: 'expert',
    label: 'Experte',
    min: 44,
    max: 56,
    cols: 19,
    rows: 17,
    double: 0.18,
    maxExtra: 2,
    maxLen: 4,
    noAdjacent: true,
    tries: 120,
    maxRepair: 40,
    repairLimit: 0,
    keep: 2,
  },
};

/**
 * Sehr grosses Format für das Rätselheft: etwa 100 Inseln auf einer
 * DIN-A6-Seite. Wird über `islands` in `generatePuzzle` angesteuert.
 *
 * Gemessen (100 Inseln, 23x21): mit variablen Brückenlängen bis 4 Felder
 * und 12 % Doppelbrücken liefert die Erzeugung zuverlässig eindeutige
 * Rätsel (100 % Quote, ~1 s je Rätsel, ~11 Doppelbrücken).
 */
export const BOOKLET_FORMAT = {
  cols: 23,
  rows: 21,
  maxExtra: 2,
  maxLen: 4,
  noAdjacent: true,
  double: 0.12,
};

export const DIFFICULTY_IDS = Object.keys(DIFFICULTIES);

const DIRS = [
  { dr: -1, dc: 0, dir: 'v' },
  { dr: 1, dc: 0, dir: 'v' },
  { dr: 0, dc: -1, dir: 'h' },
  { dr: 0, dc: 1, dir: 'h' },
];

const key = (r, c) => `${r},${c}`;
const edgeKey = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);
const sameArray = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/* ------------------------------------------------------------------ *
 * Schritt 1: Zufällige Lösung wachsen lassen
 * ------------------------------------------------------------------ */

/** Ist die Zelle (r,c) von einer Insel belegt? */
function islandAt(islands, r, c) {
  return islands.some((i) => i.r === r && i.c === c);
}

/**
 * Anzahl sichtbarer Nachbarn einer Zelle: für jede Richtung der nächste
 * Inselpunkt ohne dazwischenliegende Insel. Bestimmt, wie viele potenzielle
 * Brückenkanten an der Zelle entstehen.
 */
function visibleDegree(islands, r, c, rows, cols) {
  let deg = 0;
  for (const d of DIRS) {
    let step = 1;
    while (true) {
      const nr = r + d.dr * step;
      const nc = c + d.dc * step;
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) break;
      if (islandAt(islands, nr, nc)) {
        deg++;
        break;
      }
      step++;
    }
  }
  return deg;
}

/** Liegt die Zelle (r,c) im Inneren einer bestehenden Brücke? */
function liesOnBridge(islands, edges, r, c) {
  for (const e of edges) {
    const a = islands[e.a];
    const b = islands[e.b];
    if (a.r === b.r) {
      if (a.r === r && Math.min(a.c, b.c) < c && c < Math.max(a.c, b.c)) return true;
    } else if (a.c === b.c) {
      if (a.c === c && Math.min(a.r, b.r) < r && r < Math.max(a.r, b.r)) return true;
    }
  }
  return false;
}

/** Würde die Strecke (r1,c1)->(r2,c2) eine bestehende Brücke kreuzen? */
function crossesExisting(islands, edges, r1, c1, r2, c2) {
  const horizontal = r1 === r2;
  const cLo = Math.min(c1, c2);
  const cHi = Math.max(c1, c2);
  const rLo = Math.min(r1, r2);
  const rHi = Math.max(r1, r2);
  for (const e of edges) {
    const a = islands[e.a];
    const b = islands[e.b];
    const eHorizontal = a.r === b.r;
    if (eHorizontal === horizontal) continue; // parallel -> kein Kreuz
    if (horizontal) {
      const ec = a.c;
      const er1 = Math.min(a.r, b.r);
      const er2 = Math.max(a.r, b.r);
      if (er1 < r1 && r1 < er2 && cLo < ec && ec < cHi) return true;
    } else {
      const er = a.r;
      const ec1 = Math.min(a.c, b.c);
      const ec2 = Math.max(a.c, b.c);
      if (ec1 < c1 && c1 < ec2 && rLo < er && er < rHi) return true;
    }
  }
  return false;
}

/**
 * Anzahl Kandidaten, die beim Best-Candidate-Sampling erprobt werden.
 * Höhere Werte verteilen die Inseln gleichmässiger, kosten aber Zeit.
 */
const CANDIDATE_SAMPLES = 12;

/**
 * Abstand der Position (r, c) zur nächstgelegenen anderen Insel
 * (Manhattan-Metrik). Der Elternteil wird ignoriert – er soll die Insel
 * ja gerade verbinden.
 */
function nearestDistance(islands, r, c, ignoreIndex) {
  let best = Infinity;
  for (let i = 0; i < islands.length; i++) {
    if (i === ignoreIndex) continue;
    const d = Math.abs(islands[i].r - r) + Math.abs(islands[i].c - c);
    if (d < best) best = d;
  }
  return best === Infinity ? 99 : best;
}

/**
 * Baut eine zufällige, kreuzungsfreie Lösung.
 *
 * @param {number} maxExtra    erlaubte "Ablenk-Kanten" je Insel
 * @param {number} maxLen      maximale Brückenlänge in Feldern (1 = nur Nachbarschaft)
 * @param {boolean} noAdjacent keine neue Insel direkt neben einer anderen
 * @returns {{cols:number, rows:number, islands:{r:number,c:number}[], edges:{a:number,b:number,w:number}[]}|null}
 *
 * Die Idee der variablen Brückenlänge (Brücken über ein oder mehrere freie
 * Felder statt immer nur über eines) stammt aus dem Projekt
 * https://github.com/erthium/hashiwokakero (GPL-3.0). Die Umsetzung hier ist
 * eigenständig in JavaScript; das Projekt steht unter MIT.
 */
function growSolution(rng, target, cols, rows, doubleChance, maxExtra, maxLen = 2, noAdjacent = false) {
  const islands = [];
  const edges = [];

  const start = { r: rng.range(0, rows - 1), c: rng.range(0, cols - 1) };
  islands.push(start);

  const degreeOf = (idx) => {
    let deg = 0;
    for (const e of edges) if (e.a === idx || e.b === idx) deg++;
    return deg;
  };

  let guard = 0;
  while (islands.length < target && guard < 20000) {
    guard++;
    const cands = [];

    for (let i = 0; i < islands.length; i++) {
      const isl = islands[i];
      for (const d of DIRS) {
        // Brücken können über ein oder mehrere freie Felder führen.
        for (let dist = 1; dist <= maxLen; dist++) {
          const nr = isl.r + d.dr * dist;
          const nc = isl.c + d.dc * dist;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) break;

          // Alle Felder zwischen Elterninsel und neuer Insel müssen frei sein –
          // weder Insel noch Brücke.
          let blocked = false;
          for (let k = 1; k < dist; k++) {
            const kr = isl.r + d.dr * k;
            const kc = isl.c + d.dc * k;
            if (islandAt(islands, kr, kc) || liesOnBridge(islands, edges, kr, kc)) {
              blocked = true;
              break;
            }
          }
          if (blocked) break;
          if (islandAt(islands, nr, nc)) break;
          // Durch die neue Insel darf keine bestehende Brücke laufen
          if (liesOnBridge(islands, edges, nr, nc)) break;
          // Die neue Brücke darf keine bestehende kreuzen
          if (crossesExisting(islands, edges, isl.r, isl.c, nr, nc)) continue;
          // Regel: die vier Nachbarfelder einer Insel bleiben frei – so
          // stehen die Knoten nie direkt nebeneinander.
          if (noAdjacent) {
            let adjacent = false;
            for (const dd of DIRS) {
              if (islandAt(islands, nr + dd.dr, nc + dd.dc)) {
                adjacent = true;
                break;
              }
            }
            if (adjacent) continue;
          }

          const candidateIslands = [...islands, { r: nr, c: nc }];
          const deg = visibleDegree(candidateIslands, nr, nc, rows, cols);
          // `extra` = Anzahl zusätzlicher sichtbarer Inseln neben dem Elternteil.
          // Jede davon erzeugt eine zusätzliche "Ablenk-Kante" im Kandidatengraphen
          // und damit potenzielle Mehrdeutigkeit.
          const extra = deg - 1;
          if (extra > maxExtra) continue;

          let w = 1;
          if (degreeOf(i) <= 1) w *= 2.2; // Ketten weiterbauen -> organischere Form
          if (extra === 0) w *= 2.5; // decoy-frei bevorzugen
          if (dist > 1) w *= 1.3; // längere Brücken sind typischer für Hashi
          if (deg >= 4) w *= 0.05;
          else if (deg === 3) w *= 0.4;

          cands.push({
            parent: i,
            r: nr,
            c: nc,
            w,
            // Abstand zur nächstgelegenen anderen Insel: je grösser, desto
            // gleichmässiger verteilen sich die Inseln.
            abstand: nearestDistance(islands, nr, nc, i),
          });
        }
      }
    }

    if (cands.length === 0) break;

    // Best-Candidate-Sampling: mehrere Kandidaten erproben und jenen wählen,
    // der am weitesten von den übrigen Inseln entfernt liegt. Das streut die
    // Inseln gleichmässig über das Brett statt sie zu clustern.
    let chosen = rng.pickWeighted(cands, cands.map((c) => c.w));
    if (cands.length > 1) {
      let best = chosen;
      let bestScore = chosen.abstand * 10 + rng.float() * 3 + chosen.w;
      for (let k = 0; k < CANDIDATE_SAMPLES; k++) {
        const pick = rng.pickWeighted(cands, cands.map((c) => c.w));
        const score = pick.abstand * 10 + rng.float() * 3 + pick.w;
        if (score > bestScore) {
          bestScore = score;
          best = pick;
        }
      }
      chosen = best;
    }

    const id = islands.length;
    islands.push({ r: chosen.r, c: chosen.c });
    edges.push({ a: chosen.parent, b: id, w: rng.chance(doubleChance) ? 2 : 1 });
  }

  if (islands.length < 3) return null;
  return { cols, rows, islands, edges };
}

/* ------------------------------------------------------------------ *
 * Schritt 2: Lösung validieren, Zahlen ableiten
 * ------------------------------------------------------------------ */

/** Inselzahlen = Summe der anliegenden Brücken. */
export function numbersOf(sol) {
  const nums = new Array(sol.islands.length).fill(0);
  for (const e of sol.edges) {
    nums[e.a] += e.w;
    nums[e.b] += e.w;
  }
  return nums;
}

/** Prüft, ob die Lösung alle Regeln erfüllt. */
export function validateSolution(sol) {
  const { islands, edges } = sol;

  const seen = new Set();
  for (const i of islands) {
    if (i.r < 0 || i.r >= sol.rows || i.c < 0 || i.c >= sol.cols) return false;
    const k = key(i.r, i.c);
    if (seen.has(k)) return false;
    seen.add(k);
  }

  // Brücken dürfen nicht über Inseln führen
  for (const e of edges) {
    const a = islands[e.a];
    const b = islands[e.b];
    if (a.r === b.r) {
      for (let c = Math.min(a.c, b.c) + 1; c < Math.max(a.c, b.c); c++) {
        if (islandAt(islands, a.r, c)) return false;
      }
    } else {
      for (let r = Math.min(a.r, b.r) + 1; r < Math.max(a.r, b.r); r++) {
        if (islandAt(islands, r, a.c)) return false;
      }
    }
  }

  // Keine Kreuzungen
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      const e = edges[i];
      const f = edges[j];
      const eH = islands[e.a].r === islands[e.b].r;
      const fH = islands[f.a].r === islands[f.b].r;
      if (eH === fH) continue;
      const h = eH ? e : f;
      const v = eH ? f : e;
      const h1 = islands[h.a];
      const h2 = islands[h.b];
      const v1 = islands[v.a];
      const v2 = islands[v.b];
      const hMinC = Math.min(h1.c, h2.c);
      const hMaxC = Math.max(h1.c, h2.c);
      const vMinR = Math.min(v1.r, v2.r);
      const vMaxR = Math.max(v1.r, v2.r);
      if (hMinC < v1.c && v1.c < hMaxC && vMinR < h1.r && h1.r < vMaxR) return false;
    }
  }

  // Brückenzahlen 1..2
  for (const e of edges) {
    if (e.w < 1 || e.w > 2) return false;
  }

  // Inselzahlen 1..8
  const nums = numbersOf(sol);
  for (const n of nums) if (n < 1 || n > 8) return false;

  // Konnektivität
  const board = buildBoard(
    islands.map((s, i) => ({ id: i, r: s.r, c: s.c, num: nums[i] })),
    sol.cols,
    sol.rows,
  );
  return isConnected(board, countsOf(board, sol));
}

/** Brettmodell aus einer Lösung bauen. */
function boardOf(sol, nums) {
  return buildBoard(
    sol.islands.map((s, i) => ({ id: i, r: s.r, c: s.c, num: nums[i] })),
    sol.cols,
    sol.rows,
  );
}

/**
 * Beschneidet die Lösung auf den kleinsten umschliessenden Rechteck.
 * Das Brett wirkt dadurch kompakt und ausgewogen statt in einer grossen
 * Rasterfläche zu "verloren" zu gehen.
 */
function cropSolution(sol) {
  const minR = Math.min(...sol.islands.map((i) => i.r));
  const maxR = Math.max(...sol.islands.map((i) => i.r));
  const minC = Math.min(...sol.islands.map((i) => i.c));
  const maxC = Math.max(...sol.islands.map((i) => i.c));
  const shiftR = minR;
  const shiftC = minC;
  return {
    cols: maxC - minC + 1,
    rows: maxR - minR + 1,
    islands: sol.islands.map((i) => ({ r: i.r - shiftR, c: i.c - shiftC })),
    edges: sol.edges.map((e) => ({ ...e })),
  };
}

/** Brückenzahlen pro Brettkante aus der Lösung ableiten. */
function countsOf(board, sol) {
  const map = new Map();
  for (const e of sol.edges) map.set(edgeKey(e.a, e.b), e.w);
  return board.edges.map((e) => map.get(edgeKey(e.a, e.b)) ?? 0);
}

/* ------------------------------------------------------------------ *
 * Schritt 3: Reparatur -> Propagation muss das Brett auflösen
 * ------------------------------------------------------------------ */

/** Kopie der Lösung mit geänderter Brücke (w = 0 entfernt sie). */
function withEdge(sol, a, b, w) {
  const idx = sol.edges.findIndex((e) => edgeKey(e.a, e.b) === edgeKey(a, b));
  if (idx === -1) return null;
  const copy = {
    cols: sol.cols,
    rows: sol.rows,
    islands: sol.islands.map((i) => ({ ...i })),
    edges: sol.edges.map((e) => ({ ...e })),
  };
  if (w === 0) copy.edges.splice(idx, 1);
  else copy.edges[idx].w = w;
  return copy;
}

/**
 * Kopie der Lösung mit einer zusätzlichen Brücke.
 * Damit entstehen Kreise in der Lösung – das erweitert den Raum möglicher
 * Reparaturen erheblich (eine Brücke aus einem Kreis kann entfernt werden,
 * ohne das Netz zu zerreissen).
 */
function addEdge(sol, a, b, w) {
  if (sol.edges.some((e) => edgeKey(e.a, e.b) === edgeKey(a, b))) return null;
  const copy = {
    cols: sol.cols,
    rows: sol.rows,
    islands: sol.islands.map((i) => ({ ...i })),
    edges: [...sol.edges.map((e) => ({ ...e })), { a, b, w }],
  };
  return copy;
}

/** Bewertet eine Lösung: wie weit ist das Brett allein durch Logik bestimmt? */
function evaluate(sol) {
  const nums = numbersOf(sol);
  const board = boardOf(sol, nums);
  const status = propagationStatus(board);
  let count = 0;
  if (status.complete) {
    count = 1;
  } else if (status.consistent) {
    count = findSolutions(board, 4).length;
  }
  return { sol, nums, board, status, count };
}

/** Höher = besser. Eindeutigkeit hat absoluten Vorrang. */
function scoreOf(ev) {
  if (!ev.status.consistent) return -1e9;
  if (ev.count === 1) return 1e6 + ev.status.determined;
  return -ev.count * 1000 + ev.status.determined;
}

/**
 * Nachbarschaft möglicher Mutationen.
 *
 * Wichtigster Hebel ist die *Sättigung* einer Insel: bekommt eine Insel
 * auf allen ihren Kandidatenkanten je 2 Brücken, ist ihre Zahl sofort
 * gedeckt ("2 Brücken auf jeder Seite") und die Logik kann von dort aus
 * weitere Kanten bestimmen. Das ist ein klassisches Muster in
 * Hashiwokakero-Puzzles und löst typische Mehrdeutigkeiten auf.
 */
function buildNeighbourhood(sol, board, status, rng) {
  const used = new Map(sol.edges.map((e) => [edgeKey(e.a, e.b), e]));
  const hot = new Set();
  for (const e of status.freeEdges) {
    hot.add(board.edges[e].a);
    hot.add(board.edges[e].b);
  }
  // Inseln, die noch nicht gesättigt sind, sind die eigentlichen Bremsen
  for (let i = 0; i < board.islands.length; i++) {
    const maxPossible = 2 * board.incident[i].length;
    const num = board.islands[i].num;
    if (num < maxPossible) hot.add(i);
  }

  const cands = [];

  // 1) Sättigung: alle Kandidatenkanten einer Insel auf 2 Brücken bringen
  for (const i of hot) {
    let next = sol;
    let ok = true;
    for (const e of board.incident[i]) {
      const ed = board.edges[e];
      const k = edgeKey(ed.a, ed.b);
      const existing = used.get(k);
      const target = 2;
      if (existing) {
        if (existing.w === target) continue;
        next = withEdge(next, ed.a, ed.b, target);
      } else {
        next = withEdge(next, ed.a, ed.b, target);
      }
      if (!next) {
        ok = false;
        break;
      }
    }
    if (ok && next) cands.push(next);
  }

  // 2) lokale Änderungen an den "heißen" Inseln
  for (const i of hot) {
    for (const e of board.incident[i]) {
      const ed = board.edges[e];
      const k = edgeKey(ed.a, ed.b);
      const existing = used.get(k);
      if (!existing) {
        cands.push(withEdge(sol, ed.a, ed.b, 1));
        cands.push(withEdge(sol, ed.a, ed.b, 2));
      } else {
        cands.push(withEdge(sol, ed.a, ed.b, existing.w === 1 ? 2 : 1));
        cands.push(withEdge(sol, ed.a, ed.b, 0));
      }
    }
  }

  // 3) gelegentliche globale Störung, um lokale Optima zu verlassen
  if (rng.chance(0.15)) {
    const all = sol.edges.map((e) => withEdge(sol, e.a, e.b, e.w === 1 ? 2 : 1));
    cands.push(...all);
  }

  return cands.filter(Boolean);
}

/**
 * Ermittelt einen Brückenzahl-Wert, der die alternative Lösung invalidiert.
 *
 * Hintergrund: Ändert man die Brückenzahl einer Kante von `w` auf `w2`, so
 * ändert sich die Inselzahl um `w2 - w`. Die alternative Lösung ist nur dann
 * weiterhin gültig, wenn ihre Brückenzahl auf dieser Kante um genau denselben
 * Betrag abweicht. Gesucht ist also ein `w2` mit `w2 - w != wp - w`.
 *
 * @param {number} w    Brückenzahl der beabsichtigten Lösung
 * @param {number} wp   Brückenzahl der alternativen Lösung
 * @returns {number|null} neuer Wert oder null, wenn keiner hilft
 */
function counterValue(w, wp) {
  switch (`${w}-${wp}`) {
    case '1-2':
      return 0;
    case '1-0':
      return 2;
    case '0-1':
      return 2;
    case '0-2':
      return 1;
    case '2-0':
      return 1;
    case '2-1':
      return 0;
    default:
      return null;
  }
}

/**
 * Versucht gezielt, eine der alternativen Lösungen zu zerstören, indem die
 * Brückenzahl einer Kante geändert wird, an der sie sich vom Ziel unterscheidet.
 *
 * @returns {object|null} neue Lösung oder null
 */
function killAlternative(sol, board, intended, solutions, rng) {
  const alternatives = solutions.slice(1);
  if (!alternatives.length) return null;
  rng.shuffle(alternatives);

  for (const alt of alternatives) {
    const diffs = [];
    for (let e = 0; e < board.edges.length; e++) {
      if (alt[e] !== intended[e]) diffs.push(e);
    }
    if (!diffs.length) continue;
    rng.shuffle(diffs);

    for (const e of diffs) {
      const next = counterValue(intended[e], alt[e]);
      if (next === null) continue;
      const edge = board.edges[e];
      const candidate = withEdge(sol, edge.a, edge.b, next);
      if (!candidate || !validateSolution(candidate)) continue;
      return candidate;
    }
  }
  return null;
}

/**
 * Hill-Climbing: mutiert die Lösung, bis das Brett eindeutig lösbar ist.
 *
 * Zwei Erfolgskriterien:
 *   1. Die Propagation löst das Brett vollständig auf -> eindeutig
 *      und ohne Raten lösbar.
 *   2. Der Solver findet genau eine Lösung.
 */
function repair(sol, rng, maxIter) {
  let current = sol;
  let currentBoard = boardOf(current, numbersOf(current));
  let intended = countsOf(currentBoard, current);
  let solutions = findSolutions(currentBoard, 3);
  let currentCount = solutions.length;
  let best = null;
  let bestScore = -Infinity;

  for (let iter = 0; iter < maxIter; iter++) {
    const score = currentCount === 1 ? 1e6 + currentBoard.edges.length : -currentCount * 1000;
    if (score > bestScore) {
      bestScore = score;
      best = current;
    }

    if (currentCount === 1) {
      if (sameArray(solutions[0], intended)) return current;
    }
    if (currentCount === 0) return null;

    // 1) Gezielt eine alternative Lösung ausschalten
    const killed = killAlternative(current, currentBoard, intended, solutions, rng);
    if (killed) {
      current = killed;
      currentBoard = boardOf(current, numbersOf(current));
      intended = countsOf(currentBoard, current);
      solutions = findSolutions(currentBoard, 3);
      currentCount = solutions.length;
      continue;
    }

    // 2) Notlösung: Sättigung oder zufällige Mutation
    const status = propagationStatus(currentBoard);
    const hood = buildNeighbourhood(current, currentBoard, status, rng);
    if (!hood.length) break;

    const sample = rng.shuffle(hood.slice()).slice(0, 16);
    let chosen = null;
    let chosenCount = currentCount;
    for (const cand of sample) {
      if (!validateSolution(cand)) continue;
      const cev = evaluate(cand);
      if (cev.count < chosenCount) {
        chosen = cand;
        chosenCount = cev.count;
      }
      if (cev.count === 1) break;
    }

    if (!chosen) {
      if (currentCount === 1) break;
      // Kein Fortschritt: zufällige Störung und weiter
      const picked = rng.pick(hood);
      if (!validateSolution(picked)) break;
      current = picked;
      currentBoard = boardOf(current, numbersOf(current));
      intended = countsOf(currentBoard, current);
      solutions = findSolutions(currentBoard, 3);
      currentCount = solutions.length;
      continue;
    }

    current = chosen;
    currentBoard = boardOf(current, numbersOf(current));
    intended = countsOf(currentBoard, current);
    solutions = findSolutions(currentBoard, 3);
    currentCount = solutions.length;
  }

  // Abschlussprüfung der besten gefundenen Lösung
  if (best) {
    const board = boardOf(best, numbersOf(best));
    const sols = findSolutions(board, 2);
    if (sols.length === 1 && sameArray(sols[0], countsOf(board, best))) return best;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Schritt 4: Qualitätsbewertung & Auswahl
 * ------------------------------------------------------------------ */

function qualityScore(board, counts) {
  let score = 0;
  const nums = board.islands.map((i) => i.num);
  const doubles = counts.filter((c) => c === 2).length;
  score += board.islands.length * 0.6;
  score += 2.0 * nums.filter((n) => n >= 3).length;
  score += 1.5 * nums.filter((n) => n >= 5).length;
  // Doppelbrücken machen das Rätsel interessanter – sie zählen stark.
  score += 1.6 * doubles;
  score += 1.2 * new Set(nums).size;
  score -= 0.5 * nums.filter((n) => n === 1).length;
  const rowsUsed = new Set(board.islands.map((i) => i.r)).size;
  const colsUsed = new Set(board.islands.map((i) => i.c)).size;
  score += 0.6 * (rowsUsed + colsUsed);
  return score;
}

/* ------------------------------------------------------------------ *
 * Notfall-Lösung: garantiert eindeutig lösbarer "Stern"
 * ------------------------------------------------------------------ */

/**
 * Kreuzförmiges Rätsel: ein Zentrum mit vier Armen.
 * Die Zentrumszahl erzwingt alle vier Verbindungen, die Arme sind lineare
 * Ketten -> genau eine Lösung. Dient als Absicherung, falls die
 * Zufallssuche kein eindeutiges Rätsel findet.
 */
function starFallback(cols, rows) {
  const cr = Math.floor(rows / 2);
  const cc = Math.floor(cols / 2);
  const islands = [{ r: cr, c: cc }];
  const edges = [];
  const arms = [
    { dr: -1, dc: 0 },
    { dr: 1, dc: 0 },
    { dr: 0, dc: -1 },
    { dr: 0, dc: 1 },
  ];
  for (const arm of arms) {
    let prev = 0;
    for (let s = 1; s <= 2; s++) {
      const r = cr + arm.dr * s;
      const c = cc + arm.dc * s;
      if (r < 0 || r >= rows || c < 0 || c >= cols) break;
      const id = islands.length;
      islands.push({ r, c });
      edges.push({ a: prev, b: id, w: 1 });
      prev = id;
    }
  }
  const sol = { cols, rows, islands, edges };
  if (!validateSolution(sol)) return null;
  const board = boardOf(sol, numbersOf(sol));
  const counts = countsOf(board, sol);
  const sols = findSolutions(board, 2);
  if (sols.length !== 1 || !sameArray(sols[0], counts)) return null;
  return { sol, board, counts };
}

/* ------------------------------------------------------------------ *
 * Test-Hook: Zugriff auf die internen Schritte für die Testsuite.
 * ------------------------------------------------------------------ */

export const internals = {
  growSolution,
  repair,
  evaluate,
  boardOf,
  countsOf,
  numbersOf,
  validateSolution,
  starFallback,
  withEdge,
  addEdge,
  killAlternative,
  counterValue,
};

/* ------------------------------------------------------------------ *
 * Öffentliche API
 * ------------------------------------------------------------------ */

/**
 * Erzeugt ein neues Rätsel.
 *
 * @param {object} options
 * @param {string} [options.difficulty] 'easy' | 'medium' | 'hard' | 'expert'
 * @param {string} [options.seed]        Seed für reproduzierbare Rätsel
 * @param {number} [options.islands]     Feste Inselzahl (überschreibt den Bereich)
 * @param {object} [options.format]      Rasterformat (siehe BOOKLET_FORMAT)
 * @param {number} [options.keep]        Anzahl Kandidaten für die Qualitätsauswahl
 * @param {string} [options.target]      Gewünschte Schwierigkeitsstufe. Der
 *   Generator sucht dann ein Rätsel, dessen *gemessene* Schwierigkeit in
 *   das Band der Stufe fällt – und passt dafür die Rastergrösse an.
 */
export function generatePuzzle({
  difficulty = 'medium',
  seed = randomSeed(),
  islands = null,
  format = null,
  keep = null,
  target = null,
  maxGridFactor = 60,
} = {}) {
  const cfg = DIFFICULTIES[difficulty] ?? DIFFICULTIES.medium;
  const fmt = format ?? cfg;
  const rng = new RNG(`${seed}|${difficulty}|hashi-v4`);

  const minIslands = islands ?? fmt.min;
  const maxIslands = islands ?? fmt.max;
  // Bei fester Inselzahl wird mehr Zeit investiert: die Erzeugung eines
  // Heftes darf ruhig einige Minuten dauern.
  const tries = islands ? Math.max(40, cfg.tries) : cfg.tries;
  const keepCount = keep ?? cfg.keep;
  const band = target ? LEVEL_BANDS[target] ?? null : null;

  /**
   * Erzeugt einen Kandidaten auf einem vorgegebenen Raster.
   * @returns {object|null}
   */
  const makeOne = (cols, rows) => {
    const islandCount = rng.range(minIslands, maxIslands);
    const sol = growSolution(
      rng,
      islandCount,
      cols,
      rows,
      fmt.double,
      fmt.maxExtra,
      fmt.maxLen ?? 2,
      fmt.noAdjacent ?? false,
    );
    if (!sol) return null;
    if (!validateSolution(sol)) return null;

    let current = sol;
    // Die Reparaturschleife rechnet mit dem Solver und ist deshalb nur für
    // kleine Bretter schnell genug. Bei grossen Brettern hilft stattdessen
    // der Versuch mit einer anderen Anordnung.
    if (fmt.repairLimit && islandCount <= fmt.repairLimit) {
      const fixed = repair(sol, rng, cfg.maxRepair);
      if (fixed) current = fixed;
    }

    // Auf den kleinsten umschliessenden Rechteck beschneiden
    current = cropSolution(current);

    const board = boardOf(current, numbersOf(current));
    const counts = countsOf(board, current);

    // Endgültige Härteprüfung: es darf genau eine Lösung geben.
    // Der Solver misst dabei zugleich den Aufwand, der für die
    // Schwierigkeitsbewertung gebraucht wird.
    const solver = new Solver(board);
    const solutions = solver.findSolutions(2);
    if (solutions.length !== 1) return null;
    if (!sameArray(solutions[0], counts)) return null;

    const metrics = measure(board, solver, solver.ruleSteps);
    return {
      board,
      counts,
      difficulty: score(metrics, GLOBAL_BOUNDS),
      relative: relativeScore(metrics, BUCKET_BOUNDS[bucketFor(board.islands.length)]),
      quality: qualityScore(board, counts),
    };
  };

  let best = null;
  let bestDistance = Infinity;

  if (band && islands) {
    // Adaptive Suche: die Rastergrösse wird anhand der *gemessenen*
    // Schwierigkeit nachgeführt. Zu schwer -> luftigeres Raster (mehr
    // Felder je Insel), zu leicht -> dichteres.
    //
    // Bei festen Inselzahlen streut die Schwierigkeit stark (die Struktur
    // des Baumes entscheidet mit). Deshalb wird je Rastergrösse der
    // Mittelwert mehrerer Versuche herangezogen.
    const mid = (band[0] + band[1]) / 2;
    const maxFactor = maxGridFactor ?? 60;
    let factor = (fmt.cols * fmt.rows) / Math.max(1, islands);

    for (let round = 0; round < 6; round++) {
      const [cols, rows] = gridFor(islands, factor);
      let sum = 0;
      let n = 0;
      for (let attempt = 0; attempt < 3; attempt++) {
        const candidate = makeOne(cols, rows);
        if (!candidate) continue;
        n++;
        sum += candidate.difficulty;
        const distance = bandDistance(candidate.difficulty, band);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = candidate;
        }
        if (distance === 0) break;
      }
      if (bestDistance === 0) break;
      // Richtung bestimmen
      if (n > 0 && sum / n > mid) factor *= 1.4;
      else factor /= 1.4;
      factor = Math.max(1.6, Math.min(maxFactor, factor));
      // Am Anschlag der Rastergrösse ist nichts mehr zu holen.
      if (factor >= maxFactor || factor <= 1.6) break;
    }
  } else {
    // Ohne Zielvorgabe: das beste von mehreren Kandidaten nach der
    // Struktur-Qualität.
    let bestScore = -Infinity;
    let valid = 0;
    for (let attempt = 0; attempt < tries; attempt++) {
      const candidate = makeOne(fmt.cols, fmt.rows);
      if (!candidate) continue;
      valid++;
      if (candidate.quality > bestScore) {
        bestScore = candidate.quality;
        best = candidate;
      }
      if (valid >= keepCount) break;
    }
  }

  if (!best) {
    // Notfall: kleineres, leichter eindeutig lösbares Rätsel
    const fallback = growSolution(rng, 12, 9, 9, 0.1, 1, fmt.maxLen ?? 3);
    if (!fallback) throw new Error('Rätselgenerierung fehlgeschlagen');
    const fixed = repair(fallback, rng, 300);
    const sol = fixed ?? fallback;
    const board = boardOf(sol, numbersOf(sol));
    best = {
      board,
      counts: countsOf(board, sol),
      difficulty: 0.2,
      relative: 0.5,
      quality: qualityScore(board, countsOf(board, sol)),
    };
  }

  return {
    seed: String(seed),
    difficulty: cfg.id,
    difficultyLabel: cfg.label,
    cols: best.board.cols,
    rows: best.board.rows,
    islands: best.board.islands.map((i) => ({ id: i.id, r: i.r, c: i.c, num: i.num })),
    edges: best.board.edges,
    solution: best.counts.slice(),
    doubles: best.counts.filter((c) => c === 2).length,
    score: Number(best.quality.toFixed(2)),
    // Gemessener Schwierigkeitsgrad: 0 = sehr leicht, 1 = sehr schwer.
    // Getrennt von `difficulty` (der Stufen-Kennung) benannt.
    difficultyScore: Number(best.difficulty.toFixed(3)),
    difficultyText: difficultyLabel(best.difficulty, BANDS),
    // Einordnung innerhalb gleich grosser Rätsel.
    difficultyRelative: Number((best.relative ?? 0.5).toFixed(3)),
  };
}
