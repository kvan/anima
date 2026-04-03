#!/usr/bin/env node
/**
 * scripts/sprite-gen.js — Pixel art spritesheet generator
 * Zero dependencies — Node.js built-ins only (zlib, fs)
 *
 * Each sprite is a 64×16 PNG (4 frames × 16×16 px).
 * Rendered at 2.5× in the app (40×40px display).
 *
 * Usage:
 *   node scripts/sprite-gen.js              → write PNGs to sprites/
 *   node scripts/sprite-gen.js --update     → also patch SPRITE_DATA in src/app.js
 *
 * To add a new animal:
 *   1. Define a palette object  (char → [r,g,b,a])
 *   2. Define 4 frames          (array of 16 strings × 16 chars each)
 *   3. Add entry to SPRITES     ({ name, palette, frames })
 *   4. Add name to ANIMALS array in src/app.js
 */

import { deflateSync } from 'zlib';
import { writeFileSync, readFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT  = resolve(ROOT, 'sprites');

// ── CRC32 (required by PNG spec) ───────────────────────────────────────────

const CRC_TABLE = new Uint32Array(256);
for (let i = 0; i < 256; i++) {
  let c = i;
  for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  CRC_TABLE[i] = c;
}
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ── PNG encoder ────────────────────────────────────────────────────────────

function encodePNG(width, height, rgba) {
  function chunk(type, data) {
    const t = Buffer.from(type, 'ascii');
    const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const len = Buffer.allocUnsafe(4); len.writeUInt32BE(d.length);
    const crcBuf = Buffer.allocUnsafe(4);
    crcBuf.writeUInt32BE(crc32(Buffer.concat([t, d])));
    return Buffer.concat([len, t, d, crcBuf]);
  }

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = ihdr[11] = ihdr[12] = 0; // 8-bit RGBA

  // Scanlines: 1 filter byte (0=None) + width×4 bytes per row
  const raw = Buffer.allocUnsafe(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    for (let x = 0; x < width; x++) {
      const s = (y * width + x) * 4;
      const d = y * (1 + width * 4) + 1 + x * 4;
      raw[d] = rgba[s]; raw[d+1] = rgba[s+1]; raw[d+2] = rgba[s+2]; raw[d+3] = rgba[s+3];
    }
  }

  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]), // PNG signature
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Spritesheet renderer ───────────────────────────────────────────────────
// frames: array of 4 items, each an array of 16 strings (16 chars each)
// palette: { char: [r,g,b,a] }  — '.' is always transparent

function renderSheet(frames, palette) {
  const W = 64, H = 16, FW = 16;
  const buf = new Uint8Array(W * H * 4); // defaults to all-zero (transparent)

  for (let f = 0; f < 4; f++) {
    for (let y = 0; y < H; y++) {
      const row = (frames[f] && frames[f][y]) || '';
      for (let x = 0; x < FW; x++) {
        const ch = row[x] || '.';
        const c  = palette[ch] || [0,0,0,0];
        const i  = (y * W + f * FW + x) * 4;
        buf[i] = c[0]; buf[i+1] = c[1]; buf[i+2] = c[2]; buf[i+3] = c[3] ?? 255;
      }
    }
  }
  return buf;
}

// ── mirrorLeft ─────────────────────────────────────────────────────────────
// Define only the left 8 columns of each row — this mirrors them to the right.
// Bilateral symmetry is the single best trick for making sprites look intentional.
//
// Usage: wrap your frame definitions with mirrorLeft()
//   const FROG_F1 = mirrorLeft([
//     '........',   // only 8 chars needed
//     '...GG...',
//     ...
//   ]);

function mirrorLeft(frame) {
  return frame.map(row => {
    const left = (row + '................').slice(0, 8); // pad to 8 if shorter
    return left + [...left].reverse().join('');
  });
}

