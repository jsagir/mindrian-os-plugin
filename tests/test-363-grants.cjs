'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 363 Plan 09 -- research grants. Legs G1-G11.
 *
 * Plain node:assert, zero deps. No em-dash or en-dash characters in this file.
 * Exit 0 pass, 1 fail, 77 skip.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const hygiene = require('./helpers/hygiene-355.cjs');
hygiene.scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
const guard = hygiene.installNetGuard();
const { check, summary } = hygiene.makeChecker('363-09 grants');

const ROOT = path.resolve(__dirname, '..');
const GRANTS_FILE = path.join(ROOT, 'lib', 'core', 'research-planner', 'grants.cjs');
const FAMILIES_FILE = path.join(ROOT, 'lib', 'core', 'research-planner', 'families.cjs');

let G = null;
let FAM = null;
let loadError = null;
try {
  FAM = require(FAMILIES_FILE);
  G = require(GRANTS_FILE);
} catch (e) {
  loadError = e;
}

const assert = require('node:assert/strict');
const MIN = 60 * 1000;
const DAY = 24 * 60 * MIN;
const NOW = Date.parse('2026-09-29T12:00:00.000Z');
const VIA = { surface: 'cli', decision_node_id: 'dn-363-test' };
const WS = { term: 'acoustic biofilm disruption', synonyms: ['sonic biofilm removal', 'ultrasonic biofilm control'] };

function leg(name, fn) {
  try {
    if (loadError) throw new Error('module load failed: ' + String(loadError.message).slice(0, 120));
    fn();
    check(name, true);
  } catch (e) {
    check(name, false, String(e && e.message ? e.message : e).slice(0, 220));
  }
}

const rooms = [];
function mkRoom(tag) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'g363-' + (tag || 'r') + '-'));
  rooms.push(d);
  return d;
}
function wsQueries(slots, round) {
  const r = FAM.composeFamily('whitespace-gap/v1', slots || WS, { round: round || 1 });
  assert.equal(r.ok, true, 'composeFamily failed: ' + JSON.stringify(r));
  return r.queries;
}
function standing(roomDir, terms, opts) {
  const p = G.buildStandingProposal(roomDir, { terms: terms || [{ term: WS.term, synonyms: WS.synonyms }], now: (opts && opts.now) || NOW });
  const w = G.writeGrant(roomDir, p, { approved_via: VIA, now: (opts && opts.now) || NOW });
  assert.equal(w.ok, true, 'writeGrant failed: ' + JSON.stringify(w));
  return w.grant;
}
function qObj(q, extra) {
  return Object.assign({
    q: q.q, q_hash: q.q_hash, template_id: q.template_id, family: q.family, provider: 'openalex',
    audit: 'pass', slot_terms: q.slot_terms || [], round: 1, trigger: 'navigator',
  }, extra || {});
}
function state(roomDir, extra) {
  return Object.assign({ room_id: G.roomIdFor(roomDir), now: NOW + MIN, searches_used: 0, round: 1, runs_in_window: 0 }, extra || {});
}

leg('G1 writeGrant then readGrants round-trips; a fresh child reads the same grant', function () {
  const room = mkRoom('g1');
  const g = standing(room);
  assert.match(g.grant_id, /^g-[0-9a-f]{8}$/);
  assert.equal(g.lifetime, 'standing');
  assert.equal(g.policy_version, G.CURRENT_POLICY);
  assert.equal(g.revoked_at, null);
  assert.deepEqual(g.providers, ['openalex']);
  assert.deepEqual(g.families, ['whitespace-gap/v1']);
  const read = G.readGrants(room);
  assert.equal(read.grants.length, 1);
  assert.equal(read.grants[0].grant_id, g.grant_id);
  assert.equal(read.quarantined, false);
  const code = "const G=require(" + JSON.stringify(GRANTS_FILE) + ");const r=G.readGrants(" + JSON.stringify(room) + ");process.stdout.write(JSON.stringify(r.grants.map(function(x){return x.grant_id;})));";
  const child = spawnSync(process.execPath, ['-e', code], { encoding: 'utf8' });
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout), [g.grant_id]);
  assert.equal(fs.existsSync(path.join(room, '.mindrian', 'research-grants.json')), true);
});

