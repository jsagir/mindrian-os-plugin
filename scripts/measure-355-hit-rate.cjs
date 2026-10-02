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
 * `stamp` subcommand (355-25 Task 1) stamps the already-judged pairings from
 * one live Theo capture replayed offline; `record` (355-25 Task 3) writes
 * tests/fixtures/355-rooms/hit-rate-record.json and the 355-VERIFICATION.md
 * hit-rate section; `--check` recomputes the record byte-for-byte.
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
const STAMPS_PATH = path.join(FIXTURE_ROOT, 'stamps.json');
const STAMPED_ITEMS_PATH = path.join(FIXTURE_ROOT, 'pairings-stamped.items.json');
const CAPTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', '355-theo-find-connections-responses.json');
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
  // threshold: OPTIONAL, defaults to each engine's own DEFAULT_THRESHOLD
  // (0.3) when absent -- a uniform override (never per-room), recorded on
  // the payload as threshold_used so a reader can see exactly what "shown"
  // meant for this run (D-21's disclosed-floor discipline extended to this
  // dev-time export: the value is stated, not hidden, and the PRODUCTION
  // engine defaults in rs-engine.cjs / hsi-engine.cjs are never touched).
  const threshold = Number.isFinite(options.threshold) ? options.threshold : null;
  const runProducers = typeof options.runProducers === 'function' ? options.runProducers : defaultRunProducers;

  const items = [];
  const roomsMeta = {};
  let encoderModel = null;

  for (const room of Array.isArray(rooms) ? rooms : []) {
    const roomName = room.name;
    // eslint-disable-next-line no-await-in-loop
    const roomResult = await runProducers({ room: roomName, dir: room.dir, top, threshold });
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
    threshold_used: threshold === null ? 'engine_default' : threshold,
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
  const embeddingSpine = require('../lib/core/semantic-index/embedding-spine.cjs');

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
      const hsiOpts = Number.isFinite(ctx.threshold) ? { threshold: ctx.threshold } : {};
      const hsiResult = await hsiEngine.runTier1(copyDir, hsiOpts);
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
      const rsOpts = { topk: ctx.top };
      if (Number.isFinite(ctx.threshold)) rsOpts.threshold = ctx.threshold;
      const rsResult = await rsEngine.runModeInternal(copyDir, rsOpts);
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
    // the room-native substrate the retired Eureka runner needed (indexed
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

  // false_friends_by_tier (355-25, D17): a planted false friend (a
  // same-word, different-meaning pair from planted-cases.json, joined by
  // artifact paths) counts only when the reader marked the named direction
  // WRONG (direction_ok === false) -- a term collision the engine's
  // direction label did not survive. false_friends_shown_by_tier counts
  // every planted false friend that was shown, whatever the direction mark,
  // so a reader can see the denominator beside the count.
  const falseFriendsByTier = { strong: 0, indirect: 0, unverified: 0 };
  const falseFriendsShownByTier = { strong: 0, indirect: 0, unverified: 0 };
  for (const r of list) {
    if (!r.a_path || !r.b_path) continue;
    const key = [r.a_path, r.b_path].sort().join('\u0000');
    if (!ffKeySet.has(key)) continue;
    const tier = r.stamp && TIERS.indexOf(r.stamp.verification) !== -1 ? r.stamp.verification : null;
    if (!tier) continue;
    falseFriendsShownByTier[tier] += 1;
    if (r.direction_ok === false) falseFriendsByTier[tier] += 1;
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
    false_friends_shown_by_tier: falseFriendsShownByTier,
  };
}

// ---------------------------------------------------------------------------
// directionFromPhrase(phrase): the inverse of directionPhraseFor -- exact
// string match against DIRECTION_MEANING's two confirmed phrases, else the
// NONE direction id (D-49: whitespace / find-connections items carry no
// wording-difference measurement at all). pairings.items.json stores only
// the rendered phrase, never the raw direction id, so a stamp's own
// `direction` field is re-derived here rather than re-measured.
// ---------------------------------------------------------------------------
function directionFromPhrase(phrase) {
  const meaning = directionConvention.DIRECTION_MEANING;
  for (const id of Object.keys(meaning)) {
    if (meaning[id] === phrase) return id;
  }
  return directionConvention.NONE;
}

