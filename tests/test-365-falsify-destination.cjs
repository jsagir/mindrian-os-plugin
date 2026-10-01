'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 365 Plan 03 Task 2 -- falsification test 2 (remove the destination), as a
 * CHARACTERIZATION test.
 *
 * Property under test (365-INPUT.md item 2): remove the destination (the
 * governing thought and the active JTBD). Does next-move confidence stay
 * unchanged? If it does, the destination is decoration and not an input.
 *
 * This test builds one fixture room twice with the SAME artifacts and claim:
 *   WITH:    every section carries a MINTO.md whose frontmatter holds a
 *            governing_thought, and the room has an active JTBD (written through
 *            lib/hmi/jtbd-state.cjs setCurrent and the spine-events
 *            logJtbdTransition, the two stores the sensors and the getters read);
 *   WITHOUT: neither.
 * It then drives the REAL registered suggest_next handler (captured off a fake
 * MCP server from the real lib/mcp/tools/sensors.cjs register(), the idiom
 * tests/test-222-reach-wired.cjs uses) on each room with the same user_text.
 *
 * Classification of the observation:
 *   no_confidence_emitted  no numeric confidence or score field anywhere in
 *                          either result (the tool does not emit one, so the
 *                          property as worded cannot be answered by it)
 *   unchanged              a confidence or score field exists and is equal
 *   changed                a confidence or score field exists and differs
 * The record also keeps the top reach id with and without, because the question
 * "did the destination change what the tool suggests" is answerable even when no
 * confidence value exists.
 *
 * The Brain leg of suggest_next (chain_offer) is replaced by a null-returning
 * stub on the chain-recommender export: it adds only the optional chain_offer
 * field, and this test is hermetic (no network, installNetGuard proves it).
 *
 * Predicted: UNKNOWN (characterization). Exit 0 while the observed outcome
 * matches the entry for key "remove_destination" in
 * tests/fixtures/365-falsification-record.json; exit 1 with RECORD MISMATCH when
 * it flips. The record is written only when RECORD_365_FALSIFICATION=1.
 *
 * Exit codes: 0 match, 1 mismatch or error, 77 python3 or git unavailable.
 * No model, no Jev, no network. No em-dashes (CLAUDE.md HARD RULE).
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const guard = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const RECORD_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', '365-falsification-record.json');
const KEY = 'remove_destination';
const PROPERTY = 'remove the destination (governing thought and active JTBD): does next-move confidence stay unchanged';

function probeTool(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  return !r.error && r.status === 0;
}
if (!probeTool('python3', ['--version']) || !probeTool('git', ['--version'])) {
  console.log('ENV GAP: python3 or git unavailable; falsification test remove_destination SKIPPED');
  process.exit(77);
}

const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const spineEvents = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'spine-events.cjs'));
const jtbdState = require(path.join(REPO_ROOT, 'lib', 'hmi', 'jtbd-state.cjs'));
const chainRecommender = require(path.join(REPO_ROOT, 'lib', 'brain', 'chain-recommender.cjs'));
const sensorsTool = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'sensors.cjs'));

// Hermetic: the Brain companion leg adds only chain_offer and reaches the network.
chainRecommender.chainOfferForReach = async function stubbedOffer() { return null; };

const USER_TEXT = 'What should we do next on the launch plan?';
const GOVERNING_THOUGHT = 'Launch the line only after the capacity numbers hold under two shifts.';
const JTBD_ID = 'decide-pursue';
const SECTIONS = [
  { name: 'problem-definition', file: 'schedule.md', body: '# Schedule\n\nThe line runs two shifts and the crew rotates at noon.\n' },
  { name: 'market-analysis', file: 'buyers.md', body: '# Buyers\n\nThe first buyers are regional distributors.\n' },
];