leg('G2 each re-ask reason fires alone, and the fixed order holds when two apply', function () {
  const room = mkRoom('g2');
  const g = standing(room);
  const q = wsQueries()[0];
  const st = state(room);
  assert.deepEqual(G.validateExecutedQuery(qObj(q), g, st), { ok: true });
  assert.equal(G.validateExecutedQuery(qObj(q), null, st).reason, 'no_grant');
  assert.equal(G.validateExecutedQuery(qObj(q), g, state(room, { room_id: 'other:abc' })).reason, 'room_mismatch');
  assert.equal(G.validateExecutedQuery(qObj(q), Object.assign({}, g, { revoked_at: new Date(NOW).toISOString() }), st).reason, 'grant_revoked');
  assert.equal(G.validateExecutedQuery(qObj(q), g, state(room, { now: NOW + 31 * DAY })).reason, 'grant_expired');
  assert.equal(G.validateExecutedQuery(qObj(q), Object.assign({}, g, { policy_version: 'old/0' }), st).reason, 'grant_reversioned');
  assert.equal(G.validateExecutedQuery(qObj(q, { provider: 'crossref' }), g, st).reason, 'provider_not_in_policy');
  assert.equal(G.validateExecutedQuery(qObj(q, { family: 'concept-evidence/v1', template_id: 'ce.exact' }), g, st).reason, 'outside_family');
  assert.equal(G.validateExecutedQuery(qObj(q, { audit: 'tripped' }), g, st).reason, 'audit_tripped');
  assert.equal(G.validateExecutedQuery(qObj(q, { slot_terms: ['brand new term'] }), g, st).reason, 'new_term');
  assert.equal(G.validateExecutedQuery(qObj(q), g, state(room, { searches_used: g.caps.max_searches })).reason, 'cap_exceeded');
  assert.equal(G.validateExecutedQuery(qObj(q, { round: 2 }), g, state(room, { round: 2 })).reason, 'multi_step');
  // order: expired + outside family -> grant_expired; revoked + expired -> grant_revoked
  assert.equal(G.validateExecutedQuery(qObj(q, { family: 'concept-evidence/v1', template_id: 'ce.exact' }), g, state(room, { now: NOW + 31 * DAY })).reason, 'grant_expired');
  assert.equal(G.validateExecutedQuery(qObj(q), Object.assign({}, g, { revoked_at: new Date(NOW).toISOString() }), state(room, { now: NOW + 31 * DAY })).reason, 'grant_revoked');
  assert.deepEqual(G.REASK_REASONS, ['no_grant', 'room_mismatch', 'grant_revoked', 'grant_expired', 'grant_reversioned', 'provider_not_in_policy', 'outside_family', 'audit_tripped', 'new_term', 'hash_not_approved', 'cap_exceeded', 'throttle_exceeded', 'multi_step']);
});

leg('G3 new term asks once; extendTerms records approval, same query then passes, version increments', function () {
  const room = mkRoom('g3');
  const g = standing(room);
  const qs = wsQueries({ term: 'quantum dot thermal sensing', synonyms: ['qd thermometry'] });
  const q = qs[0];
  assert.equal(G.validateExecutedQuery(qObj(q), g, state(room)).reason, 'new_term');
  const terms = FAM.slotTerms(qs);
  const ext = G.extendTerms(room, g.grant_id, [{ term: 'quantum dot thermal sensing', synonyms: ['qd thermometry'] }], VIA, { now: NOW });
  assert.equal(ext.ok, true, JSON.stringify(ext));
  assert.equal(ext.grant.version, g.version + 1);
  const fresh = G.findActiveGrant(room, { now: NOW + MIN });
  assert.ok(fresh, 'active grant found');
  assert.equal(fresh.version, g.version + 1);
  assert.deepEqual(G.validateExecutedQuery(qObj(q), fresh, state(room)), { ok: true });
  assert.ok(terms.length >= 1);
  assert.equal(fresh.approved_terms.length, 2);
  assert.equal(fresh.approved_terms[1].approved_via.surface, 'cli');
});

leg('G4 run grant rejects an unapproved round-one hash and accepts round-two in-family within cap', function () {
  const room = mkRoom('g4');
  const qs = wsQueries();
  const plan = {
    run_id: 'r-363-g4', mode: 'deep',
    budget: { max_searches: 16, queries_per_round: 2, results_per_query: 5, time_budget_ms: 20 * MIN },
    leaves: [{ queries: qs.map(function (x) { return Object.assign({ round: 1 }, x); }) }],
  };
  const p = G.buildRunGrant(plan, { now: NOW });
  assert.equal(p.lifetime, 'run');
  assert.equal(p.run_id, 'r-363-g4');
  const w = G.writeGrant(room, p, { approved_via: VIA, now: NOW });
  assert.equal(w.ok, true, JSON.stringify(w));
  const g = w.grant;
  assert.ok(g.approved_hashes.indexOf(qs[0].q_hash) !== -1);
  assert.deepEqual(G.validateExecutedQuery(qObj(qs[0]), g, state(room)), { ok: true });
  const other = wsQueries({ term: 'some other unapproved subject', synonyms: ['unapproved synonym'] })[0];
  assert.equal(G.validateExecutedQuery(qObj(other), g, state(room)).reason, 'hash_not_approved');
  const r2 = qObj(other, { round: 2 });
  assert.deepEqual(G.validateExecutedQuery(r2, g, state(room, { round: 2, searches_used: 3 })), { ok: true });
  assert.equal(G.validateExecutedQuery(r2, g, state(room, { round: 2, searches_used: 16 })).reason, 'cap_exceeded');
});

