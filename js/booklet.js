/**
 * Rätselheft-Generator: erzeugt mehrere Hashi-Rätsel, setzt sie je auf eine
 * DIN-A5-Seite und ordnet diese als Heft auf DIN-A4-Bögen an (Vorder- und
 * Rückseite, einmal falten).
 */

import { generatePuzzle, DIFFICULTIES, DIFFICULTY_IDS, BOOKLET_FORMAT } from './generator.js';
import { buildBoard } from './board.js';
import { randomSeed } from './rng.js';
import { boardToSvgElement, boardToSvgElementWithSolution, SVG_VIEW_PAD } from './svg.js';
import { cellSizeMm, pagesOf } from './layout.js';
import { impose } from './impose.js';
import { LEVEL_BANDS, achievableRange, bucketFor, maxIslandsFor, CELLS_PER_ISLAND } from './difficulty.js';
import { CALIBRATION } from './data/difficulty.js';
import { makeBookletCode, parseBookletCode } from './booklet-code.js';

const $ = (id) => document.getElementById(id);

const ui = {
  difficulty: $('difficulty'),
  count: $('count'),
  countInput: $('countInput'),
  codeInput: $('codeInput'),
  copyCodeBtn: $('copyCodeBtn'),
  copyBtn: $('copyBtn'),
  codeNote: $('codeNote'),
  loadCodeInput: $('loadCodeInput'),
  loadBtn: $('loadBtn'),
  loadInfo: $('loadInfo'),
  withSolutions: $('withSolutions'),
  generateBtn: $('generateBtn'),
  printBtn: $('printBtn'),
  sheets: $('sheets'),
  info: $('bookletInfo'),
};

/** Höchstzahl an Rätseln pro Heft. */
const MAX_PUZZLES = 100;

/**
 * Maximale Rasterweite auf einer A5-Seite.
 *
 * Auf einer A5-Seite stehen 136 mm Breite zur Verfügung. Damit wird die
 * Rasterzelle selbst beim breitesten Heft-Raster (23 Spalten) rund 5,9 mm
 * breit – die Zahlen bleiben deutlich besser lesbar als im früheren
 * A6-Heft (dort rund 4,2 mm). Die Proberätsel beim Aushandeln der Inselzahl
 * bleiben auf 22 Spalten begrenzt.
 */
const MAX_COLS = 22;

/** Höchstzahl an Inseln je Rätsel im Heft. */
const MAX_ISLANDS = 100;

/** Untergrenze: weniger Inseln als das wäre kein Hashi-Rätsel mehr. */
const MIN_ISLANDS = 12;

/** Deutsche Bezeichnungen -> interne Kennungen (für Links). */
const LABEL_TO_ID = Object.fromEntries(
  Object.values(DIFFICULTIES).map((d) => [d.label.toLowerCase(), d.id]),
);

const state = {
  level: 'medium', // gewünschte Schwierigkeitsstufe (Zielband)
  count: 8,
  // Seed für die nächste Erzeugung. Er kommt aus einem Link oder einem
  // geladenen Heft-Code; null bedeutet: beim Erzeugen neu würfeln.
  seed: null,
  // Daten des zuletzt erzeugten (angezeigten) Hefts. Daraus entsteht der
  // Heft-Code, und damit bleibt der Code auch nach Einstellungsänderungen
  // eindeutig dem sichtbaren Heft zugeordnet.
  booklet: null,
  withSolutions: true,
  format: null, // Raster des Hefts (nach dem ersten Rätsel eingefroren)
  islands: null, // ausgehandelte Inselzahl (null = noch nicht bestimmt)
  puzzles: [],
};

/* ------------------------------------------------------------------ *
 * Erzeugung
 * ------------------------------------------------------------------ */

/**
 * Obergrenze für die Inselzahl je Rätsel.
 *
 * Sie ergibt sich aus der Schwierigkeitsstufe: die Kalibrierung kennt je
 * Inselzahl den tatsächlich erreichbaren Schwierigkeitsbereich.
 */
