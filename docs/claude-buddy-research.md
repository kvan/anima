# Claude Code /buddy System — Consolidated Research

**Canonical reference for all /buddy research. Do not duplicate — update this file.**
**Consolidates:** command-center/research/ (Apr 3) + pixel-terminal/backups/ (Apr 5) + commentary engine research (Apr 5) + gemini-memory + transcript analysis

Last updated: 2026-04-05

---

## Table of Contents
1. [The Leak](#1-the-leak)
2. [Architecture & Algorithm](#2-architecture--algorithm)
3. [Commentary Engine (How the Buddy Speaks)](#3-commentary-engine-how-the-buddy-speaks)
4. [Species, Sprites & Cosmetics](#4-species-sprites--cosmetics)
5. [Rarity & Stats System](#5-rarity--stats-system)
6. [Manipulation Techniques](#6-manipulation-techniques)
   - [6.1 How-To: Re-Rolling with any-buddy](#61-how-to-re-rolling-with-any-buddy-tested-2026-04-05)
7. [Community Demand (GitHub Issues)](#7-community-demand-github-issues)
8. [Community Tools Landscape](#8-community-tools-landscape)
9. [Creators & Contacts for Outreach](#9-creators--contacts-for-outreach)
10. [Anima vs /buddy Positioning](#10-anima-vs-buddy-positioning)
11. [Token Economy Landscape](#11-token-economy-landscape)
12. [KAIROS — Autonomous Daemon](#12-kairos--autonomous-daemon)
13. [Patterns Worth Borrowing](#13-patterns-worth-borrowing)
14. [Sources](#14-sources)

---

## 1. The Leak

On March 31, 2026, a 59.8 MB `.map` sourcemap file was accidentally included in `@anthropic-ai/claude-code` v2.1.88 on npm. 512,000 lines of TypeScript source were exposed. Discovered by @Fried_rice (Chaofan Shou, Solayer Labs intern) at 4:23 AM ET. Mirrored across GitHub within hours.

**Key discoveries beyond /buddy:**
- All system prompts in a JSON file
- **KAIROS**: Autonomous daemon mode (150+ references) — see [Section 11](#11-kairos--autonomous-daemon)
- 44 feature flags for unshipped features
- "Undercover mode" for stealth OSS contributions

**Verified source mirror:**
```
https://raw.githubusercontent.com/zackautocracy/claude-code/main/src/buddy/sprites.ts
```

---

## 2. Architecture & Algorithm

### File Structure
| File | Responsibility |
|------|---------------|
| `companion.ts` | PRNG, hash, roll algorithm, tamper protection |
| `sprites.ts` | ASCII art (3 frames/species), hat overlays, render pipeline |
| `prompt.ts` | System prompt injected into Claude's context |

### Bones vs Soul Pattern
- **Bones** (deterministic, recomputed every session): species, rarity, eyes, hat, shiny, stats
- **Soul** (generated once by Claude LLM at hatch, stored in `~/.claude.json`, freely editable): name, personality

### Algorithm Pipeline
```
Account UUID → concat salt "friend-2026-401" → hash → seed Mulberry32 PRNG → sequential rolls
```

**Identity resolution**: `oauthAccount?.accountUuid ?? userID ?? "anon"` (OAuth wins for Team/Pro)

**Hash function** (runtime-dependent):
- Production (Bun): `Number(BigInt(Bun.hash(s)) & 0xFFFFFFFFn)` — wyhash (C native)
- Fallback (Node.js): FNV-1a
- **These produce DIFFERENT values for same input** — external tools must match runtime

**Mulberry32 PRNG:**
```javascript
function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
```

**Roll sequence** (strict order — changing early roll cascades all subsequent):

| Roll | What | Distribution |
|------|------|-------------|
| 1 | Rarity | Weighted (see Section 4) |
| 2 | Species | Uniform 1/18 |
| 3 | Eye style | Uniform 1/6 |
| 4 | Hat | Common = forced 'none' (no RNG call); else 1/8 |
| 5 | Shiny | Independent 1% chance |
| 6+ | Stats | Peak pick, dump pick, 5 stat values |

**Tamper protection:**
```javascript
export function getCompanion() {
  const stored = getGlobalConfig().companion
  if (!stored) return undefined
  const { bones } = roll(companionUserId())
  return { ...stored, ...bones }  // bones always wins
}
```

Feature gated behind `feature('BUDDY')` — can be killed remotely server-side. Pro subscription required.

---

## 3. Commentary Engine (How the Buddy Speaks)

### 5-Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│  Layer 1: IDENTITY (companion.ts)                       │
│  Deterministic bones + persistent soul                  │
│  hash(userId + "friend-2026-401") → Mulberry32 PRNG     │
├─────────────────────────────────────────────────────────┤
│  Layer 2: AWARENESS (prompt.ts)                         │
│  companion_intro attachment → tells Claude buddy exists  │
│  "You're not {name} — it's a separate watcher"          │
│  Injected ONCE per conversation (dedup by name)          │
├─────────────────────────────────────────────────────────┤
│  Layer 3: OBSERVATION (observer.ts — NOT IN LEAK)       │
│  fireCompanionObserver() fires after each query ends     │
│  Watches session events, classifies trigger reason       │
├─────────────────────────────────────────────────────────┤
│  Layer 4: GENERATION (server-side — NOT IN LEAK)        │
│  POST /api/organizations/{orgId}/claude_code/buddy_react │
│  Separate LLM (not Claude) → returns short quip         │
├─────────────────────────────────────────────────────────┤
│  Layer 5: DISPLAY (CompanionSprite.tsx)                  │
│  Speech bubble: 10s visible, 3s fade, ephemeral          │
│  UI overlay — not terminal text, not persisted           │
└─────────────────────────────────────────────────────────┘
```

### The buddy is NOT Claude

Speech bubbles are generated by a **separate server-side API call**, not the main Claude model. The `buddy_react` endpoint receives a truncated transcript and companion metadata; a different system generates the quip. Claude only knows the buddy exists (via companion_intro); Claude never generates the buddy's words.

### buddy_react API Payload

```
POST /api/organizations/{orgId}/claude_code/buddy_react

{
  name: string,          // "Athena", "Snarl", etc.
  personality: string,   // from ~/.claude.json, editable by user
  species: string,       // "owl", "ghost", etc.
  rarity: string,        // "common" → "legendary"
  stats: Record<StatName, number>,  // DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK
  transcript: string,    // last ~5000 chars of conversation
  reason: string,        // trigger classification (enum values unknown)
  recent: string,        // semantics unclear — possibly last exchange only
  addressed: boolean     // true if user mentioned buddy by name
}

→ Returns: short quip string (displayed in speech bubble)
```

### What the Buddy Sees vs Doesn't See

| Sees | Does NOT see |
|------|-------------|
| Last ~5000 chars of conversation | Full conversation history |
| Its own personality, name, species | Tool call results/contents |
| Its own stats and rarity | Claude's thinking blocks |
| Trigger reason | File contents |
| Whether user addressed it by name | Previous session context |

### One-Way Information Flow — Claude is Blind to Buddy

The `companion_intro` attachment tells Claude the buddy exists. But the buddy's speech bubble text is **never injected back** into Claude's context. Claude cannot see or respond to what the buddy says. Users must manually copy-paste buddy comments.

Active community demand to fix this:
- Issue #42865: "Inject companion speech bubble content into conversation context"
- Issue #42854: "Buddy companion speech bubble responses are not persisted in session logs"

### Speech Bubble Cadence

- **Trigger**: `fireCompanionObserver()` fires after each query ends
- **Display**: Bubble visible for 20 ticks × 500ms = **10 seconds**, fades over last 6 ticks (3s)
- **Dismissal**: Immediate on transcript scroll (avoids content obstruction)
- **Unknown**: Whether server sometimes returns empty/null, or observer.ts has cooldown/sampling logic

### Known Trigger Types

The `reason` field classifies why the buddy is reacting. Documented triggers:
- Error encountered
- Task completed
- Long period of silence
- User addressed buddy by name (`addressed: true`)

Exact enum values unknown — observer.ts was not in the leak.

### Hot Start vs Cold Start

**Cold start (first hatch):**
1. `roll(userId)` generates deterministic bones
2. `inspirationSeed` + stats sent to buddy mode system prompt (205 tokens)
3. Prompt instructs: generate 1-word name (≤12 chars, "playful, absurd") + 1-sentence personality. Higher rarity = "weirder, more specific." Legendary = "genuinely strange."
4. Name + personality stored in `~/.claude.json` as `companion` field

**Hot start (every subsequent session):**
1. `getCompanion()` loads soul from `~/.claude.json`
2. `roll(userId)` recomputes bones (cached after first call per session)
3. `getCompanionIntroAttachment()` injects companion_intro once
4. observer.ts begins watching session events
5. **No cross-session conversation memory** — transcript starts empty. Only personality text carries over.

### Muting

- `/buddy mute` — hides speech bubbles (sprite stays visible). Sets `companionMuted` in config. `getCompanionIntroAttachment()` returns empty when muted.
- `/buddy off` — dismisses buddy entirely for the session
- Feature flag `feature('BUDDY')` — kills feature remotely server-side

### Personality Editable Without Restart

The `personality` field in `~/.claude.json` is sent to `buddy_react` on every API call. Edit it directly and the next reaction uses the new personality — no restart needed.

### The companion_intro Prompt (Full Text)

```
# Companion

A small {species} named {name} sits beside the user's input box and occasionally
comments in a speech bubble. You're not {name} — it's a separate watcher.

When the user addresses {name} directly (by name), its bubble will answer. Your job
in that moment is to stay out of the way: respond in ONE line or less, or just answer
any part of the message meant for you. Don't explain that you're not {name} — they
know. Don't narrate what {name} might say — the bubble handles that.
```

Injected as `companion_intro` attachment, once per conversation, with dedup logic checking if the same companion name was already announced.

### Anima's Architectural Advantages Over Native Commentary

| Dimension | Native /buddy | Anima (Vexil) |
|-----------|--------------|---------------|
| Who generates speech | Separate tiny LLM (server) | Claude itself (full model) |
| Context window | 5000 char transcript | Full conversation |
| Claude sees buddy speech? | NO (one-way) | YES (Claude IS the buddy) |
| Cross-session memory | None | Persistent (daemon) |
| Speech persistence | Ephemeral (not logged) | BUDDY tab log |
| Reaction intelligence | Stat-weighted quips | Full contextual awareness |
| Personality evolution | Static (editable but manual) | Architecture supports drift |

### Unresolved / Black Boxes (observer.ts + server)

- Exact `reason` enum values
- Cooldown/sampling logic (if any)
- Whether tool_use events trigger reactions or only assistant completions
- What model generates the quips (likely Haiku-class given cost constraints)
- Whether `addressed: true` routes to a different model or prompt
- Server-side rate limiting per org/user
- Whether stats actually modify server behavior or are just prompt context
- The `recent` field semantics vs `transcript` (possibly last exchange only vs rolling 5000-char window)

---

## 4. Species, Sprites & Cosmetics

### The 18 Species (uniform 1/18 distribution)
duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk

Names obfuscated via `String.fromCharCode()` arrays — "capybara" collides with an internal Anthropic model codename in `excluded-strings.txt`.

### Sprite Format
- Each species = 3 frames (idle, fidget, action)
- Each frame = 5 lines × 12 chars wide (padded with spaces)
- `{E}` placeholder replaced with eye character
- Line 0 = hat slot (blank when no hat; some frame 2s use it for effects)
- When no hat AND all 3 frames have blank line 0, renderer drops that row

### Eye Styles (6)
| Style | Char |
|-------|------|
| dot | `·` |
| star | `✦` |
| x | `×` |
| circle | `◉` |
| at | `@` |
| degree | `°` |

### Hats (8) — rendered on line 0
```
none:       '            '
crown:      '   \^^^/    '
tophat:     '   [___]    '
propeller:  '    -+-     '
halo:       '   (   )    '
wizard:     '    /^\     '
beanie:     '   (___)    '
tinyduck:   '    ,>      '
```

### Rendered Idle Sprites (· eyes, hat slot dropped)

```
Duck         Goose        Blob         Cat
    __            (·>       .----.      /\_/\
  <(· )___        ||       ( ·  · )   ( ·   ·)
   (  ._>      _(__)_     (      )   (  ω  )
    `--´        ^^^^       `----´    (")_(")

Dragon       Octopus      Owl          Penguin
  /^\  /^\    .----.      /\  /\      .---.
 <  ·  ·  >  ( ·  · )   ((·)(·))    (·>·)
 (   ~~   )  (______)   (  ><  )   /(   )\
  `-vvvv-´   /\/\/\/\    `----´     `---´

Turtle       Snail        Ghost        Axolotl
   _,--._    ·    .--.    .----.    }~(______)~{
  ( ·  · )    \  ( @ )  / ·  · \  }~(· .. ·)~{
 /[______]\    \_`--´   |      |    ( .--. )
  ``    ``    ~~~~~~~    ~`~``~`~    (_/  \_)

Capybara     Cactus       Robot        Rabbit
  n______n   n  ____  n    .[||].      (\__/)
 ( ·    · )  | |·  ·| |  [ ·  · ]   ( ·  · )
 (   oo   )  |_|    |_|  [ ==== ]  =(  ..  )=
  `------´     |    |     `------´   (")__(")

Mushroom     Chonk
 .-o-OO-o-.   /\    /\
(__________)  ( ·    · )
   |·  ·|    (   ..   )
   |____|     `------´
```

### Face Render (compact/status display)
```
duck/goose: (·>        cat:      =·ω·=       dragon:   <·~·>
blob:       (··)       octopus:  ~(··)~      owl:      (·)(·)
penguin:    (·>)       turtle:   [·_·]       snail:    ·(@)
ghost:      /··\       axolotl:  }·.·{       capybara: (·oo·)
cactus:     |·  ·|     robot:    [··]        rabbit:   (·..·)
mushroom:   |·  ·|     chonk:    (·.·)
```

### Animation System
Frame swap only — no interpolation, no canvas, no easing. ~2 FPS.

Key animation diffs between frames:
- **Tail wags**: append `~` (duck, cat, chonk)
- **Ear/limb shifts**: swap one char (rabbit `(\__/)` → `(|__/)`)
- **Head bobs**: shift text left/right 1 col (goose)
- **Particles on line 0**: fire `~ ~` (dragon), bubble `o` (octopus), float `~ ~` (ghost), spores `. o .` (mushroom), antenna `*` (robot)
- **Body resize**: blob expands/contracts border chars
- **Pattern swap**: tentacles reverse (octopus), shell pattern changes (turtle)

### Full Frame Data
Complete 3-frame data for all 18 species is in:
- `command-center/research/20260403_research_claude-buddy-ascii-sprites.md` (local backup)
- Raw source: `sprites.ts` from zackautocracy mirror

---

## 5. Rarity & Stats System

| Rarity | Weight | Probability | Stat Floor | Peak Range | Dump Range |
|--------|--------|-------------|------------|------------|------------|
| Common | 60 | 60% | 5 | 55-84 | 1-19 |
| Uncommon | 25 | 25% | 15 | 65-94 | 5-29 |
| Rare | 10 | 10% | 25 | 75-100 | 15-39 |
| Epic | 4 | 4% | 35 | 85-100 | 25-49 |
| Legendary | 1 | 1% | 50 | Always 100 | 40-64 |

**Five stats**: DEBUGGING, PATIENCE, CHAOS, WISDOM, SNARK

**Shiny**: Independent 1% cosmetic roll. Shiny legendary of specific species = 0.00056% (~1 in 180,000).

**Display**: 1-5 stars. Colors: common=inactive/gray, uncommon=green, rare=blue, epic=purple, legendary=gold.

---

## 6. Manipulation Techniques

| Method | Tool/Technique | How It Works |
|--------|---------------|-------------|
| UserID Brute-Force | Manual / buddy-reroll | Find a userID that hashes to target species/rarity. Free-tier only. |
| Binary Salt Patching | any-buddy (455 stars) | Search compiled binary for `"friend-2026-401"`, replace with salt that produces desired buddy. Most robust. |
| Spread-Order Patch | PicklePixel | Swap `{ ...stored, ...bones }` to `{ ...bones, ...stored }` in minified binary. Single-byte swap. Version-specific. |
| AccountUUID Deletion | Manual (Team/Pro) | Delete `accountUuid` from `oauthAccount` in `~/.claude.json`, then brute-force userID. Reverts on re-login. |

### 6.1 How-To: Re-Rolling with any-buddy (Tested 2026-04-05)

**Prerequisites:**
- Node.js (npm/npx)
- Claude Code installed via npm (`/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/cli.js`)
- macOS (binary will be ad-hoc re-signed after patching)

**Step 1 — Install and run (fully non-interactive):**
```bash
npx any-buddy@latest -s <species> -r <rarity> -e '<eye>' -t <hat> -n "<name>" -y
```

All flags are required for non-interactive mode. The `-y` flag alone is NOT sufficient — the TUI still prompts for any unspecified option. Specify every parameter explicitly.

**Example (our roll):**
```bash
npx any-buddy@latest -s owl -r common -e '·' -t none -n "Athena" -y
```

**Flag reference:**
| Flag | Options |
|------|---------|
| `-s, --species` | duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl, capybara, cactus, robot, rabbit, mushroom, chonk |
| `-r, --rarity` | common, uncommon, rare, epic, legendary |
| `-e, --eye` | `·` `✦` `×` `◉` `@` `°` |
| `-t, --hat` | none, crown, tophat, propeller, halo, wizard, beanie, tinyduck |
| `-n, --name` | Any string (sets the soul name in `~/.claude.json`) |
| `-y` | Skip confirmation prompt (required with all other flags for non-interactive) |

**Step 2 — Verify:**
```bash
npx any-buddy@latest current
```
Should show "Active pet (patched)" with your new selection and "Default pet (original salt)" with your original roll.

**Step 3 — Restart all Claude sessions.**
Critical gotcha: sessions started BEFORE the patch still have the old bones cached in memory. The species/rarity won't change until the session restarts and recomputes bones from the patched salt. The soul (name/personality in `~/.claude.json`) updates immediately — so you'll see the new name on the old species until restart.

**Auto-patch hook (installed automatically):**
any-buddy adds a `SessionStart` hook to `~/.claude/settings.json`:
```json
{
  "matcher": "",
  "hooks": [{ "type": "command", "command": "any-buddy apply --silent" }]
}
```
This re-applies the patch after Claude Code updates, so you don't need to re-run manually.

**Other useful commands:**
```bash
npx any-buddy preview              # Browse species without applying
npx any-buddy preview --all        # Dump all preset builds
npx any-buddy --preset "Arcane Dragon"  # Use a curated preset
npx any-buddy buddies              # Browse and switch between saved buddies
npx any-buddy restore              # Revert to original roll
npx any-buddy apply --silent       # Re-apply saved patch (e.g., after update)
npx any-buddy rehatch              # Delete companion to re-hatch fresh via /buddy
npx any-buddy share                # Print ASCII card + copy to clipboard
```

**What the patch does under the hood:**
1. Finds the salt string `"friend-2026-401"` in the compiled Claude Code binary (`cli.js`)
2. Brute-forces a replacement salt that produces the desired species/rarity/eyes/hat when run through the Mulberry32 PRNG roll sequence
3. Overwrites the salt in-place (same byte length)
4. On macOS: ad-hoc re-signs the binary (`codesign`)
5. Saves the patch config so `apply --silent` can re-patch after updates

**Limitations:**
- Binary patch breaks on every Claude Code update (auto-patch hook handles this)
- Stats (DEBUGGING, PATIENCE, etc.) are determined by the new salt — you can't independently choose stats
- Shiny is a 1% independent roll — can't be targeted without many brute-force attempts
- If Claude Code won't launch after patching: `npx any-buddy restore`

---

## 7. Community Demand (GitHub Issues)

| Issue | Upvotes | Key Ask | Status |
|-------|---------|---------|--------|
| [#41684](https://github.com/anthropics/claude-code/issues/41684) — RPG evolution | 39 👍, 28 comments | Token→XP, 5-tier evolution, streak multipliers | Closed |
| [#41867](https://github.com/anthropics/claude-code/issues/41867) — Customization + progression | 122 👍, 37 comments | Branching evolution, achievements, buddy journal, monetization | Closed |
| [#42389](https://github.com/anthropics/claude-code/issues/42389) — XP + personality drift | 4 👍 | XP from tokens, personality evolves from usage patterns | Open |
| [#41833](https://github.com/anthropics/claude-code/issues/41833) — Official reroll | ? | Let users re-roll their buddy | Unanswered |

Issues #41684 and #41867 marked "CLOSED - COMPLETED" with Anthropic team member @alii assigned — unclear if features are actually shipping or just acknowledged.

**Community XP formula proposals:** XP = output_tokens×1 + input_tokens×0.5 + tool_calls×100 + session_bonus

---

## 8. Community Tools Landscape

| Tool | Creator | Stars | What It Does |
|------|---------|-------|-------------|
| [any-buddy](https://github.com/cpaczek/any-buddy) | cpaczek | 455 | Binary patcher — pick any species/rarity via TUI, 23 presets, auto-patch hook |
| [buddy-reroll](https://github.com/ithiria894/claude-code-buddy-reroll) | ithiria894 | 62 | Multi-core brute-force salt search |
| [buddy-evolution](https://github.com/FrankFMY/buddy-evolution) | FrankFMY (Artyom) | — | Full plugin: XP, 20 levels, 34 achievements, evolution paths |
| [buddy-evolution-spec](https://github.com/Hegemon78/buddy-evolution-spec) | Hegemon78 (Nikolai) | — | Comprehensive spec + monetization proposal |
| [BuddyBoard](https://buddyboard.xyz) | TanayK07 | — | Trading cards, leaderboard, BuddyDex (1,728 combos) |
| [buddy-evolution-web](https://buddy-evolution-web.vercel.app) | yazelin | — | Working web platform: leaderboard, profiles, stat radar |
| [buddy-gacha](https://github.com/gadzan/buddy-gacha) | gadzan | — | CLI gacha roller |
| [claude-buddy.dev](https://claude-buddy.dev/) | Orestes Garcia | — | Dev workflow platform |
| [claude-buddy.vercel.app](https://claude-buddy.vercel.app) | — | — | Web gallery of all species/rarity combos |
| [cc-buddy](https://github.com/fengshao1227/cc-buddy) | fengshao1227 | — | Interactive with gallery, EN/CN |
| [ccbuddy.dev](https://ccbuddy.dev) | — | — | Web-based tool |
| Web designer | PicklePixel | — | HTML companion designer with sprite preview |

Notable: Someone launched **$Nebulynx** and **$BUDDY** (Solana memecoins) based on buddy variants — avoid this association entirely.

---

## 9. Creators & Contacts for Outreach

Full CRM in Google Sheet: **"Anima Launch — Outreach CRM"**
Sheet ID: `1DPMHuEafWAJNGBBk-f81TBbJuP3S_IfrClP7bxkNte8`

### Tier 1 — High-audience creators (tag on LinkedIn)
| Name | Platform | Handle | Audience | Why |
|------|----------|--------|----------|-----|
| Joe Njenga | Medium | @joe.njenga / @joenjenga_ (X) | 20,950 followers | Wrote buddy deep-dive, 222 claps |
| Nicholas Rhodes | Substack | @NickyDigital (X) | Paid newsletter | "Future of agentic dev tools" framing |
| Abdullah Mobayad | claudefa.st | @AbdoMobayad (X) | Site traffic | Runs Claude analysis hub |
| Josh Pocock | YouTube (Stride AI Academy) | — | Video audience | Predicted /buddy from leak, made video |

### Tier 2 — Community builders (direct outreach)
| Name | Platform | Contact | Stars/Impact |
|------|----------|---------|-------------|
| cpaczek | GitHub | github.com/cpaczek | 455 stars (any-buddy) |
| Artyom Pryanishnikov (FrankFMY) | GitHub/Telegram | @FrankFMY | buddy-evolution plugin |
| Nikolai Eliseev (Hegemon78) | GitHub | github.com/Hegemon78 | 122-upvote issue author, monetization spec |
| TanayK07 | GitHub | github.com/TanayK07 | BuddyBoard platform |
| ithiria894 | GitHub/DEV.to | github.com/ithiria894 | 62 stars (reroll) |
| Orestes Garcia | X/LinkedIn | @orestesgarcia / setsero | claude-buddy.dev |

### Tier 3 — Bloggers/publications (comment & pitch)
| Name | Platform | Why |
|------|----------|-----|
| Ignacy Kwiecień | DecodeTheFuture.org | Wrote the article user referenced |
| PicklePixel | DEV.to | Reverse-engineered buddy, technical audience |
| Damon | DEV.to + devutil.site | Comprehensive species guide |
| JD Hodges | jdhodges.com | Practical guides audience |
| WaveSpeedAI blog | wavespeed.ai | Covered leak + hidden features |
| Apiyi.com blog | help.apiyi.com | Value analysis + evolution strategy |

### Tier 4 — Platforms to submit to
| Platform | Stars/Reach | Action |
|----------|-------------|--------|
| [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) | 36,600 stars | Submit PR under companion tools |
| [awesome-claude-code-toolkit](https://github.com/rohitg00/awesome-claude-code-toolkit) | — | Submit PR |
| Claude Community Ambassadors | Anthropic official | Apply via program |

---

## 10. Anima vs /buddy Positioning

| Dimension | Claude /buddy | Community Plugins | **Anima** |
|-----------|--------------|-------------------|-----------|
| Species per user | 1 (permanent) | 1 (hacked) | **Many (session-based familiars)** |
| Art style | ASCII text | ASCII text | **Pixel sprites** |
| Token economy | None | Proposed/WIP | **Nim currency — shipping** |
| Re-rolls | None (hack-only) | Brute-force salt | **Native re-roll with nim cost** |
| Persistence | Session-only | Plugin-dependent | **Cross-session daemon (Vexil)** |
| Personality | System prompt injection | Same | **Oracle with conversation history** |
| Platform | CLI addon | CLI patches / web | **Native Tauri v2 desktop app (4MB)** |
| Evolution | Community requested (160+ upvotes) | Plugin prototypes | **Architecture supports it** |
| Collectibility | Single card | BuddyDex web | **Familiar cards in-app** |

**The narrative: "The community asked for this. We already built it."**

---

## 11. Token Economy Landscape

- Official /buddy has **NO** token economy — stats are cosmetic, species is fixed
- Community proposals: XP = output_tokens×1 + input_tokens×0.5 + tool_calls×100 + session_bonus
- buddy-evolution plugin: 20 levels, streak multipliers, 34 achievements
- **Anima's nim economy is AHEAD of ALL community proposals** — working currency with re-roll gating
- The appetite for tokenized gamification is validated by 160+ upvotes across issues

---

## 12. KAIROS — Autonomous Daemon

Discovered in the leak: 150+ references to an autonomous daemon mode.
- Background agent that persists across sessions
- Receives periodic tick prompts
- Can independently act without user prompt
- **Our px-master architecture already covers this; the gap is passive autonomous triggering**

---

## 13. Patterns Worth Borrowing

1. **Bones/Soul split**: Deterministic visual identity + LLM-generated personality. Clean separation of immutable vs. editable.
2. **Stat system with rarity-scaled floors**: Adds collectibility. Familiars could have project-relevant stats (CODE_COVERAGE, DEPLOY_STREAK).
3. **Shiny mechanic**: Independent 1% cosmetic roll. Low-cost dopamine.
4. **Hat slot architecture**: Line 0 reserved for cosmetic overlays — elegant, extensible.

---

## 14. Sources

### Primary (leaked source)
1. [sprites.ts raw (zackautocracy mirror)](https://raw.githubusercontent.com/zackautocracy/claude-code/main/src/buddy/sprites.ts) — Verified TypeScript source
2. [zmxv animation gist](https://gist.github.com/zmxv/7f83671f860c15be02f45b07fee207fc) — Python GIF generator confirming frame data

### Reverse Engineering
3. [PicklePixel — DEV.to](https://dev.to/picklepixel/how-i-reverse-engineered-claude-codes-hidden-pet-system-8l7) — Full algorithm, code snippets, binary patch
4. [ithiria894 — DEV.to](https://dev.to/ithiria894/i-reverse-engineered-claude-codes-buddy-system-heres-how-to-reroll-yours-2ghj) — Reroll exploit, accountUuid trap, rarity tables
5. [variety.is](https://variety.is/posts/claude-code-buddies/) — Architecture analysis
6. [claudefa.st](https://claudefa.st/blog/guide/mechanics/claude-buddy) — Abdullah Mobayad's analysis

### Press & Analysis
7. [VentureBeat](https://venturebeat.com/technology/claude-codes-source-code-appears-to-have-leaked-heres-what-we-know) — Leak timeline, scope
8. [The Hacker News](https://thehackernews.com/2026/04/claude-code-tleaked-via-npm-packaging.html) — npm packaging error details
9. [DecodeTheFuture](https://decodethefuture.org/en/claude-buddy-terminal-pet-explained/) — Architecture overview

### Creator Content
10. [Joe Njenga — Medium](https://medium.com/@joe.njenga/anthropic-releases-claude-code-buddy-command-your-virtual-pet-companions-f66d2b1b481e) — 222 claps, first-hatch experience
11. [Nicholas Rhodes — Substack](https://nicholasrhodes.substack.com/p/claude-buddy-terminal-tamagotchi-agentic-ai-dev-tools) — "Future of agentic dev tools"
12. [Damon — DEV.to](https://dev.to/damon_bb9e4bba1285afe2fcd/claude-buddy-the-complete-guide-to-your-ai-terminal-pet-all-18-species-rarities-hidden-22da) — Complete species guide
13. [JD Hodges](https://www.jdhodges.com/blog/claude-code-buddy-terminal-pet-guide/) — Practical reroll guide
14. [Apiyi.com](https://help.apiyi.com/en/claude-code-buddy-terminal-pet-companion-activation-guide-en.html) — Feature flag details

### Community Tools
15. [any-buddy](https://github.com/cpaczek/any-buddy) — 455 stars
16. [buddy-reroll](https://github.com/ithiria894/claude-code-buddy-reroll) — 62 stars
17. [buddy-evolution](https://buddy.frankfmy.com/) — FrankFMY's progression plugin
18. [BuddyBoard](https://buddyboard.xyz) — TanayK07's trading card platform
19. [claude-buddy.dev](https://claude-buddy.dev/) — Orestes Garcia

### Commentary Engine
20. [prompt.ts — alex000kim mirror](https://github.com/alex000kim/claude-code/blob/main/src/buddy/prompt.ts) — companion_intro injection + dedup
21. [DeepWiki: Companion System](https://deepwiki.com/sanbuphy/claude-code-source-code/11.4-companion-(buddy)-system) — Architecture analysis, injection mechanism
22. [GitHub Issue #42865](https://github.com/anthropics/claude-code/issues/42865) — Inject speech bubble into context (confirms one-way gap)
23. [GitHub Issue #42854](https://github.com/anthropics/claude-code/issues/42854) — Speech not persisted (confirms ephemeral nature)
24. [liuup/claude-code-analysis](https://github.com/liuup/claude-code-analysis/blob/main/analysis/11-hidden-features-and-easter-eggs.md) — observer.ts reference, fireCompanionObserver
25. [Piebald-AI/claude-code-system-prompts](https://github.com/Piebald-AI/claude-code-system-prompts) — Buddy mode hatch prompt (205 tokens)
26. [Alex Kim blog](https://alex000kim.com/posts/2026-03-31-claude-code-source-leak/) — Leak context

### GitHub Issues (Community Demand)
27. [#41684](https://github.com/anthropics/claude-code/issues/41684) — RPG evolution (39 upvotes)
28. [#41867](https://github.com/anthropics/claude-code/issues/41867) — Customization + monetization (122 upvotes)
29. [#42389](https://github.com/anthropics/claude-code/issues/42389) — XP + personality drift
30. [#41833](https://github.com/anthropics/claude-code/issues/41833) — Official reroll request

### Submission Targets
31. [awesome-claude-code](https://github.com/hesreallyhim/awesome-claude-code) — 36.6K stars
32. [awesome-claude-code-toolkit](https://github.com/rohitg00/awesome-claude-code-toolkit)

### Local Backups (raw source files)
- `command-center/research/20260403_research_claude-code-buddy-system.md` — Apr 3 system research
- `command-center/research/20260403_research_claude-buddy-ascii-sprites.md` — Apr 3 full sprite data
- `command-center/research/buddy-sprites-implementation-brief.md` — Implementation reference
- `pixel-terminal/backups/20260405_research_claude_buddy_ecosystem.md` — Apr 5 ecosystem positioning
- `pixel-terminal/docs/transcripts/We Predicted This - Buddy Is Real.md` — Josh Pocock transcript
- `pixel-terminal/docs/20260405_research_buddy-commentary-engine.md` — Apr 5 commentary engine research (now merged here)
