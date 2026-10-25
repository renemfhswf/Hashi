/**
 * Oberflächentests für das Spiel (`index.html` + `js/app.js`).
 *
 * Die Seite wird in Node mit einem kleinen DOM (tests/helpers/dom.js)
 * aufgebaut; die Knöpfe werden wirklich angeklickt und ihre Wirkung geprüft.
 * Damit fällt z. B. auf, wenn zwei Elemente dieselbe `id` tragen und
 * `getElementById` deshalb das falsche Element liefert.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mountPage, makeEvent } from './helpers/dom.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const mount = () => mountPage(path.join(ROOT, 'index.html'), path.join(ROOT, 'js', 'app.js'));

const status = (doc) => doc.getElementById('status').textContent;
const seedValue = (doc) => doc.getElementById('seedInput').value;
const hash = (win) => win.location.hash;

const levelButtons = (doc) => doc.getElementById('difficulty').querySelectorAll('button');
const levelButton = (doc, level) => levelButtons(doc).find((button) => button.dataset.level === level);

/** Wartet einen Makrotask ab (für asynchrone Handler wie „Link kopieren"). */
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('Die Schwierigkeitsstufen stehen als Knöpfe in der Seitenleiste', async () => {
  const { document } = await mount();

  const picker = document.getElementById('difficulty');
  assert.ok(picker, 'Behälter #difficulty fehlt');
  assert.ok(picker.classList.contains('segmented'), '#difficulty ist keine Knopfleiste');
  assert.equal(picker.closest('.topbar'), null, '#difficulty liegt in der Kopfzeile statt in der Seitenleiste');

  const levels = levelButtons(document).map((button) => button.dataset.level);
  assert.deepEqual(levels, ['easy', 'medium', 'hard', 'expert']);

  // Die Kennzahl in der Kopfzeile ist ein eigenes Element – nicht die Knopfleiste.
  const stat = document.getElementById('difficultyStat');
  assert.ok(stat, 'Kennzahl #difficultyStat fehlt');
  assert.notEqual(stat, picker);
  assert.equal(stat.closest('.topbar') !== null, true);
  assert.match(stat.textContent, /^\d+,\d{2}$/);
});

test('Kein Element teilt sich eine id mit einem anderen', async () => {
  const { document } = await mount();

  const seen = new Map();
  for (const element of document.body.querySelectorAll('[id]')) {
    const id = element.id;
    assert.equal(seen.has(id), false, `id "${id}" kommt mehrfach vor`);
    seen.set(id, element);
  }
});

