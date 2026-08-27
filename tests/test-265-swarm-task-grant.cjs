#!/usr/bin/env node
// Phase 265-03 (RADAR-07) -- set-equality tripwire for the Task allowed-tools grant.
//
// T-265-08 / navigator decision (Open Question 4, SETTLED "Add Task"): exactly
// three swarm commands (act.md --swarm, persona.md --parallel, grade.md --full)
// carry `Task` in their `allowed-tools` frontmatter list, each with a written
// pre-approval reason. This is a genuine, reviewed privilege grant -- not a
// mechanical docs edit -- so a fourth command silently acquiring the same grant
// must fail this test.
//
// Frontmatter is sliced with a plain fence-delimited read (no YAML dependency),
// mirroring the hand-rolled parser already used in lib/core/mva-rule-linter.cjs.
//
// Plain Node script, no node:test. Hyphens only (no em-dashes).
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const COMMANDS_DIR = path.join(ROOT, 'commands');

const EXPECTED = new Set(['act.md', 'persona.md', 'grade.md']);

// ---------------------------------------------------------------------------
// sliceFrontmatter(content) -> raw frontmatter text between the --- fences,
// or null if the file has no fenced frontmatter block.
// ---------------------------------------------------------------------------
function sliceFrontmatter(content) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// allowedToolsList(frontmatterText) -> array of tool-list entries under the
// `allowed-tools:` key, or [] if the key is absent. Handles a `- Item` dash
// list indented under `allowed-tools:`, stopping at the next top-level key
// or a comment line at column 0. Comment lines interleaved with the list
// (as Task 2 added, one above each allowed-tools block) are skipped.
// ---------------------------------------------------------------------------
function allowedToolsList(fmText) {
  const lines = fmText.split(/\r?\n/);
  const out = [];
  let inBlock = false;
  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    if (/^\s*#/.test(line)) continue; // comment line, anywhere
    if (/^allowed-tools:\s*$/.test(line)) {
      inBlock = true;
      continue;
    }
    if (inBlock) {
      if (/^\s*-\s+/.test(line)) {
        out.push(line.replace(/^\s*-\s+/, '').trim());
        continue;
      }
      if (line.trim() === '') continue; // tolerate stray blank lines
      // Any other non-list, non-comment line ends the block (next top-level key).
      inBlock = false;
    }
  }
  return out;
}

function fail(message) {
  console.error('FAIL: ' + message);
}

let failed = false;

const files = fs
  .readdirSync(COMMANDS_DIR)
  .filter((f) => f.endsWith('.md'))
  .sort();

if (files.length === 0) {
  console.error('FAIL: no commands/*.md files discovered -- directory read is broken');
  process.exit(1);
}

const grantedBy = [];
const missingReason = [];

for (const name of files) {
  const full = path.join(COMMANDS_DIR, name);
  const content = fs.readFileSync(full, 'utf8');
  const fm = sliceFrontmatter(content);
  if (fm === null) continue; // no frontmatter at all -- cannot carry the grant
  const tools = allowedToolsList(fm);
  if (tools.includes('Task')) {
    grantedBy.push(name);
    // Each grant must carry an adjacent written reason containing "pre-approval".
    if (!/pre-approval/i.test(fm)) {
      missingReason.push(name);
    }
  }
}

const grantedSet = new Set(grantedBy);

// Set-equality assertion: grantedSet must equal EXPECTED exactly.
const unexpectedGrants = grantedBy.filter((f) => !EXPECTED.has(f));
const missingGrants = [...EXPECTED].filter((f) => !grantedSet.has(f));

if (unexpectedGrants.length > 0) {
  failed = true;
  fail('Task granted to file(s) outside the reviewed set: ' + unexpectedGrants.join(', '));
}
if (missingGrants.length > 0) {
  failed = true;
  fail('Task grant missing from expected file(s): ' + missingGrants.join(', '));
}
if (missingReason.length > 0) {
  failed = true;
  fail('Task grant present without an adjacent "pre-approval" reason comment in: ' + missingReason.join(', '));
}

if (failed) {
  console.error('Offending file list: ' + JSON.stringify({ granted: grantedBy, expected: [...EXPECTED] }, null, 2));
  process.exit(1);
}

console.log('PASS: exactly ' + [...EXPECTED].sort().join(', ') + ' carry the Task pre-approval grant, each with a written reason');
console.log('PASS: test-265-swarm-task-grant (' + files.length + ' commands/*.md file(s) scanned)');
process.exit(0);
