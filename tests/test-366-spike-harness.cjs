#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 plan 18 (D-05, EPV366-23): scripts/spike-366.cjs, the spike harness.
 *
 *   S1  items converts each recall arm's candidates to the 355 items shape (keys, pair_id from pairId, buildExcerpt, direction phrase)
 *   S2  the items file is a valid label-355-gold pairings-unstamped input (requiresPhrase holds, status reads every item)
 *   S3  judge: stage-a goes through judgeCandidates; claude imports a verdicts file only from inside the spike root
 *       and rejects a bad one; claude-then-jev feeds Jev only Claude's useful subset; jev replays with no network
 *   S4  refusals: a room outside the spike root, a room inside the 355 fixture tree, a verdicts file outside the root,
 *       a manifest outside tmp, a root outside tmp and fixtures, free text on argv, a .. segment
 *   S5  record: per arm and repeat shown, useful, rate, wilson95, clears_bar; RS and HSI slice comparison for the graph arms;
 *       baseline note verbatim; the 44.8% statement; never an adoption, never "Eureka improved"
 *   S6  --check recomputes record.json byte for byte, and fails on a changed record, verdict or gold
 *   S7  eureka-recall extraLanes: the injected lane goes through the same exclusion upsert and cap; without it the output is unchanged;
 *       the vector lane builds on injected vectors and the CLI vector arm is an ENV GAP (exit 77) with no cached model
 *
 * Isolation: HOME, USERPROFILE and MINDRIAN_ROOMS_HOME point at temp dirs and the session env is cleared BEFORE any
 * repo module loads. Zero network: fetch is guarded, the Jev and Claude arms run on replay files, and the source
 * 355 fixture tree is hashed before and after. Exit 77 when node:sqlite is missing. Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const TMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-sh-home-'));
process.env.HOME = TMP_HOME;
process.env.USERPROFILE = TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-366-sh-roomshome-'));
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.MINDRIAN_MCP_FIRST;
delete process.env.MINDRIAN_MODEL_CACHE;
delete process.env.MINDRIAN_EUREKA_DEPS_ROOT;

try { require('node:sqlite'); } catch (_e) {
  process.stdout.write('ENV GAP: node:sqlite unavailable (node ' + process.version + '); need node >= 22\n');
  process.exit(77);
}

const REPO_ROOT = path.resolve(__dirname, '..');
const hygiene = require(path.join(REPO_ROOT, 'tests/helpers/hygiene-355.cjs'));
hygiene.scrubVendorKey && hygiene.scrubVendorKey();
delete process.env.ANTHROPIC_API_KEY;
const net = hygiene.installNetGuard ? hygiene.installNetGuard() : { attempts: function () { return 0; }, restore: function () {} };
const C = hygiene.makeChecker('test-366-spike-harness');
const check = C.check;

const fixture = require(path.join(REPO_ROOT, 'tests/helpers/fixture-366.cjs'));
const spike = require(path.join(REPO_ROOT, 'scripts/spike-366.cjs'));
const prepare = require(path.join(REPO_ROOT, 'scripts/spike-366-prepare.cjs'));
const m355 = require(path.join(REPO_ROOT, 'scripts/measure-355-hit-rate.cjs'));
const labeler = require(path.join(REPO_ROOT, 'scripts/label-355-gold.cjs'));
const Q = require(path.join(REPO_ROOT, 'scripts/jev-question-ceilings.cjs'));
const PERSP = path.join(REPO_ROOT, 'lib/core/research-planner/perspectives');
const eurekaRecall = require(path.join(PERSP, 'eureka-recall.cjs'));
const eurekaJudge = require(path.join(PERSP, 'eureka-judge.cjs'));
const navigation = require(path.join(REPO_ROOT, 'lib/core/navigation.cjs'));

const FIXTURE_355 = path.join(REPO_ROOT, 'tests/fixtures/355-rooms');
const BAR_SRC = path.join(REPO_ROOT, 'tests/fixtures/366-spike/bar.json');
const BAR = JSON.parse(fs.readFileSync(BAR_SRC, 'utf8'));
const src355Before = prepare.treeSha256(FIXTURE_355);

