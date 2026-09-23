#!/usr/bin/env node
'use strict';
/**
 * tests/test-356-answer-key.cjs -- Phase 356 Plan 10 (R356-02, D-16).
 *
 * Two groups of legs:
 *
 * 1. Unit legs: scripts/build-command-irreversibility-ledger.cjs's
 *    loadInputs() refuses (INPUT_REFUSED) every malformed answer key built
 *    over SYNTHETIC temp files (missing/extra command, missing
 *    reviewed_by/reviewed_at, an invalid label_source, an empty reason, an
 *    unknown appeal_rulings command, an invalid ruling value), and loads a
 *    well-formed one cleanly. None of this depends on the real answer key.
 *
 * 2. Shipped legs: data/jev-labels/command-irreversibility.json's coverage,
 *    header, per-row shape, the pre-label seal, and the D-16 labeling
 *    order proven from git history.
 *
 * IMPORTANT SHAPE NOTE (read before editing): this plan's PLAN.md was
 * written against the original D-04/D-05 single-blind-sheet workflow
 * (scripts/irreversibility-answer-key.cjs's --merge output), which stamps
 * a `blind_sheet_ref`, a top-level `prelabels_sha256`, and a
 * `blind_vs_claude_disagreement` object. The REAL answer key that 356-08
 * shipped was built by the LATER D-20/D-21 workflow instead (a fresh
 * second blind labeler compared against Claude's sealed pre-labels, with
 * navigator arbitration on every disagreement plus a further round of
 * desk-reviewed boundary cases) -- see 356-CONTEXT.md D-20/D-21 and
 * 356-08-SUMMARY.md. That shipped object carries none of the D-04 merge
 * fields; its only two label_source values are `two-model-blind-agreement`
 * and `navigator-arbitrated` (never `navigator-blind` or
 * `claude-prelabel/navigator-confirmed`). The shipped-leg checks below are
 * written against the ACTUAL D-20/D-21 shape, not the stale D-04 wording:
 * the D-16 order proof walks every committed sheet named in the phase's
 * D-20/D-21 artifacts (356-BLIND-LABEL-SHEET.md,
 * 356-BLIND-LABEL-SHEET-REMAINDER.md, 356-D21-SHEET-A.md,
 * 356-D21-SHEET-B.md) via git ancestry instead of trusting a
 * `blind_sheet_ref` field that was never written, and the "seal" check
 * verifies the sha256 recorded in the D-04 blind sheet's own header
 * (the only sheet that carries a prelabels_sha256 line) rather than a
 * top-level key field.
 *
 * Test hygiene contract (every 356 test file): scrub TYPESAFE_API_KEY and
 * replace globalThis.fetch with a counting thrower before any other require
 * of repo code; assert NET_ATTEMPTS === 0 as the last check.
 *
 * House rule: hyphens only, no em-dashes.
 */

delete process.env.TYPESAFE_API_KEY;
let NET_ATTEMPTS = 0;
globalThis.fetch = function noNetwork356answerKey() {
  NET_ATTEMPTS += 1;
  throw new Error('no network in 356 tests');
};

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const BUILDER_PATH = path.join(REPO, 'scripts', 'build-command-irreversibility-ledger.cjs');
const REAL_REGISTRY_PATH = path.join(REPO, 'data', 'command-registry.json');
const SHIPPED_LABELS_PATH = path.join(REPO, 'data', 'jev-labels', 'command-irreversibility.json');
const SHIPPED_LEDGER_PATH = path.join(REPO, 'data', 'command-irreversibility-ledger.json');
const PHASE_DIR = path.join(REPO, '.planning', 'phases',
  '356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-');