// parts: { thought: bool, jtbd: bool }. WITH = both, WITHOUT = neither; the two single-part
// rooms isolate which half of the destination moves the suggestion.
function buildRoom(roomDir, parts) {
  fs.mkdirSync(roomDir, { recursive: true });
  for (const s of SECTIONS) {
    const dir = path.join(roomDir, s.name);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, s.file), s.body, 'utf8');
    if (parts.thought) {
      const minto = [
        '---',
        'governing_thought: "' + GOVERNING_THOUGHT + '"',
        'last_generated_at: 2026-09-30T00:00:00.000Z',
        '---',
        '',
        '> [!abstract] Governing Thought',
        '> ' + GOVERNING_THOUGHT,
        '',
      ].join('\n');
      fs.writeFileSync(path.join(dir, 'MINTO.md'), minto, 'utf8');
    }
  }
  const db = openRoomDb(roomDir);
  try {
    const res = navigation.writeClaimNode(db, {
      knowledge_type: 'fact',
      text: 'The line runs two shifts.',
      sessionId: 'falsify-365-destination',
      sourceSegment: 'two-shifts',
    });
    assert.ok(res && res.ok === true, 'claim write failed: ' + JSON.stringify(res));
  } finally {
    closeRoomDb(db);
  }
  if (parts.jtbd) {
    jtbdState.setCurrent(roomDir, { jtbd: JTBD_ID, confidence: 0.8, trigger: 'falsify-365', manual: true });
    spineEvents.logJtbdTransition(roomDir, { from: 'explore', to: JTBD_ID, jtbd: JTBD_ID, kind: 'auto' });
  }
}

// Walk a value and collect the dotted paths of every numeric field whose key names
// a confidence or a score. Pure and deterministic.
const CONF_KEY = /confidence|score|weight|probab|likelihood/i;
function numericConfidenceFields(value, prefix, out) {
  if (Array.isArray(value)) {
    value.forEach((v, i) => numericConfidenceFields(v, prefix + '[' + i + ']', out));
  } else if (value && typeof value === 'object') {
    for (const k of Object.keys(value).sort()) {
      const p = prefix ? prefix + '.' + k : k;
      const v = value[k];
      if (typeof v === 'number' && CONF_KEY.test(k)) out.push({ path: p, value: v });
      else numericConfidenceFields(v, p, out);
    }
  }
  return out;
}

async function suggestNext(roomDir) {
  const prior = process.env.CLAUDE_ACTIVE_ROOM;
  process.env.CLAUDE_ACTIVE_ROOM = roomDir;
  try {
    const registered = [];
    const fakeServer = {
      tool(name, _desc, schemaOrHandler, maybeHandler) {
        registered.push({ name, handler: typeof maybeHandler === 'function' ? maybeHandler : schemaOrHandler });
      },
      server: { getClientCapabilities() { return {}; } },
    };
    sensorsTool.register(fakeServer, { fallbackRoomDir: roomDir });
    const sn = registered.find((r) => r.name === 'suggest_next');
    assert.ok(sn, 'suggest_next did not register');
    const res = await sn.handler({ user_text: USER_TEXT }, { sessionId: 'falsify-365-destination' });
    return JSON.parse(res.content[0].text);
  } finally {
    if (prior === undefined) delete process.env.CLAUDE_ACTIVE_ROOM; else process.env.CLAUDE_ACTIVE_ROOM = prior;
  }
}

function summarize(payload) {
  const top = payload.suggestion || null;
  const fields = numericConfidenceFields(payload, '', []);
  // payload.room_dir is a scratch path and is deliberately not recorded.
  return {
    top_reach_id: top && typeof top.reach_id === 'string' ? top.reach_id : null,
    top_signal: top && typeof top.signal === 'string' ? top.signal : null,
    ok: payload.ok === true,
    confidence_or_score_fields: fields,
  };
}