// ---------------------------------------------------------------------------
// sha256OfFile(p): hex sha256 of a file's exact bytes on disk (provenance
// hashing for stamps.json's capture_sha256 / the fixture_sha256 refusal
// gate -- both anchor to the byte-identical file a reader can re-hash).
// ---------------------------------------------------------------------------
function sha256OfFile(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

// ---------------------------------------------------------------------------
// resolveArtifactEndpoint(roomCopyDir, relPath, deps): reads the artifact's
// RAW file bytes (frontmatter intact) from a temp room copy, derives its
// title the same way rs-engine.cjs's own discoverArtifacts does
// (extractTitle), then runs extractCarried + resolveEndpoint against the
// local canon-name snapshot (D-10, D-48). A missing file degrades to
// title-only resolution against an empty string, matching
// reverse-salient-agent.cjs's own rsEndpoints idiom -- never guesses, never
// asks Theo to resolve a name.
// ---------------------------------------------------------------------------
function resolveArtifactEndpoint(roomCopyDir, relPath, deps) {
  const rsEngine = deps.rsEngine;
  const verificationStamp = deps.verificationStamp;
  const fp = path.join(roomCopyDir, relPath);
  let raw = '';
  try {
    raw = fs.readFileSync(fp, 'utf8');
  } catch (_e) {
    raw = '';
  }
  const title = rsEngine.extractTitle(raw, fp);
  const carried = verificationStamp.extractCarried(raw, title);
  const resolved = verificationStamp.resolveEndpoint(carried, { names: deps.names, registry: deps.registry });
  return { name: resolved.name, via: resolved.via, title };
}

// ---------------------------------------------------------------------------
// doStamp(): the `stamp` subcommand (355-25, HIPS-04, HIPS-07). Refuses
// unless judgments.json exists and its fixture_sha256 matches
// pairings.items.json's own byte-identical sha256 (D-32: stamps only after
// the blind sitting-1 judgments are committed). Resolves every item's two
// endpoints from a FRESH TEMP COPY of its fixture room (never the tracked
// tree itself), runs capture-355-theo-responses.cjs --live --append once
// against the distinct resolvable canon-name pairs, then stamps every item
// offline by replaying the merged capture file through
// lib/core/verification-stamp.cjs's own deps.callTool seam (zero network
// during stamping -- the capture step is the only live call this command
// ever makes).
// ---------------------------------------------------------------------------
async function doStamp() {
  if (!fs.existsSync(ITEMS_PATH)) {
    process.stderr.write('measure-355-hit-rate: stamp refused -- ' + ITEMS_PATH + ' does not exist (run export --unstamped first)\n');
    return 1;
  }
  if (!fs.existsSync(JUDGMENTS_PATH)) {
    process.stderr.write('measure-355-hit-rate: stamp refused -- ' + JUDGMENTS_PATH + ' does not exist (stamps only after the sitting-1 blind judgments are committed, D-32)\n');
    return 1;
  }

  const itemsRaw = fs.readFileSync(ITEMS_PATH, 'utf8');
  const itemsSha256 = crypto.createHash('sha256').update(itemsRaw).digest('hex');
  const itemsPayload = JSON.parse(itemsRaw);
  const judgmentsPayload = JSON.parse(fs.readFileSync(JUDGMENTS_PATH, 'utf8'));

  if (judgmentsPayload.fixture_sha256 !== itemsSha256) {
    process.stderr.write(
      'measure-355-hit-rate: stamp refused -- judgments.json.fixture_sha256 (' + judgmentsPayload.fixture_sha256 +
      ') does not match the current sha256 of pairings.items.json (' + itemsSha256 + ')\n'
    );
    return 1;
  }

  const items = Array.isArray(itemsPayload.items) ? itemsPayload.items : [];

  // Lazy requires (D-32's own idiom: requiring the stamp module is 355-25's
  // own scope, never reached by the export --unstamped path above).
  // eslint-disable-next-line global-require
  const verificationStamp = require('../lib/core/verification-stamp.cjs');
  // eslint-disable-next-line global-require
  const rsEngine = require('../lib/core/rs-engine.cjs');

  const names = verificationStamp.loadFrameworkNames();
  const registry = verificationStamp.loadCommandFrameworks();
  const deps = { rsEngine, verificationStamp, names, registry };

  // One fresh temp copy per distinct room referenced by the 96 items (never
  // the tracked tests/fixtures/355-rooms tree itself -- guardRoomPath proves
  // the source, cpSync writes only to os.tmpdir()).
  const roomNames = Array.from(new Set(items.map((it) => it.room)));
  const roomCopyDirs = {};
  const tmpRoots = [];
  try {
    for (const roomName of roomNames) {
      const guardedSrc = guardRoomPath(path.join(FIXTURE_ROOT, roomName));
      const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'measure-355-stamp-'));
      const copyDir = path.join(tmpRoot, roomName);
      fs.cpSync(guardedSrc, copyDir, { recursive: true });
      roomCopyDirs[roomName] = copyDir;
      tmpRoots.push(tmpRoot);
    }

    const endpointsByPairId = {};
    for (const it of items) {
      const from = resolveArtifactEndpoint(roomCopyDirs[it.room], it.a_path, deps);
      const to = resolveArtifactEndpoint(roomCopyDirs[it.room], it.b_path, deps);
      endpointsByPairId[it.pair_id] = {
        fromHandle: from.name,
        toHandle: to.name,
        fromVia: from.via,
        toVia: to.via,
        direction: directionFromPhrase(it.direction_phrase),
      };
    }

    // Distinct resolvable (both sides matched) canon-name pairs, in first-
    // seen order, order-sensitive (from -> to), matching stampFindings' own
    // pairKeyOf convention.
    const distinctPairs = [];
    const seenPairKeys = new Set();
    for (const pid of Object.keys(endpointsByPairId)) {
      const e = endpointsByPairId[pid];
      if (!e.fromHandle || !e.toHandle) continue;
      const key = e.fromHandle + '\u0000' + e.toHandle;
      if (seenPairKeys.has(key)) continue;
      seenPairKeys.add(key);
      distinctPairs.push({ from: e.fromHandle, to: e.toHandle });
    }

    // Run the one live capture (canon names only, through
    // capture-355-theo-responses.cjs's own brain-client wire door) even when
    // distinctPairs is empty, so --check's captured_at/snapshot_sha256
    // invariants and this run's own record of "zero resolvable pairs this
    // fixture set" both come from the same real invocation, never skipped.
    const scratchPairsPath = path.join(os.tmpdir(), 'measure-355-stamp-pairs-' + process.pid + '-' + Date.now() + '.json');
    fs.writeFileSync(scratchPairsPath, JSON.stringify(distinctPairs, null, 2));
    let captureResult;
    try {
      // eslint-disable-next-line global-require
      const { spawnSync } = require('node:child_process');
      const captureScript = path.join(REPO_ROOT, 'scripts', 'capture-355-theo-responses.cjs');
      captureResult = spawnSync(process.execPath, [captureScript, '--live', '--append', '--pairs', scratchPairsPath], {
        stdio: 'inherit',
      });
    } finally {
      fs.rmSync(scratchPairsPath, { force: true });
    }

    if (!captureResult || captureResult.status !== 0) {
      process.stderr.write(
        'measure-355-hit-rate: BLOCKED -- capture-355-theo-responses --live --append exited ' +
        (captureResult ? String(captureResult.status) : '(spawn failed)') +
        '; Theo is unreachable or refused. Not recording an outage as findings; re-run stamp once Theo answers.\n'
      );
      return 1;
    }

    if (!fs.existsSync(CAPTURE_PATH)) {
      process.stderr.write('measure-355-hit-rate: BLOCKED -- capture-355-theo-responses reported success but ' + CAPTURE_PATH + ' is missing\n');
      return 1;
    }

    const captureSha256 = sha256OfFile(CAPTURE_PATH);
    const capturePayload = JSON.parse(fs.readFileSync(CAPTURE_PATH, 'utf8'));

    // Local replay only from here on: zero network during stamping. Reuses
    // the vetted sentinel vocabulary tests/helpers/theo-replay-355.cjs
    // already carries for capture-355-theo-responses.cjs's own
    // $null/$error/$text shapes (Part 7: reuse before build) -- this
    // measurement script never opens a second socket door of its own.
    // eslint-disable-next-line global-require
    const { makeReplayCallTool } = require('../tests/helpers/theo-replay-355.cjs');
    const replayCallTool = makeReplayCallTool(capturePayload);

    const stampsByPairId = {};
    const stampedItems = [];
    for (const it of items) {
      const e = endpointsByPairId[it.pair_id];
      const finding = {
        fromHandle: e.fromHandle,
        toHandle: e.toHandle,
        direction: e.direction,
        fromVia: e.fromVia,
        toVia: e.toVia,
      };
      // eslint-disable-next-line no-await-in-loop
      const { stamp, detail } = await verificationStamp.stampFindingDetailed(finding, { callTool: replayCallTool });
      stampsByPairId[it.pair_id] = { stamp, detail };
      // eslint-disable-next-line global-require
      const { formatStampLines } = require('../lib/core/verification-stamp-format.cjs');
      const stampLines = formatStampLines(stamp, 'cli').join('\n');
      stampedItems.push(Object.assign({}, it, { stamp_lines: stampLines }));
    }

    const snapshotSha256 = typeof capturePayload.snapshot_sha256 === 'string' ? capturePayload.snapshot_sha256 : null;

    const stampsPayload = {
      generated_at: new Date().toISOString(),
      capture_sha256: captureSha256,
      snapshot_sha256: snapshotSha256,
      by_pair: stampsByPairId,
    };

    const stampsTmp = STAMPS_PATH + '.tmp';
    fs.writeFileSync(stampsTmp, JSON.stringify(stampsPayload, null, 2));
    fs.renameSync(stampsTmp, STAMPS_PATH);

    const stampedItemsPayload = Object.assign({}, itemsPayload, { items: stampedItems });
    const stampedItemsTmp = STAMPED_ITEMS_PATH + '.tmp';
    fs.writeFileSync(stampedItemsTmp, JSON.stringify(stampedItemsPayload, null, 2));
    fs.renameSync(stampedItemsTmp, STAMPED_ITEMS_PATH);

    process.stdout.write(
      'measure-355-hit-rate: wrote ' + STAMPS_PATH + ' and ' + STAMPED_ITEMS_PATH +
      ' (' + items.length + ' items, ' + distinctPairs.length + ' distinct resolvable canon-name pairs)\n'
    );
    return 0;
  } finally {
    for (const t of tmpRoots) {
      fs.rmSync(t, { recursive: true, force: true });
    }
  }
}

