#!/usr/bin/env node
'use strict';

// Phase 369.2 Plan 09 - one run grant per run, showing every exact string (R02, A5).
// Ruling 2026-10-05: "the one gate is the grant card showing the exact strings"; OK-04 preserved.
//
// G1  a whole-term quick plan: the card lists every composed q byte for byte; payload.queries equals the plan's q list
// G2  the card's proposal is a run grant whose approved_hashes are exactly the plan's q_hash set
// G3  a standing grant covering every slot term does NOT cover a web query (hash_not_approved);
//     no path answers new_term; the card offered is still the run card (never a stuck standing scope)
// G4  card wording: the question, the two options, the exact-strings line; no template id, policy code or "standing" in the body
// G5  CLI `grant approve <run proposal>` approves the run; run-quick answers done; the replay log holds exactly the card's strings
// G6  a q outside approved_hashes (tampered plan) refuses hash_not_approved with zero fetch (OK-03)
// G7  the Theo card is byte-identical to the one on the commit this plan started from (Theo lane unchanged)
//
// Hermetic: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME are mkdtemp dirs before any repo module loads;
// vendor keys are deleted; the CLI leg routes OpenAlex through the replay preload and logs every search string.
//
// exit 0 -> PASSED, exit 1 -> FAILED
// House rule: hyphens only, no em or en dashes.

const real = require('./helpers/real-corpus-3692.cjs');
const hermetic = real.hermeticEnv();
['HOME', 'USERPROFILE', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_BRAIN_URL'].forEach(function (k) {
  process.env[k] = hermetic[k];
});
real.VENDOR_KEYS.forEach(function (k) { delete process.env[k]; });

const { installNetGuard, makeChecker } = require('./helpers/hygiene-355.cjs');
const NET = installNetGuard();
const { check, summary } = makeChecker('test-3692-grant-card');

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const RP = path.join(ROOT, 'lib', 'core', 'research-planner');
const grants = require(path.join(RP, 'grants.cjs'));
const families = require(path.join(RP, 'families.cjs'));
const planner = require(path.join(RP, 'planner.cjs'));
const quickMod = require(path.join(RP, 'quick.cjs'));
const { buildRoom363 } = require('./helpers/fixture-room-363.cjs');

const CLI = path.join(ROOT, 'scripts', 'research-planner.cjs');
const ROUTE_MODULE = path.join(__dirname, 'helpers', 'replay-route-3692.cjs');
const QS_WS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '363-question-sets', 'whitespace-quick.json'), 'utf8'));
// the commit this plan started from; theoGrantCard is untouched by plan 09, so the card text must not move
const THEO_BASE = '0d9e48602';

const rooms = [];
const scratch = [];
function newRoom() {
  const r = buildRoom363({ role: 'researcher' });
  rooms.push(r);
  return r;
}
function mkScratch(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  scratch.push(d);
  return d;
}
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function sorted(a) { return a.slice().sort(); }
function same(a, b) { return JSON.stringify(sorted(a)) === JSON.stringify(sorted(b)); }

function builtPlan(room) {
  const built = planner.buildPlan(room.roomDir, clone(QS_WS), { mode: 'quick' });
  if (!built || built.ok === false || !built.run_id) throw new Error('buildPlan failed: ' + JSON.stringify(built).slice(0, 300));
  const loaded = planner.loadPlan(room.roomDir, built.run_id);
  if (!loaded.ok) throw new Error('loadPlan failed: ' + JSON.stringify(loaded));
  if (loaded.plan.status !== 'ready') throw new Error('plan status ' + loaded.plan.status);
  return loaded.plan;
}

// every round-one fetch query of the plan, de-duplicated by hash, in plan order
function fetchQs(plan) {
  const seen = {};
  const out = [];
  (plan.leaves || []).forEach(function (leaf) {
    if (!leaf || leaf.researchable !== true || leaf.corpus !== 'openalex') return;
    (leaf.queries || []).forEach(function (q) {
      if (!q || (q.round !== undefined && q.round !== 1) || seen[q.q_hash]) return;
      seen[q.q_hash] = true;
      out.push(q);
    });
  });
  return out;
}

