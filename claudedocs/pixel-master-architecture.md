# Pixel Master — Auto-Boot Orchestrator Architecture
**Created**: 2026-03-29 | **Status**: Phase 0 approved, Phase 1+ pending validation | **Source**: /introspect --grade analysis + --seq reasoning

---

## Problem Statement

pixel-terminal runs multiple Claude Code sessions as isolated peers. Sessions can't see each other, can't communicate, and voice commands route to whatever session is active ("dumb routing"). Meanwhile, the command-center stack has a 9-layer OS (memory, skills, agents, security, flywheel) — but pixel-terminal is just a thin UI on top, with no cross-session intelligence.

## The Gap

| What works today | What's missing |
|-----------------|----------------|
| /gsd orchestrates WITHIN one session (sub-agents, worktrees) | Nothing orchestrates ACROSS sessions |
| Voice routes to active session | No intent-based routing ("research X" vs "fix bug in Y") |
| Sessions have different cwds (different repos) | Can't share findings between sessions |
| Each session has full skill access | No "brain" that sees the whole picture |

## Verdict: YES, build it — incrementally.

**The killer use case**: Cross-project coordination with visibility. Internal agents share one cwd and are invisible. Pixel sessions have different cwds and are visible. The master bridges these worlds.

**What it is NOT**: A replacement for /gsd. /gsd = within-session delegation. Master = across-session coordination. They're complementary.

---

## Architecture

```
                         pixel-terminal
 +-----------------------------------------------------------+
 |                                                             |
 |  [MASTER]     [Worker 1]    [Worker 2]     ...             |
 |  frog         cat            rabbit                         |
 |  slot 0       slot 1         slot 2                         |
 |  cmd-center   pixel-terminal OmiWebhook                     |
 |       |             ^              ^                        |
 |       | px_send     |   px_send    |                        |
 |       +-------------+--------------+                        |
 |       | px_read     |   px_read                             |
 |       v             v                                       |
 |  +------------------------------------------+               |
 |  |   px-master MCP server (localhost)        |               |
 |  |   px_list / send / read / spawn / kill    |               |
 |  +------------------------------------------+               |
 |       ^                                                     |
 |       | HTTP / Unix socket                                  |
 |  +------------------------------------------+               |
 |  |   Tauri IPC (lib.rs + frontend JS)        |               |
 |  +------------------------------------------+               |
 |                                                             |
 |  +------------------------------------------+               |
 |  |   ws_bridge.rs (voice input)              |               |
 |  |   Tier 1: JS keyword match (0 tokens)     |               |
 |  |   Tier 2: master Claude (ambiguous only)   |               |
 |  +------------------------------------------+               |
 +-----------------------------------------------------------+
```

### Master Session Properties
- **Slot 0**, frog sprite (always first, always present)
- **cwd**: `~/Projects/command-center` (hub — has all 22 skills, Gemini Memory, MCP servers)
- **Auto-boots** on app launch before any user interaction
- **Cannot be killed** by user (or requires double-confirm)
- **Idle by default** — doesn't consume tokens until activated by voice or user message
- **System prompt injection**: tells Claude it's the orchestrator, lists available cross-session commands