const PRELABELS_PATH = path.join(PHASE_DIR, '356-CLAUDE-PRELABELS.json');
const BLIND_SHEET_PATH = path.join(PHASE_DIR, '356-BLIND-LABEL-SHEET.md');
const BLIND_SHEET_REMAINDER_PATH = path.join(PHASE_DIR, '356-BLIND-LABEL-SHEET-REMAINDER.md');
const D21_SHEET_A_PATH = path.join(PHASE_DIR, '356-D21-SHEET-A.md');
const D21_SHEET_B_PATH = path.join(PHASE_DIR, '356-D21-SHEET-B.md');
const RAW_SCORES_PATH = path.join(PHASE_DIR, '356-RAW-SCORES.json');
const NAVIGATOR_RULINGS_PATH = path.join(PHASE_DIR, '356-NAVIGATOR-RULINGS.json');

const b = require(BUILDER_PATH);
const answerKeyTool = require(path.join(REPO, 'scripts', 'irreversibility-answer-key.cjs'));
const { readRegistryRows, parseBlindSheet, LABEL_SOURCES } = answerKeyTool;

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

function checkThrows(label, fn, matcher) {
  try {
    fn();
    check(label, false);
  } catch (e) {
    check(label, typeof matcher === 'function' ? matcher(e) : (e && e.code === 'INPUT_REFUSED'));
  }
}

function sha256Hex(bufOrString) {
  return crypto.createHash('sha256').update(bufOrString).digest('hex');
}

console.log('test-356-answer-key');

// =============================================================================
// Group 1: unit legs. Every temp world here is SYNTHETIC, built over the
// REAL registry's command set, never over the real (or nonexistent) answer
// key. loadInputs's own shape validation is what is under test.
// =============================================================================
console.log('--- unit legs: loadInputs refusals over synthetic temp files ---');

const REGISTRY_ROWS = readRegistryRows(REAL_REGISTRY_PATH);
const REGISTRY_HASH = sha256Hex(fs.readFileSync(REAL_REGISTRY_PATH));

function makeUnitWorld() {
  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), '356-answer-key-unit-'));
  fs.mkdirSync(path.join(tmpRoot, 'data', 'jev-policies'), { recursive: true });
  const policyObj = {
    policy_id: 'test-command-irreversibility-answer-key',
    version: '1',
    instructions: 'SYNTHETIC test policy for tests/test-356-answer-key.cjs unit legs, describing a '
      + 'hypothetical local sandbox vs. an external service.',
    criteria: {
      true: 'the hypothetical action writes to an external service outside the sandbox',
      false: 'the hypothetical action stays inside the local sandbox',
    },
    boundary_cases: [
      'a hypothetical local sandbox write is reversible',
      'a hypothetical write to an external service is irreversible',
    ],
  };
  fs.writeFileSync(
    path.join(tmpRoot, 'data', 'jev-policies', 'command-irreversibility.json'),
    JSON.stringify(policyObj, null, 2) + '\n',
  );
  return tmpRoot;
}

function baseAnswerKeyObj() {
  return {
    schema: 'jev-answer-key/v1',
    labels_for: 'data/command-registry.json',
    registry_hash: REGISTRY_HASH,
    reviewed_by: 'navigator',
    reviewed_at: '2026-09-23',
    method: 'synthetic test fixture for tests/test-356-answer-key.cjs unit legs',
    rows: REGISTRY_ROWS.map((r) => ({
      command: r.command,
      irreversible: false,
      reason: 'synthetic unit-leg reason for ' + r.command,
      label_source: 'navigator-blind',
    })),
    appeal_rulings: [],
  };
}

function writeLabels(tmpRoot, obj) {
  const labelsPath = path.join(tmpRoot, 'labels-' + crypto.randomBytes(4).toString('hex') + '.json');
  fs.writeFileSync(labelsPath, JSON.stringify(obj, null, 2) + '\n');
  return labelsPath;
}

const UNIT_ROOT = makeUnitWorld();