function islandCount(level = state.level) {
  const max = maxIslandsFor(level, CALIBRATION) || 40;
  return Math.max(MIN_ISLANDS, Math.min(max, MAX_ISLANDS));
}

/**
 * Startwert für die Inselzahl: die stufentypische Dichte auf einer
 * A5-Seite. Dieser Wert trifft das Band erfahrungsgemäss zuverlässig.
 */
function densityIslands(level = state.level) {
  const cap = Math.floor(
    (MAX_COLS * MAX_COLS) / (CELLS_PER_ISLAND[level] || 10),
  );
  return Math.max(MIN_ISLANDS, Math.min(islandCount(level), cap));
}

/**
 * Handelt die Inselzahl für das ganze Heft aus.
 *
 * Gesucht ist die grösste Inselzahl, deren Rätsel auf einer A5-Seite
 * (höchstens `MAX_COLS` Spalten) das Band der Stufe noch zuverlässig
 * treffen. Ausgegangen wird von der Dichte-Schätzung; danach wird die
 * Zahl erhöht, solange der Median mehrerer Proberätsel im Band bleibt.
 *
 * Der Median ist nötig, weil die Messung je Rätsel streut: ein einzelner
 * Glückstreffer würde die Zahl nach oben ziehen und die übrigen Rätsel
 * des Hefts zu schwer machen. Zusätzlich bleibt ein Sicherheitsabstand
 * zum oberen Bandrand.
 *
 * @returns {number} Inselzahl je Rätsel
 */