### How Master Accesses Session Commands
**px-master MCP server** (the only viable path — Claude Code can't call Tauri invoke() directly):
- Small Node.js or Python process (~200 LOC)
- Exposes px_* tools via standard MCP protocol
- Communicates with Tauri frontend via localhost HTTP or Unix socket
- Master Claude connects to it as an MCP server (configured in settings.json)
- Same proven pattern as gemini-memory MCP server

### MCP Tool Surface

| Tool | Signature | What |
|------|-----------|------|
| `px_list_sessions` | `() -> [{id, name, cwd, status, tokens}]` | All active worker sessions |
| `px_send_to_session` | `(id, text) -> ()` | Write user message to worker's stdin |
| `px_read_session_log` | `(id, last_n) -> [Message]` | Last N messages from worker |
| `px_spawn_session` | `(cwd, name?) -> id` | Create new worker session |
| `px_kill_session` | `(id) -> ()` | Terminate worker session |

### Voice Routing (Tiered)
```
Current:  voice -> ws_bridge -> active session (dumb)

Proposed (tiered to avoid context burn):
  Tier 1 (JS-side, 0 tokens):
    - Keyword match: "research" -> session with research-like cwd
    - Keyword match: "fix/debug/code" -> session with code project cwd
    - Session name match: "session 2" -> that session
    - Fallback: active session

  Tier 2 (master Claude, only for ambiguous commands):
    - "What's the status of everything?" -> master answers directly
    - "Take the research from session 1 and send it to session 2" -> master orchestrates
    - Complex multi-session goals -> master decomposes
```

### Master <-> Worker Communication
- **Master -> Worker**: `px_send_to_session` writes stdio JSON to worker's child stdin (same format as existing `sendMessage()`)
- **Worker -> Master**: Master reads via `px_read_session_log` (returns recent sessionLogs entries)
- **Async**: Master sends instruction, polls for response or receives Tauri event on worker status change to 'idle'

---

## Phasing

### Phase 0: Auto-boot master session (~15 min) -- APPROVED
**Files**: `src/app.js`, `src/session-lifecycle.js`, `src/session.js`
- On `DOMContentLoaded`, call `createSession('~/Projects/command-center', 'MASTER')`
- Add `isMaster: true` flag to session object
- Prevent kill (double-confirm required)
- Frog sprite guaranteed (frog is index 0 in ANIMALS array)
- No new Tauri commands or MCP — master is a regular session

**Verification**: `npm run tauri dev` -> app launches with master session pre-created

### Phase 0.5: JS-side keyword voice routing (~1 hour) -- APPROVED
**Files**: `src/voice.js`
- Add keyword-to-session matching before sending voice commands
- Match against session cwds and names
- Zero token cost, useful regardless of master architecture

**Verification**: "Hey pixel, research X" routes to session whose cwd contains "research" (or active session as fallback)

### Phase 1: px-master MCP server (~6-8 hours) -- PENDING VALIDATION
**Files**: New `px-master-mcp/` directory, `src-tauri/src/lib.rs`, Tauri config
- Build MCP server exposing 5 px_* tools
- HTTP bridge between MCP server and Tauri frontend
- Configure master session to connect to px-master MCP

**Gate**: Only proceed if Phase 0 has been used for 1+ week AND cross-session coordination was needed 3+ times.

### Phase 2: System prompt injection (~2 hours) -- PENDING PHASE 1
**Files**: `src/session-lifecycle.js`, new `src/master-prompt.js`
- Inject orchestrator role description when spawning master
- Include px_* tool documentation, routing guidelines

### Phase 3: Voice routing through master (~3 hours) -- PENDING PHASE 2
**Files**: `src/voice.js`
- Tier 2 routing: ambiguous voice commands forwarded to master
- Master classifies intent and routes to appropriate worker
- Fallback: if master busy/unresponsive, use Tier 1 JS routing

### Phase 4: Agent team patterns (~future) -- PENDING PHASE 3
- Master decomposes cross-project goals into multi-session workflows
- Integrates with /gsd for within-session task decomposition
- Master maintains cross-session state in Gemini Memory

---

## Introspect Grade-A Corrections Applied

These issues were caught by `/introspect --grade` and incorporated:

1. **Tool mechanism fixed**: Original plan said "allowedTools" — wrong (that restricts built-in tools, doesn't create new ones). Corrected to MCP server as primary path.

2. **Tiered voice routing added**: Original plan routed ALL voice through master (context burn). Now: JS keyword matching handles 80% at zero tokens; only ambiguous commands hit master.

3. **Time estimates corrected**: Phase 1 revised from "2-3 hours" to "6-8 hours" (MCP server + HTTP bridge + Tauri handlers).

4. **Validation gate added**: Phase 1+ gated on 1-week observation + 3x cross-session need frequency. Prevents premature build.

5. **H2 alternative acknowledged**: JS-side keyword routing (Phase 0.5) delivers 80% of smart routing at 10% of master architecture complexity. Built first regardless.

---

## What NOT to Build
- Workers don't know about the master. Plain Claude Code sessions.
- No custom protocol. Reuse existing stdio JSON + MCP standard.
- No polling loops. Use Tauri events for async notifications.
- No duplication of /gsd. Master = across sessions, /gsd = within session.
- No persistent master state file. Master uses Gemini Memory (already in command-center).

## Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Master context burn | HIGH | Tiered voice routing. Only ambiguous commands hit master. |
| MCP server complexity | MEDIUM | ~200 LOC, same pattern as gemini-memory. Well-understood. |
| Tauri IPC async bridge | MEDIUM | Emit/respond pattern. JS handles action, returns via invoke(). |
| Master crashes | LOW | Auto-restart. Workers continue independently. |
| Anthropic changes Claude Code stdio protocol | LOW | Protocol is JSON-RPC-like, stable. sendMessage() pattern proven. |
| Over-engineering for theoretical need | MEDIUM | Validation gate: build Phase 1+ only after proving need over 1 week. |

## Key Files (for implementation reference)
- `src/app.js` (269 LOC) — bootstrap, DOMContentLoaded wiring
- `src/session.js` (182 LOC) — session state, Maps, ANIMALS, SpriteRenderer
- `src/session-lifecycle.js` (224 LOC) — createSession, spawnClaude, sendMessage
- `src/voice.js` (240 LOC) — voice bridge, PTT, always-on, routing
- `src-tauri/src/lib.rs` (189 LOC) — Tauri commands, menu
- `src-tauri/src/ws_bridge.rs` (249 LOC) — WebSocket voice bridge