// -- missing one command -------------------------------------------------
(function legMissingCommand() {
  const obj = baseAnswerKeyObj();
  const removedCommand = obj.rows[0].command;
  obj.rows = obj.rows.slice(1);
  const labelsPath = writeLabels(UNIT_ROOT, obj);
  checkThrows('missing command: INPUT_REFUSED naming it plus the new-command wording', () => {
    b.loadInputs({ registryPath: REAL_REGISTRY_PATH, labelsPath: labelsPath, root: UNIT_ROOT });
  }, (e) => e.code === 'INPUT_REFUSED' && e.message.indexOf(removedCommand) !== -1
    && e.message.indexOf('a new command needs a label') !== -1);
})();

// -- one extra command ----------------------------------------------------
(function legExtraCommand() {
  const obj = baseAnswerKeyObj();
  obj.rows.push({
    command: '/mos:zz-356-does-not-exist',
    irreversible: false,
    reason: 'a command not in the registry',
    label_source: 'navigator-blind',
  });
  const labelsPath = writeLabels(UNIT_ROOT, obj);
  checkThrows('extra command: INPUT_REFUSED naming it', () => {
    b.loadInputs({ registryPath: REAL_REGISTRY_PATH, labelsPath: labelsPath, root: UNIT_ROOT });
  }, (e) => e.code === 'INPUT_REFUSED' && e.message.indexOf('/mos:zz-356-does-not-exist') !== -1);
})();

// -- missing reviewed_by ----------------------------------------------------
(function legMissingReviewedBy() {
  const obj = baseAnswerKeyObj();
  delete obj.reviewed_by;
  const labelsPath = writeLabels(UNIT_ROOT, obj);
  checkThrows('missing reviewed_by: INPUT_REFUSED', () => {
    b.loadInputs({ registryPath: REAL_REGISTRY_PATH, labelsPath: labelsPath, root: UNIT_ROOT });
  }, (e) => e.code === 'INPUT_REFUSED' && /reviewed_by/.test(e.message));
})();

// -- missing reviewed_at ----------------------------------------------------
(function legMissingReviewedAt() {
  const obj = baseAnswerKeyObj();
  delete obj.reviewed_at;
  const labelsPath = writeLabels(UNIT_ROOT, obj);
  checkThrows('missing reviewed_at: INPUT_REFUSED', () => {
    b.loadInputs({ registryPath: REAL_REGISTRY_PATH, labelsPath: labelsPath, root: UNIT_ROOT });
  }, (e) => e.code === 'INPUT_REFUSED' && /reviewed_at/.test(e.message));
})();

// -- invalid label_source ('claude') -----------------------------------------
(function legInvalidLabelSource() {
  const obj = baseAnswerKeyObj();
  obj.rows[0].label_source = 'claude';
  const labelsPath = writeLabels(UNIT_ROOT, obj);
  checkThrows('label_source "claude": INPUT_REFUSED naming the row', () => {
    b.loadInputs({ registryPath: REAL_REGISTRY_PATH, labelsPath: labelsPath, root: UNIT_ROOT });
  }, (e) => e.code === 'INPUT_REFUSED' && e.message.indexOf(obj.rows[0].command) !== -1
    && e.message.indexOf('label_source') !== -1);
})();

// -- empty reason -------------------------------------------------------------
(function legEmptyReason() {
  const obj = baseAnswerKeyObj();
  obj.rows[0].reason = '   ';
  const labelsPath = writeLabels(UNIT_ROOT, obj);
  checkThrows('empty reason: INPUT_REFUSED naming the row', () => {
    b.loadInputs({ registryPath: REAL_REGISTRY_PATH, labelsPath: labelsPath, root: UNIT_ROOT });
  }, (e) => e.code === 'INPUT_REFUSED' && e.message.indexOf(obj.rows[0].command) !== -1
    && e.message.indexOf('reason') !== -1);
})();