// ---------------------------------------------------------------------------
// 355-25 Task 3: the hit-rate record (SPEC Req 7, AC12, AI-SPEC D16/D17 and
// Section 6). buildRecord() is PURE over already-parsed inputs (no Date, no
// network, no randomness) so --check can recompute it byte-for-byte;
// loadRecordInputs() is the only file reader; renderSection() turns the
// machine record into the 355-VERIFICATION.md section, which is a VIEW of
// the record and never a second source of any number.
// ---------------------------------------------------------------------------
const JUDGMENTS_STAMPED_PATH = path.join(FIXTURE_ROOT, 'judgments-stamped.json');
const PLANTED_PATH = path.join(FIXTURE_ROOT, 'planted-cases.json');
const PHASE_DIR = path.join(REPO_ROOT, '.planning', 'phases', '355-hidden-in-plain-sight-jev-through-theo-cross-connection-engi');
const VERIFICATION_PATH = path.join(PHASE_DIR, '355-VERIFICATION.md');
const SESSION_STAMPED_PATH = path.join(PHASE_DIR, 'labeling-session-pairings-stamped.json');
const NAME_SNAPSHOT_PATH = path.join(REPO_ROOT, 'data', 'framework-names.json');
const SECTION_HEADING = '## Hit-rate record (SPEC Req 7)';
const SECTION_END = '<!-- hit-rate-record:end -->';
const SECTION_REGEN_COMMENT = '<!-- Regenerate with node scripts/measure-355-hit-rate.cjs record; verifiers append below, never overwrite this section. -->';
const HUB_PROXY_SOURCE = 'in-sample proxy: interior-node frequency across the strong paths in this record, top decile (no governed Theo call returns node degree)';

// percentileNearestRank(values, p): the nearest-rank percentile (the
// smallest value with at least p of the sample at or below it). null on an
// empty sample.
function percentileNearestRank(values, p) {
  const v = (Array.isArray(values) ? values : []).filter((x) => Number.isFinite(x)).slice().sort((a, b) => a - b);
  if (v.length === 0) return null;
  const idx = Math.min(v.length - 1, Math.max(0, Math.ceil(p * v.length) - 1));
  return v[idx];
}

function rateOfRows(rows, field) {
  const f = field || 'useful';
  const n = rows.length;
  const k = rows.filter((r) => r[f] === true).length;
  return { k, n, rate: n > 0 ? k / n : 0, wilson: wilson95(k, n) };
}

function tierOf(stamp) {
  return stamp && TIERS.indexOf(stamp.verification) !== -1 ? stamp.verification : null;
}

// hubMetrics(rows): Section 6 hub-inflation share, provenance-routed strong
// count (RESEARCH C6), and diversity, over the STRONG stamps of the joined
// rows. The degree source is the in-sample proxy (HUB_PROXY_SOURCE): count
// how often each interior node (every node but the two endpoints) appears
// across the strong paths, sort by count (ties by name), take the top
// decile of distinct interior nodes (at least one; a tie at the cut is
// included), and report the share of strong stamps whose interior crosses
// one of them.
function hubMetrics(rows) {
  const strong = rows.filter((r) => r.stamp && r.stamp.verification === 'strong' && r.stamp.path && Array.isArray(r.stamp.path.nodes));
  const freq = new Map();
  for (const r of strong) {
    const interior = r.stamp.path.nodes.slice(1, -1);
    for (const node of interior) freq.set(node, (freq.get(node) || 0) + 1);
  }
  const ranked = Array.from(freq.entries())
    .map(([node, count]) => ({ node, count }))
    .sort((a, b) => (b.count - a.count) || (a.node < b.node ? -1 : (a.node > b.node ? 1 : 0)));
  let top = [];
  if (ranked.length > 0) {
    const cut = Math.max(1, Math.ceil(0.1 * ranked.length));
    const threshold = ranked[cut - 1].count;
    top = ranked.filter((x) => x.count >= threshold);
  }
  const topSet = new Set(top.map((x) => x.node));
  const crossing = strong.filter((r) => r.stamp.path.nodes.slice(1, -1).some((n) => topSet.has(n))).length;
  const provenance = strong.filter((r) => {
    const labels = Array.isArray(r.stamp.path.labels) ? r.stamp.path.labels : [];
    const edges = Array.isArray(r.stamp.path.edges) ? r.stamp.path.edges : [];
    return labels.indexOf('BrainRecord') !== -1 || edges.indexOf('SOURCED_FROM') !== -1;
  }).length;
  return {
    hub_inflation: {
      k: crossing,
      n: strong.length,
      share: strong.length > 0 ? crossing / strong.length : 0,
      proxy_source: HUB_PROXY_SOURCE,
      top_decile_nodes: top,
      interior_node_frequency: ranked,
    },
    provenance_routed_strong: provenance,
    diversity: {
      distinct_interior_nodes: ranked.length,
      strong_stamps: strong.length,
      ratio: strong.length > 0 ? ranked.length / strong.length : 0,
    },
  };
}

