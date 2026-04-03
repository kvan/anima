# TODO — pixel-terminal

## This Week
- [ ] Production PATH fix — when packaging .app for Dock launch, implement `get_shell_path()` Rust command (`$SHELL -l -c 'printf "%s" "$PATH"'`), cache result, pass to all `Command.create('claude')` spawns. ~15 lines: one Tauri command in lib.rs + one cached invoke in session-lifecycle.js. (from /checkpoint 2026-03-30, context: dev mode inherits PATH fine; production .app gets minimal PATH and Claude subprocess can't find homebrew/pyenv/nvm)
- [ ] Per-animal hue subsets — implement ANIMAL_HUES map in `getNextIdentity()` so each animal type uses a constrained hue range (context: auto-recovered from prior sessions)

## Backlog
- [ ] Full A/B parity test — drop image, ask dimensions → verify instant answer with zero Bash commands (pre-computed metadata fix)
- [ ] Image resize quality — currently JPEG 0.85 always; consider keeping PNG for screenshots with text (low priority)
