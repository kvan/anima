# Buddy System — Architecture Reference

How pixel-terminal's companion identity works: where data comes from, how it flows, what each file owns.

---

## Overview

The companion has two independent data sources:

- **Soul** — name + personality. Set by Claude's LLM at first hatch. Lives in `~/.claude.json` under `companion.name` and `companion.personality`.
- **Bones** — species, rarity, stats, cosmetics. Deterministically computed from the account UUID using Bun's wyhash + Mulberry32 PRNG. Same UUID always produces same roll.

pixel-terminal reads both and merges them into `~/.config/pixel-terminal/buddy.json`.

---

## Claude Code Buddy Algorithm

### Input
- `uuid` — from `~/.claude.json`: `oauthAccount.accountUuid` or `userID`
- `salt` — hardcoded: `"friend-2026-401"`

### Hash
```
seed = Number(BigInt(Bun.hash(uuid + salt)) & 0xFFFFFFFFn) >>> 0
```
`Bun.hash()` uses wyhash. This is NOT the same as FNV-1a — they produce different seeds for identical UUIDs.

### PRNG
Mulberry32 seeded from `seed`:
```ts
function mulberry32(seed: number) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

### Roll Sequence (ORDER IS CRITICAL — changing any early roll cascades all subsequent)

| Roll # | What | How |
|--------|------|-----|
| 1 | Rarity | Weighted: Common 60% / Uncommon 25% / Rare 10% / Epic 4% / Legendary 1% |
| 2 | Species | Uniform 1/18 across 18 species |
| 3 | Eyes | Uniform 1/6 |
| 4 | Hat | Common always `none`; others uniform 1/8 |
| 5 | Shiny | Independent 1% boolean |
| 6 | Peak stat index | Uniform 1/5 |
| 7 | Dump stat index | Uniform 1/4, skip if >= peak |
| 8–12 | 5 stat values | Per rarity floor/peak/dump ranges (0-100 scale) |

### Stat Normalization
Claude Code's scale is 0–100. pixel-terminal uses 1–10:
```
normalized = Math.max(1, Math.min(10, Math.round(raw / 10)))
```

### Rarity Stat Ranges

| Rarity | Floor | Peak range | Dump range |
|--------|-------|------------|------------|
| Common | 5 | 55–84 | 1–19 |
| Uncommon | 15 | 65–94 | 5–29 |
| Rare | 25 | 75–100 | 15–39 |
| Epic | 35 | 85–100 | 25–49 |
| Legendary | 50 | 100 | 40–64 |

### Voice Derivation (from normalized stats)
```
snark >= 7         → sarcastic
chaos >= 7         → excitable
wisdom >= 7
  && snark < 5     → measured
