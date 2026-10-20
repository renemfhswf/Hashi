import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RNG, hashSeed, mulberry32, randomSeed } from '../js/rng.js';

describe('RNG', () => {
  test('gleicher Seed erzeugt identische Folgen', () => {
    const a = new RNG('HASHI-1');
    const b = new RNG('HASHI-1');
    const seqA = Array.from({ length: 20 }, () => a.float());
    const seqB = Array.from({ length: 20 }, () => b.float());
    assert.deepEqual(seqA, seqB);
  });

  test('verschiedene Seeds erzeugen verschiedene Folgen', () => {
    const a = new RNG('A');
    const b = new RNG('B');
    assert.notDeepEqual(
      Array.from({ length: 10 }, () => a.float()),
      Array.from({ length: 10 }, () => b.float()),
    );
  });

  test('float() liefert Werte in [0, 1)', () => {
    const rng = new RNG('range');
    for (let i = 0; i < 2000; i++) {
      const v = rng.float();
      assert.ok(v >= 0 && v < 1, `Wert ausserhalb: ${v}`);
    }
  });

  test('int(max) liefert ganze Zahlen in [0, max)', () => {
    const rng = new RNG('ints');
    for (let i = 0; i < 2000; i++) {
      const v = rng.int(7);
      assert.ok(Number.isInteger(v) && v >= 0 && v < 7, `Wert ausserhalb: ${v}`);
    }
  });

  test('range(min, max) schliesst beide Grenzen ein', () => {
    const rng = new RNG('range2');
    const seen = new Set();
    for (let i = 0; i < 5000; i++) {
      const v = rng.range(3, 6);
      assert.ok(v >= 3 && v <= 6);
      seen.add(v);
    }
    assert.deepEqual([...seen].sort(), [3, 4, 5, 6]);
  });

  test('pick() wählt nur vorhandene Elemente', () => {
    const rng = new RNG('pick');
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 200; i++) {
      assert.ok(items.includes(rng.pick(items)));
    }
  });

  test('chance() respektiert die Wahrscheinlichkeit ungefähr', () => {
    const rng = new RNG('chance');
    let hits = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) if (rng.chance(0.25)) hits++;
    assert.ok(Math.abs(hits / N - 0.25) < 0.03, `Trefferquote ${hits / N}`);
  });

  test('shuffle() vertauscht die Reihenfolge, behält aber alle Elemente', () => {
    const rng = new RNG('shuffle');
    const input = Array.from({ length: 40 }, (_, i) => i);
    const out = rng.shuffle([...input]);
    assert.equal(out.length, input.length);
    assert.deepEqual([...out].sort((a, b) => a - b), input);
    assert.notDeepEqual(out, input);
  });

  test('pickWeighted() bevorzugt schwer gewichtete Einträge', () => {
    const rng = new RNG('weighted');
    let heavy = 0;
    for (let i = 0; i < 5000; i++) {
      if (rng.pickWeighted(['a', 'b'], [9, 1]) === 'a') heavy++;
    }
    assert.ok(heavy > 4000, `schwere Auswahl zu selten: ${heavy}`);
  });

  test('hashSeed ist deterministisch und liefert 32-Bit-Werte', () => {
    const h1 = hashSeed('abc');
    const h2 = hashSeed('abc');
    assert.equal(h1(), h2());
    assert.ok(Number.isInteger(h1()) && h1() >= 0 && h1() <= 0xffffffff);
  });

  test('mulberry32 bleibt im Bereich [0, 1)', () => {
    const next = mulberry32(12345);
    for (let i = 0; i < 1000; i++) {
      const v = next();
      assert.ok(v >= 0 && v < 1);
    }
  });

  test('randomSeed() erzeugt lesbare, unterschiedliche Seeds', () => {
    const a = randomSeed();
    const b = randomSeed();
    assert.match(a, /^[A-Z0-9-]{8,9}$/);
    assert.notEqual(a, b);
  });
});