leg('G5 standing round 2 is multi_step; searches at cap is cap_exceeded', function () {
  const room = mkRoom('g5');
  const g = standing(room);
  const q = wsQueries()[0];
  assert.equal(G.validateExecutedQuery(qObj(q, { round: 2 }), g, state(room, { round: 2 })).reason, 'multi_step');
  assert.equal(G.validateExecutedQuery(qObj(q), g, state(room, { searches_used: 3 })).reason, 'cap_exceeded');
  assert.equal(G.validateExecutedQuery(qObj(q), g, state(room, { searches_used: 2 })).ok, true);
});

leg('G6 throttle: two ambient runs in an hour exceed; passes after the hour', function () {
  const room = mkRoom('g6');
  const g = standing(room);
  const q = wsQueries()[0];
  assert.equal(G.throttleState(room, { now: NOW }).exceeded, false);
  assert.equal(G.throttleState(room, { now: NOW }).allowed_next, true);
  G.recordRun(room, { run_id: 'r1', mode: 'quick', trigger: 'ambient', now: NOW });
  const one = G.throttleState(room, { now: NOW + MIN });
  assert.equal(one.count, 1);
  assert.equal(one.allowed_next, false);
  assert.equal(one.exceeded, false);
  G.recordRun(room, { run_id: 'r2', mode: 'quick', trigger: 'ambient', now: NOW + 2 * MIN });
  const two = G.throttleState(room, { now: NOW + 3 * MIN });
  assert.equal(two.exceeded, true);
  const led = G.readRunLedger(room);
  assert.equal(led.schema, 'mos.research-run-ledger/1');
  assert.equal(led.runs.length, 2);
  assert.ok(Array.isArray(led.pending_cards));
  const inWin = two.count;
  assert.equal(G.validateExecutedQuery(qObj(q, { trigger: 'ambient' }), g, state(room, { now: NOW + 3 * MIN, runs_in_window: inWin })).reason, 'throttle_exceeded');
  const later = G.throttleState(room, { now: NOW + 61 * MIN });
  assert.equal(later.count, 0);
  assert.equal(G.validateExecutedQuery(qObj(q, { trigger: 'ambient' }), g, state(room, { now: NOW + 61 * MIN, runs_in_window: later.count })).ok, true);
  // a navigator-started query is never throttled
  assert.equal(G.validateExecutedQuery(qObj(q, { trigger: 'navigator' }), g, state(room, { runs_in_window: 5 })).ok, true);
});

leg('G7 expiry edge: 30 days minus a minute passes; plus a minute fails', function () {
  const room = mkRoom('g7');
  const g = standing(room);
  assert.equal(G.GRANT_EXPIRY_DAYS, 30);
  assert.equal(G.RESEARCH_RUNS_PER_HOUR, 1);
  assert.equal(g.expires_at, new Date(NOW + 30 * DAY).toISOString());
  const q = wsQueries()[0];
  assert.equal(G.validateExecutedQuery(qObj(q), g, state(room, { now: NOW + 30 * DAY - MIN })).ok, true);
  assert.equal(G.validateExecutedQuery(qObj(q), g, state(room, { now: NOW + 30 * DAY + MIN })).reason, 'grant_expired');
  assert.equal(G.findActiveGrant(room, { now: NOW + 30 * DAY + MIN }), null);
});

leg('G8 revokeGrant makes later queries grant_revoked; a foreign policy is grant_reversioned', function () {
  const room = mkRoom('g8');
  const g = standing(room);
  const q = wsQueries()[0];
  const rv = G.revokeGrant(room, g.grant_id, { now: NOW + MIN });
  assert.equal(rv.ok, true);
  const stored = G.readGrants(room).grants[0];
  assert.equal(typeof stored.revoked_at, 'string');
  assert.equal(G.validateExecutedQuery(qObj(q), stored, state(room)).reason, 'grant_revoked');
  assert.equal(G.findActiveGrant(room, { now: NOW + 2 * MIN }), null);
  const g2 = Object.assign({}, g, { revoked_at: null, policy_version: 'drp363-grant/0' });
  assert.equal(G.validateExecutedQuery(qObj(q), g2, state(room)).reason, 'grant_reversioned');
  assert.equal(G.revokeGrant(room, 'g-00000000', { now: NOW }).ok, false);
});

