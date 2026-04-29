#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 95-03 -- text-level contract fence for skills/room-proactive/
 * SKILL.md side-channel reader. Asserts the OLD detection contract is
 * removed (ALL framings, including ones that escape a single literal-
 * string fence), the NEW side-channel-reader contract is present, and
 * the cool-UI render directive is in scope. Also runs a synthetic side-
 * channel dry-run to confirm the data contract from Plan 95-02 round-
 * trips cleanly.
 *
 * Background:
 *   skills/room-proactive/SKILL.md (lines 80-113 pre-95-03) declared a
 *   detection contract: "When cascade_status appears in additionalContext,
 *   check proactive_intelligence.newFindings". The bash hook never wrote
 *   the cascade payload at that location; it has always written
 *   cascade_status at JSON ROOT. Plan 95-02 relocated the cascade payload
 *   to a side-channel file at <roomDir>/.mindrian/last-cascade.json AND
 *   tightened the post-write stdout envelope to a one-line
 *   additionalContext advisory (`post-write: cascade complete for ...` or
 *   `queued MINTO regen for ...`). Plan 95-03 updates the SKILL.md
 *   detection contract to match: when additionalContext matches one of
 *   the two recognized prefixes, the skill reads the side-channel JSON
 *   via the Read tool.
 *
 *   This test is the negative-string fence catching accidental rollback
 *   to the OLD contract. The OLD_PHRASES list covers ALL 5 documented
 *   framings of the OLD contract (the original plan revision missed the
 *   "After Filing: Decision Capture" / "When to Present" block at lines
 *   102-113 which carried `cascade_status.proactive_intelligence`
 *   wording in addition to lines 80-92).
 *
 *   F.0 selector deferral: Phase 95 only relocates WHERE the finding
 *   payload comes from. The prose APPROVE/REJECT/DEFER renderer at
 *   SKILL.md (current) lines 114-160 is byte-identical-preserved. F.0
 *   AskUserQuestion selector is queued for Phase 88.2 / Phase 97 per
 *   room/decisions/decision-phase-95-sequencing.md. The fence asserts
 *   the prose flow is acknowledged in the new SKILL.md text so a half-
 *   built F.0 cannot accidentally land here.
 *
 * Scenarios (6):
 *   1. OLD detection contract removed - ALL framings: SKILL.md does NOT
 *      contain ANY of the 5 documented OLD-contract phrases anywhere in
 *      the file. The whole-file scan ensures lines 102-113 cannot escape
 *      the fence.
 *   2. side-channel reader present: SKILL.md contains
 *      `.mindrian/last-cascade.json`.
 *   3. trigger pattern documented: SKILL.md contains BOTH trigger
 *      prefixes (`post-write: cascade complete` AND `queued MINTO regen`).
 *   4. cool-UI render directive present: SKILL.md contains a banner-with-
 *      rules / status-grid reference (string match: `banner` AND (`-` OR
 *      `status grid`)). The cascade-finding render must NOT be raw prose.
 *   5. F.0 deferral acknowledged: SKILL.md contains explicit text noting
 *      that the prose APPROVE/REJECT/DEFER flow is preserved. Non-
 *      regression guard against accidental F.0 implementation.
 *   6. synthetic side-channel dry run: create scratch
 *      <scratch>/.mindrian/last-cascade.json with a synthetic
 *      newFindings array; assert (a) JSON parses cleanly with the
 *      documented 8-key schema, (b) proactive_intelligence.newFindings
 *      contains at least one item with confidence and message fields.
 *      This tests the data contract from Plan 95-02 (independent of
 *      SKILL.md text, so passes in BOTH RED and GREEN states).
 *
 * All scenarios mirror the IIFE structure of tests/test-hook-envelope-
 * shape.cjs and tests/test-cascade-side-channel.cjs.
 *
 * Registered in lib/memory/run-feynman-tests.cjs.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const SKILL_PATH = path.join(REPO, 'skills', 'room-proactive', 'SKILL.md');

// OLD contract phrases. ALL must be absent from the entire SKILL.md file
// (whole-file scan, not just a line-range scan). Each one was a real
// entry point for the load-bearing-broken-since-88.1-03 detection
// contract. The plan-revision history shows that an earlier draft only
// fenced the literal "proactive_intelligence.newFindings in the
// cascade_status JSON" phrase from line 86, which let the line-102-113
// "After Filing: Decision Capture" intro and "When to Present" block
// escape the fence. This list catches all 5 documented framings.
const OLD_PHRASES = [
  'proactive_intelligence.newFindings in the cascade_status JSON',
  'cascade_status includes proactive_intelligence.newFindings',
  'cascade_status.proactive_intelligence',
  'proactive_intelligence in additionalContext',
  'When cascade_status appears in additionalContext',
];

// NEW contract anchors. ALL must be present in SKILL.md.
const SIDE_CHANNEL_REF = '.mindrian/last-cascade.json';
const TRIGGER_A = 'post-write: cascade complete';
const TRIGGER_B = 'queued MINTO regen';

