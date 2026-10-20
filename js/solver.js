/**
 * Constraint-basierter Solver für Hashiwokakero.
 *
 * Der Solver arbeitet mit Domänen (Bitmasken) pro Kante:
 *   Bit 0 -> Brückenzahl 0 erlaubt
 *   Bit 1 -> Brückenzahl 1 erlaubt
 *   Bit 2 -> Brückenzahl 2 erlaubt
 *
 * Propagationsregeln:
 *   A) Insel-Summe:  sum(Brücken an Insel i) == Zahl(i)
 *      -> Vor dem Verzweigen wird jede Kante auf den Bereich
 *         [zahl - max(Rest), zahl - min(Rest)] eingeschränkt.
 *   B) Kreuzungen:    zwei sich kreuzende Kanten dürfen nicht beide > 0 sein.
 *      -> Ist eine Kante auf > 0 festgelegt, werden alle Kreuzungen auf 0.
 *   C) Konnektivität: alle Inseln müssen am Ende erreichbar sein.
 *      -> Der "potentielle" Graph (Kanten, die > 0 sein *könnten*) muss
 *         verbunden sein, sonst kann es keine Lösung geben.
 *
 * Ein Brett, das bereits durch reine Propagation vollständig bestimmt wird,
 * besitzt garantiert genau eine Lösung (Propagation entfernt nur unmögliche
 * Werte). Das ist die Grundlage des Generators (Stichwort: `propagationStatus`).
 */

const D0 = 1;
const D1 = 2;
const D2 = 4;
const DOM_ALL = D0 | D1 | D2;

const minVal = (d) => (d & D0 ? 0 : d & D1 ? 1 : 2);
const maxVal = (d) => (d & D2 ? 2 : d & D1 ? 1 : 0);
const valOf = (d) => (d & D2 ? 2 : d & D1 ? 1 : 0);
const popcount = (d) => (d & D0 ? 1 : 0) + (d & D1 ? 1 : 0) + (d & D2 ? 1 : 0);

export class Solver {
  /** @param {ReturnType<import('./board.js').buildBoard>} board */
  constructor(board) {
    this.board = board;
    this.edges = board.edges;
    this.m = board.edges.length;
    this.incident = board.incident;
    this.crossings = board.crossings;
    this.islands = board.islands;
    this.nodes = 0; // Anzahl der Suchknoten (Statistik)
  }

  /**
   * Propagationslauf auf einer Domänenkopie.
   * @param {Int8Array} dom  wird in place verändert
   * @returns {boolean} false, wenn die Domänen widersprüchlich sind
   */
  propagate(dom) {
    const { m, incident, crossings, islands } = this;
    let changed = true;
    while (changed) {
      changed = false;

      // (A) Insel-Summen
      for (let i = 0; i < islands.length; i++) {
        const t = islands[i].num;
        const es = incident[i];
        if (es.length === 0) {
          if (t !== 0) return false;
          continue;
        }
        let minS = 0;
        let maxS = 0;
        for (const e of es) {
          minS += minVal(dom[e]);
          maxS += maxVal(dom[e]);
        }
        if (minS > t || maxS < t) return false;

        for (const e of es) {
          const othersMin = minS - minVal(dom[e]);
          const othersMax = maxS - maxVal(dom[e]);
          const lo = t - othersMax;
          const hi = t - othersMin;
          const cur = dom[e];
          let nd = 0;
          if (cur & D0 && 0 >= lo && 0 <= hi) nd |= D0;
          if (cur & D1 && 1 >= lo && 1 <= hi) nd |= D1;
          if (cur & D2 && 2 >= lo && 2 <= hi) nd |= D2;
          if (nd === 0) return false;
          if (nd !== cur) {
            dom[e] = nd;
            changed = true;
          }
        }
      }

      // (B) Kreuzungen
      for (let e = 0; e < m; e++) {
        if (dom[e] & D0) continue; // 0 ist noch möglich -> kein Zwang
        for (const f of crossings[e]) {
          if (dom[f] & (D1 | D2)) {
            if (!(dom[f] & D0)) return false; // beide >0 erzwungen -> Konflikt
            dom[f] = D0;
            changed = true;
          }
        }
      }
    }
    return true;
  }

  /**
   * Erreichbarkeit über "mögliche" Kanten (potentieller Graph).
   * Notwendige Bedingung für die Lösbarkeit.
   */
  potentialConnected(dom) {
    const { edges, m, islands } = this;
    const parent = new Int32Array(islands.length);
    for (let i = 0; i < islands.length; i++) parent[i] = i;
    const find = (x) => {
      while (parent[x] !== x) {
        parent[x] = parent[parent[x]];
        x = parent[x];
      }
      return x;
    };
    for (let e = 0; e < m; e++) {
      if (dom[e] & (D1 | D2)) {
        const ra = find(edges[e].a);
        const rb = find(edges[e].b);
        if (ra !== rb) parent[ra] = rb;
      }
    }
    const root = find(0);
    for (let i = 1; i < islands.length; i++) if (find(i) !== root) return false;
    return true;
  }

