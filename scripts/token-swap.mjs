// One-shot: replace hardcoded MT5/VSCode chrome hex colors with CSS token refs.
// Preserves data-meaning colors (#22c55e success, #ef4444 danger, #f59e0b warning,
// #3b82f6/#1d4ed8 info, #4ade80, #4ec9b0, #f48771, #f4c96e, #9cdcfe).

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('src/components');

// dark hex → CSS variable name (without var() wrapper)
const MAP = {
  '#1a1a1a': '--bg-app',
  '#1e1e1e': '--bg-app',
  '#252526': '--bg-surface-1',
  '#2a2a2a': '--bg-surface-1',
  '#2b2b2b': '--bg-surface-1',
  '#2d2d2d': '--bg-surface-1',
  '#2d2d30': '--bg-surface-1',
  '#333333': '--bg-surface-2',
  '#3c3c3c': '--bg-surface-2',
  '#3c3f41': '--bg-surface-2',
  '#3e3e42': '--border-default',
  '#444444': '--bg-surface-3',
  '#454545': '--bg-surface-3',
  '#4a4a4a': '--bg-surface-3',
  '#505050': '--border-strong',
  '#555555': '--border-strong',
  '#666666': '--text-muted',
  '#a0a0a0': '--text-muted',
  '#aaaaaa': '--text-muted',
  '#808080': '--text-muted',
  '#888888': '--text-muted',
  '#cccccc': '--text-secondary',
  '#d1d1d1': '--text-primary',
  '#e0e0e0': '--text-primary',
  '#e1e1e1': '--text-primary',
  '#007acc': '--accent-500',
  '#0098ff': '--accent-500',
  '#005a9e': '--accent-700',
  '#094771': '--accent-700',
  '#3e1e1e': '--bg-surface-2',
};

// Build a single alternation regex for all keys (case-insensitive)
const hexAlternation = Object.keys(MAP).map((h) => h.replace('#', '\\#')).join('|');

// 1. Tailwind arbitrary value: [#xxxxxx]  →  [color:var(--token)]
const tailwindRe = new RegExp(`\\[(${hexAlternation})\\]`, 'gi');
// 2. String-literal inside {...}: '#xxxxxx' or "#xxxxxx"  →  'var(--token)'
const stringRe = new RegExp(`(['"\\\`])(${hexAlternation})\\1`, 'gi');

let filesChanged = 0;
let replacements = 0;

function tokenFor(hex) {
  return MAP[hex.toLowerCase()];
}

function processFile(p) {
  let src = fs.readFileSync(p, 'utf8');
  let changed = false;

  src = src.replace(tailwindRe, (match, hex) => {
    const tok = tokenFor(hex);
    if (!tok) return match;
    replacements++;
    changed = true;
    return `[color:var(${tok})]`;
  });

  src = src.replace(stringRe, (match, quote, hex) => {
    const tok = tokenFor(hex);
    if (!tok) return match;
    replacements++;
    changed = true;
    return `${quote}var(${tok})${quote}`;
  });

  if (changed) {
    fs.writeFileSync(p, src);
    filesChanged++;
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const p = path.join(dir, entry);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p);
    else if (/\.jsx?$/.test(entry)) processFile(p);
  }
}

walk(ROOT);
console.log(`Files changed:              ${filesChanged}`);
console.log(`Hex → token replacements:   ${replacements}`);
