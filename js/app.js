/**
 * Hashi – Spiellogik und Oberfläche.
 *
 * Zuständigkeiten:
 *  - `generatePuzzle` liefert ein garantiert eindeutig lösbares Rätsel
 *  - `BoardRenderer` zeichnet Brett und prüft Treffer
 *  - diese Datei verbindet beides: Spielzüge, Verlauf, Hinweise, Timer,
 *    Speichern und Teilen per Seed/Link.
 */

import { generatePuzzle, DIFFICULTIES, DIFFICULTY_IDS } from './generator.js';
import { buildBoard } from './board.js';
import { randomSeed } from './rng.js';
import { BoardRenderer } from './render.js';
import { boardToSvgElement } from './svg.js';
import { Game } from './game.js';

const STORAGE_KEY = 'hashi.state.v1';
const THEME_KEY = 'hashi.theme.v1';

const $ = (id) => document.getElementById(id);

const ui = {
  canvas: $('board'),
  boardWrap: $('boardWrap'),
  overlay: $('overlay'),
  winTime: $('winTime'),
  winHint: $('winHint'),
  winNew: $('winNew'),
  winClose: $('winClose'),
  timer: $('timer'),
  bridgeCount: $('bridgeCount'),
  status: $('status'),
  // Zwei getrennte Elemente: die Knopfleiste der Stufen und die Kennzahl
  // in der Kopfzeile. Gleiche IDs würden dazu führen, dass getElementById
  // nur eines davon findet.
  difficulty: $('difficulty'),
  difficultyStat: $('difficultyStat'),
  newBtn: $('newBtn'),
  undoBtn: $('undoBtn'),
  redoBtn: $('redoBtn'),
  hintBtn: $('hintBtn'),
  checkBtn: $('checkBtn'),
  solveBtn: $('solveBtn'),
  seedInput: $('seedInput'),
  copyBtn: $('copyBtn'),
  themeBtn: $('themeBtn'),
  printBtn: $('printBtn'),
  printArea: $('printArea'),
};

const state = {
  board: null,
  game: new Game(null),
  difficulty: 'medium',
  seed: '',
  elapsed: 0,
  running: false,
  preview: null,
  hover: null,
  selected: null,
};

const renderer = new BoardRenderer(ui.canvas);

/* ------------------------------------------------------------------ *
 * Hilfsfunktionen
 * ------------------------------------------------------------------ */

