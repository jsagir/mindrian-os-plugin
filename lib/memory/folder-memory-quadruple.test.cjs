#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 90-04 -- readQuadruple fixture tests (17 cases)
 * =====================================================
 * Extends Phase 88-01 readTriple to readQuadruple additively. Five
 * parser-isolation tests (Task 1) + twelve integration tests (Task 2).
 *
 * Test map (17 cases, one-to-one with the PLAN <behavior> blocks):
 *
 * Task 1 (parser-level, folder-memory-shared.cjs):
 *   1.  parseBrainMd on valid fixture -> full struct, parse_failed:false, 9 sections mapped
 *   2.  parseBrainMd on absent path -> null (literal)
 *   3.  parseBrainMd on malformed frontmatter -> emptyBrain with parse_failed:true
 *   4.  parseBrainMd with 3/9 sections populated -> sections[present]:{body,tokens_estimate}, sections[absent]:null
 *   5.  parseBrainMd with unknown heading '## Secret Analysis' -> ignored (future-compat)
 *   (Bonus): OPTIONAL_SECTION_HEADINGS byte-identical parity with brain-md-schema
 *
 * Task 2 (integration, folder-memory.cjs + folder-memory-async.cjs):
 *   6.  readQuadruple sync on section with triple + valid BRAIN.md -> {room,state,reasoning,brain:{exists:true,...}}
 *   7.  readQuadruple sync on section with triple + BRAIN.md absent -> {..., brain:null}
 *   8.  readQuadruple sync on section with triple + malformed BRAIN.md -> {..., brain:{exists:true, parse_failed:true, ...}}
 *   9.  readQuadruple sync on nonexistent sectionPath -> does NOT throw; returns all-empty shells + brain:null
 *   10. readQuadruple async AsyncFunction constructor.name === 'AsyncFunction'
 *   11. sync + async return identical shapes on same fixture (deep equality)
 *   12. key-set parity: Object.keys(sync).filter(fn).sort() === Object.keys(async).filter(fn).sort()
 *   13. isQuadrupleFresh: reasoning.is_stale:false + brain:null -> true
 *   14. isQuadrupleFresh: reasoning.is_stale:false + brain.staleness:'fresh' -> true
 *   15. isQuadrupleFresh: reasoning.is_stale:true -> false (regardless of brain)
 *   16. isQuadrupleFresh: reasoning.is_stale:false + brain.stale_reason:'brain_offline' -> true
 *   17. isQuadrupleFresh: reasoning.is_stale:false + brain.staleness:'stale' + stale_reason:'governing_thought_changed' -> false
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..', '..');
const SHARED_PATH = path.join(REPO, 'lib/core/folder-memory-shared.cjs');
const SYNC_PATH = path.join(REPO, 'lib/core/folder-memory.cjs');
const ASYNC_PATH = path.join(REPO, 'lib/core/folder-memory-async.cjs');
const SCHEMA_PATH = path.join(REPO, 'lib/core/brain-md-schema.cjs');

// ---------- Tmp workspace helpers ----------

const TMP_ROOTS = [];
function mkTmp(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  TMP_ROOTS.push(d);
  return d;
}
process.on('exit', () => {
  for (const d of TMP_ROOTS) {
    try {
      fs.rmSync(d, { recursive: true, force: true });
    } catch (_e) { /* best effort */ }
  }
});

function isoFromMs(ms) {
  return new Date(ms).toISOString().replace(/\.\d+Z$/, 'Z');
}

// ---------- Fixture writers ----------

function writeRoomMd(dir, identity, refs) {
  const payload =
    identity +
    '\n\n<!-- BEGIN REFERENCES -->\n' +
    (refs || '') +
    '\n<!-- END REFERENCES -->\n';
  fs.writeFileSync(path.join(dir, 'ROOM.md'), payload, 'utf8');
}

