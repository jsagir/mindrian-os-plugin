'use strict';
// Phase 209-06 (H4) -- session-start stops teaching the anti-pattern.
//
// Source-assertions over scripts/session-start (a bash script; no JS module
// to require) plus a `bash -n` syntax proof.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const SESSION_START = path.join(REPO, 'scripts', 'session-start');

let n = 0;
function ok(desc, fn) { fn(); n += 1; console.log('  ok   ' + desc); }

console.log('test-209-session-start-exemplar');

const src = fs.readFileSync(SESSION_START, 'utf8');

ok('the forbidden literal "Type 1, 2, or 3" is gone', function () {
  assert.equal(src.indexOf('Type 1, 2, or 3') === -1, true);
});

ok('the MODE_MENU region instructs an AskUserQuestion fire and names SEED-021', function () {
  const modeMenuIdx = src.indexOf('MODE_MENU=');
  assert.notEqual(modeMenuIdx, -1);
  const modeMenuLine = src.slice(modeMenuIdx, src.indexOf('\n', modeMenuIdx));
  assert.equal(modeMenuLine.indexOf('AskUserQuestion') !== -1, true);
  assert.equal(modeMenuLine.indexOf('SEED-021') !== -1, true);
  // The three mode titles are still present as option content.
  assert.equal(modeMenuLine.indexOf('Just Talk') !== -1, true);
  assert.equal(modeMenuLine.indexOf('Explore + Capture') !== -1, true);
  assert.equal(modeMenuLine.indexOf('Build a Room') !== -1, true);
});

ok('the mode-routing injection line instructs the fire (not "Present the three modes below")', function () {
  const injectIdx = src.indexOf('[MindrianOS Mode Routing]');
  assert.notEqual(injectIdx, -1);
  const injectLine = src.slice(injectIdx - 50, injectIdx + 250);
  assert.equal(injectLine.indexOf('Present the three modes below') === -1, true);
  assert.equal(injectLine.indexOf('AskUserQuestion') !== -1, true);
});

ok('the "Other rooms:" prose-list injection instructs a card fire instead', function () {
  const idx = src.indexOf('Other rooms detected');
  assert.notEqual(idx, -1, 'expected the rewritten "Other rooms detected" instruction');
  const region = src.slice(idx, idx + 300);
  assert.equal(region.indexOf('AskUserQuestion') !== -1, true);
  assert.equal(src.indexOf('  Other rooms:\\n') === -1, true, 'the old bare prose-list header must be gone');
});

ok('bash -n scripts/session-start exits 0 (the script still parses)', function () {
  execFileSync('bash', ['-n', SESSION_START], { cwd: REPO, stdio: 'pipe' });
});

console.log('\nPASS test-209-session-start-exemplar (' + n + ' assertions)');