// buildRecord(inp): inp = {
//   items, stampedItems, judgments, judgmentsStamped, stamps, capture,
//   planted, session (optional), nameSnapshot (optional),
//   sha: { items, stamped_items, judgments, judgments_stamped, stamps,
//          capture, planted, session, name_snapshot } }.
// Throws on any provenance mismatch (a judgments file pinned to a different
// items file, a missing stamp, a pair set that differs between sittings)
// rather than computing a number over the wrong join.
function buildRecord(inp) {
  const items = inp.items.items;
  const stampedItems = inp.stampedItems.items;
  const byPair = inp.stamps.by_pair || {};

  if (inp.judgments.fixture_sha256 !== inp.sha.items) {
    throw new Error('record: judgments.json fixture_sha256 does not match pairings.items.json');
  }
  if (inp.judgmentsStamped.fixture_sha256 !== inp.sha.stamped_items) {
    throw new Error('record: judgments-stamped.json fixture_sha256 does not match pairings-stamped.items.json');
  }
  const ids = items.map((i) => i.pair_id).sort();
  const stampedIds = stampedItems.map((i) => i.pair_id).sort();
  const blindIds = inp.judgments.items.map((j) => j.pair_id).sort();
  const shownIds = inp.judgmentsStamped.items.map((j) => j.pair_id).sort();
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  if (!same(ids, blindIds)) throw new Error('record: sitting-1 judgments do not cover exactly the shown pairings');
  if (!same(ids, stampedIds)) throw new Error('record: the stamped item file does not carry exactly the shown pairings');
  if (!same(stampedIds, shownIds)) throw new Error('record: sitting-2 judgments do not cover exactly the stamped pairings');
  for (const id of ids) {
    if (!byPair[id] || !byPair[id].stamp) throw new Error('record: no stamp for pair ' + id);
  }

  const itemById = new Map(items.map((i) => [i.pair_id, i]));
  const plantedCases = inp.planted;

  // Per-tier rates come from the BLIND sitting-1 labels joined to the stamps
  // (AI-SPEC Labeling step 3); sitting 2 is the as-shown pass only.
  const blindJoined = joinJudgments(inp.judgments, inp.items, byPair);
  const shownJoined = joinJudgments(inp.judgmentsStamped, inp.stampedItems, byPair);
  const blind = computeRates(blindJoined, { plantedCases });
  const shown = computeRates(shownJoined, { plantedCases });
  const shownById = new Map(shownJoined.map((r) => [r.pair_id, r]));

  for (const r of blindJoined) r.direction_phrase = itemById.get(r.pair_id).direction_phrase;

  function groupRates(rows, keyFn, field) {
    const groups = {};
    for (const r of rows) {
      const key = keyFn(r);
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    }
    const out = {};
    for (const key of Object.keys(groups).sort()) out[key] = rateOfRows(groups[key], field);
    return out;
  }

  const tierCounts = { strong: 0, indirect: 0, unverified: 0 };
  for (const r of blindJoined) tierCounts[tierOf(r.stamp)] += 1;

  // Stamp influence: the as-shown pass minus the blind pass, per pairing.
  const agreement = {};
  for (const f of ['useful', 'direction_ok', 'already_known']) {
    const agree = blindJoined.filter((r) => shownById.get(r.pair_id)[f] === r[f]).length;
    agreement[f] = { agree, n: blindJoined.length, rate: blindJoined.length > 0 ? agree / blindJoined.length : 0 };
  }
  const usefulFlips = {
    not_useful_to_useful: blindJoined.filter((r) => r.useful === false && shownById.get(r.pair_id).useful === true).length,
    useful_to_not_useful: blindJoined.filter((r) => r.useful === true && shownById.get(r.pair_id).useful === false).length,
  };
  const gapPerTier = {};
  for (const t of TIERS) gapPerTier[t] = shown.per_tier[t].rate - blind.per_tier[t].rate;

  // Direction fidelity: direction_ok from the blind pass, by shown phrase and
  // by tier; planted cases joined by artifact paths only now, after both
  // sittings (planted-cases.json's own _note).
  const pathKey = (a, b) => [a, b].sort().join('\u0000');
  const rowByPaths = new Map(blindJoined.map((r) => [pathKey(r.a_path, r.b_path), r]));
  const plantedShown = [];
  for (const kind of ['false_friends', 'meaning_bridges']) {
    const list = Array.isArray(plantedCases && plantedCases[kind]) ? plantedCases[kind] : [];
    for (const c of list) {
      const r = rowByPaths.get(pathKey(c.a, c.b));
      if (!r) continue;
      plantedShown.push({
        kind: kind === 'false_friends' ? 'false_friend' : 'meaning_bridge',
        pair_id: r.pair_id,
        room: r.room,
        direction_phrase: r.direction_phrase,
        tier: tierOf(r.stamp),
        direction_ok: r.direction_ok,
        useful: r.useful,
      });
    }
  }
  plantedShown.sort((a, b) => (a.kind < b.kind ? -1 : (a.kind > b.kind ? 1 : (a.pair_id < b.pair_id ? -1 : 1))));

  // Verified versus already known (Section 6 domain failure mode 4).
  const usefulNovelByTier = {};
  for (const t of TIERS) {
    usefulNovelByTier[t] = blindJoined.filter((r) => tierOf(r.stamp) === t && r.useful === true && r.already_known === false).length;
  }

  const hub = hubMetrics(blindJoined);

  const latency = Array.isArray(inp.capture.latency_ms) ? inp.capture.latency_ms : [];
  const theoLatency = {
    p50: percentileNearestRank(latency, 0.5),
    p95: percentileNearestRank(latency, 0.95),
    n: latency.length,
    min: latency.length ? Math.min.apply(null, latency) : null,
    max: latency.length ? Math.max.apply(null, latency) : null,
    calls: Number.isFinite(inp.capture.calls) ? inp.capture.calls : null,
    responses: inp.capture.responses ? Object.keys(inp.capture.responses).length : null,
    captured_at: inp.capture.captured_at || null,
    method: 'nearest-rank percentile over every latency_ms value in tests/fixtures/355-theo-find-connections-responses.json (plugin side, through brain-client, dev machine)',
  };

  // Labelers and how sitting 2 was taken (from the raw session file).
  let viaCli = null;
  let viaChat = null;
  let untimed = null;
  if (inp.session && inp.session.entries) {
    const entries = Object.values(inp.session.entries);
    viaChat = entries.filter((e) => e.via === 'chat-sitting').length;
    viaCli = entries.filter((e) => !e.via).length;
    untimed = entries.filter((e) => e.ms === null || e.ms === undefined).length;
    if (inp.session.fixture_sha256 !== inp.sha.stamped_items) {
      throw new Error('record: the sitting-2 session file is pinned to a different stamped item file');
    }
  }

  const perRoomJudgments = {};
  for (const it of items) {
    const b = blindJoined.find((r) => r.pair_id === it.pair_id);
    const s = shownById.get(it.pair_id);
    if (!perRoomJudgments[it.room]) perRoomJudgments[it.room] = [];
    perRoomJudgments[it.room].push({
      pair_id: it.pair_id,
      producer: it.producer,
      direction_phrase: it.direction_phrase,
      tier: tierOf(b.stamp),
      reason: b.stamp.reason || null,
      useful: b.useful,
      direction_ok: b.direction_ok,
      already_known: b.already_known,
      as_shown: { useful: s.useful, direction_ok: s.direction_ok, already_known: s.already_known },
    });
  }

  const nameSnap = inp.nameSnapshot || {};

  return {
    schema: 'hit-rate-record/1',
    _note: 'Phase 355 (HIPS-07) first human-judged hit rate. Dev-repo fixture rooms only, not real ventures; no target. Rates are fractions here; 355-VERIFICATION.md renders them. Regenerate with: node scripts/measure-355-hit-rate.cjs record; verify with --check.',
    inputs: {
      pairings_items_sha256: inp.sha.items,
      pairings_stamped_items_sha256: inp.sha.stamped_items,
      judgments_sha256: inp.sha.judgments,
      judgments_stamped_sha256: inp.sha.judgments_stamped,
      stamps_sha256: inp.sha.stamps,
      capture_sha256: inp.sha.capture,
      stamps_capture_sha256: inp.stamps.capture_sha256 || null,
      planted_cases_sha256: inp.sha.planted,
      session_stamped_sha256: inp.sha.session || null,
      theo_snapshot_sha256: inp.stamps.snapshot_sha256 || null,
      name_snapshot_date: nameSnap.snapshot_date || null,
      name_snapshot_source_sha256: nameSnap.source_sha256 || null,
    },
    export: {
      encoder: inp.items.encoder || null,
      top_k: inp.items.top_k,
      threshold_used: inp.items.threshold_used,
    },
    rooms: inp.items.rooms,
    labelers: {
      sitting_1: { labeler: inp.judgments.labeler, labeled_at: inp.judgments.labeled_at, n: inp.judgments.items.length, stamps_shown: false },
      sitting_2: {
        labeler: inp.judgmentsStamped.labeler,
        labeled_at: inp.judgmentsStamped.labeled_at,
        n: inp.judgmentsStamped.items.length,
        stamps_shown: true,
        via_cli: viaCli,
        via_chat_sitting: viaChat,
        untimed: untimed,
      },
      second_labeler: null,
    },
    stamped_only_pairings: stampedIds.filter((id) => !itemById.has(id)).length,
    per_room: blind.per_room,
    pooled: blind.pooled,
    per_tier: blind.per_tier,
    per_producer: groupRates(blindJoined, (r) => r.producer),
    per_direction: groupRates(blindJoined, (r) => r.direction_phrase),
    baseline: Object.assign({ definition: 'sitting 1 (blind, no stamp) useful rate over every shown pairing of today\'s raw HSI / RS output' }, blind.pooled),
    as_shown: {
      pooled: shown.pooled,
      per_room: shown.per_room,
      per_tier: shown.per_tier,
    },
    stamp_influence: {
      gap: shown.pooled.rate - blind.pooled.rate,
      gap_per_tier: gapPerTier,
      agreement,
      useful_flips: usefulFlips,
    },
    tier_counts: tierCounts,
    unverified_share: blind.unverified_share,
    reason_mix: blind.reason_mix,
    not_called_share: blind.not_called_share,
    hub_inflation_share: hub.hub_inflation.share,
    hub_inflation: hub.hub_inflation,
    provenance_routed_strong: hub.provenance_routed_strong,
    diversity: hub.diversity,
    direction_fidelity: {
      overall: rateOfRows(blindJoined, 'direction_ok'),
      by_phrase: groupRates(blindJoined, (r) => r.direction_phrase, 'direction_ok'),
      by_tier: (() => {
        const out = {};
        for (const t of TIERS) out[t] = rateOfRows(blindJoined.filter((r) => tierOf(r.stamp) === t), 'direction_ok');
        return out;
      })(),
      as_shown_overall: rateOfRows(shownJoined, 'direction_ok'),
    },
    false_friends_by_tier: blind.false_friends_by_tier,
    false_friends_shown_by_tier: blind.false_friends_shown_by_tier,
    planted: {
      false_friends_total: Array.isArray(plantedCases.false_friends) ? plantedCases.false_friends.length : 0,
      meaning_bridges_total: Array.isArray(plantedCases.meaning_bridges) ? plantedCases.meaning_bridges.length : 0,
      shown: plantedShown,
    },
    already_known_by_tier: blind.already_known_by_tier,
    useful_novel_by_tier: usefulNovelByTier,
    already_known_overall: rateOfRows(blindJoined, 'already_known'),
    theo_latency_ms: theoLatency,
    judgments: perRoomJudgments,
  };
}

