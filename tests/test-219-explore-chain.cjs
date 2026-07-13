'use strict';
// Phase 219-05 -- REQ-4 explore chain test suite (RED-first, Tasks 2-5).
//
// Nine assertion groups (219-05-PLAN.md Task 5), fully hermetic (web leg
// stubbed via onStep; zero network -- the run-all-219 zero-network preload
// applies when run through the aggregator):
//   (1) chain composition order + registry resolution (or honest command:null
//       degrade); zero fabricated commands; the filing step is material
//   (2) material-step halt under the default gateFn (haltedAt set, no
//       auto-run past the gate)
//   (3) NO-AUTO-FIRE: qualifying a candidate produces NO chain trace and NO
//       explored artifact (behavioral) + a comment-filtered grep proves
//       qualify-opportunity.cjs never requires/invokes explore-chain
//   (4) full stubbed explore run: research/ artifact filed with frontmatter +
//       citations; post-filing extraction lands >=1 proposed entity
//       DERIVED_FROM the artifact node; Minto bank artifact nested with
//       governing thought + SCQA + citations; >=2 evidence edges; lifecycle
//       'explored' (the D-16 + REQ-4 acceptance set)
//   (5) forced-offline run: room-corpus results, research_mode
//       'web_degraded_local_fallback' + the exact provenance string
//       "web: absent (room-corpus degrade)", still files honestly marked
//   (6) D-19: a cold corpus yields research_mode 'insufficient_evidence'
//       (never ok+empty), zero fabricated results
//   (7) D-17: the explored transition APPENDED stage_history (qualified ->
//       explored) with actor/reason/evidence_ids/formula_version; prior
//       entries intact
//   (8) D-20: MINDRIAN_FORCE_ENGINE_ABSENT=1 halts at the llm-manual OFFER
//       gate; a manually-executed run stamps engine_mode
//       'llm_manual_baseline' in the artifact frontmatter
//   (9) D-21: filed paths match the nesting conventions
//       (opportunity-bank/<section>/<name>/<name>.md with a real domain-slug
//       section, research/<dated-slug>/<dated-slug>.md); no loose files
// plus the source grep gates (zero '/mos:' literals, zero raw fetch/https
// requires in explore-chain.cjs).
//
// NO em-dashes anywhere (CLAUDE.md HARD RULE).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const { buildFixtureRoom } = require(path.join(REPO_ROOT, 'tests', 'helpers', 'fixture-room-219.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation.cjs'));
const qualify = require(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'qualify-opportunity.cjs'));

const EXPLORE_CHAIN_PATH = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'explore-chain.cjs');
const RESEARCH_FILING_PATH = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'research-filing.cjs');
const EXPLORED_ARTIFACT_PATH = path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'explored-artifact.cjs');

const exploreChain = require(EXPLORE_CHAIN_PATH);
const researchFiling = require(RESEARCH_FILING_PATH);
require(EXPLORED_ARTIFACT_PATH); // load-bearing: the module must exist + parse

const PROVENANCE = 'web: absent (room-corpus degrade)';
const OPP_NAME = 'Vantorix Systems x Cryogenic Pump Array';
const SESSION = 'fixture-219';

let pass = 0;
let total = 0;
const failures = [];
async function check(label, fn) {
  total += 1;
  try {
    await fn();
    pass += 1;
    console.log('  ok -', label);
  } catch (e) {
    failures.push(label + ': ' + (e && e.message));
    console.log('  FAIL -', label, '::', e && e.message);
  }
}

function freshRoom(tag) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-219-explore-' + tag + '-'));
  return buildFixtureRoom(tmp);
}

