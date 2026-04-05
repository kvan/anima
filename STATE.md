# STATE.md — Working State (re-read after compaction)
## Updated: 2026-04-05

### Active Work
- **Launch prep**: README complete, audit clean, Why Anima? section done — waiting on GIF + screenshots
- main = `979cbeb` — all 4 PRs + audit PRs E+F + full README/copy pass merged

### Key IDs / Paths
- `main` = `979cbeb` (Why Anima? section, 2026-04-05)
- buddy.json: `~/.config/pixel-terminal/buddy.json`
- Feed: `~/.local/share/pixel-terminal/vexil_feed.jsonl`
- App name: **Anima** | Bundle ID: `com.bradleytangonan.anima`
- gemini-memory: `pixel_terminal` (~145 entries)

### Decisions This Session
- PR D crash fix: `tokio::spawn` → `tauri::async_runtime::spawn` in `start_daemon`
- README rewrite: Bradley's voice, animism/inhabited vibe, nim reframe, bluetooth mic
- Audit PRs E+F: homeDir fallback, OOM bypass, dead dev script, target/ gitignore, mutex poisoning
- Omi → Bluetooth mic: README + 3 UI tooltip strings (internal identifiers unchanged)
- Gemini+introspect review: subtitle, CLI wrapper clarity, API disclosure, nim framing, bluetooth
- Why Anima? section: 4 pain points (companion copy-paste, session manager, file reattachment, history)
- nim localStorage: confirmed durable in production — launch.command cache-clear is dev-only

### Blockers
- None

### Last Session Snapshot
Date: 2026-04-05
Open actions (MERGED — from 1 session):
- [ ] Record demo GIF (30-45s: session start → companion → Vexil bubble → nim tick) — context: hero asset, repo can't convert without it
- [ ] Take 3 screenshots (docs/screenshots/session-card, familiar-card, vexil-bubble) — context: README images placeholder
- [ ] `npm run tauri build` → v0.1.0-alpha GitHub Release with .dmg attached — context: install path broken without release binary
- [ ] awesome-claude-code PR submission — context: 36.5K stars, highest-leverage single action
Decisions: 8 | Fixes: 7
Next: → Record demo GIF + 3 screenshots (manual, needs running app)
