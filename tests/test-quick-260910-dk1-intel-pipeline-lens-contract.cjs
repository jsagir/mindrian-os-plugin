'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 260910-dk1 -- hermetic regression proof for the intel-pipeline
 * research pipe contract (.planning/todos/pending/2026-09-10-intel-pipeline-
 * fan-halt-lens-key-mismatch.md).
 * ==========================================================================
 * TWO contract mismatches made /mos:intel-pipeline's shipped research pipe
 * fan out with zero lenses and read as a silent halt:
 *
 *   (1) lib/core/intel-pipeline.cjs:118 called
 *       `extractor.extractContext(context.roomDir, { dimension })`
 *       POSITIONALLY, but lib/core/research-context-extractor.cjs:253 is
 *       `function extractContext(opts)`, ONE object, reading `opts.roomDir`,
 *       `opts.topic`, `opts.db`. The extractor therefore saw no roomDir.
 *
 *   (2) lib/core/intel-pipeline.cjs:121 spread the extractor's snake_case
 *       `lens_set` (research-context-extractor.cjs:278) into the driver, but
 *       lib/lens-engine/source-lens-driver.cjs:445 reads camelCase
 *       `opts.lensSet`. `rawLensSet` was therefore always `[]`, the driver
 *       returned `{ ok: false, reason: 'empty_lens_set' }`
 *       (source-lens-driver.cjs:450-452), findings were empty, quality was
 *       `low`, and intel-pipeline.cjs:440-445 halted the whole fan with the
 *       SEED-059 disclosure.
 *
 * lib/mcp/tool-router.cjs:546-556 already does this correctly;
 * /mos:intel-pipeline was the only broken caller.
 *
 * This file is FULLY HERMETIC: no network, no real extractor, no real lens
 * engine, no real room.db. Behaviors 1-3 inject the `_extractor` /
 * `_lensDriver` researchCtx seams (Task 2); Behavior 4 is a structural
 * source-text check. Pre-fix, Behaviors 1 and 2 report NOT OK (guarded, no
 * throw) because `_internal` does not exist yet; Behavior 3 runs the REAL
 * extractor + REAL driver (network-free: the driver returns empty_lens_set
 * before any fetch); Behavior 4 fails on the lensSet:/extractContext({
 * assertions.
 *
 * PASS line + non-zero exit on failure. NO em-dashes (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');

const REPO_ROOT = path.resolve(__dirname, '..');
const MOD_PATH = path.join(REPO_ROOT, 'lib', 'core', 'intel-pipeline.cjs');

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) { passed += 1; console.log('  ok - ' + name); } else { failed += 1; console.log('  NOT OK - ' + name); }
}
const TMP_DIRS = [];
function mkTmp(prefix) { const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); TMP_DIRS.push(d); return d; }
// Review WR-01 (quick-260910-dk1): remove every temp dir this run created, mirroring test-223's rmSync idiom.
function cleanupTmp() { for (const d of TMP_DIRS) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } } }
function deepEq(a, b) {
  try { assert.deepStrictEqual(a, b); return true; } catch (_e) { return false; }
}
function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

const FIXED_LENS_SET = [{ lens: 'scholarly', weight: 0.6 }, { lens: 'practitioner', weight: 0.4 }];
const FIXED_PREFLIGHT = { evidence_gaps: ['gap-a'], prior_research: [], section: 'market' };
const DB_STUB = { __stub: 'db' };

function makeExtractorSpy() {
  return {
    calls: [],
    extractContext: function extractContext() {
      this.calls.push({ argCount: arguments.length, arg: arguments[0] });
      return { ok: true, context_summary: 'ctx summary', lens_set: FIXED_LENS_SET, preflight: FIXED_PREFLIGHT };
    },
  };
}
function makeDriverSpy() {
  return {
    calls: [],
    runSourceLens: function runSourceLens() {
      this.calls.push({ argCount: arguments.length, arg: arguments[0] });
      return { ok: true, findings: [{ summary: 'finding one', title: 't1' }], lens_set: FIXED_LENS_SET, quality: 'ok' };
    },
  };
}

function loadInternal() {
  // eslint-disable-next-line global-require
  const mod = require(MOD_PATH);
  return mod._internal && typeof mod._internal.defaultResearchFn === 'function' ? { mod: mod, internal: mod._internal } : { mod: mod, internal: null };
}

