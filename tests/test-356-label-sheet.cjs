#!/usr/bin/env node
/**
 * Phase 356 (chain-executor irreversibility ledger) Plan 05 Task 2: proves
 * scripts/irreversibility-answer-key.cjs picks, renders, parses and merges
 * correctly, and refuses loudly (naming the rows) on any gap (R356-02).
 *
 * Test hygiene contract (every 356 test file, per the plan context block):
 * scrub TYPESAFE_API_KEY and replace globalThis.fetch with a counting
 * thrower before any other require of repo code, assert NET_ATTEMPTS === 0
 * as the last check.
 *
 * Sealing note (356-05 sealing rule): this suite never opens or parses
 * .planning/phases/356-.../356-CLAUDE-PRELABELS.json's rows. Every unit,
 * round-trip and CLI leg below uses synthetic pre-label fixtures built in
 * this file. The shipped legs that touch the real committed artifacts are
 * gated on the navigator's own reveal artifacts (the committed blind and
 * review sheets), never on the sealed file's row content, and print
 * PENDING until 356-06 lands those artifacts.
 *
 * House rule: hyphens only, no em-dashes.
 */

'use strict';

delete process.env.TYPESAFE_API_KEY;
let NET_ATTEMPTS = 0;
globalThis.fetch = function noNetwork356() {
  NET_ATTEMPTS += 1;
  throw new Error('no network in 356 tests');
};

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO = path.join(__dirname, '..');
const SCRIPT_PATH = path.join(REPO, 'scripts', 'irreversibility-answer-key.cjs');
const PRELOAD_PATH = path.join(REPO, 'tests', 'fixtures', '356-no-network-preload.cjs');

const answerKey = require(SCRIPT_PATH);
const {
  sha256Hex,
  readRegistryRows,
  pickBlindSubset,
  renderBlindSheet,
  parseBlindSheet,
  renderReviewSheet,
  parseReviewSheet,
  mergeAnswerKey,
  R1_DEFINITION,
  LABEL_SOURCES,
  DEFAULT_REGISTRY_PATH,
} = answerKey;

let PASS = 0;
let FAIL = 0;
function check(label, cond) {
  if (cond) { PASS += 1; console.log('PASS: ' + label); }
  else { FAIL += 1; console.log('FAIL: ' + label); }
}

function expectRefusal(label, fn, mustIncludeCommand) {
  let threw = false;
  let err = null;
  try { fn(); } catch (e) { threw = true; err = e; }
  check(label + ': throws', threw);
  check(label + ': code is ANSWER_KEY_REFUSED', !!err && err.code === 'ANSWER_KEY_REFUSED');
  if (mustIncludeCommand) {
    check(label + ': names ' + mustIncludeCommand, !!err && err.message.includes(mustIncludeCommand));
  }
}

// Fills the first blank trailing "| | |" for the given (already
// header-escaped) command, mimicking what a navigator does by hand.
function fillRow(md, commandEscaped, valueA, valueB) {
  const lines = md.split('\n');
  const idx = lines.findIndex((l) => l.includes('| ' + commandEscaped + ' |') && l.trim().endsWith('| | |'));
  if (idx === -1) throw new Error('fillRow: no unfilled row found for ' + commandEscaped);
  lines[idx] = lines[idx].replace(/\| \| \|$/, '| ' + valueA + ' | ' + valueB + ' |');
  return lines.join('\n');
}

console.log('=== test-356-label-sheet ===');
console.log('');

