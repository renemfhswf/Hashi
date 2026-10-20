/**
 * Spielzustand für Hashi.
 *
 * Kapselt alles, was mit dem Spielstand zu tun hat – ohne DOM-Abhängigkeit,
 * damit es direkt testbar ist:
 *   - gesetzte Brücken
 *   - Verlauf (Undo/Redo)
 *   - Prüfung, Hinweise, Lösung
 *   - Erkennung des gelösten Zustands
 */

export class Game {
  /**
   * @param {object} board            Brettmodell aus buildBoard()
   * @param {number[]} solution       Brückenzahl je Kante (Index = Kanten-Index)
   */
  constructor(board, solution = []) {
    this.board = board;
    this.solution = new Map();
    this.bridges = new Map();
    this.history = [];
    this.future = [];
    this.wrong = new Set();
    /** Hervorgehobene Kante des letzten Hinweises. */
    this.hints = new Set();
    this.solved = false;
    this.hintsUsed = 0;
    this.revealed = false;
    this.setSolution(solution);
  }

  /** Übernimmt die Lösung (Array in Kantenreihenfolge oder Map). */
  setSolution(solution) {
    this.solution = new Map();
    if (solution instanceof Map) {
      this.solution = new Map(solution);
      return;
    }
    if (!this.board) return;
    this.board.edges.forEach((edge, i) => {
      this.solution.set(edge.id, solution[i] ?? 0);
    });
  }

  /** Anzahl gesetzter Brücken (Doppelbrücken zählen doppelt). */
  get bridgeTotal() {
    let total = 0;
    for (const count of this.bridges.values()) total += count;
    return total;
  }

  /** Anzahl belegter Kanten. */
  get bridgeCount() {
    return this.bridges.size;
  }

  /** Setzt eine Brücke (0 entfernt sie) und protokolliert den Zug. */
  setBridge(edgeId, count, { record = true } = {}) {
    const before = this.bridges.get(edgeId) ?? 0;
    if (before === count) return false;
    if (count > 0) this.bridges.set(edgeId, count);
    else this.bridges.delete(edgeId);
    if (record) {
      this.history.push({ edgeId, from: before, to: count });
      this.future.length = 0;
    }
    this.clearFeedback();
    return true;
  }

  /** 0 -> 1 -> 2 -> 0 */
  cycleEdge(edgeId) {
    const current = this.bridges.get(edgeId) ?? 0;
    return this.setBridge(edgeId, (current + 1) % 3);
  }

  /** Nimmt den letzten Zug zurück. */
  undo() {
    const move = this.history.pop();
    if (!move) return false;
    this.applyEdge(move.edgeId, move.from);
    this.future.push(move);
    this.clearFeedback();
    return true;
  }

  /** Stellt den zuletzt zurückgenommenen Zug wieder her. */
  redo() {
    const move = this.future.pop();
    if (!move) return false;
    this.applyEdge(move.edgeId, move.to);
    this.history.push(move);
    this.clearFeedback();
    return true;
  }

  /** Setzt eine Kante auf einen bestimmten Wert, ohne den Verlauf zu ändern. */
  applyEdge(edgeId, count) {
    if (count > 0) this.bridges.set(edgeId, count);
    else this.bridges.delete(edgeId);
  }

  /** Entfernt Prüf- und Hinweismarkierungen. */
  clearFeedback() {
    this.wrong.clear();
    this.hints.clear();
    this.revealed = false;
  }

  /**
   * Prüft die gesetzten Brücken gegen die Lösung.
   * @returns {{placed:number, wrong:number}}
   */
  check() {
    this.wrong.clear();
    this.hints.clear();
    this.revealed = false;
    let wrong = 0;
    let placed = 0;
    for (const [edgeId, count] of this.bridges) {
      placed++;
      if (this.solution.get(edgeId) !== count) {
        this.wrong.add(edgeId);
        wrong++;
      }
    }
    return { placed, wrong };
  }

  /**
   * Setzt eine einzelne korrekte Brücke bzw. korrigiert eine falsche.
   * @returns {{edgeId:string, from:number, to:number}|null}
   */
  hint() {
    this.wrong.clear();
    this.revealed = false;
    this.hints.clear();

    // Zuerst falsche Brücken korrigieren …
    for (const [edgeId, count] of this.bridges) {
      const target = this.solution.get(edgeId);
      if (target !== count) return this.applyHint(edgeId, count, target);
    }
    // … danach fehlende ergänzen.
    const missing = this.board.edges.find(
      (edge) => (this.bridges.get(edge.id) ?? 0) !== this.solution.get(edge.id),
    );
    if (!missing) return null;
    return this.applyHint(missing.id, this.bridges.get(missing.id) ?? 0, this.solution.get(missing.id));
  }

  /** Wendet einen Hinweis an und vermerkt ihn im Verlauf. */
  applyHint(edgeId, from, to) {
    this.applyEdge(edgeId, to);
    this.history.push({ edgeId, from, to });
    this.future.length = 0;
    this.hints.add(edgeId);
    this.hintsUsed++;
    return { edgeId, from, to };
  }

  /** Übernimmt die vollständige Lösung. */
  solve() {
    this.bridges = new Map();
    for (const [edgeId, count] of this.solution) {
      if (count > 0) this.bridges.set(edgeId, count);
    }
    this.history = [];
    this.future = [];
    this.wrong.clear();
    this.hints.clear();
    this.revealed = true;
  }

  /** Ist das Rätsel vollständig und korrekt gelöst? */
  isSolved() {
    if (this.solved) return true;
    for (const edge of this.board.edges) {
      if ((this.bridges.get(edge.id) ?? 0) !== (this.solution.get(edge.id) ?? 0)) return false;
    }
    this.solved = true;
    return true;
  }

  /** Setzt den Spielstand zurück (neues Rätsel). */
  reset() {
    this.bridges = new Map();
    this.history = [];
    this.future = [];
    this.wrong.clear();
    this.hints.clear();
    this.solved = false;
    this.hintsUsed = 0;
    this.revealed = false;
  }
}
