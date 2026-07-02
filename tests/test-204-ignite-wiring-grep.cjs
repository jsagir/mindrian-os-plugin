'use strict';
/*
 * Phase 204-03 -- ignite wiring proof (grep-based prose assertion).
 * =========================================================================
 * Plan 204-03 wires the room-chooser (Plan 204-01) and session-register
 * (Plan 204-02) into the live /mos:ignite front door. This test is the
 * prose-assertion proof the wiring actually landed on disk, mirroring the
 * 115/179 grep-test pattern (read the file with node:fs, plain includes()
 * substring checks, a running PASS counter, non-zero exit on any failure).
 *
 * It asserts ONLY that the surfaces carry the load-bearing wiring strings; it
 * runs no ignite flow. Zero npm deps, node built-ins only. Canon Part 8: zero
 * Brain / network reach. House rule: hyphens only, NO em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.join(__dirname, '..');
const EM_DASH = String.fromCharCode(0x2014); // U+2014, referenced by codepoint so this file stays em-dash-clean

let pass = 0;
function ok(name, cond) {
  assert.ok(cond, name);
  console.log('  ok - ' + name);
  pass += 1;
}

function read(rel) {
  return fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8');
}

// --------------------------------------------------------------------------
// commands/ignite.md -- the Gate B0 room-chooser wiring + persona threading
// --------------------------------------------------------------------------
const ignite = read('commands/ignite.md');
for (const needle of [
  'Gate B0',
  'room-chooser.cjs',
  'session-register.cjs',
  'resolvePick',
  'personaContext',
]) {
  ok('commands/ignite.md contains "' + needle + '"', ignite.includes(needle));
}

// --------------------------------------------------------------------------
// skills/conversation-mode/SKILL.md -- the Lane Picker cross-reference
// --------------------------------------------------------------------------
const skill = read('skills/conversation-mode/SKILL.md');
ok('skills/conversation-mode/SKILL.md contains "ignite"', skill.includes('ignite'));

// --------------------------------------------------------------------------
// docs/CANON-PHASE-MAP.md -- the Phase 204 ledger row
// --------------------------------------------------------------------------
const canonMap = read('docs/CANON-PHASE-MAP.md');
ok('docs/CANON-PHASE-MAP.md contains "204"', canonMap.includes('204'));

// --------------------------------------------------------------------------
// Zero em-dashes (U+2014) across all three wired surfaces (CLAUDE.md HARD RULE)
// --------------------------------------------------------------------------
for (const [rel, body] of [
  ['commands/ignite.md', ignite],
  ['skills/conversation-mode/SKILL.md', skill],
  ['docs/CANON-PHASE-MAP.md', canonMap],
]) {
  const idx = body.indexOf(EM_DASH);
  ok('zero em-dashes in ' + rel, idx === -1);
}

console.log('\nPASS ' + pass + ' assertions (204 ignite wiring grep)');
process.exit(0);
