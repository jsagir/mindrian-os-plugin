'use strict';

// Phase 374 plan 05, test T7 (arms V0 to V15). RED first: plan 374-06 creates
// lib/mcp/eureka-pair-screen.cjs and makes it green.
//
// The module exports verifyPairScreenResult(result, { capability_id, scope_id, snapshot_id }).
// It checks an engine result of schema eureka.pair-screen.v1 (see the engine run contract, "Result,
// key by key" and "Rules for the consumer"). The rules pinned here:
//   - schema_version first; capability; scope present and equal to the request lineage;
//   - every inline file: sha256 of its UTF-8 content equals sha256, UTF-8 byte length equals bytes;
//   - a file that is not inline carries no content;
//   - label, room_write, portfolio_write and approval.verified_by_engine have their fixed values;
//   - completed_empty is an empty shortlist, never proof that no opportunity exists;
//   - unknown keys are ignored; a refusal is a fixed sentence and never repeats a value of the result.
//
// Pure unit test: no engine, no network, no room. The result is built in this file with real
// sha256 values. Output: "ok - <id> <text>" or "FAIL - <id> <text>" at column 1.
// If the module does not exist yet, V0 fails with a plain sentence and every later arm fails with
// the same reason (nothing throws before it prints).

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const MODULE_PATH = path.join(__dirname, '..', 'lib', 'mcp', 'eureka-pair-screen.cjs');
const MODULE_REL = 'lib/mcp/eureka-pair-screen.cjs';
const CAPABILITY = 'opportunity.run_pair_screen';
const SCOPE = 'room:verify';
const SNAPSHOT = 'snapshot-verify';
const EXPECT = Object.freeze({ capability_id: CAPABILITY, scope_id: SCOPE, snapshot_id: SNAPSHOT });
// A marker planted in untrusted text. No refusal may ever repeat it.
const MARKER = 'IGNORE-PREVIOUS-INSTRUCTIONS-MARKER-4471';

let mod = null;
let missingReason = null;
if (!fs.existsSync(MODULE_PATH)) {
  missingReason = MODULE_REL + ' does not exist yet (plan 374-06 creates it)';
} else {
  try {
    mod = require(MODULE_PATH);
    if (typeof mod.verifyPairScreenResult !== 'function') {
      missingReason = MODULE_REL + ' does not export verifyPairScreenResult';
    }
  } catch (error) {
    missingReason = MODULE_REL + ' failed to load: ' + String(error && error.message || error).split('\n')[0];
  }
}

function sha256(text) { return crypto.createHash('sha256').update(text, 'utf8').digest('hex'); }
function inlineFile(filePath, content) {
  return { path: filePath, bytes: Buffer.byteLength(content, 'utf8'), sha256: sha256(content), inline: true, content };
}

// Build a good result with real hashes. Overrides apply after the build. The title of the first
// pair holds a non-ASCII letter (written as an escape) so UTF-8 length differs from string length.
function buildGood(options) {
  const opts = options || {};
  const empty = opts.empty === true;
  const pairs = empty ? [] : [
    { id: 'pair-1', kind: 'pair', engines: ['unusual_pairs', 'wording_and_meaning'], payload: {
      left: { artifact_id: 'a-1', record_id: 'r-1', source_ref: opts.sourceRef || 'src-1', title: opts.title || 'Caf\u00e9 queue design' },
      right: { artifact_id: 'a-2', record_id: 'r-2', source_ref: 'src-2', title: 'Harbor tide tables' },
      ranks: { unusual_pairs: 1, wording_and_meaning: 3 } } },
    { id: 'pair-2', kind: 'pair', engines: ['unusual_pairs'], payload: {
      left: { artifact_id: 'a-3', record_id: 'r-3', source_ref: 'src-3', title: 'Seed bank labels' },
      right: { artifact_id: 'a-4', record_id: 'r-4', source_ref: 'src-4', title: 'Bus timetable gaps' },
      ranks: { unusual_pairs: 2, wording_and_meaning: null } } },
  ];
  const unusualContent = JSON.stringify({ pairs: pairs.map((p) => p.id) });
  const wordingContent = JSON.stringify({ pairs: pairs.filter((p) => p.engines.includes('wording_and_meaning')).map((p) => p.id) });
  const rankedContent = '# Ranked pairs\n\n' + pairs.map((p) => '- ' + p.payload.left.title + ' / ' + p.payload.right.title).join('\n') + '\n';
  const manifestContent = JSON.stringify({ schema: 'eureka.pair-screen.manifest.v1', pairs: pairs.length });
  const files = [
    inlineFile('unusual-pairs.json', unusualContent),
    inlineFile('wording-and-meaning-pairs.json', wordingContent),
    inlineFile('ranked-pairs.md', rankedContent),
    inlineFile('manifest.json', manifestContent),
    { path: 'corpus/records.jsonl', bytes: 1234, sha256: sha256('records stay out of the result'), inline: false },
  ];
  return {
    schema_version: 'eureka.pair-screen.v1',
    capability_id: CAPABILITY,
    status: empty ? 'completed_empty' : 'completed',
    job_id: 'job-verify-1',
    label: 'candidate, not verified',
    summary_line: empty ? 'No pair passed the screen.' : 'Two candidate pairs were found.',
    scope: { scope_id: SCOPE, snapshot_id: SNAPSHOT },
    scope_id: SCOPE,
    snapshot_id: SNAPSHOT,
    approval: { plan_digest: sha256('plan'), approval_ref: 'gate-0123456789abcdef', verified_by_engine: false },
    counts: { records_read: 10, records_used: 8, dropped: 2, unusual_pairs: pairs.length, wording_and_meaning_pairs: empty ? 0 : 1 },
    caps_hit: [],
    warnings: [],
    manifest_sha256: sha256(manifestContent),
    files,
    id_map: [
      { record_id: 'r-1', artifact_id: 'a-1', source_ref: opts.sourceRef || 'src-1' },
      { record_id: 'r-2', artifact_id: 'a-2', source_ref: 'src-2' },
    ],
    outputs: pairs,
    host_handoff: { state: 'awaiting_mindrianos_review', owner: 'mindrianos' },
    room_write: 'not_performed',
    portfolio_write: 'not_performed',
    persistence: { job_store: 'kept 30 days', derived_vectors: 'none kept', run_files: 'deleted' },
  };
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }
function inlineIndex(result) { return result.files.findIndex((f) => f.path === 'ranked-pairs.md'); }