let passed = 0;
let failed = 0;

function ok(name) {
  passed += 1;
  process.stdout.write('  ok ' + name + '\n');
}

function fail(name, err) {
  failed += 1;
  process.stdout.write('  FAIL ' + name + '\n');
  if (err) {
    process.stdout.write('    ' + (err.message || String(err)) + '\n');
  }
}

// ---------- Helpers ----------

function readSkill() {
  return fs.readFileSync(SKILL_PATH, 'utf8');
}

function makeScratchDir(suffix) {
  const base = path.join(
    os.tmpdir(),
    'mos-room-proactive-side-channel-' + Date.now().toString(36) + '-' + suffix
  );
  fs.mkdirSync(base, { recursive: true });
  return base;
}

function makeScratchSideChannel(scratch) {
  // Build a synthetic <scratch>/.mindrian/last-cascade.json matching the
  // 8-key schema from Plan 95-02 (timestamp, file_path, section,
  // cascade_status, classification, git_commit, graph_index,
  // proactive_intelligence). The proactive_intelligence.newFindings
  // array carries one synthetic finding with confidence + message so the
  // skill consumer's `confidence >= 0.60` filter has something to bite.
  const sideDir = path.join(scratch, '.mindrian');
  fs.mkdirSync(sideDir, { recursive: true });
  const payload = {
    timestamp: '2026-04-29T19:00:00Z',
    file_path: path.join(scratch, 'problem-definition', 'synthetic',
      'synthetic.md'),
    section: 'problem-definition',
    cascade_status: 'complete',
    classification: { type: 'artifact', confidence: 0.91 },
    git_commit: { sha: 'abc1234', branch: 'main' },
    graph_index: { nodes_added: 1, edges_added: 2 },
    proactive_intelligence: {
      status: 'ok',
      new: 1,
      suppressed: 0,
      newFindings: [
        {
          key: 'contradiction:problem-definition:business-model',
          type: 'contradiction',
          confidence: 0.78,
          message: 'customer-type vs market-size tension worth reconciling',
          isNew: true,
          decided: false,
        },
      ],
    },
  };
  const filePath = path.join(sideDir, 'last-cascade.json');
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
  return { sideDir, filePath, payload };
}

function rmrf(p) {
  try {
    fs.rmSync(p, { recursive: true, force: true });
  } catch (_) { /* best-effort */ }
}

// ---------- Scenarios ----------