// -- appeal_rulings entry for an unknown command -------------------------------
(function legUnknownAppealCommand() {
  const obj = baseAnswerKeyObj();
  obj.appeal_rulings = [{ command: '/mos:zz-356-unknown-appeal', ruling: 'accept' }];
  const labelsPath = writeLabels(UNIT_ROOT, obj);
  checkThrows('appeal_rulings unknown command: INPUT_REFUSED', () => {
    b.loadInputs({ registryPath: REAL_REGISTRY_PATH, labelsPath: labelsPath, root: UNIT_ROOT });
  }, (e) => e.code === 'INPUT_REFUSED' && e.message.indexOf('/mos:zz-356-unknown-appeal') !== -1);
})();

// -- appeal_rulings entry with ruling "maybe" ----------------------------------
(function legInvalidRulingValue() {
  const obj = baseAnswerKeyObj();
  obj.appeal_rulings = [{ command: obj.rows[0].command, ruling: 'maybe' }];
  const labelsPath = writeLabels(UNIT_ROOT, obj);
  checkThrows('appeal_rulings ruling "maybe": INPUT_REFUSED', () => {
    b.loadInputs({ registryPath: REAL_REGISTRY_PATH, labelsPath: labelsPath, root: UNIT_ROOT });
  }, (e) => e.code === 'INPUT_REFUSED' && e.message.indexOf('invalid ruling') !== -1);
})();

// -- well-formed key loads ------------------------------------------------------
(function legWellFormedLoads() {
  const obj = baseAnswerKeyObj();
  const labelsPath = writeLabels(UNIT_ROOT, obj);
  let loaded = null;
  let threw = false;
  try {
    loaded = b.loadInputs({ registryPath: REAL_REGISTRY_PATH, labelsPath: labelsPath, root: UNIT_ROOT });
  } catch (e) {
    threw = true;
  }
  check('well-formed key: loadInputs does not throw', !threw);
  check('well-formed key: labelsByCommand covers the full registry set',
    !!loaded && loaded.labelsByCommand.size === REGISTRY_ROWS.length);
})();

// =============================================================================
// Group 2: shipped legs, over the REAL answer key and the REAL D-20/D-21
// phase-dir artifacts.
// =============================================================================
console.log('--- shipped legs: data/jev-labels/command-irreversibility.json ---');

const SHIPPED_LABELS = JSON.parse(fs.readFileSync(SHIPPED_LABELS_PATH, 'utf8'));
const shippedRows = Array.isArray(SHIPPED_LABELS.rows) ? SHIPPED_LABELS.rows : [];
const registrySet = new Set(REGISTRY_ROWS.map((r) => r.command));

// -- set equality with the live registry --------------------------------------
(function legSetEquality() {
  const labelSet = new Set(shippedRows.map((r) => r.command));
  const missing = Array.from(registrySet).filter((c) => !labelSet.has(c)).sort();
  const extra = Array.from(labelSet).filter((c) => !registrySet.has(c)).sort();
  check('shipped: set equality with the live registry (missing: ' + (missing.join(', ') || 'none')
    + '; extra: ' + (extra.join(', ') || 'none') + ') -- a new command needs a label before the next rebuild',
    missing.length === 0 && extra.length === 0);
})();

// -- header -------------------------------------------------------------------
(function legHeader() {
  check('shipped header: schema === jev-answer-key/v1', SHIPPED_LABELS.schema === 'jev-answer-key/v1');
  check('shipped header: labels_for === data/command-registry.json',
    SHIPPED_LABELS.labels_for === 'data/command-registry.json');
  check('shipped header: registry_hash is 64-hex', /^[0-9a-f]{64}$/.test(SHIPPED_LABELS.registry_hash));
  check('shipped header: reviewed_by === navigator', SHIPPED_LABELS.reviewed_by === 'navigator');
  check('shipped header: reviewed_at is a YYYY-MM-DD date', /^\d{4}-\d{2}-\d{2}$/.test(SHIPPED_LABELS.reviewed_at));
  check('shipped header: method is a non-empty string',
    typeof SHIPPED_LABELS.method === 'string' && SHIPPED_LABELS.method.trim().length > 0);
  check('shipped header: appeal_rulings is an array', Array.isArray(SHIPPED_LABELS.appeal_rulings));
  // No blind_sheet_ref / top-level prelabels_sha256 / blind_vs_claude_disagreement
  // field: see the file header comment. The D-16 order and seal checks below
  // prove the same "blind before reveal" claim directly from git and file bytes.
})();

