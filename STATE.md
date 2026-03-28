# STATE.md — Working State (re-read after compaction)
## Updated: 2026-03-28 01:30

### Active Work
- Sprite identity system: round-robin sequencer, 9 animals × 4 hues = 36 combos
- frog2 key → frog3.png; penguin key → penguin2.png (committed + pushed this session)
- Per-animal hue subsetting: pending implementation

### Key IDs
- Collection: pixel_terminal (gemini-memory)
- localStorage key: 'pixel-terminal-identity-seq-v7'
- ANIMALS: ['cat','rabbit','penguin','rat','seal','snake','k-whale','cat2','frog2']
- HUES: [0, 120, 195, 270]

### Decisions This Session
- frog2-sprite.png → frog3.png (better design); old penguin → penguin2.png
- Both sprites verified byte-exact via Python binary comparison before commit
- Removed stale frog.psd and old penguin.png from repo

### Blockers
- Per-animal hue subsetting not yet implemented (all animals share same HUES pool)

### Last Session Snapshot
Date: 2026-03-28
Open actions (MERGED — from 2 sessions):
- [x] Commit frog2 + sprite replacements — done: frog3 + penguin2 pushed (911223c)
- [ ] Per-animal hue subsets — context: each animal should cycle only its picker-selected hues, not all 4 global HUES
Decisions: 45 | Fixes: 36
Next: → implement ANIMAL_HUES map replacing shared HUES array