function sha256OfText(t) {
  return crypto.createHash('sha256').update(t).digest('hex');
}

// loadRecordInputs(): the only file reader behind the record. Every hash is
// over the exact bytes on disk.
function loadRecordInputs() {
  const read = (p) => fs.readFileSync(p, 'utf8');
  const raw = {
    items: read(ITEMS_PATH),
    stamped_items: read(STAMPED_ITEMS_PATH),
    judgments: read(JUDGMENTS_PATH),
    judgments_stamped: read(JUDGMENTS_STAMPED_PATH),
    stamps: read(STAMPS_PATH),
    capture: read(CAPTURE_PATH),
    planted: read(PLANTED_PATH),
    session: fs.existsSync(SESSION_STAMPED_PATH) ? read(SESSION_STAMPED_PATH) : null,
    name_snapshot: fs.existsSync(NAME_SNAPSHOT_PATH) ? read(NAME_SNAPSHOT_PATH) : null,
  };
  const sha = {};
  for (const k of Object.keys(raw)) sha[k] = raw[k] === null ? null : sha256OfText(raw[k]);
  return {
    items: JSON.parse(raw.items),
    stampedItems: JSON.parse(raw.stamped_items),
    judgments: JSON.parse(raw.judgments),
    judgmentsStamped: JSON.parse(raw.judgments_stamped),
    stamps: JSON.parse(raw.stamps),
    capture: JSON.parse(raw.capture),
    planted: JSON.parse(raw.planted),
    session: raw.session === null ? null : JSON.parse(raw.session),
    nameSnapshot: raw.name_snapshot === null ? null : JSON.parse(raw.name_snapshot),
    sha,
  };
}

function serializeRecord(record) {
  return JSON.stringify(record, null, 2) + '\n';
}

// ---- rendering (numbers allowed: a dev record, not a user surface) ----
function pct(x) {
  return (x * 100).toFixed(1) + '%';
}

function fmtRate(r) {
  if (!r || r.n === 0) return '0 of 0 (no pairings in this bucket, so no rate)';
  return r.k + ' of ' + r.n + ' (' + pct(r.rate) + ', 95% Wilson ' + pct(r.wilson[0]) + ' to ' + pct(r.wilson[1]) + ')';
}

function rateRow(label, r) {
  if (!r || r.n === 0) return '| ' + label + ' | 0 / 0 | no rate | no interval |';
  return '| ' + label + ' | ' + r.k + ' / ' + r.n + ' | ' + pct(r.rate) + ' | ' + pct(r.wilson[0]) + ' to ' + pct(r.wilson[1]) + ' |';
}

function pp(x) {
  const v = x * 100;
  const s = (v >= 0 ? '+' : '') + v.toFixed(1);
  return s + ' percentage points';
}

function plural(n, word) {
  return n + ' ' + word + (n === 1 ? '' : 's');
}

function yn(b) {
  return b === true ? 'y' : (b === false ? 'n' : '-');
}

const ROOM_SHAPES = {
  'room-ill-defined': 'an ill-defined problem (rural clinics losing patients between referral and follow-up)',
  'room-extend': 'the extend-the-opportunity step (a working cold-chain delivery service looking at an adjacent use)',
  'room-control': 'four deliberately distant domains with planted meaning bridges and planted same-word cases',
};

