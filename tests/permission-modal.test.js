import { beforeEach, afterEach, test, expect } from 'vitest';

async function getModule() {
  return import('../src/permission-modal.js?t=' + Math.random());
}

afterEach(() => {
  const root = document.getElementById('perm-overlay');
  if (root) root.remove();
});

test('buildInputSummary formats Bash commands to command: <cmd>', async () => {
  const { buildInputSummary } = await getModule();
  const out = buildInputSummary('Bash', { command: 'rm -rf /' });
  expect(out.label).toBe('command');
  expect(out.value).toBe('rm -rf /');
});

test('buildInputSummary truncates long Bash commands to 240 chars', async () => {
  const { buildInputSummary } = await getModule();
  const long = 'a'.repeat(500);
  const out = buildInputSummary('Bash', { command: long });
  expect(out.value.length).toBe(240);
});

test('buildInputSummary formats file tools (Write/Edit/Read/MultiEdit) with file: <path>', async () => {
  const { buildInputSummary } = await getModule();
  for (const tool of ['Write', 'Edit', 'Read', 'MultiEdit']) {
    const out = buildInputSummary(tool, { file_path: '/tmp/x.rs' });
    expect(out.label, `tool=${tool}`).toBe('file');
    expect(out.value, `tool=${tool}`).toBe('/tmp/x.rs');
  }
});

test('buildInputSummary falls back to first N key/value pairs for unknown tools', async () => {
  const { buildInputSummary } = await getModule();
  const out = buildInputSummary('Custom', { k1: 'v1', k2: 'v2', k3: 'v3', k4: 'v4' });
  expect(out.label).toBe('input');
  expect(out.value).toContain('k1=v1');
  expect(out.value).toContain('k2=v2');
  expect(out.value).toContain('k3=v3');
  expect(out.value).not.toContain('k4=v4');  // capped at 3 entries
});

test('buildInputSummary handles null/undefined input safely', async () => {
  const { buildInputSummary } = await getModule();
  expect(buildInputSummary('Bash', null).value).toBe('(none)');
  expect(buildInputSummary('Bash', undefined).value).toBe('(empty)');
});

test('showPermissionModal mounts overlay, renders tool + summary, and is hidden by default', async () => {
  const { showPermissionModal, isPermissionModalOpen } = await getModule();
  expect(document.getElementById('perm-overlay')).toBeNull();
  showPermissionModal({ tool: 'Bash', input: { command: 'ls' } }, () => {});
  const overlay = document.getElementById('perm-overlay');
  expect(overlay).not.toBeNull();
  expect(overlay.classList.contains('hidden')).toBe(false);
  expect(document.getElementById('perm-tool').textContent).toBe('Bash');
  expect(document.getElementById('perm-summary').textContent).toBe('command: ls');
  expect(isPermissionModalOpen()).toBe(true);
});

test('clicking allow_once button invokes callback exactly once with the right action', async () => {
  const { showPermissionModal } = await getModule();
  const calls = [];
  showPermissionModal({ tool: 'Bash', input: { command: 'ls' } }, (action) => calls.push(action));
  document.querySelector('#perm-btns button[data-action="allow_once"]').click();
  expect(calls).toEqual(['allow_once']);
});

test('each action button routes to its action and hides the modal', async () => {
  const { showPermissionModal, isPermissionModalOpen } = await getModule();
  for (const action of ['allow_once', 'allow_always', 'deny', 'deny_pause']) {
    let received = null;
    showPermissionModal({ tool: 'Read', input: { file_path: '/x' } }, (a) => { received = a; });
    document.querySelector(`#perm-btns button[data-action="${action}"]`).click();
    expect(received, `action=${action}`).toBe(action);
    expect(isPermissionModalOpen(), `closed after ${action}`).toBe(false);
  }
});

test('callback fires at most once even if buttons are clicked multiple times', async () => {
  const { showPermissionModal } = await getModule();
  let count = 0;
  showPermissionModal({ tool: 'Bash', input: { command: 'ls' } }, () => { count++; });
  const allow = document.querySelector('#perm-btns button[data-action="allow_once"]');
  allow.click();
  allow.click();  // second click after modal is hidden
  expect(count).toBe(1);
});

test('hidePermissionModal clears callback — subsequent button click is a no-op', async () => {
  const { showPermissionModal, hidePermissionModal } = await getModule();
  let received = null;
  showPermissionModal({ tool: 'Bash', input: { command: 'ls' } }, (a) => { received = a; });
  hidePermissionModal();
  document.querySelector('#perm-btns button[data-action="deny"]').click();
  expect(received).toBeNull();
});
