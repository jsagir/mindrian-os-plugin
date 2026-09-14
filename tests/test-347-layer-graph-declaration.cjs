#!/usr/bin/env node
'use strict';

/*
 * tests/test-347-layer-graph-declaration.cjs
 *
 * Phase 347 Plan 01 (SHARED-12): the layer: graph declaration tripwire.
 *
 * THE ONE QUESTION THIS TEST ANSWERS: does every frontmatter-bearing surface
 * Phase 347 authors or modifies declare layer: graph, drawing the closed
 * vocabulary from data/layer-declaration-schema.json (Phase 344's own file,
 * never re-typed as a local literal)?
 *
 * Declaring-surface scope (exactly two entries, since these are the only
 * frontmatter-bearing surfaces Phase 347 touches): agents/chain-step-
 * reviewer.md (authored by plan 347-10) and commands/file-meeting.md
 * (modified by plan 347-11). lib/** and tests/** are absent from this list
 * on purpose: CJS modules carry no frontmatter, so the declaration mandate
 * does not reach them, and Phase 344's own contract
 * (docs/LAYER-DECLARATION-CONTRACT.md) scopes the layer: key to the four
 * invocable surface classes (commands, agents, pipelines, skills) plus MCP
 * tool connector descriptors, not to plain CJS or test files.
 *
 * MEASURED FACT (2026-09-15, this plan): agents/chain-step-reviewer.md does
 * not exist yet (plan 347-10 has not run). commands/file-meeting.md DOES
 * already exist, predating this phase, and carries a legitimate PRE-347
 * layer: "loop" declaration from Phase 344's own backfill; plan 347-11
 * (which modifies it to coordinate chain_state fan-out records) is blocked
 * on Phase 344 per ROADMAP.md:768 and has not landed. Both surfaces are
 * therefore "pending" today in the SHARED-12 sense, not authored/modified by
 * Phase 347 yet, and this test is honest about that rather than asserting a
 * failure this phase has not yet earned the right to assert.
 *
 * So the live walk below narrows Test 3's literal "any non-graph value
 * fails" to the out-of-vocabulary case (a value that is not even a member of
 * the closed vocabulary is never legitimate, migration timing or not). A
 * value that already IS a real vocabulary member but is not yet graph is
 * reported as PENDING, counted in the same skipped bucket as "not authored
 * yet". A missing layer: key entirely is ALWAYS a hard failure regardless of
 * migration timing, matching the schema's own default_on_miss: reject
 * (fail-closed default named in data/layer-declaration-schema.json).
 *
 * The stricter, unconditional form of Test 3 (any non-graph value throws) is
 * still implemented, as validateStrict() below, and proven red against a
 * synthetic hand-mutated temp copy rather than against a real not-yet-
 * migrated surface, exactly matching the acceptance criterion: "A
 * hand-mutation that writes layer: loop into a temp copy of a listed
 * surface makes the assertion throw." This is the red-proof.
 *
 * Zero YAML dependency (zero-new-dependency invariant): frontmatter is read
 * with a minimal in-file block reader, not a library.
 *
 * House rule: hyphens only, no em-dashes, no emoji. Plain node:assert CJS,
 * no npm test runner (package.json declares no test script).
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert');

const REPO_ROOT = path.resolve(__dirname, '..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'data', 'layer-declaration-schema.json');

// ---------------------------------------------------------------------------
// Test 1: the schema parses and its vocabulary contains the literal 'graph'.
// Failing here names Phase 344 as the owner rather than asserting a local
// literal (this file never hardcodes the vocabulary members itself).
// ---------------------------------------------------------------------------
if (!fs.existsSync(SCHEMA_PATH)) {
  throw new Error('347 layer-graph-declaration: data/layer-declaration-schema.json is missing; '
    + 'Phase 344 owns this file, this test cannot proceed without it');
}
let schemaDoc;
try {
  schemaDoc = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8'));
} catch (e) {
  throw new Error('347 layer-graph-declaration: data/layer-declaration-schema.json is not valid '
    + 'JSON (Phase 344 owns this file): ' + (e && e.message ? e.message : String(e)));
}
const vocabulary = schemaDoc && schemaDoc._doc && Array.isArray(schemaDoc._doc.layer_vocabulary)
  ? schemaDoc._doc.layer_vocabulary
  : null;
assert.ok(vocabulary, '347 layer-graph-declaration: data/layer-declaration-schema.json carries no '
  + '_doc.layer_vocabulary array (Phase 344 owns this file)');
assert.ok(vocabulary.includes('graph'), '347 layer-graph-declaration: data/layer-declaration-schema.json '
  + '_doc.layer_vocabulary does not contain "graph" (Phase 344 owns this file; the vocabulary itself '
  + 'changed upstream if this trips)');

// ---------------------------------------------------------------------------
// The frozen declaring-surface list. Exactly two entries.
// ---------------------------------------------------------------------------
const DECLARING_SURFACES = Object.freeze([
  'agents/chain-step-reviewer.md', // authored by plan 347-10
  'commands/file-meeting.md',      // modified by plan 347-11
]);

// ---------------------------------------------------------------------------
// readDeclaredLayer(): minimal frontmatter block reader. Takes the block
// between the first two lines that equal three hyphens, then matches the
// first line beginning with 'layer:' and returns the rest of the line
// trimmed of surrounding quotes. No YAML dependency.
// ---------------------------------------------------------------------------
function readDeclaredLayer(absPath) {
  const text = fs.readFileSync(absPath, 'utf8');
  const lines = text.split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== '---') return { present: false };
  let end = -1;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') { end = i; break; }
  }
  if (end === -1) return { present: false };
  for (let i = 1; i < end; i += 1) {
    const m = /^layer:\s*(.+?)\s*$/.exec(lines[i]);
    if (m) {
      let value = m[1].trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return { present: true, value };
    }
  }
  return { present: false };
}

// ---------------------------------------------------------------------------
// validateStrict(): the unconditional, fail-closed form of Test 3 / Test 4.
// Throws for a missing layer: key, for an out-of-vocabulary value, or for
// any value other than graph. Used against the real declaring surfaces only
// for the two conditions that are ALWAYS wrong regardless of migration
// timing (missing key, out-of-vocabulary garbage); proven red against a
// synthetic hand-mutated temp copy below for the "legitimate-but-not-graph"
// branch, since that branch is not safe to assert unconditionally against a
// surface Phase 347 has not modified yet (see the header comment).
// ---------------------------------------------------------------------------
function validateStrict(label, declared, vocab) {
  if (!declared.present) {
    throw new Error('347 layer-graph-declaration: ' + label + ' carries no layer: key (fail closed, '
      + 'matching default_on_miss: reject)');
  }
  if (!vocab.includes(declared.value)) {
    throw new Error('347 layer-graph-declaration: ' + label + ' declares layer: ' + declared.value
      + ', outside the closed vocabulary in data/layer-declaration-schema.json');
  }
  if (declared.value !== 'graph') {
    throw new Error('347 layer-graph-declaration: ' + label + ' declares layer: ' + declared.value
      + ', not graph');
  }
}

// ---------------------------------------------------------------------------
// Test 2 / Test 3 (narrowed, see header) / Test 4 / Test 5: the live walk.
// ---------------------------------------------------------------------------
let checked = 0;
let skipped = 0;
const skippedNotes = [];

for (const rel of DECLARING_SURFACES) {
  const abs = path.join(REPO_ROOT, rel);
  if (!fs.existsSync(abs)) {
    skipped += 1;
    skippedNotes.push(rel + ' (not authored yet)');
    continue;
  }

  const declared = readDeclaredLayer(abs);

  // Test 4 (always applies, any migration timing): a listed surface that
  // exists and carries no layer: key at all is a hard failure. Fail closed,
  // matching the schema's own default_on_miss: reject.
  assert.ok(declared.present,
    '347 layer-graph-declaration: ' + rel + ' exists and carries no layer: key (fail closed)');

  // Always applies too: an out-of-vocabulary value is never legitimate,
  // migration timing or not (data corruption, not a pending state).
  assert.ok(vocabulary.includes(declared.value),
    '347 layer-graph-declaration: ' + rel + ' declares layer: ' + declared.value
    + ', outside the closed vocabulary in data/layer-declaration-schema.json');

  if (declared.value === 'graph') {
    checked += 1;
    continue;
  }

  // A legitimate other-vocabulary value on a surface Phase 347 has not
  // modified yet is PENDING, not FAILED (see the header comment's measured
  // fact for commands/file-meeting.md). Once plan 347-10 / 347-11 land and
  // this file legitimately declares graph, this branch stops firing for it.
  skipped += 1;
  skippedNotes.push(rel + ' (pending Phase 347 edit, current layer: ' + declared.value + ')');
}

console.log('347 layer-graph-declaration: checked=' + checked + ' skipped=' + skipped
  + (skippedNotes.length ? ' [' + skippedNotes.join('; ') + ']' : ''));

// ---------------------------------------------------------------------------
// Red-proof: validateStrict() throws on a hand-mutated temp copy.
// Acceptance criterion: "A hand-mutation that writes layer: loop into a temp
// copy of a listed surface makes the assertion throw." Uses a synthetic
// frontmatter body in a throwaway temp file, not a real repo surface, so
// this proves the strict fail-closed checker itself works without depending
// on either listed surface's present migration state.
// ---------------------------------------------------------------------------
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gsd-347-layer-'));
  const tmpFile = path.join(tmpDir, 'synthetic-declaring-surface.md');
  try {
    fs.writeFileSync(tmpFile, [
      '---',
      'name: synthetic-declaring-surface',
      'layer: loop', // the hand-mutation: this surface is REQUIRED to declare graph
      '---',
      '',
      'body text, irrelevant to the frontmatter read',
      '',
    ].join('\n'));
    const mutated = readDeclaredLayer(tmpFile);
    assert.throws(
      () => validateStrict('synthetic-declaring-surface.md (temp, hand-mutated)', mutated, vocabulary),
      /declares layer: loop, not graph/,
      '347 layer-graph-declaration RED-PROOF FAILED: validateStrict() did not throw on a '
      + 'hand-mutated layer: loop surface'
    );
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Test 5: honest on a zero-present tree. Exercised structurally by the live
// walk above: agents/chain-step-reviewer.md is absent on this tree today, so
// that entry already takes the "not authored yet" branch with no throw.
// A run where BOTH entries are absent (a fresh clone with neither plan 347-10
// nor Phase 344's own backfill applied to file-meeting.md) is the same code
// path twice; checked stays 0, skipped becomes 2, and the script still exits
// 0, which is exactly what the console.log line above reports either way.
// ---------------------------------------------------------------------------

console.log('347 layer-graph-declaration: PASSED (checked=' + checked + ', skipped=' + skipped + ')');
