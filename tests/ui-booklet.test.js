/**
 * Oberflächentests für das Rätselheft (`puzzlebook.html` + `js/booklet.js`).
 *
 * Wie bei den Spieltests läuft die echte Seite in einem kleinen DOM
 * (tests/helpers/dom.js). Geprüft wird, dass jeder Knopf verdrahtet ist und
 * wirklich etwas auslöst – und dass das Heft erst auf Klick entsteht.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { mountPage, makeEvent } from './helpers/dom.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Baut die Heftseite auf; Standard: ein leichtes Rätsel, eine Seite pro Blatt. */
const mount = (hash = '#seed=TEST&d=easy&n=1&per=1') =>
  mountPage(path.join(ROOT, 'puzzlebook.html'), path.join(ROOT, 'js', 'booklet.js'), { hash });

const info = (doc) => doc.getElementById('bookletInfo');

/** Wartet, bis `check()` wahr wird (die Erzeugung läuft in mehreren Schritten). */
async function waitFor(check, timeout = 120000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('Zeitüberschreitung beim Warten');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test('Beim Start ist die Vorschau leer – es wird nichts erzeugt', async () => {
  const { document } = await mount();

  const sheets = document.getElementById('sheets');
  assert.equal(sheets.querySelectorAll('.bogen').length, 0, 'beim Start wurde schon ein Heft erzeugt');
  assert.equal(sheets.querySelectorAll('.empty').length, 1, 'der Platzhalter fehlt');
  assert.equal(info(document).textContent, 'Bereit – bitte „Heft erzeugen" klicken.');
  assert.equal(document.getElementById('generateBtn').disabled, false);

  // Einstellungen aus dem Link sind übernommen.
  assert.equal(document.getElementById('countInput').value, '1');
  assert.equal(document.getElementById('seedInput').value, 'TEST');
  assert.equal(
    document.getElementById('difficulty').querySelector('button[aria-pressed="true"]')?.dataset.level,
    'easy',
  );
});

test('Jeder Knopf der Heftseite hat einen Klick-Handler', async () => {
  const { document } = await mount();

  const buttons = document.body.querySelectorAll('button');
  // 4 Stufen + 2 pro Seite + 4 Anzahl + Heft + Druck + Link
  assert.equal(buttons.length, 13, `unerwartete Knopfzahl: ${buttons.length}`);

  for (const button of buttons) {
    const name = button.id || button.textContent.trim() || button.dataset.level || '?';
    assert.equal(button.hasListener('click'), true, `Knopf "${name}" hat keinen Klick-Handler`);
  }
});

test('Die Stufen-Knöpfe stehen in der Knopfleiste und wählen nur aus', async () => {
  const { document, window } = await mount();

  const picker = document.getElementById('difficulty');
  const buttons = picker.querySelectorAll('button');
  assert.deepEqual(
    buttons.map((button) => button.dataset.level),
    ['easy', 'medium', 'hard', 'expert'],
  );

  const hard = buttons.find((button) => button.dataset.level === 'hard');
  hard.click();

  assert.equal(hard.getAttribute('aria-pressed'), 'true');
  assert.equal(
    buttons.filter((button) => button.getAttribute('aria-pressed') === 'true').length,
    1,
    'es sind mehrere Stufen gleichzeitig ausgewählt',
  );
  assert.match(window.location.hash, /(^#|&)d=hard(&|$)/);

  // Nur Auswahl: es wird bewusst noch kein Heft erzeugt.
  assert.equal(document.getElementById('sheets').querySelectorAll('.bogen').length, 0);
  assert.equal(document.getElementById('generateBtn').disabled, false);
});

test('«Rätsel pro Seite» und «Anzahl Rätsel» stellen die Werte ein', async () => {
  const { document, window } = await mount();

  const perPage = document.getElementById('perPage').querySelectorAll('button');
  perPage.find((button) => button.dataset.per === '2').click();
  assert.equal(perPage.find((button) => button.dataset.per === '2').getAttribute('aria-pressed'), 'true');
  assert.match(window.location.hash, /(^#|&)per=2(&|$)/);
  assert.equal(document.getElementById('sheets').querySelectorAll('.bogen').length, 0);

  const count = document.getElementById('count').querySelectorAll('button');
  count.find((button) => button.dataset.count === '20').click();
  assert.equal(document.getElementById('countInput').value, '20');
  assert.equal(count.find((button) => button.dataset.count === '20').getAttribute('aria-pressed'), 'true');
  assert.match(window.location.hash, /(^#|&)n=20(&|$)/);
});

test('Die Anzahl kann auch von Hand eingetippt werden (mit Grenzen)', async () => {
  const { document, window } = await mount();

  const input = document.getElementById('countInput');
  input.value = '7';
  input.dispatchEvent(makeEvent('change', input));
  assert.equal(input.value, '7');
  assert.match(window.location.hash, /(^#|&)n=7(&|$)/);

  input.value = '5000';
  input.dispatchEvent(makeEvent('change', input));
  assert.equal(input.value, '100', 'die Obergrenze wird nicht eingehalten');

  input.value = '0';
  input.dispatchEvent(makeEvent('change', input));
  assert.equal(input.value, '1', 'die Untergrenze wird nicht eingehalten');
});

test('Ein neuer Seed merkt die Vorschau als veraltet vor', async () => {
  const { document } = await mount();

  const input = document.getElementById('seedInput');
  input.value = 'ANDERS';
  input.dispatchEvent(makeEvent('change', input));

  assert.equal(document.getElementById('sheets').querySelectorAll('.bogen').length, 0);
  assert.equal(document.getElementById('generateBtn').disabled, false);
});

test('«Heft erzeugen» baut A4-Bögen mit Falt- und Schnittmarken', async () => {
  const { document, window } = await mount();

  const generateBtn = document.getElementById('generateBtn');
  generateBtn.click();

  await waitFor(() => !generateBtn.disabled);

  const sheets = document.getElementById('sheets');
  const boegen = sheets.querySelectorAll('.bogen');
  assert.equal(boegen.length, 2, 'ein Bogen besteht aus Vorder- und Rückseite');
  assert.equal(boegen[0].dataset.side, 'front');
  assert.equal(boegen[1].dataset.side, 'back');

  // Vier A6-Seiten pro Bogenhälfte.
  assert.equal(boegen[0].querySelectorAll('.seite').length, 4);
  assert.equal(sheets.querySelectorAll('.seite').length, 8);

  // Schnitt- und Faltlinien liegen als SVG im Bogen.
  assert.equal(sheets.querySelectorAll('.marken').length, 2);
  assert.equal(sheets.querySelectorAll('.marke--schnitt').length, 2);
  assert.equal(sheets.querySelectorAll('.marke--falt').length, 2);

  // Jede Seite trägt ein Rätsel oder den Leer-Hinweis.
  const summary = info(document);
  assert.match(summary.textContent, /^1 Rätsel · \d+ Inseln · Ziel „Leicht"/);
  assert.match(summary.textContent, /A4-Bogen beidseitig/);
  assert.match(summary.textContent, /Seed TEST/);

  assert.match(window.location.hash, /(^#|&)d=easy(&|$)/);
  assert.equal(generateBtn.textContent.includes('Heft erzeugen'), true);
});

test('«Drucken» und «Link» arbeiten nach der Erzeugung', async () => {
  const { document, window } = await mount();

  const generateBtn = document.getElementById('generateBtn');
  generateBtn.click();
  await waitFor(() => !generateBtn.disabled);

  document.getElementById('printBtn').click();
  assert.equal(window.printCalls, 1, 'window.print wurde nicht aufgerufen');

  document.getElementById('copyBtn').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(info(document).textContent, 'Link in die Zwischenablage kopiert.');
});

test('«Rätsel pro Seite» ordnet die vorhandenen Rätsel neu an, ohne neu zu erzeugen', async () => {
  const { document } = await mount();

  const generateBtn = document.getElementById('generateBtn');
  generateBtn.click();
  await waitFor(() => !generateBtn.disabled);

  const miniCount = () => document.getElementById('sheets').querySelectorAll('.mini').length;
  // Ein Rätsel + eine Lösungsseite.
  const before = miniCount();
  assert.equal(before, 2);

  const perPage = document.getElementById('perPage').querySelectorAll('button');
  perPage.find((button) => button.dataset.per === '2').click();

  assert.equal(miniCount(), before, 'die Rätsel wurden neu erzeugt statt nur neu angeordnet');
  assert.equal(document.getElementById('sheets').querySelectorAll('.bogen').length, 2);
  assert.equal(generateBtn.disabled, false);
  assert.equal(info(document).textContent.includes('Lösungsseiten'), true);
});

test('Lösungen lassen sich abwählen und wieder anhängen', async () => {
  const { document } = await mount();

  const generateBtn = document.getElementById('generateBtn');
  generateBtn.click();
  await waitFor(() => !generateBtn.disabled);

  const miniCount = () => document.getElementById('sheets').querySelectorAll('.mini').length;
  const checkbox = document.getElementById('withSolutions');
  assert.equal(checkbox.checked, true, 'die Lösungen sind standardmässig angehängt');
  assert.equal(miniCount(), 2, 'Rätsel und Lösung sollten gesetzt sein');
  assert.equal(info(document).textContent.includes('Lösungsseiten'), true);

  checkbox.checked = false;
  checkbox.dispatchEvent(makeEvent('change', checkbox));
  assert.equal(miniCount(), 1, 'die Lösungsseite wurde nicht entfernt');
  assert.equal(info(document).textContent.includes('Lösungsseiten'), false);

  checkbox.checked = true;
  checkbox.dispatchEvent(makeEvent('change', checkbox));
  assert.equal(miniCount(), 2, 'die Lösungsseite kam nicht zurück');
});