async function leg(name, fn) {
  try {
    const r = await fn();
    check(name, r === true, String(r));
  } catch (e) {
    check(name, false, (e && e.message) || String(e));
  }
}

function cliRun(args, env, extra) {
  const res = spawnSync(process.execPath, [CLI].concat(args), { encoding: 'utf8', env: Object.assign({}, env, extra || {}), timeout: 90000 });
  let json = null;
  const lines = String(res.stdout || '').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  for (let i = lines.length - 1; i >= 0 && !json; i -= 1) {
    if (lines[i][0] === '{') { try { json = JSON.parse(lines[i]); } catch (_e) { json = null; } }
  }
  if (!json) { try { json = JSON.parse(String(res.stdout || '').trim()); } catch (_e) { json = null; } }
  return { code: res.status, json: json, stdout: String(res.stdout || ''), stderr: String(res.stderr || '') };
}

// load a module as it stood on a commit, resolving relative requires against the current tree
function loadAt(ref, rel) {
  const file = path.join(ROOT, rel);
  const probe = spawnSync('git', ['cat-file', '-e', ref + ':' + rel], { cwd: ROOT });
  if (probe.status !== 0) return null;
  const src = spawnSync('git', ['show', ref + ':' + rel], { cwd: ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 }).stdout;
  const m = new Module(file, module);
  m.filename = file;
  m.paths = Module._nodeModulePaths(path.dirname(file));
  m._compile(src, file);
  return m.exports;
}

