//! oracle.rs — Companion oracle (direct invoke from voice.js)
//!
//! Handles the oracle_query Tauri command: builds context from recent session
//! activity, constructs a prompt, calls claude -p, returns the reply.

use std::collections::HashMap;
use serde_json::Value;
use tokio::sync::Semaphore;
use std::sync::Arc;

use super::daemon::{
    call_claude, expand_home, now_s, load_buddy, load_companion,
    str_val, coalesce, DaemonShared, ConvoEntry,
};

// ── Oracle system-prompt builder ──────────────────────────────────────────────

pub(crate) fn build_oracle_system(sessions: &[Value]) -> String {
    let companion = load_companion();
    let buddy     = load_buddy();
    let name        = coalesce(str_val(&companion, "name"),        str_val(&buddy, "name"),        "Vexil");
    let personality = coalesce(str_val(&companion, "personality"), str_val(&buddy, "personality"), "");

    // Trait line
    let species   = str_val(&buddy, "species");
    let voice     = str_val(&buddy, "voice");
    let peak_stat = buddy.get("stats").and_then(|s| s.as_object()).and_then(|m| {
        m.iter().max_by(|a, b| {
            a.1.as_f64().unwrap_or(0.0).partial_cmp(&b.1.as_f64().unwrap_or(0.0))
                .unwrap_or(std::cmp::Ordering::Equal)
        }).map(|(k, v)| (k.clone(), v.as_f64().unwrap_or(0.0)))
    });

    let mut trait_line = String::new();
    if !species.is_empty()                                     { trait_line.push_str(&format!("Species: {species}.")); }
    if !voice.is_empty() && voice != "default"                 { trait_line.push_str(&format!(" Voice: {voice}.")); }
    if let Some((ref stat, val)) = peak_stat { trait_line.push_str(&format!(" Peak trait: {stat} {val}/10.")); }

    if sessions.is_empty() {
        let mut ctx = if personality.is_empty() { String::new() } else { format!("{personality}\n\n") };
        if !trait_line.is_empty() { ctx.push_str(&trait_line); ctx.push('\n'); }
        ctx.push_str(&format!("You are {name}. No sessions open — you're blind right now. Tell the user to press + to open a project folder. One sentence."));
        return ctx;
    }

    let sessions_str: Vec<String> = sessions.iter().map(|s| {
        format!("{} ({})", str_val(s, "name"), str_val(s, "cwd"))
    }).collect();

    let mut ctx = if personality.is_empty() { String::new() } else { format!("{personality}\n\n") };
    ctx.push_str(&format!("You are {name}, watching Claude Code sessions.\nOpen sessions: {}.\n", sessions_str.join("; ")));
    if !trait_line.is_empty() { ctx.push_str(&trait_line); ctx.push('\n'); }
    ctx.push_str("\nAnswer directly from what you know. Be opinionated and specific. 2 sentences max. Cut to the insight, not the description.");
    ctx
}

// ── Core oracle call ──────────────────────────────────────────────────────────