function renderSection(record) {
  const L = [];
  const push = (...xs) => { for (const x of xs) L.push(x); };
  const pooled = record.pooled;
  const base = record.baseline;
  const tiers = record.per_tier;
  const s1 = record.labelers.sitting_1;
  const s2 = record.labelers.sitting_2;
  const totalShown = pooled.n;
  const rooms = Object.keys(record.rooms);

  push(SECTION_HEADING, '', SECTION_REGEN_COMMENT, '');
  push(
    'This is the first time anyone has measured whether the connection engines show a person something worth reading. ' +
    'The navigator read every pairing the engines showed on three small practice rooms and answered three yes / no questions about each one: ' +
    'is this useful, is the named direction right, and did I already know this. ' +
    'Every number below is computed by code from those answers. The machine source is `tests/fixtures/355-rooms/hit-rate-record.json`; ' +
    '`node scripts/measure-355-hit-rate.cjs --check` recomputes it from the raw files and fails if a single value differs. ' +
    'No live room was read or written: the measurement script refuses any room path outside `tests/fixtures/355-rooms/`, and every engine ran on a temporary copy.',
    ''
  );

  // Rooms and producers
  push('### Rooms and producers', '');
  push('| Room | Shape | Producers that ran | Shown pairings |', '|---|---|---|---|');
  for (const room of rooms) {
    const meta = record.rooms[room];
    push('| `' + room + '` | ' + (ROOM_SHAPES[room] || 'fixture room') + ' | ' + meta.producers_ran.join(', ') + ' | ' + meta.shown + ' |');
  }
  push('');
  push(
    'The pairings are what HSI and the reverse-salient engine showed, at most ' + record.export.top_k + ' per producer per room, ' +
    'with a similarity floor of ' + record.export.threshold_used + ' applied the same way to every room (the engines\' own default is 0.3; the lower floor was needed to reach 20 shown pairings per room). ' +
    'The encoder was `' + record.export.encoder + '`. Eureka showed nothing: these rooms are plain markdown with no extracted entities, so its substrate was unavailable, and the record says so instead of guessing a ranked pair. ' +
    'Pairings were deduplicated across producers, so ' + totalShown + ' distinct pairings were judged in total.',
    ''
  );
  push(
    'One labeler, the navigator, judged every pairing twice. Sitting 1 was blind: the pairing with no stamp (' + s1.n + ' judged, finished ' + s1.labeled_at + '). ' +
    'Stamps were computed only after sitting 1 was committed. Sitting 2 showed the same pairings shuffled, now with their stamp lines (' + s2.n + ' judged, finished ' + s2.labeled_at + '). ' +
    'No pairing appeared only in the stamped pass (' + record.stamped_only_pairings + ' stamped-only pairings).',
    ''
  );

  // Hit rate
  push('### Hit rate', '');
  push(
    '"Useful" means the navigator said yes to "is this useful" in the blind sitting. The 95% Wilson interval is the range of true rates that could plausibly produce the count we saw; a small count gives a wide range, which is the honest shape of a first measurement.',
    ''
  );
  push('| Scope | Useful / judged | Rate | 95% Wilson interval |', '|---|---|---|---|');
  for (const room of rooms) push(rateRow('`' + room + '`', record.per_room[room]));
  push(rateRow('**Pooled**', pooled));
  push('');
  push('Per stamp tier (blind sitting-1 labels joined to the stamps by pair id, so the stamp could not anchor the label):', '');
  push('| Tier | Useful / judged | Rate | 95% Wilson interval |', '|---|---|---|---|');
  for (const t of TIERS) push(rateRow(t, tiers[t]));
  push('');
  const strongBeats = tiers.strong.n > 0 && tiers.strong.wilson[0] > base.rate;
  if (strongBeats) {
    push('The strong tier\'s whole interval sits above the unstamped baseline rate: on these rooms, a strong stamp picked out pairings the navigator found useful more often than the raw output did.', '');
  } else {
    push(
      'Strong-tier pairings were judged useful ' + fmtRate(tiers.strong) + ', against the unstamped baseline of ' + pct(base.rate) + '. ' +
      'The strong interval does not sit above the baseline, so, in the words of AI-SPEC Section 6, the tier carries no measured information yet. ' +
      'The tier rule is not changed in this phase; the result goes to the next engine phase\'s discussion.',
      ''
    );
  }
  push('Per producer (blind):', '');
  push('| Producer | Useful / judged | Rate | 95% Wilson interval |', '|---|---|---|---|');
  for (const p of Object.keys(record.per_producer)) push(rateRow(p, record.per_producer[p]));
  push('');

  // Unstamped baseline
  push('### Unstamped baseline', '');
  push(
    'The unstamped baseline is the rate on today\'s raw engine output with no stamp in sight: sitting 1 over all ' + base.n + ' shown pairings, ' + fmtRate(base) + '. ' +
    'It is the same number as the pooled rate above, on purpose: every shown pairing was judged blind, so the pooled blind rate is the baseline, and each tier rate is a slice of that same blind judging. ' +
    'A tier rate is read against this baseline, never against zero.',
    ''
  );

  // As-shown
  const inf = record.stamp_influence;
  push('### As-shown rate and stamp influence', '');
  push(
    'Sitting 2 showed the same pairings again, shuffled, each with its stamp lines. The as-shown useful rate is ' + fmtRate(record.as_shown.pooled) + '. ' +
    'The gap between the as-shown rate and the unstamped baseline is ' + pp(inf.gap) + '. ' +
    'That gap measures how much seeing the stamp moved the reader. It is not a measure of usefulness, and the tier rates above never use sitting-2 labels.',
    ''
  );
  push('| Tier | Blind useful rate | As-shown useful rate | Gap |', '|---|---|---|---|');
  for (const t of TIERS) {
    push('| ' + t + ' | ' + fmtRate(tiers[t]) + ' | ' + fmtRate(record.as_shown.per_tier[t]) + ' | ' + pp(inf.gap_per_tier[t]) + ' |');
  }
  push('');
  push(
    'Per pairing, the two sittings agreed on useful ' + inf.agreement.useful.agree + ' of ' + inf.agreement.useful.n +
    ', on direction ' + inf.agreement.direction_ok.agree + ' of ' + inf.agreement.direction_ok.n +
    ', and on already known ' + inf.agreement.already_known.agree + ' of ' + inf.agreement.already_known.n + '. ' +
    'Useful answers moved from no to yes on ' + plural(inf.useful_flips.not_useful_to_useful, 'pairing') + ' and from yes to no on ' + plural(inf.useful_flips.useful_to_not_useful, 'pairing') + '. ' +
    'Two cautions travel with this: most pairings (' + record.tier_counts.unverified + ' of ' + totalShown + ') carried an unverified stamp, so for most of them the stamp line said only "verify with a domain expert"; ' +
    'and sitting 2 was taken in the same session as sitting 1 (see Disclosed limitations), so memory of the first answers may have held the second ones steady, which would make the influence look smaller than a later sitting would show.',
    ''
  );

  // Stamp mix
  push('### Stamp mix and not_called share', '');
  push('| Tier | Stamped pairings |', '|---|---|');
  for (const t of TIERS) push('| ' + t + ' | ' + record.tier_counts[t] + ' |');
  push('');
  push('Unverified share: ' + pct(record.unverified_share) + ' of stamped pairings. Reasons behind the unverified stamps:', '');
  push('| Reason | Count |', '|---|---|');
  for (const reason of Object.keys(record.reason_mix).sort()) push('| `' + reason + '` | ' + record.reason_mix[reason] + ' |');
  push('');
  push(
    'The not_called share is ' + pct(record.not_called_share) + ': for those pairings at least one side did not carry a canon Framework name under the D-48 exact-match rule (frontmatter `framework:`, then `methodology:` through the command registry, then the title), so Theo was never asked. ' +
    'That is a vocabulary gap between room prose and canon names, noted for the later Terminology Translation work, not a Theo outage. ' +
    'Where Theo was asked and found no lateral path, that is a canon-coverage finding for Theo (T-3), sent upstream with counts only.',
    ''
  );

  // Hub
  const hub = record.hub_inflation;
  push('### Hub inflation, provenance routing and diversity', '');
  push(
    'Degree source: ' + hub.proxy_source + '. ' +
    'Hub-inflation share: ' + hub.k + ' of ' + hub.n + ' strong stamps (' + pct(hub.share) + ') have a path interior that crosses a top-decile node. ' +
    'Top-decile interior nodes: ' + (hub.top_decile_nodes.length ? hub.top_decile_nodes.map((x) => '"' + x.node + '" (' + x.count + ')').join(', ') : 'none') + '. ' +
    'A high share would mean a strong stamp mostly certifies one shared textbook node rather than a transfer; the list goes to the PWS author for review and into the next phase\'s tier-rule review, not into this phase\'s rule.',
    ''
  );
  push(
    'Provenance-routed strong stamps (a lateral path that also crosses a `BrainRecord` node or a `SOURCED_FROM` edge, RESEARCH C6): ' + record.provenance_routed_strong + '. ' +
    'Diversity: ' + record.diversity.distinct_interior_nodes + ' distinct interior nodes across ' + record.diversity.strong_stamps + ' strong stamps (' + record.diversity.ratio.toFixed(3) + '). ' +
    'All counts are recorded with no target.',
    ''
  );

  // Direction fidelity
  const df = record.direction_fidelity;
  push('### Direction fidelity (false friends per tier)', '');
  push(
    'Blind, the navigator marked the named direction right on ' + fmtRate(df.overall) + '. As shown, ' + fmtRate(df.as_shown_overall) + '.',
    ''
  );
  push('| Direction shown | Direction marked right / shown | Rate | 95% Wilson interval |', '|---|---|---|---|');
  for (const ph of Object.keys(df.by_phrase)) push(rateRow('"' + ph + '"', df.by_phrase[ph]));
  push('');
  push('| Tier | Direction marked right / shown | Rate | 95% Wilson interval |', '|---|---|---|---|');
  for (const t of TIERS) push(rateRow(t, df.by_tier[t]));
  push('');
  const pl = record.planted;
  const ffShown = pl.shown.filter((x) => x.kind === 'false_friend').length;
  const mbShown = pl.shown.filter((x) => x.kind === 'meaning_bridge').length;
  push(
    'The planted cases in `room-control` (`planted-cases.json`, never opened before judging) were joined only now, after both sittings, by artifact path. ' +
    'The engines showed ' + ffShown + ' of the ' + pl.false_friends_total + ' planted false friends (same word, different meaning) and ' + mbShown + ' of the ' + pl.meaning_bridges_total + ' planted meaning bridges (same mechanism, different words).',
    ''
  );
  push('| Planted case | Pair | Direction shown | Tier | Direction right (blind) | Useful (blind) |', '|---|---|---|---|---|---|');
  for (const x of pl.shown) {
    push('| ' + x.kind.replace('_', ' ') + ' | `' + x.pair_id + '` | "' + x.direction_phrase + '" | ' + x.tier + ' | ' + yn(x.direction_ok) + ' | ' + yn(x.useful) + ' |');
  }
  push('');
  push(
    'False-friend count per tier (planted false friends whose named direction the navigator marked wrong), with the number shown beside it: ' +
    TIERS.map((t) => t + ' ' + record.false_friends_by_tier[t] + ' of ' + record.false_friends_shown_by_tier[t]).join(', ') + '. ' +
    (record.false_friends_by_tier.strong > 0
      ? 'A false-friend strong exists and goes to the PWS author.'
      : 'No false friend reached the strong tier, so none goes to the PWS author from this run.'),
    ''
  );

  // Verified vs already known
  push('### Verified versus already known', '');
  push('| Tier | Already known | Not already known | Useful and not already known |', '|---|---|---|---|');
  for (const t of TIERS) {
    push('| ' + t + ' | ' + record.already_known_by_tier[t].true + ' | ' + record.already_known_by_tier[t].false + ' | ' + record.useful_novel_by_tier[t] + ' |');
  }
  push('');
  const knownShare = (t) => {
    const b = record.already_known_by_tier[t];
    const n = b.true + b.false;
    return n > 0 ? b.true / n : null;
  };
  const ks = knownShare('strong');
  const ku = knownShare('unverified');
  let crossText = 'Overall the navigator already knew ' + fmtRate(record.already_known_overall) + '. ';
  if (ks !== null && ku !== null) {
    crossText += 'Already-known share: strong ' + pct(ks) + ', unverified ' + pct(ku) + '. ';
    if (ks > ku) {
      crossText += 'Strong pairings were already known more often than unverified ones: on these rooms, verification and novelty lean apart, which is input for the later computed novelty signal. ' +
        'With only ' + (record.already_known_by_tier.strong.true + record.already_known_by_tier.strong.false) + ' strong pairings this is a lean, not a settled difference.';
    } else {
      crossText += 'Strong pairings were not already known more often than unverified ones on these rooms; no sign here that verification and novelty pull apart.';
    }
  }
  push(crossText, '');

  // Latency
  const lat = record.theo_latency_ms;
  push('### Theo latency', '');
  push(
    'Theo `find_connections` latency, measured on the plugin side through `brain-client.cjs` on the dev machine (the first plugin-side measurement): ' +
    'p50 ' + lat.p50 + ' ms, p95 ' + lat.p95 + ' ms, over ' + lat.n + ' timed calls (min ' + lat.min + ' ms, max ' + lat.max + ' ms; nearest-rank percentiles). ' +
    'The timings cover every call in the capture file, across all Phase 355 captures including this plan\'s append (the file records ' + lat.calls + ' calls and ' + lat.responses + ' distinct responses beside ' + lat.n + ' timings). Stamping itself replays the capture offline and makes no network call.',
    ''
  );

  // Portfolio tension
  push('### Portfolio ranking tension (D-47)', '');
  push(
    'Today\'s eureka feasibility map gives its higher band to pairs labeled "same words with different meaning" (the shared-words case). ' +
    'This phase fixed the label\'s meaning but kept the ranking byte-for-byte (D-47, pinned by `tests/fixtures/355/eureka-ranking-pin.json`), because a ranking change is not an honesty-pass decision. ' +
    'The per-direction hit rate below is the evidence the next engine phase needs:',
    ''
  );
  push('| Direction shown | Useful / judged | Rate | 95% Wilson interval |', '|---|---|---|---|');
  for (const ph of Object.keys(record.per_direction)) push(rateRow('"' + ph + '"', record.per_direction[ph]));
  push('');
  const sw = record.per_direction['same words with different meaning'];
  const sm = record.per_direction['same meaning in different words'];
  if (sw && sm) {
    let t;
    if (sw.rate < sm.rate) {
      t = 'On these rooms the direction today\'s ranking rewards was judged useful less often (' + pct(sw.rate) + ' against ' + pct(sm.rate) + '). ';
    } else if (sw.rate > sm.rate) {
      t = 'On these rooms the direction today\'s ranking rewards was judged useful more often (' + pct(sw.rate) + ' against ' + pct(sm.rate) + '). ';
    } else {
      t = 'On these rooms both directions were judged useful at the same rate (' + pct(sw.rate) + '). ';
    }
    const overlap = sw.wilson[1] >= sm.wilson[0] && sm.wilson[1] >= sw.wilson[0];
    t += overlap
      ? 'The two Wilson intervals overlap, so this is a lean, not a settled difference. '
      : 'The two Wilson intervals do not overlap. ';
    t += 'Nothing in the ranking is changed here; the numbers go to the next engine phase.';
    push(t, '');
  }

  // Every shown pairing
  push('### Every shown pairing, per room', '');
  push(
    'Columns: pair id, producer, the direction phrase shown, the stamp tier (with the unverified reason), then the blind answers (useful, direction right, already known) and the as-shown useful answer. y = yes, n = no.',
    ''
  );
  for (const room of Object.keys(record.judgments)) {
    const rows = record.judgments[room];
    push('#### `' + room + '`: useful ' + fmtRate(record.per_room[room]), '');
    push('| Pair | Producer | Direction shown | Tier | Useful | Direction right | Already known | Useful as shown |', '|---|---|---|---|---|---|---|---|');
    for (const r of rows) {
      push('| `' + r.pair_id + '` | ' + r.producer + ' | ' + r.direction_phrase + ' | ' + r.tier + (r.reason ? ' (`' + r.reason + '`)' : '') + ' | ' + yn(r.useful) + ' | ' + yn(r.direction_ok) + ' | ' + yn(r.already_known) + ' | ' + yn(r.as_shown.useful) + ' |');
    }
    push('');
  }

  // Disclosed limitations
  const rejected1 = df.overall.n - df.overall.k;
  const rejected2 = df.as_shown_overall.n - df.as_shown_overall.k;
  push('### Disclosed limitations', '');
  push(
    '- **One labeler.** Every judgment is the navigator\'s; no second blind labeler was available, so there is no agreement figure or kappa for this set. The machine usefulness judge measured in 355-26 is compared against this gold in `355-JEV-MEASUREMENT.md` under its own model name and never feeds these rates.',
    '- **Sitting 2 was taken in the same session as sitting 1.** The labeling protocol asks for a later sitting; the navigator chose "now, same session" at 19:36 local on 2026-09-24. Memory of sitting 1 may have steadied sitting 2, which bears on the stamp-influence gap only, never on the blind rates.',
    '- **How sitting 2 was taken.** ' + (s2.via_cli === null ? 'The session file was not available to this record.' :
      s2.via_cli + ' pairings were labeled in the terminal CLI; the other ' + s2.via_chat_sitting + ' were labeled blind by the navigator in chat (session jsagi-7b, 2026-09-24/25). ' +
      'The orchestrator rendered the same whitelisted display fields the CLI shows (room, A excerpt, B excerpt, direction phrase, stamp lines), in the CLI\'s own seeded order (the session file\'s order_seed), and wrote the navigator\'s y / n answers into the session file keyed by pair id; those entries carry `via: "chat-sitting"` and no per-item timing (' + s2.untimed + ' untimed entries). ' +
      'In the first chat batch of 10, two B excerpts were shortened to a back-reference to an identical earlier excerpt and a few excerpts were lightly condensed; every later batch was verbatim. No hidden field (boundary tag, planted-case data) was ever shown.'),
    '- **Desktop and Cowork cannot compute a stamp (D-50).** The guarded Brain shim exposes no `find_connections`; Larry there narrates only stamps a CLI run already stored and otherwise says "not yet checked".',
    '- **`compute-hsi.py` still writes retired-convention strings (D-07).** No reader trusts them; every reader re-derives the direction from the stored similarity pair.',
    '- **Name snapshot date (D-51).** Endpoints were resolved against `data/framework-names.json`, snapshot dated ' + record.inputs.name_snapshot_date + ' (source hash `' + String(record.inputs.name_snapshot_source_sha256).slice(0, 12) + '`); ' +
      (record.inputs.name_snapshot_source_sha256 === record.inputs.theo_snapshot_sha256 ? 'the capture was taken against the same snapshot hash.' : 'the capture\'s snapshot hash differs from the name snapshot\'s source hash.'),
    '- **Fixture rooms, not ventures.** The three rooms are small, Claude-authored and synthetic; eureka contributed no pairings; the similarity floor was lowered uniformly to reach 20 per room. The latency figures come from one dev machine.',
    ''
  );
  push('### Open questions', '');
  push(
    '- **Why were so many direction labels rejected?** The navigator marked the named direction wrong on ' + rejected1 + ' of ' + df.overall.n + ' pairings blind (' + rejected2 + ' as shown). ' +
      'The question offered only the two direction phrases and no "neither category fits" answer, so a "no" cannot tell apart four causes: the classifier, the export, judging consistency, or the two-phrase definition itself. The cause is not established. ' +
      'Follow-up: review the rejected labels again with a third option ("neither fits") before any change to the direction module.',
    '- **Recall is unmeasured.** None of the three rooms is a research venture (the only science-flavored text sits in `room-control` as planted material the engine is meant to handle correctly), and this record can speak only to precision. A fourth, research-type fixture room seeded with planted known cross-field transfers would let a later pass measure recall (did the engine find the bridge we know is there). Ruling pending with the navigator.',
    ''
  );

  // Closing
  push('### What this number is', '');
  push(
    'This is the first calibration point in the engine\'s history, taken on dev-repo fixture rooms, not real ventures. No target was set and none is implied: the pooled useful rate of ' + pct(pooled.rate) + ' (n = ' + pooled.n + ') is a starting mark for later runs to be read against. ' +
    'The briefing\'s own MVP bar, "50%+ of top-10 findings judged \'interesting\'", is quoted here only as the briefing\'s reference point; it is not this phase\'s target, and this record judged every shown pairing rather than a top 10. ' +
    'A high unverified rate (' + pct(record.unverified_share) + ' here) is a canon-coverage finding for Theo (T-3), reported upstream with counts only, not a phase failure.',
    ''
  );
  push(SECTION_END);
  return L.join('\n') + '\n';
}