// Seed a QUALIFIED opportunity in the fixture room via the Plan 04 handlers
// (the shipped human-gate path): pre-mint with a real domain section, then
// Qualify at the card. Returns { nodeId, evidenceIds }.
function seedQualified(fixture) {
  const db = openRoomDb(fixture.roomDir);
  try {
    const minted = navigation.writeOpportunityNode(db, {
      name: OPP_NAME,
      sessionId: SESSION,
      lifecycle: 'candidate',
      lens: 'leveraging_resources',
      score: 0.8,
      section: 'competitive-analysis',
      actor: 'system',
      reason: 'seeded for explore test',
      evidence_ids: [fixture.ids.bridgeA, fixture.ids.bridgeB],
      formula_version: 'HarvestIndex_v1',
    });
    assert.equal(minted.ok, true, 'seed mint ok');
    const q = qualify.qualifyCandidate(db, fixture.roomDir, {
      candidate_id: 'cand-explore-1',
      name: OPP_NAME,
      session_id: SESSION,
      node_handle: minted.node_id,
      lens: 'leveraging_resources',
      score: 0.8,
      evidence_handles: [fixture.ids.bridgeA, fixture.ids.bridgeB],
      source_event: 'bridge',
    }, 'navigator');
    assert.equal(q.ok, true, 'qualify ok: ' + JSON.stringify(q));
    return { nodeId: minted.node_id, evidenceIds: [fixture.ids.bridgeA, fixture.ids.bridgeB] };
  } finally {
    closeRoomDb(db);
  }
}

function propsOf(roomDir, nodeId) {
  const db = openRoomDb(roomDir);
  try {
    const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(nodeId);
    assert.ok(row, 'node ' + nodeId + ' queryable');
    return JSON.parse(row.properties);
  } finally {
    closeRoomDb(db);
  }
}

// The stubbed host leg executor (the "web leg stubbed via onStep" contract).
// Findings carry entity-bearing titles so the deterministic tier-1 extractor
// finds real entities in the filed research body.
function makeHostOnStep(log) {
  return function onStep(step, _prev) {
    if (Array.isArray(log)) log.push(step.leg);
    if (step.leg === 'deep_research') {
      return {
        chain_output: {
          leg: step.leg,
          summary: 'Vantorix Systems adoption of the Cryogenic Pump Array is accelerating in evacuated tube freight.',
          findings: [
            { url: 'https://web.example/finding-1', title: 'Cryogenic Pump Array adoption report', summary: 'stubbed web finding', accessed: '2026-07-13' },
            { url: 'https://web.example/finding-2', title: 'Vantorix Systems partnership analysis', summary: 'stubbed web finding two', accessed: '2026-07-13' },
          ],
          research_mode: 'normal',
          providers: [{ provider: 'stub-web', lens: 'web', status: 'ok', reason: 'stub', counts: { items: 2 }, freshness: 'live' }],
        },
        quality: 'high',
      };
    }
    if (step.leg === 'web_validation') {
      return {
        chain_output: {
          leg: step.leg,
          summary: 'Market validation confirms demand in the freight corridor.',
          findings: [{ url: 'https://web.example/validation-1', title: 'Freight corridor validation', accessed: '2026-07-13' }],
        },
        quality: 'high',
      };
    }
    return {
      chain_output: { leg: step.leg, summary: step.leg.replace(/_/g, ' ') + ' analysis: the window is open and analog domains agree.' },
      quality: 'high',
    };
  };
}

// Comment-filtered source scan (the 218/219 grep-gate idiom in JS).
function codeLines(filePath) {
  const src = fs.readFileSync(filePath, 'utf8');
  return src.split('\n').filter((l) => {
    const t = l.trim();
    return !(t.startsWith('//') || t.startsWith('*') || t.startsWith('/*'));
  });
}

function listFilesRecursive(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...listFilesRecursive(p));
    else out.push(p);
  }
  return out;
}