// ---- static: Wilson is required, never re-derived; no Jev client or key in the harness ----
const scriptText = fs.readFileSync(path.join(REPO_ROOT, 'scripts/spike-366.cjs'), 'utf8');
check('harness requires measure-355-hit-rate and never re-derives Wilson (no 1.959963985)', /require\(.*measure-355-hit-rate/.test(scriptText) && scriptText.indexOf('1.959963985') === -1);
check('harness carries no Jev client, no vendor key literal and no key read', !/TYPESAFE_API_KEY|loadKey\(|jev-devtime-client|api\.typesafe/.test(scriptText) && !/ANTHROPIC_API_KEY\s*[=:]\s*[^;]*process\.env/.test(scriptText.replace(/delete env\.ANTHROPIC_API_KEY/g, '')));

// ---- helpers ----
async function run(argv) {
  const out = []; const err = [];
  const ow = process.stdout.write; const ew = process.stderr.write;
  process.stdout.write = function (s) { out.push(String(s)); return true; };
  process.stderr.write = function (s) { err.push(String(s)); return true; };
  let code;
  try { code = await spike.cliMain(argv); } finally { process.stdout.write = ow; process.stderr.write = ew; }
  let json = null;
  try { json = JSON.parse(out.join('').trim().split('\n').pop()); } catch (_e) { json = null; }
  return { code: code, json: json, stdout: out.join(''), stderr: err.join('') };
}
async function code(fn) {
  try { await fn(); return 0; } catch (e) { return e && typeof e.exitCode === 'number' ? e.exitCode : -1; }
}
function sha256(buf) { return crypto.createHash('sha256').update(buf).digest('hex'); }
function r4(x) { return Math.round(x * 10000) / 10000; }

function makeSpikeRoot(prefix, rooms) {
  const W = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const entries = rooms.map(function (name) {
    const built = fixture.buildPerspectiveRoom(W, { name: name });
    return { name: name, fixture_sha256: '0'.repeat(64), room_dir: built.roomDir, node_count: 40, edge_counts: { INFORMS: 3 }, describes_edges: 12, entity_extract: { tiers_ran: ['tier1_rules'], blocked_network_attempts: 0, tier2_escalated: 0, local_model: 'absent' } };
  });
  const manifest = { schema: 'mos.spike-366-substrate/1', prepared_at: '2026-10-02T00:00:00.000Z', out_dir: W, source: 'tests/fixtures/355-rooms', rooms: entries };
  const mp = path.join(W, 'manifest.json');
  fs.writeFileSync(mp, JSON.stringify(manifest, null, 2) + '\n');
  return { W: W, manifest: mp, rooms: entries };
}

(async function main() {
  const S = makeSpikeRoot('spike-366-t-', ['room-a', 'room-b']);
  const M = S.manifest;
  const ARM = 'eureka-graph-lexical';

  // ===== S1 recall + items =====
  const rEu = await spike.recallArm(M, ARM);
  const rRs = await spike.recallArm(M, 'rs-graph');
  const rHsi = await spike.recallArm(M, 'hsi-graph');
  check('S1 recall runs every non-vector arm over the same rooms at the per-room cap', rEu.ok && rRs.ok && rHsi.ok && rEu.shown > 0 && rRs.shown > 0 && rHsi.shown > 0, JSON.stringify([rEu.shown, rRs.shown, rHsi.shown]));
  const recallDoc = JSON.parse(fs.readFileSync(path.join(S.W, 'arms', ARM, 'recall.json'), 'utf8'));
  check('S1 recall.json carries counts and the cost block (wall, cpu, rss, vendor numbers null)', recallDoc.per_room_cap === BAR.per_room_cap && typeof recallDoc.cost.wall_ms === 'number' && typeof recallDoc.cost.cpu_user_ms === 'number' && typeof recallDoc.cost.max_rss_kb === 'number' && recallDoc.cost.dollars === null && recallDoc.cost.input_tokens === null);

  const itEu = spike.itemsFor(M, ARM);
  const itRs = spike.itemsFor(M, 'rs-graph');
  const itHsi = spike.itemsFor(M, 'hsi-graph');
  check('S1 every candidate converts to an item (none unmapped)', itEu.items === rEu.shown && itRs.items === rRs.shown && itHsi.items === rHsi.shown && itEu.unmapped === 0, JSON.stringify([itEu, itRs.items, itHsi.items]));
  const itemsPath = path.join(S.W, 'arms', ARM, 'items.json');
  const itemsDoc = JSON.parse(fs.readFileSync(itemsPath, 'utf8'));
  const KEYS = ['a_excerpt', 'a_path', 'b_excerpt', 'b_path', 'direction_phrase', 'pair_id', 'producer', 'room'];
  check('S1 each item has exactly the 355 keys', itemsDoc.items.every(function (i) { return JSON.stringify(Object.keys(i).sort()) === JSON.stringify(KEYS); }));
  check('S1 pair_id is the 355 pairId over room and the two paths; paths are room-relative .md', itemsDoc.items.every(function (i) { return i.pair_id === m355.pairId(i.room, i.a_path, i.b_path) && /\.md$/.test(i.a_path) && /\.md$/.test(i.b_path); }));
  const planted = itemsDoc.items.find(function (i) { return i.room === 'room-a' && [i.a_path, i.b_path].sort().join() === 'ma/M1.md,pd/P3.md'; });
  const pSide = planted && (planted.a_path === 'pd/P3.md' ? planted.a_excerpt : planted.b_excerpt);
  check('S1 the planted eureka pair is present with a buildExcerpt-shaped excerpt (title first, capped)', !!planted && pSide.indexOf('Antifouling coating chemistry') === 0 && pSide.length <= 'Antifouling coating chemistry for seawater membranes'.length + 2 + 600, JSON.stringify(planted && [planted.a_path, planted.b_path]));
  check('S1 an eureka row with no measured direction gets the honest phrase from directionPhraseFor(null)', itemsDoc.items.every(function (i) { return i.direction_phrase === m355.directionPhraseFor(null); }));
  const rsDoc = JSON.parse(fs.readFileSync(path.join(S.W, 'arms', 'rs-graph', 'items.json'), 'utf8'));
  const hsiDoc = JSON.parse(fs.readFileSync(path.join(S.W, 'arms', 'hsi-graph', 'items.json'), 'utf8'));
  check('S1 rs and hsi items carry their arm as producer and a non-empty phrase', rsDoc.items.every(function (i) { return i.producer === 'rs-graph' && i.direction_phrase; }) && hsiDoc.items.every(function (i) { return i.producer === 'hsi-graph' && i.direction_phrase; }));

  // ===== S2 the label tool's own loader =====
  const sess = fs.mkdtempSync(path.join(os.tmpdir(), 'spike-366-sess-'));
  let buf = '';
  const lcode = await labeler.run({ argv: ['status', '--set', 'pairings-unstamped', '--items', itemsPath, '--session-dir', sess], output: { write: function (s) { buf += s; } }, repoRoot: REPO_ROOT });
  check('S2 label-355-gold status reads every item of the arm file (0/N labeled)', lcode === 0 && buf.trim() === '0/' + itemsDoc.items.length + ' labeled', buf);
  check('S2 the pairings-unstamped set requires a phrase and every item has one', labeler.SETS['pairings-unstamped'].requiresPhrase === true && itemsDoc.items.every(function (i) { return typeof i.direction_phrase === 'string' && i.direction_phrase.length > 0; }));

  // ===== S3 judge arms =====
  const stageA = [];
  for (let n = 1; n <= 3; n += 1) stageA.push(await spike.judgeArm(M, { arm: 'stage-a', recallArm: ARM, repeat: n }));
  const sa1 = JSON.parse(fs.readFileSync(path.join(S.W, 'arms', ARM, 'judge', 'stage-a-r1.json'), 'utf8'));
  const idsAll = itemsDoc.items.map(function (i) { return i.pair_id; });
  check('S3 stage-a judges every candidate through judgeCandidates and passes a subset', stageA.every(function (r) { return r.ok && r.candidates === idsAll.length; }) && sa1.passes.every(function (p) { return idsAll.indexOf(p) !== -1; }) && sa1.verdicts.length === idsAll.length);
  const mod = require(path.join(PERSP, 'index.cjs')).getPerspective('eureka');
  const saVerdicts = eurekaJudge.readVerdicts(S.rooms[0].room_dir, 'spike-judge-stage-a-' + ARM + '-r1', { module: mod });
  check('S3 stage-a wrote verdicts.jsonl through writeVerdicts with the module', Array.isArray(saVerdicts) && saVerdicts.length > 0 && saVerdicts.every(function (v) { return v.judge === 'none' && v.stage_a; }));

  // Claude: a verdicts file inside the spike root (the subagent arm), first pair useful, the rest not
  const claudePath = path.join(S.W, 'arms', ARM, 'claude-verdicts.jsonl');
  fs.writeFileSync(claudePath, idsAll.map(function (id, i) { return JSON.stringify({ pair_id: id, verdict: i === 0 ? 'useful' : 'not_useful', reason: 'replay fixture' }); }).join('\n') + '\n');
  const cl = [];
  for (let n = 1; n <= 3; n += 1) cl.push(await spike.judgeArm(M, { arm: 'claude', recallArm: ARM, repeat: n, verdictsPath: claudePath }));
  check('S3 claude imports the verdicts file inside the spike root; only useful passes', cl.every(function (r) { return r.ok && r.passed === 1; }));
  const outside = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'spike-366-outside-')), 'v.jsonl');
  fs.writeFileSync(outside, fs.readFileSync(claudePath));
  check('S3 claude refuses a verdicts file outside the spike root (exit 2)', await code(function () { return spike.judgeArm(M, { arm: 'claude', recallArm: ARM, repeat: 1, verdictsPath: outside }); }) === 2);
  const badPath = path.join(S.W, 'arms', ARM, 'claude-bad.jsonl');
  fs.writeFileSync(badPath, JSON.stringify({ pair_id: idsAll[0], verdict: 'useful' }) + '\n');
  check('S3 claude rejects a verdicts file that misses pairs (exit 3)', await code(function () { return spike.judgeArm(M, { arm: 'claude', recallArm: ARM, repeat: 1, verdictsPath: badPath }); }) === 3);
  fs.writeFileSync(badPath, idsAll.map(function (id) { return JSON.stringify({ pair_id: id, verdict: 'great' }); }).join('\n') + '\n');
  check('S3 claude rejects a verdict outside the vocabulary (exit 3)', await code(function () { return spike.judgeArm(M, { arm: 'claude', recallArm: ARM, repeat: 1, verdictsPath: badPath }); }) === 3);
  fs.writeFileSync(badPath, idsAll.concat(['f'.repeat(12)]).map(function (id) { return JSON.stringify({ pair_id: id, verdict: 'useful' }); }).join('\n') + '\n');
  check('S3 claude rejects a pair that is not in the items (exit 3)', await code(function () { return spike.judgeArm(M, { arm: 'claude', recallArm: ARM, repeat: 1, verdictsPath: badPath }); }) === 3);

  // Jev replay (zero network, zero key): one recorded response PER PAIR, keyed the way eureka-jev-judge keys them
  // (sha256 over a stable stringify of the request body). A pair with no recorded response stays unjudged, which
  // proves the key is per pair (366-18 fixed a key that collapsed every pair onto one).
  const crit = Object.keys(Q.USEFULNESS_QUESTIONS.usefulness.criteria);
  function stable(v) {
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + stable(v[k]); }).join(',') + '}';
    return JSON.stringify(v);
  }
  function respFor(choice) {
    const probs = {}; crit.forEach(function (k) { probs[k] = k === choice ? 1 - 0.01 * (crit.length - 1) : 0.01; });
    return { status: 200, json: { model: Q.PINNED_MODEL, answers: { usefulness: { type: 'choice', choice: choice, probabilities: probs, confidence: 0.9 } }, usage: { input_tokens: 10, output_tokens: 1 } } };
  }
  function jevKey(db, c) {
    function ex(id) {
      const p = JSON.parse(db.prepare('SELECT properties FROM nodes WHERE id = ?').get(id).properties);
      return ['title', 'name', 'text', 'summary', 'body', 'content', 'excerpt'].filter(function (k) { return typeof p[k] === 'string' && p[k].trim(); }).map(function (k) { return p[k].trim(); }).join('\n').slice(0, 2400);
    }
    const body = { model: Q.PINNED_MODEL, state: { a_excerpt: ex(c.a), b_excerpt: ex(c.b), direction_phrase: 'same mechanism, different domain', verification: 'unverified' }, questions: Q.USEFULNESS_QUESTIONS };
    return sha256(Buffer.from(stable(body), 'utf8'));
  }
  // picks: global candidate index (items order) -> choice; others are left unrecorded
  function seedReplay(tag, picks) {
    let idx = 0;
    S.rooms.forEach(function (r) {
      const read = eurekaRecall.readCandidates(r.room_dir, 'spike-' + ARM);
      const db = navigation.openRoomDbReadOnlyForCaller(r.room_dir);
      const rec = {};
      try { read.candidates.forEach(function (c) { if (picks[idx] !== undefined) rec[jevKey(db, c)] = respFor(picks[idx]); idx += 1; }); } finally { db.close(); }
      const f = path.join(eurekaRecall.runDirFor(r.room_dir, tag), '03_judge', 'jev-responses.json');
      fs.mkdirSync(path.dirname(f), { recursive: true });
      fs.writeFileSync(f, JSON.stringify(rec));
    });
  }
  seedReplay('spike-cj-' + ARM + '-r1', { 0: 'useful' });
  const cj = await spike.judgeArm(M, { arm: 'claude-then-jev', recallArm: ARM, repeat: 1, verdictsPath: claudePath, replay: true });
  let fed = 0;
  S.rooms.forEach(function (r) {
    const read = eurekaRecall.readCandidates(r.room_dir, 'spike-cj-' + ARM + '-r1');
    if (read) fed += read.candidates.length;
  });
  check('S3 claude-then-jev feeds Jev only the pairs Claude called useful (replay, no network)', cj.ok && fed === 1 && cj.passed === 1, JSON.stringify({ fed: fed, cj: cj }));
  seedReplay('spike-jev-' + ARM + '-r1', { 0: 'useful', 1: 'not_useful' });
  const jv = await spike.judgeArm(M, { arm: 'jev', recallArm: ARM, repeat: 1, replay: true });
  const jvDoc = JSON.parse(fs.readFileSync(path.join(S.W, 'arms', ARM, 'judge', 'jev-r1.json'), 'utf8'));
  const jvKinds = jvDoc.verdicts.map(function (v) { return v.verdict; }).sort().join();
  check('S3 jev (replay) judges per pair: one recorded useful passes, one not_useful does not, unrecorded pairs stay unjudged', jv.ok && jv.candidates === idsAll.length && jvDoc.replayed === true && jv.passed === 1 && jvDoc.passes[0] === idsAll[0] && jvKinds === ['jev:useful', 'jev:not_useful'].concat(new Array(idsAll.length - 2).fill('jev:unjudged')).sort().join(), jvKinds);
  check('S3 jev with no key and no replay is an ENV GAP (exit 77), not a fetch', await code(function () { return spike.judgeArm(M, { arm: 'jev', recallArm: ARM, repeat: 2 }); }) === 77);

  // ===== S4 refusals =====
  const evil = makeSpikeRoot('spike-366-evil-', ['room-a']);
  const evilManifest = JSON.parse(fs.readFileSync(evil.manifest, 'utf8'));
  evilManifest.rooms[0].room_dir = path.join(FIXTURE_355, 'room-control');
  fs.writeFileSync(evil.manifest, JSON.stringify(evilManifest));
  check('S4 jev refuses a room inside the 355 fixture tree (exit 2)', await code(function () { return spike.judgeArm(evil.manifest, { arm: 'jev', recallArm: ARM, repeat: 1 }); }) === 2);
  evilManifest.rooms[0].room_dir = fs.mkdtempSync(path.join(os.tmpdir(), 'spike-366-other-'));
  fs.writeFileSync(evil.manifest, JSON.stringify(evilManifest));
  check('S4 a room outside the spike root is refused for every subcommand (exit 2)', await code(function () { return spike.recallArm(evil.manifest, ARM); }) === 2 && await code(function () { return spike.judgeArm(evil.manifest, { arm: 'jev', recallArm: ARM, repeat: 1 }); }) === 2);
  check('S4 a manifest outside os.tmpdir() is refused (exit 2)', await code(function () { return spike.recallArm(BAR_SRC, ARM); }) === 2);
  check('S4 a --root outside tmp and the fixtures tree is refused (exit 2)', (await run(['--check', '--root', '/etc'])).code === 2);
  check('S4 free text, an unknown subcommand and a .. segment on argv are refused (exit 2)', (await run(['recall', 'some free text'])).code === 2 && (await run(['bogus'])).code === 2 && (await run(['items', '--manifest', path.join(S.W, '..', 'x', 'manifest.json'), '--arm', ARM])).code === 2 && (await run([])).code === 2);
  check('S4 an unknown arm or a repeat out of range is refused (exit 2)', (await run(['recall', '--manifest', M, '--arm', 'nope'])).code === 2 && await code(function () { return spike.judgeArm(M, { arm: 'stage-a', recallArm: ARM, repeat: 4 }); }) === 2);

  // ===== S5 record =====
  for (let n = 2; n <= 3; n += 1) { /* jev and claude-then-jev repeats stay at 1 on purpose */ }
  await spike.judgeArm(M, { arm: 'jev', recallArm: 'rs-graph', repeat: 1, replay: true }).catch(function () { return null; });
  const ROOT = fs.mkdtempSync(path.join(os.tmpdir(), 'spike-366-root-'));
  fs.copyFileSync(BAR_SRC, path.join(ROOT, 'bar.json'));
  const rec0 = spike.recordSpike(M, { root: ROOT });
  check('S5 record freezes the arm files and lists arms still awaiting gold (no rate invented)', rec0.ok && rec0.awaiting_gold.length === 3 && !fs.readFileSync(path.join(ROOT, 'record.json'), 'utf8').includes('"useful_rate"'));
  // gold: simulate label-355-gold emit for each arm (fixture_sha256 over the frozen items bytes)
  const goldUseful = {};
  ['eureka-graph-lexical', 'rs-graph', 'hsi-graph'].forEach(function (arm) {
    const raw = fs.readFileSync(path.join(ROOT, 'arms', arm, 'items.json'));
    const items = JSON.parse(raw).items;
    goldUseful[arm] = items.map(function (it, i) { return i % 2 === 0; });
    fs.mkdirSync(path.join(ROOT, 'gold'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'gold', arm + '.json'), JSON.stringify({ labeler: 'navigator', fixture_sha256: sha256(raw), items: items.map(function (it, i) { return { pair_id: it.pair_id, useful: goldUseful[arm][i], direction_ok: false, already_known: false }; }) }, null, 2));
  });
  const rec1 = spike.recordSpike(M, { root: ROOT });
  const rec = JSON.parse(fs.readFileSync(path.join(ROOT, 'record.json'), 'utf8'));
  check('S5 record has an entry per labeled arm and nothing awaiting', rec1.ok && Object.keys(rec.recall_arms).sort().join() === 'eureka-graph-lexical,hsi-graph,rs-graph' && rec.awaiting_gold.length === 0);
  const ea = rec.recall_arms[ARM];
  const kEu = goldUseful[ARM].filter(Boolean).length; const nEu = goldUseful[ARM].length;
  check('S5 per arm: shown, useful, rate, wilson95 (the repo wilson95) and clears_bar', ea.shown === nEu && ea.useful === kEu && ea.rate === r4(kEu / nEu) && JSON.stringify(ea.wilson95) === JSON.stringify(m355.wilson95(kEu, nEu).map(r4)) && ea.clears_bar === (m355.wilson95(kEu, nEu)[0] > 0.448));
  check('S5 three repeats recorded, identical for a deterministic recall arm; n below the baseline n is flagged', ea.repeats.length === 3 && ea.repeats.every(function (r) { return r.useful === kEu && r.shown === nEu && r.clears_bar === ea.clears_bar; }) && ea.n_below_baseline_n === true && typeof ea.clears_bar_all_repeats === 'boolean');
  check('S5 rs-graph and hsi-graph carry a slice comparison; the eureka arm has none', rec.recall_arms['rs-graph'].vs_slice.slice === 'rs' && rec.recall_arms['hsi-graph'].vs_slice.slice === 'hsi' && ea.vs_slice === undefined);
  check('S5 baseline slices are recomputed from the 355 files (HSI 27 of 47, RS 16 of 49, pool 43 of 96)', rec.baseline.slices.hsi.shown === 47 && rec.baseline.slices.hsi.useful === 27 && rec.baseline.slices.rs.shown === 49 && rec.baseline.slices.rs.useful === 16 && rec.baseline.pool.useful === 43 && rec.baseline.pool.shown === 96);
  check('S5 rs-graph slice figures are the RS slice (16 of 49) and the HSI slice figures for hsi-graph', rec.recall_arms['rs-graph'].vs_slice.baseline_useful === 16 && rec.recall_arms['rs-graph'].vs_slice.baseline_shown === 49 && rec.recall_arms['hsi-graph'].vs_slice.baseline_useful === 27 && rec.recall_arms['hsi-graph'].vs_slice.baseline_shown === 47);
  check('S5 the baseline note is carried verbatim and the statement names 47 HSI and 49 RS pairs', rec.baseline.note === BAR.baseline.note && /47 HSI, 49 RS pairs/.test(rec.statement) && /substrate_unavailable/.test(rec.statement));
  const recText = JSON.stringify(rec);
  check('S5 the record never phrases a result as Eureka improving and never adopts an arm', !/Eureka improv/i.test(recText) && !/improved from/i.test(recText) && rec.adoption.decision === null && /never adopts/.test(rec.adoption.note));
  const ja = rec.judge_arms[ARM];
  check('S5 judge arms: stage-a and claude have 3 repeats (clears_bar_all_repeats evaluated), jev and claude-then-jev have 1 and so cannot clear', ja['stage-a'].repeats.length === 3 && ja.claude.repeats.length === 3 && ja.jev.repeats.length === 1 && ja.jev.clears_bar_all_repeats === false && ja['claude-then-jev'].repeats.length === 1 && ja['claude-then-jev'].clears_bar_all_repeats === false && ja['stage-a'].repeats_required === 3);
  const claudeRep = ja.claude.repeats[0];
  const claudePassId = idsAll[0];
  const claudeUseful = goldUseful[ARM][0] ? 1 : 0;
  check('S5 a judge arm useful rate is the gold-useful share among the pairs it passed', claudeRep.passed === 1 && claudeRep.useful === claudeUseful && claudeRep.shown === 1 && JSON.stringify(claudeRep.wilson95) === JSON.stringify(m355.wilson95(claudeUseful, 1).map(r4)) && itemsDoc.items[0].pair_id === claudePassId);
  check('S5 the cost block is recorded as counts per arm', typeof ea.cost.wall_ms === 'number' && typeof claudeRep.cost.wall_ms === 'number' && ja.jev.repeats[0].cost.vendor_calls === 0);
  check('S5 a gold file labeled against a different items file is refused (fixture_sha256)', (function () {
    const g = path.join(ROOT, 'gold', 'rs-graph.json');
    const orig = fs.readFileSync(g, 'utf8');
    const j = JSON.parse(orig); j.fixture_sha256 = 'a'.repeat(64);
    fs.writeFileSync(g, JSON.stringify(j));
    let threw = false;
    try { spike.computeRecord(ROOT); } catch (e) { threw = /fixture_sha256/.test(String(e.message)); }
    fs.writeFileSync(g, orig);
    return threw;
  })());

  // ===== S6 --check byte for byte =====
  const ck = await run(['--check', '--root', ROOT]);
  check('S6 --check exits 0 when the recomputed record equals record.json byte for byte', ck.code === 0 && ck.json && ck.json.ok === true, ck.stderr);
  const recPath = path.join(ROOT, 'record.json');
  const recBytes = fs.readFileSync(recPath, 'utf8');
  fs.writeFileSync(recPath, recBytes.replace('"useful": ' + ea.useful, '"useful": ' + (ea.useful + 1)));
  check('S6 --check fails on a changed record', (await run(['--check', '--root', ROOT])).code === 1);
  fs.writeFileSync(recPath, recBytes);
  const jf = path.join(ROOT, 'arms', ARM, 'judge', 'claude-r1.json');
  const jBytes = fs.readFileSync(jf, 'utf8');
  const jj = JSON.parse(jBytes); jj.passes = idsAll.slice(0, 2); fs.writeFileSync(jf, JSON.stringify(jj, null, 2) + '\n');
  check('S6 --check fails when a frozen judge input changes', (await run(['--check', '--root', ROOT])).code === 1);
  fs.writeFileSync(jf, jBytes);
  const gf = path.join(ROOT, 'gold', ARM + '.json');
  const gBytes = fs.readFileSync(gf, 'utf8');
  const gj = JSON.parse(gBytes); gj.items[0].useful = !gj.items[0].useful; fs.writeFileSync(gf, JSON.stringify(gj, null, 2));
  check('S6 --check fails when the gold changes', (await run(['--check', '--root', ROOT])).code === 1);
  fs.writeFileSync(gf, gBytes);
  check('S6 --check is 0 again once the inputs are restored, and fails with no record.json', (await run(['--check', '--root', ROOT])).code === 0 && (await run(['--check', '--root', fs.mkdtempSync(path.join(os.tmpdir(), 'spike-366-empty-'))])).code === 1);

  // ===== S7 the extraLanes seam =====
  const seam = fixture.buildPerspectiveRoom(fs.mkdtempSync(path.join(os.tmpdir(), 'spike-366-seam-')), { name: 'seam' });
  const db = navigation.openRoomDbReadOnlyForCaller(seam.roomDir);
  let substrate;
  try { substrate = eurekaRecall.buildSubstrate(db, { roomDir: seam.roomDir }); } finally { db.close(); }
  const base = eurekaRecall.recallCandidates(substrate, seam.roomDir, {});
  const withEmpty = eurekaRecall.recallCandidates(substrate, seam.roomDir, {}, { extraLanes: [] });
  check('S7 no extraLanes (or an empty list) leaves the output identical', JSON.stringify(base) === JSON.stringify(withEmpty) && base.counts.vector === undefined);
  const known = seam.planted.known; const newPair = ['pd/P2', 'ma/M3'];
  const withLane = eurekaRecall.recallCandidates(substrate, seam.roomDir, {}, { extraLanes: [function () { return [{ a: known[0], b: known[1], lane: 'vector', score: 0.99 }, { a: newPair[0], b: newPair[1], lane: 'vector', score: 0.9 }, { a: 7, b: 'x', lane: 'vector' }, null]; }] });
  const vrow = withLane.candidates.find(function (c) { return [c.a, c.b].sort().join() === newPair.slice().sort().join(); });
  check('S7 an injected proposal lands as a row with its lane and score; junk proposals are ignored', !!vrow && vrow.lanes.indexOf('vector') !== -1 && vrow.vector === 0.9 && withLane.counts.vector === 1);
  check('S7 the injected lane goes through the exclusion upsert (the known pair is dropped and counted)', !withLane.candidates.some(function (c) { return c.a === known[0] && c.b === known[1]; }) && withLane.counts.excluded_known === base.counts.excluded_known + 1 + 0);
  const capped = eurekaRecall.recallCandidates(substrate, seam.roomDir, { max_candidates: 1 }, { extraLanes: [function () { return [{ a: newPair[0], b: newPair[1], lane: 'vector', score: 0.9 }]; }] });
  check('S7 the cap applies to injected rows exactly as to the built-in lanes', capped.candidates.length === 1 && capped.pairs_truncated >= 1);

  // the vector lane on injected vectors (no model, no network)
  function encodeFn(texts) {
    return texts.map(function (t) {
      const v = new Array(8).fill(0);
      String(t).toLowerCase().split(/\W+/).filter(Boolean).forEach(function (w) { let h = 0; for (let i = 0; i < w.length; i += 1) h = (h * 31 + w.charCodeAt(i)) >>> 0; v[h % 8] += 1; });
      const n = Math.sqrt(v.reduce(function (s, x) { return s + x * x; }, 0)) || 1;
      return v.map(function (x) { return x / n; });
    });
  }
  const lane = await spike.buildVectorLane(seam.roomDir, { encodeFn: encodeFn, top_k: 2 });
  const props = lane();
  const perThing = {}; props.forEach(function (p) { perThing[p.a] = (perThing[p.a] || 0) + 1; });
  const sectionOf = {}; substrate.things.forEach(function (t) { sectionOf[t.id] = t.section; });
  check('S7 the vector lane proposes at most top_k cross-section pairs per thing, each with a score in lane "vector"', props.length > 0 && Object.keys(perThing).every(function (k) { return perThing[k] <= 2; }) && props.every(function (p) { return p.lane === 'vector' && typeof p.score === 'number' && sectionOf[p.a] !== sectionOf[p.b]; }));
  const rv = await spike.recallArm(M, 'eureka-graph-lexical-vector', { encodeFn: encodeFn });
  const rvDoc = JSON.parse(fs.readFileSync(path.join(S.W, 'arms', 'eureka-graph-lexical-vector', 'recall.json'), 'utf8'));
  check('S7 the vector arm runs end to end on injected vectors and counts its lane per room', rv.ok && rv.shown > 0 && Object.keys(rvDoc.rooms).every(function (k) { return rvDoc.rooms[k].counts.vector > 0; }));
  const noModel = await run(['recall', '--manifest', M, '--arm', 'eureka-graph-lexical-vector']);
  check('S7 the CLI vector arm with no cached model is an ENV GAP (exit 77), never a download', noModel.code === 77 && /ENV GAP/.test(noModel.stderr));

  // ===== hygiene =====
  check('the source 355 fixture tree is byte-identical before and after', prepare.treeSha256(FIXTURE_355) === src355Before);
  check('zero network attempts', net.attempts() === 0, 'attempts=' + net.attempts());
  net.restore();
  process.exit(C.summary());
}()).catch(function (e) {
  console.log('FAIL: unexpected error ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
