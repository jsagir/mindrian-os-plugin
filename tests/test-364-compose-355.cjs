#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 364 Plan 14 -- compose Phase 364 with Phases 355 and 355.1 (navigator
 * ruling 2026-10-03; CMP-1..CMP-4, SRM364-22, SRM364-23). layer: graph
 *
 * S1-S15  a 355 stamped finding (filed through fileStampedOpportunity, the 355
 *         writer, as the 355.1 ambient run calls it) is a hypothesis in flight:
 *         the entry resolver proposes step 6, shows its stamp lines exactly as
 *         the 355 formatter prints them, never upgrades, never shows a score,
 *         the door carries it into step 6, and nothing is written.
 * H1-H4   the eureka handoff names /mos:scientific-roadmap through the registry
 *         door (read-only pins; no code change, no hardcoded slug).
 * B1      the command body and its mirror tell Larry how to treat the rows.
 * Z1      zero network attempts.
 *
 * Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at mkdtemp dirs
 * before any repo module loads. Exit 77 when node:sqlite is missing.
 *
 * House rule: hyphens only, no em-dashes, no emoji.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-cmp-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-cmp-rooms-'));
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
const C = hygiene.makeChecker('test-364-compose-355');

const MOD_PATH = path.join(REPO_ROOT, 'lib/core/research-planner/sr-entry.cjs');
const DOOR_PATH = path.join(REPO_ROOT, 'lib/core/research-planner/sr-door.cjs');
const { buildStampedRoom, STAMPED_STATES, END_A, END_B } = require(path.join(REPO_ROOT, 'tests/helpers/fixture-stamped-364.cjs'));
const doorFixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-door-364.cjs'));

const ROOT_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-364-cmp-'));

function sha(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }

function dbSnapshot(roomDir) {
  const dbPath = path.join(roomDir, '.mindrian', 'room.db');
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('file:' + dbPath + '?mode=ro');
  try {
    return JSON.stringify({
      hash: sha(dbPath),
      nodes: db.prepare('SELECT COUNT(*) AS n FROM nodes').get().n,
      edges: db.prepare('SELECT COUNT(*) AS n FROM edges').get().n,
      opp: db.prepare("SELECT id, json_extract(properties, '$.lifecycle') AS lc, json_extract(properties, '$.review_status') AS rv FROM nodes WHERE type = 'opportunity' ORDER BY id").all()
        .map(function (r) { return r.id + '=' + r.lc + '/' + r.rv; }),
    });
  } finally { db.close(); }
}

function rawProps(roomDir, id) {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync('file:' + path.join(roomDir, '.mindrian', 'room.db') + '?mode=ro');
  try {
    const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(id);
    return JSON.parse(row.properties);
  } finally { db.close(); }
}

// A leg returns true, or false / a detail string on failure; a throw is a FAIL.
async function safe(fn) {
  try {
    const r = await fn();
    if (r === true) return true;
    console.log('  detail: ' + (typeof r === 'string' ? r : 'condition false'));
    return false;
  } catch (e) {
    console.log('  threw: ' + (e && e.message ? e.message : String(e)));
    return false;
  }
}

function lines(text) { return String(text).split('\n'); }
function wholeLines(card, want) {
  const have = new Set(lines(card));
  return want.length > 0 && want.every(function (l) { return have.has(l); });
}
function deepEq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function keysDeep(v, out) {
  if (Array.isArray(v)) v.forEach(function (x) { keysDeep(x, out); });
  else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) { out.push(k); keysDeep(v[k], out); });
  return out;
}