test('Klick auf «Schwer» stellt das Rätsel auf schwer um', async () => {
  const { document, window } = await mount();

  const hard = levelButton(document, 'hard');
  assert.ok(hard, 'Knopf «Schwer» fehlt');
  hard.click();

  assert.equal(hard.getAttribute('aria-pressed'), 'true');
  for (const other of levelButtons(document)) {
    if (other !== hard) assert.equal(other.getAttribute('aria-pressed'), 'false');
  }
  assert.match(status(document), /^Schwer · \d+ Inseln · Seed /);
  assert.match(hash(window), /(^#|&)d=hard(&|$)/);

  // Die Knöpfe dürfen durch das neue Rätsel nicht verschwinden.
  assert.equal(levelButtons(document).length, 4);
  assert.match(document.getElementById('difficultyStat').textContent, /^\d+,\d{2}$/);
});

test('Schwierigkeitswechsel über alle vier Stufen', async () => {
  const { document, window } = await mount();

  for (const level of ['expert', 'easy', 'medium', 'hard']) {
    levelButton(document, level).click();
    assert.equal(levelButton(document, level).getAttribute('aria-pressed'), 'true');
    assert.match(hash(window), new RegExp(`(^#|&)d=${level}(&|$)`));
  }
  assert.equal(levelButtons(document).length, 4);
});

test('Jeder Knopf der Seite hat einen Klick-Handler', async () => {
  const { document } = await mount();

  const buttons = document.body.querySelectorAll('button');
  assert.ok(buttons.length >= 12, `zu wenige Knöpfe gefunden (${buttons.length})`);

  for (const button of buttons) {
    const name = button.id || button.textContent.trim() || button.dataset.level || '?';
    assert.equal(button.hasListener('click'), true, `Knopf "${name}" hat keinen Klick-Handler`);
  }
});

test('«Neues Rätsel» erzeugt ein anderes Rätsel', async () => {
  const { document, window } = await mount();

  const before = seedValue(document);
  document.getElementById('newBtn').click();
  const after = seedValue(document);

  assert.notEqual(after, before, 'der Seed hat sich nicht geändert');
  assert.match(status(document), /Seed /);
  assert.match(hash(window), new RegExp(`seed=${encodeURIComponent(after)}`));
});

test('Hinweis, Zurück und Vor verändern das Brett', async () => {
  const { document } = await mount();

  const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  const bridgeCount = () => Number(document.getElementById('bridgeCount').textContent);

  assert.equal(undoBtn.disabled, true, '«Zurück» ist ohne Zug aktiv');
  assert.equal(redoBtn.disabled, true, '«Vor» ist ohne Zug aktiv');

  document.getElementById('hintBtn').click();
  assert.match(status(document), /^Hinweis:/);
  assert.ok(bridgeCount() > 0, 'der Hinweis hat keine Brücke gesetzt');
  assert.equal(undoBtn.disabled, false);

  const hinted = bridgeCount();
  undoBtn.click();
  assert.equal(bridgeCount(), 0, '«Zurück» hat die Brücke nicht entfernt');
  assert.equal(redoBtn.disabled, false);

  redoBtn.click();
  assert.equal(bridgeCount(), hinted, '«Vor» hat die Brücke nicht wiederhergestellt');
});

test('«Prüfen» meldet ein leeres Brett und danach korrekte Brücken', async () => {
  const { document } = await mount();

  document.getElementById('checkBtn').click();
  assert.equal(status(document), 'Noch keine Brücken gesetzt.');

  document.getElementById('hintBtn').click();
  document.getElementById('checkBtn').click();
  assert.equal(status(document), 'Alle gesetzten Brücken sind korrekt.');
});

test('«Lösung zeigen» öffnet das Fenster, «Weiterlösen» schliesst es', async () => {
  const { document } = await mount();

  const overlay = document.getElementById('overlay');
  assert.equal(overlay.hidden, true);

  document.getElementById('solveBtn').click();
  assert.equal(overlay.hidden, false, 'das Lösungsfenster wurde nicht geöffnet');
  assert.match(document.getElementById('winTime').textContent, /^\d{2}:\d{2}$/);
  assert.match(status(document), /^Gelöst in \d{2}:\d{2}\.$/);

  document.getElementById('winClose').click();
  assert.equal(overlay.hidden, true);
  assert.match(document.getElementById('difficultyStat').textContent, /^\d+,\d{2}$/);
});

test('«Neues Rätsel» im Lösungsfenster startet ein neues Rätsel', async () => {
  const { document, window } = await mount();

  const overlay = document.getElementById('overlay');
  document.getElementById('solveBtn').click();
  assert.equal(overlay.hidden, false);

  const before = seedValue(document);
  document.getElementById('winNew').click();

  assert.equal(overlay.hidden, true);
  assert.notEqual(seedValue(document), before);
  assert.match(hash(window), new RegExp(`seed=${encodeURIComponent(seedValue(document))}`));
});

test('«Farbschema» schaltet automatisch → hell → dunkel → automatisch', async () => {
  const { document } = await mount();

  const root = document.documentElement;
  const themeBtn = document.getElementById('themeBtn');
  assert.equal(root.getAttribute('data-theme'), null);

  themeBtn.click();
  assert.equal(root.getAttribute('data-theme'), 'light');
  themeBtn.click();
  assert.equal(root.getAttribute('data-theme'), 'dark');
  themeBtn.click();
  assert.equal(root.getAttribute('data-theme'), null);
});

test('«Link» kopiert die Adresse in die Zwischenablage', async () => {
  const { document } = await mount();

  document.getElementById('copyBtn').click();
  await tick();

  assert.equal(status(document), 'Link in die Zwischenablage kopiert.');
});

test('«Drucken» druckt das Rätsel und räumt danach auf', async () => {
  const { document, window } = await mount();

  document.getElementById('printBtn').click();

  assert.equal(window.printCalls, 1, 'window.print wurde nicht aufgerufen');
  const printArea = document.getElementById('printArea');
  assert.equal(printArea.children.length, 1, 'der Druckbereich wurde nicht gefüllt');
  assert.equal(printArea.querySelector('.print-sheet'), printArea.children[0]);
  assert.match(printArea.textContent, /Name:/);
});

test('Der Seed kann von Hand eingegeben werden', async () => {
  const { document, window } = await mount();

  const input = document.getElementById('seedInput');
  input.value = 'HANDGESETZT';
  input.dispatchEvent(makeEvent('change', input));

  assert.match(hash(window), /seed=HANDGESETZT(&|$)/);
  assert.match(status(document), /Seed /);
});

test('Tastenkürzel wirken wie die Knöpfe', async () => {
  const { document } = await mount();

  const press = (key, extra = {}) =>
    document.dispatchEvent(makeEvent('keydown', document, { key, ...extra }));

  press('h');
  assert.match(status(document), /^Hinweis:/);
  assert.equal(document.getElementById('undoBtn').disabled, false);

  press('c');
  assert.equal(status(document), 'Alle gesetzten Brücken sind korrekt.');

  press('s');
  assert.equal(document.getElementById('overlay').hidden, false);

  press('Escape');
  press('n');
  assert.equal(document.getElementById('overlay').hidden, true);
});

test('Der Link zum Rätselheft zeigt auf eine vorhandene Seite', async () => {
  const { document } = await mount();

  const links = document.body.querySelectorAll('a[href]');
  assert.ok(links.length > 0);
  for (const link of links) {
    const target = link.getAttribute('href');
    if (/^(https?:|#|mailto:)/.test(target)) continue;
    const file = path.join(ROOT, target.split('#')[0].split('?')[0]);
    assert.doesNotThrow(() => readFileSync(file), `Ziel ${target} fehlt`);
  }
});
