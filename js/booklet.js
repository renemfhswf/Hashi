/**
 * Rätselheft-Generator: erzeugt mehrere Hashi-Rätsel und setzt sie zu
 * Druckbögen im DIN-A6-Format zusammen (1, 2 oder 4 Rätsel pro Seite).
 */

import { generatePuzzle, DIFFICULTIES, DIFFICULTY_IDS, BOOKLET_FORMAT } from './generator.js';
import { buildBoard } from './board.js';
import { randomSeed } from './rng.js';
import { boardToSvgElement, boardToSvgElementWithSolution, SVG_VIEW_PAD } from './svg.js';
import { bestLayout, cellSizeMm, groupIntoPages } from './layout.js';
import { LEVEL_BANDS, achievableRange, bucketFor, maxIslandsFor } from './difficulty.js';
import { CALIBRATION } from './data/difficulty.js';

const $ = (id) => document.getElementById(id);

const ui = {
  difficulty: $('difficulty'),
  perPage: $('perPage'),
  count: $('count'),
  countInput: $('countInput'),
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

/**
 * Maximale Rasterweite auf einer A6-Seite.
 *
 * Auf einer A6-Seite stehen 93 mm Breite zur Verfügung. Die Zahl im Knoten
 * soll mindestens rund 6 pt gross sein – bei einem Knotendurchmesser von
 * 0,8 Rasterzellen braucht die Zelle dafür mindestens 4,2 mm. Das ergibt
 * höchstens 22 Spalten.
 */
const MAX_COLS = 22;

/** Höchstzahl an Inseln je Rätsel im Heft. */
const MAX_ISLANDS = 100;

/** Deutsche Bezeichnungen -> interne Kennungen (für Links). */
const LABEL_TO_ID = Object.fromEntries(
  Object.values(DIFFICULTIES).map((d) => [d.label.toLowerCase(), d.id]),
);

const state = {
  level: 'medium', // gewünschte Schwierigkeitsstufe (Zielband)
  perPage: 2,
  count: 8,
  seed: randomSeed(),
  withSolutions: true,
  format: null, // Raster des Hefts (nach dem ersten Rätsel eingefroren)
  puzzles: [],
};

/* ------------------------------------------------------------------ *
 * Erzeugung
 * ------------------------------------------------------------------ */

/**
 * Anzahl der Inseln je Rätsel.
 *
 * Sie ergibt sich aus der gewünschten Schwierigkeitsstufe: die Stufe legt
 * fest, wie schwer ein Rätsel sein soll, und die Kalibrierung sagt, wie
 * viele Inseln dabei noch möglich sind. Eine eigene Auswahl der Inselzahl
 * wäre überflüssig – sie widerspräche der Stufe.
 */
function islandCount() {
  const max = maxIslandsFor(state.level, CALIBRATION) || 40;
  return Math.min(max, MAX_ISLANDS);
}

/**
 * Erzeugt ein einzelnes Rätsel.
 *
 * `state.level` ist die gewünschte Schwierigkeitsstufe. Der Generator
 * sucht dafür ein Raster, auf dem das Rätsel *gemessen* in das Band der
 * Stufe fällt. Die Inselzahl allein legt die Schwierigkeit nämlich nicht
 * fest – entscheidend ist die Dichte des Brettes.
 *
 * Das Raster des ersten Rätsels gilt danach für das ganze Heft: so
 * behalten alle Knoten exakt dieselbe Grösse.
 */
function makePuzzle(index) {
  const seed = `${state.seed}-${index + 1}`;
  const format = state.format ?? BOOKLET_FORMAT;
  const puzzle = generatePuzzle({
    difficulty: state.level,
    seed,
    islands: islandCount(),
    format,
    keep: 1,
    target: state.level,
    // Das Raster darf nicht so weit werden, dass die Seite unlesbar wird.
    maxGridFactor: (MAX_COLS * MAX_COLS) / Math.max(1, islandCount()),
  });
  if (!state.format) {
    state.format = { ...BOOKLET_FORMAT, cols: puzzle.cols, rows: puzzle.rows };
  }
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
  // Die Knotengrösse richtet sich nach der Rasterzelle – so bleibt das
  // Heft bei jeder Rasterweite druckbar und einheitlich. Auf Papier sind
  // die Knoten etwas grösser als am Bildschirm, damit die Zahlen lesbar
  // bleiben.
  const options = {
    cellMm,
    islandRadius: cellMm * 0.4,
    fontSize: cellMm * 0.5,
    bridgeWidth: cellMm * 0.08,
    bridgeOffset: cellMm * 0.09,
    islandStroke: cellMm * 0.045,
    gridWidth: cellMm * 0.022,
    gridDash: `${(cellMm * 0.05).toFixed(3)} ${(cellMm * 0.22).toFixed(3)}`,
    frameWidth: cellMm * 0.04,
  };
  const svg = solution
    ? // Bei Lösungsseiten werden die Inseln nicht durchgestrichen –
      // sonst wäre das Blatt überladen.
      boardToSvgElementWithSolution(puzzle.board, puzzle.solution, {
        ...options,
        markComplete: false,
      })
    : boardToSvgElement(puzzle.board, options);
  // Feste Grösse in Millimetern: der Browser skaliert das SVG nicht
  // mehr, dadurch bleibt 1 Benutzereinheit genau 1 mm.
  svg.style.width = `${widthMm.toFixed(2)}mm`;
  svg.style.height = `${heightMm.toFixed(2)}mm`;
  board.appendChild(svg);

  // Unter dem Rätsel stehen Nummer, gemessene Schwierigkeit und Seed.
  // Bewusst keine Kopfzeile: dort stünde eine Seitenzahl, die irritiert.
  const foot = document.createElement('footer');
  foot.className = 'mini__foot';
  const label = document.createElement('span');
  label.className = 'mini__level';
  // Die angezeigte Stufe ist die *gemessene* – nicht die gewünschte.
  label.textContent = solution
    ? `${index + 1} · Lösung`
    : `${index + 1} · ${puzzle.difficultyText} (${puzzle.difficultyScore.toFixed(2)})`;
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

  ui.info.dataset.dirty = '';
  const avgDifficulty =
    puzzles.length > 0
      ? puzzles.reduce((sum, p) => sum + (p.difficultyScore ?? 0), 0) / puzzles.length
      : 0;
  const target = DIFFICULTIES[state.level]?.label ?? state.level;
  const band = LEVEL_BANDS[state.level] ?? [0, 1];
  const imBand = puzzles.filter(
    (p) => p.difficultyScore >= band[0] && p.difficultyScore <= band[1],
  ).length;

  // Ist das Ziel mit dieser Inselzahl überhaupt erreichbar?
  // Entscheidend ist, ob sich die Bänder überschneiden.
  const range = achievableRange(CALIBRATION.buckets[bucketFor(islandCount())]);
  const erreichbar = band[0] <= range[1] && band[1] >= range[0];
  const hinweis = erreichbar
    ? ''
    : ` · Ziel „${target}" ist bei ${islandCount()} Inseln nicht erreichbar ` +
      `(möglich ist ${range[0].toFixed(2)}–${range[1].toFixed(2)})`;

  ui.info.textContent =
    `${puzzles.length} Rätsel · ${puzzles[0]?.islands.length ?? islandCount()} Inseln · ` +
    `Ziel „${target}" · gemessen Ø ${avgDifficulty.toFixed(2)} ` +
    `(${imBand}/${puzzles.length} im Zielband) · ` +
    `${pages.length} Seiten` +
    (singles ? ` (${doubles} mit 2, ${singles} mit 1 Rätsel)` : ' mit je 2 Rätseln') +
    (state.withSolutions ? ` + ${pages.length} Lösungsseiten` : '') +
    ` · DIN A6 · Seed ${state.seed}${hinweis}`;
}

/* ------------------------------------------------------------------ *
 * Bedienung
 * ------------------------------------------------------------------ */

function syncGroups() {
  for (const button of ui.difficulty.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.level === state.level));
  }
  for (const button of ui.perPage.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.per) === state.perPage));
  }
  for (const button of ui.count.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.count) === state.count));
  }
}

