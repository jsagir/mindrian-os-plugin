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
 * 369.2-09 (R02, ruling 2026-10-05): one run grant per run on the web lines; standing term grants no longer cover a web send.
 * Golden re-captured 2026-10-05, 369.2-09: run grant, every string listed, SEED-115 and the 2026-10-05 ruling.
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
const corpus = require(path.join(ROOT, 'lib', 'core', 'research-corpus.cjs'));
const roomDb = require(path.join(ROOT, 'lib', 'core', 'room-db.cjs'));
const { insertNode } = require(path.join(ROOT, 'lib', 'core', 'node-insert.cjs'));
const eurekaRecall = require(path.join(RP, 'perspectives', 'eureka-recall.cjs'));
const { registerCoreTools } = require(path.join(ROOT, 'lib', 'mcp', 'register-core-tools.cjs'));

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

// A concept-evidence quick plan: the think-hats set with a term on the white
// hat (ce.exact) and the black hat (ce.counter). Both queries use one term.
const CE_TERM = 'automated slide scanning';
function ceQuestionSet() {
  const qs = qsFile('think-hats');
  qs.leaves.forEach(function (l) { if (l.id === 'L1' || l.id === 'L3') l.slots = { term: CE_TERM }; });
  return qs;
}
function buildCePlan(roomDir) {
  const built = planner.buildPlan(roomDir, ceQuestionSet(), { mode: 'quick', now: new Date(NOW) });
  assert.equal(built.ok, true, JSON.stringify(built).slice(0, 300));
  assert.equal(built.status, 'ready');
  return built.plan;
}
function clonePlan(plan) { return JSON.parse(JSON.stringify(plan)); }
function firstFetchQuery(plan) {
  for (let i = 0; i < plan.leaves.length; i += 1) {
    const l = plan.leaves[i];
    if (l.researchable === true && l.corpus === 'openalex' && Array.isArray(l.queries) && l.queries.length > 0) return l.queries[0];
  }
  return null;
}
// A fetch seam that counts calls and answers from the OpenAlex replay.
function countingSeam(route) {
  const replay = makeReplayFetch({ route: route || function () { return 'gap_primary_zero'; } });
  const st = { calls: 0 };
  const fn = async function (args) {
    st.calls += 1;
    const prev = globalThis.fetch;
    globalThis.fetch = replay;
    try { return await corpus.fetchCorpusEnvelope(args); } finally { globalThis.fetch = prev; }
  };
  fn.state = st;
  return fn;
}

// -- the Eureka room (inline, like test-seed103): two sections, two titled
// artifacts sharing one entity, and two untitled markdown claims whose
// first-sentence "title" is prose. C1 and C2 carry no entity of their own, so no
// clean term exists for them (SEED-104 part 2: they become a local-only leaf).
const C1_TEXT = '**Claim.** A stable, flowable emulsion of eutectic gallium-indium EGaIn microdroplets in a deep eutectic solvent';
const C2_TEXT = '1. **Tension in the field.** Liquid-metal emulsions of gallium-indium microdroplets become conductive only after sintering';
function buildEurekaRoom(opts) {
  const withEntities = !!(opts && opts.withEntities);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos104-eureka-'));
  const roomDir = path.join(root, 'room');
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '---\nname: seed104-fixture\n---\n');
  ['problem-definition', 'market-analysis'].forEach(function (sec) {
    fs.mkdirSync(path.join(roomDir, sec), { recursive: true });
    fs.writeFileSync(path.join(roomDir, sec, 'CONTEXT.md'), '# ' + sec + '\n\nOne job: hold ' + sec + '.\n\n## Inputs\n- none\n\n## Process\n1. read\n\n## Outputs\n- out.md\n\n## Human check\nRead it.\n');
  });
  const db = roomDb.openRoomDb(roomDir);
  function node(id, type, props) { insertNode(db, id, type, JSON.stringify(props), { source_path: 'test:seed104', epistemic_type: 'observation' }); }
  function edge(a, b, type) { db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)').run(a, b, type, '{}'); }
  node('section:problem-definition', 'Section', { slug: 'problem-definition' });
  node('section:market-analysis', 'Section', { slug: 'market-analysis' });
  node('pd/A1', 'Artifact', { title: 'Membrane fouling in desalination intake filters', body: 'Biofilm growth on membrane surfaces raises pressure drop; periodic backwash and coating reduce fouling and extend service life.' });
  node('ma/M1', 'Artifact', { title: 'Surface coating suppliers for filtration membranes', body: 'Suppliers of anti-fouling coating for membrane filters; pricing tiers and biofilm resistance claims.' });
  node('pd/C1', 'claim', { text: C1_TEXT, section: 'problem-definition' });
  node('ma/C2', 'claim', { text: C2_TEXT, section: 'market-analysis' });
  node('ent/coating', 'technology', { name: 'anti-fouling coating' });
  edge('pd/A1', 'section:problem-definition', 'BELONGS_TO');
  edge('ma/M1', 'section:market-analysis', 'BELONGS_TO');
  edge('pd/A1', 'ent/coating', 'DESCRIBES');
  edge('ma/M1', 'ent/coating', 'DESCRIBES');
  if (withEntities) {
    // side-unique entity handles: each claim has one entity no other thing cites
    node('ent/egain', 'technology', { name: 'EGaIn microdroplets' });
    node('ent/sinter', 'technology', { name: 'sintering process' });
    edge('pd/C1', 'ent/egain', 'DESCRIBES');
    edge('ma/C2', 'ent/sinter', 'DESCRIBES');
  }
  roomDb.closeRoomDb(db);
  const room = { roomDir: roomDir, cleanup: function () { try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* ignore */ } } };
  rooms.push(room);
  return room;
}

