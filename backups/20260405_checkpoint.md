# Session Checkpoint — Anima (pixel-terminal)
**Date**: 2026-04-05
**Duration**: ~Full session

## Decisions Made
- `tokio::spawn` → `tauri::async_runtime::spawn` in `start_daemon` (startup crash fix)
- Omi pendant rebranded to Bluetooth mic in README + 3 UI tooltip strings (internal identifiers unchanged)
- Animism framing kept: NOT sacred, inhabited + teeming with activity — filters in the right audience
- nim localStorage confirmed durable in production — not a persistence bug

## Fixes Applied
- PR D startup crash: `tauri::async_runtime::spawn` replaces bare `tokio::spawn` in setup() context
- PR E (4 fixes): companion.js hardcoded username removed; attachments OOM bypass → reject on failure; npm dev script dead ref removed; `src-tauri/target/` gitignored
- PR F: 14 `lock().unwrap()` → `lock().unwrap_or_else(|e| e.into_inner())` in daemon.rs

## Progress
- All 4 PRs (A/B/C/D) shipped and merged to main
- README fully rewritten in Bradley's voice — hero, animism, nim reframe, companion section, Why Anima?
- Audit (PRs E+F) clean — 5 fixes across security, stability, hygiene
- Gemini + /introspect review applied — 5 targeted README improvements
- Why Anima? section added: 4 pain points in approved voice
- main = `979cbeb`

## Tips & Gotchas Discovered
- `tauri::async_runtime::spawn` required from setup() — `tokio::spawn` panics before runtime exists
- nim localStorage is durable in Tauri WKWebView production; only `launch.command` clears it (dev-only)
- Gemini doc review: hero subtitle + "wraps Claude Code CLI" clarity = highest-impact README fixes
- Introspect soundness 6/10 → 5 targeted fixes → repo now conversion-ready pending GIF/screenshots

## Open Questions
- [ ] None blocking

## Blockers
- [ ] None

## Memories Logged
- 9 new memories → `pixel_terminal`
- 0 updated
- 0 global

## Next Session Suggested Start
→ Record demo GIF (30-45s: session start → companion → Vexil bubble → nim tick), take 3 screenshots, then `npm run tauri build` → v0.1.0-alpha release