// ---------------------------------------------------------------------------
// Leg 1: pickBlindSubset -- each of the four rules fires alone, why lists
// every rule that fired, a fully-safe command with no signal is excluded,
// and the output is sorted by command.
// ---------------------------------------------------------------------------
(function legPickBlindSubset() {
  console.log('--- leg 1: pickBlindSubset ---');
  const HINTS = ['deploy'];
  const rows = [
    { command: '/mos:deploy-widget', teaching: 'ships a widget', jtbd_summary: 'ship widgets', autonomous_safe: true },
    { command: '/mos:risky-tool', teaching: 'does local things', jtbd_summary: 'local work', autonomous_safe: false },
    { command: '/mos:exporter', teaching: 'lets you export data to a partner', jtbd_summary: 'share results', autonomous_safe: true },
    { command: '/mos:quiet-flag', teaching: 'quietly flagged risky by claude', jtbd_summary: 'no verbs here', autonomous_safe: true },
    { command: '/mos:calm-tool', teaching: 'purely local, calm', jtbd_summary: 'no verbs, no risk', autonomous_safe: true },
    { command: '/mos:deploy-multi', teaching: 'multi-rule test', jtbd_summary: 'multi', autonomous_safe: false },
  ];
  const prelabelRows = [
    { command: '/mos:deploy-widget', irreversible: false, reason: 'keyword only' },
    { command: '/mos:risky-tool', irreversible: false, reason: 'not safe tagged' },
    { command: '/mos:exporter', irreversible: false, reason: 'verb only' },
    { command: '/mos:quiet-flag', irreversible: true, reason: 'claude flags it' },
    { command: '/mos:calm-tool', irreversible: false, reason: 'nothing fires' },
    { command: '/mos:deploy-multi', irreversible: false, reason: 'keyword and not-safe' },
  ];
  const subset = pickBlindSubset(rows, prelabelRows, HINTS);
  const byCommand = new Map(subset.map((s) => [s.command, s]));

  check('keyword rule alone includes /mos:deploy-widget', byCommand.has('/mos:deploy-widget'));
  check('keyword rule alone: why is exactly [keyword]', JSON.stringify(byCommand.get('/mos:deploy-widget').why) === JSON.stringify(['keyword']));

  check('not_autonomous_safe rule alone includes /mos:risky-tool', byCommand.has('/mos:risky-tool'));
  check('not_autonomous_safe rule alone: why is exactly [not_autonomous_safe]', JSON.stringify(byCommand.get('/mos:risky-tool').why) === JSON.stringify(['not_autonomous_safe']));

  check('external_verb rule alone includes /mos:exporter', byCommand.has('/mos:exporter'));
  check('external_verb rule alone: why is exactly [external_verb]', JSON.stringify(byCommand.get('/mos:exporter').why) === JSON.stringify(['external_verb']));

  check('claude_prelabel_true rule alone includes /mos:quiet-flag', byCommand.has('/mos:quiet-flag'));
  check('claude_prelabel_true rule alone: why is exactly [claude_prelabel_true]', JSON.stringify(byCommand.get('/mos:quiet-flag').why) === JSON.stringify(['claude_prelabel_true']));

  check('a safe-tagged command with no keyword, no verb and a false pre-label is excluded', !byCommand.has('/mos:calm-tool'));

  check('multi-rule command lists every rule that fired, in order', JSON.stringify(byCommand.get('/mos:deploy-multi').why) === JSON.stringify(['keyword', 'not_autonomous_safe']));

  const commands = subset.map((s) => s.command);
  const sorted = commands.slice().sort();
  check('pickBlindSubset output is sorted by command', JSON.stringify(commands) === JSON.stringify(sorted));
})();
console.log('');

// ---------------------------------------------------------------------------
// Leg 2: renderBlindSheet hygiene -- rubric text, seal line, one row per
// command, no autonomous_safe/boundary/why, escaped pipe+newline cells.
// ---------------------------------------------------------------------------
let renderedBlindMd = null;
(function legRenderBlindSheetHygiene() {
  console.log('--- leg 2: renderBlindSheet hygiene ---');
  const subsetRows = [
    { command: '/mos:pipe|cmd', teaching: 'has a | pipe and\na newline', jtbd_summary: 'jtbd text' },
    { command: '/mos:plain', teaching: 'plain teaching', jtbd_summary: 'plain jtbd' },
  ];
  const registryHash = 'a'.repeat(64);
  const prelabelsSha256 = 'b'.repeat(64);
  const md = renderBlindSheet(subsetRows, { registryHash, prelabelsSha256 });
  renderedBlindMd = md;

  check('contains R1_DEFINITION verbatim', md.includes(R1_DEFINITION));
  check('contains the prelabels_sha256 header line', md.includes('prelabels_sha256: ' + prelabelsSha256));
  check('contains the registry_hash header line', md.includes('registry_hash: ' + registryHash));
  check('one table row per subset command', (md.match(/^\| \d+ \|/gm) || []).length === subsetRows.length);
  check('never renders autonomous_safe', !/autonomous_safe/i.test(md));
  check('never renders the word boundary (case-insensitive)', !/boundary/i.test(md));
  check('never renders "why"', !/\bwhy\b/i.test(md));
  check('never renders a Claude label column', !/claude label/i.test(md));
  check('pipe-and-newline teaching cell is escaped and collapsed onto one line', md.includes('has a \\| pipe and a newline'));
  check('command containing a pipe is escaped in its own cell', md.includes('/mos:pipe\\|cmd'));
})();
console.log('');

