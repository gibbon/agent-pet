import { invoke } from '@tauri-apps/api/core';
import { BUILTIN_STATES } from './registry.js';

const labels = new Map([
  ['idle', 'Idle'],
  ['thinking', 'Thinking'],
  ['building', 'Building'],
  ['delegating', 'Delegating'],
  ['success', 'Success'],
  ['error', 'Error'],
  ['greeting', 'Greeting'],
  ['waiting', 'Waiting'],
  ['leaving', 'Leaving'],
]);

let active = '';

function status(text) {
  document.getElementById('status').textContent = text;
}

function titleCase(value) {
  return labels.get(value) ?? value.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function markActive(value) {
  active = value;
  for (const button of document.querySelectorAll('[data-preview]')) {
    button.dataset.active = button.dataset.preview === active ? 'true' : 'false';
  }
}

async function previewState(state) {
  await invoke('preview_state', { state });
  markActive(state);
  status(`Previewing ${titleCase(state)}`);
}

async function previewAction(action) {
  await invoke('preview_action', { action });
  markActive(action);
  status(`Playing ${titleCase(action)}`);
}

async function say(text) {
  await invoke('preview_say', { text });
  status('Sent preview message');
}

function makeButton(value, kind, handler) {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.preview = value;
  button.innerHTML = `<span class="label"></span><span class="kind"></span>`;
  button.querySelector('.label').textContent = titleCase(value);
  button.querySelector('.kind').textContent = kind;
  button.addEventListener('click', () => {
    handler(value).catch((err) => status(`Preview failed: ${err}`));
  });
  return button;
}

function renderRegistry(actions) {
  const statesEl = document.getElementById('states');
  const actionsEl = document.getElementById('actions');
  statesEl.textContent = '';
  actionsEl.textContent = '';

  const registry = new Set(actions);
  for (const state of BUILTIN_STATES) {
    if (registry.has(state)) statesEl.appendChild(makeButton(state, 'state', previewState));
  }

  const custom = actions.filter((action) => !BUILTIN_STATES.includes(action));
  for (const action of custom) {
    actionsEl.appendChild(makeButton(action, 'action', previewAction));
  }
  document.getElementById('empty-actions').hidden = custom.length > 0;
  status(`${actions.length} animations available`);
}

for (const button of document.querySelectorAll('[data-state]')) {
  button.addEventListener('click', () => {
    previewState(button.dataset.state).catch((err) => status(`Preview failed: ${err}`));
  });
}

for (const button of document.querySelectorAll('[data-say]')) {
  button.addEventListener('click', () => {
    say(button.dataset.say).catch((err) => status(`Message failed: ${err}`));
  });
}

invoke('animation_registry')
  .then(renderRegistry)
  .catch((err) => status(`Could not load animations: ${err}`));
