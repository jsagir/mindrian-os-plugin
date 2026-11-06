#!/usr/bin/env node
'use strict';

/**
 * Phase 386 plan 33 (E-OVER): the context-based outcomes and the retried room
 * database read.
 *
 * Owner decision option-e (plans 386-26 and 386-32, 2026-11-06), owner
 * acknowledgement recorded in the plan 386-32 RCA. A clear sprout passes; a
 * credential, an email, a phone-like or SSN-like number, an artifact-style
 * identifier and a room-lexicon term always block with their own class; a body,
 * an edge that fails a prose rule and a sprout that holds a private-claim marker
 * are answered with the class sprouts_required (verdict block, no input word in
 * the reason). A failed room.db read is not cached.
 *
 * Arms: OB1 to OB3 (ordinary sprouts), OBP1 to OBP3 (protective counter
 * examples), OBS1 to OBS7, OBE1, OBE2, OBM1, OBM2, OBL1, OBN1, OBN2, OBA1, OBC1,
 * OBX, OBU1 to OBU6, OBK1.
 *
 * Synthetic strings only. Fake secrets are built at run time. No network, no
 * real room. Node built-ins only. No em dash, no en dash.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos386-33-'));
process.env.HOME = path.join(TMP, 'home');
process.env.USERPROFILE = process.env.HOME;
fs.mkdirSync(process.env.HOME, { recursive: true });
process.env.MINDRIAN_ROOMS_HOME = path.join(TMP, 'registry');
fs.mkdirSync(process.env.MINDRIAN_ROOMS_HOME, { recursive: true });
delete process.env.CLAUDE_ACTIVE_ROOM;
let fetchCalls = 0;
globalThis.fetch = function noNetwork() { fetchCalls += 1; throw new Error('network is not allowed'); };

const guard = require(path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs'));
const lexMod = require(path.join(REPO, 'lib', 'core', 'part8-room-lexicon.cjs'));
const split = require(path.join(REPO, 'lib', 'core', 'part8-split-route.cjs'));
const helper = require(path.join(__dirname, 'helpers', 'synthetic-room-db.cjs'));
const corpus = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', '3692', 'guard-survey-corpus.json'), 'utf8'));

const P32 = (require('node:fs').existsSync(path.join(REPO, '.planning', 'debug', 'part8-over-blocks-ordinary-theo-and-context-questions.md')) ? path.join(REPO, '.planning', 'debug', 'part8-over-blocks-ordinary-theo-and-context-questions.md') : path.join(REPO, '.planning', 'debug', 'resolved', 'part8-over-blocks-ordinary-theo-and-context-questions.md'));
const P37 = (require('node:fs').existsSync(path.join(REPO, '.planning', 'debug', 'part8-no-shape-test-for-sprouts-and-bodies.md')) ? path.join(REPO, '.planning', 'debug', 'part8-no-shape-test-for-sprouts-and-bodies.md') : path.join(REPO, '.planning', 'debug', 'resolved', 'part8-no-shape-test-for-sprouts-and-bodies.md'));
const BASELINE = path.join(__dirname, 'fixtures', '3692', 'guard-survey-baseline.json');

const SR = 'sprouts_required';
const IS_ROOT = typeof process.getuid === 'function' && process.getuid() === 0;

function verdict(q, dir, tool) {
  return guard.classify({ question: q }, { toolName: tool || 'brain_ask', roomDir: dir === undefined ? null : dir });
}
function tag(r) { return r.verdict + ' ' + r.class + (r.token_class ? '/' + r.token_class : ''); }
function check(cond, msg) { if (!cond) throw new Error(msg); }
function line(file, key) {
  const m = fs.readFileSync(file, 'utf8').match(new RegExp('^' + key + ': (.+)$', 'm'));
  return m ? m[1].trim() : null;
}
function ids(v) { return (v === null || v === 'none') ? [] : v.split(',').map((s) => s.trim()).filter(Boolean).sort(); }
function setEq(a, b) { return JSON.stringify(a.slice().sort()) === JSON.stringify(b.slice().sort()); }
function isSR(r, token) {
  return r.verdict === 'block' && r.class === SR && (token === undefined || r.token_class === token);
}
function isAllow(r) { return r.verdict === 'allow'; }

// Fixture rooms.
const roomDirs = {};
function room(name) {
  if (!roomDirs[name]) {
    const dir = path.join(TMP, 'rooms', name);
    helper.buildRoom(dir, name);
    roomDirs[name] = dir;
  }
  return roomDirs[name];
}

// Synthetic strings (fake secrets built at run time).
const FAKE_KEY = 'sk-' + 'proj-' + 'abcdefghij0123456789ABCDEF';
const FAKE_EMAIL = 'orla.venn' + '@' + 'fennick-demo.example';
const FAKE_PHONE = ['415', '555', '0134'].join('-');
const FAKE_SSN = ['123', '45', '6789'].join('-');
const FAKE_ID = 'MOS2026' + 'X7';

const results = {}; // sprouts_required results for OBC1
const arms = [];
function arm(label, fn) { arms.push({ label: label, fn: fn }); }

const ORDINARY_DENY = [
  'what is a runway in the lean startup method',
  'what does ARR measure in a SaaS metrics framework',
  'how long should a standup meeting run in scrum',
  'how should I structure a meeting with stakeholders',
  'how did Tel Aviv become a hub in innovation studies',
  'what is a Series A in venture funding terms',
  'how do you read a burn rate chart',
  'what makes 3x growth hard to sustain',
  'what does a $5 price mean in unit economics',
  'what is the Acme Corp case in strategy teaching',
  'how is 2M users different from 20K users in a market model',
];
const ORDINARY_NAMES = [
  'What did Christensen say about disruption',
  'Ask Larry about the Data Room',
  'how does the plan change after a review in March',
  'how do startups in Berlin pick a framework',
  'how did Shopify choose a pricing framework',
  'how should Thessaly Gripper design a test',
];

arm('OB1', async () => {
  ORDINARY_DENY.forEach((q) => { const r = verdict(q); check(isAllow(r), 'OB1: ordinary deny-list sprout must be allow, got ' + tag(r) + ' for ' + JSON.stringify(q)); });
});
arm('OB2', async () => {
  ORDINARY_NAMES.forEach((q) => { const r = verdict(q); check(isAllow(r), 'OB2: ordinary name sprout must be allow, got ' + tag(r) + ' for ' + JSON.stringify(q)); });
});
arm('OB3', async () => {
  const q = corpus.negatives.find((n) => n.id === 'X8').q;
  const r = verdict(q);
  check(isAllow(r), 'OB3: the owner-accepted money sprout X8 must be allow, got ' + tag(r));
});

arm('OBP1', async () => {
  // Edges that fail a prose rule get sprouts_required (burn rate with figures, unknown names, money).
  const edges = [
    'Our burn rate is 140K per month against a 900K runway and the board wants a plan before the next review',
    'how should the Thessaly Gripper team plan the pilot with Harbor Quill Partners after the Tuesday kickoff',
    'the board wants a plan because the budget is seven hundred fifty thousand dollars and the pilot ends in March',
  ];
  edges.forEach((q) => { const r = verdict(q); check(isSR(r), 'OBP1: edge must be sprouts_required, got ' + tag(r) + ' for ' + q.slice(0, 40)); });
});
arm('OBP2', async () => {
  ['X1', 'X2', 'X5', 'X9'].forEach((id) => {
    const q = corpus.negatives.find((n) => n.id === id).q;
    const r = verdict(q);
    check(isSR(r), 'OBP2: negative edge ' + id + ' must be sprouts_required, got ' + tag(r));
  });
});
arm('OBP3', async () => {
  const body = 'Our startup pivoted to selling to hospitals last year. My team missed the launch twice. Our investors want a new plan. Which framework fits that move for the next quarter and how should we sequence it?';
  const r = verdict(body);
  check(isSR(r), 'OBP3: statement body must be sprouts_required, got ' + tag(r));
});

arm('OBS1', async () => {
  const q = 'Ilvane Trosk disruption Acme Robotics March runway benchmarks';
  const a = verdict(q);
  check(isAllow(a), 'OBS1: brain_ask sprout must be allow, got ' + tag(a));
  const b = guard.classify({ query: q }, { toolName: 'search', roomDir: null });
  check(isAllow(b), 'OBS1: typed freeform tool sprout must be allow, got ' + tag(b));
});
arm('OBS2', async () => {
  const q = 'Ilvane Trosk wrote about disruption. Acme Robotics shipped in March. The runway grew longer after the pilot.';
  const r = verdict(q);
  check(isSR(r), 'OBS2: body must be sprouts_required, got ' + tag(r));
  results.OBS2 = { r: r, q: q };
});
arm('OBS2b', async () => {
  const q = 'The pilot ran for three weeks. The team liked the interface a lot. The next step is a wider trial with more users.';
  const r = verdict(q);
  check(isSR(r), 'OBS2b: plain body must be sprouts_required, got ' + tag(r));
  results.OBS2b = { r: r, q: q };
});

// The five pairs pinned from the live guard (planning time: content_set with no
// token class for the four shapes, room_content/identifier for the identifier).
const PAIRS = {
  credential: { class: 'content_set', token: null },
  email: { class: 'content_set', token: null },
  phone: { class: 'content_set', token: null },
  ssn: { class: 'content_set', token: null },
  identifier: { class: 'room_content', token: 'identifier' },
};
function pairArm(label, kind, q) {
  arm(label, async () => {
    const r = verdict(q);
    const want = PAIRS[kind];
    check(r.verdict === 'block', label + ': must block, got ' + tag(r));
    check(r.class !== SR, label + ': a ' + kind + ' must never be sprouts_required');
    check(r.class === want.class && (r.token_class || null) === want.token, label + ': pair ' + kind + ' is ' + want.class + '/' + want.token + ', got ' + tag(r));
  });
}
pairArm('OBS3', 'credential', 'which framework fits ' + FAKE_KEY + ' pricing');
pairArm('OBS4', 'email', 'which framework should ' + FAKE_EMAIL + ' use for pricing');
pairArm('OBS5', 'phone', 'call ' + FAKE_PHONE + ' about swot');
pairArm('OBS6', 'ssn', 'which framework fits ' + FAKE_SSN + ' pricing');
pairArm('OBS7', 'identifier', 'what framework applies to artifact ' + FAKE_ID + ' in the pricing section');

arm('OBE1', async () => {
  const q = 'how should the Thessaly Gripper team plan the pilot with Harbor Quill Partners after the Tuesday kickoff';
  const r = verdict(q);
  check(isSR(r), 'OBE1: edge with an invented name must be sprouts_required, got ' + tag(r));
  results.OBE1 = { r: r, q: q };
});
arm('OBE2', async () => {
  const q = 'what frameworks feed into the reverse salient framework for a wicked problem at the scoping stage';
  const r = verdict(q);
  check(isAllow(r), 'OBE2: an edge that passes every prose rule must be allow, got ' + tag(r));
});
arm('OBM1', async () => {
  const q = 'which framework fits my customers and my pricing';
  const r = verdict(q);
  check(isSR(r), 'OBM1: private possessive sprout must be sprouts_required, got ' + tag(r));
  results.OBM1 = { r: r, q: q };
});
arm('OBM2', async () => {
  const q = 'this is confidential: which framework tests the riskiest assumption';
  const r = verdict(q);
  check(isSR(r), 'OBM2: private word sprout must be sprouts_required, got ' + tag(r));
  results.OBM2 = { r: r, q: q };
});
arm('OBL1', async () => {
  const dir = room('gate-lexgen');
  lexMod._resetLexiconCache();
  const r = verdict('which framework fits Quillfern Labs', dir);
  check(r.verdict === 'block' && r.class === 'room_content' && r.token_class === 'room_term', 'OBL1: room term must block as room_content/room_term, got ' + tag(r));
  check(r.class !== SR, 'OBL1: never sprouts_required');
});

arm('OBN1', async () => {
  const sproutIds = ids(line(P37, 'negatives_sprout_ids'));
  const dir = room('gate-scaffold');
  corpus.negatives.forEach((n) => {
    if (sproutIds.indexOf(n.id) !== -1) return;
    [null, dir].forEach((d) => {
      lexMod._resetLexiconCache();
      const r = verdict(n.q, d);
      check(r.verdict === 'block', 'OBN1: negative ' + n.id + ' must be refused, got ' + tag(r));
    });
  });
});
arm('OBN2', async () => {
  const a = ids(line(P37, 'negatives_sprout_ids'));
  const always = ids(line(P32, 'negatives_sprout_always_block_ids'));
  const splitIds = ids(line(P32, 'negatives_sprout_split_ids'));
  const accepted = a.filter((x) => always.indexOf(x) === -1 && splitIds.indexOf(x) === -1);
  const allowed = [];
  corpus.negatives.forEach((n) => {
    const r = verdict(n.q);
    if (r.verdict !== 'block') allowed.push(n.id);
    if (always.indexOf(n.id) !== -1) check(r.verdict === 'block' && r.class !== SR, 'OBN2: always-block ' + n.id + ' must block with its own class, got ' + tag(r));
    if (splitIds.indexOf(n.id) !== -1) check(isSR(r), 'OBN2: split id ' + n.id + ' must be sprouts_required, got ' + tag(r));
  });
  check(setEq(allowed, accepted), 'OBN2: allowed negatives ' + JSON.stringify(allowed.sort()) + ' must equal the accepted set ' + JSON.stringify(accepted));
});
arm('OBA1', async () => {
  const a = ids(line(P32, 'negatives_sprout_ids'));
  const b = ids(line(P37, 'negatives_sprout_ids'));
  check(setEq(a, b), 'OBA1: the 2 negatives_sprout_ids lines must be equal');
  const always = ids(line(P32, 'negatives_sprout_always_block_ids'));
  const splitIds = ids(line(P32, 'negatives_sprout_split_ids'));
  const want = a.filter((x) => always.indexOf(x) === -1 && splitIds.indexOf(x) === -1);
  const bl = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const have = Array.isArray(bl.accepted_sprout_negatives) ? bl.accepted_sprout_negatives : [];
  check(setEq(have, want), 'OBA1: baseline accepted_sprout_negatives ' + JSON.stringify(have) + ' must equal ' + JSON.stringify(want));
});
arm('OBC1', async () => {
  const keys = Object.keys(results).filter((k) => isSR(results[k].r));
  check(keys.length > 0, 'OBC1: at least one sprouts_required result must exist');
  keys.forEach((k) => {
    const r = results[k].r;
    check(['body_shape', 'edge_rule', 'private_marker'].indexOf(r.token_class) !== -1, 'OBC1: ' + k + ' token_class is ' + r.token_class);
    const words = results[k].q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 5);
    const reason = String(r.reason).toLowerCase();
    words.forEach((w) => check(reason.indexOf(w) === -1, 'OBC1: ' + k + ' reason holds the input word ' + w));
    check(JSON.stringify(r).indexOf(results[k].q.slice(0, 20)) === -1, 'OBC1: ' + k + ' result echoes the input');
  });
});
arm('OBX', async () => {
  check(split.SPROUTS_REQUIRED === SR, 'OBX: class string equals SPROUTS_REQUIRED');
});

// ---- unreadable room.db ----------------------------------------------------
function withUnreadableDb(name, fn) {
  const dir = path.join(TMP, 'unread-' + name);
  helper.buildRoom(dir, 'gate-lexgen');
  const dbFile = path.join(dir, '.mindrian', 'room.db');
  const mode = fs.statSync(dbFile).mode & 0o777;
  lexMod._resetLexiconCache();
  fs.chmodSync(dbFile, 0);
  try { return fn(dir, dbFile, mode); } finally { try { fs.chmodSync(dbFile, mode); } catch (_e) { /* best effort */ } lexMod._resetLexiconCache(); }
}
function rootSkip(label) { process.stdout.write('SKIP - ' + label + ' (running as root)\n'); }

