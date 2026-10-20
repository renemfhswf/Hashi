/**
 * Canvas-Renderer für das Hashi-Spielbrett.
 *
 * Zeichnet Brücken (einfach/doppelt), Inseln mit Zahl und optionale
 * Hervorhebungen (Auswahl, Hinweis, Fehler, Lösung). Trefferprüfung für
 * Maus- und Touch-Eingabe liegt ebenfalls hier.
 */

const FALLBACK_THEME = {
  ink: '#111111',
  island: '#ffffff',
  islandFg: '#000000',
  islandStroke: '#111111',
  accent: '#4f46e5',
  accentSoft: '#eef2ff',
  correct: '#039855',
  wrong: '#d92d20',
  surface: '#ffffff',
  border: '#e4e7ec',
  grid: 'rgba(16, 24, 40, 0.16)',
  frame: 'rgba(16, 24, 40, 0.45)',
};

/** Liest die Farben aus den CSS-Custom-Properties (Light/Dark automatisch). */
export function readTheme() {
  if (typeof window === 'undefined' || !document?.documentElement) return { ...FALLBACK_THEME };
  const styles = getComputedStyle(document.documentElement);
  const pick = (name, fallback) => (styles.getPropertyValue(name) || '').trim() || fallback;
  return {
    ink: pick('--ink', FALLBACK_THEME.ink),
    island: pick('--island', FALLBACK_THEME.island),
    islandFg: pick('--island-fg', FALLBACK_THEME.islandFg),
    islandStroke: pick('--island-stroke', FALLBACK_THEME.islandStroke),
    accent: pick('--accent', FALLBACK_THEME.accent),
    accentSoft: pick('--accent-soft', FALLBACK_THEME.accentSoft),
    correct: pick('--correct', FALLBACK_THEME.correct),
    wrong: pick('--wrong', FALLBACK_THEME.wrong),
    surface: pick('--surface', FALLBACK_THEME.surface),
    border: pick('--border', FALLBACK_THEME.border),
    grid: pick('--grid', FALLBACK_THEME.grid),
    frame: pick('--frame', FALLBACK_THEME.frame),
  };
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = x1 + t * dx;
  const cy = y1 + t * dy;
  return Math.hypot(px - cx, py - cy);
}

