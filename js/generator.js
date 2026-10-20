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
import { findSolutions, propagationStatus } from './solver.js';

export const DIFFICULTIES = {
  easy: {
    id: 'easy',
    label: 'Leicht',
    min: 7,
    max: 10,
    cols: 8,
    rows: 8,
    double: 0.22,
    maxExtra: 0,
    tries: 60,
    maxRepair: 300,
    keep: 4,
  },
  medium: {
    id: 'medium',
    label: 'Mittel',
    min: 10,
    max: 14,
    cols: 9,
    rows: 9,
    double: 0.3,
    maxExtra: 1,
    tries: 60,
    maxRepair: 360,
    keep: 4,
  },
  hard: {
    id: 'hard',
    label: 'Schwer',
    min: 14,
    max: 19,
    cols: 10,
    rows: 10,
    double: 0.36,
    maxExtra: 1,
    tries: 60,
    maxRepair: 420,
    keep: 3,
  },
  expert: {
    id: 'expert',
    label: 'Experte',
    min: 18,
    max: 24,
    cols: 12,
    rows: 11,
    double: 0.42,
    maxExtra: 2,
    tries: 60,
    maxRepair: 480,
    keep: 2,
  },
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
 * Baut eine zufällige, kreuzungsfreie Lösung.
 * @returns {{cols:number, rows:number, islands:{r:number,c:number}[], edges:{a:number,b:number,w:number}[]}|null}
 */
function growSolution(rng, target, cols, rows, doubleChance, maxExtra) {
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
  while (islands.length < target && guard < 6000) {
    guard++;
    const cands = [];
    const weights = [];

    for (let i = 0; i < islands.length; i++) {
      const isl = islands[i];
      for (const d of DIRS) {
        for (const dist of [1, 2]) {
          const nr = isl.r + d.dr * dist;
          const nc = isl.c + d.dc * dist;
          if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
          if (islandAt(islands, nr, nc)) continue;
          // Mittelfeld der Strecke muss frei sein (keine Brücke über eine Insel)
          if (dist === 2) {
            const mr = isl.r + d.dr;
            const mc = isl.c + d.dc;
            if (islandAt(islands, mr, mc)) continue;
          }
          if (liesOnBridge(islands, edges, nr, nc)) continue;
          if (crossesExisting(islands, edges, isl.r, isl.c, nr, nc)) continue;

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
          if (deg >= 4) w *= 0.05;
          else if (deg === 3) w *= 0.4;

          cands.push({ parent: i, r: nr, c: nc });
          weights.push(w);
        }
      }
    }

    if (cands.length === 0) break;
    const chosen = rng.pickWeighted(cands, weights);
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
 * Hill-Climbing: mutiert die Lösung, bis das Brett eindeutig lösbar ist.
 *
 * Zwei Erfolgskriterien:
 *   1. Die Propagation löst das Brett vollständig auf -> eindeutig
 *      und ohne Raten lösbar.
 *   2. Der Solver findet genau eine Lösung.
 */
function repair(sol, rng, maxIter) {
  let current = sol;
  let best = null;
  let bestScore = -Infinity;
  let stagnant = 0;
  const PATIENCE = 20;

  for (let iter = 0; iter < maxIter; iter++) {
    const ev = evaluate(current);
    const score = scoreOf(ev);

    if (ev.count === 1) {
      const intended = countsOf(ev.board, current);
      if (sameArray(intended, ev.status.counts ?? intended)) return current;
    }

    if (score > bestScore) {
      bestScore = score;
      best = current;
      stagnant = 0;
    } else {
      stagnant++;
    }

    const hood = buildNeighbourhood(current, ev.board, ev.status, rng);
    if (!hood.length) break;

    const sample = rng.shuffle(hood.slice()).slice(0, 22);
    let chosen = null;
    let chosenScore = score;

    for (const cand of sample) {
      if (!validateSolution(cand)) continue;
      const cev = evaluate(cand);
      const cs = scoreOf(cev);
      if (cs > chosenScore || (cs === chosenScore && rng.chance(0.06))) {
        chosen = cand;
        chosenScore = cs;
      }
      if (cev.count === 1) break;
    }

    if (!chosen) {
      if (stagnant > PATIENCE) {
        // Sackgasse: von der besten Lösung aus neu starten
        if (!best) break;
        current = best;
        bestScore = -Infinity;
        stagnant = 0;
        const fresh = buildNeighbourhood(current, ev.board, ev.status, rng);
        if (!fresh.length) break;
        const picked = rng.pick(fresh);
        if (!validateSolution(picked)) break;
        current = picked;
        continue;
      }
      break;
    }

    current = chosen;
  }

  // Abschlussprüfung der besten gefundenen Lösung
  if (best) {
    const ev = evaluate(best);
    if (ev.count === 1) {
      const intended = countsOf(ev.board, best);
      if (sameArray(intended, ev.status.counts ?? intended)) return best;
    }
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Schritt 4: Qualitätsbewertung & Auswahl
 * ------------------------------------------------------------------ */

function qualityScore(board, counts) {
  let score = 0;
  const nums = board.islands.map((i) => i.num);
  score += board.islands.length * 0.6;
  score += 2.0 * nums.filter((n) => n >= 3).length;
  score += 1.5 * nums.filter((n) => n >= 5).length;
  score += 0.8 * counts.filter((c) => c === 2).length;
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
 */
export function generatePuzzle({ difficulty = 'medium', seed = randomSeed() } = {}) {
  const cfg = DIFFICULTIES[difficulty] ?? DIFFICULTIES.medium;
  const rng = new RNG(`${seed}|${difficulty}|hashi-v2`);

  let best = null;
  let bestScore = -Infinity;
  let valid = 0;

  for (let attempt = 0; attempt < cfg.tries; attempt++) {
    const target = rng.range(cfg.min, cfg.max);
    const sol = growSolution(rng, target, cfg.cols, cfg.rows, cfg.double, cfg.maxExtra);
    if (!sol) continue;
    if (!validateSolution(sol)) continue;

    let current = sol;
    let board = boardOf(current, numbersOf(current));
    let counts = countsOf(board, current);

    // Ist das Rätsel schon eindeutig lösbar?
    let status = propagationStatus(board);
    if (!status.complete) {
      const fixed = repair(current, rng, cfg.maxRepair);
      if (!fixed) continue;
      current = fixed;
      board = boardOf(current, numbersOf(current));
      counts = countsOf(board, current);
      status = propagationStatus(board);
    }

    // Auf den kleinsten umschliessenden Rechteck beschneiden
    current = cropSolution(current);
    board = boardOf(current, numbersOf(current));
    counts = countsOf(board, current);

    // Endgültige Härteprüfung: es darf genau eine Lösung geben
    const solutions = findSolutions(board, 3);
    if (solutions.length !== 1) continue;
    if (!sameArray(solutions[0], counts)) continue;

    const score = qualityScore(board, counts);
    valid++;
    if (score > bestScore) {
      bestScore = score;
      best = { board, counts };
    }
    if (valid >= cfg.keep) break;
  }

  if (!best) {
    const fb = starFallback(cfg.cols, cfg.rows);
    if (!fb) throw new Error('Rätselgenerierung fehlgeschlagen');
    best = { board: fb.board, counts: fb.counts };
    bestScore = qualityScore(fb.board, fb.counts);
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
    score: Number(bestScore.toFixed(2)),
  };
}
