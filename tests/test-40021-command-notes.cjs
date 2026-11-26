#!/usr/bin/env node
'use strict';
// Phase 400.2.1: the command text of /mos:persona names the fixes of S4, S6, S7, S8, S9 and S10.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..');
const text = fs.readFileSync(path.join(ROOT, 'commands', 'persona.md'), 'utf8');
const mirror = fs.readFileSync(path.join(ROOT, 'skills', 'persona', 'SKILL.md'), 'utf8');

let failed = 0;
let passed = 0;
function check(label, fn) {
  try { fn(); passed += 1; console.log('ok: ' + label); } catch (e) { failed += 1; console.log('FAIL: ' + label + ' -- ' + (e && e.message ? e.message : String(e))); }
}
function section(head) {
  const at = text.indexOf(head);
  assert.ok(at !== -1, 'missing ' + head);
  const next = text.indexOf('\n### ', at + head.length);
  return text.slice(at, next === -1 ? undefined : next);
}

check('T1. S9: the capability rule says, as a condition, to dispatch from a cwd outside any git work tree when a worktree path guard refuses a hat Write', () => {
  assert.ok(text.includes("Worktree note: if a hat agent's Write is refused by a worktree path guard, dispatch from a cwd outside any git work tree."));
});
check('T2. S6: Step 9 offers the delegated ruling in the free-text field and names larry_pick and the delegated flag', () => {
  const s = section('### Step 9');
  assert.ok(s.includes('Or type "Larry decides" to hand this ruling to Larry.'));
  assert.ok(s.includes('"ruling": "delegated"') && s.includes('"larry_pick"'));
  assert.ok(s.includes('Larry picks, the navigator confirms.'));
  assert.ok(s.includes('"navigator_confirmed": true'));
  assert.ok(s.includes('Never write a delegated entry without that yes'));
  assert.ok(s.includes('delegated: true'));
  assert.ok(s.includes('delegated to Larry: yes'));
  for (const a of ['side_a', 'side_b', 'both hold', 'defer']) assert.ok(s.includes(a), a);
});
check('T3. S4 and S7: Step 5 prints plain_lines and the count of dropped off-topic results', () => {
  const s = section('### Step 5');
  assert.ok(s.includes('`plain_lines`'));
  assert.ok(s.includes('dropped_below_floor.<hat>'));
});
check('T4. S8: the Blue contract names the coverage list', () => {
  assert.ok(/`coverage` list gives, for each sub-question id/.test(text));
});
check('T5. S10: the search card shows the guidance sentence of a refused handle', () => {
  assert.ok(text.includes('and the `guidance` sentence when the entry has one'));
});
check('T6. the skill mirror carries the same notes', () => {
  for (const s of ['Worktree note:', 'Larry decides', '`plain_lines`', '`coverage` list', '`guidance` sentence']) assert.ok(mirror.includes(s), s);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