export class BoardRenderer {
  /** @param {HTMLCanvasElement} canvas */
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.theme = readTheme();
    this.board = null;
    this.cell = 40;
    this.originX = 0;
    this.originY = 0;
    this.dpr = 1;
  }

  /** Liest die Theme-Farben neu (z. B. nach Theme-Wechsel). */
  refreshTheme() {
    this.theme = readTheme();
  }

  /** Passt die Canvas-Größe an den Container an und berechnet das Raster. */
  resize() {
    if (!this.board) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const width = Math.max(240, Math.floor(rect.width));
    const height = Math.max(240, Math.floor(rect.height));

    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dpr = dpr;

    // Rand für den Rahmen um das Spielfeld freihalten
    const margin = Math.max(10, Math.min(width, height) * 0.05);
    const cell = Math.min((width - 2 * margin) / this.board.cols, (height - 2 * margin) / this.board.rows);
    this.cell = cell;
    this.originX = (width - cell * this.board.cols) / 2;
    this.originY = (height - cell * this.board.rows) / 2;
    this.width = width;
    this.height = height;
  }

  setBoard(board) {
    this.board = board;
    this.resize();
  }

  /** Mittelpunkt einer Zelle in Canvas-Koordinaten. */
  cellCenter(r, c) {
    return {
      x: this.originX + (c + 0.5) * this.cell,
      y: this.originY + (r + 0.5) * this.cell,
    };
  }

  get islandRadius() {
    return this.cell * 0.33;
  }

  /**
   * Trefferprüfung anhand von Canvas-Koordinaten.
   * @returns {{type:'island', island:object}|{type:'edge', edge:object}|null}
   */
  hitTest(px, py) {
    if (!this.board) return null;
    const R = this.islandRadius;

    for (const isl of this.board.islands) {
      const { x, y } = this.cellCenter(isl.r, isl.c);
      if (Math.hypot(px - x, py - y) <= R * 1.12) {
        return { type: 'island', island: isl };
      }
    }

    const tol = Math.max(this.cell * 0.16, 9);
    for (const edge of this.board.edges) {
      const a = this.cellCenter(this.board.islands[edge.a].r, this.board.islands[edge.a].c);
      const b = this.cellCenter(this.board.islands[edge.b].r, this.board.islands[edge.b].c);
      if (distToSegment(px, py, a.x, a.y, b.x, b.y) <= tol) {
        return { type: 'edge', edge };
      }
    }
    return null;
  }

  /**
   * Zeichnet das Brett.
   * @param {object} state
   * @param {Map<string, number>} state.bridges   Brückenzahl je Kanten-ID
   * @param {Set<string>}   [state.wrong]        als falsch markierte Kanten
   * @param {Set<string>}   [state.hint]         hervorzuhebende Kanten
   * @param {boolean}       [state.reveal]       Lösung komplett einblenden
   * @param {number|null}   [state.selected]     ausgewählte Insel
   * @param {object|null}   [state.preview]      Vorschau {edge, count}
   * @param {object|null}   [state.hover]        Hover-Kante
   */
  draw(state) {
    const ctx = this.ctx;
    if (!this.board || !ctx) return;
    const t = this.theme;

    ctx.clearRect(0, 0, this.width, this.height);

    const bridges = state.bridges ?? new Map();
    const wrong = state.wrong ?? new Set();
    const hint = state.hint ?? new Set();
    const reveal = state.reveal === true;

    // Für die "fertig"-Markierung zählt immer der Spielstand des Spielers,
    // nicht eine eventuell eingeblendete Lösung.
    this.placed = bridges;
    this.revealedBridges = reveal && state.solution ? state.solution : null;

    this.drawGrid();
    this.drawFrame();

    // --- Brücken -----------------------------------------------------
    for (const edge of this.board.edges) {
      let count = bridges.get(edge.id) ?? 0;
      if (reveal && this.revealedBridges) count = this.revealedBridges.get(edge.id) ?? count;
      if (count <= 0) continue;

      const isWrong = wrong.has(edge.id);
      const isHint = hint.has(edge.id);
      const isHover = state.hover?.id === edge.id;

      let color = t.ink;
      if (isWrong) color = t.wrong;
      else if (isHint) color = t.accent;
      else if (reveal) color = t.accent;

      this.drawBridge(edge, count, color, isHover || isHint);
    }

    // Vorschau (Maus-Drag)
    if (state.preview && state.preview.count > 0) {
      this.drawBridge(state.preview.edge, state.preview.count, t.accent, true, 0.55);
    }

    // --- Inseln ------------------------------------------------------
    for (const isl of this.board.islands) {
      const { x, y } = this.cellCenter(isl.r, isl.c);
      const selected = state.selected === isl.id;
      const complete = this.isComplete(isl);

      if (selected) {
        ctx.beginPath();
        ctx.arc(x, y, this.islandRadius * 1.32, 0, Math.PI * 2);
        ctx.fillStyle = t.accentSoft;
        ctx.fill();
      }

      // Weisse Insel mit schwarzem Rand
      ctx.beginPath();
      ctx.arc(x, y, this.islandRadius, 0, Math.PI * 2);
      ctx.fillStyle = t.island;
      ctx.fill();
      ctx.lineWidth = Math.max(1.5, this.cell * 0.05);
      ctx.strokeStyle = t.islandStroke;
      ctx.stroke();

      if (selected) {
        ctx.lineWidth = Math.max(2, this.cell * 0.055);
        ctx.strokeStyle = t.accent;
        ctx.stroke();
      }

      // Bereits erfüllte Inseln werden diagonal durchgestrichen
      if (complete) this.drawStrike(x, y);

      const size = Math.round(this.islandRadius * 1.22);
      ctx.font = `700 ${size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (complete) {
        // Weisser Halo, damit die Zahl lesbar bleibt
        ctx.lineJoin = 'round';
        ctx.lineWidth = Math.max(2.5, this.cell * 0.1);
        ctx.strokeStyle = t.island;
        ctx.strokeText(String(isl.num), x, y + size * 0.04);
      }
      ctx.fillStyle = t.islandFg;
      ctx.fillText(String(isl.num), x, y + size * 0.04);
    }
  }

  /**
   * Ist die Insel bereits erfüllt? (keine weiteren Brücken möglich)
   * Gezählt werden die vom Spieler gesetzten Brücken.
   */
  isComplete(island) {
    if (!this.board || !this.placed) return false;
    let sum = 0;
    for (const edge of this.board.edges) {
      if (edge.a === island.index || edge.b === island.index) {
        sum += this.placed.get(edge.id) ?? 0;
      }
    }
    return sum >= island.num;
  }

  /** Diagonale von links unten nach rechts oben durch eine Insel. */
  drawStrike(x, y) {
    const ctx = this.ctx;
    const R = this.islandRadius;
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, R, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.moveTo(x - R, y + R);
    ctx.lineTo(x + R, y - R);
    ctx.strokeStyle = this.theme.islandStroke;
    ctx.lineWidth = Math.max(1.5, this.cell * 0.045);
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Zeichnet die Hilfslinien (gepunktetes Raster) hinter dem Spielfeld.
   * Die Linien verlaufen durch die Inseln hindurch – jede Insel liegt damit
   * in der Mitte einer waagerechten und einer senkrechten Linie.
   */
  drawGrid() {
    const ctx = this.ctx;
    const t = this.theme;
    const { cols, rows } = this.board;
    const x0 = this.originX;
    const y0 = this.originY;
    const w = this.cell * cols;
    const h = this.cell * rows;

    ctx.save();
    ctx.strokeStyle = t.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([1.5, 4]);
    ctx.beginPath();
    for (let c = 0; c < cols; c++) {
      const x = x0 + (c + 0.5) * this.cell;
      ctx.moveTo(x, y0);
      ctx.lineTo(x, y0 + h);
    }
    for (let r = 0; r < rows; r++) {
      const y = y0 + (r + 0.5) * this.cell;
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + w, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Zeichnet den Rahmen um das Spielfeld. */
  drawFrame() {
    const ctx = this.ctx;
    const t = this.theme;
    const { cols, rows } = this.board;
    const x = this.originX;
    const y = this.originY;
    const w = this.cell * cols;
    const h = this.cell * rows;
    const radius = Math.min(w, h) * 0.035;

    ctx.save();
    ctx.strokeStyle = t.frame;
    ctx.lineWidth = Math.max(1.25, this.cell * 0.035);
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, radius);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.stroke();
    ctx.restore();
  }

  /** Zeichnet eine Brücke (einfach oder doppelt) zwischen zwei Inseln. */
  drawBridge(edge, count, color, emphasized = false, alpha = 1) {
    const ctx = this.ctx;
    const a = this.cellCenter(this.board.islands[edge.a].r, this.board.islands[edge.a].c);
    const b = this.cellCenter(this.board.islands[edge.b].r, this.board.islands[edge.b].c);

    const thickness = Math.max(1.5, this.cell * 0.062);
    const offset = this.cell * 0.082;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = emphasized ? thickness * 1.5 : thickness;
    if (emphasized) {
      ctx.shadowColor = color;
      ctx.shadowBlur = this.cell * 0.22;
    }

    const lines = count >= 2 ? [-offset, offset] : [0];
    for (const off of lines) {
      ctx.beginPath();
      if (edge.dir === 'h') {
        ctx.moveTo(a.x, a.y + off);
        ctx.lineTo(b.x, b.y + off);
      } else {
        ctx.moveTo(a.x + off, a.y);
        ctx.lineTo(b.x + off, b.y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }
}
