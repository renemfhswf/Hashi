/**
 * Heft-Code für das Rätselheft.
 *
 * Der Code beschreibt ein vollständiges Heft – Seed, Schwierigkeit, Anzahl
 * der Rätsel und ob Lösungsseiten angehängt sind. Dadurch lässt sich ein Heft
 * allein über seinen Code wiederherstellen.
 *
 * Format: <seed>.<stufe><anzahl><lösungen>
 *
 *   K4F9-2QXZ.M08S
 *   │        │││└─ S = mit Lösungen, N = ohne
 *   │        ││└── Anzahl in Basis 36, zweistellig (01 … 2S)
 *   │        │└─── Stufe: E = leicht, M = mittel, H = schwer, X = experte
 *   │        └──── Trenner
 *   └───────────── Seed (8 Zeichen, z. B. K4F9-2QXZ)
 *
 * Seeds, die nicht dem Standardformat entsprechen (z. B. aus alten Links),
 * werden base64url-kodiert und mit «~» eingeleitet. Auch damit bleibt ein
 * Heft über seinen Code reproduzierbar.
 */

const LEVEL_TO_CODE = { easy: 'E', medium: 'M', hard: 'H', expert: 'X' };
const CODE_TO_LEVEL = { E: 'easy', M: 'medium', H: 'hard', X: 'expert' };

const STANDARD_SEED = /^[A-Z2-9]{4}-[A-Z2-9]{4}$/;
const CODE_PATTERN = /^(.*)\.([EMHX])([0-9A-Z]{2})([SN])$/i;

/** Kodiert den Seed für den Code (Standardformat bleibt lesbar). */
function encodeSeed(seed) {
  const text = String(seed ?? '');
  // Nur exakt grossgeschriebene Standard-Seeds bleiben lesbar. Bei allem
  // anderen – auch bei alten Kleinschreibungen – würde die Schreibweise
  // verloren gehen, deshalb wird es kodiert.
  if (STANDARD_SEED.test(text)) return text;

  const bytes = new TextEncoder().encode(text);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const base64 = btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `~${base64}`;
}

/** Liest den Seed aus einem Code zurück. */
function decodeSeed(part) {
  if (!part.startsWith('~')) {
    const upper = part.toUpperCase();
    return STANDARD_SEED.test(upper) ? upper : null;
  }

  try {
    const base64 = part.slice(1).replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

/**
 * Baut den Heft-Code.
 *
 * @param {{seed:string, level:string, count:number, withSolutions:boolean}} booklet
 * @returns {string}
 */
export function makeBookletCode({ seed, level, count, withSolutions = true }) {
  const levelCode = LEVEL_TO_CODE[level];
  if (!levelCode) throw new Error(`Unbekannte Schwierigkeit: ${level}`);

  const n = Math.round(Number(count));
  if (!Number.isFinite(n) || n < 1 || n > 100) {
    throw new Error(`Ungültige Anzahl Rätsel: ${count}`);
  }

  if (seed == null || String(seed).length === 0) throw new Error('Ungültiger Seed');
  const seedPart = encodeSeed(seed);
  if (!seedPart) throw new Error('Ungültiger Seed');

  const countCode = n.toString(36).toUpperCase().padStart(2, '0');
  return `${seedPart}.${levelCode}${countCode}${withSolutions ? 'S' : 'N'}`;
}

/**
 * Liest einen Heft-Code.
 *
 * @param {string} input
 * @returns {{seed:string, level:string, count:number, withSolutions:boolean}|null}
 */
export function parseBookletCode(input) {
  const match = CODE_PATTERN.exec(String(input ?? '').trim());
  if (!match) return null;

  const seed = decodeSeed(match[1]);
  if (!seed) return null;

  const level = CODE_TO_LEVEL[match[2].toUpperCase()];
  if (!level) return null;

  const count = parseInt(match[3], 36);
  if (!Number.isFinite(count) || count < 1 || count > 100) return null;

  return {
    seed,
    level,
    count,
    withSolutions: match[4].toUpperCase() === 'S',
  };
}
