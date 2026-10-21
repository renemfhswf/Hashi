/**
 * Rätselheft-Generator: erzeugt mehrere Hashi-Rätsel und setzt sie zu
 * Druckbögen im DIN-A6-Format zusammen (1, 2 oder 4 Rätsel pro Seite).
 */

import { generatePuzzle, DIFFICULTIES, DIFFICULTY_IDS, BOOKLET_FORMAT } from './generator.js';
import { buildBoard } from './board.js';
import { randomSeed } from './rng.js';
import { boardToSvgElement, boardToSvgElementWithSolution, SVG_VIEW_PAD } from './svg.js';
import { bestLayout, cellSizeMm, groupIntoPages } from './layout.js';

const $ = (id) => document.getElementById(id);

const ui = {
  difficulty: $('difficulty'),
  perPage: $('perPage'),
  count: $('count'),
  countInput: $('countInput'),
  islands: $('islands'),
  seedInput: $('seedInput'),
  copyBtn: $('copyBtn'),
  withSolutions: $('withSolutions'),
  generateBtn: $('generateBtn'),
  printBtn: $('printBtn'),
  sheets: $('sheets'),
  info: $('bookletInfo'),
};

/** Höchstzahl an Rätseln pro Heft. */
const MAX_PUZZLES = 100;

/** Deutsche Bezeichnungen -> interne Kennungen (für Links). */
const LABEL_TO_ID = Object.fromEntries(
  Object.values(DIFFICULTIES).map((d) => [d.label.toLowerCase(), d.id]),
);

const state = {
  difficulties: ['medium'], // mehrere Grade werden gemischt
  perPage: 2,
  count: 8,
  islands: 100, // Inseln pro Rätsel
  seed: randomSeed(),
  withSolutions: true,
  puzzles: [],
};

/* ------------------------------------------------------------------ *
 * Erzeugung
 * ------------------------------------------------------------------ */

/** Die ausgewählten Schwierigkeitsgrade – ohne Auswahl gilt "Mittel". */
function activeDifficulties() {
  return state.difficulties.length ? state.difficulties : ['medium'];
}

/**
 * Erzeugt ein einzelnes Rätsel.
 * @param {number} index  laufende Nummer (0-basiert)
 */
function makePuzzle(index) {
  const levels = activeDifficulties();
  const difficulty = levels[index % levels.length];
  const seed = `${state.seed}-${index + 1}`;
  const puzzle = generatePuzzle({
    difficulty,
    seed,
    islands: state.islands,
    format: BOOKLET_FORMAT,
    keep: 1,
  });
  const board = buildBoard(
    puzzle.islands.map((isl) => ({ id: isl.id, r: isl.r, c: isl.c, num: isl.num })),
    puzzle.cols,
    puzzle.rows,
  );
  return { ...puzzle, board, seed };
}

/* ------------------------------------------------------------------ *
 * Darstellung
 * ------------------------------------------------------------------ */

/**
 * Erzeugt ein einzelnes Rätsel-Element (Mini-Version).
 *
 * Das Brett wird in echten Millimetern gezeichnet: dadurch bleiben
 * Inseln, Zahlen und Brücken auf der Seite immer gleich gross – auch
 * wenn zwei Rätsel unterschiedlich grosse Raster haben.
 */
function miniPuzzle(puzzle, index, { solution = false, layout = 'row', count = 1 } = {}) {
  const article = document.createElement('article');
  article.className = 'mini';

  const cellMm = cellSizeMm(puzzle, layout, count);
  const widthMm = (puzzle.cols + 2 * SVG_VIEW_PAD) * cellMm;
  const heightMm = (puzzle.rows + 2 * SVG_VIEW_PAD) * cellMm;

  const board = document.createElement('div');
  board.className = 'mini__board';
  const svg = solution
    ? // Bei Lösungsseiten werden die Inseln nicht durchgestrichen –
      // sonst wäre das Blatt überladen.
      boardToSvgElementWithSolution(puzzle.board, puzzle.solution, { cellMm, markComplete: false })
    : boardToSvgElement(puzzle.board, { cellMm });
  // Feste Grösse in Millimetern: der Browser skaliert das SVG nicht
  // mehr, dadurch bleibt 1 Benutzereinheit genau 1 mm.
  svg.style.width = `${widthMm.toFixed(2)}mm`;
  svg.style.height = `${heightMm.toFixed(2)}mm`;
  board.appendChild(svg);

  // Unter dem Rätsel stehen Nummer, Schwierigkeitsgrad und Seed.
  // Bewusst keine Kopfzeile: dort stünde eine Seitenzahl, die irritiert.
  const foot = document.createElement('footer');
  foot.className = 'mini__foot';
  const label = document.createElement('span');
  label.className = 'mini__level';
  label.textContent = `${index + 1} · ${solution ? 'Lösung' : puzzle.difficultyLabel}`;
  const seed = document.createElement('span');
  seed.className = 'mini__seed';
  seed.textContent = puzzle.seed;
  foot.append(label, seed);

  article.append(board, foot);
  return article;
}