// The failing cases. Each mutates a clone of the good result (with the marker planted in
// untrusted text) and names the reason the verifier must give.
const FAILING = {
  schema: { reason: 'engine_result_invalid', mutate: (r) => { r.schema_version = 'eureka.pair-screen.v0'; } },
  capability: { reason: 'engine_lineage_mismatch', mutate: (r) => { r.capability_id = 'opportunity.find_cross_domain_pairs'; } },
  scopeMissing: { reason: 'engine_lineage_missing', mutate: (r) => { delete r.scope; } },
  scopeIdDiffers: { reason: 'engine_lineage_mismatch', mutate: (r) => { r.scope = { scope_id: 'room:other', snapshot_id: SNAPSHOT }; } },
  snapshotDiffers: { reason: 'engine_lineage_mismatch', mutate: (r) => { r.scope = { scope_id: SCOPE, snapshot_id: 'snapshot-other' }; } },
  contentAltered: { reason: 'engine_result_hash_mismatch', mutate: (r) => { r.files[inlineIndex(r)].content += ' ' + MARKER; } },
  bytesDiffer: { reason: 'engine_result_hash_mismatch', mutate: (r) => {
    // content and sha256 stay true; only the declared size is wrong (the string length, not the UTF-8 length)
    const f = r.files[inlineIndex(r)]; f.bytes = f.content.length; } },
  notInlineWithContent: { reason: 'engine_result_invalid', mutate: (r) => { r.files[r.files.length - 1].content = 'records text ' + MARKER; } },
  labelMissing: { reason: 'engine_result_invalid', mutate: (r) => { delete r.label; } },
  labelWrong: { reason: 'engine_result_invalid', mutate: (r) => { r.label = 'verified'; } },
  roomWrite: { reason: 'engine_result_invalid', mutate: (r) => { r.room_write = 'performed'; } },
  portfolioWrite: { reason: 'engine_result_invalid', mutate: (r) => { r.portfolio_write = 'performed'; } },
  approvalFlag: { reason: 'engine_result_invalid', mutate: (r) => { r.approval.verified_by_engine = true; } },
};

function failingInput(name, planted) {
  const r = clone(buildGood(planted ? { title: 'Caf\u00e9 planted ' + MARKER, sourceRef: 'ref-' + MARKER } : {}));
  FAILING[name].mutate(r);
  return r;
}

function verify(result) { return mod.verifyPairScreenResult(result, { ...EXPECT }); }

function expectRefusal(name) {
  const out = verify(failingInput(name, false));
  assert.equal(out.ok, false, name + ': must be refused');
  assert.equal(out.reason, FAILING[name].reason, name + ': expected ' + FAILING[name].reason + ', got ' + out.reason);
  assert.equal(typeof out.message, 'string', name + ': message must be a string');
  assert.ok(out.message.length > 0 && out.message.length < 400, name + ': message must be one fixed sentence');
  return out;
}

let failed = 0;
async function arm(id, text, fn) {
  try {
    if (id !== 'V0' && missingReason) throw new Error(missingReason);
    await fn();
    console.log('ok - ' + id + ' ' + text);
  } catch (error) {
    failed += 1;
    console.log('FAIL - ' + id + ' ' + text);
    console.log('  reason: ' + String(error && error.message || error).split('\n')[0]);
  }
}