// ---------------------------------------------------------------------------
// Leg 3: round trip -- fill a rendered sheet (mixed y/Yes/n/NO), parse it
// back; a blank cell parses as null.
// ---------------------------------------------------------------------------
(function legRoundTrip() {
  console.log('--- leg 3: blind sheet fill + parse round trip ---');

  const unfilled = parseBlindSheet(renderedBlindMd);
  check('unfilled blind sheet: irreversible parses as null for a blank cell', unfilled.rows.every((r) => r.irreversible === null));
  check('unfilled blind sheet: reason parses as empty string for a blank cell', unfilled.rows.every((r) => r.reason === ''));

  let filled = renderedBlindMd;
  filled = fillRow(filled, '/mos:pipe\\|cmd', 'Yes', 'reason one');
  filled = fillRow(filled, '/mos:plain', 'NO', 'reason two');
  const parsed = parseBlindSheet(filled);
  const byCommand = new Map(parsed.rows.map((r) => [r.command, r]));

  check('round trip: "Yes" parses to irreversible true', byCommand.get('/mos:pipe|cmd').irreversible === true);
  check('round trip: reason preserved for the Yes row', byCommand.get('/mos:pipe|cmd').reason === 'reason one');
  check('round trip: "NO" parses to irreversible false', byCommand.get('/mos:plain').irreversible === false);
  check('round trip: reason preserved for the NO row', byCommand.get('/mos:plain').reason === 'reason two');
  check('round trip: pipe-escaped command unescapes back to a literal pipe', byCommand.has('/mos:pipe|cmd'));
  check('round trip: meta seal carried through', parsed.meta.prelabels_sha256 === 'b'.repeat(64));
})();
console.log('');

// ---------------------------------------------------------------------------
// Leg 4: review sheet -- renders only the remainder, shows Claude's label
// as y/n; parses ok/y/n and null rulings.
// ---------------------------------------------------------------------------
(function legReviewSheet() {
  console.log('--- leg 4: renderReviewSheet + parseReviewSheet ---');
  const remainderRows = [
    { command: '/mos:remainder-a', teaching: 'teach A', jtbd_summary: 'jtbd A' },
    { command: '/mos:remainder-b', teaching: 'teach B', jtbd_summary: 'jtbd B' },
  ];
  const prelabelMap = new Map([
    ['/mos:remainder-a', { irreversible: true, reason: 'claude says yes' }],
    ['/mos:remainder-b', { irreversible: false, reason: 'claude says no' }],
  ]);
  const opts = { registryHash: 'c'.repeat(64), prelabelsSha256: 'd'.repeat(64), blindSheetSha256: 'e'.repeat(64) };
  const md = renderReviewSheet(remainderRows, prelabelMap, opts);

  check('review sheet includes only the remainder rows', (md.match(/^\| \d+ \|/gm) || []).length === remainderRows.length);
  check('review sheet shows claude y label for an irreversible pre-label', md.includes('| /mos:remainder-a | teach A | jtbd A | y | claude says yes | | |'));
  check('review sheet shows claude n label for a reversible pre-label', md.includes('| /mos:remainder-b | teach B | jtbd B | n | claude says no | | |'));
  check('review sheet header carries all three hashes', md.includes('registry_hash: ' + opts.registryHash) && md.includes('prelabels_sha256: ' + opts.prelabelsSha256) && md.includes('blind_sheet_sha256: ' + opts.blindSheetSha256));

  const unfilledParsed = parseReviewSheet(md);
  check('unfilled review row: ruling parses as null', unfilledParsed.rows.every((r) => r.ruling === null));

  let filled = md;
  filled = fillRow(filled, '/mos:remainder-a', 'ok', '');
  filled = fillRow(filled, '/mos:remainder-b', 'y', 'navigator disagrees');
  const parsed = parseReviewSheet(filled);
  const byCommand = new Map(parsed.rows.map((r) => [r.command, r]));

  check('parseReviewSheet reads "ok" ruling', byCommand.get('/mos:remainder-a').ruling === 'ok');
  check('parseReviewSheet reads claude_irreversible for remainder-a', byCommand.get('/mos:remainder-a').claude_irreversible === true);
  check('parseReviewSheet reads "y" ruling', byCommand.get('/mos:remainder-b').ruling === 'y');
  check('parseReviewSheet reads the navigator reason for remainder-b', byCommand.get('/mos:remainder-b').navigator_reason === 'navigator disagrees');
})();
console.log('');