function writeStateMd(dir, opts) {
  const o = opts || {};
  const lines = [
    '# Section State',
    '',
    'artifact_count: ' + (o.artifact_count != null ? o.artifact_count : 2),
    'gap_status: ' + (o.gap_status || 'active'),
    'completeness_score: ' + (o.completeness_score != null ? o.completeness_score : 0.6),
    '',
    'Last activity: ' + (o.last_activity || '2026-04-19'),
    '',
  ];
  fs.writeFileSync(path.join(dir, 'STATE.md'), lines.join('\n'), 'utf8');
}

function writeMintoMd(dir, fm, body) {
  const lines = ['---'];
  for (const k of Object.keys(fm)) {
    const v = fm[k];
    if (Array.isArray(v)) {
      if (v.length === 0) {
        lines.push(k + ': []');
      } else {
        lines.push(k + ':');
        for (const s of v) lines.push('  - ' + JSON.stringify(s));
      }
    } else if (v === null) {
      lines.push(k + ': null');
    } else if (typeof v === 'string') {
      lines.push(k + ': "' + v.replace(/"/g, '\\"') + '"');
    } else {
      lines.push(k + ': ' + v);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push(body || '# MINTO body');
  fs.writeFileSync(path.join(dir, 'MINTO.md'), lines.join('\n'), 'utf8');
}

// Build a BRAIN.md fixture with given frontmatter + section bodies map.
// sections is { '## Pattern Matches': 'body text', ... } -- only present
// headings become sections; absent headings stay absent on parse.
function writeBrainMd(dir, fm, sections) {
  fs.mkdirSync(dir, { recursive: true });
  const lines = ['---'];
  for (const k of Object.keys(fm)) {
    const v = fm[k];
    if (v === null) {
      lines.push(k + ': null');
    } else if (typeof v === 'string') {
      lines.push(k + ': "' + v.replace(/"/g, '\\"') + '"');
    } else {
      lines.push(k + ': ' + v);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push('# Brain Derivation -- ' + (fm.section || 'unknown'));
  lines.push('');
  if (sections && typeof sections === 'object') {
    for (const h of Object.keys(sections)) {
      lines.push(h);
      lines.push('');
      lines.push(sections[h]);
      lines.push('');
    }
  }
  fs.writeFileSync(path.join(dir, 'BRAIN.md'), lines.join('\n'), 'utf8');
}

function defaultBrainFm(section) {
  return {
    section: section || 'market-analysis',
    brain_generated_at: isoFromMs(Date.now()),
    brain_graph_version: 1,
    governing_thought_hash: 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    staleness: 'fresh',
    stale_reason: null,
    author: 'brain',
    confidence_baseline: 0.7,
  };
}

// Seed a full section directory with ROOM/STATE/MINTO + optional BRAIN.
function seedSection(dir, opts) {
  const o = opts || {};
  writeRoomMd(dir, o.identity || '# test-section\n\nIdentity prose.', o.refs || '');
  writeStateMd(dir, o.state || {});
  writeMintoMd(
    dir,
    {
      schema_version: 'v88',
      governing_thought: o.governing_thought || 'Test governing thought.',
      last_generated_at: isoFromMs(Date.now()),
      decision_log: [],
    },
    o.body || 'body content'
  );
}

// ---------- Task 1: Parser-level tests ----------

function test_1_parseBrainMd_valid(shared) {
  const dir = mkTmp('quad-t1-');
  const fm = defaultBrainFm('market-analysis');
  const sections = {
    '## Pattern Matches': 'Framework match: SWOT + Porter Five.',
    '## Cross-Domain Analogies': 'Analogous to 1995 ISP market.',
    '## Wicked Indicators': 'High uncertainty + stakeholder divergence.',
    '## Unfilled Opportunity Matches': 'Gap in mid-market enterprise.',
    '## Framework Chain Predictions': 'SWOT -> Porter -> JTBD.',
    '## Assessment Thinking Chain Position': 'RigorLevel 3.',
    '## ProblemType Classification': 'UDP-Complex, confidence 0.8.',
    '## Flagged Contradictions (cross-room)': '(no signal)',
    '## HSI Signals': 'Disruption index high.',
  };
  writeBrainMd(dir, fm, sections);

  const brain = shared.parseBrainMd(path.join(dir, 'BRAIN.md'));
  assert.notStrictEqual(brain, null, 't1: brain non-null');
  assert.strictEqual(brain.exists, true, 't1: exists true');
  assert.strictEqual(brain.parse_failed, false, 't1: parse_failed false');
  assert.strictEqual(brain.section, 'market-analysis', 't1: section scalar');
  assert.strictEqual(brain.brain_graph_version, 1, 't1: brain_graph_version cast');
  assert.strictEqual(brain.staleness, 'fresh', 't1: staleness scalar');
  assert.strictEqual(brain.stale_reason, null, 't1: stale_reason null');
  assert.strictEqual(brain.author, 'brain', 't1: author');
  assert.strictEqual(brain.confidence_baseline, 0.7, 't1: confidence_baseline float');
  assert.ok(brain.sections && typeof brain.sections === 'object', 't1: sections present');
  const expectedKeys = [
    'pattern_matches',
    'cross_domain_analogies',
    'wicked_indicators',
    'unfilled_opportunity_matches',
    'framework_chain_predictions',
    'assessment_thinking_chain_position',
    'problemtype_classification',
    'flagged_contradictions_xroom',
    'hsi_signals',
  ];
  for (const k of expectedKeys) {
    assert.ok(k in brain.sections, 't1: key ' + k + ' present');
    assert.ok(brain.sections[k] !== null, 't1: section ' + k + ' populated');
    assert.ok(typeof brain.sections[k].body === 'string', 't1: ' + k + ' body string');
    assert.ok(brain.sections[k].body.length > 0, 't1: ' + k + ' body non-empty');
    assert.ok(typeof brain.sections[k].tokens_estimate === 'number', 't1: ' + k + ' tokens_estimate number');
    assert.ok(brain.sections[k].tokens_estimate > 0, 't1: ' + k + ' tokens_estimate positive');
  }
  assert.ok(Array.isArray(brain.flagged_weaknesses), 't1: flagged_weaknesses array');
}

function test_2_parseBrainMd_absent(shared) {
  const dir = mkTmp('quad-t2-');
  const result = shared.parseBrainMd(path.join(dir, 'BRAIN.md'));
  assert.strictEqual(result, null, 't2: absent -> null literal');
}

function test_3_parseBrainMd_malformed(shared) {
  const dir = mkTmp('quad-t3-');
  fs.mkdirSync(dir, { recursive: true });
  // No frontmatter delimiters at all.
  fs.writeFileSync(
    path.join(dir, 'BRAIN.md'),
    'This is not a BRAIN.md. No frontmatter. No sections.\n',
    'utf8'
  );
  const brain = shared.parseBrainMd(path.join(dir, 'BRAIN.md'));
  assert.notStrictEqual(brain, null, 't3: malformed still returns emptyBrain struct');
  assert.strictEqual(brain.exists, true, 't3: exists:true for present-but-malformed');
  assert.strictEqual(brain.parse_failed, true, 't3: parse_failed:true');
  assert.strictEqual(brain.staleness, 'stale', 't3: staleness:stale on parse fail');
  assert.ok(brain.sections && typeof brain.sections === 'object', 't3: sections shell');
  for (const k of Object.keys(brain.sections)) {
    assert.strictEqual(brain.sections[k], null, 't3: ' + k + ' null on parse fail');
  }
}

function test_4_parseBrainMd_partialSections(shared) {
  const dir = mkTmp('quad-t4-');
  const fm = defaultBrainFm('problem-definition');
  const sections = {
    '## Pattern Matches': 'Only three present.',
    '## Wicked Indicators': 'Second of three.',
    '## HSI Signals': 'Third of three.',
  };
  writeBrainMd(dir, fm, sections);
  const brain = shared.parseBrainMd(path.join(dir, 'BRAIN.md'));
  assert.strictEqual(brain.parse_failed, false, 't4: parse ok');
  assert.ok(brain.sections.pattern_matches != null, 't4: pattern_matches present');
  assert.ok(brain.sections.wicked_indicators != null, 't4: wicked_indicators present');
  assert.ok(brain.sections.hsi_signals != null, 't4: hsi_signals present');
  // Six absent sections stay null.
  const absentKeys = [
    'cross_domain_analogies',
    'unfilled_opportunity_matches',
    'framework_chain_predictions',
    'assessment_thinking_chain_position',
    'problemtype_classification',
    'flagged_contradictions_xroom',
  ];
  for (const k of absentKeys) {
    assert.strictEqual(brain.sections[k], null, 't4: absent ' + k + ' is null');
  }
}

function test_5_parseBrainMd_unknownHeading(shared) {
  const dir = mkTmp('quad-t5-');
  const fm = defaultBrainFm('solution-design');
  const sections = {
    '## Pattern Matches': 'Known heading.',
    '## Secret Analysis': 'Unknown heading; must be ignored.',
  };
  writeBrainMd(dir, fm, sections);
  const brain = shared.parseBrainMd(path.join(dir, 'BRAIN.md'));
  assert.strictEqual(brain.parse_failed, false, 't5: still parses fine');
  assert.ok(brain.sections.pattern_matches != null, 't5: known heading captured');
  // The unknown heading must not appear as a key anywhere.
  for (const k of Object.keys(brain.sections)) {
    assert.ok(
      k.indexOf('secret') === -1,
      't5: no secret_* key leaked into sections'
    );
  }
}

function test_bonus_optionalHeadingsParity(shared) {
  // Parity with brain-md-schema OPTIONAL_SECTION_HEADINGS array.
  const schema = require(SCHEMA_PATH);
  assert.ok(Array.isArray(schema.OPTIONAL_SECTION_HEADINGS), 'bonus: schema array present');
  assert.ok(Array.isArray(shared.OPTIONAL_SECTION_HEADINGS), 'bonus: shared array present');
  assert.strictEqual(
    shared.OPTIONAL_SECTION_HEADINGS.length,
    schema.OPTIONAL_SECTION_HEADINGS.length,
    'bonus: same length'
  );
  for (let i = 0; i < schema.OPTIONAL_SECTION_HEADINGS.length; i++) {
    assert.strictEqual(
      shared.OPTIONAL_SECTION_HEADINGS[i],
      schema.OPTIONAL_SECTION_HEADINGS[i],
      'bonus: entry ' + i + ' byte-identical'
    );
  }
}

// ---------- Task 2: Integration tests ----------

function test_6_readQuadruple_valid(sync) {
  const dir = mkTmp('quad-t6-');
  seedSection(dir, {});
  writeBrainMd(dir, defaultBrainFm(path.basename(dir)), {
    '## Pattern Matches': 'Framework match body.',
    '## HSI Signals': 'HSI signal body.',
  });
  const q = sync.readQuadruple(dir);
  assert.ok(q, 't6: returns object');
  assert.ok(q.room && q.room.exists === true, 't6: room.exists');
  assert.ok(q.state && q.state.exists === true, 't6: state.exists');
  assert.ok(q.reasoning && q.reasoning.exists === true, 't6: reasoning.exists');
  assert.ok(q.brain != null, 't6: brain non-null');
  assert.strictEqual(q.brain.exists, true, 't6: brain.exists');
  assert.strictEqual(q.brain.parse_failed, false, 't6: brain parsed ok');
  assert.strictEqual(q.brain.author, 'brain', 't6: brain.author');
}

function test_7_readQuadruple_brainAbsent(sync) {
  const dir = mkTmp('quad-t7-');
  seedSection(dir, {});
  // No BRAIN.md.
  const q = sync.readQuadruple(dir);
  assert.ok(q.room.exists === true, 't7: room still present');
  assert.strictEqual(q.brain, null, 't7: brain null when absent');
}

function test_8_readQuadruple_malformedBrain(sync) {
  const dir = mkTmp('quad-t8-');
  seedSection(dir, {});
  fs.writeFileSync(path.join(dir, 'BRAIN.md'), 'garbage no frontmatter\n', 'utf8');
  const q = sync.readQuadruple(dir);
  assert.ok(q.brain != null, 't8: brain non-null (file exists)');
  assert.strictEqual(q.brain.exists, true, 't8: exists:true when file present');
  assert.strictEqual(q.brain.parse_failed, true, 't8: parse_failed:true');
  assert.strictEqual(q.brain.staleness, 'stale', 't8: staleness:stale on malformed');
}

function test_9_readQuadruple_nonexistentPath(sync) {
  const dir = path.join(os.tmpdir(), 'quad-t9-nonexistent-' + Date.now() + '-' + Math.random());
  let q;
  assert.doesNotThrow(() => {
    q = sync.readQuadruple(dir);
  }, 't9: no throws on nonexistent path');
  assert.strictEqual(q.room.exists, false, 't9: room shell');
  assert.strictEqual(q.state.exists, false, 't9: state shell');
  assert.strictEqual(q.reasoning.exists, false, 't9: reasoning shell');
  assert.strictEqual(q.brain, null, 't9: brain null on absent path');
}

function test_10_asyncReadQuadruple_isAsyncFunction(asyncMod) {
  assert.strictEqual(
    typeof asyncMod.readQuadruple,
    'function',
    't10: readQuadruple defined on async module'
  );
  assert.strictEqual(
    asyncMod.readQuadruple.constructor.name,
    'AsyncFunction',
    't10: async readQuadruple is AsyncFunction (got ' + asyncMod.readQuadruple.constructor.name + ')'
  );
  assert.strictEqual(
    asyncMod.isQuadrupleFresh.constructor.name,
    'AsyncFunction',
    't10: async isQuadrupleFresh is AsyncFunction'
  );
}

async function test_11_syncAsyncDeepEquality(sync, asyncMod) {
  const dir = mkTmp('quad-t11-');
  seedSection(dir, { governing_thought: 'Parity GT' });
  writeBrainMd(dir, defaultBrainFm(path.basename(dir)), {
    '## Pattern Matches': 'same body both paths',
  });

  const syncResult = sync.readQuadruple(dir);
  const asyncResult = await asyncMod.readQuadruple(dir);

  assert.deepStrictEqual(
    Object.keys(syncResult).sort(),
    Object.keys(asyncResult).sort(),
    't11: top-level keys match'
  );
  assert.deepStrictEqual(
    syncResult.brain,
    asyncResult.brain,
    't11: brain field deep equal'
  );
  assert.strictEqual(
    syncResult.reasoning.governing_thought,
    asyncResult.reasoning.governing_thought,
    't11: reasoning gt match'
  );
}

function test_12_keySetParity(sync, asyncMod) {
  const syncKeys = Object.keys(sync).filter((k) => typeof sync[k] === 'function').sort();
  const asyncKeys = Object.keys(asyncMod).filter((k) => typeof asyncMod[k] === 'function').sort();
  assert.deepStrictEqual(syncKeys, asyncKeys, 't12: key-set parity');
  // Sanity: both include readQuadruple and isQuadrupleFresh.
  assert.ok(syncKeys.indexOf('readQuadruple') !== -1, 't12: sync.readQuadruple present');
  assert.ok(syncKeys.indexOf('isQuadrupleFresh') !== -1, 't12: sync.isQuadrupleFresh present');
  assert.ok(asyncKeys.indexOf('readQuadruple') !== -1, 't12: async.readQuadruple present');
  assert.ok(asyncKeys.indexOf('isQuadrupleFresh') !== -1, 't12: async.isQuadrupleFresh present');
  // Phase 88-01 back-compat: readTriple still exported on both.
  assert.ok(syncKeys.indexOf('readTriple') !== -1, 't12: sync.readTriple back-compat');
  assert.ok(asyncKeys.indexOf('readTriple') !== -1, 't12: async.readTriple back-compat');
  // Every async export is AsyncFunction.
  for (const k of asyncKeys) {
    assert.strictEqual(
      asyncMod[k].constructor.name,
      'AsyncFunction',
      't12: async.' + k + ' must be AsyncFunction'
    );
  }
}

function test_13_isQuadrupleFresh_brainNull(sync) {
  const q = {
    room: { exists: true },
    state: { exists: true },
    reasoning: { exists: true, is_stale: false, stale_reason: null },
    brain: null,
  };
  assert.strictEqual(sync.isQuadrupleFresh(q), true, 't13: fresh triple + brain null -> true');
}

function test_14_isQuadrupleFresh_brainFresh(sync) {
  const q = {
    room: { exists: true },
    state: { exists: true },
    reasoning: { exists: true, is_stale: false },
    brain: { exists: true, staleness: 'fresh', stale_reason: null },
  };
  assert.strictEqual(sync.isQuadrupleFresh(q), true, 't14: fresh triple + fresh brain -> true');
}

function test_15_isQuadrupleFresh_tripleStale(sync) {
  const q = {
    room: { exists: true },
    state: { exists: true },
    reasoning: { exists: true, is_stale: true, stale_reason: 'artifacts_newer_than_minto' },
    brain: { exists: true, staleness: 'fresh' },
  };
  assert.strictEqual(sync.isQuadrupleFresh(q), false, 't15: stale triple -> false');
  // And even with brain null.
  const q2 = Object.assign({}, q, { brain: null });
  assert.strictEqual(sync.isQuadrupleFresh(q2), false, 't15b: stale triple + brain null -> false');
}

function test_16_isQuadrupleFresh_brainOffline(sync) {
  const q = {
    room: { exists: true },
    state: { exists: true },
    reasoning: { exists: true, is_stale: false },
    brain: { exists: true, staleness: 'stale', stale_reason: 'brain_offline' },
  };
  assert.strictEqual(
    sync.isQuadrupleFresh(q),
    true,
    't16: brain-offline not counted as derivation-stale'
  );
}

function test_17_isQuadrupleFresh_brainStale(sync) {
  const q = {
    room: { exists: true },
    state: { exists: true },
    reasoning: { exists: true, is_stale: false },
    brain: { exists: true, staleness: 'stale', stale_reason: 'governing_thought_changed' },
  };
  assert.strictEqual(
    sync.isQuadrupleFresh(q),
    false,
    't17: derivation-stale -> false'
  );
}

// ---------- Runner ----------

async function run() {
  // Module-file existence checks.
  assert.ok(fs.existsSync(SHARED_PATH), 'precondition: shared module exists');
  assert.ok(fs.existsSync(SYNC_PATH), 'precondition: sync module exists');
  assert.ok(fs.existsSync(ASYNC_PATH), 'precondition: async module exists');

  const shared = require(SHARED_PATH);
  const sync = require(SYNC_PATH);
  const asyncMod = require(ASYNC_PATH);

  // Task 1 -- parser-level.
  test_1_parseBrainMd_valid(shared);
  test_2_parseBrainMd_absent(shared);
  test_3_parseBrainMd_malformed(shared);
  test_4_parseBrainMd_partialSections(shared);
  test_5_parseBrainMd_unknownHeading(shared);
  test_bonus_optionalHeadingsParity(shared);

  // Task 2 -- integration.
  test_6_readQuadruple_valid(sync);
  test_7_readQuadruple_brainAbsent(sync);
  test_8_readQuadruple_malformedBrain(sync);
  test_9_readQuadruple_nonexistentPath(sync);
  test_10_asyncReadQuadruple_isAsyncFunction(asyncMod);
  await test_11_syncAsyncDeepEquality(sync, asyncMod);
  test_12_keySetParity(sync, asyncMod);
  test_13_isQuadrupleFresh_brainNull(sync);
  test_14_isQuadrupleFresh_brainFresh(sync);
  test_15_isQuadrupleFresh_tripleStale(sync);
  test_16_isQuadrupleFresh_brainOffline(sync);
  test_17_isQuadrupleFresh_brainStale(sync);

  process.stdout.write('folder-memory-quadruple: 17/17 tests passed (5 parser + 12 integration + 1 parity bonus)\n');
  process.exit(0);
}

run().catch((e) => {
  process.stderr.write((e && e.stack) || String(e));
  process.stderr.write('\n');
  process.exit(1);
});
