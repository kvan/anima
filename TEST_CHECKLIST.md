# Pixel Terminal — Ship Checklist

Run before shipping. ~20 min. Check each box.

## Pre-flight (automated)

- [ ] **Rust + capabilities schema**: `cargo check --manifest-path src-tauri/Cargo.toml` → must finish with no errors ✓ (passed 2026-03-27)
- [ ] **JS syntax**: `node --check src/app.js` → must print nothing ✓ (passed 2026-03-27)
- [ ] **Full release build**: `npm run tauri build` → must complete without errors

---

## Step 1 — Launch & idle state

- [ ] `npm run tauri dev` — window opens, no console errors
- [ ] Sidebar shows "SESSIONS" + `+` button
- [ ] Input textarea is disabled (no session yet)

## Step 2 — Core session

- [ ] Click `+` → pick any non-pixel-terminal folder
- [ ] No warning dialog appears
- [ ] Session card appears; sprite animates; "Starting in …" message
- [ ] Type `say hello in one word`, press Enter → response appears, sprite goes idle
- [ ] Tool-using prompt (e.g. `list files here`) → tool lines show `…` then `✓`

## Step 3 — Self-edit protection ← most critical new feature

- [ ] Click `+` → pick `/path/to/pixel-terminal` (the app's own directory)
- [ ] **Warning dialog appears** with "proceed read-only" + "cancel" buttons
- [ ] Press cancel → dialog closes, NO session created
- [ ] Repeat → click "proceed read-only" → session created with `(read-only)` in system message
- [ ] In that session, ask: `edit any file in this directory` → Claude refuses (Edit disabled)
- [ ] In that session, ask: `run: echo test > /tmp/pttest.txt` → Claude refuses (Bash disabled)
- [ ] Clean up: `rm /tmp/pttest.txt` (if somehow created)
- [ ] Pick `pixel-terminal/src` subdirectory → warning **still appears** (upward walk works)
- [ ] Open browser devtools (Cmd+Option+I) — confirm NO `isSelfDirectory check failed:` warning in console

  > **If console shows `isSelfDirectory check failed:`**: sentinel detection is broken.
  > Fix: in `src-tauri/capabilities/default.json`, move `test` from `shell:allow-execute`
  > into the `shell:allow-spawn` allow array, then change `.execute()` → `.spawn()` in
  > `isSelfDirectory` with a close-event listener.

## Step 4 — Performance (visual check)

- [ ] Send a prompt that triggers 10+ tool calls → no jank, scroll stays at bottom throughout
- [ ] Open two sessions; switch with Cmd+1 / Cmd+2 → instant switch, no animation flash on old messages
- [ ] Scroll UP in a long session, send a new message → scrolls back to bottom

## Step 5 — Session management

- [ ] Click `✕` on a session card → confirm modal button says **"terminate"** (not "proceed read-only" — verifies okLabel resets between calls)
- [ ] Confirm → card removed, switches to next session or empty state
- [ ] Press Escape during active response → "Interrupted" message, ERR state
- [ ] Click red X (window close) → confirm modal with session count, cancel leaves app open

## Step 6 — Sidebar resize

- [ ] Drag the resize handle → sidebar width changes smoothly (no jank)
- [ ] Release → width stays at dragged position

---

## Post-ship

- [ ] Commit test results and any fixes found
- [ ] Tag the release commit: `git tag v0.1.0-ship && git push --tags`
