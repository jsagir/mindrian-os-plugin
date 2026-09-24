#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * dev-time only; fixture rooms only; never a live room (SPEC AC12).
 *
 * Phase 355 (Hidden in Plain Sight: Jev-through-Theo cross-connection
 * engines) Plan 24 (HIPS-07, D-32, D-34, D-35 step 4). The fixture-only
 * hit-rate measurement tool: exports what the connection engines (HSI, RS,
 * eureka) actually show on the three tests/fixtures/355-rooms/ rooms,
 * WITHOUT a verification stamp (the unstamped baseline the navigator judges
 * blind in sitting 1), and later (355-25) stamps the same pairings, runs
 * sitting 2, and writes the first human-judged hit-rate record.
 *
 * --room ALWAYS resolves inside tests/fixtures/355-rooms/ (realpath + a
 * path.sep-bounded prefix check, the eval-icm-writers.cjs / test-353-
 * tripwires.cjs idiom): a tmp dir, a sibling-prefix path, an escaping
 * symlink, and any path outside this tree are all refused. This module
 * never special-cases a home-directory rooms path -- the prefix containment
 * check alone already refuses it, so nothing below ever names it (the
 * static grep this file's own test runs on itself).
 *
 * Every room a producer runs against is a temp `fs.cpSync` copy
 * (`fs.mkdtempSync(os.tmpdir())`), deleted afterward -- the fixture room
 * tree itself is never written to (tests/fixtures/355-rooms/README.md's own
 * "never run in place" rule).
 *
 * D-32 / D-35 step (4): this file's own `export --unstamped` path never
 * requires lib/core/verification-stamp.cjs and never calls Theo -- the
 * unstamped baseline exists so the navigator's first sitting is blind. The
 * `stamp` and `record` subcommands are 355-25's own scope; this plan wires
 * their argv slots and --check's absent-record leg only.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const directionConvention = require('../lib/core/direction-convention.cjs');
const { TIERS } = require('../lib/core/verification-stamp.cjs');

// ---------------------------------------------------------------------------
// Fixed locations. FIXTURE_ROOT is the ONLY root a room may resolve inside.
// ---------------------------------------------------------------------------
const REPO_ROOT = path.resolve(__dirname, '..');
const FIXTURE_ROOT = path.join(REPO_ROOT, 'tests', 'fixtures', '355-rooms');
const DEFAULT_ROOM_NAMES = Object.freeze(['room-ill-defined', 'room-extend', 'room-control']);
const ITEMS_PATH = path.join(FIXTURE_ROOT, 'pairings.items.json');
const JUDGMENTS_PATH = path.join(FIXTURE_ROOT, 'judgments.json');
const RECORD_PATH = path.join(FIXTURE_ROOT, 'hit-rate-record.json');
const MIN_SHOWN_PER_ROOM = 20;
const EXCERPT_MAX_CHARS = 600;

// ---------------------------------------------------------------------------
// guardRoomPath(candidate): realpath + path.sep-bounded prefix containment
// against FIXTURE_ROOT. Throws on anything outside the tree (a tmp dir, a
// sibling-prefix path such as tests/fixtures/355-rooms-evil, an escaping
// symlink, a path under any other tree entirely). Returns the realpath on
// success.
// ---------------------------------------------------------------------------
function guardRoomPath(candidate) {
  const resolved = path.resolve(candidate);
  let real;
  try {
    real = fs.realpathSync(resolved);
  } catch (_e) {
    real = resolved;
  }
  let rootReal;
  try {
    rootReal = fs.realpathSync(FIXTURE_ROOT);
  } catch (_e) {
    rootReal = FIXTURE_ROOT;
  }
  const prefixWithSep = rootReal + path.sep;
  const within = real === rootReal || real.indexOf(prefixWithSep) === 0;
  if (!within) {
    throw new Error(
      'guardRoomPath: refused -- ' + candidate + ' does not resolve inside tests/fixtures/355-rooms ' +
      '(SPEC AC12: never a live room)'
    );
  }
  return real;
}

// ---------------------------------------------------------------------------
// wilson95(k, n) -> [lo, hi], the 95% Wilson score interval. No dependency.
// n <= 0 (or non-finite) returns [0, 0] -- the degenerate, explicitly
// flagged case (there is no rate to bound).
// ---------------------------------------------------------------------------
const WILSON_Z = 1.959963985;

function wilson95(k, n) {
  if (!Number.isFinite(n) || n <= 0) return [0, 0];
  const kk = Number.isFinite(k) ? k : 0;
  const z = WILSON_Z;
  const z2 = z * z;
  const p = kk / n;
  const denom = 1 + z2 / n;
  const center = p + z2 / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  const lo = (center - margin) / denom;
  const hi = (center + margin) / denom;
  return [Math.max(0, lo), Math.min(1, hi)];
}

// ---------------------------------------------------------------------------
// firstSentencesCapped(text, maxChars): accumulate whole sentences (never a
// mid-sentence cut) until the next sentence would exceed maxChars.
// ---------------------------------------------------------------------------
function firstSentencesCapped(text, maxChars) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  if (!flat) return '';
  const sentences = flat.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [flat];
  let out = '';
  for (const raw of sentences) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const candidate = out ? out + ' ' + trimmed : trimmed;
    if (candidate.length > maxChars) break;
    out = candidate;
  }
  if (!out) out = sentences[0].trim().slice(0, maxChars);
  return out;
}

