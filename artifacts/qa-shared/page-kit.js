// Browser-side helpers shared by the admin-panel QA harnesses. Pages import
// ./guard.js first, then this kit. Nothing here talks to a server.
import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import {api} from '/src/lib/api.js';
import {useAuthStore} from '/src/store/authStore.js';
import {blocked} from './guard.js';

// Any axios call through the shared client that a harness did not stub is
// refused locally (never sent) and recorded.
api.defaults.adapter = config => {
  blocked.push({kind: 'axios', url: String(config.url)});
  const error = new Error(`QA network guard refused axios ${config.method} ${config.url}`);
  error.code = 'ERR_NETWORK';
  error.config = config;
  return Promise.reject(error);
};

export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
export const assert = (value, message) => { if (!value) throw new Error(message); };
export const eq = (actual, expected, message) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${message}: expected ${e}, got ${a}`);
};
export async function waitFor(check, description, timeout = 5000) {
  const start = performance.now();
  let last;
  while (performance.now() - start < timeout) {
    try { const value = check(); if (value) return value; } catch (error) { last = error; }
    await sleep(20);
  }
  throw new Error(`Timed out waiting for ${description}${last ? ` (${last.message})` : ''}`);
}

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const region = (label, root = document) => [...root.querySelectorAll('[aria-label]')].find(el => el.getAttribute('aria-label') === label) || null;
export const text = (root = document.body) => (root?.textContent || '').replace(/\s+/g, ' ').trim();
export const buttons = (root = document) => $$('button', root);
export const button = (label, root = document) => buttons(root).find(b => text(b) === label || b.getAttribute('aria-label') === label) || null;
export const alerts = (root = document) => $$('[role="alert"]', root).map(el => text(el));
export const statuses = (root = document) => $$('[role="status"]', root).map(el => text(el));
export const hasText = (fragment, root = document.body) => text(root).includes(fragment);

export function setValue(element, value) {
  assert(element, 'setValue: element missing');
  const proto = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype
    : element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, 'value').set.call(element, value);
  // flushSync: each edit re-renders before the next one, as with a real user.
  flushSync(() => element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', {bubbles: true})));
}
export function click(element, description = 'element') {
  assert(element, `click: ${description} missing`);
  assert(!element.disabled, `click: ${description} is disabled`);
  flushSync(() => element.click());
}
export const isDisabled = element => Boolean(element?.disabled || element?.closest('fieldset:disabled'));

// A stub for the services' injected request(path, options) transport. The
// handler gets {method, path, body} and returns {status, body}. Every call is
// recorded; nothing leaves the page.
export function stubRequest(handler) {
  const calls = [];
  const request = async (path, options = {}) => {
    const call = {method: options.method || 'GET', path, body: options.body === undefined ? undefined : JSON.parse(options.body)};
    calls.push(call);
    const reply = await handler(call);
    const status = reply?.status ?? 200;
    return {ok: status >= 200 && status < 300, status, json: async () => structuredClone(reply?.body ?? null)};
  };
  return {calls, request};
}

// An axios-style error as the shared client rejects it.
export const httpError = (status, data) => Object.assign(new Error(`Request failed with status code ${status}`), {response: {status, data}});

export function signIn(user = {role: 'admin', is_admin: true}, token = 'qa-session-token') {
  useAuthStore.setState({isAuthenticated: true, accessToken: token, user});
}
export function signOut() {
  useAuthStore.setState({isAuthenticated: false, accessToken: null, user: null});
}

let root;
export function mount(element) {
  if (root) root.unmount();
  const container = document.getElementById('root');
  container.innerHTML = '';
  root = createRoot(container);
  root.render(element);
}

// Outcome words that must never appear unless the server confirmed them.
export function assertNoSuccessClaims(scope = document.body, words = ['flat', 'completed successfully', 'succeeded']) {
  const body = text(scope).toLowerCase();
  for (const word of words) assert(!body.includes(word.toLowerCase()), `unexpected success claim "${word}"`);
}

export function defineSteps(list) {
  window.qa = {
    steps: list.map(([name]) => name),
    blocked,
    async run(name) {
      const step = list.find(([candidate]) => candidate === name);
      if (!step) throw new Error(`Unknown step ${name}`);
      const before = blocked.length;
      const result = await step[1]();
      if (blocked.length !== before) throw new Error(`Step ${name} attempted a network call: ${JSON.stringify(blocked.slice(before))}`);
      return result ?? true;
    },
  };
}