// Behavior 1: direct seam call, asserts the one-object extractContext call and
// the camelCase lensSet driver call, with no snake_case leak.
async function b1() {
  console.log('--- Behavior 1: direct seam (extractContext one-object, camelCase lensSet) ---');
  const { internal } = loadInternal();
  check('exposes _internal.defaultResearchFn', internal !== null);
  if (!internal) { check('b1 skipped: no _internal export', false); return; }

  const roomDir = mkTmp('q-dk1-b1-');
  const extractorSpy = makeExtractorSpy();
  const driverSpy = makeDriverSpy();
  const ctx = { roomDir: roomDir, db: DB_STUB, dimension: 'market-sizing', _extractor: extractorSpy, _lensDriver: driverSpy };

  const pass = await internal.defaultResearchFn('market-sizing', ctx);

  check('extractContext called exactly once', extractorSpy.calls.length === 1);
  const extractCall = extractorSpy.calls[0] || { argCount: -1, arg: undefined };
  check('extractContext called with exactly ONE argument', extractCall.argCount === 1);
  check('extractContext argument is a plain object', isPlainObject(extractCall.arg));
  const extractArg = isPlainObject(extractCall.arg) ? extractCall.arg : {};
  check('extractContext arg.roomDir === ctx.roomDir', extractArg.roomDir === roomDir);
  check('extractContext arg.topic is a non-empty string', typeof extractArg.topic === 'string' && extractArg.topic.length > 0);
  check('extractContext arg.db === DB_STUB (strict)', extractArg.db === DB_STUB);

  check('runSourceLens called exactly once', driverSpy.calls.length === 1);
  const driverCall = driverSpy.calls[0] || { argCount: -1, arg: undefined };
  check('runSourceLens called with exactly ONE argument', driverCall.argCount === 1);
  check('runSourceLens argument is a plain object', isPlainObject(driverCall.arg));
  const driverArg = isPlainObject(driverCall.arg) ? driverCall.arg : {};
  check('driver arg.lensSet deep-equals FIXED_LENS_SET', deepEq(driverArg.lensSet, FIXED_LENS_SET));
  check('driver arg.lensSet has length >= 1', Array.isArray(driverArg.lensSet) && driverArg.lensSet.length >= 1);
  check('driver arg.roomDir === ctx.roomDir', driverArg.roomDir === roomDir);
  check('driver arg.topic is a non-empty string', typeof driverArg.topic === 'string' && driverArg.topic.length > 0);
  check('driver arg.preflight === FIXED_PREFLIGHT (strict)', driverArg.preflight === FIXED_PREFLIGHT);
  check('driver arg.stage is a string', typeof driverArg.stage === 'string' && driverArg.stage.length > 0);
  check('driver arg.db === DB_STUB (strict)', driverArg.db === DB_STUB);
  check("driver arg.dimension === 'market-sizing'", driverArg.dimension === 'market-sizing');
  check('driver arg has NO own property lens_set (snake_case must not leak)', !Object.prototype.hasOwnProperty.call(driverArg, 'lens_set'));

  check("returned pass quality === 'ok'", pass && pass.quality === 'ok');
  check('returned pass has exactly 1 finding', pass && Array.isArray(pass.findings) && pass.findings.length === 1);
  const f0 = (pass && Array.isArray(pass.findings) && pass.findings[0]) || {};
  check("finding text === 'finding one'", f0.text === 'finding one');
  check("finding dimension === 'market-sizing'", f0.dimension === 'market-sizing');
}

