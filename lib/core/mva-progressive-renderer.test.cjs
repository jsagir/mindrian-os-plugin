/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-03 Plan 03 Task 1 -- mva-progressive-renderer tests.
 *
 * Verifies that the renderer is a pure-function module (no I/O), emits Larry-voiced
 * GUIDED text blocks per AgentResult status, hardcodes the 3-option footer with
 * `--` (not `—`), and complies with Canon Part 8 (zero raw-content access).
 *
 * Pure CJS, node built-ins only. Run via `node --test`.
 */
'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  renderAgentResult,
  renderSharpQuestionFallback,
  renderHebrewRefusal,
  renderHeader,
  renderProgressIndicator,
  renderFooter,
} = require('./mva-progressive-renderer.cjs');

test('renderer Test 1 -- ok agent renders Larry-voiced 1-line summary, em-dash-free', () => {
  const out = renderAgentResult({
    agent_id: 'brain_similar',
    status: 'ok',
    duration_ms: 12,
    payload: { summary_line: 'Found 3 ventures in this space: Honeydue (dead), Zeta (alive), Monarch (alive)' }
  });
  assert.ok(typeof out === 'string', 'must return a string');
  assert.ok(out.includes('[brain]'), 'must include brain prefix');
  assert.ok(out.includes('Found 3 ventures'), 'must include summary_line content');
  assert.equal(out.match(/—/), null, 'must have no em-dashes');
  assert.ok(out.endsWith('\n'), 'must end with newline');
});

test('renderer Test 2 -- timeout status renders progress placeholder', () => {
  const out = renderAgentResult({
    agent_id: 'brain_similar',
    status: 'timeout',
    duration_ms: 45000,
  });
  assert.ok(out.includes('[brain]'), 'must include label');
  assert.ok(/still/i.test(out), 'must indicate still-in-progress');
  assert.equal(out.match(/—/), null, 'no em-dashes');
});

test('renderer Test 3 -- error status renders skipped placeholder, sanitized', () => {
  const out = renderAgentResult({
    agent_id: 'brain_classic_traps',
    status: 'error',
    duration_ms: 50,
    error: 'this is a very long error message that should never reach the user via the rendered output and certainly not unsanitized for very long lengths'
  });
  assert.ok(out.includes('[traps]'), 'must include label');
  assert.ok(/skipped/i.test(out), 'must indicate skipped');
  // The raw error should NOT appear verbatim in the rendered output.
  assert.equal(out.includes('this is a very long error message'), false, 'must not include raw error verbatim');
  assert.equal(out.match(/—/), null, 'no em-dashes');
});

test('renderer Test 4 -- empty status with tavily_unavailable shows configuration hint', () => {
  const out = renderAgentResult({
    agent_id: 'tavily_funding',
    status: 'empty',
    duration_ms: 5,
    payload: { reason: 'tavily_unavailable' }
  });
  assert.ok(out.includes('[funding]'), 'must include funding label');
  assert.ok(out.includes('TAVILY_API_KEY') || out.includes('not configured'), 'must hint at configuration');
  assert.equal(out.match(/—/), null, 'no em-dashes');
});

test('renderer Test 5 -- sharp-question fallback is verbatim from source spec, em-dash-free', () => {
  const out = renderSharpQuestionFallback();
  assert.ok(typeof out === 'string', 'must return a string');
  assert.ok(out.includes("I didn't find precedents for this in 30 seconds"), 'must include opener');
  assert.ok(out.includes('gap in my data'), 'must include data gap clause');
  assert.ok(out.includes('genuinely unexplored space'), 'must include unexplored clause');
  assert.ok(out.includes('Which do you think it is?'), 'must include the closing question');
  assert.equal(out.match(/—/), null, 'must have no em-dashes');
});

