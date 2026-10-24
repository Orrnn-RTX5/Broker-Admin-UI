import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('./ServerPropertiesPopup.jsx', import.meta.url), 'utf8');

// Every <input ...> tag in the popup (each one is single-line in this file).
const inputTags = source.match(/<input\b[^>]*>/g) || [];

test('server properties popup ships no fabricated input values', () => {
  assert.ok(inputTags.length > 0, 'expected the popup to render inputs');
  for (const tag of inputTags) {
    assert.doesNotMatch(
      tag,
      /defaultValue="[^"]+"/,
      `input must not carry a hardcoded default value: ${tag.slice(0, 120)}`,
    );
  }
});

test('password input in the server properties popup never has a default value', () => {
  const passwordTags = inputTags.filter((tag) => /type="password"/.test(tag));
  assert.ok(passwordTags.length > 0, 'expected the popup to render a password input');
  for (const tag of passwordTags) {
    assert.doesNotMatch(tag, /defaultValue/, 'a password input must never carry a default value');
  }
  assert.doesNotMatch(source, /defaultValue="password/i);
});

test('server properties popup props carry no fabricated server identity defaults', () => {
  assert.doesNotMatch(source, /MainTrade Backup Server/);
  assert.doesNotMatch(source, /serverId = "5"/);
});
