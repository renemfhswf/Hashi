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
import { makeBookletCode } from '../js/booklet-code.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Baut die Heftseite auf; Standard: ein leichtes Rätsel ohne vorgegebenen Code. */
const mount = (hash = '#d=easy&n=1') =>
  mountPage(path.join(ROOT, 'puzzlebook.html'), path.join(ROOT, 'js', 'booklet.js'), { hash });

const info = (doc) => doc.getElementById('bookletInfo');
const codeValue = (doc) => doc.getElementById('codeInput').value;

/** Wartet, bis `check()` wahr wird (die Erzeugung läuft in mehreren Schritten). */
async function waitFor(check, timeout = 120000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('Zeitüberschreitung beim Warten');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

test('Beim Start ist die Vorschau leer – es wird nichts erzeugt', async () => {
  const { document, window } = await mount();

  const sheets = document.getElementById('sheets');
  assert.equal(sheets.querySelectorAll('.bogen').length, 0, 'beim Start wurde schon ein Heft erzeugt');
  assert.equal(sheets.querySelectorAll('.empty').length, 1, 'der Platzhalter fehlt');
  assert.equal(info(document).textContent, 'Bereit – bitte „Heft erzeugen" klicken.');
  assert.equal(document.getElementById('generateBtn').disabled, false);

  // Einstellungen aus dem Link sind übernommen.
  assert.equal(document.getElementById('countInput').value, '1');
  assert.equal(
    document.getElementById('difficulty').querySelector('button[aria-pressed="true"]')?.dataset.level,
    'easy',
  );

  // Vor der Erzeugung gibt es noch keinen Heft-Code – auch nicht in der Adresse.
  const codeInput = document.getElementById('codeInput');
  assert.equal(codeInput.value, '');
  assert.equal(codeInput.hasAttribute('readonly'), true);
  assert.equal(window.location.hash.includes('seed='), false, 'die Adresse enthält schon einen Seed');
  assert.equal(document.getElementById('copyCodeBtn').disabled, true);
  assert.equal(document.getElementById('copyBtn').disabled, true);
  assert.equal(document.getElementById('printBtn').disabled, true, 'Drucken ist vor der Erzeugung aktiv');

  // Die frühere Auswahl «Rätsel pro Seite» gibt es nicht mehr.
  assert.equal(document.getElementById('perPage'), null, 'die Auswahl «Rätsel pro Seite» ist noch da');

  // Der Textblock «Inseln pro Rätsel» ist für die Bedienung nicht nötig.
  assert.equal(document.getElementById('islandsInfo'), null, 'der Textblock «Inseln pro Rätsel» ist noch da');
  assert.equal(document.body.textContent.includes('Inseln pro Rätsel'), false);
});

test('Jeder Knopf der Heftseite hat einen Klick-Handler', async () => {
  const { document } = await mount();

  const buttons = document.body.querySelectorAll('button');
  // 4 Stufen + 4 Anzahl + Heft + Druck + Code + Link + Laden
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

test('Ein Link mit Heft-Code wird übernommen', async () => {
  const { document, window } = await mount('#seed=ABCD-EFGH&d=easy&n=1&sol=1');
  const expected = makeBookletCode({ seed: 'ABCD-EFGH', level: 'easy', count: 1, withSolutions: true });

  assert.equal(codeValue(document), expected, 'der Code aus dem Link wird nicht angezeigt');
  assert.match(info(document).textContent, /Heft-Code aus dem Link übernommen/);
  assert.equal(document.getElementById('sheets').querySelectorAll('.bogen').length, 0);

  document.getElementById('generateBtn').click();
  await waitFor(() => !document.getElementById('generateBtn').disabled);

  assert.equal(codeValue(document), expected);
  assert.match(window.location.hash, /seed=ABCD-EFGH/);
});

test('Alte Links mit beliebigem Seed funktionieren weiter', async () => {
  const { document } = await mount('#seed=TEST&d=easy&n=1');
  const expected = makeBookletCode({ seed: 'TEST', level: 'easy', count: 1, withSolutions: true });

  // Nicht standardisierte Seeds werden im Code kodiert, bleiben aber erhalten.
  assert.match(expected, /^~/);
  assert.equal(codeValue(document), expected);

  const generateBtn = document.getElementById('generateBtn');
  generateBtn.click();
  await waitFor(() => !generateBtn.disabled);

  assert.equal(codeValue(document), expected, 'der alte Seed ging beim Erzeugen verloren');
});

test('Ein Heft-Code lädt dasselbe Heft', async () => {
  const { document, window } = await mount();
  const code = makeBookletCode({
    seed: 'ABCD-EFGH',
    level: 'medium',
    count: 2,
    withSolutions: false,
  });

  const input = document.getElementById('loadCodeInput');
  input.value = code;
  document.getElementById('loadBtn').click();

  const generateBtn = document.getElementById('generateBtn');
  await waitFor(() => !generateBtn.disabled);

  assert.equal(codeValue(document), code);
  assert.equal(document.getElementById('countInput').value, '2');
  assert.equal(document.getElementById('withSolutions').checked, false);
  assert.equal(
    document.getElementById('difficulty').querySelector('button[aria-pressed="true"]')?.dataset.level,
    'medium',
  );
  assert.match(window.location.hash, /seed=ABCD-EFGH/);
  assert.match(info(document).textContent, /Code ABCD-EFGH.M02N/);
});

test('Ein ungültiger Heft-Code wird abgelehnt', async () => {
  const { document } = await mount();

  const input = document.getElementById('loadCodeInput');
  input.value = 'KEIN-CODE';
  document.getElementById('loadBtn').click();

  assert.match(document.getElementById('loadInfo').textContent, /Ungültiger Heft-Code/);
  assert.equal(document.getElementById('sheets').querySelectorAll('.bogen').length, 0);
  assert.equal(document.getElementById('generateBtn').disabled, false);
});

test('«Heft erzeugen» baut A4-Bögen mit Faltmarke und vergibt einen Code', async () => {
  const { document, window } = await mount('#seed=ABCD-EFGH&d=easy&n=1');

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

  const expected = makeBookletCode({ seed: 'ABCD-EFGH', level: 'easy', count: 1, withSolutions: true });
  assert.equal(codeValue(document), expected);
  assert.equal(document.getElementById('copyCodeBtn').disabled, false);
  assert.equal(document.getElementById('copyBtn').disabled, false);
  assert.equal(document.getElementById('printBtn').disabled, false);

  // Jede Seite trägt ein Rätsel oder den Leer-Hinweis.
  const summary = info(document);
  assert.match(summary.textContent, /^1 Rätsel · \d+ Inseln · Ziel „Leicht"/);
  assert.match(summary.textContent, /4 Seiten A5/);
  assert.match(summary.textContent, /1 A4-Bogen beidseitig/);
  assert.match(summary.textContent, new RegExp(`Code ${expected}`));

  assert.match(window.location.hash, /(^#|&)d=easy(&|$)/);
  assert.equal(window.location.hash.includes('per='), false, 'die Adresse enthält noch «per»');
  assert.equal(generateBtn.textContent.includes('Heft erzeugen'), true);
});

test('Jedes neu erzeugte Heft erhält einen neuen Code', async () => {
  const { document } = await mount();

  const generateBtn = document.getElementById('generateBtn');
  generateBtn.click();
  await waitFor(() => !generateBtn.disabled);
  const first = codeValue(document);

  generateBtn.click();
  await waitFor(() => !generateBtn.disabled);
  const second = codeValue(document);

  assert.match(first, /^[A-Z2-9]{4}-[A-Z2-9]{4}\.[EMHX][0-9A-Z]{2}[SN]$/);
  assert.match(second, /^[A-Z2-9]{4}-[A-Z2-9]{4}\.[EMHX][0-9A-Z]{2}[SN]$/);
  assert.notEqual(second, first, 'beim zweiten Erzeugen wurde derselbe Code vergeben');
});

test('«Drucken», «Code» und «Link» arbeiten nach der Erzeugung', async () => {
  const { document, window } = await mount('#seed=ABCD-EFGH&d=easy&n=1');

  const generateBtn = document.getElementById('generateBtn');
  generateBtn.click();
  await waitFor(() => !generateBtn.disabled);

  document.getElementById('printBtn').click();
  assert.equal(window.printCalls, 1, 'window.print wurde nicht aufgerufen');

  document.getElementById('copyCodeBtn').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(info(document).textContent, /Heft-Code .* kopiert/);

  document.getElementById('copyBtn').click();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(info(document).textContent, 'Link in die Zwischenablage kopiert.');
});

test('Die Bögen stehen in Heft-Reihenfolge', async () => {
  const { document } = await mount('#seed=ABCD-EFGH&d=easy&n=2');

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

test('Ein Link ohne Lösungen reproduziert das Heft ohne Lösungsseiten', async () => {
  const { document, window } = await mount('#seed=ABCD-EFGH&d=easy&n=1&sol=0');
  const expected = makeBookletCode({ seed: 'ABCD-EFGH', level: 'easy', count: 1, withSolutions: false });

  assert.equal(document.getElementById('withSolutions').checked, false);
  assert.equal(codeValue(document), expected);

  const generateBtn = document.getElementById('generateBtn');
  generateBtn.click();
  await waitFor(() => !generateBtn.disabled);

  assert.equal(document.getElementById('sheets').querySelectorAll('.mini').length, 1);
  assert.match(window.location.hash, /sol=0/);
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
  assert.match(codeValue(document), /S$/);

  checkbox.checked = false;
  checkbox.dispatchEvent(makeEvent('change', checkbox));
  assert.equal(miniCount(), 1, 'die Lösungsseite wurde nicht entfernt');
  assert.equal(info(document).textContent.includes('Lösungsseiten'), false);
  assert.match(codeValue(document), /N$/);

  checkbox.checked = true;
  checkbox.dispatchEvent(makeEvent('change', checkbox));
  assert.equal(miniCount(), 2, 'die Lösungsseite kam nicht zurück');
  assert.match(codeValue(document), /S$/);
});