function bootClient(room) {
  const captured = new Map();
  const stub = {
    tool: function (name, description, schema, handler) { captured.set(name, { handler: handler }); },
    registerTool: function (name, config, handler) { captured.set(name, { handler: handler }); },
  };
  registerCoreTools(stub, { fallbackRoomDir: room.roomDir, pluginRoot: ROOT, surface: 'desktop' });
  const reg = captured.get('research_run');
  const answerReg = captured.get('gate_answer');
  const extra = { sessionId: 'seed104-session' };
  function parse(raw) {
    const text = raw && raw.content && raw.content[0] && raw.content[0].text;
    try { return JSON.parse(text); } catch (_e) { return { _unparsed: String(text).slice(0, 300) }; }
  }
  return {
    call: async function (input) { return parse(await reg.handler(input, extra)); },
    answer: async function (gateId, chosen) { return parse(await answerReg.handler({ gate_id: gateId, chosen: chosen, verdict: 'approve' }, extra)); },
  };
}
async function withReplay(replay, fn) {
  globalThis.fetch = replay;
  try { return await fn(); } finally { globalThis.fetch = NET_GUARD_FETCH; }
}
function readPlanFile(room, runId) {
  const file = path.join(room.roomDir, '.mindrian', 'research-runs', runId, 'plan.json');
  return { file: file, plan: JSON.parse(fs.readFileSync(file, 'utf8')) };
}
function writePlanFile(file, plan) {
  plan.plan_hash = planMod.planHash(plan);
  fs.writeFileSync(file, JSON.stringify(plan, null, 2) + '\n', 'utf8');
}
function activeStanding(room) { return grants.findActiveGrant(room.roomDir, { now: Date.now(), lifetime: 'standing' }); }

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
  // 369.2-09 (R02, ruling 2026-10-05): one run grant per run on the web lines; standing term grants no longer cover a web send: the whitespace run is approved as a run grant
  const approved = planner.approvePlanReview(roomDir, plan.run_id, { approvedVia: 'cli' });
  assert.equal(approved.ok, true, JSON.stringify(approved).slice(0, 300));
  const grant = JSON.parse(JSON.stringify(approved.grant));
  grant.grant_id = '<volatile>';
  grant.approved_at = '<volatile>';
  grant.expires_at = '<volatile>';
  grant.approved_via.decision_node_id = '<volatile>';
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
  const text = JSON.stringify(snap, null, 2).split(grants.roomIdFor(roomDir)).join('<room_id>').split(plan.run_id).join('<run_id>');
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
  await leg('S0 whitespace run proposal, card, run grant and queries are byte-identical to the golden', function () {
    const golden = JSON.parse(fs.readFileSync(GOLDEN_FILE, 'utf8'));
    assert.deepEqual(whitespaceSnapshot(), golden);
  });

  // -- S1 composer term gate (SEED-104 part 2) ---------------------------------
  // MOVED 2026-10-04 (SEED-115, navigator ruling, quick 261004-v16): before, every destination refused
  // prose with term_not_composed. Now a WEB destination composes the phrase as written (markdown
  // stripped); a THEO destination (Canon Part 8, the Brain) still refuses it with no echo.
  await leg('S1 web destination composes room phrases; theo destination refuses prose with term_not_composed, no echo; over-cap stays bad_slot', function () {
    const long = '**Claim.** A stable, flowable emulsion of eutectic gallium-indium EGaIn';
    const w = families.composeForLeaf({ lens: 'eu.transfer', slots: { term: long, term2: 'gallium oxide' } });
    assert.equal(w.ok, true, JSON.stringify(w).slice(0, 200));
    // MOVED 2026-10-06 (369.2-21, brief reconciliation): a sentence-shaped web slot is shaped to its first eight
    // content tokens, never quoted whole; the card shows the shaped string
    const shapedLong = families.shapeWebPhrase(long).value;
    assert.ok(w.queries.every(function (q) { return shapedLong.split(' ').every(function (t) { return q.q.toLowerCase().indexOf(t) !== -1; }); }), shapedLong);
    assert.ok(w.queries.every(function (q) { return q.q.indexOf('Claim. A stable, flowable emulsion of eutectic gallium-indium EGaIn') === -1; }));
    const r = families.composeForLeaf({ lens: 'eu.transfer', corpus: 'theo', slots: { term: long, term2: 'gallium oxide' } });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'term_not_composed');
    assert.equal(r.degrade, 'local-only');
    const s = JSON.stringify(r);
    assert.equal(s.indexOf('Claim'), -1);
    assert.equal(s.indexOf('flowable'), -1);
    ['1. Tension in the field', 'Claim. A stable emulsion'].forEach(function (t) {
      const x = families.composeForLeaf({ lens: 'eu.transfer', corpus: 'theo', slots: { term: t, term2: 'gallium oxide' } });
      assert.equal(x.reason, 'term_not_composed', t);
      assert.equal(families.composeForLeaf({ lens: 'eu.transfer', slots: { term: t, term2: 'gallium oxide' } }).ok, true, t);
    });
    const syn = families.composeFamily('whitespace-gap/v1', { term: 'thin-film sensors', synonyms: ['a `code` span'] }, { destination: 'theo' });
    assert.equal(syn.reason, 'term_not_composed');
    assert.equal(families.composeFamily('whitespace-gap/v1', { term: 'thin-film sensors', synonyms: ['a `code` span'] }).ok, true);
    assert.equal(families.composeFamily('whitespace-gap/v1', { term: 'a'.repeat(81) }, { destination: 'theo' }).reason, 'bad_slot');
    assert.equal(families.composeFamily('whitespace-gap/v1', { term: 'a'.repeat(201) }).reason, 'bad_slot');
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
  // MOVED 2026-10-04 (SEED-115, quick 261004-v16): grant terms are web-line phrases now, so a room
  // phrase or sentence is accepted; an over-cap or control-character value is still refused before any write.
  await leg('S2 writeGrant and extendTerms accept a web phrase; an over-cap or control-character term is refused before any write', function () {
    const room = newRoom('founder').roomDir;
    const bad = grants.buildStandingProposal(room, { terms: [{ term: 'a'.repeat(201), synonyms: [] }] });
    const w0 = grants.writeGrant(room, bad, { approved_via: VIA, now: NOW });
    assert.equal(w0.ok, false);
    assert.equal(w0.reason, 'term_not_composed');
    assert.equal(fs.existsSync(path.join(room, '.mindrian', 'research-grants.json')), false);
    const p = grants.buildStandingProposal(room, { terms: [{ term: PROSE, synonyms: [] }] });
    const w = grants.writeGrant(room, p, { approved_via: VIA, now: NOW });
    assert.equal(w.ok, true, JSON.stringify(w).slice(0, 200));
    const ext = grants.extendTerms(room, w.grant.grant_id, [{ term: 'bad' + String.fromCharCode(7) + ' char', synonyms: [] }], VIA, { now: NOW });
    assert.equal(ext.ok, false);
    assert.equal(ext.reason, 'term_not_composed');
    assert.equal(grants.readGrants(room).grants[0].version, 1);
    const ext2 = grants.extendTerms(room, w.grant.grant_id, [{ term: 'fine term', synonyms: ['b'.repeat(201)] }], VIA, { now: NOW });
    assert.equal(ext2.reason, 'term_not_composed');
    assert.equal(grants.readGrants(room).grants[0].approved_terms.length, 1);
    const ext3 = grants.extendTerms(room, w.grant.grant_id, [{ term: 'fine term', synonyms: ['bad. sentence here'] }], VIA, { now: NOW });
    assert.equal(ext3.ok, true, JSON.stringify(ext3).slice(0, 200));
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

  // -- S7 loop guard, core (SEED-104 part 3) ------------------------------------
  // MOVED 2026-10-05 (369.2-09 (R02, ruling 2026-10-05): one run grant per run on the web lines; standing term grants no longer cover a web send): a standing grant is never a stuck scope for a web plan; the
  // card it gets is the run grant, so grant_scope_cannot_cover_plan is not reachable and nothing is fetched until approval.
  await leg('S7 a standing grant never produces grant_scope_cannot_cover_plan for a web plan; the card offers the run grant; an approved plan runs', async function () {
    const room = newRoom('founder').roomDir;
    const plan = buildCePlan(room);
    const cover = quick.coverFor(room, plan, { now: NOW });
    assert.equal(cover.covered, false);
    assert.equal(cover.reason, 'no_grant');
    assert.equal(cover.proposal.lifetime, 'run');
    assert.deepEqual(cover.proposal.families, ['concept-evidence/v1']);
    const sp = grants.buildStandingProposal(room, { terms: [{ term: CE_TERM, synonyms: [] }], families: ['concept-evidence/v1'] });
    const ap = planner.approveStandingGrant(room, sp, { approvedVia: 'cli', terms: [CE_TERM] });
    assert.equal(ap.ok, true, JSON.stringify(ap));
    assert.ok(ap.grant.families.indexOf('concept-evidence/v1') !== -1);

    const clone = clonePlan(plan);
    const tampered = firstFetchQuery(clone);
    assert.equal(tampered.family, 'concept-evidence/v1');
    tampered.template_id = 'ws.exact';
    const spy = countingSeam();
    const res = await quick.runQuick(room, clone, { fetchEnvelopeFn: spy, now: NOW });
    assert.equal(res.status, 'reask', JSON.stringify(res).slice(0, 300));
    assert.equal(res.reason, 'outside_family');
    assert.ok(res.card && res.proposal && res.proposal.lifetime === 'run', 'the run grant is offered');
    assert.equal(spy.state.calls, 0);
    const cv = quick.coverFor(room, clone, { now: NOW });
    assert.equal(cv.covered, false);
    assert.notEqual(cv.reason, 'grant_scope_cannot_cover_plan');
    assert.equal(cv.proposal.lifetime, 'run');
    const card = planner.cardFor(room, clone, { now: NOW });
    assert.equal(card.next, 'grant');
    assert.ok(card.card, 'a card is offered');

    // the standing grant alone does not cover the untampered plan either: the run grant does
    const noRun = quick.coverFor(room, plan, { now: NOW });
    assert.equal(noRun.reason, 'hash_not_approved');
    assert.equal(planner.approvePlanReview(room, plan.run_id, { approvedVia: 'cli' }).ok, true);
    const okSpy = countingSeam();
    const done = await quick.runQuick(room, plan, { fetchEnvelopeFn: okSpy, now: NOW });
    assert.equal(done.status, 'done', JSON.stringify(done).slice(0, 300));
    assert.ok(okSpy.state.calls > 0);
  });

  // -- S8 stale prose plan -------------------------------------------------------
  // MOVED 2026-10-04 (SEED-115, quick 261004-v16): a stored plan carrying a room phrase is no longer
  // refused term_not_composed; it needs the grant first, the card shows the exact string, and no fetch
  // leaves before approval. proposeGrant accepts a phrase and refuses only an over-cap value.
  await leg('S8 a stored plan carrying a room phrase asks for the grant with the exact string, no fetch; proposeGrant refuses only over-cap', async function () {
    const room = newRoom('founder').roomDir;
    const plan = buildCePlan(room);
    const clone = clonePlan(plan);
    const q = firstFetchQuery(clone);
    q.slot_terms = [PROSE];
    q.q = '"' + PROSE + '"';
    q.q_hash = families.qHash(q.q);
    const spy = countingSeam();
    const res = await quick.runQuick(room, clone, { fetchEnvelopeFn: spy, now: NOW });
    assert.notEqual(res.reason, 'term_not_composed');
    assert.equal(res.status, 'reask');
    assert.equal(spy.state.calls, 0);
    const cv = quick.coverFor(room, clone, { now: NOW });
    assert.equal(cv.covered, false);
    assert.notEqual(cv.reason, 'term_not_composed');
    assert.ok(cv.card && cv.card.payload.queries.indexOf(q.q) !== -1, 'the card carries the exact string');
    assert.ok(cv.card.body_md.indexOf(q.q) !== -1);
    const prop = planner.proposeGrant(room, { terms: ['**Claim.** x y'] });
    assert.equal(prop.ok, true, JSON.stringify(prop).slice(0, 200));
    const over = planner.proposeGrant(room, { terms: ['a'.repeat(201)] });
    assert.equal(over.ok, false);
    assert.equal(over.reason, 'term_not_composed');
  });

  // -- S9 re-approval widening ---------------------------------------------------
  // MOVED 2026-10-05 (369.2-09 (R02, ruling 2026-10-05): one run grant per run on the web lines; standing term grants no longer cover a web send): the widen-once leg runs on the standing door explicitly
  // (the grant propose door); it does not authorize the web run, and a run proposal cannot widen it.
  await leg('S9 the standing door widens families once; the identical call is a no-op; it never authorizes the web run', function () {
    const room = newRoom('founder').roomDir;
    const wsBuilt = planner.buildPlan(room, qsFile('whitespace-quick'), { mode: 'quick', now: new Date(NOW) });
    const wsStanding = grants.buildStandingProposal(room, { terms: [{ term: 'thin-film sensors', synonyms: [] }], families: ['whitespace-gap/v1'] });
    const first = planner.approveStandingGrant(room, wsStanding, { approvedVia: 'cli', terms: ['thin-film sensors'] });
    assert.equal(first.ok, true);
    assert.deepEqual(first.grant.families, ['whitespace-gap/v1']);
    assert.equal(first.grant.version, 1);
    assert.equal(quick.coverFor(room, wsBuilt.plan, { now: NOW }).reason, 'hash_not_approved');

    const cePlan = buildCePlan(room);
    const ceCover = quick.coverFor(room, cePlan, { now: NOW });
    assert.equal(ceCover.reason, 'outside_family');
    assert.ok(ceCover.card, 'a card is offered once');
    assert.equal(ceCover.proposal.lifetime, 'run');
    assert.deepEqual(ceCover.proposal.families, ['concept-evidence/v1']);
    assert.equal(planner.approveStandingGrant(room, ceCover.proposal, { approvedVia: 'cli', terms: [] }).ok, false);
    const ceStanding = grants.buildStandingProposal(room, { terms: [{ term: CE_TERM, synonyms: [] }], families: ['concept-evidence/v1'] });
    const a = planner.approveStandingGrant(room, ceStanding, { approvedVia: 'cli', terms: [CE_TERM] });
    assert.equal(a.ok, true, JSON.stringify(a));
    assert.deepEqual(a.grant.families, ['whitespace-gap/v1', 'concept-evidence/v1']);
    assert.equal(a.grant.version, 2);
    assert.equal(typeof a.decision_node_id, 'string');
    const b = planner.approveStandingGrant(room, ceStanding, { approvedVia: 'cli', terms: [CE_TERM] });
    assert.equal(b.ok, true);
    assert.equal(b.unchanged, true);
    assert.equal(b.grant.version, 2);
    assert.equal(b.decision_node_id, null);
    const after = quick.coverFor(room, cePlan, { now: NOW });
    assert.equal(after.covered, false);
    assert.equal(after.reason, 'hash_not_approved');
  });

  // -- E1 no grant: recall -> grant -> one approval -> done ----------------------
  const E1 = {};
  await leg('E1 eureka_recall, grant_request, one approval, run_quick done; no reask, no prose term', async function () {
    const room = buildEurekaRoom();
    E1.room = room;
    const c = bootClient(room);
    const rec = await c.call({ op: 'eureka_recall', run_tag: 'e1' });
    assert.equal(rec.ok, true, JSON.stringify(rec).slice(0, 300));
    assert.equal(rec.plan.ok, true, JSON.stringify(rec.plan).slice(0, 300));
    assert.equal(rec.plan.next, 'grant');
    E1.runId = rec.plan.run_id;
    E1.tag = rec.run_tag;
    const cands = eurekaRecall.readCandidates(room.roomDir, rec.run_tag).candidates;
    assert.ok(cands.some(function (x) { return /\/C[12]$/.test(x.a) || /\/C[12]$/.test(x.b); }), 'a claim appears in a recalled pair');
    const req = await c.call({ op: 'grant_request', run_id: rec.plan.run_id });
    assert.equal(req.ok, true, JSON.stringify(req).slice(0, 300));
    // 369.2-09 (R02, ruling 2026-10-05): one run grant per run on the web lines; standing term grants no longer cover a web send: the card offers the run only and lists every exact string
    assert.deepEqual(req.card.options.map(function (o) { return o.id; }), ['approve_run', 'not_now']);
    assert.ok(req.card.payload.families.indexOf('concept-evidence/v1') !== -1, 'the payload names concept-evidence/v1');
    assert.ok(req.card.payload.queries.length > 0 && req.card.payload.queries.every(function (q) { return req.card.body_md.indexOf(q) !== -1; }), 'every exact string is on the card');
    const ans = await c.answer(req.gate.gate_id, ['approve_run']);
    assert.equal(ans.ok !== false, true, JSON.stringify(ans).slice(0, 300));
    assert.equal(activeStanding(room), null, 'no standing grant is written');
    const g = grants.findActiveGrant(room.roomDir, { now: Date.now(), lifetime: 'run', run_id: rec.plan.run_id });
    assert.ok(g, 'run grant written');
    assert.ok(g.families.indexOf('concept-evidence/v1') !== -1);
    assert.equal(g.approved_hashes.length, req.card.payload.queries.length);
    const replay = makeReplayFetch({ route: function () { return 'gap_primary_zero'; } });
    E1.replay = replay;
    const run = await withReplay(replay, function () { return c.call({ op: 'run_quick', run_id: rec.plan.run_id }); });
    assert.equal(run.status, 'done', JSON.stringify(run).slice(0, 300));
  });

  // -- E3 no prose reaches a query ------------------------------------------------
  await leg('E3 a claim pair is a local-only leaf; every query and slot term is composable; no prose in any URL', function () {
    assert.ok(E1.runId, 'E1 ran');
    const plan = readPlanFile(E1.room, E1.runId).plan;
    const claimLeaves = plan.leaves.filter(function (l) { return l.pair && (/\/C[12]$/.test(l.pair.a) || /\/C[12]$/.test(l.pair.b)); });
    assert.ok(claimLeaves.length >= 1, 'a leaf pairs a claim');
    claimLeaves.forEach(function (l) {
      assert.equal(l.researchable, false);
      assert.equal(l.corpus, 'room');
    });
    let seen = 0;
    plan.leaves.forEach(function (l) {
      (l.queries || []).forEach(function (q) {
        seen += 1;
        assert.equal(q.q.indexOf('flowable'), -1);
        assert.equal(q.q.indexOf('Tension'), -1);
        (q.slot_terms || []).forEach(function (t) { assert.notEqual(families.composableTerm(t), null, t); });
      });
    });
    assert.ok(seen > 0);
    assert.ok(E1.replay.calls.length > 0);
    E1.replay.calls.forEach(function (call) {
      const u = String(call.url) + ' ' + String(call.q);
      assert.equal(u.indexOf('%2A'), -1);
      assert.equal(u.indexOf('*'), -1);
      assert.equal(u.indexOf('flowable'), -1);
    });
  });

  // -- E2 whitespace-only standing grant -----------------------------------------
  // MOVED 2026-10-05 (369.2-09 (R02, ruling 2026-10-05): one run grant per run on the web lines; standing term grants no longer cover a web send): the standing grant stays as it was (readable, not widened);
  // one approval of the run covers the concept-evidence strings and run_quick is done.
  const E2 = {};
  await leg('E2 a whitespace-only standing grant is not widened; one run approval covers the concept-evidence run; run_quick done', async function () {
    const room = buildEurekaRoom();
    E2.room = room;
    const wsP = grants.buildStandingProposal(room.roomDir, { terms: [{ term: 'thin-film sensors', synonyms: [] }] });
    const wsW = grants.writeGrant(room.roomDir, wsP, { approved_via: VIA });
    assert.equal(wsW.ok, true);
    assert.deepEqual(wsW.grant.families, ['whitespace-gap/v1']);
    const c = bootClient(room);
    E2.client = c;
    const rec = await c.call({ op: 'eureka_recall', run_tag: 'e2' });
    assert.equal(rec.plan.ok, true, JSON.stringify(rec.plan).slice(0, 300));
    const loaded = planner.loadPlan(room.roomDir, rec.plan.run_id);
    const before = planner.cardFor(room.roomDir, loaded.plan, {});
    assert.equal(before.next, 'grant');
    assert.equal(before.reason, 'outside_family');
    assert.equal(before.proposal.lifetime, 'run');
    const req = await c.call({ op: 'grant_request', run_id: rec.plan.run_id });
    assert.equal(req.ok, true, JSON.stringify(req).slice(0, 300));
    const ans = await c.answer(req.gate.gate_id, ['approve_run']);
    assert.equal(ans.ok !== false, true, JSON.stringify(ans).slice(0, 300));
    const g = activeStanding(room);
    assert.deepEqual(g.families, ['whitespace-gap/v1']);
    assert.equal(g.version, 1);
    E2.grant = g;
    const replay = makeReplayFetch({ route: function () { return 'gap_primary_zero'; } });
    const run = await withReplay(replay, function () { return c.call({ op: 'run_quick', run_id: rec.plan.run_id }); });
    assert.equal(run.status, 'done', JSON.stringify(run).slice(0, 300));
    assert.notEqual(run.reason, 'outside_family');
  });

  // -- E4 standing scope is never stuck on the web, MCP door ---------------------
  // MOVED 2026-10-05 (369.2-09 (R02, ruling 2026-10-05): one run grant per run on the web lines; standing term grants no longer cover a web send): a tampered plan under a standing grant gets the run card
  // (a gate with approve_run), never the stuck-scope refusal; nothing is fetched.
  await leg('E4 a standing grant never gives the stuck refusal on the web: run_quick and grant_request offer the run approval; no fetch', async function () {
    assert.ok(E2.grant, 'E2 ran');
    const room = E2.room;
    const c = E2.client;
    const rec = await c.call({ op: 'eureka_recall', run_tag: 'e4' });
    assert.equal(rec.plan.ok, true);
    const loc = readPlanFile(room, rec.plan.run_id);
    const q = firstFetchQuery(loc.plan);
    assert.equal(q.family, 'concept-evidence/v1');
    q.template_id = 'ws.exact';
    writePlanFile(loc.file, loc.plan);
    const replay = makeReplayFetch({ route: function () { return 'gap_primary_zero'; } });
    const res = await withReplay(replay, function () { return c.call({ op: 'run_quick', run_id: rec.plan.run_id }); });
    assert.notEqual(res.reason, 'grant_scope_cannot_cover_plan', JSON.stringify(res).slice(0, 300));
    assert.equal(res.status, 'reask', JSON.stringify(res).slice(0, 300));
    assert.ok(res.gate && res.gate.gate_id, 'a gate is minted for the run approval');
    assert.deepEqual(res.card.options.map(function (o) { return o.id; }), ['approve_run', 'not_now']);
    assert.equal(replay.calls.length, 0);
    const req = await c.call({ op: 'grant_request', run_id: rec.plan.run_id });
    assert.equal(req.ok, true, JSON.stringify(req).slice(0, 300));
    assert.ok(req.gate && req.gate.gate_id);
    assert.equal(req.reason, undefined);
    assert.equal(replay.calls.length, 0);
  });

  // -- E5 stale prose plan, MCP door ----------------------------------------------
  // MOVED 2026-10-04 (SEED-115, quick 261004-v16): the stored room phrase is no longer refused
  // term_not_composed; run_quick asks (reask) and nothing is fetched before the navigator approves.
  await leg('E5 a stored plan with a room phrase is not refused term_not_composed at run_quick; zero fetches before approval', async function () {
    assert.ok(E2.grant, 'E2 ran');
    const room = E2.room;
    const c = E2.client;
    const rec = await c.call({ op: 'eureka_recall', run_tag: 'e5' });
    assert.equal(rec.plan.ok, true);
    const loc = readPlanFile(room, rec.plan.run_id);
    const q = firstFetchQuery(loc.plan);
    q.slot_terms = [PROSE];
    q.q = '"' + PROSE + '"';
    q.q_hash = families.qHash(q.q);
    writePlanFile(loc.file, loc.plan);
    const replay = makeReplayFetch({ route: function () { return 'gap_primary_zero'; } });
    const res = await withReplay(replay, function () { return c.call({ op: 'run_quick', run_id: rec.plan.run_id }); });
    assert.notEqual(res.reason, 'term_not_composed', JSON.stringify(res).slice(0, 300));
    assert.equal(res.status, 'reask', JSON.stringify(res).slice(0, 300));
    assert.equal(replay.calls.length, 0);
  });

  // -- E6 eureka_recall hands the composer abstracted terms (SEED-104 part 2) ----
  await leg('E6 abstractTerm: field title first, then a side-unique entity handle, then a canon handle; never first-sentence prose', function () {
    const at = eurekaRecall._test.abstractTerm;
    assert.equal(typeof at, 'function');
    const titled = { id: 't', title: 'Membrane fouling in desalination intake filters', title_from_field: true, canon_handle: null };
    assert.equal(at(titled, {}, []), 'Membrane fouling in desalination intake filters');
    const claim = { id: 'c', title: '**Claim.** A stable, flowable emulsion', title_from_field: false, canon_handle: null };
    assert.equal(at(claim, {}, []), null);
    assert.equal(at(claim, { c: ['EGaIn microdroplets', 'anti-fouling coating'] }, ['anti-fouling coating']), 'EGaIn microdroplets');
    assert.equal(at(claim, { c: ['anti-fouling coating'] }, ['anti-fouling coating']), null);
    const canon = { id: 'k', title: '1. Something. Else here', title_from_field: false, canon_handle: 'Six Thinking Hats' };
    assert.equal(at(canon, {}, []), 'Six Thinking Hats');
    const st = eurekaRecall._test.slotTerm;
    // 369.2-04/05, ruling 2026-10-05: slotTerm is the WEB slot rule (markdown stripped, cap 200); the field rule
    // above (a claim body never becomes a term) is abstractTerm's and still holds.
    assert.equal(st('**Claim.** A stable'), 'Claim. A stable');
    assert.equal(st('  thin film   sensors '), 'thin film sensors');
    assert.equal(st('a "quoted" AND (paren) term'), 'a quoted paren term');
    assert.equal(st('x'.repeat(201)), null);
  });
  await leg('E7 questionSetFor: a pair with no clean term is a local-only leaf; a side-unique entity gives it a term', function () {
    const bare = buildEurekaRoom();
    const r1 = eurekaRecall.runRecall(bare.roomDir, { tag: 'e7a' });
    const claimLeaf = r1.question_set.leaves.filter(function (l) { return l.pair && (/\/C[12]$/.test(l.pair.a) || /\/C[12]$/.test(l.pair.b)); });
    assert.ok(claimLeaf.length >= 1);
    claimLeaf.forEach(function (l) {
      assert.equal(l.researchable, false);
      assert.equal(l.corpus, 'room');
      assert.equal(Object.prototype.hasOwnProperty.call(l, 'slots'), false);
      assert.equal(typeof l.not_researchable_reason, 'string');
      assert.equal(l.lens, 'eu.transfer');
      assert.ok(l.pair && l.lanes);
    });
    r1.question_set.leaves.forEach(function (l) {
      const slots = l.slots || {};
      Object.keys(slots).forEach(function (k) { assert.notEqual(families.composableTerm(slots[k]), null, k); });
    });
    const rich = buildEurekaRoom({ withEntities: true });
    const r2 = eurekaRecall.runRecall(rich.roomDir, { tag: 'e7b' });
    const both = r2.question_set.leaves.filter(function (l) { return l.pair && l.pair.a === 'ma/C2' && l.pair.b === 'pd/C1' || l.pair && l.pair.a === 'pd/C1' && l.pair.b === 'ma/C2'; })[0];
    assert.ok(both, 'the claim pair is a leaf');
    assert.equal(both.researchable, true);
    assert.equal(both.corpus, 'openalex');
    const terms = [both.slots.term, both.slots.term2].sort();
    assert.deepEqual(terms, ['EGaIn microdroplets', 'sintering process']);
    // the plan builds and composes from handles only
    const built = planner.buildPlan(rich.roomDir, r2.question_set, { mode: 'quick' });
    assert.equal(built.ok, true);
    built.plan.leaves.forEach(function (l) {
      (l.queries || []).forEach(function (q) { assert.equal(q.q.indexOf('flowable'), -1); });
    });
  });

  // LEGS_HERE

  await leg('Z net guard counted zero fetch attempts', function () {
    assert.equal(guard.attempts(), 0);
  });
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* ignore */ } });
  process.exit(summary());
}

main();
