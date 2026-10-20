/**
 * SVG-Renderer für Hashi-Spielbretter.
 *
 * Wird für den Ausdruck und das Rätselheft verwendet: SVG skaliert
 * verlustfrei, ist im Browser wie in PDF gleichermassen scharf und
 * benötigt kein Canvas.
 *
 * Die Geometrie rechnet in "Zelleinheiten" (1 Einheit = 1 Rasterfeld).
 * Die Inseln sitzen in der Zellmitte, das Hilfsraster markiert die
 * Feldgrenzen.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Rand um das Spielfeld im SVG-Blickfeld (in Rasterzellen). */
export const SVG_VIEW_PAD = 0.12;

/**
 * Feste Masse in Millimetern, wenn das Brett in echten Millimetern
 * gezeichnet wird (`cellMm`-Modus). Damit bleiben Inseln, Schriften und
 * Brücken auf der Seite immer gleich gross – unabhängig von der Grösse
 * des Rasters.
 */
export const MM = {
  islandRadius: 1.5, // 3 mm Durchmesser
  fontSize: 2.35,
  bridgeWidth: 0.4,
  bridgeOffset: 0.55,
  gridWidth: 0.11,
  gridDash: '0.1 0.45',
  frameWidth: 0.25,
  islandStroke: 0.16,
};

export const SVG_DEFAULTS = {
  showGrid: true,
  showFrame: true,
  markComplete: true,
  islandFill: '#ffffff',
  islandStroke: '#111111',
  islandText: '#000000',
  bridgeColor: '#1f2937',
  gridColor: '#1f2937',
  gridOpacity: 0.16,
  frameColor: '#1f2937',
  frameOpacity: 0.42,
  islandRadius: 0.33,
  bridgeWidth: 0.062,
  bridgeOffset: 0.082,
  fontSize: 0.4,
};

const round = (n) => Math.round(n * 1000) / 1000;

/**
 * Erzeugt ein SVG-Element für ein Brett.
 *
 * @param {object} board                Brettmodell aus buildBoard()
 * @param {object} [options]
 * @param {Map<string,number>} [options.bridges]  Brückenzahl je Kanten-ID
 * @param {boolean} [options.showGrid]
 * @param {boolean} [options.showFrame]
 * @param {number}  [options.cellMm]     Grössе einer Rasterzelle in mm.
 *   Ist sie gesetzt, wird das Brett in echten Millimetern gezeichnet und
 *   alle Elemente (Inseln, Schrift, Brücken) behalten ihre feste Grösse.
 * @returns {SVGElement}
 */