test('renderer Test 6 -- Hebrew refusal is bilingual, em-dash-free', () => {
  const out = renderHebrewRefusal();
  assert.ok(typeof out === 'string', 'must return a string');
  assert.ok(out.includes('English'), 'must include English instruction');
  assert.ok(out.includes('v1.13.0'), 'must mention version');
  // Hebrew characters must appear
  assert.ok(/[֐-׿]/.test(out), 'must include Hebrew characters');
  assert.equal(out.match(/—/), null, 'no em-dashes');
});

test('renderer Test 7 -- renderHeader produces 2-line opener with sha8 and progress', () => {
  const out = renderHeader('abcd1234');
  assert.ok(typeof out === 'string', 'must return a string');
  assert.ok(out.includes('abcd1234'), 'must include sha8');
  assert.ok(/scanning/i.test(out), 'must include scanning verb');
  const lines = out.split('\n').filter((l) => l.length > 0);
  assert.ok(lines.length >= 2, `must be at least 2 lines, got ${lines.length}`);
  assert.equal(out.match(/—/), null, 'no em-dashes');
});

test('renderer Test 8 -- renderProgressIndicator shows progress with elapsed/budget/returned', () => {
  const out = renderProgressIndicator(12000, 45000, 3);
  assert.ok(typeof out === 'string', 'must return a string');
  assert.ok(out.includes('12') || out.includes('12s'), 'must include elapsed seconds');
  assert.ok(out.includes('45'), 'must include budget seconds');
  assert.ok(out.includes('3'), 'must include returned count');
  assert.equal(out.match(/—/), null, 'no em-dashes');

  // Edge cases
  const zero = renderProgressIndicator(0, 45000, 0);
  assert.ok(zero.includes('0'), 'edge: 0 elapsed');
  const full = renderProgressIndicator(45000, 45000, 6);
  assert.ok(full.includes('45'), 'edge: full elapsed');
  assert.equal(zero.match(/—/), null);
  assert.equal(full.match(/—/), null);
});

test('renderer Test 8b (CRITICAL-6) -- renderFooter returns hardcoded 3-option footer, em-dash-free', () => {
  const out = renderFooter();
  assert.ok(typeof out === 'string', 'must return a string');
  assert.ok(out.includes('What now?'), 'must include question opener');
  assert.ok(out.includes('[1] Just tell me'), 'must include option 1');
  assert.ok(out.includes('[2] Build a room'), 'must include option 2');
  assert.ok(out.includes('[3] Challenge me'), 'must include option 3');
  // CRITICAL invariant: em-dash-free
  assert.equal(out.match(/—/), null, 'footer must have no em-dashes');
  // CRITICAL invariant: literal `--` substring present
  assert.ok(out.includes("Challenge me -- Devil's Advocate"), "must contain literal 'Challenge me -- Devil's Advocate' with `--`");
});

test('renderer Test 9 -- renderer source is pure (no fs/process/console)', () => {
  const src = fs.readFileSync(path.join(__dirname, 'mva-progressive-renderer.cjs'), 'utf8');

  // Strip block comments to avoid false-positives in the "pure" assertion.
  // The renderer documents its purity in comments; tokens inside /* ... */ are not
  // executable references and must not trip the source-scan.
  const noBlockComments = src.replace(/\/\*[\s\S]*?\*\//g, '');
  // Also strip line comments so the documentation that explicitly names
  // forbidden tokens (e.g. "// no fs.* / no process.* / no console.*") does
  // not trip the scan. These are intentional self-documentation, not refs.
  const code = noBlockComments.replace(/\/\/[^\n]*/g, '');

  // Allow `require('fs')` to be absent; verify there is no actual fs.* call.
  assert.equal(/\brequire\s*\(\s*['"]node:fs['"]\s*\)/.test(code), false, 'must not require node:fs');
  assert.equal(/\brequire\s*\(\s*['"]fs['"]\s*\)/.test(code), false, 'must not require fs');
  assert.equal(/\bfs\./.test(code), false, 'must not call fs.*');
  assert.equal(/\bprocess\./.test(code), false, 'must not access process.*');
  assert.equal(/\bconsole\./.test(code), false, 'must not call console.*');
});