async function main() {
  // ---- G1 ----
  await leg('G1 the card lists every composed q byte for byte; payload.queries equals the plan q list', async function () {
    const room = newRoom();
    const plan = builtPlan(room);
    const qs = fetchQs(plan).map(function (q) { return q.q; });
    if (qs.length === 0) return 'plan has no fetch queries';
    const c = planner.cardFor(room.roomDir, plan, {});
    if (c.next !== 'grant' || !c.card) return 'next ' + c.next + ' reason ' + c.reason;
    const body = String(c.card.body_md || '');
    const missing = qs.filter(function (q) { return body.indexOf('- ' + q + '\n') === -1 && !body.endsWith('- ' + q); });
    const payloadQs = c.card.payload && Array.isArray(c.card.payload.queries) ? c.card.payload.queries : null;
    console.log('G1 measured: plan q count=' + qs.length + ' payload.queries=' + (payloadQs ? payloadQs.length : 'none') + ' missing from body=' + missing.length);
    return (missing.length === 0 && payloadQs !== null && JSON.stringify(payloadQs) === JSON.stringify(qs))
      || ('missing=' + JSON.stringify(missing) + ' payload=' + JSON.stringify(payloadQs));
  });

  // ---- G2 ----
  await leg('G2 the proposal is a run grant whose approved_hashes are exactly the plan q_hash set', async function () {
    const room = newRoom();
    const plan = builtPlan(room);
    const hashes = fetchQs(plan).map(function (q) { return q.q_hash; });
    const c = planner.cardFor(room.roomDir, plan, {});
    if (c.next !== 'grant' || !c.proposal) return 'next ' + c.next;
    const p = c.proposal;
    return (p.lifetime === 'run' && p.run_id === plan.run_id && Array.isArray(p.approved_hashes) && same(p.approved_hashes, hashes) && p.approved_hashes.length === hashes.length)
      || ('lifetime ' + p.lifetime + ' hashes ' + JSON.stringify(p.approved_hashes) + ' vs ' + JSON.stringify(hashes));
  });

  // ---- G3 ----
  await leg('G3 a standing grant covering every slot term does not cover a web query; no new_term; the card is the run card', async function () {
    const room = newRoom();
    const plan = builtPlan(room);
    const entries = fetchQs(plan);
    const terms = {};
    entries.forEach(function (q) { (q.slot_terms || []).forEach(function (t) { terms[t] = true; }); });
    const proposal = grants.buildStandingProposal(room.roomDir, {
      terms: Object.keys(terms).map(function (t) { return { term: t, synonyms: [] }; }),
      families: grants.planFamilies(plan),
    });
    const w = grants.writeGrant(room.roomDir, proposal, { approved_via: { surface: 'cli', decision_node_id: 'd-3692-09-g3' } });
    if (!w.ok) return 'standing write ' + JSON.stringify(w);
    const roomId = grants.roomIdFor(room.roomDir);
    const verdicts = entries.map(function (q, i) {
      return grants.validateExecutedQuery({
        q: q.q, q_hash: q.q_hash, template_id: q.template_id, family: q.family, provider: 'openalex',
        audit: q.audit, slot_terms: q.slot_terms || [], round: 1, trigger: 'navigator',
      }, w.grant, { room_id: roomId, now: Date.now(), searches_used: i, round: 1, runs_in_window: 0 });
    });
    const reasons = verdicts.map(function (v) { return v.ok ? 'ok' : v.reason; });
    const c = planner.cardFor(room.roomDir, plan, {});
    console.log('G3 measured: standing verdict reasons=' + JSON.stringify(reasons) + ' cardFor next=' + c.next + ' reason=' + c.reason
      + ' proposal lifetime=' + (c.proposal && c.proposal.lifetime));
    const allHashNotApproved = reasons.every(function (r) { return r === 'hash_not_approved'; });
    const noNewTerm = reasons.indexOf('new_term') === -1 && c.reason !== 'new_term';
    const runCard = c.next === 'grant' && c.proposal && c.proposal.lifetime === 'run';
    return (allHashNotApproved && noNewTerm && runCard) || ('reasons ' + JSON.stringify(reasons) + ' next ' + c.next + ' reason ' + c.reason);
  });

  // ---- G4 ----
  await leg('G4 card wording: question, two options, exact-strings line; no template id, policy code or standing in the body', async function () {
    const room = newRoom();
    const plan = builtPlan(room);
    const n = fetchQs(plan).length;
    const c = planner.cardFor(room.roomDir, plan, {});
    if (!c.card) return 'no card, next ' + c.next;
    const card = c.card;
    const body = String(card.body_md || '');
    const opts = (card.options || []).map(function (o) { return o.id + '|' + o.label + '|' + (o.recommended === true ? 'rec' : ''); });
    const wantOpts = ['approve_run|Send these ' + n + ' searches (Recommended)|rec', 'not_now|Not now|'];
    const allIds = [];
    Object.keys(families.FAMILIES).forEach(function (fid) {
      families.FAMILIES[fid].templates.forEach(function (t) { allIds.push(t.id); });
      allIds.push(fid);
    });
    const templateIds = allIds.filter(function (id) { return body.indexOf(id) !== -1; });
    const banned = ['Policy version', 'standing', 'Standing', 'Search shapes'].filter(function (s) { return body.indexOf(s) !== -1; });
    const problems = [];
    if (card.question !== 'Send these ' + n + ' searches to OpenAlex for this run?') problems.push('question ' + card.question);
    if (JSON.stringify(opts) !== JSON.stringify(wantOpts)) problems.push('options ' + JSON.stringify(opts));
    if (body.indexOf('The searches, exactly as they will be sent:') === -1) problems.push('no exact-strings line');
    if (templateIds.length > 0) problems.push('template id in body ' + templateIds.join(','));
    if (banned.length > 0) problems.push('banned in body ' + banned.join(','));
    if (body.indexOf('A grant never files anything.') === -1) problems.push('no never-files line');
    return problems.length === 0 || problems.join('; ');
  });

  // ---- G5 ----
  await leg('G5 CLI grant approve takes a run proposal; run-quick answers done; the replay log holds exactly the card strings', async function () {
    const room = newRoom();
    const dir = mkScratch('t3692-09-g5-');
    const preload = real.writePreload(path.join(dir, 'preload'), ROUTE_MODULE);
    const logFile = path.join(dir, 'replay.jsonl');
    const env = Object.assign({}, hermetic, {
      NODE_OPTIONS: '--require ' + preload,
      MOS_3692_REPLAY_LOG: logFile,
      MINDRIAN_BRAIN_URL: 'http://127.0.0.1:9',
    });
    delete env.CLAUDE_CODE_SESSION_ID;
    const qsPath = path.join(dir, 'qs.json');
    fs.writeFileSync(qsPath, JSON.stringify(QS_WS), 'utf8');
    const planned = cliRun(['plan', qsPath, '--room', room.roomDir, '--mode', 'quick'], env);
    if (planned.code !== 0 || !planned.json || !planned.json.proposal) return 'plan failed ' + planned.code + ' ' + planned.stdout.slice(0, 200);
    const runId = planned.json.run_id;
    const cardQs = planned.json.card && planned.json.card.payload && Array.isArray(planned.json.card.payload.queries) ? planned.json.card.payload.queries : [];
    const propPath = path.join(dir, 'proposal.json');
    fs.writeFileSync(propPath, JSON.stringify(planned.json.proposal), 'utf8');
    const approved = cliRun(['grant', 'approve', propPath, '--room', room.roomDir, '--approved-via', 'cli'], env);
    const g = approved.json && approved.json.grant;
    console.log('G5 measured: approve code=' + approved.code + ' ok=' + (approved.json && approved.json.ok) + ' reason=' + (approved.json && approved.json.reason)
      + ' grant lifetime=' + (g && g.lifetime) + ' run_id match=' + (g && g.run_id === runId));
    if (!(approved.json && approved.json.ok === true && g && g.lifetime === 'run' && g.run_id === runId)) {
      return 'approve ' + JSON.stringify(approved.json).slice(0, 200);
    }
    const ran = cliRun(['run-quick', runId, '--room', room.roomDir], env);
    const logged = real.readReplayLog(logFile).map(function (r) { return r.q; });
    const loggedSet = Array.from(new Set(logged));
    console.log('G5 measured: run-quick status=' + (ran.json && ran.json.status) + ' card strings=' + cardQs.length + ' logged=' + logged.length + ' distinct=' + loggedSet.length);
    return (ran.json && ran.json.status === 'done' && cardQs.length > 0 && same(loggedSet, cardQs))
      || ('run-quick ' + JSON.stringify(ran.json).slice(0, 200) + ' logged ' + JSON.stringify(loggedSet) + ' card ' + JSON.stringify(cardQs));
  });

  // ---- G6 ----
  await leg('G6 a q not in approved_hashes still refuses hash_not_approved, zero fetch (OK-03)', async function () {
    const room = newRoom();
    const plan = builtPlan(room);
    const entries = fetchQs(plan);
    const grant = grants.writeGrant(room.roomDir, grants.buildRunGrant(plan), { approved_via: { surface: 'cli', decision_node_id: 'd-3692-09-g6' } });
    if (!grant.ok) return 'grant ' + JSON.stringify(grant);
    const roomId = grants.roomIdFor(room.roomDir);
    const st = { room_id: roomId, now: Date.now(), searches_used: 0, round: 1, runs_in_window: 0 };
    const mk = function (q) {
      return { q: q.q, q_hash: q.q_hash, template_id: q.template_id, family: q.family, provider: 'openalex', audit: q.audit, slot_terms: q.slot_terms || [], round: 1, trigger: 'navigator' };
    };
    const okOne = grants.validateExecutedQuery(mk(entries[0]), grant.grant, st);
    const tampered = Object.assign(mk(entries[0]), { q: entries[0].q + ' extra', q_hash: 'sha256:' + '0'.repeat(64) });
    const refused = grants.validateExecutedQuery(tampered, grant.grant, st);
    // a grant minted from a different plan under the same run id does not cover this plan's strings
    const room2 = newRoom();
    const qs2 = clone(QS_WS);
    qs2.leaves[0].slots.term = 'ultrasonic membrane fouling';
    const built2 = planner.buildPlan(room2.roomDir, qs2, { mode: 'quick' });
    const plan2 = planner.loadPlan(room2.roomDir, built2.run_id).plan;
    const other = grants.buildRunGrant(plan2);
    other.run_id = plan.run_id;
    const w2 = grants.writeGrant(room.roomDir, other, { approved_via: { surface: 'cli', decision_node_id: 'd-3692-09-g6b' } });
    if (!w2.ok) return 'other grant ' + JSON.stringify(w2);
    let calls = 0;
    const fetchSpy = async function () { calls += 1; throw new Error('fetch must not be reached'); };
    // revoke the first grant so only the mismatched one is active for the run
    grants.revokeGrant(room.roomDir, grant.grant.grant_id, {});
    const out = await quickMod.runQuick(room.roomDir, plan, { fetchEnvelopeFn: fetchSpy, now: Date.now() });
    console.log('G6 measured: unit ok=' + okOne.ok + ' tampered=' + refused.reason + ' runQuick status=' + out.status + ' reason=' + out.reason + ' fetch calls=' + calls);
    return (okOne.ok === true && refused.ok === false && refused.reason === 'hash_not_approved' && out.status === 'reask' && out.reason === 'hash_not_approved' && calls === 0)
      || ('okOne ' + JSON.stringify(okOne) + ' refused ' + JSON.stringify(refused) + ' out ' + out.status + '/' + out.reason + ' calls ' + calls);
  });

  // ---- G7 ----
  await leg('G7 the Theo card is byte-identical to the card on ' + THEO_BASE, async function () {
    const base = loadAt(THEO_BASE, 'lib/core/research-planner/grants.cjs');
    if (!base) { console.log('SKIP: G7 base object not available (shallow clone)'); return true; }
    const proposal = {
      schema: grants.GRANT_SCHEMA, lifetime: 'run', policy_version: grants.CURRENT_POLICY, room_id: 'room-g7',
      providers: ['openalex', 'theo'], families: ['whitespace-gap/v1'], approved_hashes: ['sha256:aa'], run_id: 'run-g7',
      caps: { queries_per_run: 3, results_per_query: 5, max_searches: 3, time_budget_ms: 60000, max_theo_calls: 2 },
    };
    const theoOnly = Object.assign({}, proposal, { providers: ['theo'] });
    const optsList = [
      { theoPairs: ['Alpha Framework|Beta Framework', 'Gamma Framework|Delta Framework'], newTerms: [], now: 1790000000000 },
      { theoPairs: ['Alpha Framework|Beta Framework'], newTerms: [], now: 1790000000000 },
    ];
    const pairs = [[proposal, optsList[0]], [theoOnly, optsList[1]]];
    const diffs = [];
    pairs.forEach(function (pr, i) {
      const a = JSON.stringify(grants.grantCard(pr[0], pr[1]));
      const b = JSON.stringify(base.grantCard(pr[0], pr[1]));
      if (a !== b) diffs.push('case ' + i);
    });
    return diffs.length === 0 || ('theo card differs: ' + diffs.join(','));
  });

  check('G-net no fetch escaped the replay (net guard attempts 0)', NET.attempts() === 0, 'attempts=' + NET.attempts());
  rooms.forEach(function (r) { try { r.cleanup(); } catch (_e) { /* best effort */ } });
  scratch.forEach(function (d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* best effort */ } });
  process.exit(summary());
}

main().catch(function (e) {
  console.log('FAIL: harness (' + ((e && e.stack) || e) + ')');
  process.exit(1);
});
