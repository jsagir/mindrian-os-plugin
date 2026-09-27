#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355.1 Plan 15 Task 1 (AMB-08). The Part 8 / Part 9 / zod-at-edges
 * sweep over every new 355.1 file: proves that nothing from the room leaves
 * the machine except canon handles through the one stamp adapter, that zod
 * sits only at the outside edges, that machinery confirms nothing, and that
 * every closed-shape file the ambient path writes stays closed after a full
 * fixture cycle.
 *
 * TWO TARGET GROUPS (355.1-CONTEXT.md "Boundaries", must_haves):
 *   NEW_FILES -- wholly new 355.1 files. Scanned whole-file, non-comment
 *     lines only (tests/helpers/hygiene-355.cjs's own URL-safe idiom). A
 *     missing target FAILS the leg (this file's own dependencies are long
 *     landed by plan 355.1-15; never a silent skip).
 *   EXTENDED_FILES -- pre-existing files 355.1 extended
 *     (scripts/scout-cadence-guard.cjs, scripts/auto-explore-fire.cjs). Both
 *     files carry PRE-EXISTING, unrelated content this sweep must never trip
 *     on (scout-cadence-guard.cjs's own Phase-145 `node:sqlite`/`DatabaseSync`
 *     room-graph read for HARD-02, confirmed present at BASE_3551, is exactly
 *     such a case), so these two are scanned only over the 355.1 SECTION: the
 *     lines `git diff BASE_3551..HEAD` reports as added, non-comment only.
 *     BASE_3551 = 2f5109bef (355.1-BASELINE.md).
 *
 * Legs (a)-(h):
 *   (a) egress: no PART8_RE token on a non-comment line of any target.
 *   (b) one wire: no target requires brain-client, the mindrian-brain shim
 *       or a pws-brain client; a static require scan of ambient-run.cjs
 *       confirms it reaches Theo only through verification-stamp.cjs.
 *   (c) zod at edges: no target requires zod.
 *   (d) Part 9: no target contains INSERT INTO, DatabaseSync, a bare
 *       require('node:sqlite'), a review_status assignment, or a
 *       logMemoryEvent call (zero exist in the 355.1-authored content at
 *       HEAD; this leg is the strictest safe reading of "machinery confirms
 *       nothing" given that ground truth -- see 355.1-15-SUMMARY.md for the
 *       discretion note).
 *   (e) closed files after a full fixture cycle (buildDeltaRoom + addClaims(5)
 *       -> closeOutRoom, capturing the claim+spawn -> runAmbientInChild with
 *       an injected composition producing one indirect finding -> a second
 *       closeOutRoom, capturing that nothing spawns again): ambient-run-
 *       ledger.json, last-room-delta.json and the lock file (when present)
 *       hold no 'SECRET-3551-' marker, no room slug, no '/' and validate
 *       against their own closed schema (scout-cadence-guard.cjs's
 *       validateAmbientLedger / validateDeltaState).
 *   (f) argv: buildAmbientArgv returns exactly six elements matching
 *       [abs fire path, roomDir, '', /^ambient-[0-9a-f]{12}$/, session id,
 *       '--ambient'], and none holds the marker.
 *   (g) Theo args: a counting callTool wrapping the 355-06 stampFindings
 *       call over a fixed canon pair (the escape hatch this plan's own
 *       behavior spec names -- "else the 355-06 stampFindings call with the
 *       fixture pair" -- taken directly, since the seedIndirectComposition
 *       idiom this plan's other legs reuse never itself calls callTool);
 *       every captured argument value is a canon name from
 *       data/framework-names.json.
 *   (h) negative controls, each reported PASS when caught by the SAME
 *       scanner functions legs (a)/(c)/(d) use, then deleted.
 *
 * Test hygiene contract (every 355/355.1 test): scrub TYPESAFE_API_KEY and
 * install the net guard via tests/helpers/hygiene-355.cjs BEFORE requiring
 * any repo module; assert attempts() === 0 as the last check.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
const hadKey = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

try {
  require('node:sqlite');
} catch (_e) {
  process.stdout.write('SKIP test-3551-part8-egress.cjs (node:sqlite unavailable)\n');
  process.exit(77);
}

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const checker = hygiene.makeChecker('test-3551-part8-egress');
const { check } = checker;

const { buildDeltaRoom } = require('./helpers/fixture-room-3551.cjs');
const ambientTrigger = require(path.join(REPO, 'lib', 'core', 'ambient-trigger.cjs'));
const ambientRun = require(path.join(REPO, 'lib', 'core', 'ambient-run.cjs'));
const guard = require(path.join(REPO, 'scripts', 'scout-cadence-guard.cjs'));
const stopGateHandler = require(path.join(REPO, 'lib', 'mcp', 'stop-gate-handler.cjs'));
const verificationStamp = require(path.join(REPO, 'lib', 'core', 'verification-stamp.cjs'));
const directionConvention = require(path.join(REPO, 'lib', 'core', 'direction-convention.cjs'));
const { makeCountingCallTool, makeNullCallTool } = require(path.join(REPO, 'tests', 'helpers', 'theo-replay-355.cjs'));

// ---------------------------------------------------------------------------
// Target groups
// ---------------------------------------------------------------------------
const BASE_3551 = '2f5109bef';

const NEW_FILES = [
  'lib/core/navigation/room-delta-facts.cjs',
  'lib/core/sensors/sensor-room-delta.cjs',
  'lib/core/ambient-framing.cjs',
  'lib/core/ambient-trigger.cjs',
  'lib/core/ambient-run.cjs',
  'lib/mcp/surfaced-offers.cjs',
  'scripts/ambient-stop.cjs',
];

const EXTENDED_FILES = [
  'scripts/scout-cadence-guard.cjs',
  'scripts/auto-explore-fire.cjs',
];

// ---------------------------------------------------------------------------
// Scanner constants (shared by legs a/b/c/d and the negative controls, h)
// ---------------------------------------------------------------------------
const PART8_RE = /fetch\(|https?:\/\/|require\(['"]node:https?|\b(curl|wget)\b/;
const BRAIN_WIRE_RE = /require\(['"][^'"]*(brain-client|mindrian-brain|pws-brain)[^'"]*['"]\)/;
const ZOD_RE = /require\(['"]zod['"]\)/;
const PART9_RE = /INSERT INTO|DatabaseSync|require\(['"]node:sqlite['"]\)|review_status\s*[:=]|logMemoryEvent\(/;

// nonCommentLinesFromText(rawLines) -- the SAME URL-safe comment-strip idiom
// hygiene-355.cjs's own nonCommentLines applies to a file, applied instead to
// an in-memory array of raw lines (a `git diff` added-line set has no file
// path of its own to read).
function nonCommentLinesFromText(rawLines) {
  const out = [];
  for (const line of rawLines) {
    if (hygiene.isPureLineComment(line)) continue;
    const code = line.replace(/(^|[^:])\/\/.*$/, '$1');
    out.push(code);
  }
  return out;
}

// addedLinesSince(baseSha, relFile) -- the raw '+' lines (leading '+'
// stripped, '+++' header excluded) `git diff --unified=0 baseSha -- relFile`
// reports, i.e. the 355.1 SECTION of a pre-existing file this phase
// extended. [] on any git fault (never throws).
function addedLinesSince(baseSha, relFile) {
  let out;
  try {
    out = execFileSync('git', ['diff', '--unified=0', baseSha, '--', relFile], {
      cwd: REPO,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (_e) {
    return [];
  }
  const added = [];
  for (const line of out.split(/\r?\n/)) {
    if (line.startsWith('+++') || line.startsWith('---')) continue;
    if (line.startsWith('+')) added.push(line.slice(1));
  }
  return added;
}

// contentLinesFor(rel) -- { lines, missing }. NEW_FILES read whole-file
// (a missing target FAILS); EXTENDED_FILES read only the 355.1-added lines.
function contentLinesFor(rel, isExtended) {
  const abs = path.join(REPO, rel);
  if (!fs.existsSync(abs)) return { lines: [], missing: true };
  if (isExtended) {
    return { lines: nonCommentLinesFromText(addedLinesSince(BASE_3551, rel)), missing: false };
  }
  return { lines: hygiene.nonCommentLines(abs), missing: false };
}

function forEachTarget(fn) {
  for (const rel of NEW_FILES) fn(rel, false);
  for (const rel of EXTENDED_FILES) fn(rel, true);
}

// ---------------------------------------------------------------------------
// Leg (a): egress -- no PART8_RE token on a non-comment line of any target.
// A missing target FAILS the leg, never a silent skip.
// ---------------------------------------------------------------------------
function legEgress() {
  console.log('--- leg A: no egress token on any 355.1 target ---');
  forEachTarget(function (rel, isExtended) {
    const { lines, missing } = contentLinesFor(rel, isExtended);
    if (missing) {
      check('A ' + rel + ': present (a missing target FAILS this leg)', false, 'MISSING');
      return;
    }
    check('A ' + rel + (isExtended ? ' (355.1 section)' : '') + ': carries no egress token on a non-comment line',
      !lines.some((l) => PART8_RE.test(l)));
  });
}

// ---------------------------------------------------------------------------
// Leg (b): one wire -- no target requires brain-client / mindrian-brain /
// pws-brain; ambient-run.cjs reaches Theo only through verification-stamp.cjs.
// ---------------------------------------------------------------------------
function legOneWire() {
  console.log('--- leg B: no 355.1 target requires brain-client / mindrian-brain / pws-brain ---');
  forEachTarget(function (rel, isExtended) {
    const { lines, missing } = contentLinesFor(rel, isExtended);
    if (missing) {
      check('B ' + rel + ': present (a missing target FAILS this leg)', false, 'MISSING');
      return;
    }
    check('B ' + rel + (isExtended ? ' (355.1 section)' : '') + ': requires no brain-client/mindrian-brain/pws-brain client',
      !lines.some((l) => BRAIN_WIRE_RE.test(l)));
  });

  const ambientRunLines = hygiene.nonCommentLines(path.join(REPO, 'lib', 'core', 'ambient-run.cjs'));
  const requiresVerificationStamp = ambientRunLines.some((l) => /require\(['"][^'"]*verification-stamp\.cjs['"]\)/.test(l));
  check('B: ambient-run.cjs requires verification-stamp.cjs (the one wire to Theo)', requiresVerificationStamp);
}

// ---------------------------------------------------------------------------
// Leg (c): zod at edges -- no target requires zod.
// ---------------------------------------------------------------------------
function legZodAtEdges() {
  console.log('--- leg C: no 355.1 target requires zod ---');
  forEachTarget(function (rel, isExtended) {
    const { lines, missing } = contentLinesFor(rel, isExtended);
    if (missing) {
      check('C ' + rel + ': present (a missing target FAILS this leg)', false, 'MISSING');
      return;
    }
    check('C ' + rel + (isExtended ? ' (355.1 section)' : '') + ": requires no zod ('zod only at the two outside edges')",
      !lines.some((l) => ZOD_RE.test(l)));
  });
}

// ---------------------------------------------------------------------------
// Leg (d): Part 9 -- machinery confirms nothing.
// ---------------------------------------------------------------------------
function legPart9() {
  console.log('--- leg D: Part 9, machinery confirms nothing ---');
  forEachTarget(function (rel, isExtended) {
    const { lines, missing } = contentLinesFor(rel, isExtended);
    if (missing) {
      check('D ' + rel + ': present (a missing target FAILS this leg)', false, 'MISSING');
      return;
    }
    check('D ' + rel + (isExtended ? ' (355.1 section)' : '') + ': carries no INSERT INTO, DatabaseSync, node:sqlite, review_status assignment or logMemoryEvent call',
      !lines.some((l) => PART9_RE.test(l)));
  });
}

// ---------------------------------------------------------------------------
// Leg (e): closed files after a full fixture cycle.
// ---------------------------------------------------------------------------
const INDIRECT_STAMP = Object.freeze({
  verification: 'indirect', backend: 'theo', direction: 'structural_transfer', judge: 'none',
  path: Object.freeze({
    nodes: ['Reverse Salient Analysis', 'Six Thinking Hats'],
    labels: ['Reverse Salient Analysis', 'Six Thinking Hats'],
    edges: ['EXTENDS'],
  }),
});

// seedIndirectComposition -- replicated from tests/test-3551-tri-polar.cjs /
// tests/test-3551-mcp-fire-once.cjs (each test replicates this idiom
// locally; no test file exports it for cross-require): the REAL
// runAmbientComposition (lib/core/ambient-run.cjs) with an injected adapter
// returning ONE finding carrying an indirect stamp and an injected
// measureAndGuard that always clears, so the resulting ledger/side-channel
// shape is byte-identical to what production writes.
async function seedIndirectComposition(roomDir, stamp, seed) {
  const suffix = (typeof seed === 'string' && seed) ? seed : '';
  const finding = {
    producer: 'eureka',
    a: { handle: 'nodeA' + suffix, text: 'alpha finding text' + suffix },
    b: { handle: 'nodeB' + suffix, text: 'omega finding text' + suffix },
    stamp: stamp,
    rank: 0,
  };
  const adapters = {
    eureka: async () => ({ outcome: 'no_candidate', findings: [finding] }),
    'find-connections': async () => ({ outcome: 'no_candidate', findings: [] }),
    'find-bottlenecks': async () => ({ outcome: 'no_candidate', findings: [] }),
    hsi: async () => ({ outcome: 'no_candidate', findings: [] }),
    whitespace: async () => ({ outcome: 'no_candidate', findings: [] }),
  };
  const measureAndGuard = async () => ({
    ok: true,
    score: { direction: 'structural_transfer', abs_diff: 0.5, band: 'opportunity', passes: true, semantic: 0.1, lexical: 0.1 },
    guard: { cleared: true, verdict: 'transferable', confidence: 'high', tags: [] },
  });
  const res = await ambientRun.runAmbientComposition(roomDir, { deps: { adapters: adapters, measureAndGuard: measureAndGuard } });
  if (!res || !res.card) throw new Error('seedIndirectComposition: expected a card, got: ' + JSON.stringify(res));
  return res;
}

async function legClosedFiles() {
  console.log('--- leg E: closed files after a full fixture cycle ---');
  try { stopGateHandler._resetForTest(); } catch (_e) { /* best effort */ }
  const room = buildDeltaRoom('egress-closed-files');
  try {
    room.addClaims(5);
    const sessionId = 'sess-egress-closed-files';

    let capturedArgv1 = null;
    ambientTrigger._internal.setSpawnImpl(function (_cmd, args) {
      capturedArgv1 = args;
      return { unref: function () {} };
    });
    try {
      stopGateHandler.closeOutRoom(room.roomDir, sessionId);
    } finally {
      ambientTrigger._internal.resetSpawnImpl();
    }
    check('E: the first closeOutRoom claims and spawns the ambient child', Array.isArray(capturedArgv1));
    const ambientId = Array.isArray(capturedArgv1) ? capturedArgv1[3] : null;

    async function composition(roomDirArg) {
      return seedIndirectComposition(roomDirArg, INDIRECT_STAMP, '-egress');
    }
    const runResult = await ambientRun.runAmbientInChild(room.roomDir, {
      ambientId: ambientId,
      sessionId: sessionId,
      deps: { composition: composition },
    });
    check('E: runAmbientInChild completes and surfaces via sens13',
      runResult.state === 'completed' && runResult.surfaced_via === 'sens13', JSON.stringify(runResult));

    let capturedArgv2 = null;
    ambientTrigger._internal.setSpawnImpl(function (_cmd, args) {
      capturedArgv2 = args;
      return { unref: function () {} };
    });
    try {
      stopGateHandler.closeOutRoom(room.roomDir, sessionId);
    } finally {
      ambientTrigger._internal.resetSpawnImpl();
    }
    check('E: the second closeOutRoom spawns nothing new', capturedArgv2 === null);

    const ledgerPath = path.join(room.roomDir, '.mindrian', 'ambient-run-ledger.json');
    const deltaStatePath = path.join(room.roomDir, '.mindrian', 'last-room-delta.json');
    const lockPath = path.join(room.roomDir, '.mindrian', 'ambient-run.lock');

    check('E: ambient-run-ledger.json exists', fs.existsSync(ledgerPath));
    check('E: last-room-delta.json exists', fs.existsSync(deltaStatePath));

    const ledgerRaw = fs.readFileSync(ledgerPath, 'utf8');
    const deltaRaw = fs.readFileSync(deltaStatePath, 'utf8');

    check('E: ambient-run-ledger.json carries no SECRET-3551- marker', ledgerRaw.indexOf('SECRET-3551-') === -1);
    check('E: last-room-delta.json carries no SECRET-3551- marker', deltaRaw.indexOf('SECRET-3551-') === -1);
    check('E: ambient-run-ledger.json carries no room slug', ledgerRaw.indexOf(room.slug) === -1);
    check('E: last-room-delta.json carries no room slug', deltaRaw.indexOf(room.slug) === -1);
    check('E: ambient-run-ledger.json carries no path separator', ledgerRaw.indexOf('/') === -1);
    check('E: last-room-delta.json carries no path separator', deltaRaw.indexOf('/') === -1);

    let ledgerParsed = null;
    let deltaParsed = null;
    try { ledgerParsed = JSON.parse(ledgerRaw); } catch (_e) { ledgerParsed = null; }
    try { deltaParsed = JSON.parse(deltaRaw); } catch (_e) { deltaParsed = null; }
    check('E: ambient-run-ledger.json validates against its closed schema', !!ledgerParsed && guard.validateAmbientLedger(ledgerParsed));
    check('E: last-room-delta.json validates against its closed schema',
      !!deltaParsed && guard.validateDeltaState(deltaParsed).ok === true);

    if (fs.existsSync(lockPath)) {
      const lockRaw = fs.readFileSync(lockPath, 'utf8');
      check('E: ambient-run.lock (present) carries no SECRET-3551- marker', lockRaw.indexOf('SECRET-3551-') === -1);
      check('E: ambient-run.lock (present) carries no room slug', lockRaw.indexOf(room.slug) === -1);
    } else {
      check('E: ambient-run.lock released after the run (not present)', true);
    }
  } finally {
    try { room.cleanup(); } catch (_e) { /* best effort */ }
  }
}

// ---------------------------------------------------------------------------
// Leg (f): argv -- buildAmbientArgv returns the closed six-element shape.
// ---------------------------------------------------------------------------
function legArgv() {
  console.log('--- leg F: buildAmbientArgv returns the closed six-element shape ---');
  const firePath = path.join(REPO, 'scripts', 'auto-explore-fire.cjs');
  const roomDir = path.join(os.tmpdir(), 'mos-3551-argv-leg-room');
  const deltaHash = 'f'.repeat(64);
  const sessionId = 'sess-argv-leg';
  const argv = ambientTrigger.buildAmbientArgv(firePath, roomDir, deltaHash, sessionId);

  check('F: argv has exactly six elements', Array.isArray(argv) && argv.length === 6, JSON.stringify(argv));
  check('F: argv[0] is the abs fire path', argv[0] === firePath);
  check('F: argv[1] is roomDir', argv[1] === roomDir);
  check('F: argv[2] is an empty string', argv[2] === '');
  check('F: argv[3] matches ambient-<12 hex>', /^ambient-[0-9a-f]{12}$/.test(argv[3]));
  check('F: argv[4] is the session id', argv[4] === sessionId);
  check('F: argv[5] is --ambient', argv[5] === '--ambient');
  check('F: no argv element carries the marker', !argv.some((a) => typeof a === 'string' && a.indexOf('SECRET-3551-') !== -1));
}

// ---------------------------------------------------------------------------
// Leg (g): Theo args -- every captured argument value is a canon name.
// (The escape hatch this plan's own behavior spec names: the
// seedIndirectComposition idiom every other leg reuses never itself calls
// callTool -- its injected adapter returns a pre-made stamp directly -- so
// the "else the 355-06 stampFindings call with the fixture pair" branch is
// taken here directly.)
// ---------------------------------------------------------------------------
async function legTheoArgsCanonOnly() {
  console.log('--- leg G: every captured Theo arg is a canon name ---');
  const names = verificationStamp.loadFrameworkNames();
  const FIXED_A = 'Reverse Salient Analysis';
  const FIXED_B = 'Six Thinking Hats';
  check('G: both fixed canon names are real snapshot names', names.has(FIXED_A) && names.has(FIXED_B));

  const counting = makeCountingCallTool(makeNullCallTool());
  const findings = [{
    fromHandle: FIXED_A, toHandle: FIXED_B, fromVia: 'title', toVia: 'title',
    direction: directionConvention.NONE,
  }];
  await verificationStamp.stampFindings(findings, { callTool: counting });

  check('G: at least one call was captured', counting.calls.length > 0, 'got ' + counting.calls.length);
  let shapeOk = true;
  let namesOk = true;
  for (const c of counting.calls) {
    if (c.tool !== 'find_connections') shapeOk = false;
    const keys = Object.keys(c.args).sort();
    if (keys.length !== 2 || keys[0] !== 'from' || keys[1] !== 'to') shapeOk = false;
    if (!names.has(c.args.from) || !names.has(c.args.to)) namesOk = false;
  }
  check('G: every captured call is find_connections with exactly the keys {from, to}', shapeOk);
  check("G: every captured call's from/to values are canon snapshot Framework names", namesOk);
}

// ---------------------------------------------------------------------------
// Leg (h): negative controls, each caught by the SAME scanner legs (a)/(c)/(d)
// use, then deleted.
// ---------------------------------------------------------------------------
function legNegativeControls() {
  console.log('--- leg H: negative controls, each caught then removed ---');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-3551-egress-neg-'));
  try {
    const fetchFile = path.join(dir, 'scratch-fetch.cjs');
    fs.writeFileSync(fetchFile, "'use strict';\nfetch('https://example.invalid');\nmodule.exports = {};\n");
    const zodFile = path.join(dir, 'scratch-zod.cjs');
    fs.writeFileSync(zodFile, "'use strict';\nconst z = require('zod');\nmodule.exports = z;\n");
    const sqlFile = path.join(dir, 'scratch-sql.cjs');
    fs.writeFileSync(sqlFile, "'use strict';\nconst sql = 'INSERT INTO nodes (id) VALUES (1)';\nmodule.exports = sql;\n");

    const fetchLines = hygiene.nonCommentLines(fetchFile);
    check('H: the scratch fetch() file is caught by the SAME egress scanner leg A uses',
      fetchLines.some((l) => PART8_RE.test(l)));

    const zodLines = hygiene.nonCommentLines(zodFile);
    check('H: the scratch require(zod) file is caught by the SAME zod-at-edges scanner leg C uses',
      zodLines.some((l) => ZOD_RE.test(l)));

    const sqlLines = hygiene.nonCommentLines(sqlFile);
    check('H: the scratch INSERT INTO file is caught by the SAME Part 9 scanner leg D uses',
      sqlLines.some((l) => PART9_RE.test(l)));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    check('H: every scratch negative-control file is deleted', !fs.existsSync(dir));
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
(async () => {
  try {
    legEgress();
    legOneWire();
    legZodAtEdges();
    legPart9();
    await legClosedFiles();
    legArgv();
    await legTheoArgsCanonOnly();
    legNegativeControls();
  } finally {
    check('installNetGuard: zero fetch attempts', netGuard.attempts() === 0);
    netGuard.restore();
    console.log('scrubVendorKey found a pre-set TYPESAFE_API_KEY: ' + hadKey);
    process.exit(checker.summary());
  }
})();
