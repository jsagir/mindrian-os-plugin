#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 04 Tasks 1-2 -- the entry check and entry resolver
 * (ROOT, NV-1, NR-1, NR-2, ENTRY). layer: graph
 *
 * Legs E1-E18 build twelve room states under os.tmpdir() and call
 * lib/core/research-planner/sr-entry.cjs. Hermetic: HOME, USERPROFILE and
 * MINDRIAN_ROOMS_HOME point at mkdtemp dirs before any repo module loads; the
 * network guard is installed first and the last check proves zero attempts.
 * Exit 77 when node:sqlite is missing.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-entry-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-entry-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;

try { require('node:sqlite'); } catch (_e) {
  console.log('SKIP: node:sqlite is not available (ENV GAP)');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-364-sr-entry');

const MOD_PATH = path.join(REPO_ROOT, 'lib/core/research-planner/sr-entry.cjs');
const fixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-room-364.cjs'));
const { buildEntryRoom, ENTRY_STATES, MARKER } = fixture;

const ROOT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-entry-'));
const NO_DASH = /[\u2014\u2013]/;

function sha(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

function treeSnapshot(dir) {
  const out = [];
  (function walk(d) {
    fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) return walk(p);
      if (/-shm$/.test(e.name)) return;
      const st = fs.statSync(p);
      out.push(path.relative(dir, p) + '|' + st.size + '|' + Math.round(st.mtimeMs));
    });
  })(dir);
  return out.sort().join('\n');
}

function dbSnapshot(roomDir) {
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('file:' + dbPath + '?mode=ro');
  try {
    return {
      hash: sha(dbPath),
      nodes: db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n,
      edges: db.prepare('SELECT COUNT(*) AS n FROM edges').get().n,
      lifecycles: db.prepare("SELECT id, json_extract(properties, '$.lifecycle') AS lc FROM nodes WHERE type = 'opportunity' ORDER BY id").all()
        .map(function (r) { return r.id + '=' + r.lc; }).join(','),
    };
  } finally { db.close(); }
}

