# Anima — Launch Readiness Assessment

**Date:** 2026-04-05
**Branch:** `main` @ `06e7343`
**Verdict:** Not ready. 3 hard blocks remain. Engineering is done — last-mile packaging is missing.

---

## What's solid

- **Compiles clean** — Rust passes `cargo check` (39 warnings, 0 errors), all JS passes `node --check`
- **Security fixed** — XSS (DOMPurify), arbitrary URI (allowlist), cross-session leak (ANIMA_SESSION), private files removed from tracking
- **14 commits merged to main** — oracle overhaul, daemon warm pool, MCP gate deferred cleanly to v0.2
- **No hardcoded dev paths** in `src/` or `src-tauri/src/`
- **README written** — good copy, feature table, "Why Anima?" section
- **Version:** 0.1.0 | **Bundle ID:** `com.bradleytangonan.anima`

---

## Hard blocks

| # | Blocker | Why it matters | Effort |
|---|---------|---------------|--------|
| 1 | **Production PATH fix** | `.app` launched from Dock gets minimal PATH — Claude subprocess can't find homebrew/pyenv/nvm. **Broken on first launch for every user.** | ~15 lines Rust + JS |
| 2 | **`npm run tauri build` untested** | No `.dmg` confirmed on main post-merge. Could surface bundling issues. | ~5 min build + triage |
| 3 | **No demo assets** | README references `demo.gif` + 3 screenshots that don't exist — broken images on GitHub. | Manual: record + screenshot |

## Soft blocks

| # | Issue | Risk |
|---|-------|------|
| 1 | **TEST_CHECKLIST.md — 0 boxes checked** | 6+ PRs merged without integration QA on main. Regressions possible. |
| 2 | **39 Rust warnings** | Unused variables, dead code. Cosmetic but unprofessional in public repo. |

---

## Recommended ship sequence

1. **PATH fix** — implement `get_shell_path()` in `lib.rs` (`$SHELL -l -c 'printf "%s" "$PATH"'`), cache result in `session-lifecycle.js`, pass to all `Command.create('claude')` spawns
2. **`npm run tauri build`** — confirm `.dmg` generates cleanly
3. **Run TEST_CHECKLIST.md** — manual QA, ~20 min interactive
4. **Record demo GIF** (30-45s: session start → companion → Vexil bubble → nim tick)
5. **Take 3 screenshots** (`docs/screenshots/session-card.png`, `familiar-card.png`, `vexil-bubble.png`)
6. **Tag `v0.1.0-alpha`** → GitHub Release with `.dmg` attached
7. **awesome-claude-code PR** — 36.5K stars, highest-leverage single action

---

## What Claude can do vs what needs Bradley

| Task | Who |
|------|-----|
| PATH fix (code) | Claude |
| `npm run tauri build` | Claude |
| Rust warning cleanup | Claude |
| Manual QA (TEST_CHECKLIST.md) | Bradley |
| Demo GIF + screenshots | Bradley |
| Tag + GitHub Release | Claude |
| awesome-claude-code PR | Claude (draft) + Bradley (submit) |