(function test1_oldDetectionContractRemoved() {
  const label = 'room-proactive: OLD detection contract removed - ALL framings';
  try {
    const skill = readSkill();
    for (const phrase of OLD_PHRASES) {
      const idx = skill.indexOf(phrase);
      assert.equal(
        idx,
        -1,
        label + ': SKILL.md still contains OLD-contract phrase "' + phrase +
          '" at character index ' + idx +
          '. The whole-file scan caught a framing that the OLD-contract ' +
          'rewrite missed. Update SKILL.md to remove this phrase.'
      );
    }
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

(function test2_sideChannelReaderPresent() {
  const label = 'room-proactive: side-channel reader contract present';
  try {
    const skill = readSkill();
    assert.notEqual(
      skill.indexOf(SIDE_CHANNEL_REF),
      -1,
      label + ': SKILL.md must reference "' + SIDE_CHANNEL_REF +
        '" so Larry knows where to read the cascade payload from.'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

(function test3_triggerPatternDocumented() {
  const label = 'room-proactive: trigger pattern documented (both prefixes)';
  try {
    const skill = readSkill();
    assert.notEqual(
      skill.indexOf(TRIGGER_A),
      -1,
      label + ': SKILL.md must reference trigger prefix "' + TRIGGER_A + '"'
    );
    assert.notEqual(
      skill.indexOf(TRIGGER_B),
      -1,
      label + ': SKILL.md must reference trigger prefix "' + TRIGGER_B + '"'
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

(function test4_coolUiRenderDirectivePresent() {
  const label = 'room-proactive: cool-UI render directive present (banner + grid)';
  try {
    const skill = readSkill();
    // Cool-UI markers per .planning/research/cool-ui-style-reference.md:
    // banner with horizontal rules + status grid + canonical glyphs.
    const hasBanner = skill.toLowerCase().indexOf('banner') !== -1;
    assert.equal(
      hasBanner,
      true,
      label + ': SKILL.md must reference the banner pattern (string "banner")'
    );

    const hasRule = skill.indexOf('━') !== -1; // U+2501 BOX DRAWINGS HEAVY HORIZONTAL
    const hasStatusGrid = skill.toLowerCase().indexOf('status grid') !== -1;
    assert.equal(
      hasRule || hasStatusGrid,
      true,
      label + ': SKILL.md must reference the cool-UI rule glyph U+2501 OR ' +
        'the literal phrase "status grid"'
    );

    // Glyph vocabulary check: the new detection block should reference at
    // least three of the canonical state-indicator glyphs (per
    // skills/ui-system/SKILL.md Section 3 + cool-ui-style-reference.md
    // Section 2). Allowed glyph set:
    //   U+25C6 BLACK DIAMOND   (active / in-flight)
    //   U+26A0 WARNING SIGN    (warning / contradiction)
    //   U+26A1 HIGH VOLTAGE    (urgent / convergence)
    //   U+2B1C WHITE LARGE SQUARE (gap / pending)
    //   U+25B6 BLACK RIGHT-POINTING TRIANGLE (next-action callout)
    const glyphs = ['◆', '⚠', '⚡', '⬜', '▶'];
    const hits = glyphs.filter((g) => skill.indexOf(g) !== -1);
    assert.equal(
      hits.length >= 3,
      true,
      label + ': SKILL.md must reference at least 3 of the canonical glyph ' +
        'vocabulary (got ' + hits.length + ' of 5: ' +
        glyphs.map((g, i) => g + (hits.includes(g) ? ' present' : ' absent'))
          .join(', ') + ')'
    );

    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

(function test5_proseFlowDeferralAcknowledged() {
  const label = 'room-proactive: F.0 deferral acknowledged (prose flow preserved)';
  try {
    const skill = readSkill();
    // The new SKILL.md text must explicitly note that the prose APPROVE/
    // REJECT/DEFER renderer is preserved (i.e. the F.0 AskUserQuestion
    // selector is INTENTIONALLY deferred to Phase 88.2 / 97). Accept any
    // of three phrasings; the planner can choose wording but the intent
    // must be visible to a future maintainer.
    const acknowledgments = [
      'prose APPROVE',
      'existing APPROVE/REJECT/DEFER',
      'prose APPROVE/REJECT/DEFER',
      'F.0',
    ];
    const matched = acknowledgments.some((s) => skill.indexOf(s) !== -1);
    assert.equal(
      matched,
      true,
      label + ': SKILL.md must explicitly acknowledge the prose APPROVE/' +
        'REJECT/DEFER flow is preserved (F.0 deferred). Looked for any of: ' +
        JSON.stringify(acknowledgments)
    );
    ok(label);
  } catch (e) {
    fail(label, e);
  }
})();

(function test6_syntheticSideChannelDryRun() {
  const label = 'room-proactive: synthetic side-channel data contract round-trip';
  const scratch = makeScratchDir('synth-dry-run');
  try {
    const { filePath, payload } = makeScratchSideChannel(scratch);

    // (a) JSON parses cleanly with the documented 8-key schema.
    assert.equal(fs.existsSync(filePath), true,
      label + ': synthetic side-channel file must exist at ' + filePath);
    const raw = fs.readFileSync(filePath, 'utf8');
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      throw new Error(label + ': synthetic side-channel must parse as JSON. Got: ' + raw);
    }
    assert.equal(typeof parsed, 'object',
      label + ': parsed payload must be an object');
    assert.notEqual(parsed, null,
      label + ': parsed payload must not be null');

    const requiredKeys = [
      'timestamp',
      'file_path',
      'section',
      'cascade_status',
      'classification',
      'git_commit',
      'graph_index',
      'proactive_intelligence',
    ];
    for (const k of requiredKeys) {
      assert.equal(
        Object.prototype.hasOwnProperty.call(parsed, k),
        true,
        label + ': synthetic payload missing required key "' + k + '"'
      );
    }

    // (b) proactive_intelligence.newFindings has at least one item with
    // confidence + message fields. This is the consumer contract the
    // SKILL.md detection block reads.
    const pi = parsed.proactive_intelligence;
    assert.equal(typeof pi, 'object',
      label + ': proactive_intelligence must be an object');
    assert.notEqual(pi, null,
      label + ': proactive_intelligence must not be null');
    assert.equal(Array.isArray(pi.newFindings), true,
      label + ': proactive_intelligence.newFindings must be an array');
    assert.equal(pi.newFindings.length >= 1, true,
      label + ': proactive_intelligence.newFindings must have at least one item');
    const finding = pi.newFindings[0];
    assert.equal(typeof finding.confidence, 'number',
      label + ': finding[0].confidence must be a number');
    assert.equal(typeof finding.message, 'string',
      label + ': finding[0].message must be a string');
    assert.equal(finding.message.length > 0, true,
      label + ': finding[0].message must be non-empty');

    // Sanity check that our synthetic payload matches what we wrote
    // (round-trip confirms makeScratchSideChannel and the schema agree).
    assert.equal(parsed.cascade_status, payload.cascade_status,
      label + ': cascade_status must round-trip');
    assert.equal(parsed.section, payload.section,
      label + ': section must round-trip');

    ok(label);
  } catch (e) {
    fail(label, e);
  } finally {
    rmrf(scratch);
  }
})();

// ---------- Report ----------

process.stdout.write('\n');
process.stdout.write(
  'room-proactive side-channel contract: ' + passed + ' passed, ' + failed + ' failed\n'
);
process.exit(failed === 0 ? 0 : 1);