function main() {
  let mod = null;
  try { mod = require(MOD_PATH); } catch (e) { C.check('sr-entry.cjs loads', false, e.message); }
  if (!mod) { C.check('E18 zero network attempts', net.attempts() === 0); process.exit(C.summary() || 1); }
  const { resolveEntry, renderEntry, ROOTING, ENTRY_RULES, BOUND_KINDS } = mod;

  const rooms = {};
  ENTRY_STATES.forEach(function (s) { rooms[s] = buildEntryRoom(ROOT_DIR, s); });
  const R = {};
  ENTRY_STATES.forEach(function (s) { R[s] = resolveEntry(rooms[s].roomDir, {}); });

  // contract constants
  C.check('contract: ROOTING frozen with the published fields',
    Object.isFrozen(ROOTING) && ROOTING.primary === 'WellDefined' && ROOTING.secondary_bridge === 'IllDefined'
    && /364-INPUT/.test(ROOTING.source) && typeof ROOTING.ledger_note === 'string');
  C.check('contract: ENTRY_RULES order and steps',
    Object.isFrozen(ENTRY_RULES)
    && JSON.stringify(ENTRY_RULES.map(function (r) { return [r.when, r.step]; })) === JSON.stringify([
      ['prior_run_plus_new_evidence', 1], ['hypothesis_in_flight', 6], ['rs_finding', 6], ['design_or_futures', 5],
      ['quantified_goal', 3], ['stated_goal', 2], ['fresh', 1]])
    && ENTRY_RULES.every(function (r) { return typeof r.why === 'string' && r.why.length > 10; }));
  C.check('contract: BOUND_KINDS commands',
    Object.isFrozen(BOUND_KINDS)
    && JSON.stringify(BOUND_KINDS.reverse_salients) === '["/mos:find-bottlenecks"]'
    && JSON.stringify(BOUND_KINDS.dominant_designs) === '["/mos:dominant-designs"]'
    && JSON.stringify(BOUND_KINDS.futures) === '["/mos:explore-futures"]'
    && JSON.stringify(BOUND_KINDS.systems) === '["/mos:systems-thinking","/mos:analyze-systems"]');

  // E1 no WHAT -> route back
  {
    const r = R.empty;
    C.check('E1 empty room: what missing, route define_what, offers analyze-needs, no step',
      r.ok === true && r.what.status === 'missing' && r.route === 'define_what'
      && r.offers.indexOf('/mos:analyze-needs') !== -1 && r.proposed_step === null && r.what.candidates.length === 0,
      JSON.stringify(r));
  }

  // E2 governing question only
  {
    const r = R.fresh_gq;
    const c = r.what.candidates[0];
    C.check('E2 governing question only: candidate, step 1, rule fresh, text capped, no new node type',
      r.what.status === 'present' && c && c.kind === 'governing_question' && typeof c.id === 'string' && c.text.indexOf(MARKER) !== -1
      && c.text.length <= 280 && r.proposed_step === 1 && r.rule === 'fresh' && r.route === null && r.not_run.length === 0,
      JSON.stringify(r));
  }

  // E3 hypothesis claim, --from-hypothesis
  {
    const r = resolveEntry(rooms.fresh_claim.roomDir, { fromHypothesis: true });
    const c = r.what.candidates[0];
    C.check('E3 fresh_claim with fromHypothesis: hypothesis_claim candidate, step 1',
      c && c.kind === 'hypothesis_claim' && c.id === rooms.fresh_claim.ids.claim && r.proposed_step === 1, JSON.stringify(r));
    const e = resolveEntry(rooms.empty.roomDir, { fromHypothesis: true });
    C.check('E3 empty with fromHypothesis: route define_what, reason no_hypothesis_on_file',
      e.route === 'define_what' && e.what.status === 'missing' && e.what.reason === 'no_hypothesis_on_file', JSON.stringify(e));
    const g = resolveEntry(rooms.stated_goal.roomDir, { fromHypothesis: true });
    C.check('E3 goal but no claim with fromHypothesis: still enters, discloses no_hypothesis_on_file',
      g.what.status === 'present' && g.context_insufficient.indexOf('no_hypothesis_on_file') !== -1, JSON.stringify(g));
    const both = resolveEntry(rooms.fresh_claim.roomDir, {});
    C.check('E3 a claim alone without the flag is still a WHAT candidate', both.what.candidates[0] && both.what.candidates[0].kind === 'hypothesis_claim');
  }

  // E4 stated goal
  {
    const r = R.stated_goal;
    C.check('E4 stated_goal: step 2, rule stated_goal, step 1 not_run with the goal as stand-in',
      r.proposed_step === 2 && r.rule === 'stated_goal' && r.what.candidates[0].kind === 'goal'
      && JSON.stringify(r.not_run) === JSON.stringify([{ step: 1, stand_in: { kind: 'goal', id: rooms.stated_goal.ids.goal } }]),
      JSON.stringify(r.not_run));
  }

  // E5 quantified goal
  {
    const r = R.quantified_goal;
    C.check('E5 quantified_goal: step 3, not_run covers 1 and 2, run folder stands in for nothing it skipped wrongly',
      r.proposed_step === 3 && r.rule === 'quantified_goal'
      && JSON.stringify(r.not_run.map(function (n) { return n.step; })) === '[1,2]'
      && r.context_insufficient.indexOf('goal_not_quantified') === -1 && r.provisional_ranking === false,
      JSON.stringify(r));
  }

  // E6 design or futures
  {
    const r = R.design_or_futures;
    C.check('E6 design_or_futures: step 5, bound dd and futures, not_run 1-4, goal_not_quantified, provisional',
      r.proposed_step === 5 && r.rule === 'design_or_futures'
      && r.bound.dominant_designs.length > 0 && r.bound.futures.length > 0
      && JSON.stringify(r.not_run.map(function (n) { return n.step; })) === '[1,2,3,4]'
      && r.not_run[2].stand_in === null && r.not_run[3].stand_in === null && r.not_run[0].stand_in && r.not_run[0].stand_in.kind === 'goal'
      && r.context_insufficient.indexOf('goal_not_quantified') !== -1 && r.provisional_ranking === true,
      JSON.stringify(r));
  }

  // E7 reverse salient on file
  {
    const r = R.rs_finding;
    C.check('E7 rs_finding: step 6, the planted reverse salient is bound',
      r.proposed_step === 6 && r.rule === 'rs_finding' && r.bound.reverse_salients[0] === rooms.rs_finding.ids.reverse_salient,
      JSON.stringify(r));
  }

  // E8 hypothesis in flight
  {
    const r = R.hypothesis_in_flight;
    C.check('E8 hypothesis_in_flight: step 6, rule hypothesis_in_flight', r.proposed_step === 6 && r.rule === 'hypothesis_in_flight', JSON.stringify(r));
  }

  // E9 prior run plus new evidence
  {
    const r = R.prior_run;
    C.check('E9 prior_run: step 1, rule prior_run_plus_new_evidence, only the unsettled evidence listed',
      r.proposed_step === 1 && r.rule === 'prior_run_plus_new_evidence' && r.prior.settled_count === 1
      && r.prior.new_evidence_ids.length === 1 && r.prior.new_evidence_ids[0] === rooms.prior_run.ids.evidence_new,
      JSON.stringify(r.prior));
  }

  // E10 qualified opportunity
  {
    const r = R.qualified_opportunity;
    C.check('E10 qualified opportunity: explore-opportunity offered alongside, step still from the rules',
      r.explore_opportunity_offer.offer === true && r.explore_opportunity_offer.opportunity_ids[0] === rooms.qualified_opportunity.ids.opportunity
      && r.proposed_step === 2 && r.rule === 'stated_goal', JSON.stringify(r.explore_opportunity_offer));
    C.check('E10 an explored (not qualified) opportunity is not offered', R.hypothesis_in_flight.explore_opportunity_offer.offer === false);
  }

  // E11 offer_bound
  {
    const kinds = R.stated_goal.offer_bound.map(function (o) { return o.kind; }).sort();
    const rsKinds = R.rs_finding.offer_bound.map(function (o) { return o.kind; });
    const sys = R.stated_goal.offer_bound.find(function (o) { return o.kind === 'systems'; });
    C.check('E11 stated_goal offers all four kinds with their commands',
      JSON.stringify(kinds) === JSON.stringify(['dominant_designs', 'futures', 'reverse_salients', 'systems'])
      && sys && JSON.stringify(sys.commands) === '["/mos:systems-thinking","/mos:analyze-systems"]',
      JSON.stringify(R.stated_goal.offer_bound));
    C.check('E11 rs_finding leaves reverse_salients out of offer_bound', rsKinds.indexOf('reverse_salients') === -1 && rsKinds.length === 3, JSON.stringify(rsKinds));
  }

  // E12 persona
  {
    C.check('E12 researcher_persona: persona.researcher true', R.researcher_persona.persona.researcher === true, JSON.stringify(R.researcher_persona.persona));
    const others = ENTRY_STATES.filter(function (s) { return s !== 'researcher_persona'; });
    C.check('E12 every other fixture: persona.researcher false', others.every(function (s) { return R[s].persona.researcher === false; }));
  }

  // E13 read-only
  {
    const withDb = ENTRY_STATES.filter(function (s) { return s !== 'no_db'; });
    const failures = [];
    withDb.forEach(function (s) {
      [false, true].forEach(function (fh) {
        const before = dbSnapshot(rooms[s].roomDir);
        const treeBefore = treeSnapshot(rooms[s].roomDir);
        resolveEntry(rooms[s].roomDir, { fromHypothesis: fh });
        resolveEntry(rooms[s].roomDir, {});
        const after = dbSnapshot(rooms[s].roomDir);
        const treeAfter = treeSnapshot(rooms[s].roomDir);
        if (JSON.stringify(before) !== JSON.stringify(after)) failures.push(s + ': db changed');
        if (treeBefore !== treeAfter) failures.push(s + ': tree changed');
      });
    });
    C.check('E13 room.db bytes, node and edge counts, lifecycles and the file tree are identical before and after',
      failures.length === 0, failures.join('; '));
  }

  // E14 static scan
  {
    const src = hygiene.nonCommentLines(MOD_PATH).join('\n');
    const banned = ['writeClaimNode', 'writeEdge', 'writeReasoningNode', 'writeMemoryArtifactNode', 'advanceOpportunityStage',
      'mintGoalAnchor', 'setGoal', 'openRoomDbForCaller', 'writeFileSync', 'appendFileSync', 'mkdirSync', 'renameSync',
      'unlinkSync', 'recordStep', 'brain-client', 'fetch('];
    const hits = banned.filter(function (b) { return src.indexOf(b) !== -1; });
    C.check('E14 no writer, no brain-client and no network call appears in sr-entry.cjs', hits.length === 0, hits.join(','));
    C.check('E14 the only room.db door is openRoomDbReadOnlyForCaller', src.indexOf('openRoomDbReadOnlyForCaller') !== -1);
  }

  // E15 no room.db
  {
    const r = R.no_db;
    C.check('E15 no_db: ok, room_db_missing disclosed, the goal is still a candidate',
      r.ok === true && r.context_insufficient.indexOf('room_db_missing') !== -1 && r.what.candidates[0].kind === 'goal' && r.proposed_step === 2,
      JSON.stringify(r));
    const bad = resolveEntry(path.join(ROOT_DIR, 'does-not-exist'), {});
    C.check('E15 a missing room dir never throws and routes back', bad.ok === true && bad.route === 'define_what');
    const junk = resolveEntry(undefined, undefined);
    C.check('E15 undefined arguments never throw', junk && junk.ok === true);
  }

  // E16 rooting
  {
    const wicked = buildEntryRoom(ROOT_DIR, 'stated_goal', { name: 'stated_goal_wicked', rung: 'Wicked' });
    const w = resolveEntry(wicked.roomDir, {});
    C.check('E16 WellDefined goal -> in_primary true', R.stated_goal.rooting.in_primary === true && R.stated_goal.rung.rung === 'WellDefined', JSON.stringify(R.stated_goal.rooting));
    C.check('E16 Wicked goal -> in_primary false with a note naming the primary rung',
      w.rooting.in_primary === false && typeof w.rooting.note === 'string' && w.rooting.note.indexOf(ROOTING.primary) !== -1 && w.rung.rung === 'Wicked',
      JSON.stringify(w.rooting));
    const ill = buildEntryRoom(ROOT_DIR, 'stated_goal', { name: 'stated_goal_ill', rung: 'IllDefined' });
    C.check('E16 IllDefined goal -> in_primary true (secondary bridge)', resolveEntry(ill.roomDir, {}).rooting.in_primary === true);
  }

  // E17 renderEntry
  {
    const back = renderEntry(R.empty);
    C.check('E17 route-back card names /mos:analyze-needs and proposes no step',
      typeof back === 'string' && back.indexOf('/mos:analyze-needs') !== -1 && !/proposed (entry )?step/i.test(back), back);
    const goal = renderEntry(R.stated_goal);
    C.check('E17 stated_goal card has the proposed step, its why, the WHAT candidate and the bound commands',
      /step 2/i.test(goal) && goal.indexOf(R.stated_goal.why) !== -1 && goal.indexOf(MARKER) !== -1
      && goal.indexOf('/mos:find-bottlenecks') !== -1 && /skipped|not run/i.test(goal), goal);
    const opp = renderEntry(R.qualified_opportunity);
    C.check('E17 the explore-opportunity line appears when offered', opp.indexOf('/mos:explore-opportunity') !== -1 && goal.indexOf('/mos:explore-opportunity') === -1);
    const wicked = resolveEntry(path.join(ROOT_DIR, 'stated_goal_wicked'), {});
    const cards = [back, goal, opp, renderEntry(wicked), renderEntry(R.design_or_futures), renderEntry(R.fresh_gq), renderEntry(R.no_db)];
    const rungLeak = cards.some(function (c) { return /WellDefined|IllDefined|UnDefined|Wicked/.test(c); });
    C.check('E17 no card prints the rung', !rungLeak);
    C.check('E17 no card holds an em-dash or en-dash', !cards.some(function (c) { return NO_DASH.test(c); }));
    C.check('E17 renderEntry never throws on junk', typeof renderEntry(null) === 'string' && typeof renderEntry({}) === 'string');
  }

  // E18 network
  C.check('E18 zero network attempts', net.attempts() === 0, String(net.attempts()));

  process.exit(C.summary());
}

try { main(); } catch (e) { console.log('FAIL: unexpected throw ' + (e && e.stack || e)); process.exit(1); }