// ---------------------------------------------------------------------------
// Leg 5: mergeAnswerKey happy path -- label_source assignment for blind,
// confirmed (ok), confirmed (same letter), corrected (different letter);
// schema shape and row sort.
// ---------------------------------------------------------------------------
function baselineMergeScenario() {
  const registryRows = [
    { command: '/mos:blind-one', teaching: 't1', jtbd_summary: 'j1', autonomous_safe: false },
    { command: '/mos:blind-two', teaching: 't2', jtbd_summary: 'j2', autonomous_safe: false },
    { command: '/mos:review-ok', teaching: 't3', jtbd_summary: 'j3', autonomous_safe: true },
    { command: '/mos:review-same', teaching: 't4', jtbd_summary: 'j4', autonomous_safe: true },
    { command: '/mos:review-diff', teaching: 't5', jtbd_summary: 'j5', autonomous_safe: true },
  ];
  const prelabels = {
    rows: [
      { command: '/mos:blind-one', irreversible: true, reason: 'claude yes' },
      { command: '/mos:blind-two', irreversible: false, reason: 'claude no' },
      { command: '/mos:review-ok', irreversible: true, reason: 'claude reason ok' },
      { command: '/mos:review-same', irreversible: false, reason: 'claude reason same' },
      { command: '/mos:review-diff', irreversible: false, reason: 'claude reason diff' },
    ],
  };
  const blind = {
    meta: { prelabels_sha256: 'f'.repeat(64) },
    rows: [
      { command: '/mos:blind-one', irreversible: true, reason: 'nav reason one' },
      { command: '/mos:blind-two', irreversible: true, reason: 'nav reason two' },
    ],
  };
  const review = {
    meta: {},
    rows: [
      { command: '/mos:review-ok', claude_irreversible: true, claude_reason: 'claude reason ok', ruling: 'ok', navigator_reason: '' },
      { command: '/mos:review-same', claude_irreversible: false, claude_reason: 'claude reason same', ruling: 'n', navigator_reason: '' },
      { command: '/mos:review-diff', claude_irreversible: false, claude_reason: 'claude reason diff', ruling: 'y', navigator_reason: 'i disagree with claude here' },
    ],
  };
  return {
    registryRows: JSON.parse(JSON.stringify(registryRows)),
    registryHash: 'x'.repeat(64),
    blind: JSON.parse(JSON.stringify(blind)),
    prelabels: JSON.parse(JSON.stringify(prelabels)),
    review: JSON.parse(JSON.stringify(review)),
    prelabelsSha256: 'f'.repeat(64),
    reviewedAt: '2026-09-23',
    blindSheetRef: '356-BLIND-LABEL-SHEET.md',
  };
}

(function legMergeHappyPath() {
  console.log('--- leg 5: mergeAnswerKey happy path ---');
  const scenario = baselineMergeScenario();
  const ak = mergeAnswerKey(scenario);
  const byCommand = new Map(ak.rows.map((r) => [r.command, r]));

  check('schema is jev-answer-key/v1', ak.schema === 'jev-answer-key/v1');
  check('reviewed_by is the role handle navigator', ak.reviewed_by === 'navigator');
  check('appeal_rulings is an empty array', Array.isArray(ak.appeal_rulings) && ak.appeal_rulings.length === 0);
  check('rows sorted by command', JSON.stringify(ak.rows.map((r) => r.command)) === JSON.stringify(ak.rows.map((r) => r.command).slice().sort()));

  check('blind row label_source is navigator-blind', byCommand.get('/mos:blind-one').label_source === 'navigator-blind' && byCommand.get('/mos:blind-two').label_source === 'navigator-blind');
  check('review "ok" ruling label_source is claude-prelabel/navigator-confirmed', byCommand.get('/mos:review-ok').label_source === 'claude-prelabel/navigator-confirmed');
  check('review "ok" ruling keeps claude\'s label and reason', byCommand.get('/mos:review-ok').irreversible === true && byCommand.get('/mos:review-ok').reason === 'claude reason ok');
  check('review ruling matching claude\'s letter is confirmed, not corrected', byCommand.get('/mos:review-same').label_source === 'claude-prelabel/navigator-confirmed' && byCommand.get('/mos:review-same').irreversible === false);
  check('review ruling differing from claude\'s letter is navigator-corrected', byCommand.get('/mos:review-diff').label_source === 'navigator-corrected' && byCommand.get('/mos:review-diff').irreversible === true);
  check('a correction keeps the navigator\'s own reason', byCommand.get('/mos:review-diff').reason === 'i disagree with claude here');

  check('every label_source value is one of LABEL_SOURCES', ak.rows.every((r) => LABEL_SOURCES.includes(r.label_source)));

  const d = ak.blind_vs_claude_disagreement;
  check('blind_vs_claude_disagreement compared counts only blind rows', d.compared === 2);
  check('blind_vs_claude_disagreement disagreed counts the one blind disagreement', d.disagreed === 1 && JSON.stringify(d.commands) === JSON.stringify(['/mos:blind-two']));
  check('blind_vs_claude_disagreement rate is disagreed/compared', d.rate === 0.5);
})();
console.log('');