async function main() {
  // =========================================================================
  // Group 1: composition order + registry resolution.
  // =========================================================================
  await check('G1: composeExploreChain resolves the four legs in order + a material filing step, zero fabrication', () => {
    const { steps } = exploreChain.composeExploreChain();
    assert.equal(steps.length, 5, 'four analysis legs + the filing step');
    const legs = steps.map((s) => s.leg);
    assert.deepEqual(legs, ['deep_research', 'diffusion_timing', 'analogies', 'web_validation', 'file_explored'], 'leg order');
    for (const s of steps.slice(0, 4)) {
      const resolved = typeof s.command === 'string' && s.command.length > 0;
      const honest = s.command === null && s.optional === true;
      assert.ok(resolved || honest, 'leg ' + s.leg + ' resolved OR honest command:null+optional degrade');
    }
    // With the real registry loaded, all four legs resolve.
    assert.ok(steps.slice(0, 4).every((s) => typeof s.command === 'string' && s.command.length > 0),
      'registry loaded: all four legs resolve to registry commands');
    assert.equal(steps[4].material, true, 'the filing step is material');
  });

  await check('G1b: source gates - zero /mos: literals, zero raw fetch/https requires in explore-chain.cjs', () => {
    const lines = codeLines(EXPLORE_CHAIN_PATH);
    for (const l of lines) {
      assert.ok(l.indexOf('/mos:') === -1, 'no hardcoded /mos: slug: ' + l.trim());
      assert.ok(!/require\(['"]node:https?['"]\)/.test(l), 'no raw https require: ' + l.trim());
      assert.ok(!/\bfetch\(/.test(l), 'no raw fetch call: ' + l.trim());
    }
  });

  // =========================================================================
  // Group 2: material-step halt under the default gateFn.
  // =========================================================================
  await check('G2: the chain runs the autonomous_safe prefix then HALTS at the material filing gate', async () => {
    const fixture = freshRoom('halt');
    const { nodeId } = seedQualified(fixture);
    const log = [];
    const res = await exploreChain.exploreOpportunity(fixture.roomDir, nodeId, {
      onStep: makeHostOnStep(log),
      sessionId: SESSION,
    });
    assert.equal(res.ok, true, 'run returns ok envelope');
    assert.ok(res.haltedAt, 'haltedAt is set');
    assert.equal(res.haltedAt.step.leg, 'file_explored', 'halted at the filing gate');
    assert.equal(res.completed, false, 'not completed past the gate');
    assert.deepEqual(log, ['deep_research', 'diffusion_timing', 'analogies', 'web_validation'],
      'the autonomous_safe prefix ran; the material step did NOT auto-run');
    assert.equal(res.filed, null, 'nothing filed without the navigator verb');
    const props = propsOf(fixture.roomDir, nodeId);
    assert.equal(props.lifecycle, 'qualified', 'lifecycle unchanged at the gate');
  });

  // =========================================================================
  // Group 3: NO-AUTO-FIRE.
  // =========================================================================
  await check('G3: qualifying a candidate NEVER fires the chain (behavioral + source scan)', () => {
    const fixture = freshRoom('noauto');
    const db = openRoomDb(fixture.roomDir);
    try {
      const q = qualify.qualifyCandidate(db, fixture.roomDir, {
        candidate_id: 'cand-noauto',
        name: 'Orthodox Rail Group x Maglev Load Lock',
        session_id: SESSION,
        lens: 'challenging_orthodoxies',
        score: 0.7,
        evidence_handles: [fixture.ids.contradictionA, fixture.ids.contradictionB],
        source_event: 'contradiction',
      }, 'navigator');
      assert.equal(q.ok, true, 'qualify ok');
      const props = JSON.parse(db.prepare('SELECT properties FROM nodes WHERE id = ?').get(q.node_id).properties);
      assert.equal(props.lifecycle, 'qualified', 'qualified, NOT explored');
      assert.notEqual(props.lifecycle, 'explored', 'no explored transition on qualify');
    } finally {
      closeRoomDb(db);
    }
    // No nested explored artifact appeared anywhere under opportunity-bank/.
    const bank = path.join(fixture.roomDir, 'opportunity-bank');
    const nested = listFilesRecursive(bank).filter((f) => f.endsWith('.md') && path.dirname(f) !== bank);
    assert.equal(nested.length, 0, 'zero nested explored artifacts on qualify');
    // Comment-filtered source scan: qualify-opportunity never touches the chain.
    const lines = codeLines(path.join(REPO_ROOT, 'lib', 'core', 'eureka', 'qualify-opportunity.cjs'));
    for (const l of lines) {
      assert.ok(l.indexOf('explore-chain') === -1, 'qualify never requires explore-chain: ' + l.trim());
      assert.ok(l.indexOf('exploreOpportunity') === -1, 'qualify never invokes exploreOpportunity: ' + l.trim());
    }
  });

  // =========================================================================
  // Group 4 + 7 + 9: the full stubbed explore run (approved at the gate).
  // =========================================================================
  const fixture4 = freshRoom('full');
  const seeded4 = seedQualified(fixture4);
  let fullRes = null;

  await check('G4: an approved run files the research corpus artifact + the nested Minto explored artifact', async () => {
    const log = [];
    fullRes = await exploreChain.exploreOpportunity(fixture4.roomDir, seeded4.nodeId, {
      onStep: makeHostOnStep(log),
      onHalt: (step) => (step.leg === 'file_explored' ? 'approve' : 'defer'),
      sessionId: SESSION,
      actor: 'navigator',
      evidenceIds: seeded4.evidenceIds,
    });
    assert.equal(fullRes.ok, true, 'run ok: ' + JSON.stringify(fullRes.reason || null));
    assert.ok(fullRes.filed, 'filing happened on the approve verb');
    assert.ok(fullRes.filed.research && typeof fullRes.filed.research.relPath === 'string', 'research artifact filed');
    assert.ok(fullRes.filed.explored && typeof fullRes.filed.explored.relPath === 'string', 'explored artifact filed');
    assert.equal(fullRes.engine_mode, 'engine', 'engine mode is the honest default');
    assert.equal(fullRes.research_mode, 'normal', 'stubbed healthy web leg composes normal');
  });

  await check('G4b: the research artifact carries frontmatter with date + url-cited sources + topic handles (D-16 item 1)', () => {
    const abs = path.join(fixture4.roomDir, fullRes.filed.research.relPath);
    assert.ok(fs.existsSync(abs), 'research file exists at ' + fullRes.filed.research.relPath);
    const { parseFrontmatter } = require(path.join(REPO_ROOT, 'lib', 'core', 'opportunity-ops.cjs'));
    const fm = parseFrontmatter(fs.readFileSync(abs, 'utf8'));
    assert.ok(typeof fm.date === 'string' && fm.date.length >= 10, 'date present');
    assert.ok(Array.isArray(fm.sources) && fm.sources.length >= 1, 'sources present');
    for (const s of fm.sources) {
      assert.ok(typeof s.url === 'string' && s.url.startsWith('http'), 'source url cited');
      assert.ok(typeof s.accessed === 'string' && s.accessed.length >= 10, 'source accessed date');
    }
    assert.ok(Array.isArray(fm.topic_handles) && fm.topic_handles.length >= 1, 'topic handles present');
  });

  await check('G4c: post-filing extraction landed >=1 proposed entity DERIVED_FROM the research artifact node (D-16 item 2)', () => {
    const db = openRoomDb(fixture4.roomDir);
    try {
      const artNode = fullRes.filed.research.node_id;
      assert.ok(artNode, 'research artifact node id returned');
      const row = db.prepare('SELECT id, type FROM nodes WHERE id = ?').get(artNode);
      assert.ok(row && row.type === 'memory_artifact', 'the research artifact is a memory_artifact graph citizen');
      const derived = db.prepare("SELECT source FROM edges WHERE target = ? AND type = 'DERIVED_FROM'").all(artNode);
      assert.ok(derived.length >= 1, '>=1 DERIVED_FROM edge to the artifact node (got ' + derived.length + ')');
      let proposedSeen = false;
      for (const d of derived) {
        const ent = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(d.source);
        if (ent && ent.review_status === 'proposed') proposedSeen = true;
      }
      assert.ok(proposedSeen, 'the DERIVED_FROM sources include proposed entities');
    } finally {
      closeRoomDb(db);
    }
  });

  await check('G4d: the Minto bank artifact reads ANALYZED (governing thought + SCQA + citations) and passes the invariants', () => {
    const abs = path.join(fixture4.roomDir, fullRes.filed.explored.relPath);
    assert.ok(fs.existsSync(abs), 'explored artifact exists');
    const raw = fs.readFileSync(abs, 'utf8');
    const { parseFrontmatter } = require(path.join(REPO_ROOT, 'lib', 'core', 'opportunity-ops.cjs'));
    const fm = parseFrontmatter(raw);
    assert.ok(typeof fm.governing_thought === 'string' && fm.governing_thought.length > 20, 'governing thought present + substantive');
    assert.ok(typeof fm.problem_hash === 'string' && fm.problem_hash.length === 8, 'problem_hash for the dedup scan');
    assert.equal(fm.engine_mode, 'engine', 'engine_mode in frontmatter');
    for (const heading of ['Situation', 'Complication', 'Question', 'Answer']) {
      assert.ok(raw.indexOf(heading) !== -1, 'SCQA heading present: ' + heading);
    }
    assert.ok(/https:\/\/web\.example\/finding-1/.test(raw), 'web citation present in the artifact');
    const invariants = require(path.join(REPO_ROOT, 'lib', 'core', 'feynman-minto-invariants.cjs'));
    const verdict = invariants.validate(abs);
    assert.equal(verdict.valid, true, 'feynman-minto invariants pass: ' + JSON.stringify(verdict.violations));
  });

  await check('G4e: >=2 typed evidence edges (SUPPORTS/INFORMS) + lifecycle/opportunity_stage explored (REQ-4)', () => {
    const db = openRoomDb(fixture4.roomDir);
    try {
      const rows = db.prepare("SELECT type FROM edges WHERE source = ? AND type IN ('SUPPORTS','INFORMS')").all(seeded4.nodeId);
      assert.ok(rows.length >= 2, '>=2 typed evidence edges (got ' + rows.length + ')');
    } finally {
      closeRoomDb(db);
    }
    const props = propsOf(fixture4.roomDir, seeded4.nodeId);
    assert.equal(props.lifecycle, 'explored', 'lifecycle reads explored');
    assert.equal(props.opportunity_stage, 'explored', 'opportunity_stage reads explored (D-17 axis)');
  });

  await check('G7: the explored transition APPENDED stage_history (qualified -> explored); prior entries intact (D-17)', () => {
    const props = propsOf(fixture4.roomDir, seeded4.nodeId);
    const h = props.stage_history;
    assert.ok(Array.isArray(h) && h.length >= 3, 'mint + qualified + explored entries at minimum');
    assert.equal(h[0].from, null, 'the mint entry survives');
    assert.ok(h.some((e) => e.to === 'qualified'), 'the qualified entry survives');
    const explored = h.filter((e) => e.to === 'explored' && e.from === 'qualified');
    assert.ok(explored.length >= 1, 'an appended qualified -> explored lifecycle entry exists');
    const e = explored[0];
    assert.ok(typeof e.actor === 'string' && e.actor.length > 0, 'actor recorded');
    assert.ok(typeof e.reason === 'string' && e.reason.length > 0, 'reason recorded');
    assert.ok(Array.isArray(e.evidence_ids) && e.evidence_ids.length >= 1, 'evidence_ids recorded');
    assert.equal(e.formula_version, 'HarvestIndex_v1', 'formula_version recorded');
  });

  await check('G9: filed paths honor the D-21 nesting conventions; no loose files', () => {
    // research/<dated-slug>/<dated-slug>.md
    const r = fullRes.filed.research.relPath.replace(/\\/g, '/');
    const rm = r.match(/^research\/([a-z0-9-]+)\/([a-z0-9-]+)\.md$/);
    assert.ok(rm, 'research path nested: ' + r);
    assert.equal(rm[1], rm[2], 'the research folder IS the artifact (Decision 16)');
    // opportunity-bank/<section>/<name>/<name>.md with a real domain slug
    const b = fullRes.filed.explored.relPath.replace(/\\/g, '/');
    const bm = b.match(/^opportunity-bank\/([a-z0-9-]+)\/([a-z0-9-]+)\/([a-z0-9-]+)\.md$/);
    assert.ok(bm, 'bank path nested: ' + b);
    assert.equal(bm[2], bm[3], 'the bank folder IS the artifact (Decision 16)');
    assert.equal(bm[1], 'competitive-analysis', 'the section segment is the real domain slug');
    const ICM_DENY = ['opportunity', 'memory_artifact', 'artifact', 'section', 'company', 'technology', 'market'];
    assert.ok(!ICM_DENY.includes(bm[1]), 'the section is never an ICM type name (216 contract)');
    // No loose .md landed directly under research/ (identity ROOM.md excepted).
    const researchRoot = path.join(fixture4.roomDir, 'research');
    const loose = fs.readdirSync(researchRoot).filter((f) => f.endsWith('.md') && f !== 'ROOM.md');
    assert.equal(loose.length, 0, 'no loose research files');
    // Directory identities exist (ICM Layer 0).
    assert.ok(fs.existsSync(path.join(researchRoot, 'ROOM.md')), 'research/ carries its ROOM.md identity');
  });

  // =========================================================================
  // Group 5: forced-offline degrade (warm room corpus).
  // =========================================================================
  await check('G5: forceOffline swaps the web legs to the room corpus with honest provenance + mode, and still files', async () => {
    const fixture = freshRoom('offline');
    const { nodeId, evidenceIds } = seedQualified(fixture);
    // Warm the room's research corpus FIRST (a prior research artifact).
    const warmed = await researchFiling.fileResearchArtifact(fixture.roomDir, {
      topicHandles: ['cryogenic pump array', 'vantorix systems'],
      body: 'Prior filed research: Vantorix Systems evaluated the Cryogenic Pump Array for evacuated tube freight.',
      sources: [{ url: 'https://web.example/prior-1', accessed: '2026-07-12' }],
    });
    assert.equal(warmed.ok, true, 'corpus warm-up filing ok: ' + JSON.stringify(warmed.reason || null));
    const res = await exploreChain.exploreOpportunity(fixture.roomDir, nodeId, {
      onStep: makeHostOnStep([]),
      onHalt: (step) => (step.leg === 'file_explored' ? 'approve' : 'defer'),
      forceOffline: true,
      sessionId: SESSION,
      actor: 'navigator',
      evidenceIds: evidenceIds,
      topicHandles: ['vantorix systems', 'cryogenic pump array'],
    });
    assert.equal(res.ok, true, 'offline run ok');
    assert.equal(res.research_mode, 'web_degraded_local_fallback', 'the degrade is typed (got ' + res.research_mode + ')');
    const webLeg = res.trace.find((t) => t.step && t.step.leg === 'deep_research');
    assert.ok(webLeg && webLeg.chain_output, 'the deep_research leg ran on the corpus');
    assert.equal(webLeg.chain_output.provenance, PROVENANCE, 'the exact provenance string');
    assert.ok(Array.isArray(webLeg.chain_output.results) && webLeg.chain_output.results.length >= 1,
      'room-corpus results returned (warm corpus)');
    assert.ok(res.filed && res.filed.explored, 'still files on approval');
    const raw = fs.readFileSync(path.join(fixture.roomDir, res.filed.research.relPath), 'utf8');
    assert.ok(raw.indexOf('web_degraded_local_fallback') !== -1, 'the filed research artifact is honestly marked');
  });

  // =========================================================================
  // Group 6: cold corpus -> insufficient_evidence (D-19).
  // =========================================================================
  await check('G6: a COLD corpus under forceOffline composes insufficient_evidence with zero fabricated results', async () => {
    const fixture = freshRoom('cold');
    const { nodeId } = seedQualified(fixture);
    const res = await exploreChain.exploreOpportunity(fixture.roomDir, nodeId, {
      onStep: makeHostOnStep([]),
      forceOffline: true,
      sessionId: SESSION,
    });
    assert.equal(res.ok, true, 'the cold run returns an envelope, never a crash');
    assert.equal(res.research_mode, 'insufficient_evidence', 'cold corpus is typed (got ' + res.research_mode + ')');
    const webLeg = res.trace.find((t) => t.step && t.step.leg === 'deep_research');
    assert.ok(webLeg, 'the deep_research leg is in the trace');
    assert.equal((webLeg.chain_output.results || []).length, 0, 'zero fabricated results');
    assert.equal(res.filed, null, 'nothing files on insufficient evidence');
  });

  // =========================================================================
  // Group 8: D-20 engine-breaks (halt at the OFFER gate; manual mode stamps).
  // =========================================================================
  await check('G8: MINDRIAN_FORCE_ENGINE_ABSENT=1 halts at the llm-manual OFFER gate; nothing executes silently', async () => {
    const fixture = freshRoom('absent');
    const { nodeId } = seedQualified(fixture);
    const log = [];
    let offerSeen = null;
    process.env.MINDRIAN_FORCE_ENGINE_ABSENT = '1';
    let res;
    try {
      res = await exploreChain.exploreOpportunity(fixture.roomDir, nodeId, {
        onStep: makeHostOnStep(log),
        onHalt: (step, contexts) => { offerSeen = contexts && contexts.offer; return 'defer'; },
        sessionId: SESSION,
      });
    } finally {
      delete process.env.MINDRIAN_FORCE_ENGINE_ABSENT;
    }
    assert.equal(res.ok, true, 'envelope returned');
    assert.ok(res.haltedAt, 'halted');
    assert.equal(res.haltedAt.step.leg, 'deep_research', 'halted at the FIRST engine-backed step');
    assert.equal(log.length, 0, 'NOTHING executed silently');
    assert.ok(offerSeen, 'the gate carried the llm-manual OFFER');
    assert.equal(offerSeen.engine_mode, 'llm_manual_baseline', 'the offer names the honest engine_mode label');
    assert.ok(res.haltedAt.offer, 'the result haltedAt carries the offer too');
    assert.equal(res.filed, null, 'no filing');
  });

  await check('G8b: an ACCEPTED manual run stamps engine_mode llm_manual_baseline end-to-end in frontmatter', async () => {
    const fixture = freshRoom('manual');
    const { nodeId, evidenceIds } = seedQualified(fixture);
    process.env.MINDRIAN_FORCE_ENGINE_ABSENT = '1';
    let res;
    try {
      res = await exploreChain.exploreOpportunity(fixture.roomDir, nodeId, {
        onStep: makeHostOnStep([]),
        onHalt: (step) => (step.leg === 'file_explored' ? 'approve' : 'defer'),
        manualMode: true, // the navigator ACCEPTED the offer at the gate
        sessionId: SESSION,
        actor: 'navigator',
        evidenceIds: evidenceIds,
      });
    } finally {
      delete process.env.MINDRIAN_FORCE_ENGINE_ABSENT;
    }
    assert.equal(res.ok, true, 'manual run ok');
    assert.equal(res.engine_mode, 'llm_manual_baseline', 'the run envelope carries the manual label');
    assert.ok(res.filed && res.filed.explored, 'the manual run filed on approval');
    const { parseFrontmatter } = require(path.join(REPO_ROOT, 'lib', 'core', 'opportunity-ops.cjs'));
    const bankFm = parseFrontmatter(fs.readFileSync(path.join(fixture.roomDir, res.filed.explored.relPath), 'utf8'));
    assert.equal(bankFm.engine_mode, 'llm_manual_baseline', 'the explored artifact frontmatter is honestly labeled');
    const researchFm = parseFrontmatter(fs.readFileSync(path.join(fixture.roomDir, res.filed.research.relPath), 'utf8'));
    assert.equal(researchFm.engine_mode, 'llm_manual_baseline', 'the research artifact frontmatter is honestly labeled');
  });

  // =========================================================================
  // Dedup: a re-explore of the same problem_hash updates in place.
  // =========================================================================
  await check('G4f: re-exploring the same opportunity updates the nested artifact in place (no duplicate folder)', async () => {
    const before = listFilesRecursive(path.join(fixture4.roomDir, 'opportunity-bank'))
      .filter((f) => f.endsWith('.md')).length;
    const res2 = await exploreChain.exploreOpportunity(fixture4.roomDir, seeded4.nodeId, {
      onStep: makeHostOnStep([]),
      onHalt: (step) => (step.leg === 'file_explored' ? 'approve' : 'defer'),
      sessionId: SESSION,
      actor: 'navigator',
      evidenceIds: seeded4.evidenceIds,
    });
    assert.equal(res2.ok, true, 're-explore ok');
    assert.ok(res2.filed && res2.filed.explored, 're-filed');
    assert.equal(res2.filed.explored.relPath, fullRes.filed.explored.relPath, 'same nested path (updated in place)');
    const after = listFilesRecursive(path.join(fixture4.roomDir, 'opportunity-bank'))
      .filter((f) => f.endsWith('.md')).length;
    assert.equal(after, before, 'no duplicate bank artifact appeared');
  });

  console.log('');
  console.log('test-219-explore-chain: ' + pass + '/' + total + ' passed');
  if (failures.length > 0) {
    console.log('failures:');
    for (const f of failures) console.log('  - ' + f);
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error('test-219-explore-chain crashed:', e && e.stack);
  process.exit(1);
});
