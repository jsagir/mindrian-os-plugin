'use strict';
/*
 * Phase 120-03 Wave 2 Task 1 -- voice-scaffold unit tests (Tests 1-14).
 *
 * Per CONTEXT.md D-17 LOCKED VERBATIM 4-rule voice scaffold:
 *   Rule 1: Evidence requirement   -- artifact ids OR graph edges cited
 *   Rule 2: Mechanism clause       -- "by Y" user action
 *   Rule 3: Time anchor            -- "in the last N hours/days" / "this week" / etc.
 *   Rule 4: No unbacked superlatives -- 6 forbidden + 3 frequency words guarded
 *
 * The auditor IS the structural enforcement (D-20 meta-principle).
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const SCAFFOLD_PATH = path.resolve(__dirname, 'voice-scaffold.cjs');
const voiceScaffold = require('./voice-scaffold.cjs');
const {
  composeBreakthroughVoiceLine,
  auditVoiceLine,
  citeEvidence,
  includeMechanism,
  anchorTime,
  noUnbackedSuperlatives,
  formatTimeAnchor,
  VOICE_RULE_NAMES,
  FORBIDDEN_SUPERLATIVES,
  FREQUENCY_WORDS,
  KIND_DISPLAY,
} = voiceScaffold;

// --- T1: VOICE_RULE_NAMES verbatim ---
test('T1: VOICE_RULE_NAMES verbatim + Object.freeze invariant', () => {
  assert.deepEqual(VOICE_RULE_NAMES, [
    'evidence_requirement',
    'mechanism_clause',
    'time_anchor',
    'no_unbacked_superlatives',
  ]);
  assert.equal(VOICE_RULE_NAMES.length, 4);
  // Object.freeze invariant
  const before = VOICE_RULE_NAMES.slice();
  try { VOICE_RULE_NAMES.push('extra'); } catch (_e) { /* strict mode throws */ }
  assert.deepEqual(VOICE_RULE_NAMES.slice(0, 4), before);
});

// --- T2: FORBIDDEN_SUPERLATIVES verbatim ---
test('T2: FORBIDDEN_SUPERLATIVES contains the 6 D-17 rule 4 words verbatim', () => {
  assert.deepEqual(FORBIDDEN_SUPERLATIVES, [
    'breakthrough', 'biggest', 'first', 'unprecedented', 'major', 'massive',
  ]);
  assert.equal(FORBIDDEN_SUPERLATIVES.length, 6);
});

// --- T3: composeBreakthroughVoiceLine happy path -- convergence ---
test('T3: composeBreakthroughVoiceLine produces D-17-compliant line for convergence', () => {
  const twoDaysAgoMs = Date.now() - 2 * 86400 * 1000;
  const bk = {
    kind: 'convergence',
    theme: 'operator-state machines',
    artifact_ids: ['art:1', 'art:2', 'art:3', 'art:4'],
    detected_at: twoDaysAgoMs,
  };
  const roomState = {
    mechanism_phrase: 'by uploading the four notes on Mode A and Mode B',
  };
  const line = composeBreakthroughVoiceLine(bk, roomState);
  assert.match(
    line,
    /^You're seeing a convergence on operator-state machines \(artifacts art:1, art:2, art:3, art:4\) -- by uploading the four notes on Mode A and Mode B -- in the last two days\.$/,
  );
});

// --- T4: composeBreakthroughVoiceLine default mechanism when roomState absent ---
test('T4: composeBreakthroughVoiceLine uses structural default mechanism when roomState absent', () => {
  const bk = {
    kind: 'convergence',
    theme: 'X',
    artifact_ids: ['a1', 'a2', 'a3'],
    detected_at: Date.now(),
  };
  const line = composeBreakthroughVoiceLine(bk, null);
  // Default: "by adding N artifacts to this section"
  assert.ok(/by adding 3 artifacts/.test(line),
    'expected default mechanism with artifact count, got: ' + line);
  // The default must still pass auditor (rule 2 satisfied)
  const audit = auditVoiceLine(line);
  assert.equal(audit.ok, true, 'default-mechanism line must pass auditor, violations: ' + JSON.stringify(audit.violations));
});