export function boardToSvgElement(board, options = {}) {
  const o = { ...SVG_DEFAULTS, ...options };
  const svg = document.createElementNS(SVG_NS, 'svg');

  // Im Millimeter-Modus ist eine Benutzereinheit genau ein Millimeter.
  const mm = typeof o.cellMm === 'number' && o.cellMm > 0;
  const cell = mm ? o.cellMm : 1;

  const islandRadius = mm ? MM.islandRadius : o.islandRadius;
  const fontSize = mm ? MM.fontSize : o.fontSize;
  const bridgeWidth = mm ? MM.bridgeWidth : o.bridgeWidth;
  const bridgeOffset = mm ? MM.bridgeOffset : o.bridgeOffset;
  const islandStroke = mm ? MM.islandStroke : 0.045;
  const gridWidth = mm ? MM.gridWidth : 0.022;
  const gridDash = mm ? MM.gridDash : '0.05 0.22';
  const frameWidth = mm ? MM.frameWidth : 0.04;

  // Koordinaten: der Mittelpunkt der Insel (r, c) liegt auf (c, r).
  // Das Spielfeld reicht von -0.5 bis cols-0.5 (bzw. rows-0.5).
  const pad = SVG_VIEW_PAD;
  const vbX = -0.5 * cell - pad * cell;
  const vbY = -0.5 * cell - pad * cell;
  const vbW = (board.cols + 2 * pad) * cell;
  const vbH = (board.rows + 2 * pad) * cell;

  svg.setAttribute('viewBox', `${round(vbX)} ${round(vbY)} ${round(vbW)} ${round(vbH)}`);
  svg.setAttribute('xmlns', SVG_NS);
  svg.setAttribute('class', 'board-svg');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Hashi-Spielbrett');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  // --- Hilfsraster: Linien verlaufen durch die Inseln ----------------
  if (o.showGrid) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('stroke', o.gridColor);
    g.setAttribute('stroke-opacity', String(o.gridOpacity));
    g.setAttribute('stroke-width', String(gridWidth));
    g.setAttribute('stroke-dasharray', gridDash);
    g.setAttribute('stroke-linecap', 'round');
    for (let c = 0; c < board.cols; c++) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(c * cell));
      line.setAttribute('y1', String(-0.5 * cell));
      line.setAttribute('x2', String(c * cell));
      line.setAttribute('y2', String((board.rows - 0.5) * cell));
      g.appendChild(line);
    }
    for (let r = 0; r < board.rows; r++) {
      const line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(-0.5 * cell));
      line.setAttribute('y1', String(r * cell));
      line.setAttribute('x2', String((board.cols - 0.5) * cell));
      line.setAttribute('y2', String(r * cell));
      g.appendChild(line);
    }
    svg.appendChild(g);
  }

  // --- Rahmen um das Spielfeld --------------------------------------
  if (o.showFrame) {
    const frame = document.createElementNS(SVG_NS, 'rect');
    frame.setAttribute('x', String(-0.5 * cell));
    frame.setAttribute('y', String(-0.5 * cell));
    frame.setAttribute('width', String(board.cols * cell));
    frame.setAttribute('height', String(board.rows * cell));
    frame.setAttribute('rx', String(0.16 * cell));
    frame.setAttribute('fill', 'none');
    frame.setAttribute('stroke', o.frameColor);
    frame.setAttribute('stroke-opacity', String(o.frameOpacity));
    frame.setAttribute('stroke-width', String(frameWidth));
    svg.appendChild(frame);
  }

  // --- Brücken -------------------------------------------------------
  const bridges = options.bridges;
  if (bridges) {
    const g = document.createElementNS(SVG_NS, 'g');
    g.setAttribute('stroke', o.bridgeColor);
    g.setAttribute('stroke-width', String(bridgeWidth));
    g.setAttribute('stroke-linecap', 'round');
    for (const edge of board.edges) {
      const count = bridges.get(edge.id) ?? 0;
      if (count <= 0) continue;
      const a = board.islands[edge.a];
      const b = board.islands[edge.b];
      const ax = a.c * cell;
      const ay = a.r * cell;
      const bx = b.c * cell;
      const by = b.r * cell;
      const offsets = count >= 2 ? [-bridgeOffset, bridgeOffset] : [0];
      for (const off of offsets) {
        const line = document.createElementNS(SVG_NS, 'line');
        if (edge.dir === 'h') {
          line.setAttribute('x1', String(round(ax)));
          line.setAttribute('y1', String(round(ay + off)));
          line.setAttribute('x2', String(round(bx)));
          line.setAttribute('y2', String(round(by + off)));
        } else {
          line.setAttribute('x1', String(round(ax + off)));
          line.setAttribute('y1', String(round(ay)));
          line.setAttribute('x2', String(round(bx + off)));
          line.setAttribute('y2', String(round(by)));
        }
        g.appendChild(line);
      }
    }
    svg.appendChild(g);
  }

  // --- Inseln --------------------------------------------------------
  // Inseln, die bereits alle benötigten Brücken haben, werden diagonal
  // von links unten nach rechts oben durchgestrichen.
  const placed = new Map();
  if (bridges) {
    for (const edge of board.edges) {
      const count = bridges.get(edge.id) ?? 0;
      if (count <= 0) continue;
      placed.set(edge.a, (placed.get(edge.a) ?? 0) + count);
      placed.set(edge.b, (placed.get(edge.b) ?? 0) + count);
    }
  }

  const nodes = document.createElementNS(SVG_NS, 'g');
  for (const isl of board.islands) {
    const cx = isl.c * cell;
    const cy = isl.r * cell;
    const complete = o.markComplete && (placed.get(isl.index) ?? 0) >= isl.num;

    const circle = document.createElementNS(SVG_NS, 'circle');
    circle.setAttribute('cx', String(cx));
    circle.setAttribute('cy', String(cy));
    circle.setAttribute('r', String(islandRadius));
    circle.setAttribute('fill', o.islandFill);
    circle.setAttribute('stroke', o.islandStroke);
    circle.setAttribute('stroke-width', String(islandStroke));
    nodes.appendChild(circle);

    if (complete) {
      const strike = document.createElementNS(SVG_NS, 'line');
      const d = islandRadius * 0.78;
      strike.setAttribute('x1', String(round(cx - d)));
      strike.setAttribute('y1', String(round(cy + d)));
      strike.setAttribute('x2', String(round(cx + d)));
      strike.setAttribute('y2', String(round(cy - d)));
      strike.setAttribute('stroke', o.islandStroke);
      strike.setAttribute('stroke-width', String(islandStroke));
      strike.setAttribute('stroke-linecap', 'round');
      nodes.appendChild(strike);
    }

    const text = document.createElementNS(SVG_NS, 'text');
    text.setAttribute('x', String(cx));
    text.setAttribute('y', String(cy));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'central');
    text.setAttribute('font-size', String(fontSize));
    text.setAttribute('font-weight', '700');
    text.setAttribute('font-family', 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif');
    text.setAttribute('fill', o.islandText);
    if (complete) {
      // Weisser Halo, damit die Zahl trotz Strich lesbar bleibt
      text.setAttribute('stroke', o.islandFill);
      text.setAttribute('stroke-width', String(fontSize * 0.3));
      text.setAttribute('stroke-linejoin', 'round');
      text.setAttribute('paint-order', 'stroke fill');
    }
    text.textContent = String(isl.num);
    nodes.appendChild(text);
  }
  svg.appendChild(nodes);

  return svg;
}

/**
 * Erzeugt ein SVG-Element mit Lösungen (für Lösungsblätter).
 */
export function boardToSvgElementWithSolution(board, solution, options = {}) {
  const bridges = new Map();
  board.edges.forEach((edge, i) => {
    const count = solution[i] ?? 0;
    if (count > 0) bridges.set(edge.id, count);
  });
  return boardToSvgElement(board, { ...options, bridges });
}
