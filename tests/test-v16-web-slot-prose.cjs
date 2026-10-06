'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 261004-v16 -- SEED-115 surgical step (navigator ruling 2026-10-04):
 * on the web search lines a slot may carry a room phrase or a room question; the
 * composed query is sent as written under the run's grant. Canon Part 8 governs
 * the Brain (Theo): a theo corpus leaf keeps the strict term rule.
 *
 *   W1  composableQuery: accepts a question and a phrase, strips markers, caps 200
 *   W2  composeFamily / composeForLeaf on a web destination keep the phrase verbatim
 *   W3  composeForLeaf on a theo corpus leaf still refuses prose (term_not_composed)
 *   W4  grants.writeGrant and extendTerms accept a web-line phrase
 *   W5  a quick plan whose slot is a room question is not refused for term_not_composed
 *   W6  no em-dash or en-dash in the touched files
 *
 * No live network (net guard, zero attempts asserted). Temp HOME and rooms home.
 * Exit 0 pass, 1 fail.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mosv16-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mosv16-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;
const guard = hygiene.installNetGuard();
const { check, summary } = hygiene.makeChecker('v16 web slot prose');

const assert = require('node:assert/strict');
const { buildRoom363 } = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs'));
const { makeReplayFetch } = require(path.join(__dirname, 'helpers', 'openalex-replay-363.cjs'));

