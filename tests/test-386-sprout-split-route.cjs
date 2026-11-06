#!/usr/bin/env node
'use strict';

/**
 * Phase 386 plan 42 (E-SPROUT-DESIGN): the context-based split route.
 *
 * Owner direction of 2026-11-06: a bare block does not work. A body or a short
 * private claim is split into typed claims (the way /mos:file-meeting does), the
 * room claims stay local as proposed claims, only generic sprouts go to the
 * Brain, and the answer is assembled locally.
 *
 * Arms SR1 to SR8 and SR5b. Fixture room.db, synthetic strings only, fake
 * credentials built at run time, a stubbed fetch that captures every request.
 * No network, no real room. Node built-ins only. No em dash, no en dash.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const MODULE_PATH = path.join(REPO, 'lib', 'core', 'part8-split-route.cjs');
const RCA_PATH = (require('node:fs').existsSync(path.join(REPO, '.planning', 'debug', 'part8-no-split-route-for-bodies-and-private-claims.md')) ? path.join(REPO, '.planning', 'debug', 'part8-no-split-route-for-bodies-and-private-claims.md') : path.join(REPO, '.planning', 'debug', 'resolved', 'part8-no-split-route-for-bodies-and-private-claims.md'));

// Isolation first: a temporary HOME, no bound room, a stub endpoint.
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'mos386-42-'));
process.env.HOME = TMP;
delete process.env.CLAUDE_ACTIVE_ROOM;
process.env.MINDRIAN_BRAIN_URL = 'http://brain-stub.invalid';
process.env.MINDRIAN_BRAIN_KEY = 'test-key-not-real-386-42';
process.env.MINDRIAN_BRAIN_RETRY_BASE_MS = '1';

// ---------------------------------------------------------------------------
// Fetch stub: captures url, headers and body of every request.
// ---------------------------------------------------------------------------
const wire = [];
let answerCounter = 0;
function resetWire() { wire.length = 0; }
globalThis.fetch = async function stubFetch(url, init) {
  const body = init && typeof init.body === 'string' ? init.body : '';
  wire.push({ url: String(url), headers: JSON.stringify((init && init.headers) || {}), body: body });
  let method = '';
  try { method = JSON.parse(body).method; } catch (_e) { method = ''; }
  if (method === 'initialize') {
    return { ok: true, status: 200, headers: new Map(), text: async () => '', arrayBuffer: async () => new ArrayBuffer(0) };
  }
  answerCounter += 1;
  const payload = { jsonrpc: '2.0', id: 2, result: { content: [{ type: 'text', text: JSON.stringify({ answer: 'STUB-ANSWER-' + answerCounter + ' framework guidance' }) }] } };
  return {
    ok: true,
    status: 200,
    headers: new Map(),
    text: async () => 'event: message\ndata: ' + JSON.stringify(payload) + '\n',
    arrayBuffer: async () => new ArrayBuffer(0),
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function normWords(s) {
  return String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().split(' ').filter(Boolean);
}
function hasRun(haystackText, needleText, n) {
  const h = normWords(haystackText);
  const nd = normWords(needleText);
  if (nd.length < n) return false;
  const hs = ' ' + h.join(' ') + ' ';
  for (let i = 0; i + n <= nd.length; i += 1) {
    if (hs.indexOf(' ' + nd.slice(i, i + n).join(' ') + ' ') !== -1) return true;
  }
  return false;
}
function wireText() {
  return wire.map((w) => w.url + ' ' + w.headers + ' ' + w.body).join('\n');
}
function readRoute() {
  const txt = fs.readFileSync(RCA_PATH, 'utf8');
  const m = txt.match(/^sprout_route: (.+)$/m);
  if (!m) throw new Error('RCA has no sprout_route line');
  return m[1].trim();
}
function openFixtureDb() {
  const dir = fs.mkdtempSync(path.join(TMP, 'room-'));
  const roomDb = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
  const db = roomDb.openRoomDb(dir, { allowExtension: true });
  return { db: db, close: () => roomDb.closeRoomDb(db) };
}
function claimRows(db) {
  return db.prepare("SELECT id, review_status, properties FROM nodes WHERE type = 'claim'").all();
}

const guard = require(path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs'));

// The synthetic private paragraph and the composer double (the stand-in for
// the host model: it splits the paragraph into typed claims and picks sprouts).
const PIECES = [
  ['fact', 'Larkspur depots cut chiller downtime by forty percent after the retrofit'],
  ['causal', 'The solar cold locker retrofit reduced chiller downtime in the northern depots'],
  ['heuristic', 'Raise the pilot price only after a full trial season'],
  ['assumption', 'Belnex clinics will accept a higher pilot price'],
  ['anomaly_cue', 'Orvash deliveries slipped during the second trial week'],
];
const PARAGRAPH = 'Mirela Thornquist of Quillfern Labs reported that ' + PIECES.map((p) => p[1]).join('. ') + '.';
function composerDouble(_paragraph) {
  return {
    claims: PIECES.map((p) => ({ knowledge_type: p[0], text: p[1] })),
    sprouts: ['Design Thinking', 'ill-defined problem framework chain', 'wicked problem discovery stage', 'swot analysis'],
  };
}

// ---------------------------------------------------------------------------
// Arms
// ---------------------------------------------------------------------------
const arms = [];
function arm(label, fn) { arms.push({ label: label, fn: fn }); }
const DASH_RE = new RegExp('[' + String.fromCharCode(0x2013, 0x2014) + ']');
function check(cond, msg) { if (!cond) throw new Error(msg); }

arm('SR1', async () => {
  const m = require(MODULE_PATH);
  const route = readRoute();
  check(m.SPROUTS_REQUIRED === 'sprouts_required', 'SPROUTS_REQUIRED');
  check(m.ROUTE === route, 'ROUTE must equal the RCA sprout_route line (' + route + '), got ' + m.ROUTE);
  check(Array.isArray(m.CLAIM_TYPES) && m.CLAIM_TYPES.length === 6, 'CLAIM_TYPES holds 6');
  check(Array.isArray(m.SPLIT_GUIDE) && m.SPLIT_GUIDE.length === 5 && Object.isFrozen(m.SPLIT_GUIDE), 'SPLIT_GUIDE frozen array of 5');
  m.SPLIT_GUIDE.forEach((l, i) => check(typeof l === 'string' && l.indexOf(String(i + 1) + '.') === 0, 'guide line ' + (i + 1) + ' starts with its number'));
  const msg = m.refusalMessage();
  check(typeof msg === 'string', 'refusalMessage returns a string');
  ['sprouts_required', 'Nothing was sent', 'claim_write', route, 'at most 12 words'].forEach((w) => check(msg.indexOf(w) !== -1, 'message holds ' + w));
  ['fact', 'causal', 'heuristic', 'anomaly_cue', 'mental_model', 'assumption'].forEach((t) => check(msg.indexOf(t) !== -1, 'message holds claim type ' + t));
  m.CLAIM_TYPES.forEach((t) => check(msg.indexOf(t) !== -1, 'message names the real claim type ' + t));
  check(Buffer.byteLength(msg, 'utf8') <= 1200, 'message is at most 1200 bytes');
  check(!DASH_RE.test(msg), 'message holds no dash character');
  const r = m.sproutsRequiredResult('brain_ask');
  check(r.error === 'egress_blocked' && r.tool === 'brain_ask', 'sentinel error and tool');
  check(r.egress_class === 'sprouts_required' && r.outcome === 'sprouts_required', 'sentinel class and outcome');
  check(r.route === route, 'sentinel route');
  check(JSON.stringify(r.split_guide) === JSON.stringify(m.SPLIT_GUIDE), 'sentinel split_guide');
  check(r.message === msg, 'sentinel message equals refusalMessage()');
});

arm('SR2', async () => {
  const m = require(MODULE_PATH);
  const marker = 'MARKER386SECRETPAYLOAD';
  const a = JSON.stringify(m.sproutsRequiredResult('brain_ask', { question: marker }));
  const b = String(m.refusalMessage(marker));
  check(a.indexOf(marker) === -1, 'sentinel must not hold the payload');
  check(b.indexOf(marker) === -1, 'message must not hold the payload');
});

arm('SR3', async () => {
  const m = require(MODULE_PATH);
  const good = m.validateSprouts(['ill-defined problem framework chain', 'Design Thinking', 'wicked problem discovery stage'], { classify: guard.classify });
  check(good && good.ok === true && good.rejected.length === 0, 'good sprouts pass: ' + JSON.stringify(good));
  const credential = ['sk', 'ant', 'api03', 'ZXCVBNMASDFGHJKLQWERTYUIOP1234567890abcd'].join('-');
  const email = 'jane.doe' + String.fromCharCode(64) + 'example.com';
  const thirteen = 'one two three four five six seven eight nine ten eleven twelve thirteen';
  const firstPerson = 'we plan to raise our pricing';
  const bad = [thirteen, firstPerson, credential, email];
  const res = m.validateSprouts(bad, { classify: guard.classify });
  check(res && res.ok === false && res.rejected.length === 4, 'all 4 rejected: ' + JSON.stringify(res));
  check(res.rejected[0].index === 0 && res.rejected[0].class === 'not_sprout', '13 words is not_sprout');
  check(res.rejected[1].index === 1 && res.rejected[1].class === 'not_sprout', 'first person is not_sprout');
  const credClass = guard.classify({ question: credential }, { toolName: 'brain_ask', roomDir: null }).class;
  check(res.rejected[2].index === 2 && res.rejected[2].class === credClass, 'credential class is the guard class ' + credClass);
  const mailClass = guard.classify({ question: email }, { toolName: 'brain_ask', roomDir: null }).class;
  check(res.rejected[3].index === 3 && res.rejected[3].class === mailClass, 'email class is the guard class ' + mailClass);
  const dump = JSON.stringify(res);
  bad.forEach((t) => check(dump.indexOf(t) === -1, 'result never holds a rejected text'));
});

arm('SR4', async () => {
  const m = require(MODULE_PATH);
  const f = openFixtureDb();
  try {
    const claims = PIECES.map((p) => ({ knowledge_type: p[0], text: p[1] }));
    const out = m.fileClaimsLocal(f.db, claims, { sessionId: 's386-42' });
    check(out && out.ok === true && out.ids.length === 5, 'five claims filed: ' + JSON.stringify(out));
    const rows = claimRows(f.db);
    check(rows.length === 5, 'five claim rows');
    rows.forEach((r) => check(r.review_status === 'proposed', 'review_status proposed'));
    const props = rows.map((r) => JSON.parse(r.properties));
    PIECES.forEach((p) => check(props.some((q) => q.text === p[1] && q.knowledge_type === p[0]), 'claim text and type read back: ' + p[0]));
    const before = claimRows(f.db).length;
    const bad = m.fileClaimsLocal(f.db, [{ knowledge_type: 'fact', text: 'Another claim text here' }, { knowledge_type: 'hypothesis', text: 'Bad type claim' }], { sessionId: 's386-42b' });
    check(bad && bad.ok === false && typeof bad.reason === 'string' && bad.reason.length > 0, 'a bad type is refused with a typed reason');
    check(claimRows(f.db).length === before, 'nothing written when one claim is invalid');
  } finally {
    f.close();
  }
});

arm('SR5', async () => {
  const m = require(MODULE_PATH);
  const f = openFixtureDb();
  try {
    check(normWords(PARAGRAPH).length >= 40, 'fixture paragraph has 40 or more words');
    const composed = composerDouble(PARAGRAPH);
    resetWire();
    const out = await m.runSplitRoute({ db: f.db, claims: composed.claims, sprouts: composed.sprouts, classify: guard.classify });
    check(out && out.ok === true, 'route ok: ' + JSON.stringify(out && out.rejected));
    check(wire.length > 0, 'the stub saw at least one request');
    const captured = wireText();
    composed.claims.forEach((c) => {
      check(captured.indexOf(c.text) === -1, 'no claim text on the wire');
      check(!hasRun(captured, c.text, 4), 'no run of 4 words of a claim on the wire');
    });
    check(!hasRun(captured, PARAGRAPH, 4), 'no run of 4 words of the paragraph on the wire');
    check(claimRows(f.db).length === 5, 'five claims in the db');
    claimRows(f.db).forEach((r) => check(r.review_status === 'proposed', 'claims are proposed'));
    check(out.answers.length === composed.sprouts.length, 'one answer per sprout');
    check(/STUB-ANSWER-\d+/.test(out.assembled.text), 'assembled answer holds the stub answer');
    composed.claims.forEach((c) => check(out.assembled.text.indexOf(c.text) !== -1, 'assembled answer holds every local claim'));
  } finally {
    f.close();
  }
});

arm('SR5b', async () => {
  const m = require(MODULE_PATH);
  const f = openFixtureDb();
  try {
    const claims = PIECES.map((p) => ({ knowledge_type: p[0], text: p[1] })).concat([{ knowledge_type: 'assumption', text: 'Prices will rise' }]);
    // A run of 4 words of a claim, lower case, changed punctuation.
    const leakRun = 'larkspur depots, cut: chiller downtime!';
    // A whole claim of 3 words.
    const leakWhole = 'prices will rise';
    check(m.sharesClaimRun(leakRun, claims, 4) === true, 'sharesClaimRun finds the 4 word run');
    check(m.sharesClaimRun(leakWhole, claims, 4) === true, 'sharesClaimRun finds a whole short claim');
    // Only 3 words in a row.
    const threeOnly = 'larkspur depots cut grain storage';
    check(m.sharesClaimRun(threeOnly, claims, 4) === false, 'a 3 word run passes the run check');
    resetWire();
    const res = await m.runSplitRoute({ db: f.db, claims: claims, sprouts: ['Design Thinking', leakRun, leakWhole], classify: guard.classify });
    check(res && res.ok === false, 'leaking route is refused');
    const idx = res.rejected.map((r) => r.index).sort();
    check(JSON.stringify(idx) === JSON.stringify([1, 2]), 'rejected indexes 1 and 2, got ' + JSON.stringify(res.rejected));
    res.rejected.forEach((r) => check(r.class === 'not_sprout', 'class not_sprout'));
    check(wire.length === 0, 'fetch count 0');
    check(claimRows(f.db).length === 0, '0 claims filed');
    resetWire();
    const okRes = await m.runSplitRoute({ db: f.db, claims: claims, sprouts: [threeOnly], classify: guard.classify });
    check(okRes && okRes.ok === true, '3 word overlap passes: ' + JSON.stringify(okRes && okRes.rejected));
  } finally {
    f.close();
  }
});

arm('SR6', async () => {
  const m = require(MODULE_PATH);
  const f = openFixtureDb();
  try {
    const composed = composerDouble(PARAGRAPH);
    resetWire();
    const res = await m.runSplitRoute({ db: f.db, claims: composed.claims, sprouts: ['Design Thinking', 'we plan to raise our pricing'], classify: guard.classify });
    check(res && res.ok === false && Array.isArray(res.rejected) && res.rejected.length === 1 && res.rejected[0].index === 1, 'one sprout rejected: ' + JSON.stringify(res));
    check(wire.length === 0, 'fetch count 0');
    check(claimRows(f.db).length === 0, '0 claims filed');
  } finally {
    f.close();
  }
});

arm('SR7', async () => {
  const src = fs.readFileSync(MODULE_PATH, 'utf8');
  check(!/\bfetch\s*\(/.test(src), 'no fetch call in the source');
  check(!/require\(\s*['"](?:node:)?(?:http|https|net|tls|dgram|http2)['"]\s*\)/.test(src), 'no network module required');
  const builtins = new Set(require('node:module').builtinModules);
  const topRequires = src.split('\n').filter((l) => /^(?:const|let|var)\s.*=\s*require\(/.test(l));
  topRequires.forEach((l) => {
    const m = l.match(/require\(\s*['"]([^'"]+)['"]\s*\)/);
    const name = m ? m[1].replace(/^node:/, '') : '';
    check(builtins.has(name), 'top level require must be a Node built-in: ' + l);
  });
  check(!DASH_RE.test(src), 'no dash character in the source');
  const m = require(MODULE_PATH);
  const junk = [undefined, null, 5, {}, [], 'x'];
  const fns = ['sproutsRequiredResult', 'refusalMessage', 'validateSprouts', 'sharesClaimRun', 'fileClaimsLocal', 'assembleLocal'];
  fns.forEach((fn) => {
    junk.forEach((a) => {
      try { m[fn](a, a, a); } catch (e) { throw new Error(fn + ' threw on ' + String(a) + ': ' + e.message); }
    });
  });
  for (const a of junk) {
    try { await m.runSplitRoute(a); } catch (e) { throw new Error('runSplitRoute threw on ' + String(a) + ': ' + e.message); }
  }
});

arm('SR8', async () => {
  const m = require(MODULE_PATH);
  const tc = require(path.join(REPO, 'lib', 'core', 'navigation', 'typed-claim.cjs'));
  const a = Array.from(m.CLAIM_TYPES).sort().join(',');
  const b = Array.from(tc.KNOWLEDGE_TYPES).sort().join(',');
  check(a === b, 'CLAIM_TYPES equals KNOWLEDGE_TYPES: ' + a + ' vs ' + b);
});

(async () => {
  let failed = 0;
  for (const a of arms) {
    try {
      await a.fn();
      process.stdout.write('ok - ' + a.label + '\n');
    } catch (e) {
      failed += 1;
      process.stdout.write('FAIL - ' + a.label + ': ' + String(e && e.message ? e.message : e).split('\n')[0] + '\n');
    }
  }
  process.stdout.write(failed === 0 ? 'ALL PASS\n' : failed + ' arm(s) failed\n');
  process.exit(failed === 0 ? 0 : 1);
})();