debugging >= 8     → technical
patience <= 3      → impatient
else               → default
```

---

## Species List (18 real + extras)

The 18 species Claude Code rolls from:
`duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk`

pixel-terminal has pixel art for: `dragon, cat, rabbit, penguin, frog, octopus`

Everything else uses a sprite fallback from `BUDDY_SPRITE_MAP` in `companion.js`. Fallback logic: shape/family similarity (e.g. duck → penguin, blob → octopus, ghost → cat2).

---

## buddy.json Schema

```json
{
  "name": "string",             // from soul (Claude LLM)
  "personality": "string",      // from soul, 1-3 sentence descriptor
  "species": "string",          // from bones (wyhash roll)
  "rarity": "string",           // from bones
  "eyes": "string",             // from bones (cosmetic, not surfaced in UI yet)
  "hat": "string",              // from bones (cosmetic, not surfaced in UI yet)
  "shiny": "boolean",           // from bones (cosmetic, not surfaced in UI yet)
  "stats": {
    "debugging": 1-10,
    "patience": 1-10,
    "chaos": 1-10,
    "wisdom": 1-10,
    "snark": 1-10
  },
  "voice": "string",            // derived from stats
  "hue": "#RRGGBB",             // species color accent
  "syncedFrom": "claude-code",  // guard: prevents FNV-1a overwrite in companion.js
  "syncedAt": <hatchedAt>,      // staleness guard: skips re-roll if unchanged
  "seed": <number>,             // from original generate-buddy.js (preserved)
  "companionSeed": <number>,    // from original generate-buddy.js (preserved)
  "generated": <timestamp>      // from original generate-buddy.js (preserved)
}
```

**Write owners:**
- `scripts/sync_real_buddy.ts` — all fields except `seed`, `companionSeed`, `generated`
- `src/companion.js` `initCompanion()` — species + save only when `syncedFrom !== 'claude-code'`
- `scripts/generate-buddy.js` — first-time init only, creates the file if it doesn't exist

---

## Sync Pipeline

`launch.command` runs this at startup before `vexil_master.py`:
```bash
bun run "$(dirname "$0")/scripts/sync_real_buddy.ts" >> "$LOG_FILE" 2>&1 || true
```

`sync_real_buddy.ts` flow:
1. Read `~/.claude.json` → extract `uuid`, `soul.name`, `soul.personality`, `hatchedAt`
2. Staleness check: if `existing.syncedAt === hatchedAt && existing.syncedFrom === 'claude-code'` → exit 0 (no work)
3. `rollBones(uuid)` → rarity, species, eyes, hat, shiny, stats
4. `deriveVoice(stats)` → voice string
5. Merge over existing buddy.json (preserving `seed`, `generated`, `companionSeed`)
6. Write back with `syncedFrom: 'claude-code'` and `syncedAt: hatchedAt`

Expected output (Bradley's account):
```
[sync-buddy] synced → Vexil (duck, Common, impatient)
```

---

## FNV-1a vs wyhash Divergence

`companion.js`'s `deriveBuddySpecies()` function uses FNV-1a for its UUID hash. Claude Code uses `Bun.hash()` (wyhash). These produce different seeds for the same UUID, resulting in different species rolls.

**Resolution**: `sync_real_buddy.ts` runs first at launch and sets `syncedFrom: 'claude-code'`. `initCompanion()` checks this flag and skips `deriveBuddySpecies()` entirely when it's set. wyhash result is canonical.

---

## Dynamic Companion Identity

The companion name is NOT hardcoded anywhere in the JS layer. All trigger detection and UI labels derive from `buddy.json` at runtime:

- `companion.js` exports `getBuddyTrigger()` → returns `(buddy.name.toLowerCase()) + ' '`
- `events.js` and `session-lifecycle.js` call `getBuddyTrigger()` for all trigger comparisons
- Tab label in `#vexil-tab-btn` is set from `buddy.name.toUpperCase()` in `initCompanion()`
- `#vexil-bio` header shows `name · rarity species`

- `vexil_master.py` calls `load_buddy()` and `build_persona()` on each invocation — name and species injected dynamically into the Claude `-p` system prompt

---

## Consumer Summary

| Consumer | What it reads | How |
|----------|--------------|-----|
| `companion.js` | species (sprite map), name (tab label, trigger, bio), rarity, personality, voice (button labels), hue | `loadBuddy()` at init |
| `vexil_master.py` | name, species | `load_buddy()` on each call |
| `memory_lint.py` | species (context in lint messages) | reads buddy.json dynamically |
| `CLAUDE.md` (pixel-terminal) | name, species | instructs Claude to read from buddy.json |

---

## Key Findings

1. **"Vexil" is canonical** — came from Claude's LLM soul on first hatch. It's not a random pool name.
2. **wyhash ≠ FNV-1a** — the two hash functions diverge. Never use FNV-1a to reproduce Claude Code's species roll.
3. **Common buddies can't wear hats** — hat roll is forced to `none` for Common rarity. This is hardcoded in the roll sequence.
4. **Personality is truncated to 140 chars** in the `#vexil-bio` panel to keep the bio readable.
5. **22 species use sprite fallbacks** — only 6 species have real pixel art. The rest map to closest-shape analogues via `BUDDY_SPRITE_MAP`.
6. **KAIROS tick-based vs vexil_master.py polling** — Claude Code uses a daemon that fires on session ticks; pixel-terminal uses a 3-second poller checking `/tmp/vexil_lint.json`. Functionally similar for the lint/ops use case; no compelling reason to adopt KAIROS-style ticking.