// -- rows: shape plus the D-20/D-21 label_source vocabulary --------------------
const D20_D21_SOURCES = new Set(LABEL_SOURCES.concat(['two-model-blind-agreement', 'navigator-arbitrated']));
(function legRowShape() {
  let allBool = true;
  let allReason = true;
  let allSource = true;
  let onlyD20D21Sources = true;
  const seenSources = new Set();
  for (const r of shippedRows) {
    if (typeof r.irreversible !== 'boolean') allBool = false;
    if (typeof r.reason !== 'string' || r.reason.trim().length === 0) allReason = false;
    if (!D20_D21_SOURCES.has(r.label_source)) allSource = false;
    seenSources.add(r.label_source);
    if (r.label_source !== 'two-model-blind-agreement' && r.label_source !== 'navigator-arbitrated') {
      onlyD20D21Sources = false;
    }
  }
  check('shipped rows: every irreversible is boolean', allBool);
  check('shipped rows: every reason is a non-empty string', allReason);
  check('shipped rows: every label_source is a recognized source', allSource);
  check('shipped rows: label_source vocabulary matches the D-20/D-21 shape '
    + '(two-model-blind-agreement, navigator-arbitrated only)', onlyD20D21Sources);
})();

// -- D-20/D-21 provenance cross-check: the two committed D21 blind sheets,
// the navigator rulings artifact, and the shipped answer key must all agree.
(function legD21Provenance() {
  if (!fs.existsSync(D21_SHEET_A_PATH) || !fs.existsSync(D21_SHEET_B_PATH) || !fs.existsSync(NAVIGATOR_RULINGS_PATH)) {
    console.log('ENV GAP: D-21 provenance artifacts (sheet A/B or navigator rulings) not present, skipping cross-check');
    return;
  }
  const sheetA = parseBlindSheet(fs.readFileSync(D21_SHEET_A_PATH, 'utf8'));
  const sheetB = parseBlindSheet(fs.readFileSync(D21_SHEET_B_PATH, 'utf8'));
  const aByCommand = new Map(sheetA.rows.map((r) => [r.command, r]));
  const bByCommand = new Map(sheetB.rows.map((r) => [r.command, r]));

  const rulingsDoc = JSON.parse(fs.readFileSync(NAVIGATOR_RULINGS_PATH, 'utf8'));
  const decidedRulings = Object.keys(rulingsDoc.rulings || {})
    .filter((k) => k !== 'policy-lock-v2' && rulingsDoc.rulings[k] && rulingsDoc.rulings[k].decided === true)
    .map((k) => rulingsDoc.rulings[k]);
  const rulingByCommand = new Map(decidedRulings.map((r) => [r.command, r]));
  const chatClarifications = rulingsDoc.chat_clarifications || {};

  const shippedByCommand = new Map(shippedRows.map((r) => [r.command, r]));

  let disagreementCount = 0;
  let disagreementsAllArbitrated = true;
  let agreementRowsMatch = true;
  let arbitratedRowsMatch = true;

  for (const command of registrySet) {
    const a = aByCommand.get(command);
    const bRow = bByCommand.get(command);
    const shipped = shippedByCommand.get(command);
    if (!a || !bRow || !shipped) continue;

    const agree = a.irreversible === bRow.irreversible;
    const isRulingCommand = rulingByCommand.has(command);

    if (!agree) {
      disagreementCount += 1;
      if (!isRulingCommand) disagreementsAllArbitrated = false;
    }

    if (agree && !isRulingCommand) {
      if (shipped.label_source !== 'two-model-blind-agreement') agreementRowsMatch = false;
      if (shipped.irreversible !== bRow.irreversible) agreementRowsMatch = false;
      if (shipped.reason !== bRow.reason) agreementRowsMatch = false;
    }

    if (isRulingCommand) {
      const ruling = rulingByCommand.get(command);
      const expectedReason = (command === '/mos:admin' && chatClarifications['/mos:admin'])
        ? chatClarifications['/mos:admin']
        : ruling.reason;
      if (shipped.label_source !== 'navigator-arbitrated') arbitratedRowsMatch = false;
      if (shipped.irreversible !== ruling.irreversible) arbitratedRowsMatch = false;
      if (shipped.reason !== expectedReason) arbitratedRowsMatch = false;
    }
  }

  check('D-21 provenance: at least one real A-vs-B disagreement was found', disagreementCount > 0);
  check('D-21 provenance: every A-vs-B disagreement has a navigator ruling (none leaked into agreement)',
    disagreementsAllArbitrated);
  check('D-21 provenance: every two-model-blind-agreement row matches sheet B exactly (source, label, reason)',
    agreementRowsMatch);
  check('D-21 provenance: every navigator-arbitrated row matches its ruling exactly '
    + '(reason from chat clarification for /mos:admin, verbatim from the ruling otherwise)',
    arbitratedRowsMatch);
  check('D-21 provenance: every decided ruling command is navigator-arbitrated in the shipped key',
    decidedRulings.every((r) => {
      const shipped = shippedByCommand.get(r.command);
      return !!shipped && shipped.label_source === 'navigator-arbitrated';
    }));
})();

