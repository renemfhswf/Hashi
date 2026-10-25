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

/** Baut die Heftseite auf; Standard: ein leichtes Rätsel. */
const mount = (hash = '#seed=TEST&d=easy&n=1') =>
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

  // Die frühere Auswahl «Rätsel pro Seite» gibt es nicht mehr.
  assert.equal(document.getElementById('perPage'), null, 'die Auswahl «Rätsel pro Seite» ist noch da');

  // Der Textblock «Inseln pro Rätsel» ist für die Bedienung nicht nötig.
  assert.equal(document.getElementById('islandsInfo'), null, 'der Textblock «Inseln pro Rätsel» ist noch da');
  assert.equal(document.body.textContent.includes('Inseln pro Rätsel'), false);
});

test('Jeder Knopf der Heftseite hat einen Klick-Handler', async () => {
  const { document } = await mount();

  const buttons = document.body.querySelectorAll('button');
  // 4 Stufen + 4 Anzahl + Heft + Druck + Link
  assert.equal(buttons.length, 11, `unerwartete Knopfzahl: ${buttons.length}`);

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

test('«Anzahl Rätsel» stellt den Wert ein', async () => {
  const { document, window } = await mount();

  const count = document.getElementById('count').querySelectorAll('button');
  count.find((button) => button.dataset.count === '20').click();
  assert.equal(document.getElementById('countInput').value, '20');
  assert.equal(count.find((button) => button.dataset.count === '20').getAttribute('aria-pressed'), 'true');
  assert.match(window.location.hash, /(^#|&)n=20(&|$)/);
  assert.equal(document.getElementById('sheets').querySelectorAll('.bogen').length, 0);
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

test('«Heft erzeugen» baut A4-Bögen mit Faltmarke', async () => {
  const { document, window } = await mount();

  const generateBtn = document.getElementById('generateBtn');
  generateBtn.click();

  await waitFor(() => !generateBtn.disabled);

  const sheets = document.getElementById('sheets');
  const boegen = sheets.querySelectorAll('.bogen');
  assert.equal(boegen.length, 2, 'ein Bogen besteht aus Vorder- und Rückseite');
  assert.equal(boegen[0].dataset.side, 'front');
  assert.equal(boegen[1].dataset.side, 'back');

  // Zwei A5-Seiten pro Blattseite, also vier pro Bogen.
  assert.equal(boegen[0].querySelectorAll('.seite').length, 2);
  assert.equal(sheets.querySelectorAll('.seite').length, 4);

  // Die Faltlinie liegt als SVG im Bogen – geschnitten wird nicht mehr.
  assert.equal(sheets.querySelectorAll('.marken').length, 2);
  assert.equal(sheets.querySelectorAll('.marke--falt').length, 2);
  assert.equal(sheets.querySelectorAll('.marke--schnitt').length, 0, 'es gibt noch Schnittmarken');

  // Die Vorschau zeigt zwei Rätsel bzw. ein Rätsel mit Lösung.
  assert.equal(sheets.querySelectorAll('.mini').length, 2);

  // Jede Seite trägt ein Rätsel oder den Leer-Hinweis.
  const summary = info(document);
  assert.match(summary.textContent, /^1 Rätsel · \d+ Inseln · Ziel „Leicht"/);
  assert.match(summary.textContent, /4 Seiten A5/);
  assert.match(summary.textContent, /1 A4-Bogen beidseitig/);
  assert.match(summary.textContent, /Seed TEST/);

  assert.match(window.location.hash, /(^#|&)d=easy(&|$)/);
  assert.equal(window.location.hash.includes('per='), false, 'die Adresse enthält noch «per»');
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

test('Die Bögen stehen in Heft-Reihenfolge', async () => {
  const { document } = await mount('#seed=REIHENFOLGE&d=easy&n=2');

  const generateBtn = document.getElementById('generateBtn');
  generateBtn.click();
  await waitFor(() => !generateBtn.disabled);

  // Zwei Rätsel + zwei Lösungsseiten = vier Seiten = ein Bogen.
  const boegen = document.getElementById('sheets').querySelectorAll('.bogen');
  assert.equal(boegen.length, 2, 'Vorder- und Rückseite');

  const seiten = (bogen) => bogen.querySelectorAll('.seite__nr').map((nr) => nr.textContent);
  assert.deepEqual(seiten(boegen[0]), ['S. 4', 'S. 1'], 'Vorderseite: hinten links, Titel rechts');
  assert.deepEqual(seiten(boegen[1]), ['S. 2', 'S. 3'], 'Rückseite: die beiden Innenseiten');
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