// ---------------------------------------------------------------------------
// Leg 6: disagreement math on a 5-row blind subset -- 2 of 5 disagreeing
// gives rate 0.4 and names both slugs (the plan's own worked example).
// ---------------------------------------------------------------------------
(function legDisagreementRate() {
  console.log('--- leg 6: blind-vs-claude disagreement rate over 5 blind rows ---');
  const registryRows = ['/mos:d1', '/mos:d2', '/mos:d3', '/mos:d4', '/mos:d5'].map((c, i) => ({
    command: c, teaching: 'teach ' + i, jtbd_summary: 'jtbd ' + i, autonomous_safe: false,
  }));
  const prelabels = {
    rows: [
      { command: '/mos:d1', irreversible: true, reason: 'claude d1' },
      { command: '/mos:d2', irreversible: false, reason: 'claude d2' },
      { command: '/mos:d3', irreversible: true, reason: 'claude d3' },
      { command: '/mos:d4', irreversible: false, reason: 'claude d4' },
      { command: '/mos:d5', irreversible: true, reason: 'claude d5' },
    ],
  };
  const blind = {
    meta: { prelabels_sha256: 'g'.repeat(64) },
    rows: [
      { command: '/mos:d1', irreversible: true, reason: 'nav d1' },
      { command: '/mos:d2', irreversible: true, reason: 'nav d2' },
      { command: '/mos:d3', irreversible: true, reason: 'nav d3' },
      { command: '/mos:d4', irreversible: true, reason: 'nav d4' },
      { command: '/mos:d5', irreversible: true, reason: 'nav d5' },
    ],
  };
  const review = { meta: {}, rows: [] };
  const ak = mergeAnswerKey({
    registryRows, registryHash: 'z'.repeat(64), blind, prelabels, review,
    prelabelsSha256: 'g'.repeat(64), reviewedAt: '2026-09-23', blindSheetRef: 'ref.md',
  });
  const d = ak.blind_vs_claude_disagreement;
  check('5-row disagreement: compared is 5', d.compared === 5);
  check('5-row disagreement: disagreed is 2', d.disagreed === 2);
  check('5-row disagreement: rate is 0.4', d.rate === 0.4);
  check('5-row disagreement: names the two disagreeing slugs, sorted', JSON.stringify(d.commands) === JSON.stringify(['/mos:d2', '/mos:d4']));
})();
console.log('');

