#!/usr/bin/env node
'use strict';

/*
 * Phase 365-15 -- the pulled portrait and the standing on the claim view.
 *
 * Task 1 legs Q1..Q6: readStandingPortrait, the one-argument render kept
 * byte-identical to the 358 lines, the standing rows (counts in words, each
 * naming what would move it), no score words, the standing on the claim view
 * and list, and the one-week acceptance test green.
 * Task 2 legs Q7..Q11: claim_read carries the rows (descriptions and schemas
 * unchanged), `/mos:status --checks` prints the pulled portrait with the
 * never-do line, an unreadable never-do list is reported with its fix, the
 * normal status never prints any of it, and the argument docs plus the mirror.
 *
 * Plain node:assert/strict. No em-dash or en-dash in this file: the dash
 * checks spell the two characters as escapes. Exit 0 pass, 1 fail, 77 env gap.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const fx = require('./helpers/fixture-room-365.cjs');

const REPO_ROOT = path.resolve(__dirname, '..');
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const claimVerify = require(path.join(REPO_ROOT, 'lib', 'mcp', 'tools', 'claim-verify.cjs'));
const roomConstraints = require(path.join(REPO_ROOT, 'lib', 'core', 'room-constraints.cjs'));

const CLOSING = 'A count is not a verdict. Only a person confirms a claim.';
const NO_SCORE = /score|percent|pct|ratio|grade|coverage|%|verified|fail/i;

let failures = 0;
function check(label, fn) {
  try {
    const note = fn();
    process.stdout.write('  ok - ' + label + (note ? ' (' + note + ')' : '') + '\n');
  } catch (e) {
    failures += 1;
    process.stdout.write('  FAIL - ' + label + ' :: ' + String((e && e.message) || e).split('\n')[0] + '\n');
  }
}

// The 358 portrait, captured from PLAN_BASE (5b9b0e0a7) for the seeded room
// below. readVerificationPortrait and the one-argument render must not move.
const BASE_PORTRAIT = {
  claims_total: 4, claims_unchecked: 3, claims_checked: 1, claims_disputed: 0, claims_inconclusive: 0,
  records_total: 1,
  records_by_result: { supports: 1, contradicts: 0, inconclusive: 0 },
  records_by_rung: { 1: 0, 2: 1, 3: 0, 4: 0, 5: 0, unknown: 0 },
};
const BASE_LINES = [
  'Checking record across this room (counts only)',
  '  checked: 1',
  '  disputed: 0',
  '  inconclusive: 0',
  '  unchecked (no checking record yet): 3',
  '  claims in this room: 4',
  '  checks recorded: 1 (supports 1, contradicts 0, inconclusive 0)',
  '  checks by rung: rung 1: 0, rung 2: 1, rung 3: 0, rung 4: 0, rung 5: 0, rung unknown: 0',
  CLOSING,
];

// One claim per standing; the asked claim is also held for evidence.
function seedFourStandings(db) {
  const ids = {};
  ids.none = fx.seedClaim(db, { text: 'Claim none.', variant: 'a' });
  ids.model_only = fx.seedClaim(db, { text: 'Claim asked.', variant: 'b' });
  fx.recordAsk(db, ids.model_only);
  ids.source_edge = fx.seedClaim(db, { text: 'Claim sourced.', variant: 'c' });
  fx.addSourceEdge(db, ids.source_edge, { url: 'https://example.org/a', retrieved_at: '2026-09-30T10:00:00Z', variant: 'c' });
  ids.located_source = fx.seedClaim(db, { text: 'Claim located.', variant: 'd' });
  fx.addSourceEdge(db, ids.located_source, { url: 'https://example.org/b', retrieved_at: '2026-09-30T10:00:00Z', locator: 'p. 4', variant: 'd' });
  const held = navigation.holdForEvidence(db, ids.model_only, 'tester', 'below room verification floor');
  assert.ok(held && held.ok !== false, 'holdForEvidence: ' + JSON.stringify(held));
  return ids;
}

// sha256 of the registered title, description and input field names, field
// descriptions and zod type names for claim_read and claim_verify, captured from
// PLAN_BASE (5b9b0e0a7). The portrait change must not move any of them.
const BASE_SCHEMA_SHA = '15b5df27b72864c4897fc928feb71add52fa9947a7bcd02e2c0632b3a575cdab';

function schemaSignature(handlersServer) {
  const cfgs = {};
  const server = { tool() {}, registerTool(n, c) { cfgs[n] = c; } };
  claimVerify.register(server, { fallbackRoomDir: '/nonexistent', pluginRoot: REPO_ROOT, surface: 'cli' });
  const out = {};
  for (const n of Object.keys(cfgs)) {
    const c = cfgs[n];
    const shape = (c.inputSchema && c.inputSchema.shape) || {};
    out[n] = {
      title: c.title,
      description: c.description,
      fields: Object.keys(shape).sort().map((k) => [k, shape[k].description || null, shape[k]._def && shape[k]._def.typeName]),
    };
  }
  return crypto.createHash('sha256').update(JSON.stringify(out)).digest('hex');
}

function runStatus(cwd, args) {
  return spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'mos-status.cjs')].concat(args),
    { cwd: cwd, encoding: 'utf8', timeout: 60000, env: Object.assign({}, process.env, { CLAUDE_ACTIVE_ROOM: '' }) });
}

function textOf(raw) { return (raw && raw.content && raw.content[0] && raw.content[0].text) || ''; }

async function mcpLeg(roomDir) {
  const { server, handlers } = fx.captureToolServer();
  claimVerify.register(server, { fallbackRoomDir: roomDir, pluginRoot: REPO_ROOT, surface: 'cli' });
  const raw = await handlers.get('claim_read')({}, { sessionId: 'test-365-portrait' });
  return JSON.parse(textOf(raw));
}

async function main() {
  let room;
  try {
    room = fx.makeRoom365('portrait');
  } catch (e) {
    process.stdout.write('ENV GAP: cannot make a scratch room: ' + String(e && e.message) + '\n');
    return fx.SKIP_EXIT_CODE;
  }
  try {
    const db = fx.openFresh(room.room);
    let ids;
    try {
      ids = seedFourStandings(db);
      const before = db.prepare('SELECT COUNT(*) AS c FROM nodes').get().c;
      const edgesBefore = db.prepare('SELECT COUNT(*) AS c FROM edges').get().c;

      check('Q1 readStandingPortrait counts per standing, held and records; read-only', () => {
        const sp = navigation.readStandingPortrait(db);
        assert.deepEqual(sp.claims_by_standing, { located_source: 1, source_edge: 1, model_only: 1, none: 1 });
        assert.equal(sp.held, 1);
        assert.equal(sp.records_total, 1);
        assert.equal(db.prepare('SELECT COUNT(*) AS c FROM nodes').get().c, before);
        assert.equal(db.prepare('SELECT COUNT(*) AS c FROM edges').get().c, edgesBefore);
      });
      check('Q1b readVerificationPortrait output equals the PLAN_BASE object', () => {
        assert.deepEqual(navigation.readVerificationPortrait(db), BASE_PORTRAIT);
      });
      check('Q1c an empty or broken db handle never throws', () => {
        const sp = navigation.readStandingPortrait({ prepare() { throw new Error('boom'); } });
        assert.deepEqual(sp.claims_by_standing, { located_source: 0, source_edge: 0, model_only: 0, none: 0 });
        assert.equal(sp.held, 0);
      });

      check('Q2 renderPortraitLines(portrait) with one argument is exactly the PLAN_BASE lines', () => {
        assert.deepEqual(navigation.renderVerificationPortraitLines(BASE_PORTRAIT), BASE_LINES);
        assert.deepEqual(navigation.renderVerificationPortraitLines(navigation.readVerificationPortrait(db)), BASE_LINES);
      });

      const sp = navigation.readStandingPortrait(db);
      const lines = navigation.renderVerificationPortraitLines(navigation.readVerificationPortrait(db), sp);
      check('Q3 rows: one per standing in order, then the held row, closing line last', () => {
        const W = navigation.STANDING_WORDS;
        const expected = [
          'What this room\'s claims were checked against',
          '  ' + W.located_source.label + ': 1 - moves when ' + W.located_source.moves_when,
          '  ' + W.source_edge.label + ': 1 - moves when ' + W.source_edge.moves_when,
          '  ' + W.model_only.label + ': 1 - moves when ' + W.model_only.moves_when,
          '  ' + W.none.label + ': 1 - moves when ' + W.none.moves_when,
          '  ' + navigation.HELD_WORDS.label + ': 1 - moves when ' + navigation.HELD_WORDS.moves_when,
          CLOSING,
        ];
        assert.deepEqual(lines.slice(BASE_LINES.length - 1), expected);
        assert.deepEqual(lines.slice(0, BASE_LINES.length - 1), BASE_LINES.slice(0, -1));
        assert.equal(lines[lines.length - 1], CLOSING);
      });
      check('Q3b HELD_WORDS is frozen and carries the agreed wording', () => {
        assert.ok(Object.isFrozen(navigation.HELD_WORDS));
        assert.equal(navigation.HELD_WORDS.label, "held for evidence (approved below this room's floor)");
        assert.equal(navigation.HELD_WORDS.moves_when,
          "a source is attached and it is approved again, or the room's floor is lowered in ROOM.md");
      });
      check('Q4 no rendered line carries a score word and no line holds a dash character', () => {
        const dash = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');
        for (const l of lines) {
          assert.ok(!NO_SCORE.test(l), 'score-like word in: ' + l);
          assert.ok(!dash.test(l), 'dash in: ' + l);
        }
      });

      check('Q5 the claim view names what it was checked against and what would move it', () => {
        const view = navigation.readClaimVerification(db, ids.model_only);
        assert.equal(view.ok, true);
        assert.equal(view.claim.standing, 'model_only');
        const vl = navigation.renderClaimViewLines(view.claim);
        const W = navigation.STANDING_WORDS.model_only;
        assert.ok(vl.indexOf('Checked against: ' + W.label + '. It moves when ' + W.moves_when + '.') !== -1, vl.join('|'));
        for (const must of ['Claim: ', 'Claim id: ', 'Confirmation status: ', 'Checking record: ']) {
          assert.ok(vl.some((l) => l.indexOf(must) === 0), 'missing existing line ' + must);
        }
        const none = navigation.readClaimVerification(db, ids.none);
        assert.equal(none.claim.standing, 'none');
        assert.ok(navigation.renderClaimViewLines(none.claim).some((l) => l.indexOf('Checked against: not checked yet. It moves when') === 0));
      });
      check('Q5b a claim object with no standing renders the old lines only', () => {
        const view = navigation.readClaimVerification(db, ids.none);
        const claim = Object.assign({}, view.claim);
        delete claim.standing;
        assert.ok(!navigation.renderClaimViewLines(claim).some((l) => l.indexOf('Checked against:') === 0));
      });
      check('Q5c the list line appends the standing words and keeps the old fields', () => {
        const list = navigation.listClaimsForChecking(db, {});
        const out = navigation.renderClaimListLines(list.claims);
        assert.equal(out.length, 4);
        const asked = list.claims.find((c) => c.claim_id === ids.model_only);
        const line = out.find((l) => l.indexOf(ids.model_only) !== -1);
        assert.ok(line.indexOf('| checking: ') !== -1 && line.indexOf('| confirmation: ') !== -1);
        assert.ok(line.indexOf(asked.text_preview) !== -1);
        assert.ok(line.endsWith(' | ' + navigation.STANDING_WORDS.model_only.label), line);
        assert.deepEqual(navigation.renderClaimListLines([]), ['  (no claims filed in this room yet)']);
      });
    } finally {
      fx.closeFresh(db);
    }
  } finally {
    fx.cleanup(room);
  }

  // Q7..Q11 use a second scratch room seeded with one claim per standing and one held claim.
  let room2;
  try {
    room2 = fx.makeRoom365('portrait2');
  } catch (e) {
    process.stdout.write('ENV GAP: cannot make a scratch room: ' + String(e && e.message) + '\n');
    return fx.SKIP_EXIT_CODE;
  }
  try {
    const db2 = fx.openFresh(room2.room);
    try { seedFourStandings(db2); } finally { fx.closeFresh(db2); }
    fs.writeFileSync(path.join(room2.room, '.room-root'), '', 'utf8');

    const payload = await mcpLeg(room2.room);
    const portraitText = String(payload && payload.rendered && payload.rendered.portrait);
    check('Q7 claim_read rendered.portrait carries the standing rows and ends with the closing line', () => {
      assert.equal(payload.ok, true);
      const W = navigation.STANDING_WORDS;
      for (const id of navigation.STANDING_IDS) {
        assert.ok(portraitText.indexOf(W[id].label + ': 1 - moves when ' + W[id].moves_when) !== -1, 'row ' + id);
      }
      assert.ok(portraitText.indexOf(navigation.HELD_WORDS.label + ': 1 - moves when') !== -1);
      assert.ok(portraitText.endsWith(CLOSING));
      assert.deepEqual(payload.standing_portrait.claims_by_standing, { located_source: 1, source_edge: 1, model_only: 1, none: 1 });
      for (const l of portraitText.split('\n')) assert.ok(!NO_SCORE.test(l), 'score-like word in: ' + l);
    });
    check('Q7b claim_read and claim_verify descriptions and input schemas equal PLAN_BASE', () => {
      assert.equal(schemaSignature(), BASE_SCHEMA_SHA);
    });

    // Q8: the pulled portrait with a named never-do entry.
    const added = roomConstraints.writeNeverDoEntry(room2.room,
      { kind: 'term', value: 'forbidden term', why: 'a test entry' },
      { approved_via: { surface: 'mcp', decision_node_id: 'decision:test-365-15' } });
    assert.ok(added && added.ok === true, 'writeNeverDoEntry: ' + JSON.stringify(added));
    const checks = runStatus(room2.room, ['--checks']);
    const out = String(checks.stdout);
    check('Q8 --checks prints the header, five rows, the never-do line, then the closing line; exit 0', () => {
      assert.equal(checks.status, 0, String(checks.stderr).slice(0, 200));
      const lines = out.trim().split('\n');
      const W = navigation.STANDING_WORDS;
      const at = lines.indexOf("What this room's claims were checked against");
      assert.ok(at !== -1, out);
      const rows = lines.slice(at + 1, at + 6);
      navigation.STANDING_IDS.forEach((id, i) => {
        assert.equal(rows[i], '  ' + W[id].label + ': 1 - moves when ' + W[id].moves_when);
      });
      assert.ok(rows[4].indexOf(navigation.HELD_WORDS.label + ': 1 - moves when') !== -1);
      assert.equal(lines[at + 6], 'Never-do list: 1 named. ' + roomConstraints.FLOOR_SENTENCE);
      assert.equal(lines[at + 7], CLOSING);
      assert.equal(lines.length, at + 8);
      for (const l of lines) assert.ok(!NO_SCORE.test(l), 'score-like word in: ' + l);
    });

    // Q9: an unreadable never-do list is reported with its fix.
    fs.writeFileSync(path.join(room2.room, '.mindrian', 'never-do.json'), '{ not json', 'utf8');
    const bad = runStatus(room2.room, ['--checks']);
    check('Q9 a malformed never-do list is reported with its fix, then the floor sentence', () => {
      assert.equal(bad.status, 0);
      const lines = String(bad.stdout).trim().split('\n');
      const nd = lines.filter((l) => l.indexOf('Never-do list:') === 0);
      assert.equal(nd.length, 1);
      assert.equal(nd[0], 'Never-do list: could not be read (.mindrian/never-do.json). '
        + 'Until it is fixed, every unattended step in this room stops. ' + roomConstraints.FLOOR_SENTENCE);
      assert.equal(lines[lines.length - 1], CLOSING);
    });

    // Q10: never pushed. The normal status shows none of it.
    const plain = runStatus(room2.room, []);
    const plainText = String(plain.stdout);
    check('Q10 /mos:status without --checks prints no standing label and no never-do line', () => {
      assert.equal(plain.status, 0);
      for (const id of navigation.STANDING_IDS) {
        assert.ok(plainText.indexOf(navigation.STANDING_WORDS[id].label) === -1, id);
      }
      assert.ok(plainText.indexOf(navigation.HELD_WORDS.label) === -1);
      assert.ok(plainText.indexOf('Never-do list') === -1);
      assert.ok(plainText.indexOf(CLOSING) === -1);
    });
  } finally {
    fx.cleanup(room2);
  }

  // Q11: the argument docs and the mirror.
  check('Q11 status.md documents --checks and its mirror matches (argument-hint and Arguments only)', () => {
    const md = fs.readFileSync(path.join(REPO_ROOT, 'commands', 'status.md'), 'utf8');
    assert.ok(/^argument-hint: "\[section\] \[--stale-only\] \[--checks\]"$/m.test(md));
    assert.ok(/^- `--checks` -- .*nothing is scored\.$/m.test(md));
    assert.ok((md.match(/checks/g) || []).length >= 2);
    const m = spawnSync(process.execPath, [path.join(REPO_ROOT, 'scripts', 'build-skill-mirrors.cjs'), '--check'],
      { encoding: 'utf8', timeout: 120000 });
    assert.equal(m.status, 0, String(m.stdout).slice(-200));
    const dash = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']');
    assert.ok(!dash.test(md.split('--checks')[1] || ''));
  });

  check('Q6 the one-week acceptance test exits 0', () => {
    const r = spawnSync(process.execPath, [path.join(REPO_ROOT, 'tests', 'test-365-acceptance-one-week.cjs')],
      { encoding: 'utf8', timeout: 120000 });
    assert.equal(r.status, 0, String(r.stdout).split('\n').filter((l) => /RED-365|FAIL/.test(l)).join('|'));
  });

  check('no network attempted', () => { assert.equal(net.attempts(), 0); });
  net.restore();
  if (failures > 0) return 1;
  process.stdout.write('PASS: test-365-portrait\n');
  return 0;
}

main().then((c) => { process.exitCode = c; }, (e) => {
  process.stdout.write('UNCAUGHT: ' + String((e && e.stack) || e) + '\n');
  process.exitCode = 1;
});
