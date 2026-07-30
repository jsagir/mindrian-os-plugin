#!/usr/bin/env node
'use strict';

/**
 * Phase 239 Plan 05 (BRAIN-02) -- the SC2 proof.
 *
 * Proves that a canary token typed into an opportunity field, AND into a Blue
 * Hat methodology note, is caught by the Part 8 egress guard BEFORE it
 * reaches the Brain wire, driven through the REAL query() path against a
 * captured mock transport (tests/helpers/brain-capture-server.cjs, extracted
 * by 239-01 per Canon Part 7 -- reuse, not reinvent).
 *
 * Canary values, exactly as measured in 239-RESEARCH.md so this test
 * reproduces the same proof rather than inventing a new one:
 *   - content canary: CANARY7F3A2B
 *   - PII canary:     jane@startup.com
 *
 * Seven legs:
 *   LEG 1 - opportunity-field canary (SC2 door one)
 *   LEG 2 - Blue Hat methodology-note canary (SC2 door two)
 *   LEG 3 - PII canary (opportunity.domain = jane@startup.com)
 *   LEG 4 - REGRESSION: template laundering cannot return (threat T4)
 *   LEG 5 - REGRESSION: sanitize-before-classify ordering cannot return (T5)
 *   LEG 6 - ANTI-VACUITY: prove the capture server actually captures
 *   LEG 7 - automated companion to the manual mutation probe (the mutation
 *           itself is performed by hand by the executor and transcribed in
 *           the plan SUMMARY, per the Phase 241/242/243 precedent)
 *
 * Plain Node, node:assert. No new runtime deps. No em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');

const {
  startCaptureServer,
  captured,
  resetCaptured,
  stopCaptureServer,
} = require('./helpers/brain-capture-server.cjs');

const CONTENT_CANARY = 'CANARY7F3A2B';
const PII_CANARY = 'jane@startup.com';
const PII_CANARY_SANITIZED = 'janestartup.com';

// ---------------------------------------------------------------------------
// Fixture helper: a fresh room directory with an initialized room.db, the
// exact mkRoomWithDb shape used by tests/test-130-cognitive-migration.cjs so
// hat-persistence.cjs's navigation-routed *ByRoomDir wrappers have a real
// room.db to read/write.
// ---------------------------------------------------------------------------
function mkRoomWithDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'egress-canary-'));
  const mindrian = path.join(dir, '.mindrian');
  fs.mkdirSync(mindrian, { recursive: true });
  const roomDbMod = require(path.join(REPO, 'lib/core/room-db.cjs'));
  const db = roomDbMod.openRoomDb(dir);
  roomDbMod.closeRoomDb(db);
  return dir;
}

// ---------------------------------------------------------------------------
// Source-order helper (LEG 5 + LEG 7 companion): extract one top-level
// function's source body by name, from its declaration to the next top-level
// function declaration (or EOF). Pure text slicing over the real file, not a
// parser -- this is a real ordering gate over real source, not prose.
// ---------------------------------------------------------------------------
function extractFunctionBody(src, fnSignaturePrefix) {
  const startIdx = src.indexOf(fnSignaturePrefix);
  assert.ok(startIdx !== -1, 'function not found in source: ' + fnSignaturePrefix);
  const nextFnRegex = /\n(?:async function |function )/g;
  nextFnRegex.lastIndex = startIdx + fnSignaturePrefix.length;
  const m = nextFnRegex.exec(src);
  const endIdx = m ? m.index : src.length;
  return src.slice(startIdx, endIdx);
}

async function main() {
  const { server, url } = await startCaptureServer();

  // ORDERING CONTRACT (load-bearing): set env BEFORE requiring brain-client,
  // because BRAIN_URL is module-scoped at load time (brain-client.cjs:24).
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real';

  const brainClientPath = path.resolve(REPO, 'lib', 'core', 'brain-client.cjs');
  delete require.cache[brainClientPath];
  const brain = require(brainClientPath);

  const guard = require(path.join(REPO, 'lib/core/part8-egress-guard.cjs'));
  const hatPersistence = require(path.join(REPO, 'lib/core/hat-persistence.cjs'));

  let failed = 0;
  const record = (name, fn) =>
    fn()
      .then(() => {
        process.stdout.write('  ok  ' + name + '\n');
      })
      .catch((err) => {
        failed += 1;
        process.stderr.write('  FAIL ' + name + '\n    ' + err.message + '\n');
      });

  process.stdout.write('Phase 239-05 (BRAIN-02) query egress canary suite\n');

  // -------------------------------------------------------------------------
  // LEG 1: opportunity-field canary (SC2 door one).
  // -------------------------------------------------------------------------
  await record('LEG 1: opportunity.domain canary caught before the wire', async () => {
    resetCaptured();
    const opp = {
      problem: 'CANARY7F3A2B validation problem',
      domain: CONTENT_CANARY,
      knight_position: 'uncertainty',
    };
    const result = await brain.suggestValidationSteps(opp);
    assert.strictEqual(result, null, 'suggestValidationSteps must return null on a blocked canary');
    const wire = JSON.stringify(captured);
    assert.ok(
      !wire.includes(CONTENT_CANARY),
      'LEG 1 FAILED: canary crossed the wire: ' + wire
    );
    process.stdout.write('    LEG 1 captured (must be empty of canary): ' + wire + '\n');
  });

  // -------------------------------------------------------------------------
  // LEG 2: Blue Hat methodology-note canary (SC2 door two). problemType is
  // set to a string that DOES clear the raw-field guard (contains real
  // methodology vocabulary, no canary) so the loop actually reaches the
  // blueNotes entry and blocks specifically on THAT field, not incidentally
  // on problemType.
  // -------------------------------------------------------------------------
  await record('LEG 2: Blue Hat methodology_notes canary caught before the wire', async () => {
    resetCaptured();
    const room = mkRoomWithDb();
    const saved = hatPersistence.saveHatState(room, 'blue', {
      methodology_notes: [CONTENT_CANARY + ' was not useful for this room'],
    });
    assert.ok(saved && saved.saved === true, 'fixture setup: Blue Hat note did not save');

    const result = await brain.hatAwareRecommend(room, 'framework selection');
    assert.strictEqual(result, null, 'hatAwareRecommend must return null on a blocked canary');
    const wire = JSON.stringify(captured);
    assert.ok(
      !wire.includes(CONTENT_CANARY),
      'LEG 2 FAILED: canary crossed the wire: ' + wire
    );
    process.stdout.write('    LEG 2 captured (must be empty of canary): ' + wire + '\n');
  });

  // -------------------------------------------------------------------------
  // LEG 3: PII canary. Same door as LEG 1, PII canary instead of the content
  // canary. Asserts zero occurrences of BOTH the raw PII and its sanitized
  // form (a sanitized leak is still a leak).
  // -------------------------------------------------------------------------
  await record('LEG 3: PII canary (jane@startup.com) caught before the wire', async () => {
    resetCaptured();
    const opp = {
      problem: 'validate this PII-adjacent opportunity',
      domain: PII_CANARY,
      knight_position: 'uncertainty',
    };
    const result = await brain.suggestValidationSteps(opp);
    assert.strictEqual(result, null, 'suggestValidationSteps must return null on a blocked PII canary');
    const wire = JSON.stringify(captured);
    assert.ok(!wire.includes(PII_CANARY), 'LEG 3 FAILED: raw PII crossed the wire: ' + wire);
    assert.ok(
      !wire.includes(PII_CANARY_SANITIZED),
      'LEG 3 FAILED: sanitized PII crossed the wire (a sanitized leak is still a leak): ' + wire
    );
    process.stdout.write('    LEG 3 captured (must be empty of both PII forms): ' + wire + '\n');
  });

  // -------------------------------------------------------------------------
  // LEG 4: REGRESSION, template laundering cannot return (threat T4).
  // -------------------------------------------------------------------------
  await record('LEG 4: template-laundering regression (T4)', async () => {
    const v1 = guard.classify({ cypher: CONTENT_CANARY }, { toolName: 'brain_query' });
    const v2 = guard.classify(
      { cypher: 'MATCH (f:Framework) WHERE x="' + CONTENT_CANARY + '"' },
      { toolName: 'brain_query' }
    );
    const v3 = guard.classify({ question: CONTENT_CANARY }, { toolName: 'brain_ask' });
    process.stdout.write(
      '    LEG 4 verdicts: bare-cypher=' + JSON.stringify(v1) +
        ' templated-cypher=' + JSON.stringify(v2) +
        ' raw-field=' + JSON.stringify(v3) + '\n'
    );
    assert.strictEqual(v1.verdict, 'ambiguous', 'bare-cypher canary must classify ambiguous');
    assert.strictEqual(v2.verdict, 'allow', 'templated-cypher canary must classify allow (the measured laundering)');
    assert.notStrictEqual(
      v3.verdict,
      'allow',
      'RAW-FIELD form must NOT be allow -- this is the whole reason the guard sits at the raw-field ' +
        'tier. If someone later moves it to the assembled string, this assertion still passes but ' +
        'LEG 1 goes red, and that is the intended coupling.'
    );
  });

  // -------------------------------------------------------------------------
  // LEG 5: REGRESSION, sanitize-before-classify ordering cannot return (T5).
  // -------------------------------------------------------------------------
  await record('LEG 5: sanitize-before-classify ordering regression (T5)', async () => {
    const sanitized = brain._test.sanitizeCypherInput(PII_CANARY);
    assert.strictEqual(sanitized, PII_CANARY_SANITIZED, 'measured sanitize transformation must hold');

    const rawVerdict = guard.classify({ question: PII_CANARY }, { toolName: 'brain_ask' });
    assert.strictEqual(rawVerdict.verdict, 'block', 'raw PII must classify block');

    const sanitizedVerdict = guard.classify({ question: sanitized }, { toolName: 'brain_ask' });
    assert.notStrictEqual(
      sanitizedVerdict.verdict,
      'block',
      'sanitized PII must NOT classify block (the measured sanitizer-disarms-detector failure)'
    );

    process.stdout.write(
      '    LEG 5: sanitizeCypherInput(' + PII_CANARY + ') = ' + sanitized +
        ' | raw verdict=' + rawVerdict.verdict +
        ' | sanitized verdict=' + sanitizedVerdict.verdict + '\n'
    );

    // SOURCE-ORDER assertion over real source: within suggestValidationSteps,
    // the first classify( call must precede the first sanitizeCypherInput(
    // call.
    const src = fs.readFileSync(brainClientPath, 'utf8');
    const svsBody = extractFunctionBody(src, 'async function suggestValidationSteps(');
    const classifyIdx = svsBody.indexOf('classify(');
    const sanitizeIdx = svsBody.indexOf('sanitizeCypherInput(');
    assert.ok(classifyIdx !== -1, 'suggestValidationSteps must call classify(');
    assert.ok(sanitizeIdx !== -1, 'suggestValidationSteps must call sanitizeCypherInput(');
    assert.ok(
      classifyIdx < sanitizeIdx,
      'SOURCE-ORDER VIOLATION: classify( (index ' + classifyIdx +
        ') must precede sanitizeCypherInput( (index ' + sanitizeIdx + ') inside suggestValidationSteps'
    );
    process.stdout.write(
      '    LEG 5 source-order: classify( at char ' + classifyIdx +
        ', sanitizeCypherInput( at char ' + sanitizeIdx + ' (ordering holds)\n'
    );
  });

  // -------------------------------------------------------------------------
  // LEG 6: ANTI-VACUITY. Prove the capture server actually captures, using a
  // payload that SHOULD pass (generic methodology handles, no user content,
  // no canary). Without this leg, LEGs 1-3 could pass because nothing ever
  // reached the wire for unrelated reasons.
  // -------------------------------------------------------------------------
  await record('LEG 6: anti-vacuity -- a should-pass payload actually reaches the wire', async () => {
    resetCaptured();
    const goodOpp = {
      problem: 'framework chain analysis',
      domain: 'framework',
      knight_position: 'uncertainty',
    };
    await brain.suggestValidationSteps(goodOpp);
    assert.ok(
      captured.length > 0,
      'ANTI-VACUITY FAILURE: zero tools/call requests reached the capture server for a should-pass payload'
    );
    const toolNames = captured.map((c) => c.name);
    assert.ok(
      toolNames.includes('brain_query'),
      'expected at least one brain_query call, got: ' + JSON.stringify(toolNames)
    );
    process.stdout.write(
      '    LEG 6: captured.length=' + captured.length + ' tool names=' + JSON.stringify(toolNames) + '\n'
    );
  });

  // -------------------------------------------------------------------------
  // LEG 7: automated companion to the manual mutation probe. The mutation
  // itself (commenting out the guard block, observing the canary cross the
  // wire, restoring) is performed BY THE EXECUTOR BY HAND per the Phase
  // 241/242/243 precedent and transcribed in the plan SUMMARY. This
  // assertion is the automated backstop that catches a future deletion of
  // the guard even without a human re-running the manual probe.
  // -------------------------------------------------------------------------
  await record('LEG 7: automated companion -- classify( present in both guarded functions', async () => {
    const src = fs.readFileSync(brainClientPath, 'utf8');
    const hatBody = extractFunctionBody(src, 'async function hatAwareRecommend(');
    const svsBody = extractFunctionBody(src, 'async function suggestValidationSteps(');
    assert.ok(
      hatBody.includes('classify('),
      'hatAwareRecommend no longer calls classify( -- the raw-field guard was removed'
    );
    assert.ok(
      svsBody.includes('classify('),
      'suggestValidationSteps no longer calls classify( -- the raw-field guard was removed'
    );
  });

  await stopCaptureServer(server);

  process.stdout.write(
    '\nPhase 239-05 canary suite: ' + (failed === 0 ? 'PASS' : 'FAIL') + ' (' + failed + ' failures)\n'
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  process.stderr.write('UNEXPECTED ERROR: ' + (err && err.stack ? err.stack : String(err)) + '\n');
  process.exit(1);
});