// ---------------------------------------------------------------------------
// buildExcerpt(artifact): the artifact's own title plus its first sentences,
// capped at EXCERPT_MAX_CHARS. `artifact` = { title, text } (discoverArtifacts
// shape, lib/core/rs-engine.cjs).
// ---------------------------------------------------------------------------
function buildExcerpt(artifact) {
  const title = (artifact && artifact.title) || '';
  const body = firstSentencesCapped(artifact && artifact.text, EXCERPT_MAX_CHARS);
  return body ? title + '\n\n' + body : title;
}

// ---------------------------------------------------------------------------
// pairId(room, pathA, pathB): first 12 hex of sha256(room + NUL + sorted
// artifact paths, NUL-joined). Order-independent in the two paths.
// ---------------------------------------------------------------------------
function pairId(room, pathA, pathB) {
  const sorted = [String(pathA), String(pathB)].sort();
  const payload = String(room) + '\u0000' + sorted.join('\u0000');
  return crypto.createHash('sha256').update(payload).digest('hex').slice(0, 12);
}

// ---------------------------------------------------------------------------
// directionPhraseFor(direction): DIRECTION_MEANING[direction], or
// NONE_MEANING for 'none' / anything not a recognized direction id.
// ---------------------------------------------------------------------------
function directionPhraseFor(direction) {
  if (direction && Object.prototype.hasOwnProperty.call(directionConvention.DIRECTION_MEANING, direction)) {
    return directionConvention.DIRECTION_MEANING[direction];
  }
  return directionConvention.NONE_MEANING;
}