// ── recolor ────────────────────────────────────────────────────────────────
// Swap palette characters in frames to create color variants.
// charMap: { oldChar: newChar } — e.g. { 'G': 'R', 'g': 'r' }
//
// Usage:
//   const RED_FROG_PAL = { ...FROG_PAL, 'R': hex('#cc3333'), 'r': hex('#882222') };
//   const RED_FROG = recolor([FROG_F1, FROG_F2, FROG_F3, FROG_F4], { G: 'R', g: 'r' });
//   SPRITES.push({ name: 'frog-red', palette: RED_FROG_PAL, frames: RED_FROG });

function recolor(frames, charMap) {
  return frames.map(frame =>
    frame.map(row => [...row].map(ch => charMap[ch] ?? ch).join(''))
  );
}

// ── Palette helper ─────────────────────────────────────────────────────────

const hex = (h, a = 255) => [
  parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16), a
];

// ── FROG ───────────────────────────────────────────────────────────────────
// Side-view frog. Simple hop cycle.

const FROG_PAL = {
  '.': [0,0,0,0],
  'G': hex('#72d87a'),   // frog green (body) — boosted lum ~0.52 to pop on dark bg
  'g': hex('#2e7a35'),   // dark green (outline / shadow) — kept dark for contrast
  'B': hex('#111111'),   // black (pupil)
  'W': hex('#f4fff6'),   // eye white — near-pure white for eye pop
  'Y': hex('#dff080'),   // yellow-green (belly) — brighter highlight lum ~0.58
  'o': hex('#e8a040'),   // orange (mouth line)
};

