#!/usr/bin/env node
// Phase 346 (the arbitration node), Plan 03, Task 1.
// Pins the shape of data/arbitration-rule-catalogue.json: the twelve
// conversation-time rules, the six prose mandates, the rung vocabulary
// borrowed live from data/harness-policies/_schema.json, the floor
// discipline, the voice-glyph doctrinal-floor SPLIT, the two named Stop-hook gates, and
// the enumerate-from-disk partition over hooks/hooks.json -- the load-
// bearing assertion that makes an omission impossible to hide.
//
// The two hooks nobody had read before this task, answered from the source
// (assumption A9 in 346-RESEARCH.md), each in two sentences with line
// numbers, recorded here next to the assertions they justify:
//
// scripts/hmi-compliance-poll.cjs (Stop hook, wrapped via hookMain lines
// 382-401): it observes only. hookMain() only fires pollOnce() when the
// event is 'Stop' (line 389), wraps the call in a try/catch that swallows
// every error (lines 393-398), and unconditionally returns
// silentHookSuccess() (line 400) which emits {continue:true,
// suppressOutput:true} through an allowlisted envelope filter (lines
// 348-370) that carries no BINDING marker and no systemMessage -- it never
// gates and never surfaces model-visible text, it only writes a side-channel
// JSON file (atomicWriteSideChannel, lines 208-222) the model never reads.
//
// scripts/mva-detect.cjs (UserPromptSubmit hook, main() lines 121-223): it
// also never blocks -- every branch (parse failure line 124, no prompt line
// 132, no state module line 139-140, classifier error line 152-155, and the
// success path line 222) ends in emitEmpty() -> {continue:true} (lines
// 64-66). It CAN force a later first-turn surface indirectly: on a
// venture-positive classification (line 162) it calls
// mvaState.writePending() (lines 163-169), and that pending record is read
// several turns later by scripts/first-install-router.cjs (its own header
// comment at line 345: "lib/core/mva-state.cjs's pending record at fire
// time, several turns later") to fire the 30-Second MVA Instant Brief. So
// mva-detect.cjs itself never gates a turn; it is the producer of a signal a
// different mechanism (first-install-router.cjs) later consumes to surface
// something -- the hooked-model first-step concern belongs to that consumer,
// not to this detector.
//
// House rule: hyphens only, no em-dashes, no emoji.

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CATALOGUE_PATH = path.join(ROOT, 'data', 'arbitration-rule-catalogue.json');
const SCHEMA_PATH = path.join(ROOT, 'data', 'harness-policies', '_schema.json');
const HOOKS_JSON_PATH = path.join(ROOT, 'hooks', 'hooks.json');
const SELF_PATH = __filename;

let n = 0;
let failed = 0;
function ok(desc, fn) {
  n++;
  try {
    fn();
    console.log(`PASS ${n}: ${desc}`);
  } catch (err) {
    failed++;
    console.log(`FAIL ${n}: ${desc}`);
    console.log(`  ${err && err.message ? err.message : err}`);
  }
}

// ---------------------------------------------------------------------------
// Load the schema (always available -- Phase 298) so the rung vocabulary is
// read live, never re-typed.
// ---------------------------------------------------------------------------
let schema;
ok('data/harness-policies/_schema.json parses and exposes _doc.rung_vocabulary', () => {
  schema = require(SCHEMA_PATH);
  assert.ok(schema && schema._doc, '_schema.json must expose _doc');
  assert.ok(Array.isArray(schema._doc.rung_vocabulary), '_doc.rung_vocabulary must be an array');
  assert.deepStrictEqual(schema._doc.rung_vocabulary, ['declared', 'logged', 'blocking']);
});

// ---------------------------------------------------------------------------
// Load the catalogue. If missing, every downstream check fails loudly and
// names the missing file (RED state before Task 2 lands).
// ---------------------------------------------------------------------------
let catalogueExists = fs.existsSync(CATALOGUE_PATH);
ok('data/arbitration-rule-catalogue.json exists on disk', () => {
  assert.ok(catalogueExists, `missing required file: ${path.relative(ROOT, CATALOGUE_PATH)}`);
});