// ---------------------------------------------------------------------------
// Leg 7: every ANSWER_KEY_REFUSED case throws with code and names the row.
// ---------------------------------------------------------------------------
(function legRefusals() {
  console.log('--- leg 7: ANSWER_KEY_REFUSED refusal cases ---');

  expectRefusal('null blind row', () => {
    const s = baselineMergeScenario();
    s.blind.rows[0].irreversible = null;
    mergeAnswerKey(s);
  }, '/mos:blind-one');

  expectRefusal('empty blind reason', () => {
    const s = baselineMergeScenario();
    s.blind.rows[1].reason = '';
    mergeAnswerKey(s);
  }, '/mos:blind-two');

  expectRefusal('null review ruling', () => {
    const s = baselineMergeScenario();
    s.review.rows[0].ruling = null;
    mergeAnswerKey(s);
  }, '/mos:review-ok');

  expectRefusal('overlap between blind and review command sets', () => {
    const s = baselineMergeScenario();
    s.review.rows.push({ command: '/mos:blind-one', claude_irreversible: true, claude_reason: 'x', ruling: 'ok', navigator_reason: '' });
    mergeAnswerKey(s);
  }, '/mos:blind-one');

  expectRefusal('missing registry command (dropped from review)', () => {
    const s = baselineMergeScenario();
    s.review.rows.pop(); // drops /mos:review-diff
    mergeAnswerKey(s);
  }, '/mos:review-diff');

  expectRefusal('extra command not in the registry', () => {
    const s = baselineMergeScenario();
    s.review.rows.push({ command: '/mos:not-in-registry', claude_irreversible: false, claude_reason: 'x', ruling: 'ok', navigator_reason: '' });
    mergeAnswerKey(s);
  }, '/mos:not-in-registry');

  expectRefusal('pre-label seal mismatch', () => {
    const s = baselineMergeScenario();
    s.prelabelsSha256 = 'deadbeef'.repeat(8);
    mergeAnswerKey(s);
  });

  expectRefusal('correction without a navigator reason', () => {
    const s = baselineMergeScenario();
    s.review.rows[2].navigator_reason = '';
    mergeAnswerKey(s);
  }, '/mos:review-diff');
})();
console.log('');

