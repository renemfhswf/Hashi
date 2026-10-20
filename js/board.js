/**
 * Spielbrett-Modell für Hashiwokakero.
 *
 * Enthält die komplette Spiellogik, die unabhängig von der Oberfläche ist:
 *  - Kanten (mögliche Brücken) zwischen benachbarten Inseln
 *  - Kreuzungen (dürfen sich nicht kreuzen)
 *  - Nachbarschafts-Listen
 *
 * Regeln, die das Modell abbildet:
 *  1. Eine Brücke verbindet genau zwei Inseln auf derselben Zeile/Spalte,
 *     zwischen denen keine weitere Insel liegt.
 *  2. Zwischen zwei Inseln sind maximal 2 Brücken erlaubt.
 *  3. Brücken dürfen sich nicht kreuzen.
 *  4. Jede Insel trägt so viele Brücken, wie ihre Zahl angibt.
 *  5. Alle Inseln müssen am Ende über Brücken verbunden sein.
 */

/**
 * @typedef {Object} Island
 * @property {number} id     Eindeutige Insel-ID (Index im Brett)
 * @property {number} r      Zeile
 * @property {number} c      Spalte
 * @property {number} num    Erforderliche Anzahl Brücken
 */

/**
 * @typedef {Object} Edge
 * @property {string} id     Eindeutige Kanten-ID
 * @property {number} a      Insel-Index A
 * @property {number} b      Insel-Index B
 * @property {'h'|'v'} dir   Orientierung
 * @property {number} r1     Zeile Start
 * @property {number} c1     Spalte Start
 * @property {number} r2     Zeile Ende
 * @property {number} c2     Spalte Ende
 */

/**
 * Prüft, ob sich zwei Kanten kreuzen würden.
 * Nur horizontale/vertikale Paare können sich kreuzen.
 */
export function edgesCross(e, f) {
  if (e.dir === f.dir) return false;
  const h = e.dir === 'h' ? e : f;
  const v = e.dir === 'h' ? f : e;
  return h.c1 < v.c1 && v.c1 < h.c2 && v.r1 < h.r1 && h.r1 < v.r2;
}

/**
 * Baut das vollständige Brettmodell.
 *
 * @param {Island[]} islands  Inseln mit Nummer
 * @param {number} cols       Spaltenzahl des Gitters
 * @param {number} rows       Zeilenzahl des Gitters
 */
export function buildBoard(islands, cols, rows) {
  const list = islands.map((s, i) => ({
    id: s.id ?? i,
    index: i,
    r: s.r,
    c: s.c,
    num: s.num,
  }));

  const edges = [];

  // Horizontale Kanten: aufeinanderfolgende Inseln einer Zeile.
  const byRow = new Map();
  for (const isl of list) {
    if (!byRow.has(isl.r)) byRow.set(isl.r, []);
    byRow.get(isl.r).push(isl);
  }
  for (const r of [...byRow.keys()].sort((a, b) => a - b)) {
    const arr = byRow.get(r).sort((a, b) => a.c - b.c);
    for (let i = 0; i + 1 < arr.length; i++) {
      const a = arr[i];
      const b = arr[i +1];
      edges.push({
        id: `e${edges.length}`,
        a: a.index,
        b: b.index,
        dir: 'h',
        r1: a.r,
        c1: a.c,
        r2: b.r,
        c2: b.c,
      });
    }
  }

  // Vertikale Kanten: aufeinanderfolgende Inseln einer Spalte.
  const byCol = new Map();
  for (const isl of list) {
    if (!byCol.has(isl.c)) byCol.set(isl.c, []);
    byCol.get(isl.c).push(isl);
  }
  for (const c of [...byCol.keys()].sort((a, b) => a - b)) {
    const arr = byCol.get(c).sort((a, b) => a.r - b.r);
    for (let i = 0; i + 1 < arr.length; i++) {
      const a = arr[i];
      const b = arr[i + 1];
      edges.push({
        id: `e${edges.length}`,
        a: a.index,
        b: b.index,
        dir: 'v',
        r1: a.r,
        c1: a.c,
        r2: b.r,
        c2: b.c,
      });
    }
  }

  // Kreuzungen
  const crossings = edges.map(() => []);
  for (let i = 0; i < edges.length; i++) {
    for (let j = i + 1; j < edges.length; j++) {
      if (edgesCross(edges[i], edges[j])) {
        crossings[i].push(j);
        crossings[j].push(i);
      }
    }
  }

  // Inzidenz: pro Insel die Liste der Kanten-Indizes
  const incident = list.map(() => []);
  edges.forEach((e, i) => {
    incident[e.a].push(i);
    incident[e.b].push(i);
  });

  // Nachbarschaft: pro Insel die Nachbarn (über eine Kante erreichbar)
  const neighbors = list.map(() => []);
  edges.forEach((e, i) => {
    neighbors[e.a].push({ edge: i, other: e.b });
    neighbors[e.b].push({ edge: i, other: e.a });
  });

  return { cols, rows, islands: list, edges, crossings, incident, neighbors };
}

/**
 * Prüft, ob ein Zellenpunkt von einer Insel belegt ist.
 */
export function findIslandAt(islands, r, c) {
  return islands.find((i) => i.r === r && i.c === c) ?? null;
}

/**
 * Prüft, ob alle Inseln über die gesetzten Brücken verbunden sind.
 *
 * @param {number[]} counts  Anzahl Brücken pro Kante (Index = Kanten-Index)
 */
export function isConnected(board, counts) {
  const n = board.islands.length;
  if (n === 0) return true;
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  board.edges.forEach((e, i) => {
    if ((counts[i] ?? 0) > 0) union(e.a, e.b);
  });
  const root = find(0);
  for (let i = 1; i < n; i++) {
    if (find(i) !== root) return false;
  }
  return true;
}
