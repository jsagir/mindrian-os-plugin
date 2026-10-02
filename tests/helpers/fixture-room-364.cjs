'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 04 shared entry-room fixture (layer: graph).
 *
 * buildEntryRoom(rootDir, state, opts) -> { roomDir, ids, marker }
 *
 * Twelve reproducible room states for the Scientific Roadmapping entry check
 * (SRM364-08..10, SRM364-18). Every state except `empty` plants a WHAT, and
 * every planted WHAT text carries MARKER so the Part 8 sweep in plan 364-09 can
 * plant it and hunt it on the wire.
 *
 *   empty                 no WHAT at all
 *   fresh_gq              a governing question only
 *   fresh_claim           an assumption claim only (a Door 3 hypothesis)
 *   stated_goal           a ratified goal
 *   quantified_goal       a goal plus a scientific-roadmapping run with a quantified goal
 *   design_or_futures     a goal plus a filed dominant design and a filed future
 *   rs_finding            a goal plus a filed reverse salient
 *   hypothesis_in_flight  a goal plus an opportunity at lifecycle explored
 *   prior_run             a goal plus a settled prior run and an evidence node not in it
 *   qualified_opportunity a goal plus an opportunity at lifecycle qualified
 *   researcher_persona    a goal plus a USER.md whose role blend is researcher
 *   no_db                 a folder tree and a goal state file, no room.db
 *
 * REQUIRE ORDER: require this module only AFTER the caller has isolated the
 * process (HOME, USERPROFILE and MINDRIAN_ROOMS_HOME at mkdtemp dirs,
 * CLAUDE_ACTIVE_ROOM and CLAUDE_CODE_SESSION_ID deleted). Repo modules load
 * lazily inside buildEntryRoom.
 *
 * Order: every node is minted through insertNode (or a typed writer) FIRST;
 * only then do raw INSERT INTO edges statements run, each naming two ids that
 * already exist (nodes before edges). Raw edge SQL is allowed only inside test
 * fixtures (the fixture-366 precedent). Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const MARKER = 'MARKER-364-ROOM';

const ENTRY_STATES = Object.freeze([
  'empty', 'fresh_gq', 'fresh_claim', 'stated_goal', 'quantified_goal',
  'design_or_futures', 'rs_finding', 'hypothesis_in_flight', 'prior_run',
  'qualified_opportunity', 'researcher_persona', 'no_db',
]);

const SECTIONS = Object.freeze(['problem-definition', 'competitive-analysis']);

const RUN_NAME = '2026-09-30-sr-fixture-0000abcd';

function writeTree(roomDir) {
  fs.mkdirSync(roomDir, { recursive: true });
  fs.writeFileSync(path.join(roomDir, 'ROOM.md'), '---\nname: fixture-364-entry\n---\n# Entry fixture room\n');
  SECTIONS.forEach(function (sec) {
    fs.mkdirSync(path.join(roomDir, sec), { recursive: true });
    fs.writeFileSync(path.join(roomDir, sec, 'ROOM.md'), '---\nname: ' + sec + '\n---\n# ' + sec + '\n');
  });
}

function planJson(opts) {
  const o = opts || {};
  return {
    origin: { template_id: 'scientific-roadmapping' },
    perspective: {
      goal: {
        target: 'membrane flux ' + MARKER,
        unit: 'L/m2/h',
        threshold: '>= 40',
        quantified: o.quantified === true,
      },
      ratchet: { settled: Array.isArray(o.settled) ? o.settled : [] },
    },
  };
}

function writeRun(roomDir, plan) {
  const dir = path.join(roomDir, 'research', RUN_NAME);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify(plan, null, 2));
}

function writeUserMd(roomDir) {
  fs.writeFileSync(path.join(roomDir, 'USER.md'), [
    '---',
    'schema_version: 1',
    'user_id: fixture-364-user',
    'canonical_role: researcher',
    'role_blend:',
    '  founder: 0.0',
    '  researcher: 1.0',
    '  operator: 0.0',
    '  investor: 0.0',
    '---',
    '',
    '# User',
    '',
  ].join('\n'));
}

/**
 * buildEntryRoom(rootDir, state, opts)
 *   rootDir     an existing (mkdtemp) directory; the room is <rootDir>/<opts.name || state>
 *   state       one of ENTRY_STATES
 *   opts.rung   the ratified goal rung (default 'WellDefined'); lets a leg build a Wicked goal
 * Returns { roomDir, ids, marker }.
 */