function negotiateIslands(level) {
  const band = LEVEL_BANDS[level];
  // 20 % des Bandes bleiben als Puffer zum oberen Rand.
  const limit = band[1] - 0.2 * (band[1] - band[0]);

  const medianScore = (islands) => {
    const scores = [0, 1, 2]
      .map(
        (probe) =>
          generatePuzzle({
            difficulty: level,
            seed: `${state.seed}-probe-${probe}`,
            islands,
            format: BOOKLET_FORMAT,
            keep: 1,
            target: level,
            maxGridFactor: (MAX_COLS * MAX_COLS) / Math.max(1, islands),
          }).difficultyScore,
      )
      .sort((a, b) => a - b);
    return scores[1];
  };
  const passt = (islands) => {
    const score = medianScore(islands);
    return score >= band[0] && score <= limit;
  };

  let islands = densityIslands(level);

  // Zu hart für die Seite: so weit senken, bis es passt.
  for (let round = 0; round < 6; round++) {
    if (passt(islands)) break;
    const next = Math.max(MIN_ISLANDS, Math.round(islands * 0.92));
    if (next === islands) break;
    islands = next;
  }

  // Nach oben tasten: so viele Inseln wie möglich.
  const max = islandCount(level);
  for (let round = 0; round < 4; round++) {
    const next = Math.min(max, Math.round(islands * 1.1));
    if (next === islands) break;
    if (!passt(next)) break;
    islands = next;
  }

  return islands;
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
function makePuzzle(index, level) {
  const seed = `${state.seed}-${index + 1}`;
  // Die Inselzahl wird einmal für das ganze Heft ausgehandelt.
  if (state.islands == null) state.islands = negotiateIslands(level);
  const islands = state.islands;
  const format = state.format ?? BOOKLET_FORMAT;
  const options = {
    difficulty: level,
    seed,
    islands,
    format,
    keep: 1,
    target: level,
    // Das Raster darf nicht so weit werden, dass die Seite unlesbar wird.
    maxGridFactor: (MAX_COLS * MAX_COLS) / Math.max(1, islands),
    // Ab dem zweiten Rätsel steht das Raster fest – so bleiben alle Knoten
    // im Heft exakt gleich gross.
    gridLock: state.format ?? null,
  };
  let puzzle = generatePuzzle(options);
  // Notfall: im festen Raster ist das Wachstum gescheitert (der Generator
  // liefert dann ein viel kleineres Ersatzrätsel). Dann lieber ein anderes
  // Raster als ein zu leichtes Rätsel.
  if (puzzle.islands.length !== islands && options.gridLock) {
    puzzle = generatePuzzle({ ...options, gridLock: null });
  }
  if (!state.format) {
    state.format = {
      ...BOOKLET_FORMAT,
      cols: puzzle.cols,
      rows: puzzle.rows,
    };
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
 * Inseln, Zahlen und Brücken auf der Seite immer gleich gross.
 */
function miniPuzzle(puzzle, index, { solution = false } = {}) {
  const article = document.createElement('article');
  article.className = 'mini';

  // Massgeblich ist das eingefrorene Heft-Raster, nicht das (nach dem
  // Beschneiden evtl. kleinere) Raster des einzelnen Rätsels. Dadurch
  // haben alle Knoten im Heft exakt dieselbe Grösse.
  const cellMm = cellSizeMm(state.format ?? puzzle);
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
    islandStrokeWidth: cellMm * 0.05,
    // Hilfsraster: im Druck deutlich kräftiger als am Bildschirm, sonst
    // verschwindet die dünne Punktlinie im Papierweiß.
    gridColor: '#6b7280',
    gridOpacity: 0.7,
    gridWidth: cellMm * 0.035,
    gridDash: `${(cellMm * 0.09).toFixed(3)} ${(cellMm * 0.13).toFixed(3)}`,
    frameColor: '#374151',
    frameOpacity: 0.85,
    frameWidth: cellMm * 0.06,
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

  // Unter dem Rätsel stehen Nummer und gemessene Schwierigkeit. Der
  // Heft-Code steht einmal im Bedienfeld – nicht unter jedem Rätsel.
  // Bewusst keine Kopfzeile: dort stünde eine Seitenzahl, die irritiert.
  const foot = document.createElement('footer');
  foot.className = 'mini__foot';
  const label = document.createElement('span');
  label.className = 'mini__level';
  // Die angezeigte Stufe ist die *gemessene* – nicht die gewünschte.
  label.textContent = solution
    ? `${index + 1} · Lösung`
    : `${index + 1} · ${puzzle.difficultyText} (${puzzle.difficultyScore.toFixed(2)})`;
  foot.append(label);

  article.append(board, foot);
  return article;
}

/**
 * Erzeugt eine A5-Seite mit dem übergebenen Rätsel.
 *
 * `page` ist ein Eintrag der Seitenliste (`{ no, puzzles, solution,
 * firstIndex }`) oder `null` für eine leere Seite.
 */
function buildPage(page) {
  const seite = document.createElement('div');
  seite.className = 'seite';

  if (!page) {
    seite.classList.add('seite--leer');
    const hint = document.createElement('span');
    hint.className = 'seite__leer';
    hint.textContent = 'leer';
    seite.appendChild(hint);
    return seite;
  }

  // Seitenzahl nur in der Bildschirmvorschau – im Druck stört sie.
  const nr = document.createElement('span');
  nr.className = 'seite__nr';
  nr.textContent = `S. ${page.no}`;
  seite.appendChild(nr);

  const grid = document.createElement('div');
  grid.className = 'seite__grid';

  page.puzzles.forEach((puzzle, i) => {
    grid.appendChild(
      miniPuzzle(puzzle, page.firstIndex + i, { solution: page.solution }),
    );
  });

  seite.appendChild(grid);
  return seite;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Faltkante eines Bogens.
 *
 * Gestrichelt = falten. Gezeichnet wird in Bogenkoordinaten
 * (1 Einheit = 1 mm), damit die Linie unabhängig von der Papiergrösse exakt
 * in der Mitte liegt. Die Beschriftung liegt im Randbereich der Seiten,
 * damit sie kein Rätsel überdeckt.
 */
function foldMark() {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'marken');
  svg.setAttribute('viewBox', '0 0 297 210');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('aria-hidden', 'true');

  // Falte in der Bogenmitte: teilt den Bogen in zwei A5-Seiten.
  const fold = document.createElementNS(SVG_NS, 'line');
  fold.setAttribute('class', 'marke marke--falt');
  fold.setAttribute('x1', '148.5');
  fold.setAttribute('y1', '0');
  fold.setAttribute('x2', '148.5');
  fold.setAttribute('y2', '210');

  svg.append(fold);

  const foldText = document.createElement('span');
  foldText.className = 'marke__text marke__text--falt';
  foldText.textContent = 'falten';

  return [svg, foldText];
}

/**
 * Baut eine Bogenhälfte (Vorder- oder Rückseite) als A4-Querformat mit zwei
 * A5-Seiten in Heft-Reihenfolge.
 */
function buildSheetElement(sheet, side) {
  const section = document.createElement('section');
  section.className = 'bogen';
  section.dataset.side = side;

  const label = document.createElement('p');
  label.className = 'bogen__label';
  label.textContent = `Bogen ${sheet.index + 1} · ${
    side === 'front' ? 'Vorderseite' : 'Rückseite'
  }`;

  const paper = document.createElement('div');
  paper.className = 'bogen__paper';
  paper.dataset.side = side;
  // Reihenfolge: links, rechts.
  for (const page of sheet[side]) paper.append(buildPage(page));
  paper.append(...foldMark());

  section.append(label, paper);
  return section;
}

/**
 * Seitenliste des Hefts in Leserichtung: erst die Rätsel, danach die
 * Lösungen. Jede Seite kennt ihre Nummer und den Startindex der Rätsel.
 */
function bookletPages(pages) {
  const withSolutions = state.booklet?.withSolutions ?? state.withSolutions;
  const out = [];
  let puzzleIndex = 0;
  for (const page of pages) {
    out.push({ no: out.length + 1, puzzles: page, solution: false, firstIndex: puzzleIndex });
    puzzleIndex += page.length;
  }
  if (withSolutions) {
    puzzleIndex = 0;
    for (const page of pages) {
      out.push({ no: out.length + 1, puzzles: page, solution: true, firstIndex: puzzleIndex });
      puzzleIndex += page.length;
    }
  }
  return out;
}

/** Daten, die der aktuell angezeigte bzw. als Nächstes geladene Code beschreibt. */
function pendingBooklet() {
  if (state.seed != null) {
    return {
      seed: state.seed,
      level: state.level,
      count: state.count,
      withSolutions: state.withSolutions,
    };
  }
  return state.booklet;
}

/** Baut einen Code und fängt ungültige Altdaten ab. */
function codeFor(booklet) {
  if (!booklet) return '';
  try {
    return makeBookletCode(booklet);
  } catch {
    return '';
  }
}

function currentCode() {
  return codeFor(pendingBooklet());
}

/**
 * Zeigt den Code des angezeigten Hefts (oder des als Nächstes geladenen
 * Hefts) an und schaltet die Kopierknöpfe passend.
 */
function updateCodeDisplay() {
  const code = currentCode();
  ui.codeInput.value = code;
  const hasCode = Boolean(code);
  ui.copyCodeBtn.disabled = !hasCode;
  ui.copyBtn.disabled = !hasCode;

  if (state.seed != null) {
    ui.codeNote.textContent =
      'Aus Link oder Code übernommen – „Heft erzeugen“ lädt dieses Heft.';
  } else if (state.booklet) {
    ui.codeNote.textContent =
      'Gehört zum angezeigten Heft. Mit Code oder Link lässt es sich später wiederherstellen.';
  } else {
    ui.codeNote.textContent = 'Wird beim Erzeugen automatisch vergeben.';
  }
}

function render() {
  const puzzles = state.puzzles;
  const pages = pagesOf(puzzles);
  const list = bookletPages(pages);
  const { sheets, pageCount } = impose(list);

  // Immer Vorder- und Rückseite eines Bogens hintereinander: so kann der
  // Bogen im Duplexdruck direkt gewendet werden.
  const druckbogen = [];
  for (const sheet of sheets) {
    druckbogen.push(buildSheetElement(sheet, 'front'));
    druckbogen.push(buildSheetElement(sheet, 'back'));
  }

  ui.sheets.replaceChildren(...druckbogen);

  const blank = pageCount - list.length;

  ui.info.dataset.dirty = '';
  const avgDifficulty =
    puzzles.length > 0
      ? puzzles.reduce((sum, p) => sum + (p.difficultyScore ?? 0), 0) / puzzles.length
      : 0;
  // Für die Zusammenfassung zählt das angezeigte Heft – nicht eine
  // eventuell schon geänderte Einstellung.
  const shown = state.booklet;
  const shownLevel = shown?.level ?? state.level;
  const withSolutions = shown?.withSolutions ?? state.withSolutions;
  const target = DIFFICULTIES[shownLevel]?.label ?? shownLevel;
  const band = LEVEL_BANDS[shownLevel] ?? [0, 1];
  const imBand = puzzles.filter(
    (p) => p.difficultyScore >= band[0] && p.difficultyScore <= band[1],
  ).length;

  // Ist das Ziel mit dieser Inselzahl überhaupt erreichbar?
  // Entscheidend ist, ob sich die Bänder überschneiden.
  const count = state.islands ?? islandCount(shownLevel);
  const range = achievableRange(CALIBRATION.buckets[bucketFor(count)]);
  const erreichbar = band[0] <= range[1] && band[1] >= range[0];
  const hinweis = erreichbar
    ? ''
    : ` · Ziel „${target}" ist bei ${count} Inseln nicht erreichbar ` +
      `(möglich ist ${range[0].toFixed(2)}–${range[1].toFixed(2)})`;

  const teile = [
    `${puzzles.length} Rätsel`,
    `${puzzles[0]?.islands.length ?? count} Inseln`,
    `Ziel „${target}"`,
    `gemessen Ø ${avgDifficulty.toFixed(2)} (${imBand}/${puzzles.length} im Zielband)`,
    `${pages.length} Rätselseiten` + (withSolutions ? ` + ${pages.length} Lösungsseiten` : ''),
  ];
  if (blank) teile.push(`${blank} leere Seiten`);
  teile.push(`${pageCount} Seiten A5`, `${sheets.length} A4-Bogen beidseitig`);

  const code = codeFor(state.booklet);
  if (code) teile.push(`Code ${code}`);

  ui.info.textContent = teile.join(' · ') + hinweis;

  fitPreview();
}

/**
 * Skaliert die Vorschau so, dass ein A4-Bogen in die Spalte passt.
 *
 * Gedruckt wird immer in Originalgrösse – die Skalierung betrifft nur die
 * Bildschirmvorschau (sonst müsste man seitwärts scrollen).
 */
function fitPreview() {
  const width = ui.sheets.clientWidth;
  if (!width) return;
  // 297 mm (A4 quer) bei 96 dpi
  const paper = (297 * 96) / 25.4;
  const zoom = Math.min(1, (width - 4) / paper);
  ui.sheets.style.setProperty('--bogen-zoom', zoom.toFixed(3));
}

/* ------------------------------------------------------------------ *
 * Bedienung
 * ------------------------------------------------------------------ */

function syncGroups() {
  for (const button of ui.difficulty.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(button.dataset.level === state.level));
  }
  for (const button of ui.count.querySelectorAll('button')) {
    button.setAttribute('aria-pressed', String(Number(button.dataset.count) === state.count));
  }
}

/** Sperrt die Einstellungen, solange ein Heft erzeugt wird. */
function setSettingsDisabled(disabled) {
  for (const button of ui.difficulty.querySelectorAll('button')) button.disabled = disabled;
  for (const button of ui.count.querySelectorAll('button')) button.disabled = disabled;
  ui.countInput.disabled = disabled;
  ui.withSolutions.disabled = disabled;
}

function updateHash() {
  const data = pendingBooklet() ?? {
    seed: null,
    level: state.level,
    count: state.count,
    withSolutions: state.withSolutions,
  };
  const params = new URLSearchParams();
  if (data.seed) params.set('seed', data.seed);
  params.set('d', data.level);
  params.set('n', String(data.count));
  params.set('sol', data.withSolutions ? '1' : '0');
  const hash = `#${params.toString()}`;
  if (window.location.hash !== hash) history.replaceState(null, '', hash);
}

function readHash() {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const out = {};
  const seed = params.get('seed');
  const n = Number(params.get('n'));
  if (seed) out.seed = seed;

  const d = (params.get('d') || '').trim().toLowerCase();
  if (DIFFICULTIES[d]) out.level = d;
  else if (LABEL_TO_ID[d]) out.level = LABEL_TO_ID[d];

  if (Number.isFinite(n) && n >= 1 && n <= MAX_PUZZLES) out.count = Math.round(n);
  if (params.has('sol')) out.withSolutions = params.get('sol') === '1';
  return out;
}

async function copyLink() {
  updateHash();
  try {
    await navigator.clipboard.writeText(window.location.href);
    ui.info.textContent = 'Link in die Zwischenablage kopiert.';
  } catch {
    ui.codeInput.select();
  }
}

async function copyCode() {
  const code = currentCode();
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    ui.info.textContent = `Heft-Code ${code} kopiert.`;
  } catch {
    ui.codeInput.select();
  }
}

/**
 * Lädt ein Heft aus einem Code. Der Code legt Seed, Schwierigkeit, Anzahl
 * und Lösungsseiten fest; danach wird das Heft direkt erzeugt.
 */
function loadCode() {
  if (ui.generateBtn.disabled) return;
  const parsed = parseBookletCode(ui.loadCodeInput.value);
  if (!parsed) {
    ui.loadInfo.textContent =
      'Ungültiger Heft-Code. Bitte den Code vollständig eingeben, z. B. K4F9-2QXZ.M08S.';
    ui.loadInfo.dataset.tone = 'bad';
    return;
  }

  state.seed = parsed.seed;
  state.level = parsed.level;
  state.count = parsed.count;
  state.withSolutions = parsed.withSolutions;

  ui.countInput.value = String(state.count);
  ui.withSolutions.checked = state.withSolutions;
  syncGroups();
  updateCodeDisplay();
  updateHash();

  ui.loadInfo.textContent = 'Heft-Code erkannt – das Heft wird erzeugt.';
  ui.loadInfo.dataset.tone = 'ok';
  generate();
}

/**
 * Erzeugt das Heft. Die Arbeit wird auf mehrere Zeitschritte verteilt,
 * damit die Oberfläche bei 100 Rätseln nicht einfriert.
 */
function generate() {
  if (ui.generateBtn.disabled) return;

  // Ein vorhandener Seed (aus Link oder Code) wird übernommen. Sonst
  // entsteht hier der neue Seed für dieses Heft – der Code wird also erst
  // beim Erzeugen vergeben, nicht vorher verlangt.
  const seed = state.seed ?? randomSeed();
  state.seed = seed;
  // Die Einstellungen für dieses Heft werden beim Start festgehalten. So
  // beschreibt der erzeugte Code auch dann exakt das Heft, wenn während
  // der Erzeugung ein Schalter betätigt wird.
  const level = state.level;
  const total = state.count;
  state.format = null;
  state.islands = null;

  const puzzles = [];
  let index = 0;

  ui.generateBtn.disabled = true;
  ui.loadBtn.disabled = true;
  setSettingsDisabled(true);
  ui.generateBtn.textContent = 'Wird erzeugt …';

  const step = () => {
    const end = Math.min(index + 8, total);
    try {
      for (; index < end; index++) puzzles.push(makePuzzle(index, level));
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
    state.booklet = {
      seed,
      level,
      count: total,
      withSolutions: state.withSolutions,
    };
    // Ab jetzt ist der Seed Teil des angezeigten Hefts; der nächste Klick
    // auf «Heft erzeugen» würfelt wieder einen neuen Code.
    state.seed = null;
    updateHash();
    updateCodeDisplay();
    ui.printBtn.disabled = false;
    render();
    finish();
  };

  const finish = () => {
    ui.generateBtn.disabled = false;
    ui.loadBtn.disabled = false;
    setSettingsDisabled(false);
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
  // Solange noch kein Heft erzeugt wurde, zeigt die Adresse die gewählten
  // Einstellungen. Nach dem Erzeugen gehört sie zum angezeigten Heft.
  updateHash();
  updateCodeDisplay();
  // Bei geänderten Einstellungen muss das Raster neu bestimmt werden.
  state.format = null;
  // Die Inselzahl wird beim Erzeugen neu ausgehandelt.
  state.islands = null;
  if (!state.puzzles.length) return;
  ui.info.textContent =
    'Einstellungen geändert – bitte "Heft erzeugen" klicken. Dabei entsteht ein neuer Heft-Code.';
  ui.info.dataset.dirty = 'true';
}

function setupEvents() {
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
    // Die Lösungsseiten gehören zum angezeigten Heft: Der Code ändert sich
    // dadurch, der Seed bleibt gleich.
    if (state.booklet) state.booklet.withSolutions = state.withSolutions;
    if (state.puzzles.length) render();
    updateCodeDisplay();
    updateHash();
  });

  ui.generateBtn.addEventListener('click', generate);
  ui.copyCodeBtn.addEventListener('click', copyCode);
  ui.copyBtn.addEventListener('click', copyLink);
  ui.loadBtn.addEventListener('click', loadCode);
  ui.loadCodeInput.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      loadCode();
    }
  });
  ui.printBtn.addEventListener('click', () => window.print());
  window.addEventListener('resize', fitPreview);

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    if (target instanceof HTMLInputElement) return;
    if (event.key.toLowerCase() === 'n' && !event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      // «N» heißt: ein neues Heft, nicht das angezeigte erneut erzeugen.
      state.seed = null;
      generate();
    }
  });
}