const FROG_F1 = [ // sitting, neutral
  '................',
  '................',
  '.....gGGGGg.....',
  '....gGWBGWBGg...',
  '....gGGGGGGGg...',
  '....GGGGGGGGg...',
  '....GoooooooG...',
  '....GYYYYYYYYG..',
  '....GYYYYYYYYG..',
  '....GgGGGGGgG...',
  '...gG........Gg.',
  '..gGG........GGg',
  '.gGGg........gGG',
  '................',
  '................',
  '................',
];
const FROG_F2 = [ // step — left leg forward
  '................',
  '................',
  '.....gGGGGg.....',
  '....gGWBGWBGg...',
  '....gGGGGGGGg...',
  '....GGGGGGGGg...',
  '....GoooooooG...',
  '....GYYYYYYYYG..',
  '....GYYYYYYYYG..',
  '....GgGGGGGgG...',
  '...gG........Gg.',
  '..gGGg......gGGg',
  '.gGGGg......GGG.',
  '..gG.........Gg.',
  '................',
  '................',
];
const FROG_F3 = [ // mid-hop — body lifted
  '................',
  '.....gGGGGg.....',
  '....gGWBGWBGg...',
  '....gGGGGGGGg...',
  '....GGGGGGGGg...',
  '....GoooooooG...',
  '....GYYYYYYYYG..',
  '....GYYYYYYYYG..',
  '....GgGGGGGgG...',
  '...gG........Gg.',
  '..gGGg......gGG.',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const FROG_F4 = [ // step — right leg forward
  '................',
  '................',
  '.....gGGGGg.....',
  '....gGWBGWBGg...',
  '....gGGGGGGGg...',
  '....GGGGGGGGg...',
  '....GoooooooG...',
  '....GYYYYYYYYG..',
  '....GYYYYYYYYG..',
  '....GgGGGGGgG...',
  '.gG........Gg...',
  'gGGg......gGGg..',
  '.GGG......gGGGg.',
  '.Gg.........gG..',
  '................',
  '................',
];

// ── WHALE ──────────────────────────────────────────────────────────────────
// Side-view whale. Tail-wave swim cycle.

const WHALE_PAL = {
  '.': [0,0,0,0],
  'B': hex('#5090cc'),   // blue body — boosted lum ~0.24 (was 0.16) for dark bg pop
  'b': hex('#2a5080'),   // dark blue (outline / shadow) — kept dark for contrast
  'W': hex('#eef8ff'),   // white belly — near-pure white
  'E': hex('#111111'),   // eye
  'e': hex('#eef8ff'),   // eye white
  'S': hex('#99d8ff'),   // spout water — slightly brighter
  'T': hex('#5aa0d8'),   // tail fins — slightly brighter to match body boost
};

const WHALE_F1 = [ // tail level
  '................',
  '................',
  '..........S.....',
  '.........SS.....',
  '....bBBBBBBBBb..',
  '...bBBBBBBBBBBBT',
  '..bBBBeEBBBWWBBT',
  '..bBBBBBBBBWWBbT',
  '...bBBBBBBBBBBBT',
  '....bBBBBBBBBb..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const WHALE_F2 = [ // tail slightly up
  '................',
  '................',
  '..........S.....',
  '.........SS.....',
  '....bBBBBBBBBb..',
  '...bBBBBBBBBBBBb',
  '..bBBBeEBBBWWBBBT',
  '..bBBBBBBBBWWBBT',
  '...bBBBBBBBBBBT.',
  '....bBBBBBBBb...',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const WHALE_F3 = [ // tail up, spout
  '................',
  '.........SSS....',
  '..........SS....',
  '................',
  '....bBBBBBBBBb..',
  '...bBBBBBBBBBBBb',
  '..bBBBeEBBBWWBBb',
  '..bBBBBBBBBWWBBbT',
  '...bBBBBBBBBBBbT',
  '....bBBBBBBBbT..',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................',
];
const WHALE_F4 = [ // tail down
  '................',
  '................',
  '..........S.....',
  '.........SS.....',
  '....bBBBBBBBBb..',
  '...bBBBBBBBBBBBT',
  '..bBBBeEBBBWWBBT',
  '..bBBBBBBBBWWBbT',
  '...bBBBBBBBBBBBT',
  '....bBBBBBBBBb.T',
  '.............T..',
  '................',
  '................',
  '................',
  '................',
  '................',
];

// ── DRAGON ─────────────────────────────────────────────────────────────────
// Front-facing companion dragon. Vexil.
// Frames: idle-a, idle-b (slight breath), thinking (eyes narrow), alert (mouth open).

const DRAGON_PAL = {
  '.': [0,0,0,0],
  'R': hex('#FF4422'),  // red-orange body
  'r': hex('#AA1100'),  // dark red outline
  'Y': hex('#FFE044'),  // yellow belly / highlights
  'O': hex('#FF8822'),  // orange wing membrane
  'W': hex('#F0F0C8'),  // eye white
  'B': hex('#141414'),  // eye pupil
  'H': hex('#CCAA22'),  // horn gold
  'h': hex('#887700'),  // horn shadow
};

const DRAGON_F1 = [ // idle-a: wings resting, eyes open
  '................',
  '....H......H....',
  '....Rr....rR....',
  '...rRRRRRRRRr...',
  '..rRRWBRRBWRRr..',
  '..rRRRRRRRRRRr..',
  '..rRYYYYYYYRRr..',
  '...rRRYYYRRr....',
  '....rRRRRRr.....',
  '...OOrRRrROO....',
  '..OOrRRRRrROO...',
  '.OOrRRRRRRrROO..',
  '...rRRRRRRRr....',
  '....rR....Rr....',
  '....rr....rr....',
  '................',
];
const DRAGON_F2 = [ // idle-b: very slight breath (wings out 1px)
  '................',
  '....H......H....',
  '....Rr....rR....',
  '...rRRRRRRRRr...',
  '..rRRWBRRBWRRr..',
  '..rRRRRRRRRRRr..',
  '..rRYYYYYYYRRr..',
  '...rRRYYYRRr....',
  '....rRRRRRr.....',
  '..OOOrRRrROOO...',  // wings wider
  '.OOOrRRRRrROOO..',
  'OOOrRRRRRRrROOO.',  // body slightly expanded
  '...rRRRRRRRr....',
  '....rR....Rr....',
  '....rr....rr....',
  '................',
];
const DRAGON_F3 = [ // thinking: eyes narrowed to slits
  '................',
  '....H......H....',
  '....Rr....rR....',
  '...rRRRRRRRRr...',
  '..rRRYYRRRYYRr..',  // slitted eyes (Y = squint)
  '..rRRRRRRRRRRr..',
  '..rRYYYYYYYRRr..',
  '...rRRYYYRRr....',
  '....rRRRRRr.....',
  '...OOrRRrROO....',
  '..OOrRRRRrROO...',
  '.OOrRRRRRRrROO..',
  '...rRRRRRRRr....',
  '....rR....Rr....',
  '....rr....rr....',
  '................',
];
const DRAGON_F4 = [ // alert: mouth open, eyes wide
  '................',
  '....H......H....',
  '....Rr....rR....',
  '...rRRRRRRRRr...',
  '..rRRWBRRBWRRr..',  // eyes wide
  '..rRRRRRRRRRRr..',
  '..rRYYYYYYYRRr..',
  '...rRYr..rYRr...',  // mouth open (gap)
  '....rRRrrRRr....',  // lower jaw
  '...OOrRRrROO....',
  '..OOrRRRRrROO...',
  '.OOrRRRRRRrROO..',
  '...rRRRRRRRr....',
  '....rR....Rr....',
  '....rr....rr....',
  '................',
];

// ── Sprite registry ────────────────────────────────────────────────────────

const SPRITES = [
  { name: 'frog',   palette: FROG_PAL,   frames: [FROG_F1,   FROG_F2,   FROG_F3,   FROG_F4]   },
  { name: 'whale',  palette: WHALE_PAL,  frames: [WHALE_F1,  WHALE_F2,  WHALE_F3,  WHALE_F4]  },
  { name: 'dragon', palette: DRAGON_PAL, frames: [DRAGON_F1, DRAGON_F2, DRAGON_F3, DRAGON_F4] },
];

// ── Generate ───────────────────────────────────────────────────────────────

mkdirSync(OUT, { recursive: true });

const update = process.argv.includes('--update');
const generated = {};

for (const { name, palette, frames } of SPRITES) {
  const rgba = renderSheet(frames, palette);
  const png  = encodePNG(64, 16, rgba);
  const outPath = resolve(OUT, `${name}.png`);
  writeFileSync(outPath, png);
  generated[name] = png.toString('base64');
  console.log(`✓ sprites/${name}.png`);
}

if (update) {
  // Search both files — SPRITE_DATA may live in app.js or session.js
  const candidates = ['src/app.js', 'src/session.js'];
  let updateErrors = [];

  for (const [name, b64] of Object.entries(generated)) {
    const expectedLen = b64.length;
    let patched = false;

    for (const rel of candidates) {
      const filePath = resolve(ROOT, rel);
      let src;
      try { src = readFileSync(filePath, 'utf8'); } catch { continue; }

      const re = new RegExp(`('${name}'\\s*:\\s*'data:image/png;base64,)[^']*(')`);
      if (!re.test(src)) continue;

      const updated = src.replace(re, `$1${b64}$2`);

      // Verify the replacement landed correctly
      const verifyRe = new RegExp(`'${name}'\\s*:\\s*'data:image/png;base64,([^']*)'`);
      const match = updated.match(verifyRe);
      if (!match || match[1].length !== expectedLen) {
        updateErrors.push(`${name} in ${rel}: verify failed (got ${match?.[1]?.length ?? 0}, expected ${expectedLen})`);
        continue;
      }

      writeFileSync(filePath, updated);
      console.log(`✓ updated ${name} in ${rel} (${expectedLen} chars)`);
      patched = true;
      break;
    }

    if (!patched && !updateErrors.length) {
      console.error(`✗ ${name}: not found in ${candidates.join(' or ')} — add SPRITE_DATA entry manually`);
      updateErrors.push(name);
    }
  }

  if (updateErrors.length) {
    console.error(`\n⚠ ${updateErrors.length} update(s) failed — check entries above`);
    process.exit(1);
  }
}

console.log('\nDone. To add to app.js:');
console.log('  1. node scripts/sprite-gen.js --update  (patches existing entries)');
console.log('  2. Or add new names to SPRITE_DATA + ANIMALS array manually.');
