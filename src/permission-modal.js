/**
 * permission-modal.js — Anima permission gate modal (4-button variant).
 *
 * Owned DOM: creates #perm-overlay on first show, reuses thereafter. The caller
 * provides {tool, input} and a single callback invoked with one of:
 *   'allow_once' | 'allow_always' | 'deny' | 'deny_pause'
 *
 * Pure UI + event plumbing — no IPC, no persistence. The caller (companion.js)
 * owns file writes; persistence of allow_always lands in P2.E.
 */

const ACTIONS = new Set(['allow_once', 'allow_always', 'deny', 'deny_pause']);

let _root = null;
let _toolEl = null;
let _summaryEl = null;
let _currentCallback = null;

export function buildInputSummary(tool, input = {}) {
  if (input == null || typeof input !== 'object') return { label: 'input', value: '(none)' };
  if (tool === 'Bash') {
    const cmd = String(input.command ?? '').replace(/\s+/g, ' ').trim();
    return { label: 'command', value: cmd.slice(0, 240) || '(empty)' };
  }
  if (tool === 'Read' || tool === 'Write' || tool === 'Edit' || tool === 'MultiEdit') {
    return { label: 'file', value: String(input.file_path ?? '(unspecified)') };
  }
  if (tool === 'Grep' || tool === 'Glob') {
    return { label: 'pattern', value: String(input.pattern ?? input.query ?? '(unspecified)') };
  }
  const pairs = Object.entries(input)
    .slice(0, 3)
    .map(([k, v]) => {
      const val = v == null ? '∅' : (typeof v === 'string' ? v : JSON.stringify(v));
      return `${k}=${String(val).slice(0, 80)}`;
    });
  return { label: 'input', value: pairs.join(' · ') || '(none)' };
}

function ensureMounted() {
  if (_root && typeof document !== 'undefined' && document.body && document.body.contains(_root)) return;

  const overlay = document.createElement('div');
  overlay.id = 'perm-overlay';
  overlay.className = 'hidden';
  overlay.innerHTML = `
    <div id="perm-box">
      <div id="perm-label">△ PERMISSION REQUEST</div>
      <div id="perm-tool"></div>
      <div id="perm-summary"></div>
      <div id="perm-btns">
        <button data-action="deny_pause" class="perm-btn perm-btn-danger">deny + pause</button>
        <button data-action="deny" class="perm-btn">deny</button>
        <button data-action="allow_always" class="perm-btn perm-btn-accent-outline">allow always</button>
        <button data-action="allow_once" class="perm-btn perm-btn-accent">allow once</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  _root = overlay;
  _toolEl = overlay.querySelector('#perm-tool');
  _summaryEl = overlay.querySelector('#perm-summary');

  overlay.querySelectorAll('#perm-btns button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (!ACTIONS.has(action)) return;
      const cb = _currentCallback;
      _currentCallback = null;
      hide();
      if (cb) cb(action);
    });
  });
}

export function showPermissionModal({ tool, input }, onAction) {
  ensureMounted();
  _toolEl.textContent = tool || 'unknown';
  const { label, value } = buildInputSummary(tool, input);
  _summaryEl.textContent = `${label}: ${value}`;
  _currentCallback = typeof onAction === 'function' ? onAction : null;
  _root.classList.remove('hidden');
}

export function hidePermissionModal() {
  hide();
}

export function isPermissionModalOpen() {
  return !!(_root && !_root.classList.contains('hidden'));
}

function hide() {
  if (_root) _root.classList.add('hidden');
  _currentCallback = null;
}

// Test hook — allows unit tests to drive an action programmatically.
export function __testOnlyTriggerAction(action) {
  if (!ACTIONS.has(action)) throw new Error(`unknown action: ${action}`);
  const cb = _currentCallback;
  _currentCallback = null;
  hide();
  if (cb) cb(action);
}