const VERIFICATION_PREAMBLE = [
  '# Phase 355 Verification Record',
  '',
  'Phase 355: Hidden in Plain Sight, the Jev-through-Theo cross-connection engines. Sections generated from a machine record say so at their top; verifiers add their own sections after them.',
  '',
].join('\n');

// spliceSection(existing, section): replaces the hit-rate section (heading
// through SECTION_END) in place, or appends it when absent. Everything
// before and after the section is kept byte-for-byte.
function spliceSection(existing, section) {
  if (existing === null || existing === undefined) return VERIFICATION_PREAMBLE + '\n' + section;
  const start = existing.indexOf(SECTION_HEADING + '\n');
  if (start === -1) {
    const sep = existing.endsWith('\n\n') ? '' : (existing.endsWith('\n') ? '\n' : '\n\n');
    return existing + sep + section;
  }
  const endIdx = existing.indexOf(SECTION_END, start);
  if (endIdx === -1) throw new Error('355-VERIFICATION.md carries the hit-rate heading but no end marker; refusing to guess where the section ends');
  let after = existing.slice(endIdx + SECTION_END.length);
  if (after.startsWith('\n')) after = after.slice(1);
  return existing.slice(0, start) + section + after;
}

function writeSection(verificationPath, record) {
  const existing = fs.existsSync(verificationPath) ? fs.readFileSync(verificationPath, 'utf8') : null;
  const next = spliceSection(existing, renderSection(record));
  if (next !== existing) {
    fs.mkdirSync(path.dirname(verificationPath), { recursive: true });
    fs.writeFileSync(verificationPath, next);
    return true;
  }
  return false;
}

