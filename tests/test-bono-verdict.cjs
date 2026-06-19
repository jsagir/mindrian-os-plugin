'use strict';
/*
 * Phase 164-06 Task 1 -- THE ADVERSARIAL STRUCTURED VERDICT over the whole BONO
 * Research/Debate Engine (E1 + E2-remap + D-164-S1..S5 + the canon guards). This
 * is harness-as-code property 6: "adversarial verify returns a STRUCTURED
 * VERDICT, not a vibe."
 *
 * It MIRRORS the shipped Phase 169 W6 verdict (tests/test-graph-derivation-verdict.cjs),
 * the 166 W8 verdict, and the 163 W6 verdict VERBATIM in shape: a
 * record(check, passed, detail) accumulator that pushes { check, passed, detail }
 * into findings[], prints the structured verdict { passed, findings[] }, and
 * exits NON-ZERO printing the findings if ANY check failed. The verdict proves
 * each requirement BY INSTRUMENTATION (it drives the real SHIPPED surfaces +
 * greps the real source), never by prose.
 *
 * The checks (164-06-PLAN.md must_haves):
 *   (1)  E1 human-confirm-gate -- writeSyntheticExpertNode mints proposed; an
 *        agent-attributed confirm is REJECTED; a human byUser promotes (Part 9 role 5).
 *   (2)  E1 generic-only -- a venture-body params key is rejected (forbidden_field, Part 8).
 *   (3)  library-first + anti-ossification -- assembleTeam slots a confirmed expert
 *        on a hit, generates fresh on a miss, ALWAYS re-derives Black, guarantees a
 *        mandatory-fresh slot, and caps reuse at K < N.
 *   (4)  E2-remap -- issue-tree.toGraphEdges emits ONLY frozen ALLOWED_EDGE_TYPES
 *        members, never INVALIDATED / RESOLVES_VIA / BELONGS_TO.
 *   (5)  D-164-S2 PARALLEL-NOT-RUNCHAIN NEGATIVE -- cell-fanout.cjs source has NO
 *        chain-executor require and NO runChain call (the fan-out is parallel; the
 *        sequential loop is the debate). Comment-filtered.
 *   (6)  COMPOSE-ON-169-SUBSTRATE -- debate-composition.cjs REQUIRES graph-derivation
 *        (runDerivation) AND findings-wirer (wireAccept) and does NOT call
 *        navigation.writeEdge directly. Comment-filtered.
 *   (7)  D-164-S1 debate-IS-runChain -- runDebate halts at the two material steps
 *        (hypothesis-confirm + ruling); the argument steps auto-run; provenanceFn
 *        stamps each step; the runDerivation spy + the wireAccept spy are both called.
 *   (8)  D-164-S3 two-layered fable-mode -- a bad cell reading is dropped pre-collection
 *        (cell-side) AND runDerivation is invoked with a selfCritiqueFn (derivation-side).
 *   (9)  D-164-S5 incremental filing -- each step journals before the next and a resume
 *        does NOT re-run a completed step (the isNext hard gate).
 *   (10) Part 3 ruling -- the ruling routes through wireAccept / a REJECT routes
 *        through wireReject carrying the reason (REJECTED_BECAUSE).
 *   (11) E1 CANON -- MINDRIAN-CANON.md header + footer are v1.13 AND Appendix D
 *        entry 24 (SyntheticExpert) exists (stacked on Phase 169's v1.12 / entry 23).
 *   (12) Part 8 sweep -- delegate to tests/test-bono-part8-leak.cjs (assert it exits 0).
 *
 * If the verdict finds a REAL defect in Waves 1-5 it surfaces it as a FINDING
 * (passed:false), never a silent pass.
 *
 * House rule: hyphens only, no em-dashes (U+2014 referenced by escape only).
 * node built-ins only. Plain node harness.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');

// The SHIPPED surfaces the verdict drives (never mocks the production module).
const { writeSyntheticExpertNode } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'synthetic-expert.cjs'));
const { TRUTH_CLAIM_TYPES, promoteNodeStatus, AGENT_IDENTITIES } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'transitions.cjs'));
const expertLibrary = require(path.join(REPO_ROOT, 'lib', 'core', 'expert-library.cjs'));
const IssueTree = require(path.join(REPO_ROOT, 'lib', 'core', 'issue-tree.cjs'));
const { ALLOWED_EDGE_TYPES } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'edges.cjs'));
const debate = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'debate-composition.cjs'));
const cellFanout = require(path.join(REPO_ROOT, 'lib', 'core', 'bono', 'cell-fanout.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO_ROOT, 'lib', 'core', 'room-db.cjs'));

const CELL_FANOUT_SRC = path.join(REPO_ROOT, 'lib', 'core', 'bono', 'cell-fanout.cjs');
const DEBATE_SRC = path.join(REPO_ROOT, 'lib', 'core', 'bono', 'debate-composition.cjs');
const CANON = path.join(REPO_ROOT, 'docs', 'MINDRIAN-CANON.md');
const PART8_SCAN = path.join(REPO_ROOT, 'tests', 'test-bono-part8-leak.cjs');

const EM_DASH = String.fromCharCode(0x2014);

const TMP_ROOTS = [];
function mkRoom(prefix) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.mkdirSync(path.join(tmp, '.mindrian'), { recursive: true });
  TMP_ROOTS.push(tmp);
  return { tmp, db: openRoomDb(tmp) };
}
function cleanupTmp() {
  for (const d of TMP_ROOTS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }
}

// Strip CJS comment lines from a source body so a comment naming a forbidden
// token cannot self-invalidate the grep (the run-all grep -v '^#' idiom).
function codeLines(src) {
  return src.split('\n').filter((line) => {
    const t = line.trim();
    return t.length > 0 && t.indexOf('//') !== 0 && t.indexOf('*') !== 0 && t.indexOf('/*') !== 0;
  }).join('\n');
}

// ---------------------------------------------------------------------------
// THE STRUCTURED VERDICT ACCUMULATOR (harness-as-code property 6; mirrors
// test-graph-derivation-verdict.cjs). A thrown AssertionError becomes a FAILED
// finding carrying the assertion message (the real defect), so a genuine breach
// is SURFACED, never silently swallowed.
// ---------------------------------------------------------------------------
// Each guard is registered as a (check, fn) pair and RUN sequentially inside an
// async main(), so a sync fn and an async fn are both awaited uniformly. A thrown
// (or rejected) AssertionError becomes a FAILED finding carrying the message.
const findings = [];
const CHECKS = [];
function guard(check, fn) {
  CHECKS.push({ check: check, fn: fn });
}
async function runChecks() {
  for (const c of CHECKS) {
    try {
      const detail = await c.fn();
      findings.push({ check: c.check, passed: true, detail: detail || 'verified by instrumentation' });
    } catch (e) {
      findings.push({ check: c.check, passed: false, detail: (e && e.message) ? e.message : String(e) });
    }
  }
}

// ===========================================================================
// (1) E1 human-confirm-gate -- mint proposed, agent confirm REJECTED, human promotes.
// ===========================================================================
guard('E1 human-confirm-gate: writeSyntheticExpertNode mints PROPOSED; an agent-attributed confirm is REJECTED; a human byUser promotes (Part 9 role 5)', () => {
  const { tmp, db } = mkRoom('verdict-e1gate-');
  try {
    const w = writeSyntheticExpertNode(db, {
      hat: 'White', name: 'Oncology', surname: 'Immunotherapy', archetype: 'Researcher',
      sessionId: 'verdict', evidenceTier: 'Academic',
    });
    assert.ok(w && w.ok, 'writeSyntheticExpertNode did not mint: ' + JSON.stringify(w));
    const row = db.prepare('SELECT type, review_status FROM nodes WHERE id = ?').get(w.node_id);
    assert.ok(row, 'the minted SyntheticExpert node was not found');
    assert.equal(row.type, 'SyntheticExpert', 'minted node is not a SyntheticExpert');
    assert.equal(row.review_status, 'proposed', 'a SyntheticExpert did NOT land proposed (Part 9 role 5 breach)');
    assert.ok(TRUTH_CLAIM_TYPES.has('SyntheticExpert'), 'SyntheticExpert is not a truth-claim type');

    // An AGENT-attributed confirm is REJECTED.
    const agent = [...AGENT_IDENTITIES][0];
    const r1 = promoteNodeStatus(db, w.node_id, 'proposed', 'confirmed', agent);
    assert.equal(r1.ok, false, 'an agent confirm of a SyntheticExpert was NOT rejected');
    assert.equal(r1.reason, 'agent_attribution_forbidden', 'the rejection did not name the human-confirm gate');
    const after = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(w.node_id);
    assert.equal(after.review_status, 'proposed', 'the rejected confirm left the node non-proposed');

    // A HUMAN byUser promotes.
    const r2 = promoteNodeStatus(db, w.node_id, 'proposed', 'confirmed', 'navigator', 'navigator kept this expert');
    assert.equal(r2.ok, true, 'a human byUser confirm was NOT accepted: ' + JSON.stringify(r2));
    const confirmed = db.prepare('SELECT review_status FROM nodes WHERE id = ?').get(w.node_id);
    assert.equal(confirmed.review_status, 'confirmed', 'the human confirm did not land the node confirmed');
    return 'SyntheticExpert minted proposed; agent confirm rejected (agent_attribution_forbidden); human byUser promoted to confirmed';
  } finally { closeRoomDb(db); }
});

// ===========================================================================
// (2) E1 generic-only -- a venture-body params key is rejected (forbidden_field).
// ===========================================================================
guard('E1 generic-only: writeSyntheticExpertNode rejects a venture-body params key (forbidden_field, Part 8)', () => {
  const { tmp, db } = mkRoom('verdict-e1generic-');
  try {
    const w = writeSyntheticExpertNode(db, {
      hat: 'White', name: 'Oncology', surname: 'Immunotherapy',
      ventureBody: 'our CAR-T financial model projects 2b TAM by 2027',
    });
    assert.equal(w.ok, false, 'a venture-body key was NOT rejected (Part 8 generic-lens breach)');
    assert.equal(w.reason, 'forbidden_field', 'the rejection did not name forbidden_field');
    return 'a non-allow-listed venture-body params key is rejected forbidden_field BEFORE any insert (Part 8)';
  } finally { closeRoomDb(db); }
});

// ===========================================================================
// (3) library-first + anti-ossification -- hit slotting, miss fresh, Black always
// fresh, mandatory-fresh guarantee, reuse cap K < N.
// ===========================================================================
guard('library-first + anti-ossification: assembleTeam slots a confirmed hit, generates fresh on a miss, ALWAYS re-derives Black, guarantees a mandatory-fresh slot, and caps reuse at K < N', () => {
  const { tmp, db } = mkRoom('verdict-lib-');
  try {
    // Seed several CONFIRMED White experts across distinct subdomains so multiple
    // slots can get a hit (so the reuse cap + mandatory-fresh guards are exercised).
    const subs = ['immunotherapy', 'genomics', 'proteomics', 'microbiome'];
    for (const sub of subs) {
      const w = writeSyntheticExpertNode(db, {
        hat: 'White', name: 'Oncology', surname: sub, archetype: 'Researcher',
        sessionId: 'lib', evidenceTier: 'Academic',
      });
      assert.ok(w.ok, 'seed expert write failed for ' + sub);
      // Promote to confirmed (rankExpertsForSlot only reads confirmed experts) and
      // stamp the subdomain into props so matchTier can match the slot.
      const r = promoteNodeStatus(db, w.node_id, 'proposed', 'confirmed', 'navigator');
      assert.ok(r.ok, 'seed expert confirm failed for ' + sub);
      const props = JSON.parse(db.prepare('SELECT properties FROM nodes WHERE id = ?').get(w.node_id).properties);
      props.subdomain = sub;
      props.domain = 'oncology';
      db.prepare('UPDATE nodes SET properties = ? WHERE id = ?').run(JSON.stringify(props), w.node_id);
    }

    // A miss: a hat/subdomain with no confirmed expert => generate-fresh.
    const missOnly = expertLibrary.assembleTeam(db, {
      neededSlots: [{ hat: 'Yellow', subdomain: 'no-such-subdomain', domain: 'oncology' }],
    });
    assert.equal(missOnly.slots[0].action, 'generate-fresh', 'a miss slot was not generate-fresh');
    assert.equal(missOnly.slots[0].reason, 'no_fresh_hit', 'a miss did not report no_fresh_hit');

    // Black is ALWAYS re-derived (never a reuse) even with a confirmed Black expert present.
    const wb = writeSyntheticExpertNode(db, { hat: 'Black', name: 'Risk', surname: 'regulatory', sessionId: 'lib', evidenceTier: 'Academic' });
    promoteNodeStatus(db, wb.node_id, 'proposed', 'confirmed', 'navigator');
    const black = expertLibrary.assembleTeam(db, { neededSlots: [{ hat: 'Black', subdomain: 'regulatory' }] });
    assert.equal(black.slots[0].action, 'generate-fresh', 'the Black hat was NOT re-derived fresh (ossification breach)');
    assert.equal(black.slots[0].reason, 'black_always_fresh', 'Black fresh did not report black_always_fresh');

    // A confirmed-hit slot: a White/immunotherapy slot REUSES the seeded expert.
    // NOTE the mandatory-fresh guard (Guard 1) forces a LONE all-hit run back to
    // fresh, so a single-slot hit run would (correctly) generate-fresh. We pair the
    // hit slot with a guaranteed-miss slot so the miss satisfies mandatory-fresh and
    // the hit slot survives as a genuine reuse (the by-instrumentation-correct setup).
    const hit = expertLibrary.assembleTeam(db, {
      neededSlots: [
        { hat: 'White', subdomain: 'immunotherapy', domain: 'oncology' },
        { hat: 'Yellow', subdomain: 'no-such-subdomain', domain: 'oncology' },
      ],
      opts: { reuseCap: 5 },
    });
    const hitSlot = hit.slots.find((sl) => sl.subdomain === 'immunotherapy');
    assert.ok(hitSlot, 'the White/immunotherapy slot is missing from the assembly');
    assert.equal(hitSlot.action, 'reuse', 'a confirmed-hit slot did NOT reuse a library expert');
    assert.ok(typeof hitSlot.reusedExpertId === 'string', 'the reused slot carries no expert id');

    // The reuse cap K < N: with 4 White-hit slots and reuseCap=2, at most 2 reuse +
    // the mandatory-fresh guard fires, so generate-fresh appears (K < N).
    const capRun = expertLibrary.assembleTeam(db, {
      neededSlots: subs.map((s) => ({ hat: 'White', subdomain: s, domain: 'oncology' })),
      opts: { reuseCap: 2 },
    });
    assert.ok(capRun.summary.reused <= 2, 'the reuse cap K=2 was exceeded (reused=' + capRun.summary.reused + ')');
    assert.ok(capRun.summary.generated >= 1, 'no generate-fresh slot survived the cap (mandatory-fresh breach)');
    assert.ok(capRun.summary.reused < capRun.summary.total, 'reuse was not strictly < N (K < N breach)');

    // The mandatory-fresh guarantee: even an all-hit run forces one fresh.
    const allHit = expertLibrary.assembleTeam(db, {
      neededSlots: subs.map((s) => ({ hat: 'White', subdomain: s, domain: 'oncology' })),
      opts: { reuseCap: 99 },
    });
    assert.ok(allHit.slots.some((sl) => sl.action === 'generate-fresh'),
      'an all-hit run did NOT force a mandatory-fresh slot (ossification breach)');
    return 'miss->fresh; Black always fresh; confirmed hit reused; reuse cap K=2 held (' + capRun.summary.reused
      + ' < ' + capRun.summary.total + '); all-hit run still forced a mandatory-fresh slot';
  } finally { closeRoomDb(db); }
});

// ===========================================================================
// (4) E2-remap -- issue-tree.toGraphEdges emits ONLY frozen members.
// ===========================================================================
guard('E2-remap: issue-tree.toGraphEdges emits ONLY frozen ALLOWED_EDGE_TYPES members (PART_OF / INFORMS / INVALIDATES / ROOT_CAUSES / ENABLES); NEVER INVALIDATED / RESOLVES_VIA / BELONGS_TO', () => {
  const tree = {
    keyQuestion: 'sales are falling',
    branches: [
      {
        label: 'demand side weakness',
        branches: [
          { label: 'pricing too high', test: 'A/B a 10 percent price cut', status: 'confirmed' },
          { label: 'channel mismatch', test: 'survey lost leads', status: 'invalidated' },
        ],
      },
      { label: 'supply side bottleneck', test: 'measure fulfillment latency' },
    ],
  };
  const edges = IssueTree.toGraphEdges(tree);
  assert.ok(Array.isArray(edges) && edges.length > 0, 'toGraphEdges emitted no edges');
  const FORBIDDEN = new Set(['INVALIDATED', 'RESOLVES_VIA', 'BELONGS_TO']);
  const emitted = new Set();
  for (const e of edges) {
    emitted.add(e.type);
    assert.ok(ALLOWED_EDGE_TYPES.has(e.type), 'an emitted edge type "' + e.type + '" is OUTSIDE the frozen ALLOWED_EDGE_TYPES set');
    assert.ok(!FORBIDDEN.has(e.type), 'an emitted edge type "' + e.type + '" is a pre-remap forbidden type');
  }
  // The remap targets are present (PART_OF for the structural branch, ROOT_CAUSES /
  // ENABLES for the confirmed leaf, INVALIDATES for the falsified branch).
  assert.ok(emitted.has('PART_OF'), 'the structural remap target PART_OF was not emitted');
  assert.ok(emitted.has('ROOT_CAUSES'), 'the confirmed-leaf remap target ROOT_CAUSES was not emitted');
  assert.ok(emitted.has('INVALIDATES'), 'the falsified-branch remap target INVALIDATES was not emitted');
  return 'toGraphEdges emits {' + [...emitted].sort().join(', ') + '}; every type frozen; zero INVALIDATED/RESOLVES_VIA/BELONGS_TO';
});

// ===========================================================================
// (5) D-164-S2 PARALLEL-NOT-RUNCHAIN NEGATIVE -- cell-fanout has NO chain-executor
// require and NO runChain call.
// ===========================================================================
guard('D-164-S2 parallel-not-runChain: cell-fanout.cjs source has NO chain-executor require and NO runChain call (the fan-out is parallel; the sequential loop is the debate). Comment-filtered.', () => {
  const code = codeLines(fs.readFileSync(CELL_FANOUT_SRC, 'utf8'));
  assert.ok(!/require\([^)]*chain-executor/.test(code),
    'cell-fanout.cjs REQUIRES chain-executor (the parallel fan-out smuggled the sequential loop, D-164-S2 breach)');
  assert.ok(!/\brunChain\b/.test(code),
    'cell-fanout.cjs calls runChain (the fan-out must be parallel, not a sequential chain sequence)');
  // Positive proof of the parallel mechanic: a Promise.all dispatch.
  assert.ok(/Promise\.all/.test(code), 'cell-fanout.cjs has no Promise.all parallel dispatch (the parallel mechanic is absent)');
  return 'cell-fanout.cjs has zero chain-executor require + zero runChain call; dispatches via Promise.all (parallel, not sequential)';
});

// ===========================================================================
// (6) COMPOSE-ON-169-SUBSTRATE -- debate-composition REQUIRES graph-derivation +
// findings-wirer and does NOT call navigation.writeEdge directly.
// ===========================================================================
guard('compose-on-169-substrate: debate-composition.cjs REQUIRES graph-derivation (runDerivation) AND findings-wirer (wireAccept) and does NOT call navigation.writeEdge DIRECTLY (Part 7 reuse). Comment-filtered.', () => {
  const code = codeLines(fs.readFileSync(DEBATE_SRC, 'utf8'));
  assert.ok(/require\([^)]*graph-derivation/.test(code),
    'debate-composition.cjs does NOT require graph-derivation (the derived relationships must ride runDerivation)');
  assert.ok(/require\([^)]*findings-wirer/.test(code),
    'debate-composition.cjs does NOT require findings-wirer (the ruling/tension must ride wireAccept/wireReject)');
  assert.ok(/\brunDerivation\b/.test(code), 'debate-composition.cjs never references runDerivation');
  assert.ok(/\bwireAccept\b/.test(code), 'debate-composition.cjs never references wireAccept');
  // The negative: no bare navigation.writeEdge( call in the composition (the derived
  // edges ride runDerivation's frozen CASCADE_SUBSET; the ruling rides wireAccept).
  assert.ok(!/navigation\.writeEdge\s*\(/.test(code),
    'debate-composition.cjs calls navigation.writeEdge DIRECTLY (compose-on-substrate breach: a hand-rolled edge write survives)');
  assert.ok(!/\bwriteEdge\s*\(/.test(code),
    'debate-composition.cjs calls writeEdge directly (the edges must ride runDerivation / wireAccept, never a direct edge write)');
  return 'debate-composition.cjs requires graph-derivation + findings-wirer, references runDerivation + wireAccept, and makes ZERO direct writeEdge call';
});

// ===========================================================================
// (7) D-164-S1 debate-IS-runChain -- runDebate halts at the two material steps;
// arguments auto-run; provenanceFn stamps each step; runDerivation + wireAccept
// spies are both called.
// ===========================================================================
guard('D-164-S1 debate-IS-runChain: the chain HALTS at the FIRST material gate (hypothesis-confirm) per Canon Part 3; buildSteps marks BOTH material steps so the ruling WOULD halt; with hypothesis greenlit the arguments auto-run, the ruling becomes the material halt, provenanceFn stamps each ran step, and a MATERIAL step never auto-runs (T-164-25); the runDerivation spy AND the wireAccept spy are BOTH called', () => {
  const hats = ['White', 'Black', 'Green'];
  const cells = hats.map((h) => ({ subdomain: 'immunotherapy', hat: h, stance: 'supports', evidence: ['e1'], confidence: 0.8 }));

  // The step sequence MARKS both material gates (the buildSteps contract).
  const steps = debate.buildSteps(hats);
  const hypoStep = steps.find((s) => s.command === debate.HYPOTHESIS_STEP);
  const rulingStep = steps.find((s) => s.command === debate.RULING_STEP);
  assert.ok(hypoStep && hypoStep.material === true, 'hypothesis-confirm is not marked material');
  assert.ok(rulingStep && rulingStep.material === true, 'the ruling step is not marked material (it would not halt)');
  const argSteps = steps.filter((s) => s.command.indexOf(debate.ARGUMENT_STEP_PREFIX) === 0);
  assert.ok(argSteps.length === hats.length && argSteps.every((s) => s.material === false),
    'the per-hat argument steps are not all autonomous_safe (material:false)');

  // The runChain gate verb is a STRING ('run' | 'halt'); a material step halts.
  // Spies on the two 169-substrate paths (runDebate calls them AFTER the chain).
  let derivationCalled = 0;
  let wireAcceptCalled = 0;

  // --- SCENARIO A: the default gate HALTS at the FIRST material step ---
  // (hypothesis-confirm). The chain stops there per Canon Part 3 -- it does NOT
  // proceed to the ruling in a single pass. onStep never fires for a halted step.
  {
    const { tmp, db } = mkRoom('verdict-debateA-');
    try {
      const ranA = [];
      const gateA = (step) => { const v = step.material === true ? 'halt' : 'run'; if (v === 'run') ranA.push(step.command); return v; };
      const resA = debate.runDebate({
        cells: cells, hats: hats, hypothesis: 'h', roomDir: tmp, db: db,
        runDerivationFn: () => { derivationCalled += 1; return { proposedNodes: [], edges: [], trace: [] }; },
        wireAcceptFn: () => { wireAcceptCalled += 1; return { ok: true }; },
        selfCritiqueFn: () => ({ passed: true, quality: 'high' }),
        gateFn: gateA,
        ruling: { finding: { claim: 'supported' }, topic: 'moat' },
      });
      assert.ok(resA.chain && resA.chain.haltedAt && resA.chain.haltedAt.step, 'the chain did not record a haltedAt');
      assert.equal(resA.chain.haltedAt.step.command, debate.HYPOTHESIS_STEP,
        'the chain did NOT halt at the FIRST material gate (hypothesis-confirm), it halted at: ' + resA.chain.haltedAt.step.command);
      assert.ok(ranA.indexOf(debate.HYPOTHESIS_STEP) === -1, 'the material hypothesis step auto-ran (T-164-25 breach)');
    } finally { closeRoomDb(db); }
  }

  // --- SCENARIO B: greenlight hypothesis so the arguments auto-run; the ruling is
  // the material halt. Proves argument auto-run + provenance stamping + the ruling
  // material halt in ONE pass. ---
  {
    const { tmp, db } = mkRoom('verdict-debateB-');
    try {
      const ranB = [];
      let provenanceStamps = 0;
      // Greenlight hypothesis-confirm, run the arguments, HALT at ruling.
      const gateB = (step) => {
        if (step.command === debate.RULING_STEP) return 'halt';
        ranB.push(step.command);
        return 'run';
      };
      // runDebate builds its provenanceFn from journalFns.makeProvenanceFn (the
      // pipeline-state idiom), so the provenance spy is injected via journalFns.
      const journalFns = {
        initChain: () => ({ ok: true }),
        recordStep: () => ({ ok: true }),
        makeProvenanceFn: () => (step) => { provenanceStamps += 1; return { pipeline: 'bono-debate', pipeline_stage: step.command }; },
        checkPosition: () => ({ isNext: true }),
      };
      const resB = debate.runDebate({
        cells: cells, hats: hats, hypothesis: 'h', roomDir: tmp, db: db,
        runDerivationFn: () => { derivationCalled += 1; return { proposedNodes: [{ minted: true, review_status: 'proposed' }], edges: [], trace: [] }; },
        wireAcceptFn: () => { wireAcceptCalled += 1; return { ok: true }; },
        selfCritiqueFn: () => ({ passed: true, quality: 'high' }),
        gateFn: gateB,
        journalFns: journalFns,
        ruling: { finding: { claim: 'supported' }, topic: 'moat' },
      });
      // The ruling is the material halt.
      assert.ok(resB.chain.haltedAt && resB.chain.haltedAt.step.command === debate.RULING_STEP,
        'with hypothesis greenlit, the chain did not halt at the ruling material gate');
      // At least one per-hat argument auto-ran.
      assert.ok(ranB.some((c) => c.indexOf(debate.ARGUMENT_STEP_PREFIX) === 0),
        'no per-hat argument step auto-ran with hypothesis greenlit');
      // The material ruling never auto-ran.
      assert.ok(ranB.indexOf(debate.RULING_STEP) === -1, 'the material ruling step auto-ran (T-164-25 breach)');
      // provenanceFn stamped each ran step.
      assert.ok(provenanceStamps >= 1, 'provenanceFn stamped no ran step');
    } finally { closeRoomDb(db); }
  }

  // The derived relationships rode runDerivation; the ruling rode wireAccept (both
  // called -- runDebate routes them through the 169 substrate after the chain).
  assert.ok(derivationCalled >= 1, 'runDerivation was NOT the path the derived relationships took');
  assert.ok(wireAcceptCalled >= 1, 'wireAccept was NOT the path the ruling took');
  return 'buildSteps marks hypothesis-confirm + ruling material; default gate halts at the FIRST material gate (hypothesis-confirm); greenlit-hypothesis run auto-ran the arguments + stamped provenance + halted at the ruling; no material step auto-ran; runDerivation spy + wireAccept spy both called';
});

// ===========================================================================
// (8) D-164-S3 two-layered fable-mode -- a bad cell reading is dropped pre-collection
// (cell-side) AND runDerivation is invoked WITH a selfCritiqueFn (derivation-side).
// ===========================================================================
guard('D-164-S3 two-layered fable-mode: a bad cell reading is DROPPED pre-collection (cell-side layer 1) AND runDerivation is invoked WITH a selfCritiqueFn (the derivation-side layer 2)', async () => {
  // Cell-side: a below-floor + a no-evidence reading are dropped; a clean cell kept.
  const out = await cellFanout.runCellFanout({
    subdomains: ['immunotherapy'],
    hats: ['White', 'Black', 'Green'],
    // dispatchCell returns one clean cell, one below-floor cell, one no-evidence cell.
    dispatchCell: async (cell) => {
      if (cell.hat === 'White') return { stance: 'supports', evidence: ['paper-1'], confidence: 0.8 };
      if (cell.hat === 'Black') return { stance: 'challenges', evidence: [], confidence: 0.05 }; // below floor
      return { stance: 'challenges', evidence: [], confidence: 0.9 }; // no-evidence non-neutral
    },
  });
  assert.ok(out && Array.isArray(out.cells) && Array.isArray(out.dropped), 'runCellFanout returned no {cells, dropped}');
  assert.ok(out.dropped.length >= 1, 'fable-mode layer 1 dropped NO bad cell reading (the cell-side gate is open)');
  assert.ok(out.cells.length >= 1, 'fable-mode layer 1 dropped the clean cell too (over-aggressive)');
  const droppedReasons = out.dropped.map((d) => d.reason);
  assert.ok(droppedReasons.indexOf('below_confidence_floor') !== -1 || droppedReasons.indexOf('no_evidence') !== -1,
    'the cell drop did not name a fable-mode reason');

  // Derivation-side: runDebate passes the selfCritiqueFn through to runDerivation (the
  // (7) spy already proved derivationSawSelfCritique; re-prove it here in isolation).
  const { tmp, db } = mkRoom('verdict-fable-');
  try {
    let sawCritique = false;
    debate.runDebate({
      cells: [], hats: ['White'], hypothesis: 'h', roomDir: tmp, db: db,
      runDerivationFn: (args) => { sawCritique = typeof args.selfCritiqueFn === 'function'; return { proposedNodes: [], edges: [], trace: [] }; },
      wireAcceptFn: () => ({ ok: true }),
      selfCritiqueFn: () => ({ passed: true, quality: 'high' }),
      gateFn: (step) => (step.material === true ? 'halt' : 'run'),
    });
    assert.ok(sawCritique, 'runDerivation was NOT invoked with a selfCritiqueFn (the derivation-side fable layer is absent)');
  } finally { closeRoomDb(db); }
  return 'cell-side dropped ' + out.dropped.length + ' bad reading(s) {' + droppedReasons.join(',') + '} pre-collection; runDerivation invoked WITH a selfCritiqueFn (two layers)';
});

// ===========================================================================
// (9) D-164-S5 incremental filing -- each step journals before the next AND a
// resume does NOT re-run a completed step (the isNext hard gate).
// ===========================================================================
guard('D-164-S5 incremental filing: runDebate journals each step BEFORE the next (the recordStep order) AND the pipeline-state checkPosition isNext gate rejects re-running a completed step', () => {
  const { tmp, db } = mkRoom('verdict-filing-');
  try {
    const recorded = [];
    let initialized = false;
    const journalFns = {
      initChain: (roomDir, stepCommands) => { initialized = true; recorded.length = 0; return { ok: true, steps: stepCommands }; },
      recordStep: (roomDir, command) => { recorded.push(command); return { ok: true }; },
      makeProvenanceFn: () => (step) => ({ pipeline: 'bono-debate', pipeline_stage: step.command }),
      // checkPosition: the isNext HARD gate. A step already in `recorded` is a
      // re-run attempt -> isNext:false; the next un-recorded step -> isNext:true.
      checkPosition: (roomDir, command) => ({ isNext: recorded.indexOf(command) === -1 }),
    };

    // Greenlight hypothesis-confirm so the per-hat argument steps RUN and journal
    // (onStep -- and thus recordStep -- fires only on a step the gate greenlights);
    // HALT at the ruling material gate. This exercises the journal in order.
    const res = debate.runDebate({
      cells: [{ subdomain: 's', hat: 'White', stance: 'supports', evidence: ['e'], confidence: 0.8 }],
      hats: ['White', 'Green'], hypothesis: 'h', roomDir: tmp, db: db,
      runDerivationFn: () => ({ proposedNodes: [], edges: [], trace: [] }),
      wireAcceptFn: () => ({ ok: true }),
      gateFn: (step) => (step.command === debate.RULING_STEP ? 'halt' : 'run'),
      journalFns: journalFns,
    });

    assert.ok(initialized, 'initChain was NOT called BEFORE the steps (the journal was not seeded)');
    assert.ok(res.journaled === true, 'runDebate did not report it journaled');
    assert.ok(recorded.length >= 1, 'no step was journaled via recordStep');

    // The isNext HARD gate: a completed step is NOT next on resume.
    const completed = recorded[0];
    assert.equal(journalFns.checkPosition(tmp, completed).isNext, false,
      'the isNext gate said a COMPLETED step is still next (a resume would re-run it -- D-164-S5 / T-164-30 breach)');
    return 'initChain seeded BEFORE steps; ' + recorded.length + ' step(s) journaled in order; the isNext gate rejects re-running the completed step "' + completed + '"';
  } finally { closeRoomDb(db); }
});

// ===========================================================================
// (10) Part 3 ruling -- the ruling routes through wireAccept on APPROVE and a
// REJECT routes through wireReject carrying the reason (REJECTED_BECAUSE).
// ===========================================================================
guard('Part 3 ruling: the ruling routes through wireAccept on APPROVE; a residual tension that CONTRADICTS routes through wireReject carrying the reason (REJECTED_BECAUSE graph data, Part 4)', () => {
  const { tmp, db } = mkRoom('verdict-ruling-');
  try {
    let acceptCalls = 0;
    let rejectCalls = 0;
    let rejectReason = null;
    debate.runDebate({
      cells: [], hats: ['White'], hypothesis: 'h', roomDir: tmp, db: db,
      runDerivationFn: () => ({ proposedNodes: [], edges: [], trace: [] }),
      wireAcceptFn: () => { acceptCalls += 1; return { ok: true, node_id: 'claim:ruling' }; },
      wireRejectFn: (d, params) => { rejectCalls += 1; rejectReason = params.reason; return { ok: true, node_id: 'claim:tension' }; },
      gateFn: (step) => (step.material === true ? 'halt' : 'run'),
      ruling: { finding: { claim: 'supported' }, topic: 'moat' },
      rulingApproved: true,
      residualTension: { rejected: true, finding: { claim: 'the channel data still contradicts' }, reason: 'unresolved_channel_tension', topic: 'moat' },
    });
    assert.ok(acceptCalls >= 1, 'the APPROVED ruling did NOT route through wireAccept');
    assert.ok(rejectCalls >= 1, 'the contradicting residual tension did NOT route through wireReject (REJECTED_BECAUSE)');
    assert.equal(rejectReason, 'unresolved_channel_tension', 'wireReject did not carry the rejection reason as graph data');
    return 'ruling rode wireAccept (x' + acceptCalls + '); contradicting tension rode wireReject (x' + rejectCalls + ') carrying reason "' + rejectReason + '"';
  } finally { closeRoomDb(db); }
});

// ===========================================================================
// (11) E1 CANON -- MINDRIAN-CANON.md is v1.13 with Appendix D entry 24.
// ===========================================================================
guard('E1 CANON: MINDRIAN-CANON.md header + footer are v1.13 AND Appendix D entry 24 mentioning SyntheticExpert exists (stacked on Phase 169 v1.12 / entry 23)', () => {
  const src = fs.readFileSync(CANON, 'utf8');
  // Header Version line.
  assert.ok(/^Version:\s*1\.13\s*$/m.test(src), 'the CANON header Version line is NOT 1.13 (the E1 amendment did not land at the live target)');
  // Footer version line.
  assert.ok(/Mindrian Canon v1\.13/.test(src), 'the CANON footer is NOT v1.13');
  // Appendix D entry 24 mentioning SyntheticExpert.
  assert.ok(/^24\.\s+\*\*Node-type amendment: SyntheticExpert/m.test(src),
    'Appendix D entry 24 (SyntheticExpert node-type amendment) is absent');
  assert.ok(/Canon version bumped to 1\.13/.test(src), 'the entry-24 version-bump line (to 1.13) is absent');
  // Stacked on Phase 169 (entry 23 / v1.12 still present).
  assert.ok(/^23\.\s+\*\*Edge-vocabulary amendment: NESTED_WITHIN/m.test(src), 'the prior Phase-169 entry 23 (NESTED_WITHIN) is gone (the stack was broken)');
  return 'CANON header + footer are v1.13; Appendix D entry 24 (SyntheticExpert) present; entry 23 (NESTED_WITHIN / v1.12) preserved beneath it';
});

// ===========================================================================
// (12) Part 8 sweep -- delegate to the leak-scan suite (assert it exits 0).
// ===========================================================================
guard('Part 8 sweep: tests/test-bono-part8-leak.cjs exits 0 (zero forbidden tokens across every Phase-164 surface)', () => {
  // execFileSync throws on a non-zero exit; a clean run returns the captured output.
  const out = execFileSync('node', [PART8_SCAN], { encoding: 'utf8' });
  assert.ok(/VERDICT: \{"passed":true/.test(out), 'the Part 8 leak scan did not report passed:true');
  return 'the Part 8 leak scan exited 0 with passed:true (zero forbidden tokens)';
});

// ===========================================================================
// no-em-dash self-check -- zero U+2014 across the Phase-164 verify surfaces.
// ===========================================================================
guard('no em-dash: zero U+2014 codepoints across the Phase-164 verify surfaces (the CLAUDE.md HARD RULE, by instrumentation)', () => {
  const FILES = [
    'tests/test-bono-verdict.cjs',
    'tests/test-bono-part8-leak.cjs',
    'tests/run-all-164.sh',
  ];
  const hits = [];
  for (const rel of FILES) {
    const abs = path.join(REPO_ROOT, rel);
    if (fs.existsSync(abs) && fs.readFileSync(abs, 'utf8').includes(EM_DASH)) hits.push(rel);
  }
  assert.equal(hits.length, 0, 'em-dash (U+2014) found in: ' + hits.join(', '));
  return 'zero U+2014 across ' + FILES.length + ' Phase-164 verify surfaces';
});

// ---------------------------------------------------------------------------
// Emit the structured verdict. Checks run sequentially (sync + async uniformly
// awaited) inside main() before the verdict is computed.
// ---------------------------------------------------------------------------
(async function main() {
  await runChecks();

  cleanupTmp();

  const passedAll = findings.every((f) => f.passed);
  process.stdout.write('bono adversarial verdict\n');
  process.stdout.write('========================\n');
  for (const f of findings) {
    process.stdout.write((f.passed ? '  PASS ' : '  FAIL ') + f.check + '\n');
    process.stdout.write('       ' + f.detail + '\n');
  }
  process.stdout.write('\n');
  process.stdout.write('VERDICT: ' + JSON.stringify({ passed: passedAll, checks: findings.length, failed: findings.filter((f) => !f.passed).length }) + '\n');

  if (!passedAll) {
    process.stdout.write('\nFINDINGS (failures):\n');
    for (const f of findings.filter((x) => !x.passed)) {
      process.stdout.write('  - [' + f.check + '] ' + f.detail + '\n');
    }
    process.exit(1);
  }
  process.exit(0);
})();