const fmtTime = (sec) => {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

const islandLabel = (index) => {
  const isl = state.board?.islands[index];
  return isl ? `(${isl.r + 1}, ${isl.c + 1})` : '?';
};

function edgeBetween(aIndex, bIndex) {
  if (!state.board) return null;
  const neighbours = state.board.neighbors[aIndex] ?? [];
  const hit = neighbours.find((n) => n.other === bIndex);
  return hit ? state.board.edges[hit.edge] : null;
}

function setStatus(text, tone = '') {
  ui.status.textContent = text;
  ui.status.dataset.tone = tone;
}

/* ------------------------------------------------------------------ *
 * Rätsel starten
 * ------------------------------------------------------------------ */

function newPuzzle({ difficulty = state.difficulty, seed = randomSeed() } = {}) {
  const cfg = DIFFICULTIES[difficulty] ?? DIFFICULTIES.medium;
  const puzzle = generatePuzzle({ difficulty: cfg.id, seed });

  state.board = buildBoardFromPuzzle(puzzle);
  state.game = new Game(state.board, puzzle.solution);
  state.difficulty = cfg.id;
  state.seed = puzzle.seed;
  state.elapsed = 0;
  state.running = false;
  state.preview = null;
  state.hover = null;
  state.selected = null;

  // Rahmen dem Rasterverhältnis anpassen, damit kein leerer Rand entsteht.
  // Muss vor setBoard() passieren, sonst wird das Canvas zunächst zu gross
  // dimensioniert und erst nachträglich korrigiert.
  ui.boardWrap.style.aspectRatio = `${state.board.cols} / ${state.board.rows}`;
  renderer.setBoard(state.board);
  ui.seedInput.value = puzzle.seed;
  ui.overlay.hidden = true;
  syncDifficultyButtons();
  updateHash();
  save();
  render();
  ui.difficultyStat.textContent = puzzle.difficultyScore.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  ui.difficultyStat.title = `Schwierigkeitsgrad ${puzzle.difficultyScore.toFixed(2)} (${puzzle.difficultyText})`;
  setStatus(`${cfg.label} · ${state.board.islands.length} Inseln · Seed ${puzzle.seed}`);
}

/** Baut das Brettmodell aus dem Generator-Ergebnis. */
function buildBoardFromPuzzle(puzzle) {
  return buildBoard(
    puzzle.islands.map((i) => ({ id: i.id, r: i.r, c: i.c, num: i.num })),
    puzzle.cols,
    puzzle.rows,
  );
}

/* ------------------------------------------------------------------ *
 * Spielzüge
 * ------------------------------------------------------------------ */

function setBridge(edgeId, count, { record = true } = {}) {
  if (!state.game.setBridge(edgeId, count, { record })) return;
  if (!state.game.solved) startTimer();
  checkSolved();
  render();
  save();
}

function cycleEdge(edge) {
  if (!edge) return;
  state.game.cycleEdge(edge.id);
  if (!state.game.solved) startTimer();
  checkSolved();
  render();
  save();
}

function undo() {
  if (!state.game.undo()) return;
  render();
  save();
}

function redo() {
  if (!state.game.redo()) return;
  render();
  save();
}

/* ------------------------------------------------------------------ *
 * Hilfen
 * ------------------------------------------------------------------ */

/** Prüft die aktuelle Lösung und markiert falsche Brücken. */
function check() {
  if (!state.board) return;
  const { placed, wrong } = state.game.check();
  if (placed === 0) {
    setStatus('Noch keine Brücken gesetzt.');
    render();
    return;
  }
  if (wrong === 0) {
    setStatus('Alle gesetzten Brücken sind korrekt.', 'ok');
  } else {
    setStatus(`${wrong} von ${placed} Brücken sind falsch.`, 'bad');
  }
  render();
}

/** Setzt eine einzelne korrekte Brücke. */
function hint() {
  if (!state.board) return;
  const game = state.game;
  const result = game.hint();

  if (!result) {
    setStatus('Das Rätsel ist bereits vollständig gelöst.', 'ok');
    render();
    return;
  }

  const edge = state.board.edges.find((e) => e.id === result.edgeId);
  startTimer();
  checkSolved();
  render();
  save();

  if (result.from > 0 && result.to > 0) {
    setStatus(
      `Hinweis: Brücke zwischen ${islandLabel(edge.a)} und ${islandLabel(edge.b)} korrigiert.`,
      'hint',
    );
  } else if (result.to === 0) {
    setStatus(
      `Hinweis: überflüssige Brücke zwischen ${islandLabel(edge.a)} und ${islandLabel(edge.b)} entfernt.`,
      'hint',
    );
  } else {
    setStatus(
      `Hinweis: Brücke zwischen ${islandLabel(edge.a)} und ${islandLabel(edge.b)} gesetzt.`,
      'hint',
    );
  }
}

/** Zeigt die komplette Lösung. */
function solve() {
  if (!state.board) return;
  state.game.solve();
  state.selected = null;
  checkSolved();
  render();
  save();
  if (!state.game.solved) setStatus('Lösung eingeblendet.', 'ok');
}

/* ------------------------------------------------------------------ *
 * Zustand
 * ------------------------------------------------------------------ */

function checkSolved() {
  if (!state.board || state.game.solved) return;
  if (!state.game.isSolved()) return;
  state.running = false;
  ui.overlay.hidden = false;
  ui.winTime.textContent = fmtTime(state.elapsed);
  ui.winHint.textContent = state.game.revealed
    ? 'Lösung eingeblendet'
    : state.game.hintsUsed
      ? `${state.game.hintsUsed} Hinweis${state.game.hintsUsed > 1 ? 'e' : ''} verwendet`
      : 'Ohne Hinweise gelöst';
  setStatus(`Gelöst in ${fmtTime(state.elapsed)}.`, 'ok');
  save();
}

function startTimer() {
  if (state.running || state.game.solved) return;
  state.running = true;
  ui.timer.textContent = fmtTime(state.elapsed);
}

function tick() {
  if (!state.running) return;
  state.elapsed++;
  ui.timer.textContent = fmtTime(state.elapsed);
}

/* ------------------------------------------------------------------ *
 * Drucken
 * ------------------------------------------------------------------ */

/**
 * Erzeugt ein druckfertiges Blatt mit dem aktuellen Rätsel
 * (ohne die Brücken des Spielers) und öffnet den Druckdialog.
 */
function printPuzzle() {
  if (!state.board) return;
  const cfg = DIFFICULTIES[state.difficulty] ?? DIFFICULTIES.medium;

  const sheet = document.createElement('article');
  sheet.className = 'print-sheet';

  const head = document.createElement('header');
  head.className = 'print-sheet__head';
  const title = document.createElement('h1');
  title.textContent = 'Hashi';
  const meta = document.createElement('p');
  meta.textContent = `Hashiwokakero · ${cfg.label} · ${state.board.islands.length} Inseln · Seed ${state.seed}`;
  head.append(title, meta);

  const board = document.createElement('div');
  board.className = 'print-sheet__board';
  board.appendChild(boardToSvgElement(state.board));

  const foot = document.createElement('footer');
  foot.className = 'print-sheet__foot';
  foot.innerHTML = '<span>Name: ______________________</span><span>Datum: ____________</span>';

  sheet.append(head, board, foot);
  ui.printArea.replaceChildren(sheet);

  const cleanup = () => {
    ui.printArea.replaceChildren();
    window.removeEventListener('afterprint', cleanup);
  };
  window.addEventListener('afterprint', cleanup);

  // Kurze Pause, damit der Browser den neu aufgebauten Inhalt druckt.
  window.requestAnimationFrame(() => {
    window.print();
    setTimeout(cleanup, 1500);
  });
}

/* ------------------------------------------------------------------ *
 * Speichern & Teilen
 * ------------------------------------------------------------------ */

function save() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        seed: state.seed,
        difficulty: state.difficulty,
        elapsed: state.elapsed,
        solved: state.game.solved,
        hintsUsed: state.game.hintsUsed,
        bridges: [...state.game.bridges.entries()],
      }),
    );
  } catch {
    /* Speicher nicht verfügbar (z. B. privater Modus) – kein Problem. */
  }
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function updateHash() {
  const hash = `#seed=${encodeURIComponent(state.seed)}&d=${state.difficulty}`;
  if (window.location.hash !== hash) {
    history.replaceState(null, '', hash);
  }
}