function doRecord(opts) {
  const o = opts || {};
  const recordPath = o.recordPath || RECORD_PATH;
  const verificationPath = o.verificationPath || VERIFICATION_PATH;
  const record = buildRecord(loadRecordInputs());
  const tmp = recordPath + '.tmp';
  fs.writeFileSync(tmp, serializeRecord(record));
  fs.renameSync(tmp, recordPath);
  writeSection(verificationPath, record);
  process.stdout.write(
    'measure-355-hit-rate: wrote ' + recordPath + ' and the hit-rate section of ' + verificationPath +
    ' (pooled ' + record.pooled.k + '/' + record.pooled.n + ')\n'
  );
  return 0;
}

// checkRecord(opts): 77 when the record is absent; otherwise recompute it
// from the raw files and require byte equality with the stored record (1 on
// any difference, the section left untouched); on a match, regenerate the
// 355-VERIFICATION.md section from the record (a view, never a source).
function checkRecord(opts) {
  const o = opts || {};
  const recordPath = o.recordPath || RECORD_PATH;
  const verificationPath = o.verificationPath || VERIFICATION_PATH;
  if (!fs.existsSync(recordPath)) return 77;
  let recomputed;
  try {
    recomputed = serializeRecord(buildRecord(loadRecordInputs()));
  } catch (e) {
    process.stderr.write('measure-355-hit-rate --check: ' + e.message + '\n');
    return 1;
  }
  const stored = fs.readFileSync(recordPath, 'utf8');
  if (stored !== recomputed) {
    process.stderr.write('measure-355-hit-rate --check: ' + recordPath + ' differs from the record recomputed from the raw judgments, stamps and capture\n');
    return 1;
  }
  const rewrote = writeSection(verificationPath, JSON.parse(stored));
  if (rewrote) process.stdout.write('measure-355-hit-rate --check: regenerated the hit-rate section of ' + verificationPath + '\n');
  return 0;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const HELP_TEXT = [
  'measure-355-hit-rate.cjs -- fixture-only hit-rate measurement (D-32, D-34, SPEC AC12)',
  'Usage:',
  '  node scripts/measure-355-hit-rate.cjs export --unstamped [--top <n>] [--threshold <n>] [--room <path>]',
  '  node scripts/measure-355-hit-rate.cjs stamp    (one live Theo capture, then offline stamping)',
  '  node scripts/measure-355-hit-rate.cjs record   (writes hit-rate-record.json and the 355-VERIFICATION.md section)',
  '  node scripts/measure-355-hit-rate.cjs --check  (77 if no record; recomputes it exactly, then regenerates the section)',
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

  // --threshold: OPTIONAL, uniform override of each engine's own
  // DEFAULT_THRESHOLD (0.3). Absent -> exportUnstamped uses the engines'
  // own default (recorded as threshold_used: 'engine_default').
  let threshold;
  const thresholdIdx = args.indexOf('--threshold');
  if (thresholdIdx !== -1 && args[thresholdIdx + 1] !== undefined) {
    const parsedThreshold = Number(args[thresholdIdx + 1]);
    if (Number.isFinite(parsedThreshold)) threshold = parsedThreshold;
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
    payload = await exportUnstamped(rooms, { top, threshold });
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
  return checkRecord();
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
  if (cmd === 'stamp') {
    return doStamp();
  }
  if (cmd === 'record') {
    return doRecord();
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
  directionFromPhrase,
  sha256OfFile,
  doStamp,
  percentileNearestRank,
  hubMetrics,
  buildRecord,
  loadRecordInputs,
  serializeRecord,
  renderSection,
  spliceSection,
  checkRecord,
  doRecord,
  cliMain,
  FIXTURE_ROOT,
  DEFAULT_ROOM_NAMES,
  ITEMS_PATH,
  JUDGMENTS_PATH,
  RECORD_PATH,
  STAMPS_PATH,
  STAMPED_ITEMS_PATH,
  CAPTURE_PATH,
  JUDGMENTS_STAMPED_PATH,
  VERIFICATION_PATH,
  SECTION_HEADING,
  SECTION_END,
};
