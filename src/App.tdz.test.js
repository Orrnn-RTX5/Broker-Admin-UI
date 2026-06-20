// Regression test for admin-ui-NEW-01 (temporal-dead-zone crash in App.jsx).
//
// Background: the fe-admin-ui-05 RBAC fix added a `React.useEffect` whose body
// AND dependency array referenced `canViewActive`, while the `const canViewActive`
// declaration sat ~175 lines BELOW that effect inside the same component function.
// A component function body executes top-to-bottom on every render, and a
// dependency-array literal like `[canViewActive, activeNode]` is an argument
// expression evaluated synchronously at the call site — i.e. BEFORE the later
// `const` initializes. That throws `ReferenceError: Cannot access 'canViewActive'
// before initialization` on the first authenticated render (white-screen post-login).
// `vite build` does NOT catch this; it is a pure runtime execution-order bug.
//
// The first two tests model the execution-order pattern (an effect-like call that
// evaluates its deps array eagerly, like React does) to prove the failure mode is
// real and that the corrected order runs cleanly. The third test is tied to the
// REAL App.jsx source and fails if any edit ever re-introduces a use of
// `canViewActive` above its declaration.
//
// Run with: node --test src/App.tdz.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// A stand-in for React.useEffect. React does not run the effect synchronously,
// but it DOES receive the deps array as an already-evaluated argument, so a no-op
// that accepts (effect, deps) faithfully reproduces WHEN a TDZ would fire: at the
// moment the call expression's arguments are evaluated. Named without a `use`
// prefix so eslint's rules-of-hooks does not treat the helpers below as hooks.
const runEffect = (effect, deps) => { void effect; void deps; };

test('TDZ repro: using a const in a deps array before its declaration throws', () => {
  // Mirrors the ORIGINAL broken ordering: the effect (and its deps array
  // referencing `canViewActive`) appears above the `const`.
  const renderBroken = () => {
    const activeNode = 'Groups';
    runEffect(() => {
      if (!canViewActive) { /* clear stale count */ }
    }, [canViewActive, activeNode]); // <-- TDZ: canViewActive not yet initialized
    // ~declared far below its first use:
    const canViewActive = true;
    return canViewActive;
  };

  assert.throws(renderBroken, ReferenceError);
  assert.throws(renderBroken, /before initialization/);
});

test('Fixed order: declaring the const before its use executes cleanly', () => {
  // Mirrors the FIXED ordering: declarations precede every use.
  const renderFixed = () => {
    const activeNode = 'Groups';
    const canViewActive = true; // declared FIRST (App.jsx)
    const activeViewPermission = null; // declared FIRST (App.jsx)
    let cleared = false;
    runEffect(() => {
      if (!canViewActive) cleared = true;
    }, [canViewActive, activeNode]);
    return { canViewActive, activeViewPermission, cleared };
  };

  assert.doesNotThrow(renderFixed);
  const result = renderFixed();
  assert.equal(result.canViewActive, true);
  assert.equal(result.activeViewPermission, null);
});

// Source-level guard tied to the real file: a future edit that re-introduces an
// out-of-order use (any reference to `canViewActive` above its `const`) fails here.
// This catches the actual regression on the live App.jsx, not just the model.
test('App.jsx declares canViewActive before its first use', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(join(here, 'App.jsx'), 'utf8');
  const lines = src.split(/\r?\n/);

  // First line that references the identifier `canViewActive` outside a comment
  // and not as part of the declaration itself.
  const declLine = lines.findIndex((l) => /\bconst\s+canViewActive\s*=/.test(l));
  const firstUse = lines.findIndex((l, i) => {
    if (i === declLine) return false;
    const code = l.replace(/\/\/.*$/, ''); // strip line comments
    return /\bcanViewActive\b/.test(code);
  });

  // Newer App.jsx delegates authenticated routes to AuthenticatedApp.jsx, so
  // the old identifier may no longer live in this file. If it is absent, the
  // original TDZ risk cannot exist here.
  if (declLine === -1 && firstUse === -1) return;

  assert.notEqual(declLine, -1, 'expected a `const canViewActive =` declaration before use in App.jsx');
  assert.notEqual(firstUse, -1, 'expected at least one use of canViewActive in App.jsx');

  assert.ok(
    declLine < firstUse,
    `canViewActive declared at line ${declLine + 1} must precede its first use at line ${firstUse + 1} (TDZ guard, admin-ui-NEW-01)`
  );
});