function readHash() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const seed = params.get('seed');
  const difficulty = params.get('d');
  return {
    seed: seed || null,
    difficulty: difficulty && DIFFICULTIES[difficulty] ? difficulty : null,
  };
}

async function copyLink() {
  updateHash();
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    setStatus('Link in die Zwischenablage kopiert.', 'ok');
  } catch {
    ui.seedInput.select();
    setStatus('Link konnte nicht kopiert werden – bitte manuell kopieren.', 'bad');
  }
}

/* ------------------------------------------------------------------ *
 * Darstellung
 * ------------------------------------------------------------------ */

function render() {
  const game = state.game;
  renderer.draw({
    board: state.board,
    bridges: game.bridges,
    solution: game.solution,
    wrong: game.wrong,
    hint: game.hints,
    reveal: game.revealed,
    selected: state.selected,
    preview: state.preview,
    hover: state.hover,
  });
  ui.bridgeCount.textContent = String(game.bridgeTotal);
  ui.undoBtn.disabled = game.history.length === 0;
  ui.redoBtn.disabled = game.future.length === 0;
}

function syncDifficultyButtons() {
  for (const button of ui.difficulty.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.level === state.difficulty));
  }
}

/* ------------------------------------------------------------------ *
 * Eingabe
 * ------------------------------------------------------------------ */