// -- seal: sha256(356-CLAUDE-PRELABELS.json) matches the D-04 blind sheet's
// own recorded seal (the only sheet that carries a prelabels_sha256 line;
// see the file header comment for why there is no top-level key field).
(function legSeal() {
  if (!fs.existsSync(PRELABELS_PATH) || !fs.existsSync(BLIND_SHEET_PATH)) {
    console.log('ENV GAP: pre-label seal or D-04 blind sheet missing, skipping seal check');
    return;
  }
  const prelabelsHash = sha256Hex(fs.readFileSync(PRELABELS_PATH));
  const blindSheetText = fs.readFileSync(BLIND_SHEET_PATH, 'utf8');
  const m = blindSheetText.match(/^prelabels_sha256:\s*(\S+)/m);
  check('seal: sha256(356-CLAUDE-PRELABELS.json) matches the blind sheet header seal',
    !!m && m[1] === prelabelsHash);
})();

// =============================================================================
// D-16 git order: seal precedes every blind sheet's filled commit; every
// blind sheet's filled commit precedes the answer key's commit; when the
// shipped ledger exists, every blind sheet's commit time precedes the
// ledger's built_at (and 356-RAW-SCORES.json's scored_at, when that file
// exists in the phase dir).
// =============================================================================
console.log('--- D-16 labeling order (git history) ---');

function git(args) {
  return spawnSync('git', args, { cwd: REPO, encoding: 'utf8' });
}

function commitsTouching(absPath) {
  const rel = path.relative(REPO, absPath);
  const result = git(['log', '--follow', '--format=%H', '--reverse', '--', rel]);
  if (result.status !== 0) return [];
  return result.stdout.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
}

function isAncestor(ancestorSha, descendantSha) {
  return git(['merge-base', '--is-ancestor', ancestorSha, descendantSha]).status === 0;
}

function commitTime(sha) {
  const result = git(['log', '-1', '--format=%ct', sha]);
  return parseInt(result.stdout.trim(), 10);
}