  /**
   * Status nach reiner Propagation – die Grundlage des Generators.
   *
   * @returns {{ consistent: boolean, determined: number, complete: boolean,
   *             domains: number[], counts: number[]|null, freeEdges: number[] }}
   */
  propagationStatus() {
    const dom = new Int8Array(this.m).fill(DOM_ALL);
    const consistent = this.propagate(dom);
    if (!consistent) {
      return { consistent: false, determined: 0, complete: false, domains: [], counts: null, freeEdges: [] };
    }
    let determined = 0;
    const freeEdges = [];
    for (let e = 0; e < this.m; e++) {
      if (popcount(dom[e]) === 1) determined++;
      else freeEdges.push(e);
    }
    const complete = freeEdges.length === 0;
    const counts = complete ? Array.from(dom, (d) => valOf(d)) : null;
    return { consistent: true, determined, complete, domains: Array.from(dom), counts, freeEdges };
  }

  /**
   * Sucht bis zu `limit` Lösungen.
   * @param {number} limit
   * @returns {number[][]} Array von Brückenzahlen pro Kante
   */
  findSolutions(limit = 2) {
    const { edges, m, incident, crossings, islands } = this;
    const solutions = [];
    this.nodes = 0;

    if (islands.length === 0) return solutions;

    const isCompleteSolution = (counts) => {
      for (let i = 0; i < islands.length; i++) {
        let sum = 0;
        for (const e of incident[i]) sum += counts[e];
        if (sum !== islands[i].num) return false;
      }
      for (let e = 0; e < m; e++) {
        if (counts[e] === 0) continue;
        for (const f of crossings[e]) {
          if (counts[f] > 0) return false;
        }
      }
      const n = islands.length;
      const seen = new Uint8Array(n);
      const stack = [0];
      seen[0] = 1;
      let reached = 1;
      while (stack.length) {
        const cur = stack.pop();
        for (const e of incident[cur]) {
          if (counts[e] === 0) continue;
          const other = edges[e].a === cur ? edges[e].b : edges[e].a;
          if (!seen[other]) {
            seen[other] = 1;
            reached++;
            stack.push(other);
          }
        }
      }
      return reached === n;
    };

    const search = (d) => {
      if (solutions.length >= limit) return;
      this.nodes++;

      // Verzweigung: Kante mit der kleinsten Domäne wählen
      let best = -1;
      let bestScore = Infinity;
      for (let e = 0; e < m; e++) {
        const size = popcount(d[e]);
        if (size <= 1) continue;
        const score = size * 1000 + crossings[e].length;
        if (score < bestScore) {
          bestScore = score;
          best = e;
        }
      }

      if (best === -1) {
        const counts = new Int8Array(m);
        for (let e = 0; e < m; e++) counts[e] = valOf(d[e]);
        if (isCompleteSolution(counts)) solutions.push(Array.from(counts));
        return;
      }

      const cur = d[best];
      // Reihenfolge: erst viele, dann mittlere, dann keine Brücken.
      for (const v of [2, 1, 0]) {
        if (!(cur & (1 << v))) continue;
        const nd = Int8Array.from(d);
        nd[best] = 1 << v;
        if (this.propagate(nd) && this.potentialConnected(nd)) search(nd);
        if (solutions.length >= limit) return;
      }
    };

    const dom = new Int8Array(m).fill(DOM_ALL);
    if (!this.propagate(dom)) return solutions;
    if (!this.potentialConnected(dom)) return solutions;
    search(dom);
    return solutions;
  }

  /** Prüft, ob das Brett genau eine Lösung besitzt. */
  hasUniqueSolution() {
    return this.findSolutions(2).length === 1;
  }
}

/**
 * @param {ReturnType<import('./board.js').buildBoard>} board
 * @param {number} limit
 */
export function findSolutions(board, limit = 2) {
  return new Solver(board).findSolutions(limit);
}

/**
 * Prüft, ob ein Brett eindeutig lösbar ist, und liefert die Lösung zurück.
 * @returns {{ unique: boolean, solution: number[]|null, count: number }}
 */
export function analyzeBoard(board) {
  const solutions = findSolutions(board, 3);
  return {
    unique: solutions.length === 1,
    solution: solutions[0] ?? null,
    count: solutions.length,
  };
}

/**
 * Kurzform: Wie viele Kanten lassen sich allein durch Logik bestimmen?
 * `complete === true` garantiert eine eindeutige Lösung.
 */
export function propagationStatus(board) {
  return new Solver(board).propagationStatus();
}