/// Shared by oracle_query Tauri command.
/// Takes pre-snapshotted activity/convo state so lock is not held during I/O.
pub(crate) async fn run_oracle(
    message:  String,
    history:  Vec<Value>,
    sessions: Vec<Value>,
    ra_snap:  HashMap<String, Vec<(f64, String, String)>>,
    cv_snap:  HashMap<String, Vec<ConvoEntry>>,
    sem:      &Arc<Semaphore>,
) -> Option<String> {
    let now = now_s();

    let mut activity_lines = Vec::new();
    for (sid, acts) in &ra_snap {
        let filtered: Vec<&(f64, String, String)> = acts.iter()
            .filter(|(ts, _, _)| now - ts < 300.0).collect();
        let recent: Vec<String> = filtered.iter().rev().take(4).rev()
            .map(|(_, t, h)| if h.is_empty() { t.clone() } else { format!("{t}({h})") })
            .collect();
        if !recent.is_empty() {
            activity_lines.push(format!("  session {}: {}", &sid[..sid.len().min(8)], recent.join(", ")));
        }
    }

    let mut convo_lines = Vec::new();
    if let Some((_, turns)) = cv_snap.iter().max_by(|a, b| {
        let at = a.1.last().map(|e| e.0).unwrap_or(0.0);
        let bt = b.1.last().map(|e| e.0).unwrap_or(0.0);
        at.partial_cmp(&bt).unwrap_or(std::cmp::Ordering::Equal)
    }) {
        let last2: Vec<&ConvoEntry> = turns.iter().rev().take(2).collect::<Vec<_>>().into_iter().rev().collect();
        for (_, um, tt) in last2 {
            if !um.is_empty() { convo_lines.push(format!("USER: {}", &um[..um.len().min(300)])); }
            if !tt.is_empty() { convo_lines.push(format!("CLAUDE: {}", &tt[..tt.len().min(600)])); }
        }
    }

    let companion = load_companion();
    let buddy     = load_buddy();
    let name = coalesce(str_val(&companion, "name"), str_val(&buddy, "name"), "Vexil");

    let mut system = build_oracle_system(&sessions);
    if !activity_lines.is_empty() { system.push_str(&format!("\nRecent tool activity:\n{}\n", activity_lines.join("\n"))); }
    if !convo_lines.is_empty()    { system.push_str(&format!("Recent session conversation:\n{}\n", convo_lines.join("\n"))); }

    let mut lines = vec![system, String::new(), "--- Conversation ---".to_string()];
    for turn in &history {
        let role = if turn["role"].as_str() == Some("user") { "USER" } else { &name.to_uppercase() };
        lines.push(format!("{role}: {}", turn["content"].as_str().unwrap_or("")));
    }
    lines.push(format!("USER: {message}"));
    lines.push(format!("{}:", name.to_uppercase()));
    let full_prompt = lines.join("\n");

    let (model, timeout) = if sessions.is_empty() { ("claude-haiku-4-5-20251001", 12) } else { ("claude-sonnet-4-6", 30) };
    call_claude(full_prompt, model, &["--bare"], timeout, sem).await
}

// ── Startup check ─────────────────────────────────────────────────────────────

pub(crate) async fn check_claude_path() -> bool {
    match tokio::process::Command::new("which").arg("claude").output().await {
        Ok(o) if o.status.success() => {
            println!("[daemon] claude at: {}", String::from_utf8_lossy(&o.stdout).trim());
            true
        }
        _ => { eprintln!("[daemon] WARNING: 'claude' not on PATH — commentary disabled"); false }
    }
}

// ── Tauri command ─────────────────────────────────────────────────────────────

/// Called directly from voice.js via invoke('oracle_query', {...}).
#[tauri::command]
pub async fn oracle_query(
    message:  String,
    history:  Vec<Value>,
    req_id:   u64,
    sessions: Vec<Value>,
    state:    tauri::State<'_, Arc<DaemonShared>>,
) -> Result<Value, String> {
    // Snapshot activity/convo without holding the lock during the claude call
    let (ra_snap, cv_snap) = {
        let st = state.state.lock().map_err(|e| e.to_string())?;
        let ra: HashMap<String, Vec<(f64, String, String)>> = st.recent_activity.iter()
            .map(|(k, v)| (k.clone(), v.iter().map(|(ts, t, h, _, _)| (*ts, t.clone(), h.clone())).collect()))
            .collect();
        let cv: HashMap<String, Vec<ConvoEntry>> = st.session_convo.iter()
            .map(|(k, v)| (k.clone(), v.iter().cloned().collect()))
            .collect();
        (ra, cv)
    };

    let reply = run_oracle(message, history, sessions, ra_snap, cv_snap, &state.sem).await
        .ok_or_else(|| "oracle unreachable".to_string())?;

    println!("[daemon] oracle_query → \"{}\"", &reply[..reply.len().min(80)]);
    Ok(serde_json::json!({"msg": reply, "req_id": req_id}))
}
