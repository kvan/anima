// ── Operational logger — routes through js_log Rust command ──
// js_log → println! → stdout → captured by tee in launch.command
// Fire-and-forget via invoke. Zero overhead on failure.

const { invoke } = window.__TAURI__.core;

export function pxLog(level, ...parts) {
  const ts = new Date().toISOString().slice(11, 23); // HH:MM:SS.mmm
  const msg = `${ts} [${level}] ${parts.join(' ')}`;
  invoke('js_log', { msg }).catch(() => {});
}