// ---------------------------------------------------------------------------
// exportUnstamped(rooms, opts): rooms = [{ name, dir }] (dir already
// guarded). opts.top (default 10), opts.runProducers(ctx) -> Promise<{
// producers_ran: string[], encoder: string|null,
// pairs: [{ producer, a: artifact, b: artifact, direction }] }>. Dedupes
// pairs across producers within a room (by the unordered artifact-id pair);
// throws 'fewer than 20 shown pairings in <room>' rather than padding.
// Never requires lib/core/verification-stamp.cjs or calls Theo.
// ---------------------------------------------------------------------------
async function exportUnstamped(rooms, opts) {
  const options = opts || {};
  const top = Number.isFinite(options.top) ? options.top : 10;
  const runProducers = typeof options.runProducers === 'function' ? options.runProducers : defaultRunProducers;

  const items = [];
  const roomsMeta = {};
  let encoderModel = null;

  for (const room of Array.isArray(rooms) ? rooms : []) {
    const roomName = room.name;
    // eslint-disable-next-line no-await-in-loop
    const roomResult = await runProducers({ room: roomName, dir: room.dir, top });
    if (roomResult && roomResult.encoder && !encoderModel) encoderModel = roomResult.encoder;

    const seen = new Set();
    const roomItems = [];
    const pairs = (roomResult && Array.isArray(roomResult.pairs)) ? roomResult.pairs : [];
    for (const p of pairs) {
      if (!p || !p.a || !p.b) continue;
      const aId = p.a.id !== undefined ? p.a.id : p.a.path;
      const bId = p.b.id !== undefined ? p.b.id : p.b.path;
      if (aId === undefined || bId === undefined) continue;
      const dedupeKey = [String(aId), String(bId)].sort().join('\u0000');
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const aPath = p.a.path || p.a.id;
      const bPath = p.b.path || p.b.id;
      roomItems.push({
        pair_id: pairId(roomName, aPath, bPath),
        room: roomName,
        producer: p.producer,
        a_excerpt: buildExcerpt(p.a),
        b_excerpt: buildExcerpt(p.b),
        direction_phrase: directionPhraseFor(p.direction),
        a_path: aPath,
        b_path: bPath,
      });
    }

    if (roomItems.length < MIN_SHOWN_PER_ROOM) {
      throw new Error('fewer than 20 shown pairings in ' + roomName);
    }

    items.push(...roomItems);
    roomsMeta[roomName] = {
      producers_ran: (roomResult && Array.isArray(roomResult.producers_ran)) ? roomResult.producers_ran : [],
      shown: roomItems.length,
    };
  }

  return {
    generated_at: new Date().toISOString(),
    encoder: encoderModel,
    top_k: top,
    phrase_hash: directionConvention.phraseHash(),
    rooms: roomsMeta,
    items,
  };
}

// ---------------------------------------------------------------------------
// defaultRunProducers(ctx): the REAL producer run, used by the CLI (never by
// a test, which always injects its own opts.runProducers). Copies ctx.dir
// into a mkdtemp, runs hsi-engine.runTier1 + hsi-to-graph (no --stamp), then
// rs-engine.runModeInternal, each bounded to ctx.top; probes eureka's
// room-native substrate and records `eureka: substrate_unavailable` when it
// carries too few nodes to score rather than guessing a ranked pair. Deletes
// the mkdtemp before returning. Never requires verification-stamp.cjs.
// ---------------------------------------------------------------------------
async function defaultRunProducers(ctx) {
  // Required lazily: a CLI-only path, never reached by a test (D-32's own
  // "tests never run an encoder" truth), and this keeps requiring this file
  // free of any heavy engine load at module-eval time.
  const rsEngine = require('../lib/core/rs-engine.cjs');
  const hsiEngine = require('../lib/core/hsi-engine.cjs');
  const hsiToGraph = require('./hsi-to-graph.cjs');
  const embeddingSpine = require('../lib/core/eureka/embedding-spine.cjs');

  const producersRan = [];
  const pairs = [];
  let encoder = null;

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-355-'));
  const copyDir = path.join(tmpRoot, path.basename(ctx.dir));
  fs.cpSync(ctx.dir, copyDir, { recursive: true });

  try {
    const artifacts = rsEngine.discoverArtifacts(copyDir);
    const byId = new Map(artifacts.map((a) => [a.id, a]));

    // --- HSI ---
    try {
      const hsiResult = await hsiEngine.runTier1(copyDir, {});
      const hsiPairs = Array.isArray(hsiResult && hsiResult.hsi_pairs) ? hsiResult.hsi_pairs : [];
      const topHsi = hsiPairs.slice().sort((a, b) => (b.hsi_score || 0) - (a.hsi_score || 0)).slice(0, ctx.top);
      if (topHsi.length > 0) {
        try {
          encoder = embeddingSpine.encoderProvenance().model;
        } catch (_e) {
          // encoder id unavailable this run; leave null rather than guess
        }
        // Parity with the real pipeline (D-32 action text: "then
        // hsi-to-graph, no --stamp"); best-effort only -- this export reads
        // pairs from hsiResult directly, never from the graph write.
        try {
          await hsiToGraph.main([copyDir], {});
        } catch (_e) {
          // best-effort parity only; never blocks the export
        }
        for (const p of topHsi) {
          const a = byId.get(p.left_id);
          const b = byId.get(p.right_id);
          if (!a || !b) continue;
          pairs.push({
            producer: 'hsi',
            a,
            b,
            direction: directionConvention.classify(p.lsa_sim ?? p.lsa, p.semantic_sim ?? p.semantic),
          });
        }
        producersRan.push('hsi');
      }
    } catch (_e) {
      // degrade honestly -- one producer's failure never aborts the export
    }

    // --- RS (find-bottlenecks' own engine) ---
    try {
      const rsResult = await rsEngine.runModeInternal(copyDir, { topk: ctx.top });
      const rsPairs = Array.isArray(rsResult && rsResult.pairs) ? rsResult.pairs : [];
      if (rsPairs.length > 0) {
        if (!encoder && rsResult.metadata && rsResult.metadata.embedding_model) {
          encoder = rsResult.metadata.embedding_model;
        }
        for (const p of rsPairs) {
          const a = byId.get(p.source_artifact_id);
          const b = byId.get(p.target_artifact_id);
          if (!a || !b) continue;
          pairs.push({ producer: 'rs', a, b, direction: p.direction });
        }
        producersRan.push('rs');
      }
    } catch (_e) {
      // degrade honestly
    }

    // --- eureka: a substrate probe only, via a plain fs.existsSync check
    // (never opening the room.db chokepoint here -- Part 9's navigation
    // chokepoint rule bars a new direct room-db.cjs caller, and a probe has
    // no legitimate write to route through it for anyway). These fixture
    // rooms are pure markdown trees (never run through entity-extract), so
    // the room-native substrate eureka-portfolio-report.cjs needs (indexed
    // Entity/Artifact nodes in <room>/.mindrian/room.db) is never present in
    // a fresh cpSync copy. Rather than guess a ranked pair from an absent
    // substrate, this records the honest degradation the plan's own action
    // text names ("if its substrate resolves ... otherwise").
    const roomDbPath = path.join(copyDir, '.mindrian', 'room.db');
    if (fs.existsSync(roomDbPath)) {
      // A future plan may pre-seed the fixture copy with an entity-extracted
      // room.db; until then this branch is unreached, and this comment
      // documents the exact condition under which eureka would be attempted.
      producersRan.push('eureka: substrate_unavailable');
    } else {
      producersRan.push('eureka: substrate_unavailable');
    }
  } finally {
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  }

  return { producers_ran: producersRan, encoder, pairs };
}