// ---------------------------------------------------------------------------
// Leg 8: CLI -- spawn the three modes against a small synthetic registry;
// refused inputs exit 2, successful runs exit 0 and print no label.
// ---------------------------------------------------------------------------
(function legCli() {
  console.log('--- leg 8: CLI (--label-sheet, --review-sheet, --merge) ---');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), '356-label-sheet-cli-'));
  const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), '356-label-sheet-home-'));

  function childEnv() {
    const env = Object.assign({}, process.env);
    delete env.TYPESAFE_API_KEY;
    env.HOME = tmpHome;
    if (fs.existsSync(PRELOAD_PATH)) {
      env.NODE_OPTIONS = ((env.NODE_OPTIONS || '') + ' --require ' + PRELOAD_PATH).trim();
    }
    return env;
  }

  function run(args) {
    const res = spawnSync(process.execPath, [SCRIPT_PATH].concat(args), { env: childEnv(), encoding: 'utf8' });
    if (res.stderr && res.stderr.includes('NETWORK_ATTEMPT_356')) {
      check('CLI leg (' + args.join(' ') + '): no network attempt', false);
    }
    return res;
  }

  const registryPath = path.join(tmpDir, 'registry.json');
  const prelabelsPath = path.join(tmpDir, 'prelabels.json');
  const blindPath = path.join(tmpDir, 'blind.md');
  const reviewPath = path.join(tmpDir, 'review.md');
  const outPath = path.join(tmpDir, 'answer-key.json');

  const registry = {
    commands: [
      { command: '/mos:cli-deploy', teaching: 'deploys stuff externally', jtbd_summary: 'ship', autonomous_safe: false },
      { command: '/mos:cli-safe', teaching: 'totally local', jtbd_summary: 'local work', autonomous_safe: true },
      { command: '/mos:cli-other', teaching: 'also local safe stuff', jtbd_summary: 'more local', autonomous_safe: true },
    ],
  };
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));

  const prelabels = {
    schema: 'claude-prelabels/v1',
    rows: [
      { command: '/mos:cli-deploy', irreversible: true, reason: 'deploys' },
      { command: '/mos:cli-safe', irreversible: false, reason: 'local' },
      { command: '/mos:cli-other', irreversible: false, reason: 'local' },
    ],
  };
  fs.writeFileSync(prelabelsPath, JSON.stringify(prelabels, null, 2));
  const prelabelsBytesSha = sha256Hex(fs.readFileSync(prelabelsPath));

  // --label-sheet: /mos:cli-deploy is the only row matching D-04 (keyword
  // "deploy" in its slug); the other two are safe-tagged with no verb and
  // a false pre-label.
  const rLabel = run(['--label-sheet', blindPath, '--prelabels', prelabelsPath, '--registry', registryPath]);
  check('CLI --label-sheet exits 0', rLabel.status === 0);
  check('CLI --label-sheet prints a row count, no label content', /^label-sheet: wrote 1 rows to /.test(rLabel.stdout.trim()));
  const blindMdOnDisk = fs.readFileSync(blindPath, 'utf8');
  check('CLI --label-sheet wrote the D-04 seal', blindMdOnDisk.includes('prelabels_sha256: ' + prelabelsBytesSha));
  check('CLI --label-sheet output has no autonomous_safe token', !/autonomous_safe/i.test(blindMdOnDisk));

  let filledBlind = blindMdOnDisk;
  filledBlind = fillRow(filledBlind, '/mos:cli-deploy', 'y', 'external deploy effect');
  fs.writeFileSync(blindPath, filledBlind);

  // --review-sheet: remainder is cli-safe and cli-other.
  const rReview = run(['--review-sheet', reviewPath, '--blind', blindPath, '--prelabels', prelabelsPath, '--registry', registryPath]);
  check('CLI --review-sheet exits 0', rReview.status === 0);
  check('CLI --review-sheet prints a row count', /^review-sheet: wrote 2 rows to /.test(rReview.stdout.trim()));

  let filledReview = fs.readFileSync(reviewPath, 'utf8');
  filledReview = fillRow(filledReview, '/mos:cli-safe', 'ok', '');
  filledReview = fillRow(filledReview, '/mos:cli-other', 'n', '');
  fs.writeFileSync(reviewPath, filledReview);

  // --merge: 3 total rows, blind subset of 1, zero disagreement (blind row
  // agreed with claude's own pre-label for that command).
  const rMerge = run(['--merge', '--blind', blindPath, '--review', reviewPath, '--prelabels', prelabelsPath, '--out', outPath, '--blind-sheet-ref', 'test-ref.md', '--reviewed-at', '2026-09-23', '--registry', registryPath]);
  check('CLI --merge exits 0', rMerge.status === 0);
  check('CLI --merge prints the summary line', /^merge: 3 rows, blind 1, disagreement 0\/1$/.test(rMerge.stdout.trim()));
  const ak = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  check('CLI --merge wrote a well-formed answer key', ak.schema === 'jev-answer-key/v1' && ak.rows.length === 3 && ak.reviewed_by === 'navigator');

  // Refusal: missing prelabels file (the plan's own verify command).
  const rMissingPrelabels = run(['--label-sheet', path.join(tmpDir, 'x.md'), '--prelabels', path.join(tmpDir, 'does-not-exist.json')]);
  check('CLI refuses a missing prelabels file with exit 2', rMissingPrelabels.status === 2);

  // Refusal: review-sheet against the UNFILLED blind sheet.
  const rLabelAgain = run(['--label-sheet', path.join(tmpDir, 'blind2.md'), '--prelabels', prelabelsPath, '--registry', registryPath]);
  check('CLI regenerates an unfilled blind sheet for the next refusal case', rLabelAgain.status === 0);
  const rUnfilled = run(['--review-sheet', path.join(tmpDir, 'review2.md'), '--blind', path.join(tmpDir, 'blind2.md'), '--prelabels', prelabelsPath, '--registry', registryPath]);
  check('CLI refuses an unfilled blind sheet with exit 2', rUnfilled.status === 2);

  // Refusal: seal mismatch (tamper with the header line after filling).
  let tamperedBlind = filledBlind.replace(/prelabels_sha256: [0-9a-f]{64}/, 'prelabels_sha256: ' + '0'.repeat(64));
  const tamperedPath = path.join(tmpDir, 'blind-tampered.md');
  fs.writeFileSync(tamperedPath, tamperedBlind);
  const rSealMismatch = run(['--review-sheet', path.join(tmpDir, 'review3.md'), '--blind', tamperedPath, '--prelabels', prelabelsPath, '--registry', registryPath]);
  check('CLI refuses a pre-label seal mismatch with exit 2', rSealMismatch.status === 2);

  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_e) { /* tolerant */ }
  try { fs.rmSync(tmpHome, { recursive: true, force: true }); } catch (_e) { /* tolerant */ }
})();
console.log('');