/** Erzeugt einen Druckbogen (A6) mit den übergebenen Rätseln. */
function buildSheet(puzzles, { solution = false, firstIndex = 0 } = {}) {
  const section = document.createElement('section');
  section.className = 'sheet';

  const layout = bestLayout(puzzles);
  const grid = document.createElement('div');
  grid.className = 'sheet__grid';
  grid.dataset.per = String(puzzles.length);
  grid.dataset.layout = layout;

  puzzles.forEach((puzzle, i) => {
    grid.appendChild(
      miniPuzzle(puzzle, firstIndex + i, { solution, layout, count: puzzles.length }),
    );
  });

  section.appendChild(grid);
  return section;
}

function render() {
  const puzzles = state.puzzles;
  const pages = groupIntoPages(puzzles, state.perPage);
  const sheets = [];

  // Die Nummerierung läuft durchlaufend über das ganze Heft – unabhängig
  // davon, wie viele Rätsel auf einer Seite stehen.
  let puzzleIndex = 0;
  for (const page of pages) {
    sheets.push(buildSheet(page, { firstIndex: puzzleIndex }));
    puzzleIndex += page.length;
  }

  if (state.withSolutions) {
    puzzleIndex = 0;
    for (const page of pages) {
      sheets.push(buildSheet(page, { solution: true, firstIndex: puzzleIndex }));
      puzzleIndex += page.length;
    }
  }

  ui.sheets.replaceChildren(...sheets);

  const singles = pages.filter((p) => p.length === 1).length;
  const doubles = pages.length - singles;
  const levels = activeDifficulties()
    .map((id) => DIFFICULTIES[id].label)
    .join(' / ');

  ui.info.dataset.dirty = '';
  ui.info.textContent =
    `${puzzles.length} Rätsel · ${puzzles[0]?.islands.length ?? state.islands} Inseln · ${levels} · ` +
    `${pages.length} Seiten` +
    (singles ? ` (${doubles} mit 2, ${singles} mit 1 Rätsel)` : ' mit je 2 Rätseln') +
    (state.withSolutions ? ` + ${pages.length} Lösungsseiten` : '') +
    ` · DIN A6 · Seed ${state.seed}`;
}

/* ------------------------------------------------------------------ *
 * Bedienung
 * ------------------------------------------------------------------ */

function syncGroups() {
  for (const button of ui.difficulty.querySelectorAll('button')) {
    button.setAttribute(
      'aria-pressed',
      String(state.difficulties.includes(button.dataset.level)),
    );
  }
  for (const button of ui.perPage.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.per) === state.perPage));
  }
  for (const button of ui.count.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.count) === state.count));
  }
  for (const button of ui.islands.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.islands) === state.islands));
  }
}

function updateHash() {
  const params = new URLSearchParams({
    seed: state.seed,
    d: activeDifficulties().join(','),
    n: String(state.count),
    per: String(state.perPage),
    ins: String(state.islands),
  });
  if (state.withSolutions) params.set('sol', '1');
  const hash = `#${params.toString()}`;
  if (window.location.hash !== hash) history.replaceState(null, '', hash);
}

function readHash() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const out = {};
  const seed = params.get('seed');
  const n = Number(params.get('n'));
  const per = Number(params.get('per'));
  if (seed) out.seed = seed;

  const levels = (params.get('d') || '')
    .split(',')
    .map((value) => {
      const key = value.trim().toLowerCase();
      if (DIFFICULTIES[key]) return key;
      return LABEL_TO_ID[key] ?? null;
    })
    .filter(Boolean);
  if (levels.length) out.difficulties = levels;

  if (Number.isFinite(n) && n >= 1 && n <= MAX_PUZZLES) out.count = Math.round(n);
  const ins = Number(params.get('ins'));
  if ([40, 60, 80, 100].includes(ins)) out.islands = ins;
  if ([1, 2].includes(per)) out.perPage = per;
  if (params.get('sol') === '1') out.withSolutions = true;
  return out;
}

async function copyLink() {
  updateHash();
  try {
    await navigator.clipboard.writeText(window.location.href);
    ui.info.textContent = 'Link in die Zwischenablage kopiert.';
  } catch {
    ui.seedInput.select();
  }
}

/**
 * Erzeugt das Heft. Die Arbeit wird auf mehrere Zeitschritte verteilt,
 * damit die Oberfläche bei 100 Rätseln nicht einfriert.
 */