// ---------------------------------------------------------------------------
// joinJudgments(judgmentsPayload, itemsPayload, stampsByPairId): joins a
// blind judgments file (judgments.json / judgments-stamped.json shape,
// { items: [{pair_id, useful, direction_ok, already_known, at}] }) against
// the items file (pairings*.items.json, { items: [{pair_id, room,
// producer, a_path, b_path, ...}] }) and an optional stamps lookup
// (Map|object, pair_id -> Stamp | {stamp}). Returns
// [{ pair_id, room, producer, a_path, b_path, useful, direction_ok,
// already_known, stamp }].
// ---------------------------------------------------------------------------
function joinJudgments(judgmentsPayload, itemsPayload, stampsByPairId) {
  const items = (judgmentsPayload && itemsPayload)
    ? ((Array.isArray(itemsPayload.items) ? itemsPayload.items : (Array.isArray(itemsPayload) ? itemsPayload : [])))
    : [];
  const itemsById = new Map();
  for (const it of items) itemsById.set(it.pair_id, it);

  const judgments = (judgmentsPayload && Array.isArray(judgmentsPayload.items))
    ? judgmentsPayload.items
    : (Array.isArray(judgmentsPayload) ? judgmentsPayload : []);

  function getStamp(pid) {
    if (!stampsByPairId) return null;
    let raw = null;
    if (typeof stampsByPairId.get === 'function') raw = stampsByPairId.get(pid) || null;
    else raw = stampsByPairId[pid] || null;
    if (!raw) return null;
    return raw.verification ? raw : (raw.stamp || null);
  }

  const out = [];
  for (const j of judgments) {
    const item = itemsById.get(j.pair_id);
    out.push({
      pair_id: j.pair_id,
      room: item ? item.room : null,
      producer: item ? item.producer : null,
      a_path: item ? item.a_path : null,
      b_path: item ? item.b_path : null,
      useful: j.useful,
      direction_ok: j.direction_ok,
      already_known: j.already_known,
      stamp: getStamp(j.pair_id),
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// computeRates(joined, opts): joined = joinJudgments()'s own output.
// opts.plantedCases (optional) = the parsed planted-cases.json
// ({ false_friends: [{a, b, ...}], meaning_bridges: [...] }), joined by
// a_path/b_path so the false-friend cross-tab can run. Rates use the BLIND
// judgments only (r.useful); tier buckets come from r.stamp.verification
// when a stamp is attached (absent for an unstamped joined set, in which
// case per_tier/unverified_share/etc. are honestly empty/zero rather than
// guessed).
// ---------------------------------------------------------------------------
function computeRates(joined, opts) {
  const options = opts || {};
  const list = Array.isArray(joined) ? joined : [];
  const plantedFalseFriends = (options.plantedCases && Array.isArray(options.plantedCases.false_friends))
    ? options.plantedCases.false_friends
    : [];
  const ffKeySet = new Set(plantedFalseFriends.map((f) => [f.a, f.b].sort().join('\u0000')));

  function rateOf(rows) {
    const n = rows.length;
    const k = rows.filter((r) => r.useful === true).length;
    return { k, n, rate: n > 0 ? k / n : 0, wilson: wilson95(k, n) };
  }

  const perRoomGroups = {};
  for (const r of list) {
    const room = r.room || 'unknown';
    if (!perRoomGroups[room]) perRoomGroups[room] = [];
    perRoomGroups[room].push(r);
  }
  const perRoom = {};
  for (const room of Object.keys(perRoomGroups)) perRoom[room] = rateOf(perRoomGroups[room]);

  const pooled = rateOf(list);

  const perTierGroups = { strong: [], indirect: [], unverified: [] };
  for (const r of list) {
    const tier = r.stamp && TIERS.indexOf(r.stamp.verification) !== -1 ? r.stamp.verification : null;
    if (tier) perTierGroups[tier].push(r);
  }
  const perTier = {};
  for (const t of Object.keys(perTierGroups)) perTier[t] = rateOf(perTierGroups[t]);

  const withStamp = list.filter((r) => r.stamp);
  const unverifiedRows = withStamp.filter((r) => r.stamp.verification === 'unverified');
  const unverifiedShare = withStamp.length > 0 ? unverifiedRows.length / withStamp.length : 0;

  const reasonMix = {};
  for (const r of unverifiedRows) {
    if (r.stamp.reason) reasonMix[r.stamp.reason] = (reasonMix[r.stamp.reason] || 0) + 1;
  }

  const notCalledCount = withStamp.filter((r) => r.stamp.backend === 'not_called').length;
  const notCalledShare = withStamp.length > 0 ? notCalledCount / withStamp.length : 0;

  const alreadyKnownByTier = {};
  for (const t of Object.keys(perTierGroups)) {
    const bucket = perTierGroups[t];
    alreadyKnownByTier[t] = {
      true: bucket.filter((r) => r.already_known === true).length,
      false: bucket.filter((r) => r.already_known === false).length,
    };
  }

  const falseFriendsByTier = { strong: 0, indirect: 0, unverified: 0 };
  for (const r of list) {
    if (!r.a_path || !r.b_path) continue;
    const key = [r.a_path, r.b_path].sort().join('\u0000');
    if (!ffKeySet.has(key)) continue;
    const tier = r.stamp && TIERS.indexOf(r.stamp.verification) !== -1 ? r.stamp.verification : null;
    if (tier) falseFriendsByTier[tier] += 1;
  }

  return {
    per_room: perRoom,
    pooled,
    per_tier: perTier,
    unverified_share: unverifiedShare,
    reason_mix: reasonMix,
    not_called_share: notCalledShare,
    already_known_by_tier: alreadyKnownByTier,
    false_friends_by_tier: falseFriendsByTier,
  };
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const HELP_TEXT = [
  'measure-355-hit-rate.cjs -- fixture-only hit-rate measurement (D-32, D-34, SPEC AC12)',
  'Usage:',
  '  node scripts/measure-355-hit-rate.cjs export --unstamped [--top <n>] [--room <path>]',
  '  node scripts/measure-355-hit-rate.cjs stamp    (355-25)',
  '  node scripts/measure-355-hit-rate.cjs record   (355-25)',
  '  node scripts/measure-355-hit-rate.cjs --check',
  '  node scripts/measure-355-hit-rate.cjs --help',
  '',
].join('\n');

async function doExport(args) {
  if (args.indexOf('--unstamped') === -1) {
    process.stderr.write('measure-355-hit-rate: export requires --unstamped this phase (355-24)\n');
    return 1;
  }
  let top = 10;
  const topIdx = args.indexOf('--top');
  if (topIdx !== -1 && args[topIdx + 1] !== undefined) {
    const parsed = parseInt(args[topIdx + 1], 10);
    if (Number.isFinite(parsed) && parsed > 0) top = parsed;
  }

  let rooms;
  const roomIdx = args.indexOf('--room');
  if (roomIdx !== -1 && args[roomIdx + 1] !== undefined) {
    let real;
    try {
      real = guardRoomPath(args[roomIdx + 1]);
    } catch (e) {
      process.stderr.write('measure-355-hit-rate: ' + e.message + '\n');
      return 1;
    }
    rooms = [{ name: path.basename(real), dir: real }];
  } else {
    rooms = DEFAULT_ROOM_NAMES.map((name) => ({ name, dir: guardRoomPath(path.join(FIXTURE_ROOT, name)) }));
  }

  let payload;
  try {
    payload = await exportUnstamped(rooms, { top });
  } catch (e) {
    process.stderr.write('measure-355-hit-rate: ' + e.message + '\n');
    return 1;
  }

  const tmpPath = ITEMS_PATH + '.tmp';
  fs.mkdirSync(path.dirname(ITEMS_PATH), { recursive: true });
  fs.writeFileSync(tmpPath, JSON.stringify(payload, null, 2));
  fs.renameSync(tmpPath, ITEMS_PATH);
  process.stdout.write(
    'measure-355-hit-rate: wrote ' + ITEMS_PATH + ' (' + payload.items.length + ' items across ' + rooms.length + ' room(s), top ' + top + ')\n'
  );
  return 0;
}

function doCheck() {
  if (!fs.existsSync(RECORD_PATH)) {
    return 77;
  }
  // 355-25's own scope: recompute the record from tests/fixtures/355-rooms/
  // judgments.json + stamps.json and compare byte-for-byte against
  // hit-rate-record.json, regenerating 355-VERIFICATION.md's hit-rate
  // section. Not implemented in this plan.
  return 0;
}

async function cliMain(argv) {
  const args = Array.isArray(argv) ? argv : process.argv.slice(2);
  const cmd = args[0];

  if (!cmd || cmd === '--help' || cmd === 'help') {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (cmd === '--check') {
    return doCheck();
  }
  if (cmd === 'export') {
    return doExport(args.slice(1));
  }
  if (cmd === 'stamp' || cmd === 'record') {
    process.stderr.write('measure-355-hit-rate: "' + cmd + '" is 355-25\'s own scope, not yet implemented\n');
    return 1;
  }

  process.stderr.write('measure-355-hit-rate: unknown command "' + cmd + '"\n');
  return 1;
}

if (require.main === module) {
  Promise.resolve(cliMain(process.argv.slice(2)))
    .then((code) => {
      process.exitCode = code;
    })
    .catch((err) => {
      process.stderr.write('measure-355-hit-rate: ' + (err && err.stack ? err.stack : err) + '\n');
      process.exitCode = 1;
    });
}

module.exports = {
  guardRoomPath,
  exportUnstamped,
  wilson95,
  joinJudgments,
  computeRates,
  firstSentencesCapped,
  buildExcerpt,
  pairId,
  directionPhraseFor,
  cliMain,
  FIXTURE_ROOT,
  DEFAULT_ROOM_NAMES,
  ITEMS_PATH,
  JUDGMENTS_PATH,
  RECORD_PATH,
};