function canvasPoint(event) {
  const rect = ui.canvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

let press = null;

function onPointerDown(event) {
  if (!state.board) return;
  // Native Handlungen unterbinden: sonst markiert der Browser auf dem
  // Smartphone beim Tippen den Text bzw. blendet das Kontextmenü ein.
  if (event.cancelable) event.preventDefault();
  const point = canvasPoint(event);
  const hit = renderer.hitTest(point.x, point.y);
  if (!hit) {
    state.selected = null;
    render();
    return;
  }
  // Zustand zuerst setzen: würde setPointerCapture fehlschlagen, darf die
  // Eingabe nicht abbrechen (das passiert auf manchen Mobilgeräten).
  press = { hit, startX: event.clientX, startY: event.clientY, moved: false };
  try {
    ui.canvas.setPointerCapture(event.pointerId);
  } catch {
    // Zeiger nicht einfangen – die Bedienung funktioniert auch so.
  }
  if (hit.type === 'island') {
    state.selected = state.selected === hit.island.id ? null : hit.island.id;
    render();
  }
}

function onPointerMove(event) {
  if (!state.board) return;
  const point = canvasPoint(event);
  const hit = renderer.hitTest(point.x, point.y);

  // Hover-Hervorhebung einer Kante
  const hoverEdge = hit?.type === 'edge' ? hit.edge : null;
  if (hoverEdge?.id !== state.hover?.id) {
    state.hover = hoverEdge;
    render();
  }

  if (!press || press.hit.type !== 'island') return;
  const moved = Math.hypot(event.clientX - press.startX, event.clientY - press.startY) > 4;
  if (!moved) return;
  press.moved = true;

  if (hit?.type === 'island' && hit.island.id !== press.hit.island.id) {
    const edge = edgeBetween(press.hit.island.index, hit.island.index);
    if (edge) {
      const count = state.game.bridges.get(edge.id) ?? 0;
      state.preview = { edge, count: count === 0 ? 1 : count };
      render();
    }
  } else if (state.preview) {
    state.preview = null;
    render();
  }
}

function onPointerUp(event) {
  if (!press) return;
  const point = canvasPoint(event);
  const hit = renderer.hitTest(point.x, point.y);
  const start = press;
  press = null;
  state.preview = null;

  if (start.hit.type === 'edge') {
    if (!start.moved) cycleEdge(start.hit.edge);
    else render();
    return;
  }

  // Von einer Insel auf eine andere gezogen -> Brücke setzen
  if (start.moved && hit?.type === 'island' && hit.island.id !== start.hit.island.id) {
    const edge = edgeBetween(start.hit.island.index, hit.island.index);
    if (edge) {
      cycleEdge(edge);
      return;
    }
  }
  render();
}

function onPointerLeave() {
  // "press" bleibt bestehen: durch Pointer-Capture kommt das pointerup
  // auch dann noch beim Canvas an, wenn der Zeiger das Brett verlässt.
  state.preview = null;
  state.hover = null;
  render();
}

/* ------------------------------------------------------------------ *
 * Tastatur
 * ------------------------------------------------------------------ */

function onKeyDown(event) {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
  if (event.metaKey || event.ctrlKey) {
    if (event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
    return;
  }
  switch (event.key.toLowerCase()) {
    case 'n':
      newPuzzle({ difficulty: state.difficulty });
      break;
    case 'u':
    case 'z':
      undo();
      break;
    case 'r':
      redo();
      break;
    case 'h':
      hint();
      break;
    case 'c':
      check();
      break;
    case 's':
      solve();
      break;
    case 'p':
      printPuzzle();
      break;
    case 'escape':
      state.selected = null;
      render();
      break;
    default:
      break;
  }
}

/* ------------------------------------------------------------------ *
 * Theme
 * ------------------------------------------------------------------ */

function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
  renderer.refreshTheme();
  render();
}

function initTheme() {
  let theme = 'auto';
  try {
    theme = localStorage.getItem(THEME_KEY) || 'auto';
  } catch {
    theme = 'auto';
  }
  applyTheme(theme);
  ui.themeBtn.addEventListener('click', () => {
    const order = ['auto', 'light', 'dark'];
    const current = document.documentElement.getAttribute('data-theme') || 'auto';
    const next = order[(order.indexOf(current) + 1) % order.length];
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ignorieren */
    }
    applyTheme(next);
    setStatus(`Farbschema: ${next === 'auto' ? 'automatisch' : next === 'light' ? 'hell' : 'dunkel'}`);
  });
}