const sealCommits = commitsTouching(PRELABELS_PATH);
const blindSheetFiles = [BLIND_SHEET_PATH, BLIND_SHEET_REMAINDER_PATH, D21_SHEET_A_PATH, D21_SHEET_B_PATH];
const blindSheetFilledShas = Array.from(new Set(
  blindSheetFiles.map((f) => {
    const commits = commitsTouching(f);
    return commits.length > 0 ? commits[commits.length - 1] : null;
  }).filter((sha) => !!sha),
));
const answerKeyCommits = commitsTouching(SHIPPED_LABELS_PATH);

const blindSheetsCommitted = blindSheetFiles.every((f) => commitsTouching(f).length > 0);

if (!blindSheetsCommitted) {
  console.log('ENV GAP: blind sheet not committed');
  console.log('\ntest-356-answer-key: ' + (FAIL === 0 ? 'PASS (unit legs only)' : 'FAIL')
    + ' (' + PASS + ' passed, ' + FAIL + ' failed)');
  process.exit(FAIL > 0 ? 1 : 77);
}

(function legD16Order() {
  check('D-16: the pre-label seal has exactly one commit', sealCommits.length === 1);
  check('D-16: the answer key has at least one commit', answerKeyCommits.length >= 1);
  const sealSha = sealCommits[0];
  const answerKeySha = answerKeyCommits[0];

  let sealPrecedesEverySheet = true;
  let everySheetPrecedesAnswerKey = true;
  for (const sheetSha of blindSheetFilledShas) {
    if (!isAncestor(sealSha, sheetSha) || commitTime(sealSha) >= commitTime(sheetSha)) {
      sealPrecedesEverySheet = false;
    }
    if (!isAncestor(sheetSha, answerKeySha) || commitTime(sheetSha) > commitTime(answerKeySha)) {
      everySheetPrecedesAnswerKey = false;
    }
  }
  check('D-16: the pre-label seal is an ancestor of, and precedes, every blind sheet\'s filled commit',
    sealPrecedesEverySheet);
  check('D-16: every blind sheet\'s filled commit is an ancestor of, and precedes, the answer key commit',
    everySheetPrecedesAnswerKey);

  if (fs.existsSync(SHIPPED_LEDGER_PATH)) {
    const ledger = JSON.parse(fs.readFileSync(SHIPPED_LEDGER_PATH, 'utf8'));
    const builtAtSeconds = Date.parse(ledger.built_at) / 1000;
    const latestSheetTime = Math.max.apply(null, blindSheetFilledShas.map(commitTime));
    check('D-16: every blind sheet commit precedes the shipped ledger\'s built_at',
      Number.isFinite(builtAtSeconds) && builtAtSeconds > latestSheetTime);
  } else {
    console.log('PENDING: shipped ledger not built yet, skipping the built_at leg of the D-16 order proof');
  }

  if (fs.existsSync(RAW_SCORES_PATH)) {
    const raw = JSON.parse(fs.readFileSync(RAW_SCORES_PATH, 'utf8'));
    const scoredAtSeconds = Date.parse(raw.scored_at) / 1000;
    const latestSheetTime = Math.max.apply(null, blindSheetFilledShas.map(commitTime));
    check('D-16: every blind sheet commit precedes 356-RAW-SCORES.json\'s scored_at',
      Number.isFinite(scoredAtSeconds) && scoredAtSeconds > latestSheetTime);
  } else {
    console.log('PENDING: 356-RAW-SCORES.json not present, skipping that leg of the D-16 order proof');
  }
})();

// =============================================================================
// Final: zero network egress.
// =============================================================================
console.log('--- final: NET_ATTEMPTS ---');
check('NET_ATTEMPTS === 0 (no in-process network egress attempted)', NET_ATTEMPTS === 0);

console.log('\ntest-356-answer-key: ' + (FAIL === 0 ? 'PASS' : 'FAIL') + ' (' + PASS + ' passed, ' + FAIL + ' failed)');
process.exit(FAIL > 0 ? 1 : 0);