function updateHash() {
  const params = new URLSearchParams({
    seed: state.seed,
    d: state.level,
    n: String(state.count),
    per: String(state.perPage),
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

  const d = (params.get('d') || '').trim().toLowerCase();
  if (DIFFICULTIES[d]) out.level = d;
  else if (LABEL_TO_ID[d]) out.level = LABEL_TO_ID[d];

  if (Number.isFinite(n) && n >= 1 && n <= MAX_PUZZLES) out.count = Math.round(n);
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
    button.title = `Gewünschte Schwierigkeit – der Generator sucht ein Raster, auf dem das Rätsel gemessen in dieses Band fällt`;
    button.addEventListener('click', () => {
      // Auswahl (keine Mehrfachauswahl): die Stufe ist die Zielvorgabe.
      // Es wird bewusst NICHT neu erzeugt – erst der Knopf "Heft erzeugen".
      state.level = id;
      syncGroups();
      markDirty();
    });
    ui.difficulty.appendChild(button);
  }
}

/** Merkt vor, dass die aktuelle Vorschau zu den Einstellungen veraltet ist. */
function markDirty() {
  // Bei geänderten Einstellungen muss das Raster neu bestimmt werden.
  state.format = null;
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
    `Je nach Schwierigkeit entstehen ${islandCount()} Inseln pro Rätsel – das dauert einige Minuten.</p>`;
  ui.sheets.replaceChildren(box);
  ui.info.textContent = 'Bereit – bitte „Heft erzeugen" klicken.';
  ui.info.dataset.dirty = '';
}

boot();