let catalogue = null;
if (catalogueExists) {
  ok('data/arbitration-rule-catalogue.json parses as JSON', () => {
    delete require.cache[require.resolve(CATALOGUE_PATH)];
    catalogue = require(CATALOGUE_PATH);
    assert.ok(catalogue && typeof catalogue === 'object');
  });
}

function requireCatalogue() {
  if (!catalogue) throw new Error('catalogue not loaded -- see missing-file failure above');
  return catalogue;
}

// ---------------------------------------------------------------------------
// SHAPE
// ---------------------------------------------------------------------------
ok('catalogue has _doc, conversation_time_rules[], prose_mandates[]', () => {
  const c = requireCatalogue();
  assert.ok(c._doc && typeof c._doc === 'object', '_doc missing or not an object');
  assert.ok(Array.isArray(c.conversation_time_rules), 'conversation_time_rules must be an array');
  assert.ok(Array.isArray(c.prose_mandates), 'prose_mandates must be an array');
});

const DOC_REQUIRED_KEYS = [
  'purpose',
  'rung_vocabulary_source',
  'census_method',
  'census_command',
  'stop_hook_gates',
  'build_time_gates_out_of_scope',
  'floor_vocabulary',
  'hook_event_vocabulary',
  'not_a_judgment_rule',
];

ok('_doc carries every required key, each non-empty', () => {
  const c = requireCatalogue();
  for (const key of DOC_REQUIRED_KEYS) {
    assert.ok(key in c._doc, `_doc.${key} is missing`);
    const v = c._doc[key];
    if (typeof v === 'string') {
      assert.ok(v.length > 0, `_doc.${key} must be a non-empty string`);
    } else if (Array.isArray(v)) {
      assert.ok(v.length > 0, `_doc.${key} must be a non-empty array`);
    } else if (v && typeof v === 'object') {
      assert.ok(Object.keys(v).length > 0, `_doc.${key} must be a non-empty object`);
    } else {
      throw new Error(`_doc.${key} has an unexpected type: ${typeof v}`);
    }
  }
});

// ---------------------------------------------------------------------------
// RUNG VOCABULARY IS BORROWED, NOT MINTED
// ---------------------------------------------------------------------------
ok('every rung_today is null or a member of the live rung vocabulary; every rung_proposed is a member', () => {
  const c = requireCatalogue();
  const vocab = schema._doc.rung_vocabulary;
  for (const row of c.conversation_time_rules) {
    assert.ok(vocab.includes(row.rung_proposed), `row ${row.id}: rung_proposed '${row.rung_proposed}' not in rung vocabulary`);
    assert.ok(row.rung_today === null || vocab.includes(row.rung_today), `row ${row.id}: rung_today '${row.rung_today}' must be null or a member of rung vocabulary`);
  }
});

