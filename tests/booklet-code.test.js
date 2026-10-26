import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { makeBookletCode, parseBookletCode } from '../js/booklet-code.js';

describe('Heft-Code', () => {
  test('Standard-Seed ergibt einen lesbaren Code', () => {
    assert.equal(
      makeBookletCode({ seed: 'K4F9-2QXZ', level: 'medium', count: 8, withSolutions: true }),
      'K4F9-2QXZ.M08S',
    );
  });

  test('der Code lässt sich wieder vollständig lesen', () => {
    for (const level of ['easy', 'medium', 'hard', 'expert']) {
      for (const count of [1, 8, 20, 50, 100]) {
        for (const withSolutions of [true, false]) {
          const booklet = { seed: 'ABCD-EFGH', level, count, withSolutions };
          assert.deepEqual(parseBookletCode(makeBookletCode(booklet)), booklet);
        }
      }
    }
  });

  test('Kleinbuchstaben und Leerzeichen werden toleriert', () => {
    assert.deepEqual(parseBookletCode('  abcd-efgh.m08s  '), {
      seed: 'ABCD-EFGH',
      level: 'medium',
      count: 8,
      withSolutions: true,
    });
  });

  test('alte oder eigene Seeds werden kodiert und bleiben erhalten', () => {
    const booklet = { seed: 'Mein eigener Seed', level: 'hard', count: 20, withSolutions: false };
    const code = makeBookletCode(booklet);
    assert.match(code, /^~/);
    assert.deepEqual(parseBookletCode(code), booklet);
  });

  test('auch die Schreibweise eines Seeds bleibt erhalten', () => {
    const booklet = { seed: 'abcd-efgh', level: 'easy', count: 1, withSolutions: true };
    const code = makeBookletCode(booklet);
    assert.match(code, /^~/);
    assert.deepEqual(parseBookletCode(code), booklet);
  });

  test('ungültige Codes werden abgelehnt', () => {
    for (const code of ['', 'K4F9-2QXZ', 'K4F9-2QXZ.M08', 'K4F9-2QXZ.Y08S', 'K4F9-2QXZ.M00S', 'K4F9-2QXZ.MZZS']) {
      assert.equal(parseBookletCode(code), null, `Code "${code}" hätte abgelehnt werden müssen`);
    }
  });

  test('ungültige Heft-Daten lassen sich nicht kodieren', () => {
    assert.throws(() => makeBookletCode({ seed: 'ABCD-EFGH', level: 'unbekannt', count: 8 }));
    assert.throws(() => makeBookletCode({ seed: 'ABCD-EFGH', level: 'easy', count: 0 }));
    assert.throws(() => makeBookletCode({ seed: 'ABCD-EFGH', level: 'easy', count: 101 }));
    assert.throws(() => makeBookletCode({ seed: '', level: 'easy', count: 8 }));
  });
});