// Behavior 2: topic derivation -- ctx.handle wins when present, else the
// dimension label; extractor and driver receive the SAME topic string.
async function b2() {
  console.log('--- Behavior 2: topic derivation (handle wins, else dimension label) ---');
  const { internal } = loadInternal();
  if (!internal) { check('b2 skipped: no _internal export', false); return; }

  const roomDirWithHandle = mkTmp('q-dk1-b2a-');
  const extractorSpyA = makeExtractorSpy();
  const driverSpyA = makeDriverSpy();
  await internal.defaultResearchFn('market-sizing', {
    roomDir: roomDirWithHandle, db: DB_STUB, dimension: 'market-sizing', handle: 'Acme Robotics',
    _extractor: extractorSpyA, _lensDriver: driverSpyA,
  });
  const extractTopicA = extractorSpyA.calls[0] && isPlainObject(extractorSpyA.calls[0].arg) ? extractorSpyA.calls[0].arg.topic : undefined;
  const driverTopicA = driverSpyA.calls[0] && isPlainObject(driverSpyA.calls[0].arg) ? driverSpyA.calls[0].arg.topic : undefined;
  check("driver topic === 'Acme Robotics' when ctx.handle present", driverTopicA === 'Acme Robotics');
  check('extractor topic matches driver topic (handle case)', extractTopicA === driverTopicA);

  const roomDirNoHandle = mkTmp('q-dk1-b2b-');
  const extractorSpyB = makeExtractorSpy();
  const driverSpyB = makeDriverSpy();
  await internal.defaultResearchFn('market-sizing', {
    roomDir: roomDirNoHandle, db: DB_STUB, dimension: 'market-sizing',
    _extractor: extractorSpyB, _lensDriver: driverSpyB,
  });
  const extractTopicB = extractorSpyB.calls[0] && isPlainObject(extractorSpyB.calls[0].arg) ? extractorSpyB.calls[0].arg.topic : undefined;
  const driverTopicB = driverSpyB.calls[0] && isPlainObject(driverSpyB.calls[0].arg) ? driverSpyB.calls[0].arg.topic : undefined;
  check('driver topic === dimension label when no handle', driverTopicB === 'market-sizing');
  check('extractor topic matches driver topic (no-handle case)', extractTopicB === driverTopicB);
}

// Behavior 3: public path threading -- runIntelPipeline with NO researchFn
// injected, so the shipped defaultResearchFn runs, seams threaded via
// _extractor / _lensDriver on the top-level opts.
async function b3() {
  console.log('--- Behavior 3: public path threading (runIntelPipeline seams, no researchFn) ---');
  // eslint-disable-next-line global-require
  const { runIntelPipeline } = require(MOD_PATH);
  const roomDir = mkTmp('q-dk1-b3-');
  const extractorSpy = makeExtractorSpy();
  const driverSpy = makeDriverSpy();
  const jtbdFns = {
    getCurrent: () => ({ jtbd: 'validate-idea', confidence: 0.7, evidence: ['seed'] }),
    setCurrent: () => {},
  };
  const planFn = () => ({ agents: 2, budget: { effective: 120000, remaining: 200000 } });
  const computeFn = async () => ({ ok: true });
  const writeFn = async () => ({ ok: true, claim_ids: ['c1'] });
  const bankRollupFn = () => ({ ok: true });
  const approveAll = () => ({ approved: true });

  let res;
  try {
    res = await runIntelPipeline({
      roomDir: roomDir, db: DB_STUB, jtbdFns: jtbdFns, planFn: planFn, gateFn: approveAll,
      computeFn: computeFn, writeFn: writeFn, bankRollupFn: bankRollupFn, caps: { fan: 2 },
      _extractor: extractorSpy, _lensDriver: driverSpy,
    });
  } catch (e) {
    check('runIntelPipeline did not throw', false);
    console.log('    threw: ' + String(e && e.message));
    return;
  }

  check('driverSpy was called at least once', driverSpy.calls.length >= 1);
  const allCarryLensSet = driverSpy.calls.length > 0 && driverSpy.calls.every((c) => isPlainObject(c.arg) && Array.isArray(c.arg.lensSet) && c.arg.lensSet.length > 0);
  check('every recorded driver argument carries a non-empty lensSet', allCarryLensSet);
  check("run is not halted at the fan stage", res && res.halt_stage !== 'fan');
}

// Behavior 4: structural -- the source text carries the fixed contract shape.
function b4() {
  console.log('--- Behavior 4: structural source assertions ---');
  const src = fs.readFileSync(MOD_PATH, 'utf8');
  check('source contains lensSet:', /lensSet:/.test(src));
  check('source contains extractContext({', /extractContext\(\{/.test(src));
  check('source does NOT match extractContext(context.roomDir positional form', !/extractContext\(\s*context\.roomDir/.test(src));
  check('source has no em-dash', !/\u2014/.test(src));
}

async function main() {
  await b1();
  await b2();
  await b3();
  b4();
  console.log('\n' + (failed === 0 ? 'PASS' : 'FAIL') + ' - test-quick-260910-dk1-intel-pipeline-lens-contract: ' + passed + ' passed, ' + failed + ' failed');
  cleanupTmp();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); cleanupTmp(); process.exit(1); });
