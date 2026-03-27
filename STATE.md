# STATE.md — Working State (re-read after compaction)
## Updated: 2026-03-27 13:54

### Active Work
- Hand-drawn frog sprite imported and wired as default character
- User's feature question pending: unique recolor per folder, persisted across sessions

### Key IDs
- Collection: pixel_terminal (gemini-memory)
- Tauri commands: read_slash_commands, read_slash_command_content

### Decisions This Session
- slash command expansion via read_slash_command_content Rust cmd
- unknown slash command: warn-msg type (orange), block send
- token fix: input_tokens + output_tokens only (no cache fields)
- font sizes: 12px messages, 11px code/tools
- CSS spacing: p:last-child, pre, ol/ul:last-child margin-bottom:0
- sprite-gen.js shelved; frog imported from PSD via sips+Pillow, added to SPRITE_DATA
- frog set as ANIMALS[0] — default main character
- whale never wired into app.js, deleted from scope
- mirrorLeft() + recolor() helpers added to sprite-gen.js

### Blockers
- None

### Last Session Snapshot
Date: 2026-03-27
Open actions:
- [ ] Test in tauri dev: slash expansion, unknown command warn, token count, spacing
- [ ] Answer/implement: unique recolor per folder, persisted across sessions
Decisions: 30 | Fixes: 28
Next: → npm run tauri dev smoke test, then evaluate folder-color-animal feature
