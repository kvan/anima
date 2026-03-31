# STATE.md — Working State (re-read after compaction)
## Updated: 2026-03-31 02:15

### Active Work
- Icon RGBA build error fixed (cargo clean resolved stale cache)
- BLE→mic auto-fallback working end-to-end (bridge + frontend)
- Voice bridge connects to WS, sends voice_ready("mic"), PTT registering
- Dimmed orange plus icon fixed (opacity: 1 override)

### Key IDs
- Collection: pixel_terminal (gemini-memory)
- --bg: #080808, --bg2: #0e0e0e
- --logo-orange: #db7656, --logo-green: #7bb54f

### Decisions This Session
- cargo clean to fix stale RGBA cache (Tauri generate_context! macro caches icon format)
- Voice bridge auto-fallback: BLE scan fails → OSError → args.ble=False → run_mic() immediately
- Frontend 10s BLE timeout: if no omi:connected within 10s, switch voiceSource to mic
- Kill stale processes (old pixel-terminal holding port 9876) before restart

### Blockers
- None active

### Last Session Snapshot
Date: 2026-03-31
Open actions (MERGED — from 9 sessions):
- [x] Fix macOS app icon squircle in Cmd+Tab — baked corners into PNG
- [x] BLE→mic auto-fallback — both bridge-side and frontend-side implemented and verified
- [x] Fix icon RGBA build error — cargo clean resolved stale cache
- [ ] Production PATH fix — context: get_shell_path() Rust + cached invoke
- [ ] Full A/B test: drop image, ask dimensions → verify zero Bash commands
- [ ] Per-animal hue subsets (ANIMAL_HUES map) *(auto-recovered)*
Decisions: 4 | Fixes: 2
Next: → Production PATH fix (get_shell_path() for packaged .app)
