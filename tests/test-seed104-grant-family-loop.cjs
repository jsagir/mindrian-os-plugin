'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 261002-0n4 -- SEED-104 regression: the research grant family loop,
 * egress-safe terms, and the grant_scope_cannot_cover_plan loop guard.
 *
 *   S0      whitespace golden (byte-identical proposal, card, grant, queries)
 *   S1-S6   unit legs (families term gate, grants scope, scopeGain)
 *   S7-S9   core legs (loop guard, stale prose plan, re-approval widening)
 *   E1-E5   end-to-end through the research_run and gate_answer MCP tools
 *
 * No live network: the hygiene net guard is installed before any repo module is
 * required, and the final leg asserts it counted zero attempts. Temp HOME and
 * MINDRIAN_ROOMS_HOME; never touches a real room.
 *
 * `node tests/test-seed104-grant-family-loop.cjs --capture` writes the golden
 * fixture (tests/fixtures/seed104/whitespace-golden.json) and exits 0.
 *
 * No em-dash or en-dash literals: spelled with String.fromCharCode where needed.
 * Exit 0 pass, 1 fail.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos104-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos104-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

const ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(__dirname, 'helpers', 'hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;
const guard = hygiene.installNetGuard();
const NET_GUARD_FETCH = globalThis.fetch;
const { check, summary } = hygiene.makeChecker('SEED-104 grant family loop');

const assert = require('node:assert/strict');
const { buildRoom363 } = require(path.join(__dirname, 'helpers', 'fixture-room-363.cjs'));
const { makeReplayFetch } = require(path.join(__dirname, 'helpers', 'openalex-replay-363.cjs'));

const RP = path.join(ROOT, 'lib', 'core', 'research-planner');
const planner = require(path.join(RP, 'planner.cjs'));
const quick = require(path.join(RP, 'quick.cjs'));
const grants = require(path.join(RP, 'grants.cjs'));
const families = require(path.join(RP, 'families.cjs'));
const planMod = require(path.join(RP, 'plan.cjs'));
const Q = require(path.join(RP, 'question-templates.cjs'));

const QS_DIR = path.join(ROOT, 'tests', 'fixtures', '363-question-sets');
function qsFile(name) { return JSON.parse(fs.readFileSync(path.join(QS_DIR, name + '.json'), 'utf8')); }
const GOLDEN_FILE = path.join(ROOT, 'tests', 'fixtures', 'seed104', 'whitespace-golden.json');

const NOW = Date.parse('2026-10-02T00:00:00.000Z');
const VIA = { surface: 'cli', decision_node_id: 'dn-104-test' };
const PROSE = '**Claim.** A stable emulsion';

const rooms = [];
function newRoom(role) {
  const r = buildRoom363({ role: role || 'founder' });
  rooms.push(r);
  return r;
}

// ---------------------------------------------------------------------------
// S0 -- the whitespace snapshot (captured on the unedited tree)
// ---------------------------------------------------------------------------
function whitespaceSnapshot() {
  const room = newRoom('founder');
  const roomDir = room.roomDir;
  const built = planner.buildPlan(roomDir, qsFile('whitespace-quick'), { mode: 'quick', now: new Date(NOW) });
  assert.equal(built.ok, true, JSON.stringify(built).slice(0, 300));
  const loaded = planner.loadPlan(roomDir, built.run_id);
  assert.equal(loaded.ok, true);
  const plan = loaded.plan;

  const queries = [];
  plan.leaves.forEach(function (leaf) {
    (leaf.queries || []).forEach(function (q) {
      queries.push({ leaf: leaf.id, template_id: q.template_id, family: q.family, q: q.q, q_hash: q.q_hash, slot_terms: q.slot_terms });
    });
  });

  const cover = quick.coverFor(roomDir, plan, { now: NOW });
  const card = planner.cardFor(roomDir, plan, { now: NOW });
  const approved = planner.approveStandingGrant(roomDir, cover.proposal, { approvedVia: 'cli', terms: cover.new_terms });
  assert.equal(approved.ok, true, JSON.stringify(approved).slice(0, 300));
  const grant = JSON.parse(JSON.stringify(approved.grant));
  grant.grant_id = '<volatile>';
  grant.approved_at = '<volatile>';
  grant.expires_at = '<volatile>';
  grant.approved_via.decision_node_id = '<volatile>';
  grant.approved_terms.forEach(function (t) {
    t.approved_at = '<volatile>';
    t.approved_via.decision_node_id = '<volatile>';
  });
  const g11 = grants.grantCard(
    grants.buildStandingProposal(roomDir, { terms: [{ term: 'thin-film sensors', synonyms: ['dielectric probes'] }] }),
    { newTerms: ['thin-film sensors'], now: NOW }
  );

  const snap = {
    queries: queries,
    cover: { covered: cover.covered, reason: cover.reason, new_terms: cover.new_terms, proposal: cover.proposal, card: cover.card },
    card_for: { next: card.next, reason: card.reason },
    grant: grant,
    g11_card: g11,
  };
  const text = JSON.stringify(snap, null, 2).split(grants.roomIdFor(roomDir)).join('<room_id>');
  return JSON.parse(text);
}

if (process.argv.indexOf('--capture') !== -1) {
  fs.mkdirSync(path.dirname(GOLDEN_FILE), { recursive: true });
  fs.writeFileSync(GOLDEN_FILE, JSON.stringify(whitespaceSnapshot(), null, 2) + '\n', 'utf8');
  console.log('captured ' + path.relative(ROOT, GOLDEN_FILE));
  process.exit(0);
}

async function leg(name, fn) {
  try {
    await fn();
    check(name, true);
  } catch (e) {
    check(name, false, String((e && e.message) || e).slice(0, 260));
  }
}

async function main() {
  await leg('S0 whitespace proposal, card, grant and queries are byte-identical to the golden', function () {
    const golden = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
    assert.deepEqual(whitespaceSnapshot(), golden);
  });

  // -- S1 composer term gate (SEED-104 part 2) ---------------------------------
  await leg('S1 composer refuses prose terms with term_not_composed, no echo; plain overlength stays bad_slot', function () {
    const long = '**Claim.** A stable, flowable emulsion of eutectic gallium-indium EGaIn';
    const r = families.composeForLeaf({ lens: 'eu.transfer', slots: { term: long, term2: 'gallium oxide' } });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'term_not_composed');
    assert.equal(r.degrade, 'local-only');
    const s = JSON.stringify(r);
    assert.equal(s.indexOf('Claim'), -1);
    assert.equal(s.indexOf('flowable'), -1);
    ['1. Tension in the field', 'Claim. A stable emulsion'].forEach(function (t) {
      const x = families.composeForLeaf({ lens: 'eu.transfer', slots: { term: t, term2: 'gallium oxide' } });
      assert.equal(x.reason, 'term_not_composed', t);
    });
    const syn = families.composeFamily('whitespace-gap/v1', { term: 'thin-film sensors', synonyms: ['a `code` span'] });
    assert.equal(syn.reason, 'term_not_composed');
    assert.equal(families.composeFamily('whitespace-gap/v1', { term: 'a'.repeat(81) }).reason, 'bad_slot');
    const ok = families.composeForLeaf({ lens: 'eu.transfer', slots: { term: 'gallium oxide choline chloride deep eutectic solvent', term2: 'liquid metal' } });
    assert.equal(ok.ok, true);
    assert.equal(families.stripMarkdown('**Claim.** A stable'), 'Claim. A stable');
    assert.equal(families.composableTerm('Claim. A stable'), null);
    assert.equal(families.composableTerm('thin-film sensors'), 'thin-film sensors');
    assert.equal(families.composableTerm('a_b snake_case'), 'a_b snake_case');
    ['| x |', '> quote text', '# heading', '- item', '2) item', '_lead word', 'trail_ word', 'a ~~b~~ c'].forEach(function (t) {
      assert.equal(families.proseShaped(t), true, t);
    });
  });

  // -- S2 grant writers refuse prose --------------------------------------------
  await leg('S2 writeGrant and extendTerms refuse prose terms before any write', function () {
    const room = newRoom('founder').roomDir;
    const p = grants.buildStandingProposal(room, { terms: [{ term: PROSE, synonyms: [] }] });
    const w = grants.writeGrant(room, p, { approved_via: VIA, now: NOW });
    assert.equal(w.ok, false);
    assert.equal(w.reason, 'term_not_composed');
    assert.equal(fs.existsSync(path.join(room, '.mindrian', 'research-grants.json')), false);
    const goodP = grants.buildStandingProposal(room, { terms: [{ term: 'thin-film sensors', synonyms: ['dielectric probes'] }] });
    const g = grants.writeGrant(room, goodP, { approved_via: VIA, now: NOW });
    assert.equal(g.ok, true);
    const ext = grants.extendTerms(room, g.grant.grant_id, [{ term: PROSE, synonyms: [] }], VIA, { now: NOW });
    assert.equal(ext.ok, false);
    assert.equal(ext.reason, 'term_not_composed');
    assert.equal(grants.readGrants(room).grants[0].version, 1);
    const ext2 = grants.extendTerms(room, g.grant.grant_id, [{ term: 'fine term', synonyms: ['bad. sentence here'] }], VIA, { now: NOW });
    assert.equal(ext2.reason, 'term_not_composed');
    assert.equal(grants.readGrants(room).grants[0].approved_terms.length, 1);
  });

  // -- S3 planFamilies and the proposal families option -------------------------
  await leg('S3 planFamilies keeps researchable openalex round-1 families in FAMILY_IDS order; proposal families option', function () {
    function ql(family, template) { return { family: family, template_id: template, round: 1, q: 'x', q_hash: 'h' }; }
    const plan = {
      leaves: [
        { id: 'a', researchable: true, corpus: 'openalex', queries: [ql('concept-evidence/v1', 'ce.exact'), ql('whitespace-gap/v1', 'ws.exact')] },
        { id: 'b', researchable: true, corpus: 'room', queries: [ql('diffusion/v1', 'df.adoption')] },
        { id: 'c', researchable: true, corpus: 'openalex', queries: [ql('made-up/v1', 'mu.x'), { family: 'causal-link/v1', template_id: 'cl.link', round: 2 }] },
        { id: 'd', researchable: false, corpus: 'openalex', queries: [ql('constraint-interrogation/v1', 'ci.derivation')] },
      ],
    };
    assert.deepEqual(grants.planFamilies(plan), ['whitespace-gap/v1', 'concept-evidence/v1']);
    assert.deepEqual(grants.planFamilies({ leaves: [] }), []);
    const room = newRoom('founder').roomDir;
    assert.deepEqual(grants.buildStandingProposal(room, { terms: [], families: ['concept-evidence/v1'] }).families, ['concept-evidence/v1']);
    assert.deepEqual(grants.buildStandingProposal(room, { terms: [] }).families, ['whitespace-gap/v1']);
    assert.deepEqual(grants.buildStandingProposal(room, { terms: [], families: ['made-up/v1'] }).families, ['whitespace-gap/v1']);
  });

  // -- S4 extendTerms widening and no-op ----------------------------------------
  await leg('S4 extendTerms widens families with one version bump; the identical call is a no-op', function () {
    const room = newRoom('founder').roomDir;
    const g = grants.writeGrant(room, grants.buildStandingProposal(room, { terms: [{ term: 'thin-film sensors', synonyms: [] }] }), { approved_via: VIA, now: NOW }).grant;
    const a = grants.extendTerms(room, g.grant_id, [], VIA, { now: NOW, families: ['concept-evidence/v1'] });
    assert.equal(a.ok, true, JSON.stringify(a));
    assert.deepEqual(a.grant.families, ['whitespace-gap/v1', 'concept-evidence/v1']);
    assert.equal(a.grant.version, 2);
    const b = grants.extendTerms(room, g.grant_id, [], VIA, { now: NOW, families: ['concept-evidence/v1'] });
    assert.equal(b.ok, true);
    assert.equal(b.unchanged, true);
    assert.equal(b.grant.version, 2);
    assert.equal(grants.readGrants(room).grants[0].version, 2);
    assert.equal(grants.extendTerms(room, g.grant_id, [], VIA, { now: NOW }).reason, 'no_terms');
  });

  // -- S5 scopeGain -------------------------------------------------------------
  await leg('S5 scopeGain names only what approving would add', function () {
    const room = newRoom('founder').roomDir;
    const g = grants.writeGrant(room, grants.buildStandingProposal(room, { terms: [{ term: 'thin-film sensors', synonyms: ['dielectric probes'] }] }), { approved_via: VIA, now: NOW }).grant;
    const ce = grants.buildStandingProposal(room, { terms: [{ term: 'thin-film sensors', synonyms: [] }], families: ['concept-evidence/v1'] });
    const gain = grants.scopeGain(g, ce, []);
    assert.deepEqual(gain.families, ['concept-evidence/v1']);
    assert.deepEqual(gain.providers, []);
    assert.deepEqual(gain.terms, []);
    const same = grants.buildStandingProposal(room, { terms: [{ term: 'Thin-Film Sensors', synonyms: ['dielectric probes'] }] });
    const none = grants.scopeGain(g, same, []);
    assert.deepEqual(none, { families: [], providers: [], terms: [] });
    const more = grants.scopeGain(g, same, ['brand new term', { term: 'thin-film sensors', synonyms: ['new syn'] }]);
    assert.deepEqual(more.terms.sort(), ['brand new term', 'new syn']);
  });

  // -- S6 FAMILY_IDS parity -----------------------------------------------------
  await leg('S6 question-templates FAMILY_IDS equals the families module keys', function () {
    assert.deepEqual(Q.FAMILY_IDS.slice(), Object.keys(families.FAMILIES));
  });

  // -- G9 (rewrite of test-363-grants G9 scope assertions) ----------------------
  await leg('G9b SEED-104 supersedes the Phase 363 D-04 single-family standing scope; bound is FAMILY_IDS', function () {
    const room = newRoom('founder').roomDir;
    const p = grants.buildStandingProposal(room, { terms: [{ term: 'thin-film sensors', synonyms: ['dielectric probes'] }] });
    const wide = Object.assign({}, p, { families: ['whitespace-gap/v1', 'concept-evidence/v1'] });
    const w = grants.writeGrant(room, wide, { approved_via: VIA, now: NOW });
    assert.equal(w.ok, true, JSON.stringify(w));
    assert.deepEqual(w.grant.families, ['whitespace-gap/v1', 'concept-evidence/v1']);
    const room2 = newRoom('founder').roomDir;
    const bad = Object.assign({}, p, { families: ['whitespace-gap/v1', 'made-up/v1'] });
    assert.equal(grants.writeGrant(room2, bad, { approved_via: VIA, now: NOW }).reason, 'unknown_family');
    const prov = Object.assign({}, p, { providers: ['openalex', 'crossref'] });
    assert.equal(grants.writeGrant(room2, prov, { approved_via: VIA, now: NOW }).reason, 'standing_scope_exceeded');
  });

  // LEGS_HERE

  await leg('Z net guard counted zero fetch attempts', function () {
    assert.equal(guard.attempts(), 0);
  });
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* ignore */ } });
  process.exit(summary());
}

main();