function generate() {
  const total = state.count;
  const puzzles = [];
  let index = 0;

  ui.generateBtn.disabled = true;
  ui.generateBtn.textContent = 'Wird erzeugt …';

  const step = () => {
    const end = Math.min(index + 8, total);
    try {
      for (; index < end; index++) puzzles.push(makePuzzle(index));
    } catch (error) {
      finish();
      ui.info.textContent = `Fehler bei der Erzeugung: ${error.message}`;
      return;
    }
    ui.generateBtn.textContent = `Wird erzeugt … ${index}/${total}`;
    if (index < total) {
      setTimeout(step, 0);
      return;
    }
    state.puzzles = puzzles;
    updateHash();
    render();
    finish();
  };

  const finish = () => {
    ui.generateBtn.disabled = false;
    ui.generateBtn.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> Heft erzeugen';
  };

  step();
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
    button.addEventListener('click', () => {
      // Mehrfachauswahl: der gewählte Grad wird umgeschaltet.
      // Es wird bewusst NICHT neu erzeugt – erst der Knopf "Heft erzeugen".
      const index = state.difficulties.indexOf(id);
      if (index === -1) state.difficulties.push(id);
      else state.difficulties.splice(index, 1);
      syncGroups();
      markDirty();
    });
    ui.difficulty.appendChild(button);
  }
}

/** Merkt vor, dass die aktuelle Vorschau zu den Einstellungen veraltet ist. */
function markDirty() {
  if (!state.puzzles.length) return;
  ui.info.textContent =
    'Einstellungen geändert – bitte "Heft erzeugen" klicken, um sie anzuwenden.';
  ui.info.dataset.dirty = 'true';
}

function setupEvents() {
  for (const button of ui.perPage.querySelectorAll('button')) {
    button.addEventListener('click', () => {
      state.perPage = Number(button.dataset.per);
      syncGroups();
      // Nur die vorhandenen Rätsel neu anordnen, nicht neu erzeugen.
      if (state.puzzles.length) render();
      updateHash();
    });
  }

  for (const button of ui.count.querySelectorAll('button')) {
    button.addEventListener('click', () => {
      state.count = Number(button.dataset.count);
      ui.countInput.value = String(state.count);
      syncGroups();
      markDirty();
    });
  }

  for (const button of ui.islands.querySelectorAll('button')) {
    button.addEventListener('click', () => {
      state.islands = Number(button.dataset.islands);
      syncGroups();
      markDirty();
    });
  }

  ui.countInput.addEventListener('change', () => {
    const value = Math.round(Number(ui.countInput.value));
    state.count = Math.min(MAX_PUZZLES, Math.max(1, Number.isFinite(value) ? value : 1));
    ui.countInput.value = String(state.count);
    syncGroups();
    markDirty();
  });

  ui.withSolutions.addEventListener('change', () => {
    state.withSolutions = ui.withSolutions.checked;
    if (state.puzzles.length) render();
    updateHash();
  });

  ui.seedInput.addEventListener('change', () => {
    const value = ui.seedInput.value.trim();
    if (!value) return;
    state.seed = value;
    markDirty();
  });

  ui.generateBtn.addEventListener('click', generate);
  ui.copyBtn.addEventListener('click', copyLink);
  ui.printBtn.addEventListener('click', () => window.print());

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement) return;
    if (event.key.toLowerCase() === 'n' && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      state.seed = randomSeed();
      ui.seedInput.value = state.seed;
      generate();
    }
  });
}

function boot() {
  buildDifficultyButtons();

  const fromHash = readHash();
  Object.assign(state, fromHash);
  ui.seedInput.value = state.seed;
  ui.countInput.value = String(state.count);
  ui.withSolutions.checked = state.withSolutions;

  setupEvents();
  syncGroups();

  // Es wird bewusst nichts erzeugt: das Heft entsteht erst auf Klick
  // auf "Heft erzeugen".
  showEmptyState();
}

/** Platzhalter, solange noch kein Heft erzeugt wurde. */
function showEmptyState() {
  const box = document.createElement('div');
  box.className = 'empty';
  box.innerHTML =
    '<p class="empty__title">Noch kein Heft erzeugt</p>' +
    '<p class="empty__text">Einstellungen wählen und auf <strong>„Heft erzeugen"</strong> klicken. ' +
    `Bei ${state.islands} Inseln pro Rätsel dauert das einige Minuten.</p>`;
  ui.sheets.replaceChildren(box);
  ui.info.textContent = 'Bereit – bitte „Heft erzeugen" klicken.';
  ui.info.dataset.dirty = '';
}

boot();
