# STATE.md — Working State (re-read after compaction)
## Updated: 2026-04-01 01:05

### Active Work
- CSS spacing iteration — message spacing looks worse after 16px user margin-top
- white-space pre-wrap fix applied (trailing newline gap eliminated)
- Now: revert/tune spacing with Gemini Vision feedback + --seq

### Key IDs
- Collection: pixel_terminal (gemini-memory)
- Type scale: --fs-lg(13) --fs-base(12) --fs-sm(11) --fs-xs(10)
- Spacing: --sp-1(2) --sp-2(4) --sp-3(8) --sp-4(16)
- Line-height: --lh-tight(1.2) --lh-base(1.4)

### Decisions This Session
- CSS design tokens fully applied
- white-space: pre-wrap moved from .msg-bubble to .msg.user .msg-bubble only
- .system-label margin-top removed, opacity 0.75 + color --text-mute
- .msg.user margin-top: 16px added (now suspected too large)

### Blockers
- Message spacing: 16px user turn gap looks wrong per screenshot

### Last Session Snapshot
Date: 2026-04-01
Open actions (MERGED):
- [ ] Production PATH fix
- [ ] Full A/B test: drop image, ask dimensions
- [ ] Per-animal hue subsets (ANIMAL_HUES map)
- [ ] Dot click always-restart bridge
- [ ] Tune message spacing — Gemini Vision + --seq
- [ ] Pixel companion sprite — intercept /buddy in slash-menu, 16x32 sprite in px-master slot 0, states: idle/thinking/error/done from stream-json events
- [ ] Vexil Memory Linter — memory_lint.py (PreToolUse hook) + companion.js (3s file poll) — spec at command-center/scripts/memory_lint.py. No new Rust. read_file_as_text already exists.
Decisions: 9 | Fixes: 4
Next: → Apply Gemini Vision spacing feedback

### Research Log: Kairos + Buddy (2026-04-02)
- **KAIROS** (Claude Code leak 2026-03-31): internal always-on daemon, feature-flagged, not in public builds. autoDream = idle memory consolidation. px-master covers the architecture — gap is passive autonomous triggering without user prompt.
- **/buddy** (shipped 2026-04-01, April Fools): ASCII terminal pet, 18 species, Pro only, deterministic by account hash. Build native pixel sprite companion instead — persistent via px-master, multi-session aware, reacts to stream-json. Strictly better than ASCII.