async function observe() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-365-falsify-dest-'));
  try {
    const withDir = path.join(root, 'with-destination');
    const withoutDir = path.join(root, 'without-destination');
    const thoughtDir = path.join(root, 'thought-only');
    const jtbdDir = path.join(root, 'jtbd-only');
    buildRoom(withDir, { thought: true, jtbd: true });
    buildRoom(withoutDir, { thought: false, jtbd: false });
    buildRoom(thoughtDir, { thought: true, jtbd: false });
    buildRoom(jtbdDir, { thought: false, jtbd: true });
    const withRes = summarize(await suggestNext(withDir));
    const withoutRes = summarize(await suggestNext(withoutDir));
    const thoughtOnly = summarize(await suggestNext(thoughtDir));
    const jtbdOnly = summarize(await suggestNext(jtbdDir));

    let classification;
    if (withRes.confidence_or_score_fields.length === 0 && withoutRes.confidence_or_score_fields.length === 0) {
      classification = 'no_confidence_emitted';
    } else if (JSON.stringify(withRes.confidence_or_score_fields) === JSON.stringify(withoutRes.confidence_or_score_fields)) {
      classification = 'unchanged';
    } else {
      classification = 'changed';
    }
    return {
      observed: classification,
      observed_detail: {
        user_text: USER_TEXT,
        destination: { governing_thought_in_every_section: true, active_jtbd: JTBD_ID },
        with: withRes,
        without: withoutRes,
        top_reach_changed_by_destination: withRes.top_reach_id !== withoutRes.top_reach_id,
        governing_thought_only: thoughtOnly,
        active_jtbd_only: jtbdOnly,
      },
    };
  } finally {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

function readRecord() {
  try { return JSON.parse(fs.readFileSync(RECORD_PATH, 'utf8')); } catch (_e) { return null; }
}

function writeRecordEntry(entry) {
  let rec = readRecord();
  if (!rec || rec.schema !== 'mos.365-falsification-record/1') {
    rec = { schema: 'mos.365-falsification-record/1', base_sha: '', records: [] };
  }
  const base = process.env.RECORD_365_BASE_SHA;
  if (base) rec.base_sha = base;
  if (!rec.base_sha) {
    const g = spawnSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', cwd: REPO_ROOT });
    rec.base_sha = String(g.stdout || '').trim();
  }
  const idx = rec.records.findIndex((r) => r.test === KEY);
  if (idx >= 0) rec.records[idx] = entry; else rec.records.push(entry);
  fs.mkdirSync(path.dirname(RECORD_PATH), { recursive: true });
  fs.writeFileSync(RECORD_PATH, JSON.stringify(rec, null, 2) + '\n', 'utf8');
}

async function main() {
  const obs = await observe();
  assert.equal(guard.attempts(), 0, 'network attempted during destination test');

  if (process.env.RECORD_365_FALSIFICATION === '1') {
    writeRecordEntry({
      test: KEY,
      property: PROPERTY,
      predicted: 'UNKNOWN',
      observed: obs.observed,
      observed_detail: obs.observed_detail,
      writers_driven: [
        'lib/mcp/tools/sensors.cjs suggest_next (real handler) over dispatchSensors',
      ],
      recorded_at: new Date().toISOString(),
    });
    console.log('RECORDED ' + KEY + ': ' + obs.observed);
    return 0;
  }

  const rec = readRecord();
  const entry = rec && Array.isArray(rec.records) ? rec.records.find((r) => r.test === KEY) : null;
  if (!entry) {
    console.log('RECORD MISMATCH: no entry for ' + KEY + '; run with RECORD_365_FALSIFICATION=1 and update tests/fixtures/365-falsification-record.json with the navigator');
    return 1;
  }
  let flipped = null;
  if (entry.observed !== obs.observed) {
    flipped = 'observed ' + entry.observed + ' -> ' + obs.observed;
  } else {
    try {
      assert.deepEqual(obs.observed_detail, entry.observed_detail);
    } catch (_e) {
      flipped = 'observed_detail changed: now ' + JSON.stringify(obs.observed_detail);
    }
  }
  if (flipped) {
    console.log('RECORD MISMATCH: ' + flipped + '; update tests/fixtures/365-falsification-record.json with the navigator');
    return 1;
  }
  console.log('MATCHES RECORD (' + obs.observed + ')');
  console.log('top reach with destination: ' + obs.observed_detail.with.top_reach_id
    + '; without: ' + obs.observed_detail.without.top_reach_id);
  return 0;
}

main().then((code) => process.exit(code), (e) => {
  console.log('TEST ERROR: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