// --- T5: auditVoiceLine -- D-17 rule 1 violation -- no evidence cite ---
test('T5: auditVoiceLine catches D-17 rule 1 violation (no evidence cite)', () => {
  const bad = "You're seeing a convergence on X -- by uploading -- in the last two days.";
  const r = auditVoiceLine(bad);
  assert.equal(r.ok, false);
  assert.ok(r.violations.indexOf('evidence_requirement') >= 0,
    'expected evidence_requirement violation, got: ' + JSON.stringify(r.violations));
});

// --- T6: auditVoiceLine -- D-17 rule 2 violation -- no mechanism ---
test('T6: auditVoiceLine catches D-17 rule 2 violation (no mechanism)', () => {
  const bad = "You're seeing a convergence on X (artifacts a1, a2, a3) -- in the last two days.";
  const r = auditVoiceLine(bad);
  assert.equal(r.ok, false);
  assert.ok(r.violations.indexOf('mechanism_clause') >= 0,
    'expected mechanism_clause violation, got: ' + JSON.stringify(r.violations));
});

// --- T7: auditVoiceLine -- D-17 rule 3 violation -- no time anchor ---
test('T7: auditVoiceLine catches D-17 rule 3 violation (no time anchor)', () => {
  const bad = "You're seeing a convergence on X (artifacts a1, a2, a3) -- by uploading the notes.";
  const r = auditVoiceLine(bad);
  assert.equal(r.ok, false);
  assert.ok(r.violations.indexOf('time_anchor') >= 0,
    'expected time_anchor violation, got: ' + JSON.stringify(r.violations));
});

// --- T8: auditVoiceLine -- D-17 rule 4 violation -- unbacked superlative ---
test('T8: auditVoiceLine catches D-17 rule 4 violation (unbacked superlative)', () => {
  const bad = "You're seeing the BIGGEST breakthrough on X (artifacts a1, a2, a3) -- by uploading -- in the last hour.";
  const r = auditVoiceLine(bad);
  assert.equal(r.ok, false);
  assert.ok(r.violations.indexOf('no_unbacked_superlatives') >= 0,
    'expected no_unbacked_superlatives violation, got: ' + JSON.stringify(r.violations));
});

// --- T9: auditVoiceLine -- D-17 rule 4 SATISFIED with numeric backing ---
test('T9: auditVoiceLine accepts D-17 rule 4 when superlative has numeric backing', () => {
  const good = "You're seeing a convergence on X (artifacts a1, a2, a3) -- by uploading -- in the last hour. This is the highest differential score (0.78) in this room's history.";
  const r = auditVoiceLine(good);
  assert.equal(r.ok, true,
    'expected no violations, got: ' + JSON.stringify(r.violations));
});

// --- T10: auditVoiceLine happy path passes all 4 rules ---
test('T10: auditVoiceLine passes for T3-composed convergence line', () => {
  const twoDaysAgoMs = Date.now() - 2 * 86400 * 1000;
  const bk = {
    kind: 'convergence',
    theme: 'operator-state machines',
    artifact_ids: ['art:1', 'art:2', 'art:3', 'art:4'],
    detected_at: twoDaysAgoMs,
  };
  const roomState = {
    mechanism_phrase: 'by uploading the four notes on Mode A and Mode B',
  };
  const line = composeBreakthroughVoiceLine(bk, roomState);
  const r = auditVoiceLine(line);
  assert.equal(r.ok, true,
    'composer + auditor must be aligned, violations: ' + JSON.stringify(r.violations));
  assert.deepEqual(r.violations, []);
});

// --- T11: auditVoiceLine -- multiple violations reported ---
test('T11: auditVoiceLine reports multiple violations on maximally bad line', () => {
  const veryBad = "You're seeing a convergence on X.";
  const r = auditVoiceLine(veryBad);
  assert.equal(r.ok, false);
  // expect at least 3 violations: evidence, mechanism, time_anchor (no superlative present so rule 4 OK)
  assert.ok(r.violations.indexOf('evidence_requirement') >= 0);
  assert.ok(r.violations.indexOf('mechanism_clause') >= 0);
  assert.ok(r.violations.indexOf('time_anchor') >= 0);
  assert.ok(r.violations.length >= 3);
});