ok('the catalogue file itself contains no literal array equal to the rung vocabulary', () => {
  const raw = fs.readFileSync(CATALOGUE_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  const vocabJoined = schema._doc.rung_vocabulary.join(',');
  function walk(obj) {
    if (Array.isArray(obj)) {
      if (obj.length === 3 && obj.every((x) => typeof x === 'string') && obj.join(',') === vocabJoined) {
        throw new Error('found a literal array equal to the rung vocabulary -- must be read live, never re-typed');
      }
      obj.forEach(walk);
    } else if (obj && typeof obj === 'object') {
      Object.values(obj).forEach(walk);
    }
  }
  walk(parsed);
});

// ---------------------------------------------------------------------------
// FLOOR DISCIPLINE
// ---------------------------------------------------------------------------
const FLOOR_VOCAB = ['enforced', 'doctrinal', 'none'];

ok('every floor is a member of the floor vocabulary; non-none floors carry floor_source; enforced implies blocking; none implies arbiter_input', () => {
  const c = requireCatalogue();
  for (const row of c.conversation_time_rules) {
    assert.ok(FLOOR_VOCAB.includes(row.floor), `row ${row.id}: floor '${row.floor}' not in ${FLOOR_VOCAB.join('/')}`);
    if (row.floor !== 'none') {
      assert.ok(typeof row.floor_source === 'string' && row.floor_source.length > 0, `row ${row.id}: floor_source must be non-empty when floor is not 'none'`);
    }
    if (row.floor === 'enforced') {
      assert.strictEqual(row.rung_proposed, 'blocking', `row ${row.id}: floor 'enforced' must carry rung_proposed 'blocking'`);
    }
    if (row.floor === 'none') {
      assert.strictEqual(row.arbiter_input, true, `row ${row.id}: floor 'none' must carry arbiter_input true`);
    }
  }
});

// ---------------------------------------------------------------------------
// THE SPLIT IS RECORDED, NOT RESOLVED AWAY
// ---------------------------------------------------------------------------
ok('voice-glyph-present is the recorded doctrinal/declared SPLIT', () => {
  const c = requireCatalogue();
  const rows = c.conversation_time_rules.filter((r) => r.floor === 'doctrinal' && r.rung_today === 'declared');
  const glyph = rows.find((r) => r.id === 'voice-glyph-present');
  assert.ok(glyph, "exactly one row must exist with floor 'doctrinal', rung_today 'declared', id 'voice-glyph-present'");
  assert.ok(/doctrinal floor/i.test(glyph.reason), 'voice-glyph-present reason must contain "doctrinal floor"');
  assert.ok(/observational/i.test(glyph.reason), 'voice-glyph-present reason must contain "observational"');
});

ok('voice-hyphens-only carries the same SPLIT shape', () => {
  const c = requireCatalogue();
  const row = c.conversation_time_rules.find((r) => r.id === 'voice-hyphens-only');
  assert.ok(row, 'voice-hyphens-only row must exist');
  assert.strictEqual(row.floor, 'doctrinal');
  assert.strictEqual(row.rung_today, 'declared');
});

// ---------------------------------------------------------------------------
// THE TWO STOP-HOOK GATES ARE NAMED
// ---------------------------------------------------------------------------
function parseHooksJson() {
  const raw = fs.readFileSync(HOOKS_JSON_PATH, 'utf8');
  return JSON.parse(raw);
}

function collectCommands(hooksJson, eventName) {
  const out = [];
  const blocks = (hooksJson.hooks && hooksJson.hooks[eventName]) || [];
  for (const matcherBlock of blocks) {
    const innerHooks = matcherBlock.hooks || [];
    for (const h of innerHooks) {
      if (h && typeof h.command === 'string') out.push(h.command);
    }
  }
  return out;
}

ok('_doc.stop_hook_gates names exactly two repo-relative paths that are mechanisms of catalogue rows and appear in the Stop block', () => {
  const c = requireCatalogue();
  const gates = c._doc.stop_hook_gates;
  assert.ok(Array.isArray(gates) && gates.length === 2, `stop_hook_gates must have exactly 2 entries, got ${gates && gates.length}`);
  const hooksJson = parseHooksJson();
  const stopCommands = collectCommands(hooksJson, 'Stop').join('\n');
  for (const gatePath of gates) {
    const foundAsMechanism = c.conversation_time_rules.some((r) => r.mechanism === gatePath);
    assert.ok(foundAsMechanism, `stop_hook_gates entry '${gatePath}' must be the mechanism of at least one catalogue row`);
    assert.ok(stopCommands.indexOf(gatePath.replace(/^scripts\//, 'scripts/')) !== -1, `stop_hook_gates entry '${gatePath}' must appear in the Stop block of hooks/hooks.json`);
  }
});

// ---------------------------------------------------------------------------
// THE ENUMERATE-FROM-DISK PARTITION (the load-bearing assertion)
// ---------------------------------------------------------------------------
// Normalization: a node "${CLAUDE_PLUGIN_ROOT}/scripts/X.cjs" command
// normalizes to full='scripts/X.cjs', short='X.cjs'. A
// "${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd" <verb> command normalizes to
// full='hooks/run-hook.cmd <verb>', short='run-hook.cmd <verb>'. Catalogue
// rows carry the FULL form in their `mechanism` field; `_doc.not_a_judgment_rule`
// carries the SHORT form as its keys (matching this plan's own worked
// example: 'operator-update.cjs', 'run-hook.cmd on-stop').
function normalizeMechanism(command) {
  const scriptMatch = command.match(/\$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/([A-Za-z0-9_.-]+)/);
  if (scriptMatch) {
    const basename = scriptMatch[1];
    return { full: `scripts/${basename}`, short: basename };
  }
  const runHookMatch = command.match(/run-hook\.cmd["']?\s+([A-Za-z0-9_-]+)/);
  if (runHookMatch) {
    const verb = runHookMatch[1];
    return { full: `hooks/run-hook.cmd ${verb}`, short: `run-hook.cmd ${verb}` };
  }
  return null;
}

function collectPartitionMechanisms() {
  const hooksJson = parseHooksJson();
  const events = ['Stop', 'UserPromptSubmit', 'PreToolUse'];
  const seen = new Map(); // full -> short
  for (const evt of events) {
    for (const cmd of collectCommands(hooksJson, evt)) {
      const norm = normalizeMechanism(cmd);
      if (norm) seen.set(norm.full, norm.short);
    }
  }
  return seen;
}

ok('every distinct conversation-time hook mechanism is either catalogued or excluded with a reason (enumerate-from-disk partition)', () => {
  const c = requireCatalogue();
  const mechanisms = collectPartitionMechanisms();
  assert.ok(mechanisms.size > 0, 'the partition must find at least one mechanism in hooks/hooks.json');

  const catalogueMechanisms = new Set(c.conversation_time_rules.map((r) => r.mechanism).filter((m) => m !== null));
  const excludedKeys = c._doc.not_a_judgment_rule || {};

  const catalogued = [];
  const excluded = [];
  const uncovered = [];

  for (const [full, short] of mechanisms.entries()) {
    if (catalogueMechanisms.has(full)) {
      catalogued.push(full);
    } else if (Object.prototype.hasOwnProperty.call(excludedKeys, short) && typeof excludedKeys[short] === 'string' && excludedKeys[short].length > 0) {
      excluded.push(short);
    } else {
      uncovered.push(`${full} (short form checked: '${short}')`);
    }
  }

  assert.strictEqual(uncovered.length, 0, `mechanism(s) neither catalogued nor excluded with a reason: ${uncovered.join(', ')}`);
  assert.ok(catalogued.length > 0, 'the partition must find at least one catalogued mechanism');
  assert.ok(excluded.length > 0, 'the partition must find at least one excluded (not-a-judgment-rule) mechanism');
});

// ---------------------------------------------------------------------------
// THE CENSUS IS MEASURED, NOT FROZEN
// ---------------------------------------------------------------------------
ok('_doc.census_command is a non-empty shell string; conversation_time_rules.length is measured, not asserted against a literal', () => {
  const c = requireCatalogue();
  assert.strictEqual(typeof c._doc.census_command, 'string');
  assert.ok(c._doc.census_command.length > 0);
  console.log(`  measured conversation_time_rules.length = ${c.conversation_time_rules.length} (not asserted against a frozen literal)`);
});

ok('conversation_time_rules.length is >= the number of distinct catalogued hook mechanisms found in the partition', () => {
  const c = requireCatalogue();
  const mechanisms = collectPartitionMechanisms();
  const catalogueMechanisms = new Set(c.conversation_time_rules.map((r) => r.mechanism).filter((m) => m !== null));
  let distinctCatalogued = 0;
  for (const full of mechanisms.keys()) {
    if (catalogueMechanisms.has(full)) distinctCatalogued++;
  }
  assert.ok(
    c.conversation_time_rules.length >= distinctCatalogued,
    `conversation_time_rules.length (${c.conversation_time_rules.length}) must be >= distinct catalogued hook mechanisms found (${distinctCatalogued})`
  );
});

// ---------------------------------------------------------------------------
// BUILD-TIME GATES
// ---------------------------------------------------------------------------
ok('_doc.build_time_gates_out_of_scope is a live census sentence with no hardcoded 2+ digit count', () => {
  const c = requireCatalogue();
  const sentence = c._doc.build_time_gates_out_of_scope;
  assert.strictEqual(typeof sentence, 'string');
  assert.ok(sentence.length > 0);

  const scriptsDir = path.join(ROOT, 'scripts');
  const allCheckFiles = fs.readdirSync(scriptsDir).filter((f) => /^check-.*\.cjs$/.test(f) && !/\.test\.cjs$/.test(f));
  const liveGateCount = allCheckFiles.length;

  const hooksJson = parseHooksJson();
  const stopCommands = collectCommands(hooksJson, 'Stop').join('\n');
  let inStopCount = 0;
  for (const f of allCheckFiles) {
    if (stopCommands.indexOf(f) !== -1) inStopCount++;
  }
  const buildTimeCount = liveGateCount - inStopCount;

  console.log(`  measured: ${liveGateCount} total scripts/check-*.cjs gates, ${inStopCount} run at Stop, ${buildTimeCount} are build-time (out of scope)`);

  const liveStr = String(liveGateCount);
  const buildStr = String(buildTimeCount);
  if (liveStr.length >= 2) {
    assert.ok(sentence.indexOf(liveStr) === -1, `build_time_gates_out_of_scope must not hardcode the live total gate count (${liveStr})`);
  }
  if (buildStr.length >= 2) {
    assert.ok(sentence.indexOf(buildStr) === -1, `build_time_gates_out_of_scope must not hardcode the build-time gate count (${buildStr})`);
  }
});

// ---------------------------------------------------------------------------
// PROSE MANDATES
// ---------------------------------------------------------------------------
ok('every prose_mandates row carries id, rule, where (existing path), floor, arbiter_input, non-empty reason', () => {
  const c = requireCatalogue();
  for (const row of c.prose_mandates) {
    assert.ok(typeof row.id === 'string' && row.id.length > 0, 'prose_mandates row missing id');
    assert.ok(typeof row.rule === 'string' && row.rule.length > 0, `row ${row.id}: rule missing`);
    assert.ok(typeof row.where === 'string' && row.where.length > 0, `row ${row.id}: where missing`);
    assert.ok(fs.existsSync(path.join(ROOT, row.where)), `row ${row.id}: where path does not exist on disk: ${row.where}`);
    assert.ok(FLOOR_VOCAB.includes(row.floor), `row ${row.id}: floor invalid`);
    assert.strictEqual(typeof row.arbiter_input, 'boolean', `row ${row.id}: arbiter_input must be boolean`);
    assert.ok(typeof row.reason === 'string' && row.reason.length > 0, `row ${row.id}: reason missing`);
  }
});

ok('at least one prose_mandates row targets skills/larry-personality/SKILL.md with a non-none floor', () => {
  const c = requireCatalogue();
  const found = c.prose_mandates.some((r) => r.where === 'skills/larry-personality/SKILL.md' && r.floor !== 'none');
  assert.ok(found, 'expected at least one skills/larry-personality/SKILL.md row with floor != none');
});

// ---------------------------------------------------------------------------
// HYGIENE
// ---------------------------------------------------------------------------
ok('zero em-dashes in the catalogue', () => {
  if (!catalogueExists) throw new Error('catalogue file missing');
  const raw = fs.readFileSync(CATALOGUE_PATH, 'utf8');
  assert.strictEqual((raw.match(/\u2014/g) || []).length, 0, 'em-dash found in data/arbitration-rule-catalogue.json');
});

ok('zero em-dashes in this test file', () => {
  const raw = fs.readFileSync(SELF_PATH, 'utf8');
  assert.strictEqual((raw.match(/\u2014/g) || []).length, 0, 'em-dash found in this test file');
});

// ---------------------------------------------------------------------------

console.log('');
console.log(`${n - failed}/${n} assertions passed`);
if (failed > 0) {
  console.log(`>>> test-346-catalogue-schema.cjs: FAILED (${failed} failure(s))`);
  process.exit(1);
}
console.log('>>> test-346-catalogue-schema.cjs: PASSED');