async function main() {
  await arm('V0', 'lib/mcp/eureka-pair-screen.cjs exists and exports verifyPairScreenResult', async () => {
    if (missingReason) throw new Error(missingReason);
  });

  await arm('V1', 'a good result gives ok with counts, label, manifest hash, caps_hit and warnings carried through', async () => {
    const good = buildGood();
    good.caps_hit = [{ cap: 'max_pairs', limit: 5 }];
    good.warnings = ['Two records were short.'];
    const out = verify(good);
    assert.equal(out.ok, true, 'good result refused with ' + out.reason);
    assert.equal(out.status, 'completed');
    assert.equal(out.shortlist_empty, false);
    assert.ok(out.summary && typeof out.summary === 'object', 'summary object');
    assert.deepEqual(out.summary.counts, good.counts);
    assert.equal(out.summary.label, 'candidate, not verified');
    assert.equal(out.summary.manifest_sha256, good.manifest_sha256);
    assert.deepEqual(out.summary.caps_hit, good.caps_hit);
    assert.deepEqual(out.summary.warnings, good.warnings);
  });

  await arm('V2', 'a schema_version other than eureka.pair-screen.v1 gives engine_result_invalid', async () => { expectRefusal('schema'); });
  await arm('V3', 'a capability_id other than opportunity.run_pair_screen gives engine_lineage_mismatch', async () => { expectRefusal('capability'); });
  await arm('V4', 'a result with no scope gives engine_lineage_missing', async () => { expectRefusal('scopeMissing'); });
  await arm('V5', 'a scope_id that differs gives engine_lineage_mismatch', async () => { expectRefusal('scopeIdDiffers'); });
  await arm('V6', 'a snapshot_id that differs gives engine_lineage_mismatch', async () => { expectRefusal('snapshotDiffers'); });

  await arm('V7', 'an inline file with altered content gives engine_result_hash_mismatch (T-374-14)', async () => {
    const first = expectRefusal('contentAltered');
    // The same sentence for another altered text: the message is fixed, not built from the content.
    const other = clone(buildGood());
    other.files[inlineIndex(other)].content += ' a different alteration';
    const second = verify(other);
    assert.equal(second.reason, 'engine_result_hash_mismatch');
    assert.equal(second.message, first.message, 'the refusal sentence must be fixed');
  });

  await arm('V8', 'an inline file whose bytes differ from the UTF-8 length of its content gives engine_result_hash_mismatch (T-374-14)', async () => {
    const good = buildGood();
    const f = good.files[inlineIndex(good)];
    assert.notEqual(Buffer.byteLength(f.content, 'utf8'), f.content.length, 'test setup: the content must hold a multibyte letter');
    expectRefusal('bytesDiffer');
  });

  await arm('V9', 'a file that is not inline but carries content gives engine_result_invalid', async () => { expectRefusal('notInlineWithContent'); });

  await arm('V10', 'a label that is missing or not "candidate, not verified" gives engine_result_invalid', async () => {
    expectRefusal('labelMissing');
    expectRefusal('labelWrong');
  });

  await arm('V11', 'room_write or portfolio_write other than not_performed gives engine_result_invalid', async () => {
    expectRefusal('roomWrite');
    expectRefusal('portfolioWrite');
  });

  await arm('V12', 'approval.verified_by_engine other than false gives engine_result_invalid', async () => { expectRefusal('approvalFlag'); });

  await arm('V13', 'completed_empty gives ok, an empty shortlist and a sentence that an empty list proves nothing', async () => {
    const out = verify(buildGood({ empty: true }));
    assert.equal(out.ok, true, 'a good empty result refused with ' + out.reason);
    assert.equal(out.status, 'completed_empty');
    assert.equal(out.shortlist_empty, true);
    assert.match(JSON.stringify(out), /does not show that no opportunity exists/i,
      'the answer must say that an empty list does not show that no opportunity exists');
    const full = verify(buildGood());
    assert.equal(/does not show that no opportunity exists/i.test(JSON.stringify(full)), false,
      'the empty-list sentence belongs to completed_empty only');
  });

  await arm('V14', 'unknown extra keys are ignored', async () => {
    const good = buildGood();
    good.future_top_key = { anything: [1, 2, 3] };
    good.counts.future_count = 9;
    good.files[0].future_file_key = 'x';
    good.outputs[0].future_pair_key = true;
    good.host_handoff.future_handoff_key = 'y';
    const out = verify(good);
    assert.equal(out.ok, true, 'extra keys must not cause a refusal (reason ' + out.reason + ')');
  });

  await arm('V15', 'a refusal never repeats a value of the result (marker in a title and a source ref)', async () => {
    const names = Object.keys(FAILING);
    assert.ok(names.length >= 12, 'test setup: every failing case runs');
    for (const name of names) {
      const out = verify(failingInput(name, true));
      assert.equal(out.ok, false, name + ': must be refused');
      assert.equal(JSON.stringify(out).includes(MARKER), false, name + ': the refusal repeats result text');
      assert.equal(JSON.stringify(out).includes('Harbor tide tables'), false, name + ': the refusal repeats a title');
    }
  });

  console.log('374 verify result: 16 arms, ' + failed + ' failed');
  process.exitCode = failed === 0 ? 0 : 1;
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