// --- T12: composeBreakthroughVoiceLine for EVERY kind passes auditor ---
test('T12: composeBreakthroughVoiceLine output passes auditor for every kind', () => {
  const kinds = [
    'convergence',
    'contradiction_resolved',
    'cross_domain_analogy',
    'reverse_salient_closed',
  ];
  for (const kind of kinds) {
    const bk = {
      kind: kind,
      theme: 'sample-theme',
      artifact_ids: ['art:1', 'art:2', 'art:3'],
      detected_at: Date.now() - 6 * 3600 * 1000, // 6 hours ago
    };
    const line = composeBreakthroughVoiceLine(bk, null);
    const r = auditVoiceLine(line);
    assert.equal(r.ok, true,
      'kind ' + kind + ': composer output failed audit, line: ' + line + ', violations: ' + JSON.stringify(r.violations));
  }
});

// --- T13: Canon Part 8 source-grep -- zero Brain coupling ---
test('T13: Canon Part 8 source-grep -- voice-scaffold.cjs has zero Brain coupling', () => {
  const src = fs.readFileSync(SCAFFOLD_PATH, 'utf8');
  // brain-client require
  assert.ok(!/require\(.+brain-client/.test(src),
    'voice-scaffold must not require brain-client');
  // direct fetch to brain.mindrian
  assert.ok(!/fetch.+brain\.mindrian/.test(src),
    'voice-scaffold must not fetch brain.mindrian');
  // cross-room aggregation
  assert.ok(!/cross-room/i.test(src.split('\n').filter(l => !l.match(/^\s*\/\//)).join('\n')) ||
    src.indexOf('Canon Part 8') >= 0,
    'cross-room mentions require Canon Part 8 context comment');
});

// --- T14: em-dash invariant ---
test('T14: zero U+2014 em-dashes in voice-scaffold.cjs', () => {
  const src = fs.readFileSync(SCAFFOLD_PATH, 'utf8');
  const idx = src.indexOf('—');
  assert.equal(idx, -1, 'em-dash found at index ' + idx);
});

// --- Bonus: formatTimeAnchor buckets ---
test('T15: formatTimeAnchor returns expected buckets', () => {
  const now = Date.now();
  assert.equal(formatTimeAnchor(now - 30 * 60 * 1000, now), 'in the last hour');
  assert.equal(formatTimeAnchor(now - 4 * 3600 * 1000, now), 'in the last 4 hours');
  assert.equal(formatTimeAnchor(now - 12 * 3600 * 1000, now), 'today');
  assert.equal(formatTimeAnchor(now - 36 * 3600 * 1000, now), 'in the last day');
  assert.equal(formatTimeAnchor(now - 2 * 86400 * 1000, now), 'in the last two days');
  assert.equal(formatTimeAnchor(now - 5 * 86400 * 1000, now), 'this week');
  assert.equal(formatTimeAnchor(now - 10 * 86400 * 1000, now), 'in the last two weeks');
});

// --- Bonus: rule predicates exposed ---
test('T16: rule predicates exposed individually for unit-level testing', () => {
  assert.equal(typeof citeEvidence, 'function');
  assert.equal(typeof includeMechanism, 'function');
  assert.equal(typeof anchorTime, 'function');
  assert.equal(typeof noUnbackedSuperlatives, 'function');
  // citeEvidence positive cases
  assert.equal(citeEvidence('foo (artifacts a1, a2)'), true);
  assert.equal(citeEvidence('foo [[wiki-link]]'), true);
  assert.equal(citeEvidence('foo (see edges X, Y)'), true);
  // citeEvidence negative
  assert.equal(citeEvidence('foo bar baz'), false);
});

// --- Bonus: FREQUENCY_WORDS exposed ---
test('T17: FREQUENCY_WORDS exposed verbatim', () => {
  assert.deepEqual(FREQUENCY_WORDS, ['consistent', 'repeated', 'always']);
});

// --- Bonus: KIND_DISPLAY exposed ---
test('T18: KIND_DISPLAY exposed with the 4 detector kinds', () => {
  assert.equal(typeof KIND_DISPLAY, 'object');
  assert.ok(KIND_DISPLAY.convergence);
  assert.ok(KIND_DISPLAY.contradiction_resolved);
  assert.ok(KIND_DISPLAY.cross_domain_analogy);
  assert.ok(KIND_DISPLAY.reverse_salient_closed);
});