function boot() {
  buildDifficultyButtons();

  const fromHash = readHash();
  Object.assign(state, fromHash);
  ui.countInput.value = String(state.count);
  ui.withSolutions.checked = state.withSolutions;

  setupEvents();
  syncGroups();
  updateCodeDisplay();
  updateHash();

  // Es wird bewusst nichts erzeugt: das Heft entsteht erst auf Klick
  // auf "Heft erzeugen".
  showEmptyState();
  if (fromHash.seed) {
    ui.info.textContent =
      'Heft-Code aus dem Link übernommen – bitte „Heft erzeugen" klicken.';
  }
}

/** Platzhalter, solange noch kein Heft erzeugt wurde. */
function showEmptyState() {
  const box = document.createElement('div');
  box.className = 'empty';
  box.innerHTML =
    '<p class="empty__title">Noch kein Heft erzeugt</p>' +
    '<p class="empty__text">Einstellungen wählen und auf <strong>„Heft erzeugen"</strong> klicken. ' +
    'Das Heft erhält automatisch einen Code, mit dem es sich später wiederherstellen lässt. ' +
    'Je nach Umfang dauert die Erzeugung einige Minuten.</p>';
  ui.sheets.replaceChildren(box);
  ui.info.textContent = 'Bereit – bitte „Heft erzeugen" klicken.';
  ui.info.dataset.dirty = '';
}

boot();