/* ------------------------------------------------------------------ *
 * Start
 * ------------------------------------------------------------------ */

function buildDifficultyButtons() {
  for (const id of DIFFICULTY_IDS) {
    const cfg = DIFFICULTIES[id];
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.level = id;
    button.textContent = cfg.label;
    button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => newPuzzle({ difficulty: id }));
    ui.difficulty.appendChild(button);
  }
}

function setupEvents() {
  ui.canvas.addEventListener('pointerdown', onPointerDown);
  ui.canvas.addEventListener('pointermove', onPointerMove);
  ui.canvas.addEventListener('pointerup', onPointerUp);
  ui.canvas.addEventListener('pointercancel', onPointerUp);
  ui.canvas.addEventListener('pointerleave', onPointerLeave);
  ui.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  ui.newBtn.addEventListener('click', () => newPuzzle({ difficulty: state.difficulty }));
  ui.undoBtn.addEventListener('click', undo);
  ui.redoBtn.addEventListener('click', redo);
  ui.hintBtn.addEventListener('click', hint);
  ui.checkBtn.addEventListener('click', check);
  ui.solveBtn.addEventListener('click', solve);
  ui.copyBtn.addEventListener('click', copyLink);
  ui.printBtn.addEventListener('click', printPuzzle);
  ui.winNew.addEventListener('click', () => newPuzzle({ difficulty: state.difficulty }));
  ui.winClose.addEventListener('click', () => {
    ui.overlay.hidden = true;
  });

  ui.seedInput.addEventListener('change', () => {
    const value = ui.seedInput.value.trim();
    if (!value) return;
    newPuzzle({ difficulty: state.difficulty, seed: value });
  });

  document.addEventListener('keydown', onKeyDown);

  const resize = () => {
    renderer.resize();
    render();
  };
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(resize).observe(ui.boardWrap);
  }
  window.addEventListener('resize', resize);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    renderer.refreshTheme();
    render();
  });
}

function boot() {
  buildDifficultyButtons();
  setupEvents();
  initTheme();

  // Rätsel aus dem Link laden, sonst den zuletzt gespielten Stand.
  const fromHash = readHash();
  const stored = load();

  let difficulty = fromHash.difficulty ?? stored?.difficulty ?? 'medium';
  if (!DIFFICULTIES[difficulty]) difficulty = 'medium';
  let seed = fromHash.seed ?? stored?.seed ?? randomSeed();

  newPuzzle({ difficulty, seed });

  if (stored && !fromHash.seed && Array.isArray(stored.bridges)) {
    for (const [edgeId, count] of stored.bridges) {
      if (state.board.edges.some((e) => e.id === edgeId)) {
        state.game.applyEdge(edgeId, count);
      }
    }
    state.elapsed = stored.elapsed ?? 0;
    state.game.hintsUsed = stored.hintsUsed ?? 0;
    ui.timer.textContent = fmtTime(state.elapsed);
    if (stored.solved) {
      checkSolved();
    } else if (state.elapsed > 0) {
      startTimer();
    }
    render();
  }

  setInterval(tick, 1000);
}

boot();
