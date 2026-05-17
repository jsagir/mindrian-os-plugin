'use strict';
/*
 * Phase 120-03 Wave 2 Task 1 -- D-17 voice-audit end-to-end test (Tests 15-16).
 *
 * Coverage:
 *   Test 15: end-to-end D-17 audit over fixed matrix (8 breakthrough candidates,
 *            2 per kind, composeBreakthroughVoiceLine -> auditVoiceLine, all 8 pass).
 *   Test 16: end-to-end D-17 violation catalog (hand-crafted violators for each
 *            of the 4 rules; audit catches each; no false positives on matching
 *            valid lines).
 *
 * Per CONTEXT.md D-17 LOCKED VERBATIM:
 *   Rule 1: Evidence requirement.   Cite artifact ids OR graph edges.
 *   Rule 2: Mechanism clause.       "by Y" where Y is a user action.
 *   Rule 3: Time anchor.            "in the last N hours/days" / "this week" / etc.
 *   Rule 4: No unbacked superlatives. 'breakthrough','biggest','first','unprecedented',
 *                                   'major','massive' must be backed by numeric evidence.
 */

const test = require('node:test');
const { strict: assert } = require('node:assert');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const voiceScaffold = require(path.join(REPO_ROOT, 'lib', 'core', 'breakthrough', 'voice-scaffold.cjs'));

const { composeBreakthroughVoiceLine, auditVoiceLine } = voiceScaffold;

const KINDS = ['convergence', 'contradiction_resolved', 'cross_domain_analogy', 'reverse_salient_closed'];

test('D-17 end-to-end Test 15: composer + auditor aligned over 8 candidate matrix', () => {
  // 2 candidates per kind = 8 total. Different time anchors + mechanism phrases.
  let pass = 0;
  for (const kind of KINDS) {
    for (let i = 0; i < 2; i++) {
      const bk = {
        kind: kind,
        theme: 'theme-' + kind + '-' + i,
        artifact_ids: ['art:' + kind + ':1', 'art:' + kind + ':2', 'art:' + kind + ':3'],
        detected_at: Date.now() - (1 + i) * 6 * 3600 * 1000, // 6h or 12h ago
      };
      const roomState = (i === 0)
        ? null
        : { mechanism_phrase: 'by filing the ' + kind + ' artifact' };
      const line = composeBreakthroughVoiceLine(bk, roomState);
      const audit = auditVoiceLine(line);
      assert.equal(audit.ok, true,
        'kind=' + kind + ' i=' + i + ' audit failed: ' + JSON.stringify(audit.violations) +
        ' line: ' + line);
      pass += 1;
    }
  }
  assert.equal(pass, 8, 'expected all 8 composed lines to pass auditor');
});

test('D-17 end-to-end Test 16a: rule 1 violator caught + matching valid line passes', () => {
  // Rule 1 (evidence) violator: no (artifacts ...) / [[ ]] / (see edges ...)
  const violator = "You're seeing a convergence on operator -- by uploading -- in the last hour.";
  const r1 = auditVoiceLine(violator);
  assert.equal(r1.ok, false);
  assert.ok(r1.violations.indexOf('evidence_requirement') >= 0,
    'expected evidence_requirement violation, got: ' + JSON.stringify(r1.violations));

  // Matching valid line (only difference: adds (artifacts a1, a2, a3))
  const valid = "You're seeing a convergence on operator (artifacts a1, a2, a3) -- by uploading -- in the last hour.";
  const r2 = auditVoiceLine(valid);
  assert.equal(r2.ok, true,
    'expected matching valid line to pass auditor, got violations: ' + JSON.stringify(r2.violations));
});

test('D-17 end-to-end Test 16b: rule 2 violator caught + matching valid line passes', () => {
  // Rule 2 (mechanism) violator: no "by " clause
  const violator = "You're seeing a convergence on operator (artifacts a1, a2, a3) -- in the last hour.";
  const r1 = auditVoiceLine(violator);
  assert.equal(r1.ok, false);
  assert.ok(r1.violations.indexOf('mechanism_clause') >= 0,
    'expected mechanism_clause violation, got: ' + JSON.stringify(r1.violations));

  // Matching valid line: adds "by uploading"
  const valid = "You're seeing a convergence on operator (artifacts a1, a2, a3) -- by uploading -- in the last hour.";
  const r2 = auditVoiceLine(valid);
  assert.equal(r2.ok, true);
});

test('D-17 end-to-end Test 16c: rule 3 violator caught + matching valid line passes', () => {
  // Rule 3 (time anchor) violator: no time pattern
  const violator = "You're seeing a convergence on operator (artifacts a1, a2, a3) -- by uploading.";
  const r1 = auditVoiceLine(violator);
  assert.equal(r1.ok, false);
  assert.ok(r1.violations.indexOf('time_anchor') >= 0);

  // Matching valid line: adds "in the last hour"
  const valid = "You're seeing a convergence on operator (artifacts a1, a2, a3) -- by uploading -- in the last hour.";
  const r2 = auditVoiceLine(valid);
  assert.equal(r2.ok, true);
});

test('D-17 end-to-end Test 16d: rule 4 violator caught + matching valid line passes', () => {
  // Rule 4 (unbacked superlative) violator: contains 'biggest' + 'breakthrough' without backing
  const violator = "You're seeing the biggest breakthrough on operator (artifacts a1, a2, a3) -- by uploading -- in the last hour.";
  const r1 = auditVoiceLine(violator);
  assert.equal(r1.ok, false);
  assert.ok(r1.violations.indexOf('no_unbacked_superlatives') >= 0,
    'expected no_unbacked_superlatives violation, got: ' + JSON.stringify(r1.violations));

  // Matching valid line: same content but no superlative
  const valid = "You're seeing a convergence on operator (artifacts a1, a2, a3) -- by uploading -- in the last hour.";
  const r2 = auditVoiceLine(valid);
  assert.equal(r2.ok, true);

  // Also valid: superlative WITH numeric backing
  const validBacked = "You're seeing a major (0.78) breakthrough on operator (artifacts a1, a2, a3) -- by uploading -- in the last hour.";
  const r3 = auditVoiceLine(validBacked);
  assert.equal(r3.ok, true,
    'backed superlative should pass, got: ' + JSON.stringify(r3.violations));
});

test('D-17 end-to-end Test 17: frequency-word guard (consistent/repeated/always need a count)', () => {
  const violator = "You're seeing a convergence on operator (artifacts a1, a2, a3) -- by consistently uploading -- in the last hour.";
  // The word 'consistent' (root) is in 'consistently'; FREQUENCY_WORDS requires a count nearby.
  const r1 = auditVoiceLine(violator);
  // Frequency word without a count -> rule 4 violation
  assert.equal(r1.ok, false,
    'expected violation for unbacked frequency word, got ok=true. line: ' + violator);

  const valid = "You're seeing a convergence on operator (artifacts a1, a2, a3) -- by consistent uploading (5 sessions) -- in the last hour.";
  const r2 = auditVoiceLine(valid);
  assert.equal(r2.ok, true,
    'backed frequency word should pass, got: ' + JSON.stringify(r2.violations));
});
