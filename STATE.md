# STATE.md — Working State (re-read after compaction)
## Updated: 2026-03-28 00:50

### Active Work
- Sprite identity system: round-robin sequencer, 9 animals × 4 hues = 36 combos
- frog2 added to SPRITE_DATA + ANIMALS; HUES = [0, 120, 195, 270]
- Pending commit: frog2 addition + HUES trim to 4

### Key IDs
- Collection: pixel_terminal (gemini-memory)
- localStorage key: 'pixel-terminal-identity-seq-v6'
- ANIMALS: ['cat','rabbit','penguin','rat','seal','snake','k-whale','cat2','frog2']
- HUES: [0, 120, 195, 270]

### Decisions This Session
- Round-robin: animalIndex = idx % N, hueIndex = floor(idx/N) % H — animals cycle before hues
- No per-folder persistence — each new session gets next combo in sequence
- 9 animals × 4 hues = 36 unique combos before repeat
- frog2-sprite.png added; hues selected: 0°, 120°, 195°, 270°
- hue_picker.html: per-animal independent cell selection, localStorage persistence

### Blockers
- Per-animal hue subsetting not yet implemented (all animals share same HUES pool)

### Last Session Snapshot
Date: 2026-03-28
Open actions:
- [ ] Commit frog2 + HUES=[0,120,195,270] — context: staged but not committed
- [ ] Per-animal hue subsets — context: user wants each animal only at its picked hues, not all 4
Decisions: 42 | Fixes: 33
Next: → commit frog2 changes, then implement per-animal hue map