async function main() {
  let mod = null;
  try { mod = require(MOD_PATH); } catch (e) { C.check('S0 sr-entry.cjs loads', false, e.message); }
  if (!mod) { C.check('Z1 zero network attempts', net.attempts() === 0); process.exit(C.summary() || 1); }
  const { resolveEntry, renderEntry } = mod;
  const door = require(DOOR_PATH);
  const fmt = require(path.join(REPO_ROOT, 'lib/core/verification-stamp-format.cjs'));
  const vs = require(path.join(REPO_ROOT, 'lib/core/verification-stamp.cjs'));
  const { GLYPH, UNVERIFIED_ADVICE } = fmt;

  const R = {};
  for (let i = 0; i < STAMPED_STATES.length; i += 1) {
    const s = STAMPED_STATES[i];
    try { R[s] = await buildStampedRoom(ROOT_DIR, s); } catch (e) { console.log('FAIL: fixture ' + s + ' (' + e.message + ')'); R[s] = null; }
  }
  const E = {};
  STAMPED_STATES.forEach(function (s) { E[s] = R[s] ? resolveEntry(R[s].roomDir, {}) : null; });
  function row(s) { return E[s] && E[s].in_flight ? E[s].in_flight[0] : undefined; }

  // S1 the finding is a hypothesis in flight, entering at step 6
  C.check('S1 a strong ambient stamped finding proposes step 6 with rule hypothesis_in_flight', await safe(function () {
    const e = E.stamped_strong_ambient;
    const r = row('stamped_strong_ambient');
    if (!(e.proposed_step === 6 && e.rule === 'hypothesis_in_flight')) return 'step/rule ' + e.proposed_step + '/' + e.rule;
    if (!(Array.isArray(e.in_flight) && e.in_flight.length === 1)) return 'in_flight length';
    if (!(r.opportunity_id === R.stamped_strong_ambient.ids.opportunity && r.source === 'stamped_finding'
      && r.lifecycle === 'candidate' && r.engine_mode === 'ambient' && r.pws_stage === 'extend_opportunity')) return JSON.stringify(r);
    const nr = e.not_run;
    if (!(nr.length === 5 && nr.map(function (n) { return n.step; }).join(',') === '1,2,3,4,5')) return 'not_run ' + JSON.stringify(nr);
    if (!(nr[0].stand_in && nr[0].stand_in.kind === 'goal' && nr[1].stand_in && nr[1].stand_in.kind === 'goal')) return 'stand_in';
    return e.explore_opportunity_offer.offer === false;
  }));

  // S2 depends on the two ends the 355 writer recorded
  C.check('S2 depends_on is the pair the writer recorded', await safe(function () {
    return deepEq(row('stamped_strong_ambient').depends_on, [END_A, END_B]) || JSON.stringify(row('stamped_strong_ambient').depends_on);
  }));

  // S3 verbatim stamp lines through the 355 formatter
  C.check('S3 stamp lines are the formatter output, unchanged, and whole lines of the card', await safe(function () {
    const room = R.stamped_strong_ambient;
    const stamp = vs.fromNodeProps(rawProps(room.roomDir, room.ids.opportunity));
    const want = fmt.formatStampLines(stamp, 'cli');
    const r = row('stamped_strong_ambient');
    if (!deepEq(r.stamp_lines, want)) return 'lines differ: ' + JSON.stringify(r.stamp_lines);
    if (!(want[0].indexOf(GLYPH.strong) === 0 && want[0].indexOf('strong') !== -1)) return 'first line ' + want[0];
    if (r.stamp_readable !== true) return 'stamp_readable';
    return wholeLines(renderEntry(E.stamped_strong_ambient), want) || 'card lacks a whole stamp line';
  }));

  // S4 surfaces
  C.check('S4 desktop wording on request, cowork equals cli, an unknown surface is cli', await safe(function () {
    const room = R.stamped_strong_ambient;
    const stamp = vs.fromNodeProps(rawProps(room.roomDir, room.ids.opportunity));
    const e = E.stamped_strong_ambient;
    const desk = renderEntry(e, { surface: 'desktop' });
    if (!wholeLines(desk, fmt.formatStampLines(stamp, 'desktop'))) return 'desktop lines missing';
    const cli = renderEntry(e);
    if (renderEntry(e, { surface: 'cowork' }) !== cli) return 'cowork differs from cli';
    if (renderEntry(e, { surface: 'cli' }) !== cli) return 'explicit cli differs';
    if (renderEntry(e, { surface: 'nope' }) !== cli) return 'unknown surface is not cli';
    return desk !== cli || 'desktop equals cli';
  }));

  // S5 never upgrade (unverified)
  C.check('S5 an unverified stamp is never upgraded', await safe(function () {
    const r = row('stamped_unverified_theo');
    if (!(r && r.stamp && r.stamp.verification === 'unverified')) return 'stamp ' + JSON.stringify(r && r.stamp);
    const card = renderEntry(E.stamped_unverified_theo);
    const L = lines(card);
    if (!deepEq(r.stamp_lines, fmt.formatStampLines(r.stamp, 'cli'))) return 'lines differ';
    if (!L.some(function (l) { return l.indexOf(GLYPH.unverified + ' unverified') === 0; })) return 'no unverified line';
    if (!L.some(function (l) { return l === UNVERIFIED_ADVICE; })) return 'no advice line';
    if (L.some(function (l) { return l.indexOf(GLYPH.strong) === 0 || l.indexOf(GLYPH.indirect) === 0 || l.indexOf('path ') === 0; })) return 'upgraded line';
    return (card.indexOf('tier   strong') === -1 && card.indexOf('tier   indirect') === -1) || 'tier line';
  }));

  // S6 never upgrade (not checked)
  C.check('S6 a not-checked stamp reads not checked and is never upgraded', await safe(function () {
    const r = row('stamped_not_called');
    if (!(r && r.stamp && r.stamp_lines.length > 0 && r.stamp_lines[0].indexOf('not checked') !== -1)) return JSON.stringify(r && r.stamp_lines);
    const card = renderEntry(E.stamped_not_called);
    const L = lines(card);
    if (!wholeLines(card, r.stamp_lines)) return 'card lacks the lines';
    if (L.some(function (l) { return l.indexOf(GLYPH.strong) === 0 || l.indexOf(GLYPH.indirect) === 0 || l.indexOf('path ') === 0; })) return 'upgraded line';
    return (card.indexOf('tier   strong') === -1 && card.indexOf('tier   indirect') === -1) || 'tier line';
  }));

  // S7 tampered stamp is disclosed as unreadable
  C.check('S7 a lying stamp is disclosed as stamp_unreadable with no verified glyph or tier word', await safe(function () {
    const e = E.stamped_tampered;
    const r = row('stamped_tampered');
    if (!(e.in_flight.length === 1 && r.stamp === null && r.stamp_readable === false && deepEq(r.stamp_lines, []))) return JSON.stringify(r);
    if (e.context_insufficient.indexOf('stamp_unreadable') === -1) return 'no stamp_unreadable code';
    const card = renderEntry(e);
    if (card.indexOf(GLYPH.strong) !== -1 || card.indexOf(GLYPH.indirect) !== -1) return 'a verified glyph';
    return !/\bstrong\b/.test(card) || 'the word strong';
  }));

  // S8 no score
  C.check('S8 no score, decimal or percent from the finding reaches the entry or the card', await safe(function () {
    const e = E.stamped_strong_ambient;
    if (!row('stamped_strong_ambient')) return 'no in-flight row to check';
    const json = JSON.stringify(e);
    if (json.indexOf('0.87') !== -1) return 'entry carries 0.87';
    if (keysDeep(e, []).some(function (k) { return k === 'score'; })) return 'a key named score';
    const cards = [renderEntry(e), renderEntry(e, { surface: 'desktop' })];
    for (let i = 0; i < cards.length; i += 1) {
      if (cards[i].indexOf('0.87') !== -1 || cards[i].indexOf('%') !== -1 || /score/i.test(cards[i])) return 'card ' + i + ' carries a score';
    }
    return true;
  }));

  // S9 qualified: in flight and offered alongside
  C.check('S9 a qualified finding is in flight and offered to explore-opportunity, and nothing fires', await safe(function () {
    const room = R.stamped_qualified;
    const before = dbSnapshot(room.roomDir);
    const e = resolveEntry(room.roomDir, {});
    const card = renderEntry(e);
    if (e.proposed_step !== 6) return 'step ' + e.proposed_step;
    const id = room.ids.opportunity;
    if (e.in_flight.map(function (r) { return r.opportunity_id; }).indexOf(id) === -1) return 'not in flight';
    if (!(e.explore_opportunity_offer.offer === true && e.explore_opportunity_offer.opportunity_ids.indexOf(id) !== -1)) return 'no offer';
    if (card.indexOf('/mos:explore-opportunity') === -1) return 'card does not name the command';
    const after = dbSnapshot(room.roomDir);
    return (before === after && rawProps(room.roomDir, id).lifecycle === 'qualified') || 'lifecycle moved';
  }));

  // S10 retired is not in flight
  C.check('S10 a retired finding is not in flight and the room falls back to the stated goal', await safe(function () {
    const e = E.stamped_retired;
    return (e.in_flight.length === 0 && e.proposed_step === 2 && e.rule === 'stated_goal') || JSON.stringify([e.in_flight.length, e.proposed_step, e.rule]);
  }));

  // S11 no WHAT: route back, never the WHAT
  C.check('S11 with no WHAT the room still routes back and the finding is not offered as the WHAT', await safe(function () {
    const e = E.stamped_no_what;
    const card = renderEntry(e);
    if (!(e.route === 'define_what' && e.proposed_step === null && deepEq(e.what.candidates, []))) return JSON.stringify([e.route, e.proposed_step, e.what.candidates]);
    return card.indexOf(R.stamped_no_what.ids.opportunity) === -1 || 'the card names the finding as a WHAT';
  }));

  // S12 the 366 eureka-perspective shape
  C.check('S12 the eureka-perspective filing shape is a stamped finding too', await safe(function () {
    const e = E.stamped_366_shape;
    const r = row('stamped_366_shape');
    if (!(r && r.source === 'stamped_finding' && r.engine_mode === 'navigator')) return JSON.stringify(r);
    if (!deepEq(r.depends_on, [END_A, END_B])) return 'depends_on ' + JSON.stringify(r.depends_on);
    return e.proposed_step === 6 || 'step ' + e.proposed_step;
  }));

  // S13 stamped finding plus a reverse salient
  C.check('S13 a stamped finding beside a reverse salient keeps rule hypothesis_in_flight', await safe(function () {
    const e = E.stamped_plus_rs;
    return (e.rule === 'hypothesis_in_flight' && e.bound.reverse_salients.length > 0 && e.in_flight.length === 1)
      || JSON.stringify([e.rule, e.bound.reverse_salients, e.in_flight.length]);
  }));

  // S14 the door carries it into step 6
  C.check('S14 the door carries the in-flight row into step 6 and refuses until it is addressed', await safe(function () {
    const e = E.stamped_plus_rs;
    const ids = R.stamped_plus_rs.ids;
    const theo = doorFixture.theoAuthored();
    const created = door.createRun({
      entry: e, theo: theo, chosenStep: 6, confirmedWhat: e.what.candidates[0],
      coverage: { status: 'uncovered', problem_type: 'WellDefined' }, now: new Date('2026-10-03T00:00:00Z'),
    });
    if (!created.ok) return 'createRun ' + JSON.stringify(created);
    const st = created.state;
    const kept = st.entry.in_flight;
    if (!(Array.isArray(kept) && kept.length === 1 && kept[0].opportunity_id === ids.opportunity)) return 'in_flight not kept ' + JSON.stringify(kept);
    if (JSON.stringify(kept[0].stamp_lines) !== JSON.stringify(e.in_flight[0].stamp_lines)) return 'stamp lines not byte-equal';
    const bound = door.boundForStage(st, 'sr:6');
    if (!deepEq(bound.first_rows, [ids.reverse_salient, ids.opportunity])) return 'first_rows ' + JSON.stringify(bound.first_rows);
    const sys = door.recordStage(st, 'systems_pass', { decision: 'approve', status: 'declined', reason: 'fixture: no systems artifact' });
    if (!sys.ok) return 'systems ' + JSON.stringify(sys);
    const state = sys.state;
    const frozen = JSON.stringify(state);
    const limiter = function (src) { return { id: 'L-' + src, statement: 'Brine outfall limits throughput', source_node_id: src }; };
    const refused = door.recordStage(state, 'sr:6', { decision: 'approve', output: { limiters: [limiter(ids.reverse_salient)] } });
    if (!(refused.ok === false && refused.reason === 'bound_input_unaddressed:' + ids.opportunity)) return 'not refused ' + JSON.stringify(refused);
    if (JSON.stringify(state) !== frozen) return 'state changed by a refusal';
    const taken = door.recordStage(state, 'sr:6', { decision: 'approve', output: { limiters: [limiter(ids.reverse_salient), limiter(ids.opportunity)] } });
    if (taken.ok !== true) return 'limiter row refused ' + JSON.stringify(taken);
    const dismissed = door.recordStage(state, 'sr:6', {
      decision: 'approve', output: { limiters: [limiter(ids.reverse_salient)] },
      dismissed: [{ id: ids.opportunity, reason: 'the finding is out of scope for this run' }],
    });
    if (dismissed.ok !== true) return 'dismissal refused ' + JSON.stringify(dismissed);
    return dismissed.state.discarded.some(function (d) {
      return d.kind === 'hypothesis_in_flight' && d.id === ids.opportunity && d.reason === 'the finding is out of scope for this run';
    }) || 'discarded ' + JSON.stringify(dismissed.state.discarded);
  }));

  // S15 read-only and static
  C.check('S15 resolving and rendering write nothing, and the modules stay writer-free and glyph-free', await safe(function () {
    for (let i = 0; i < STAMPED_STATES.length; i += 1) {
      const room = R[STAMPED_STATES[i]];
      const before = dbSnapshot(room.roomDir);
      const e = resolveEntry(room.roomDir, {});
      renderEntry(e); renderEntry(e, { surface: 'desktop' });
      if (dbSnapshot(room.roomDir) !== before) return 'room.db changed for ' + STAMPED_STATES[i];
    }
    const src = hygiene.nonCommentLines(MOD_PATH).join('\n');
    const banned = ['writeClaimNode', 'writeEdge', 'writeReasoningNode', 'writeMemoryArtifactNode', 'advanceOpportunityStage',
      'mintGoalAnchor', 'setGoal', 'openRoomDbForCaller', 'writeFileSync', 'appendFileSync', 'mkdirSync', 'renameSync',
      'unlinkSync', 'recordStep', 'brain-client', 'fetch(', 'fileStampedOpportunity', 'writeOpportunityNode', 'confirmNode',
      'stampFinding', 'callTool'];
    const hits = banned.filter(function (b) { return src.indexOf(b) !== -1; });
    if (hits.length > 0) return 'banned tokens ' + hits.join(',');
    if (src.indexOf('fromNodeProps') === -1 || src.indexOf('formatStampLines') === -1) return 'sr-entry does not read stamps through the 355 modules';
    const writerRe = /(INSERT( OR [A-Z]+)? INTO|UPDATE|DELETE FROM|REPLACE INTO)\s+"?(nodes|edges)\b/i;
    const glyphRe = /[✓•⚠]/;
    const files = [MOD_PATH, DOOR_PATH];
    for (let i = 0; i < files.length; i += 1) {
      const text = fs.readFileSync(files[i], 'utf8');
      if (glyphRe.test(text)) return 'a stamp glyph literal in ' + path.basename(files[i]);
      if (writerRe.test(text)) return 'a writer-inventory phrase in ' + path.basename(files[i]);
    }
    return true;
  }));

  // H1-H4 the eureka handoff through the registry door
  const resolver = require(path.join(REPO_ROOT, 'lib/workflow/command-resolver.cjs'));
  C.check('H1 the registry maps Scientific Roadmapping to /mos:scientific-roadmap', await safe(function () {
    const c = resolver.commandsForFramework('Scientific Roadmapping');
    return (Array.isArray(c) && c[0] === '/mos:scientific-roadmap') || JSON.stringify(c);
  }));

  const { composeEurekaOffer } = require(path.join(REPO_ROOT, 'lib/core/eureka/eureka-offer.cjs'));
  function validPayload() {
    return {
      schema_version: 1,
      scanned_at: '2026-07-10T12:00:00.000Z',
      guard: { available: true, verdict: 'transferable', confidence: 'high', tags: ['passes_all_gates'] },
      bridge: { a_handle: 'n042', b_handle: 'n317', surprise_type: 'structural_transfer', band: 'breakthrough', differential_quantized: 0.57 },
      provenance: { model: 'mdbr-leaf-ir', method: 'scoreMeasured+stageA' },
    };
  }
  C.check('H2 the eureka offer next segue names /mos:scientific-roadmap only when Theo recommends Scientific Roadmapping', await safe(function () {
    const yes = composeEurekaOffer({ payload: validPayload(), recommendFn: function () { return ['Scientific Roadmapping', 'Hypothesis-Driven Problem Solving']; } });
    const w = yes && yes.next && yes.next.workflow;
    if (!(Array.isArray(w) && w[0] && w[0].step === 1 && w[0].framework === 'Scientific Roadmapping'
      && w[0].command === '/mos:scientific-roadmap' && w[0].optional === false)) return 'workflow ' + JSON.stringify(w && w[0]);
    const no = composeEurekaOffer({ payload: validPayload(), recommendFn: function () { return ['Beautiful Question Framework']; } });
    const nw = no && no.next && no.next.workflow;
    return (Array.isArray(nw) && !nw.some(function (s) { return s.command === '/mos:scientific-roadmap'; })) || 'another chain names the slug';
  }));

  const chainRec = require(path.join(REPO_ROOT, 'lib/brain/chain-recommender.cjs'));
  C.check('H3 the live chain adapter maps Scientific Roadmapping without a Brain call', await safe(async function () {
    const a = await chainRec.adaptChainToRunInput([{ framework: 'Scientific Roadmapping' }]);
    return (deepEq(a.chain_input, ['Scientific Roadmapping']) && deepEq(a.unmapped, [])) || JSON.stringify(a);
  }));

  C.check('H4 no eureka-lineage file carries the slug (the registry is the one door)', await safe(function () {
    const eurekaDir = path.join(REPO_ROOT, 'lib/core/eureka');
    const files = fs.readdirSync(eurekaDir).filter(function (f) { return /\.cjs$/.test(f); }).map(function (f) { return path.join(eurekaDir, f); })
      .concat([
        path.join(REPO_ROOT, 'lib/brain/chain-recommender.cjs'),
        path.join(REPO_ROOT, 'lib/workflow/command-resolver.cjs'),
        path.join(REPO_ROOT, 'lib/core/research-planner/filing-stamped.cjs'),
        path.join(REPO_ROOT, 'lib/core/ambient-run.cjs'),
        path.join(REPO_ROOT, 'lib/core/sensors/sensor-eureka.cjs'),
      ]);
    const bad = files.filter(function (f) { return hygiene.nonCommentLines(f).join('\n').indexOf('scientific-roadmap') !== -1; });
    return bad.length === 0 || 'slug in ' + bad.join(',');
  }));

  // B1 the body and its mirror
  C.check('B1 the command body and its mirror tell Larry how a hypothesis in flight is treated', await safe(function () {
    const files = [path.join(REPO_ROOT, 'commands/scientific-roadmap.md'), path.join(REPO_ROOT, 'skills/scientific-roadmap/SKILL.md')];
    const need = ['hypothesis in flight', 'exactly as the card prints them', 'never upgrade'];
    for (let i = 0; i < files.length; i += 1) {
      const t = fs.readFileSync(files[i], 'utf8');
      const miss = need.filter(function (n) { return t.indexOf(n) === -1; });
      if (miss.length > 0) return path.basename(files[i]) + ' lacks ' + miss.join(' | ');
    }
    return true;
  }));

  // Z1 last
  C.check('Z1 zero network attempts', net.attempts() === 0, 'attempts ' + net.attempts());
  process.exit(C.summary());
}

main().catch(function (e) {
  console.log('FAIL: unexpected ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
