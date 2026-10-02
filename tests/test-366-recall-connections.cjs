#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 15 Task 1 (EPV366-09, D-09, D-11): the connections perspective recall.
 *
 *   X1 the planted connections pair (both endpoints carry a canon handle) is a
 *      canon_pair candidate with canon_a and canon_b
 *   X2 two things that USES_FRAMEWORK the same framework node form a framework_walk
 *      candidate (synthetic substrate, through the one shared store)
 *   X3 a thing without a canon handle never appears in a canon_pair candidate
 *   X4 a known pair is excluded (shared store), the cap is honored, output is
 *      deterministic and rows keep the shared keys
 *   X5 questionSetFor: lateral leaves carry corpus theo, slots {term: canon_a,
 *      term2: canon_b} and the closed pair; the one cn-known leaf is corpus room
 *   X6 the module is offline: no tool call code, no brain client, zero network
 *
 * Isolation: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at temp dirs and the
 * session env is cleared BEFORE any repo module loads. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-cn-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-cn-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.OPENALEX_API_KEY;
delete process.env.OPENALEX_EMAIL;

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard();
const C = hygiene.makeChecker('test-366-recall-connections');

const { buildPerspectiveRoom } = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const cn = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/connections-recall.cjs'));
const shared = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/shared.cjs'));
const index = require(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/index.cjs'));

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-cn-'));
const TAG = '20261002T120000Z';

function leg(name, fn) {
  try {
    const ok = fn();
    C.check(name, ok === true, ok === true ? '' : String(ok));
  } catch (e) {
    C.check(name, false, 'threw: ' + String(e && e.stack ? e.stack : e).slice(0, 400));
  }
}
function samePair(c, a, b) { return !!c && ((c.a === a && c.b === b) || (c.a === b && c.b === a)); }

const built = buildPerspectiveRoom(path.join(root, 'r1'));
const roomDir = built.roomDir;
const CN = built.planted.connections;
const rec = cn.runRecall(roomDir, { tag: TAG });

// a synthetic substrate for the legs the fixture cannot plant
function thing(id, section, canon) {
  return { id: id, type: 'Artifact', section: section, title: 'Title ' + id, text: 'text ' + id, tokens: new Set(), degree: 0, canon_handle: canon, title_from_field: true };
}
function synth(things, edges, extra) {
  const e = extra || {};
  return {
    things: things, entities: {}, connected: e.connected || new Set(), opp_pairs: e.opp_pairs || new Set(),
    sections: Array.from(new Set(things.map(function (t) { return t.section; }))).sort(),
    edges: edges, framework_nodes: e.framework_nodes || {}, whitespace_zones: {},
  };
}

leg('X1 planted pair is a canon_pair candidate with canon_a and canon_b', function () {
  const hit = rec.candidates.filter(function (c) { return samePair(c, CN[0], CN[1]); })[0];
  if (!hit) return 'planted pair not recalled';
  const names = [hit.canon_a, hit.canon_b].sort();
  const want = [built.ids.canon.rs, built.ids.canon.lenses].sort();
  return (hit.lanes.indexOf('canon_pair') !== -1 && JSON.stringify(names) === JSON.stringify(want)) || JSON.stringify(hit);
});

leg('X2 two things on one framework node form a framework_walk candidate', function () {
  const sub = synth(
    [thing('t1', 'sec-a', 'Systems Thinking'), thing('t2', 'sec-b', 'Systems Thinking'), thing('t3', 'sec-c', null)],
    [{ source: 't1', target: 'fw:one', type: 'USES_FRAMEWORK' }, { source: 't2', target: 'fw:one', type: 'USES_FRAMEWORK' }, { source: 't3', target: 'fw:two', type: 'USES_FRAMEWORK' }],
    { framework_nodes: { 'fw:one': { id: 'fw:one', name: 'Systems Thinking' }, 'fw:two': { id: 'fw:two', name: 'Other' } } });
  const out = cn.recallCandidates(sub, roomDir, {});
  const hit = out.candidates.filter(function (c) { return samePair(c, 't1', 't2'); })[0];
  if (!hit) return 'walk pair missing: ' + JSON.stringify(out.candidates);
  const onlyWalk = hit.lanes.length === 1 && hit.lanes[0] === 'framework_walk';
  return (onlyWalk && hit.via_framework === 'Systems Thinking') || JSON.stringify(hit);
});

leg('X3 a thing without a canon handle never appears in a canon_pair candidate', function () {
  const sub = synth([thing('a1', 'sec-a', 'Systems Thinking'), thing('b1', 'sec-b', null), thing('c1', 'sec-c', 'Four Lenses of Innovation')], []);
  const out = cn.recallCandidates(sub, roomDir, {});
  const pairs = out.candidates.filter(function (c) { return c.lanes.indexOf('canon_pair') !== -1; });
  const bad = pairs.some(function (c) { return c.a === 'b1' || c.b === 'b1'; });
  return (!bad && pairs.length === 1 && samePair(pairs[0], 'a1', 'c1')) || JSON.stringify(pairs);
});

leg('X3b the same canon name on both ends is not a canon_pair', function () {
  const sub = synth([thing('a1', 'sec-a', 'Systems Thinking'), thing('b1', 'sec-b', 'Systems Thinking')], []);
  const out = cn.recallCandidates(sub, roomDir, {});
  return out.candidates.filter(function (c) { return c.lanes.indexOf('canon_pair') !== -1; }).length === 0 || 'same-canon pair recalled';
});

leg('X4a known pair excluded through the shared store', function () {
  const sub = synth([thing('a1', 'sec-a', 'Systems Thinking'), thing('c1', 'sec-c', 'Four Lenses of Innovation')], [],
    { connected: new Set([shared.pairKey('a1', 'c1')]) });
  const out = cn.recallCandidates(sub, roomDir, {});
  return (out.candidates.length === 0 && out.counts.excluded_known === 1) || JSON.stringify(out.counts);
});

leg('X4b cap honored and output deterministic with shared row keys', function () {
  const things = [];
  const names = ['Systems Thinking', 'Four Lenses of Innovation', 'Reverse Salient Analysis', 'Other One', 'Other Two', 'Other Three'];
  for (let i = 0; i < 12; i += 1) things.push(thing('n' + String(i).padStart(2, '0'), 'sec-' + (i % 6), names[i % 6]));
  const sub = synth(things, []);
  const one = cn.recallCandidates(sub, roomDir, { max_candidates: 5 });
  const two = cn.recallCandidates(sub, roomDir, { max_candidates: 5 });
  const keys = ['a', 'b', 'section_a', 'section_b', 'title_a', 'title_b', 'lanes', 'lexical', 'shared_entities', 'canon_a', 'canon_b'];
  const okKeys = one.candidates.every(function (c) { return keys.every(function (k) { return Object.prototype.hasOwnProperty.call(c, k); }); });
  return (one.candidates.length === 5 && one.pairs_truncated > 0 && okKeys && JSON.stringify(one) === JSON.stringify(two)) || JSON.stringify({ n: one.candidates.length, t: one.pairs_truncated, okKeys: okKeys });
});

leg('X4c per-thing cap bounds the pairs one thing joins', function () {
  const things = [thing('hub', 'sec-0', 'Hub Framework')];
  for (let i = 1; i <= 12; i += 1) things.push(thing('m' + String(i).padStart(2, '0'), 'sec-' + i, 'Name ' + i));
  const out = cn.recallCandidates(synth(things, []), roomDir, { per_thing_top_k: 3 });
  const hubPairs = out.candidates.filter(function (c) { return c.a === 'hub' || c.b === 'hub'; }).length;
  return hubPairs <= 3 || 'hub joined ' + hubPairs;
});

leg('X5 questionSetFor: theo lateral leaves, closed pair, one room known leaf', function () {
  const qs = rec.question_set;
  const lat = qs.leaves.filter(function (l) { return l.dimension === 'cn:lateral_path'; });
  const known = qs.leaves.filter(function (l) { return l.dimension === 'cn:already_known'; });
  if (lat.length === 0) return 'no lateral leaves';
  const planted = lat.filter(function (l) { return l.pair && samePair(l.pair, CN[0], CN[1]); })[0];
  if (!planted) return 'planted pair has no leaf';
  const slotsOk = planted.slots && typeof planted.slots.term === 'string' && typeof planted.slots.term2 === 'string' &&
    [planted.slots.term, planted.slots.term2].sort().join('|') === [built.ids.canon.rs, built.ids.canon.lenses].sort().join('|');
  const allTheo = lat.every(function (l) { return l.corpus === 'theo' && l.researchable === true && l.pair.perspective === 'connections' && l.pair.run_tag === TAG && l.slots.term !== l.slots.term2; });
  const knownOk = known.length === 1 && known[0].corpus === 'room' && known[0].id === 'cn-known';
  const meta = qs.template_id === 'connections' && qs.command === '/mos:find-connections';
  return (slotsOk && allTheo && knownOk && meta) || JSON.stringify({ slotsOk: slotsOk, allTheo: allTheo, knownOk: knownOk, meta: meta });
});

leg('X5b no room text rides a theo leaf slot: slots hold canon names only', function () {
  const canon = require(path.join(REPO_ROOT, 'lib/core/verification-stamp.cjs')).loadFrameworkNames();
  return rec.question_set.leaves.filter(function (l) { return l.corpus === 'theo'; }).every(function (l) { return canon.has(l.slots.term) && canon.has(l.slots.term2); }) || 'non-canon slot';
});

leg('X5c interface constants and registry', function () {
  const iface = index.INTERFACE_NAMES.every(function (k) { return cn[k] !== undefined; });
  return (iface && cn.ID === 'connections' && cn.TEMPLATE_ID === 'connections' && cn.COMMAND === '/mos:find-connections' &&
    JSON.stringify(cn.STAGE_A_LANES) === JSON.stringify(['canon_pair', 'framework_walk']) && index.getPerspective('connections') === cn &&
    Object.isFrozen(cn.BUDGETS) && Object.isFrozen(cn.STAGE_A_LANES)) || 'interface mismatch';
});

leg('X5d run files carry the connections title and lanes', function () {
  const dir = cn.runDirFor(roomDir, TAG);
  const back = cn.readCandidates(roomDir, TAG);
  const status = fs.readFileSync(path.join(dir, 'STATUS.md'), 'utf8');
  return (back && back.candidates.length === rec.candidates.length && /Connections perspective run/.test(status) &&
    JSON.stringify(back.header.lanes) === JSON.stringify(['canon_pair', 'framework_walk'])) || 'run files wrong';
});

leg('X6 the module has no tool-call or brain-client code', function () {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib/core/research-planner/perspectives/connections-recall.cjs'), 'utf8');
  const bad = /callTool|find_connections|brain-client/.test(src);
  return !bad || 'module mentions a tool call';
});

C.check('zero network attempts', net.attempts() === 0, String(net.attempts()));
net.restore();
try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* tmp */ }
process.exit(C.summary());
