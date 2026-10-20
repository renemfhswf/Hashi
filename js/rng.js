/**
 * Deterministischer Zufallsgenerator.
 *
 * Kombiniert xmur3 (Seed -> 32-Bit-Startwert) mit mulberry32 (PRNG).
 * Dadurch ist jedes Rätsel über seinen Seed exakt reproduzierbar –
 * Grundlage für "Seed teilen" und für die Tests.
 */

/** Erzeugt eine 32-Bit-Seedfunktion aus einem beliebigen String. */
export function hashSeed(str) {
  let h = 1779033703 ^ String(str).length;
  for (let i = 0; i < String(str).length; i++) {
    h = Math.imul(h ^ String(str).charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

/** Schneller, gleichverteilter 32-Bit-PRNG. Gibt Float in [0, 1). */
export function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = 'hashi') {
    this.seed = String(seed);
    this._next = mulberry32(hashSeed(this.seed)());
  }

  /** Zufallszahl in [0, 1). */
  float() {
    return this._next();
  }

  /** Ganzzahl in [0, maxExclusive). */
  int(maxExclusive) {
    return Math.floor(this._next() * maxExclusive);
  }

  /** Ganzzahl in [min, max] (einschließlich). */
  range(min, max) {
    return min + this.int(max - min + 1);
  }

  /** Zufälliges Element aus einem Array. */
  pick(arr) {
    return arr[this.int(arr.length)];
  }

  /** Wahrheitswert mit Wahrscheinlichkeit p. */
  chance(p) {
    return this._next() < p;
  }

  /** Fisher-Yates-Shuffle (in place). */
  shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  /** Gewichtete Zufallsauswahl. `weights` hat dieselbe Länge wie `items`. */
  pickWeighted(items, weights) {
    let total = 0;
    for (const w of weights) total += w;
    if (total <= 0) return this.pick(items);
    let r = this._next() * total;
    for (let i = 0; i < items.length; i++) {
      r -= weights[i];
      if (r <= 0) return items[i];
    }
    return items[items.length - 1];
  }
}

/** Erzeugt einen lesbaren, zufälligen Seed (z. B. "K4F-92QX"). */
export function randomSeed() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(8);
  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i % 4 === 3 && i !== bytes.length - 1) out += '-';
  }
  return out;
}