leg('G9 writeGrant refuses out-of-scope standing, filing keys; room_mismatch across rooms', function () {
  const room = mkRoom('g9');
  const p = G.buildStandingProposal(room, { terms: [{ term: WS.term, synonyms: WS.synonyms }], now: NOW });
  const wide = Object.assign({}, p, { families: ['whitespace-gap/v1', 'concept-evidence/v1'] });
  assert.equal(G.writeGrant(room, wide, { approved_via: VIA, now: NOW }).reason, 'standing_scope_exceeded');
  const prov = Object.assign({}, p, { providers: ['openalex', 'crossref'] });
  assert.equal(G.writeGrant(room, prov, { approved_via: VIA, now: NOW }).reason, 'standing_scope_exceeded');
  ['file', 'filing', 'file_on_approve'].forEach(function (k) {
    const bad = Object.assign({}, p);
    bad[k] = true;
    assert.equal(G.writeGrant(room, bad, { approved_via: VIA, now: NOW }).reason, 'grant_never_authorizes_filing', k);
    const nested = Object.assign({}, p, { caps: Object.assign({}, p.caps) });
    nested.caps[k] = true;
    assert.equal(G.writeGrant(room, nested, { approved_via: VIA, now: NOW }).reason, 'grant_never_authorizes_filing', 'nested ' + k);
  });
  assert.equal(G.writeGrant(room, p, {}).ok, false, 'no approved_via means no write');
  assert.equal(G.readGrants(room).grants.length, 0);
  const roomA = mkRoom('g9a');
  const roomB = mkRoom('g9b');
  const g = standing(roomA);
  const q = wsQueries()[0];
  assert.equal(G.validateExecutedQuery(qObj(q), g, state(roomB)).reason, 'room_mismatch');
  assert.notEqual(G.roomIdFor(roomA), G.roomIdFor(roomB));
});

leg('G10 a corrupt grants file is quarantined and readGrants never throws', function () {
  const room = mkRoom('g10');
  fs.mkdirSync(path.join(room, '.mindrian'), { recursive: true });
  fs.writeFileSync(path.join(room, '.mindrian', 'research-grants.json'), '{not json', 'utf8');
  const r = G.readGrants(room, { now: NOW });
  assert.deepEqual(r.grants, []);
  assert.equal(r.quarantined, true);
  const names = fs.readdirSync(path.join(room, '.mindrian'));
  assert.ok(names.some(function (n) { return /^research-grants\.json\..*\.corrupt$/.test(n); }), names.join(','));
  assert.equal(G.findActiveGrant(room, { now: NOW }), null);
  // run ledger corrupt too
  fs.writeFileSync(path.join(room, '.mindrian', 'research-run-ledger.json'), '][', 'utf8');
  const l = G.readRunLedger(room, { now: NOW });
  assert.equal(l.runs.length, 0);
  assert.equal(l.quarantined, true);
});

leg('G11 grantCard is an F.0 card with three options and a complete plain body', function () {
  const room = mkRoom('g11');
  const p = G.buildStandingProposal(room, { terms: [{ term: WS.term, synonyms: WS.synonyms }], now: NOW });
  const card = G.grantCard(p, { newTerms: [WS.term, 'sonic biofilm removal'], now: NOW });
  assert.equal(card.shape, 'F.0');
  assert.ok(card.options.length <= 3 && card.options.length === 3);
  assert.deepEqual(card.options.map(function (o) { return o.label; }), ['Approve this standing grant (Recommended)', 'Approve this one run only', 'Not now']);
  const b = card.body_md;
  ['openalex', 'fallback', 'whitespace-gap/v1', 'ws.exact', 'per hour', 'drp363-grant/1', 'revoke', WS.term, 'sonic biofilm removal', 'fetching only', 'filing still asks'].forEach(function (s) {
    assert.ok(b.toLowerCase().indexOf(s.toLowerCase()) !== -1, 'body missing: ' + s);
  });
  assert.ok(b.indexOf('2026-10-29') !== -1, 'expiry date shown');
  assert.equal(/[—–]/.test(JSON.stringify(card)), false);
  assert.equal(/great|excellent/i.test(b), false);
});

leg('G12 static: grants.cjs does no network I/O and isRawQueryEdit is reused, not copied', function () {
  const src = fs.readFileSync(GRANTS_FILE, 'utf8');
  assert.equal(/fetch\(|https?:\/\/|require\('node:https?'\)|require\('https?'\)/.test(src), false);
  assert.equal(/[—–]/.test(src), false);
  assert.match(src, /^const GRANT_EXPIRY_DAYS = 30;/m);
  assert.match(src, /^const RESEARCH_RUNS_PER_HOUR = 1;/m);
  assert.equal(typeof G.isRawQueryEdit, 'undefined');
});

leg('G13 no fetch attempted by any leg', function () {
  assert.equal(guard.attempts(), 0);
});

rooms.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ignore */ } });
process.exit(summary());