function buildEntryRoom(rootDir, state, opts) {
  if (ENTRY_STATES.indexOf(state) === -1) throw new Error('fixture-room-364: unknown state ' + state);
  const o = opts || {};
  const roomDir = path.join(rootDir, o.name || state);
  writeTree(roomDir);
  const ids = { goal: null, governing_question: null, claim: null, reverse_salient: null, dominant_design: null, future: null, opportunity: null, evidence_old: null, evidence_new: null, run: null };

  const needsGoal = state !== 'empty' && state !== 'fresh_gq' && state !== 'fresh_claim';
  if (needsGoal) {
    const jtbdState = require(path.join(REPO_ROOT, 'lib/hmi/jtbd-state.cjs'));
    const g = jtbdState.setGoal(roomDir, {
      jtbd: 'Cut membrane fouling in desalination intake filters ' + MARKER,
      rung: o.rung || 'WellDefined',
      set_by: 'fixture',
    });
    if (!g) throw new Error('fixture-room-364: setGoal refused');
    ids.goal = 'goal:v' + g.goal_version;
  }

  if (state === 'researcher_persona') writeUserMd(roomDir);
  if (state === 'quantified_goal') { writeRun(roomDir, planJson({ quantified: true })); ids.run = RUN_NAME; }
  if (state === 'prior_run') {
    writeRun(roomDir, planJson({
      quantified: true,
      settled: [{ limiter_key: 'pump-energy', column: 'physics', evidence: ['evidence:old-364'], run_ref: RUN_NAME }],
    }));
    ids.run = RUN_NAME;
  }

  if (state === 'no_db') return { roomDir: roomDir, ids: ids, marker: MARKER };

  const roomDb = require(path.join(REPO_ROOT, 'lib/core/room-db.cjs'));
  const { insertNode } = require(path.join(REPO_ROOT, 'lib/core/node-insert.cjs'));
  const navigation = require(path.join(REPO_ROOT, 'lib/core/navigation.cjs'));
  const db = roomDb.openRoomDb(roomDir);
  try {
    const minted = new Set();
    function node(id, type, props, epistemic, sourcePath) {
      insertNode(db, id, type, JSON.stringify(props), { source_path: sourcePath || 'test:fixture-364', epistemic_type: epistemic || 'observation' });
      minted.add(id);
    }
    // 1. nodes first
    SECTIONS.forEach(function (sec) { node('section:' + sec, 'Section', { slug: sec }); });

    if (state === 'fresh_gq') {
      const fp = require(path.join(REPO_ROOT, 'lib/core/frame-provenance.cjs'));
      const r = fp.setGoverningQuestion(db, roomDir, { text: 'Which coating halves fouling in seawater intakes? ' + MARKER, origin: 'tasking' });
      if (!r || r.ok !== true) throw new Error('fixture-room-364: setGoverningQuestion refused ' + JSON.stringify(r));
      ids.governing_question = r.node_id || 'frame:governing-question';
      minted.add(ids.governing_question);
    }
    if (state === 'fresh_claim') {
      const r = navigation.writeClaimNode(db, {
        knowledge_type: 'assumption',
        text: 'Zwitterionic coatings cut biofilm attachment by half ' + MARKER,
        sessionId: 'fixture-364',
      });
      if (!r || r.ok !== true) throw new Error('fixture-room-364: writeClaimNode refused ' + JSON.stringify(r));
      ids.claim = r.node_id;
      minted.add(r.node_id);
    }
    if (state === 'rs_finding') {
      ids.reverse_salient = 'rs/fixture-364';
      node(ids.reverse_salient, 'Artifact', { title: 'Brine outfall lags the plant ' + MARKER }, 'derived_fact', 'competitive-analysis/reverse-salients/rs-fixture.md');
    }
    if (state === 'design_or_futures') {
      ids.dominant_design = 'dd/fixture-364';
      ids.future = 'fut/fixture-364';
      node(ids.dominant_design, 'Artifact', { title: 'Spiral wound module is the dominant design ' + MARKER }, 'derived_fact', 'competitive-analysis/dominant-designs/dd-fixture.md');
      node(ids.future, 'Artifact', { title: 'Three futures for coastal intake ' + MARKER }, 'derived_fact', 'problem-definition/futures/futures-fixture.md');
    }
    if (state === 'hypothesis_in_flight' || state === 'qualified_opportunity') {
      ids.opportunity = 'opp/' + state + '-364';
      node(ids.opportunity, 'opportunity', {
        name: 'Fixture opportunity ' + MARKER,
        lifecycle: state === 'hypothesis_in_flight' ? 'explored' : 'qualified',
      }, 'hypothesis');
    }
    if (state === 'prior_run') {
      ids.evidence_old = 'evidence:old-364';
      ids.evidence_new = 'evidence:new-364';
      node(ids.evidence_old, 'EvidenceClaim', { topic: 'pump energy', summary: 'old settled evidence ' + MARKER, evidence_tier: 'primary' });
      node(ids.evidence_new, 'EvidenceClaim', { topic: 'pump energy', summary: 'new evidence ' + MARKER, evidence_tier: 'primary' });
    }

    // 2. edges second, each naming two ids that already exist
    const ins = db.prepare('INSERT INTO edges (source, target, type, properties) VALUES (?, ?, ?, ?)');
    const links = [];
    [ids.reverse_salient, ids.dominant_design, ids.future].forEach(function (id) {
      if (id) links.push([id, 'section:competitive-analysis', 'BELONGS_TO']);
    });
    links.forEach(function (e) {
      if (!minted.has(e[0]) || !minted.has(e[1])) throw new Error('fixture-room-364: edge before node ' + e.join(' '));
      ins.run(e[0], e[1], e[2], '{}');
    });
  } finally {
    roomDb.closeRoomDb(db);
  }
  return { roomDir: roomDir, ids: ids, marker: MARKER };
}

module.exports = { buildEntryRoom, ENTRY_STATES, MARKER, RUN_NAME };
