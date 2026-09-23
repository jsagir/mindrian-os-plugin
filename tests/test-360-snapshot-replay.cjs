#!/usr/bin/env node
'use strict';
/*
 * Phase 360 Plan 03 -- local-only counterfactual snapshot replay (SPEC R7, R10).
 *
 * Attributes every intent-classifier UserPromptSubmit run in the local R-D snapshot
 * (~/.cache/mindrian-dev/357-raw/, sha256sum -c'd first) to the record that triggered it,
 * by walking parentUuid over every attachment that is not a queued_command until a `user`
 * record or a queued_command attachment is reached (RESEARCH Finding 3, Pattern 4). Ground
 * truth uses NO harness lead literal: origin.kind in {peer, task-notification}, or
 * promptSource === 'system', or a queued attachment's commandMode === 'task-notification'
 * counts as harness; origin.kind === 'human' counts as human; everything else is 'other'.
 *
 * Layer h applies the REAL lib/hmi/turn-text.cjs classifyUserPromptText verdict (RED until
 * 360-06). Layer c additionally applies the REAL lib/core/room-bind-picker-policy.cjs
 * cwdRoomsHomeVerdict cwd rule (RED until 360-07), using the UserPromptSubmit attachment's
 * OWN cwd field (never the trigger's).
 *
 * This file prints counts, booleans and cwd classes only -- never a prompt body, a session
 * id, a cwd path, or a peer name. The one dev-repo session this phase's evidence names is
 * identified only by comparing sha256(session-file-stem) against a frozen constant
 * (ANCHOR_SESSION_SHA256); the id itself never appears in this file's source.
 *
 * Exit codes: 0 = every assertion held; 1 = a check failed (message printed); 77 = the
 * local snapshot is absent, so this leg SKIPs (never a failure -- R-D is local-only
 * evidence, never committed).
 *
 * Run: node tests/test-360-snapshot-replay.cjs [--layer h|c|all]
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const TURN_TEXT_PATH = path.join(REPO_ROOT, 'lib', 'hmi', 'turn-text.cjs');
const PICKER_POLICY_PATH = path.join(REPO_ROOT, 'lib', 'core', 'room-bind-picker-policy.cjs');

// The unbound-header metric (SPEC R7): this is the emitted gate header, not a harness lead
// literal, so it carries none of R4's banned tag strings.
const UNBOUND_HEADER = '-- mindrianOS -- bind session -- select rooms --';

// SPEC baseline (Background table / Finding 3): pre-verdict unbound-header fires.
const BASELINE_PRE = Object.freeze({ harness: 33, human: 2, other: 0 });

// sha256(session-file-stem) for the one session this phase's evidence table calls
// "this dev session" (the anchor false block's minter, SPEC R10 / N-1). Only the HASH is
// written here; the replay hashes each file's own stem at run time to set the anchor flag.
// Never the id itself, and never even its 8-char prefix.
const ANCHOR_SESSION_SHA256 = 'a48bd1d7f2d7c3cdbcbb88e120440ddce843c7c912a7bbb819a592441dcaca04';

// ---------------------------------------------------------------------------
// CLI: --layer h|c|all (default all)
// ---------------------------------------------------------------------------
const LAYER = (function () {
  const idx = process.argv.indexOf('--layer');
  const v = (idx !== -1 && process.argv[idx + 1]) ? process.argv[idx + 1] : 'all';
  return (v === 'h' || v === 'c' || v === 'all') ? v : 'all';
})();
const RUN_H = LAYER === 'h' || LAYER === 'all';
const RUN_C = LAYER === 'c' || LAYER === 'all';

// ---------------------------------------------------------------------------
// Snapshot dir / rooms home (env override, else the real home -- R-D).
// ---------------------------------------------------------------------------
const SNAPSHOT_DIR = process.env.MOS360_SNAPSHOT_DIR
  || path.join(os.homedir(), '.cache', 'mindrian-dev', '357-raw');
const ROOMS_HOME = process.env.MOS360_REPLAY_ROOMS_HOME
  || path.join(os.homedir(), 'MindrianRooms');

if (!fs.existsSync(SNAPSHOT_DIR)) {
  console.log('SKIP: ' + SNAPSHOT_DIR + ' not present, this leg reads local-only evidence (R-D) '
    + 'and skips when absent (never a failure)');
  process.exit(77);
}

const sha = spawnSync('sha256sum', ['-c', '--quiet', 'SHA256SUMS'], { cwd: SNAPSHOT_DIR, encoding: 'utf8' });
if (sha.status !== 0) {
  console.log('snapshot integrity failed: sha256sum -c SHA256SUMS did not pass in ' + SNAPSHOT_DIR);
  if (sha.stdout) console.log(sha.stdout.trim());
  if (sha.stderr) console.log(sha.stderr.trim());
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Attribution (Pattern 4): parentUuid walk over non-queued_command attachments.
// ---------------------------------------------------------------------------
function loadRecords(jsonlPath) {
  const raw = fs.readFileSync(jsonlPath, 'utf8');
  const lines = raw.split('\n');
  const byUuid = new Map();
  const order = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch (_e) {
      continue;
    }
    if (!obj || typeof obj !== 'object') continue;
    order.push(obj);
    if (typeof obj.uuid === 'string') byUuid.set(obj.uuid, obj);
  }
  return { byUuid: byUuid, order: order };
}

function isIntentClassifierUPS(obj) {
  if (!obj || obj.type !== 'attachment') return false;
  const att = obj.attachment || {};
  if (att.hookEvent !== 'UserPromptSubmit') return false;
  const cmd = typeof att.command === 'string' ? att.command : '';
  return cmd.indexOf('intent-classifier') !== -1;
}

function attributeTrigger(rec, byUuid) {
  let cur = rec;
  let hops = 0;
  while (hops < 50) {
    hops += 1;
    const pu = cur.parentUuid;
    if (!pu || !byUuid.has(pu)) return { trigger: null, kind: 'missing' };
    const next = byUuid.get(pu);
    if (next.type === 'attachment') {
      const att2 = next.attachment || {};
      if (att2.type === 'queued_command') return { trigger: next, kind: 'queued_command' };
      cur = next;
      continue;
    }
    return { trigger: next, kind: next.type };
  }
  return { trigger: null, kind: 'hops-exceeded' };
}

// Ground truth: NO harness lead literal (R4/D-02). Structural fields only.
function groundTruthClass(trigger, kind) {
  if (!trigger) return 'other';
  if (kind === 'queued_command') {
    const att = trigger.attachment || {};
    const origin = att.origin || {};
    const ok = origin.kind;
    const cm = att.commandMode;
    if (ok === 'peer' || ok === 'task-notification' || cm === 'task-notification') return 'harness';
    if (ok === 'human') return 'human';
    return 'other';
  }
  if (kind === 'user') {
    const origin = trigger.origin || {};
    const ok = origin.kind;
    const ps = trigger.promptSource;
    if (ok === 'peer' || ok === 'task-notification' || ps === 'system') return 'harness';
    if (ok === 'human') return 'human';
    return 'other';
  }
  return 'other';
}

function flattenContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = [];
    for (const block of content) {
      if (typeof block === 'string') { parts.push(block); continue; }
      if (block && typeof block === 'object' && typeof block.text === 'string') parts.push(block.text);
    }
    return parts.join('\n');
  }
  return '';
}

function triggerText(trigger, kind) {
  if (kind === 'queued_command') {
    const att = trigger.attachment || {};
    return typeof att.prompt === 'string' ? att.prompt : '';
  }
  if (kind === 'user') {
    const msg = trigger.message || {};
    return flattenContent(msg.content);
  }
  return '';
}

// A2: a stored peer record is evaluated under BOTH candidate prompt forms (the framed
// text, and the raw tag on the second line); the verdict is harness only when BOTH forms
// are harness (RESEARCH Finding 2).
function isHarnessVerdict(trigger, kind, classifyFn) {
  const text = triggerText(trigger, kind);
  const isStoredPeer = kind === 'user' && trigger.origin && trigger.origin.kind === 'peer';
  if (!isStoredPeer) {
    return classifyFn(text) === 'harness';
  }
  const nlIdx = text.indexOf('\n');
  const secondForm = nlIdx !== -1 ? text.slice(nlIdx + 1) : text;
  return classifyFn(text) === 'harness' && classifyFn(secondForm) === 'harness';
}

// ---------------------------------------------------------------------------
// Walk the snapshot, sorted filename order (s1..s4).
// ---------------------------------------------------------------------------
const files = fs.readdirSync(SNAPSHOT_DIR)
  .filter(function (n) { return n.endsWith('.jsonl'); })
  .sort();

let failed = 0;
function assertTrue(cond, msg) {
  if (!cond) {
    failed += 1;
    console.log('FAIL: ' + msg);
  } else {
    console.log('  ok - ' + msg);
  }
}

const runs = []; // { file_index, session_label, anchor, cls, pre, trigger, kind, obj }
const sessions = []; // { label, anchor, human_pre: 0, human_post_c: 0 }

for (let i = 0; i < files.length; i += 1) {
  const fname = files[i];
  const stem = fname.replace(/\.jsonl$/, '');
  const stemHash = crypto.createHash('sha256').update(stem).digest('hex');
  const label = 's' + (i + 1);
  const anchor = stemHash === ANCHOR_SESSION_SHA256;
  sessions.push({ label: label, anchor: anchor });

  const full = path.join(SNAPSHOT_DIR, fname);
  const { byUuid, order } = loadRecords(full);

  for (const obj of order) {
    if (!isIntentClassifierUPS(obj)) continue;
    const att = obj.attachment || {};
    const stdout = typeof att.stdout === 'string' ? att.stdout : '';
    const pre = stdout.indexOf(UNBOUND_HEADER) !== -1;
    const { trigger, kind } = attributeTrigger(obj, byUuid);
    const cls = groundTruthClass(trigger, kind);
    runs.push({
      sessionIndex: i,
      sessionLabel: label,
      anchor: anchor,
      cls: cls,
      pre: pre,
      trigger: trigger,
      kind: kind,
      cwd: obj.cwd,
    });
  }
}

console.log('test-360-snapshot-replay.cjs (360-03): local-only counterfactual replay, layer '
  + LAYER + ' (' + runs.length + ' intent-classifier UserPromptSubmit runs attributed)');

// ---------------------------------------------------------------------------
// Attribution-drift check (before any verdict is applied).
// ---------------------------------------------------------------------------
const prePre = { harness: 0, human: 0, other: 0 };
for (const r of runs) {
  if (r.pre) prePre[r.cls] += 1;
}
const driftOk = prePre.harness === BASELINE_PRE.harness
  && prePre.human === BASELINE_PRE.human
  && prePre.other === BASELINE_PRE.other;
if (!driftOk) {
  console.log('attribution drift: expected pre unbound fires harness=' + BASELINE_PRE.harness
    + ' human=' + BASELINE_PRE.human + ' other=' + BASELINE_PRE.other
    + ', got harness=' + prePre.harness + ' human=' + prePre.human + ' other=' + prePre.other);
  process.exit(1);
}
console.log('  ok - attribution reproduces the SPEC baseline (pre unbound fires: harness='
  + prePre.harness + ' human=' + prePre.human + ' other=' + prePre.other + ')');

// ---------------------------------------------------------------------------
// RED-until-360-06: classifyUserPromptText.
// ---------------------------------------------------------------------------
let tt = null;
try {
  tt = require(TURN_TEXT_PATH);
} catch (_e) {
  tt = null;
}
if (!tt || typeof tt.classifyUserPromptText !== 'function') {
  console.log('RED until 360-06: lib/hmi/turn-text.cjs has no classifyUserPromptText export yet');
  process.exit(1);
}
const classifyFn = function (text) {
  try {
    return tt.classifyUserPromptText(text);
  } catch (_e) {
    return 'none';
  }
};

// ---------------------------------------------------------------------------
// RED-until-360-07: cwdRoomsHomeVerdict (only required when layer c runs).
// ---------------------------------------------------------------------------
let policy = null;
if (RUN_C) {
  try {
    policy = require(PICKER_POLICY_PATH);
  } catch (_e) {
    policy = null;
  }
  if (!policy || typeof policy.cwdRoomsHomeVerdict !== 'function') {
    console.log('RED until 360-07: lib/core/room-bind-picker-policy.cjs has no '
      + 'cwdRoomsHomeVerdict export yet');
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Layer h: post_h = pre && verdict(trigger) !== 'harness'.
// ---------------------------------------------------------------------------
const postH = { harness: 0, human: 0, other: 0 };
let humanRunsWithHarnessVerdict = 0;
for (const r of runs) {
  const verdictIsHarness = r.trigger ? isHarnessVerdict(r.trigger, r.kind, classifyFn) : false;
  r.verdictIsHarness = verdictIsHarness;
  r.postH = r.pre && !verdictIsHarness;
  if (r.postH) postH[r.cls] += 1;
  if (r.cls === 'human' && verdictIsHarness) humanRunsWithHarnessVerdict += 1;
}

if (RUN_H) {
  assertTrue(postH.harness === 0, 'layer h: post harness unbound fires is 0 (got ' + postH.harness + ')');
  assertTrue(postH.human === BASELINE_PRE.human,
    'layer h: post human unbound fires is ' + BASELINE_PRE.human + ' (got ' + postH.human + ')');
  assertTrue(humanRunsWithHarnessVerdict === 0,
    'layer h: 0 human-attributed runs carry a harness verdict (got ' + humanRunsWithHarnessVerdict + ')');
  assertTrue(postH.other === prePre.other,
    'layer h: other class unbound fires unchanged (pre=' + prePre.other + ', post=' + postH.other + ')');
}

// ---------------------------------------------------------------------------
// Layer c: post_c = post_h && cwdClass !== 'outside'. Uses the UPS attachment's OWN cwd,
// never the trigger's.
// ---------------------------------------------------------------------------
if (RUN_C) {
  const humanCwdClassCounts = { inside: 0, ancestor: 0, outside: 0, unresolvable: 0 };
  let humanPostC = 0;
  let anchorHumanPostC = 0;
  for (const r of runs) {
    if (r.cls !== 'human' || !r.postH) continue;
    let cwdClass;
    try {
      cwdClass = policy.cwdRoomsHomeVerdict(r.cwd, ROOMS_HOME);
    } catch (_e) {
      cwdClass = 'unresolvable';
    }
    if (typeof humanCwdClassCounts[cwdClass] !== 'number') humanCwdClassCounts[cwdClass] = 0;
    humanCwdClassCounts[cwdClass] += 1;
    const postC = cwdClass !== 'outside';
    r.postC = postC;
    r.cwdClass = cwdClass;
    if (postC) {
      humanPostC += 1;
      if (r.anchor) anchorHumanPostC += 1;
    }
  }

  assertTrue(humanCwdClassCounts.outside === BASELINE_PRE.human,
    'layer c: both human unbound-header fires resolve cwd class outside (got '
    + humanCwdClassCounts.outside + ' of ' + BASELINE_PRE.human + ')');
  assertTrue(humanPostC === 0,
    'layer c: human post fires after the cwd rule is 0 (got ' + humanPostC + ')');
  assertTrue(anchorHumanPostC === 0,
    'layer c: the anchor session has 0 human post fires (got ' + anchorHumanPostC + ')');
  assertTrue(humanCwdClassCounts.inside === 0 && humanCwdClassCounts.ancestor === 0
    && humanCwdClassCounts.unresolvable === 0,
    'layer c: human fires with cwd class inside/ancestor/unresolvable are unchanged, all 0 '
    + '(got inside=' + humanCwdClassCounts.inside + ' ancestor=' + humanCwdClassCounts.ancestor
    + ' unresolvable=' + humanCwdClassCounts.unresolvable + ')');

  console.log('  (layer c cwd classes among the ' + BASELINE_PRE.human + ' human pre-fires: '
    + JSON.stringify(humanCwdClassCounts) + ')');
}

// ---------------------------------------------------------------------------
// Small table: counts, booleans and cwd classes only (never a path, id or prompt body).
// ---------------------------------------------------------------------------
console.log('');
console.log('class    runs  pre  post_h' + (RUN_C ? '  post_c' : ''));
for (const cls of ['human', 'harness', 'other']) {
  const totalRuns = runs.filter(function (r) { return r.cls === cls; }).length;
  const preCount = prePre[cls];
  const postHCount = postH[cls];
  let line = cls.padEnd(8) + String(totalRuns).padStart(4) + String(preCount).padStart(5)
    + String(postHCount).padStart(7);
  if (RUN_C && cls === 'human') {
    const postCCount = runs.filter(function (r) { return r.cls === 'human' && r.postC; }).length;
    line += String(postCCount).padStart(7);
  }
  console.log(line);
}
console.log('');
console.log('session  human_pre  anchor' + (RUN_C ? '  human_post_c' : ''));
for (const s of sessions) {
  const humanPre = runs.filter(function (r) { return r.sessionLabel === s.label && r.cls === 'human' && r.pre; }).length;
  let line = s.label.padEnd(8) + String(humanPre).padStart(10) + String(s.anchor).padStart(8);
  if (RUN_C) {
    const humanPostC = runs.filter(function (r) {
      return r.sessionLabel === s.label && r.cls === 'human' && r.postC;
    }).length;
    line += String(humanPostC).padStart(14);
  }
  console.log(line);
}

console.log('');
if (failed > 0) {
  console.log('FAILED (' + failed + ' assertion(s) did not hold)');
  process.exit(1);
}
console.log('PASS test-360-snapshot-replay.cjs (layer ' + LAYER + ')');