const RP = path.join(ROOT, 'lib', 'core', 'research-planner');
const planner = require(path.join(RP, 'planner.cjs'));
const quick = require(path.join(RP, 'quick.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
const families = require(path.join(RP, 'families.cjs'));

const NOW = Date.parse('2026-10-04T00:00:00.000Z');
const VIA = { surface: 'cli', decision_node_id: 'dn-v16-test' };
const QUESTION = 'Which hospitals in Israel procure imaging equipment? How do they pay for it, and who signs off on the purchase?';
const PHRASE = 'MOTJ cold chain losses in rural clinics 2025';
// 369.2-21 (brief reconciliation): PHRASE has 8 words, so it is shaped; SHORT has 4 and stays verbatim and quoted
const SHORT = 'MOTJ cold chain losses';
function shapedTokens(v) { return families.shapeWebPhrase(v).value.split(' '); }
function holdsTokens(q, v) { return shapedTokens(v).every(function (t) { return q.toLowerCase().indexOf(t) !== -1; }); }

const rooms = [];
function newRoom() { const r = buildRoom363({ role: 'founder' }); rooms.push(r); return r; }

async function leg(name, fn) {
  try { await fn(); check(name, true); } catch (e) { check(name, false, String((e && e.message) || e).slice(0, 260)); }
}

async function main() {
  await leg('W1 composableQuery accepts a question and a phrase, strips markers, caps at 200, rejects empty and control chars', function () {
    assert.equal(typeof families.composableQuery, 'function');
    assert.equal(families.composableQuery(QUESTION), QUESTION);
    assert.equal(families.composableQuery(PHRASE), PHRASE);
    assert.equal(families.composableQuery('- **Cold** chain   losses'), 'Cold chain losses');
    assert.equal(families.composableQuery('a'.repeat(200)), 'a'.repeat(200));
    assert.equal(families.composableQuery('a'.repeat(201)), null);
    assert.equal(families.composableQuery('   '), null);
    assert.equal(families.composableQuery(''), null);
    assert.equal(families.composableQuery('bad\u0007char here'), null);
    assert.equal(families.composableQuery(42), null);
    assert.equal(families.SLOT_RULES.query_max_chars, 200);
  });

  // 369.2-21 (brief reconciliation): a sentence is shaped, never quoted whole. A web question composes to its
  // first eight content tokens, unquoted; a short phrase stays verbatim and quoted; no term_not_composed.
  await leg('W2 composeFamily and composeForLeaf on a web destination shape a sentence and keep a short phrase verbatim, no term_not_composed', function () {
    const a = families.composeFamily('concept-evidence/v1', { term: QUESTION });
    assert.equal(a.ok, true, JSON.stringify(a).slice(0, 200));
    assert.ok(a.queries.every(function (q) { return holdsTokens(q.q, QUESTION); }), 'every shaped token is in q');
    assert.ok(a.queries.every(function (q) { return q.q.indexOf(QUESTION) === -1 && q.q.indexOf('"' + shapedTokens(QUESTION)[0]) === -1; }), 'the question is unquoted and not whole');
    const b = families.composeForLeaf({ lens: 'mu.verify', corpus: 'openalex', slots: { term: SHORT } });
    assert.equal(b.ok, true, JSON.stringify(b).slice(0, 200));
    assert.ok(b.queries.length > 0 && b.queries.every(function (q) { return q.q.indexOf('"' + SHORT + '"') !== -1; }));
    const long = families.composeForLeaf({ lens: 'mu.verify', corpus: 'openalex', slots: { term: PHRASE } });
    assert.equal(long.ok, true, JSON.stringify(long).slice(0, 200));
    assert.ok(long.queries.every(function (q) { return holdsTokens(q.q, PHRASE) && q.q.indexOf(PHRASE) === -1; }), 'an 8-word phrase is shaped');
    const c = families.composeForLeaf({ lens: 'mu.verify', slots: { term: '  MOTJ   cold chain  ' } });
    assert.equal(c.ok, true);
    assert.ok(c.queries[0].q.indexOf('MOTJ cold chain') !== -1);
  });

  await leg('W3 composeForLeaf on a theo corpus leaf with a prose slot still refuses term_not_composed', function () {
    const r = families.composeForLeaf({ lens: 'mu.verify', corpus: 'theo', slots: { term: QUESTION } });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'term_not_composed');
    assert.equal(JSON.stringify(r).indexOf('hospitals'), -1);
    const d = families.composeFamily('concept-evidence/v1', { term: QUESTION }, { destination: 'theo' });
    assert.equal(d.reason, 'term_not_composed');
    assert.equal(families.composableTerm(QUESTION), null);
  });

  await leg('W4 writeGrant and extendTerms accept a web-line phrase', function () {
    const room = newRoom().roomDir;
    const p = grants.buildStandingProposal(room, { terms: [{ term: QUESTION, synonyms: [] }] });
    const w = grants.writeGrant(room, p, { approved_via: VIA, now: NOW });
    assert.equal(w.ok, true, JSON.stringify(w).slice(0, 200));
    const ext = grants.extendTerms(room, w.grant.grant_id, [{ term: PHRASE, synonyms: [] }], VIA, { now: NOW });
    assert.equal(ext.ok, true, JSON.stringify(ext).slice(0, 200));
  });

  await leg('W5 a quick run on a plan whose slot is a room question is not refused with term_not_composed', async function () {
    const room = newRoom().roomDir;
    const qs = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'think-hats.json'), 'utf8'));
    qs.leaves.forEach(function (l) { if (l.id === 'L1' || l.id === 'L3') l.slots = { term: QUESTION }; });
    const built = planner.buildPlan(room, qs, { mode: 'quick', now: new Date(NOW) });
    assert.equal(built.ok, true, JSON.stringify(built).slice(0, 200));
    const plan = built.plan;
    const withQ = plan.leaves.filter(function (l) { return (l.queries || []).some(function (q) { return holdsTokens(q.q, QUESTION) && q.q.indexOf(QUESTION) === -1; }); });
    assert.ok(withQ.length > 0, 'the composed query carries the shaped question, not the question whole (369.2-21)');
    const cover = quick.coverFor(room, plan, { now: NOW });
    assert.notEqual(cover.reason, 'term_not_composed');
    const replay = makeReplayFetch({ route: function () { return 'gap_primary_zero'; } });
    const res = await quick.runQuick(room, plan, { fetchEnvelopeFn: replay.fetchEnvelopeFn || replay, now: NOW });
    assert.notEqual(res.reason, 'term_not_composed');
  });

  await leg('W6 no em-dash or en-dash in the touched files', function () {
    const files = ['families.cjs', 'planner.cjs', 'grants.cjs', 'quick.cjs', 'plan.cjs'].map(function (f) { return path.join(RP, f); })
      .concat([__filename]);
    files.forEach(function (f) {
      const s = fs.readFileSync(f, 'utf8');
      assert.equal(new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']').test(s), false, path.basename(f));
    });
  });

  await leg('Z net guard counted zero fetch attempts', function () { assert.equal(guard.attempts(), 0); });
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* ignore */ } });
  process.exit(summary());
}

main();