arm('OBU1', async () => {
  if (IS_ROOT) return rootSkip('OBU1');
  withUnreadableDb('u1', (dir, dbFile, mode) => {
    const a = lexMod.loadRoomLexicon(dir);
    check(a.ok === false, 'OBU1: unreadable db must return ok false first');
    fs.chmodSync(dbFile, mode);
    const b = lexMod.loadRoomLexicon(dir);
    check(b.ok === true, 'OBU1: after the mode is restored (cache not reset) the read must succeed, got ok=' + b.ok);
  });
});
arm('OBU2', async () => {
  const dir = room('gate-claims');
  lexMod._resetLexiconCache();
  const a = lexMod.loadRoomLexicon(dir);
  const b = lexMod.loadRoomLexicon(dir); // the first read can change the wal stat, so the key settles on the second call
  const c = lexMod.loadRoomLexicon(dir);
  check(a.ok === true && b.ok === true && b === c, 'OBU2: a successful read is cached (same object returned once the key settles)');
});
arm('OBU3', async () => {
  if (IS_ROOT) return rootSkip('OBU3');
  withUnreadableDb('u3', (dir) => {
    const r = verdict('which framework fits a pricing test', dir);
    check(isAllow(r) && r.class === 'room_check_skipped', 'OBU3: sprout with an unreadable db must be allow/room_check_skipped, got ' + tag(r));
  });
});
arm('OBU4', async () => {
  if (IS_ROOT) return rootSkip('OBU4');
  withUnreadableDb('u4', (dir) => {
    const body = 'The pilot ran for three weeks. The team liked the interface a lot. The next step is a wider trial with more users.';
    const edge = 'how should the Thessaly Gripper team plan the pilot with Harbor Quill Partners after the Tuesday kickoff';
    [body, edge].forEach((q) => {
      lexMod._resetLexiconCache();
      const r = verdict(q, dir);
      check(isSR(r, 'room_check_unavailable'), 'OBU4: body or edge with an unreadable db must be sprouts_required/room_check_unavailable, got ' + tag(r));
      check(/room check could not run/i.test(String(r.reason)), 'OBU4: reason must say the room check could not run, got ' + JSON.stringify(r.reason));
    });
  });
});
arm('OBU5', async () => {
  if (IS_ROOT) return rootSkip('OBU5');
  withUnreadableDb('u5', (dir) => {
    const r = verdict('which framework fits ' + FAKE_KEY + ' pricing', dir);
    check(r.verdict === 'block' && r.class === 'content_set', 'OBU5: credential with an unreadable db must block as content_set, got ' + tag(r));
  });
});
arm('OBU6', async () => {
  if (IS_ROOT) return rootSkip('OBU6');
  withUnreadableDb('u6', (dir) => {
    const r = verdict('which framework fits Quillfern Labs', dir);
    process.stdout.write('EXPOSURE - OBU6: ' + tag(r) + ' (a sprout with a room-lexicon word, room.db unreadable; acknowledged by the owner)\n');
    check(isAllow(r) && r.class === 'room_check_skipped', 'OBU6: sprout with a lexicon word and an unreadable db must be allow/room_check_skipped, got ' + tag(r));
  });
});
arm('OBK1', async () => {
  const a = ids(line(P37, 'negatives_sprout_ids'));
  const always = ids(line(P32, 'negatives_sprout_always_block_ids'));
  const splitIds = ids(line(P32, 'negatives_sprout_split_ids'));
  const want = a.filter((x) => always.indexOf(x) === -1 && splitIds.indexOf(x) === -1);
  check(line(P32, 'owner_ack') === 'yes', 'OBK1: owner_ack must be yes');
  const ack = ids(line(P32, 'owner_ack_ids'));
  const allowed = corpus.negatives.filter((n) => verdict(n.q).verdict !== 'block').map((n) => n.id);
  const probeAck = ids(line(P32, 'owner_ack_probe_ids'));
  const splitProbe = ids(line(P32, 'split_probe_ids'));
  const L = require(path.join(__dirname, 'helpers', 'audit-probe-loader.cjs'));
  const probeIds = ids(line(P32, 'probe_private_sprout_ids'));
  const probes = L.loadProbes().corpora.filter((c) => probeIds.indexOf(c.key) !== -1);
  const leaving = probes.filter((c) => verdict(c.q).verdict !== 'block').map((c) => c.key);
  // The acknowledged lines must agree (exact). What leaves must be inside the
  // acknowledged set (subset here; exact equality is arms OBN2 and OBK2).
  const subset = (x, y) => x.every((i) => y.indexOf(i) !== -1);
  const ok = setEq(ack, want) && subset(allowed, ack) && subset(leaving, probeAck) && setEq(probeIds, probeAck.concat(splitProbe));
  check(ok, 'NEW ACK NEEDED: acknowledged ' + JSON.stringify(ack) + ' + probes ' + JSON.stringify(probeAck) + ', measured negatives ' + JSON.stringify(allowed) + ' + probes ' + JSON.stringify(leaving));
});
arm('OBK2', async () => {
  // Exact: the probe sprouts that leave as written are exactly the acknowledged ones.
  const probeAck = ids(line(P32, 'owner_ack_probe_ids'));
  const L = require(path.join(__dirname, 'helpers', 'audit-probe-loader.cjs'));
  const probeIds = ids(line(P32, 'probe_private_sprout_ids'));
  const leaving = L.loadProbes().corpora.filter((c) => probeIds.indexOf(c.key) !== -1 && verdict(c.q).verdict !== 'block').map((c) => c.key);
  check(setEq(leaving, probeAck), 'NEW ACK NEEDED: measured leaving probes ' + JSON.stringify(leaving.sort()) + ' differ from the acknowledged ' + JSON.stringify(probeAck));
});

(async function main() {
  const DASH = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
  let failed = 0;
  const only = process.argv[2] || null;
  for (let i = 0; i < arms.length; i += 1) {
    if (only && only !== arms[i].label) continue;
    try {
      await arms[i].fn();
      process.stdout.write('ok - ' + arms[i].label + '\n');
    } catch (e) {
      failed += 1;
      process.stdout.write('FAIL - ' + arms[i].label + ': ' + (e && e.message ? e.message : String(e)) + '\n');
    }
  }
  if (DASH.test(fs.readFileSync(__filename, 'utf8'))) { failed += 1; process.stdout.write('FAIL - dash: this file holds a dash character\n'); }
  if (fetchCalls !== 0) { failed += 1; process.stdout.write('FAIL - net: fetch calls ' + fetchCalls + '\n'); }
  try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(failed === 0 ? 0 : 1);
})();