// ---------------------------------------------------------------------------
// Shipped legs: gated on the navigator's own committed reveal artifacts,
// never on the sealed pre-label file's row content (356-05 sealing rule).
// ---------------------------------------------------------------------------
const PHASE_DIR = path.join(REPO, '.planning', 'phases', '356-chain-executor-material-step-ledger-jev-noul-seat-scored-at-');
const BLIND_SHEET_PATH = path.join(PHASE_DIR, '356-BLIND-LABEL-SHEET.md');
const REVIEW_SHEET_PATH = path.join(PHASE_DIR, '356-PRELABEL-REVIEW-SHEET.md');
const PRELABELS_PATH = path.join(PHASE_DIR, '356-CLAUDE-PRELABELS.json');

(function legShippedSubsetCoverage() {
  console.log('--- shipped leg: picked subset covers every non-autonomous_safe command plus /mos:publish ---');
  // Deliberately deferred past 356-05: computing this leg requires reading
  // the sealed pre-label rows via pickBlindSubset, which this suite does
  // not do under any gate (356-05 sealing rule: synthetic fixtures only).
  // 356-06 lands this leg once the blind sheet reveal has legitimately
  // happened.
  console.log('PENDING: deferred to 356-06 by the 356-05 sealing rule (no sealed-row reads in this suite)');
  check('shipped leg: pending by design (sealing rule), counted as passing', true);
})();
console.log('');

(function legShippedBlindSheetShape() {
  console.log('--- shipped leg: committed blind sheet keeps its seal and stays clean ---');
  if (!fs.existsSync(BLIND_SHEET_PATH)) {
    console.log('PENDING: ' + path.relative(REPO, BLIND_SHEET_PATH) + ' not committed yet (356-06)');
    check('shipped leg: pending (blind sheet not landed), counted as passing', true);
    return;
  }
  const md = fs.readFileSync(BLIND_SHEET_PATH, 'utf8');
  const parsed = parseBlindSheet(md);
  const prelabelsBytes = fs.readFileSync(PRELABELS_PATH);
  check('shipped leg: blind sheet seal matches the committed pre-label file bytes', parsed.meta.prelabels_sha256 === sha256Hex(prelabelsBytes));
  check('shipped leg: blind sheet has no autonomous_safe token', !/autonomous_safe/i.test(md));
  // Narrowed 2026-09-23 (navigator-approved in session): the real registry's own
  // Canon Part 8 wording ("Part-8 boundary gate") is command text, not policy text.
  // The leak this guards against is the policy's boundary_cases field in any spelling.
  check('shipped leg: blind sheet has no boundary-case token (case-insensitive)', !/boundary[\s_-]*cases?/i.test(md));
})();
console.log('');

(function legShippedReviewSheetShape() {
  console.log('--- shipped leg: committed review sheet covers registry minus the blind subset ---');
  if (!fs.existsSync(REVIEW_SHEET_PATH) || !fs.existsSync(BLIND_SHEET_PATH)) {
    console.log('PENDING: ' + path.relative(REPO, REVIEW_SHEET_PATH) + ' not committed yet (356-06)');
    check('shipped leg: pending (review sheet not landed), counted as passing', true);
    return;
  }
  const reviewMd = fs.readFileSync(REVIEW_SHEET_PATH, 'utf8');
  const blindMd = fs.readFileSync(BLIND_SHEET_PATH, 'utf8');
  const parsedReview = parseReviewSheet(reviewMd);
  check('shipped leg: review sheet blind_sheet_sha256 matches the committed blind sheet', parsedReview.meta.blind_sheet_sha256 === sha256Hex(blindMd));
  const registryRows = readRegistryRows(DEFAULT_REGISTRY_PATH);
  const parsedBlind = parseBlindSheet(blindMd);
  const blindCommands = new Set(parsedBlind.rows.map((r) => r.command));
  const expectedRemainder = registryRows.filter((r) => !blindCommands.has(r.command)).map((r) => r.command).sort();
  const actualRemainder = parsedReview.rows.map((r) => r.command).sort();
  check('shipped leg: review sheet rows equal registry minus the blind subset', JSON.stringify(expectedRemainder) === JSON.stringify(actualRemainder));
})();
console.log('');

check('NET_ATTEMPTS === 0 (no network egress attempted by this test)', NET_ATTEMPTS === 0);

console.log('');
if (FAIL === 0) {
  console.log('test-356-label-sheet: PASS (' + PASS + ' checks)');
} else {
  console.log('test-356-label-sheet: FAIL (' + FAIL + ' of ' + (PASS + FAIL) + ' checks failed)');
}
process.exit(FAIL === 0 ? 0 : 1);
