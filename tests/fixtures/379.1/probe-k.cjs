#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 379.1 Wave 0 probe: which k keeps the CONVERGES and INFORMS edges (D-379.1-12, P-379.1-01).
 *
 * Baseline leg: the real room named by MINDRIAN_PROBE_ROOM (no room is built in; unset means absent) with the
 * generated catalog directories skipped by a hard-coded path predicate (the Wave 0 stand-in for the
 * artifact-scope module of Plan 02), about 44 artifacts. When the room is absent the 44-artifact
 * fixture of tests/helpers/fixture-room-224.cjs stands in (status room_absent_used_fixture).
 * Large-sample leg (real room only): every 7th artifact of the full enumeration up to 300 artifacts.
 *
 * Each leg: embed every text once with embedding-spine.embedTexts; full pass = scoreMeasured with
 * opts.vectors over every i < j plus classifyScore (E_full, split by edge type); cosine pass = one
 * Float32Array N x D dot-product pass keeping the top-k neighbours per row (k = 5, 10, 20, and 40 as
 * information) at or above resolveFloors().informs - 0.0001; recall_k = |E_full in C_k| / |E_full|.
 * chosen_k = the smallest k in [5, 10, 20] whose two recalls reach 0.95 on every measured leg, else
 * 20 with recall_shortfall true. Encoder unavailable: the disclosed fallback (chosen_k 20,
 * recall_shortfall true, fallback_note).
 *
 * Canon Part 8 (CPU379-09): the room is read read-only; the result file next to this script holds
 * numbers, booleans, enum strings and the probe parameters only. No artifact id, no path below the
 * room root, no room text is written or printed. No network. The probe lowers its own priority first.
 * Hyphens only.
 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const RESULT_PATH = path.join(__dirname, 'probe-k.json');

const K_LIST = [5, 10, 20, 40];
const K_CHOICES = [5, 10, 20];
const K_MAX = 40;
const RECALL_MIN = 0.95;
const FLOOR_SLACK = 0.0001;
const PROBE_K_SAMPLE_MAX = 300;
const SAMPLE_STRIDE = 7;
const BASELINE_SKIP = ['/solution-design/full-catalog-run-', '/engine-input-room/'];
const FALLBACK_NOTE = 'encoder unavailable: k = 20 is the widest probed value; re-run the probe with the encoder present before trusting DEFAULT_PRUNE_K';
const SAMPLE_NOTE_ABSENT = 'real room absent: recall at larger N is unmeasured';

function lowerPriority() {
  try {
    os.setPriority(0, process.platform === 'win32' ? os.constants.priority.PRIORITY_BELOW_NORMAL : 19);
  } catch (_e) { /* advisory */ }
}

function baseResult(status) {
  return {
    probe: 'k',
    probed_at: new Date().toISOString(),
    node_version: process.version,
    host_cores: os.availableParallelism(),
    platform: process.platform,
    status: status,
    params: { k_list: K_LIST, k_choices: K_CHOICES, recall_min: RECALL_MIN, floor_slack: FLOOR_SLACK, sample_max: PROBE_K_SAMPLE_MAX, sample_stride: SAMPLE_STRIDE },
  };
}

function scrub(msg) {
  return String(msg || '').replace(/\/[^\s'"]+/g, '<path>').slice(0, 200);
}

function writeResult(obj) {
  fs.writeFileSync(RESULT_PATH, JSON.stringify(obj, null, 2) + '\n', 'utf8');
}

function note(line) {
  process.stderr.write('probe-k: ' + line + '\n');
}

function resolveRoom() {
  const env = process.env.MINDRIAN_PROBE_ROOM;
  if (typeof env === 'string' && env.trim() !== '') return { dir: path.resolve(env.trim()), source: 'env' };
  // No built-in room: a room slug is user data and never lives in the repository (Canon Part 8, no real names).
  return { dir: '', source: 'none' };
}

function isBaselineSkipped(absPath) {
  const p = absPath.split(path.sep).join('/');
  return BASELINE_SKIP.some((frag) => p.includes(frag));
}

function pairKey(i, j, n) {
  return i < j ? i * n + j : j * n + i;
}

/* Full pass: scoreMeasured with precomputed vectors over every i < j, then classifyScore. */
async function fullPass(texts, vectors, scoreMeasured, classifier) {
  const n = texts.length;
  const converges = new Set();
  const informs = new Set();
  let pairs = 0;
  let errors = 0;
  const t0 = Date.now();
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      pairs += 1;
      let r = null;
      try {
        // eslint-disable-next-line no-await-in-loop
        r = await scoreMeasured(texts[i], texts[j], { vectors: [vectors[i], vectors[j]] });
      } catch (_e) {
        errors += 1;
        continue;
      }
      const c = classifier.classifyScore(r);
      if (!c) continue;
      if (c.edge_type === 'CONVERGES') converges.add(pairKey(i, j, n));
      else if (c.edge_type === 'INFORMS') informs.add(pairKey(i, j, n));
    }
    if ((i + 1) % 50 === 0) note('full pass row ' + (i + 1) + ' of ' + n);
  }
  return { converges: converges, informs: informs, pairs: pairs, errors: errors, ms: Date.now() - t0 };
}

/* Cosine pass: one packed Float32Array, every i < j dot once, top-K_MAX neighbours per row. */
function cosinePass(vectors, floor) {
  const n = vectors.length;
  const d = vectors[0].length;
  const packed = new Float32Array(n * d);
  for (let i = 0; i < n; i += 1) {
    let norm = 0;
    for (let c = 0; c < d; c += 1) norm += vectors[i][c] * vectors[i][c];
    norm = Math.sqrt(norm) || 1;
    for (let c = 0; c < d; c += 1) packed[i * d + c] = vectors[i][c] / norm;
  }
  const topIdx = new Int32Array(n * K_MAX);
  const topVal = new Float32Array(n * K_MAX);
  const count = new Int32Array(n);
  const minCos = floor - FLOOR_SLACK;
  function insert(row, other, val) {
    const base = row * K_MAX;
    let c = count[row];
    if (c === K_MAX && val <= topVal[base + c - 1]) return;
    if (c < K_MAX) c += 1;
    let pos = c - 1;
    while (pos > 0 && topVal[base + pos - 1] < val) {
      topVal[base + pos] = topVal[base + pos - 1];
      topIdx[base + pos] = topIdx[base + pos - 1];
      pos -= 1;
    }
    topVal[base + pos] = val;
    topIdx[base + pos] = other;
    count[row] = c;
  }
  const t0 = Date.now();
  for (let i = 0; i < n; i += 1) {
    const oi = i * d;
    for (let j = i + 1; j < n; j += 1) {
      const oj = j * d;
      let dot = 0;
      for (let c = 0; c < d; c += 1) dot += packed[oi + c] * packed[oj + c];
      if (dot < minCos) continue;
      insert(i, j, dot);
      insert(j, i, dot);
    }
  }
  const ms = Date.now() - t0;
  function candidates(k) {
    const set = new Set();
    for (let i = 0; i < n; i += 1) {
      const lim = Math.min(k, count[i]);
      for (let t = 0; t < lim; t += 1) set.add(pairKey(i, topIdx[i * K_MAX + t], n));
    }
    return set;
  }
  return { ms: ms, candidates: candidates };
}

function recallOf(edges, cands) {
  if (edges.size === 0) return 1;
  let hit = 0;
  edges.forEach((k) => { if (cands.has(k)) hit += 1; });
  return hit / edges.size;
}

async function measureLeg(texts, spine, scoreMeasured, classifier, label) {
  note(label + ': embedding ' + texts.length + ' texts once');
  const tEmbed = Date.now();
  const emb = await spine.embedTexts(texts, {});
  if (!emb || emb.success !== true) return { encoderUnavailable: true };
  const embed_ms = Date.now() - tEmbed;
  const vectors = emb.vectors;
  note(label + ': full pass over ' + ((texts.length * (texts.length - 1)) / 2) + ' pairs');
  const full = await fullPass(texts, vectors, scoreMeasured, classifier);
  note(label + ': cosine pass');
  const floors = classifier._test.resolveFloors();
  const cos = cosinePass(vectors, floors.informs);
  const per_k = {};
  K_LIST.forEach((k) => {
    const cands = cos.candidates(k);
    per_k[String(k)] = {
      candidates: cands.size,
      recall_converges: recallOf(full.converges, cands),
      recall_informs: recallOf(full.informs, cands),
    };
  });
  return {
    encoderUnavailable: false,
    artifact_count: texts.length,
    full_pairs: full.pairs,
    score_errors: full.errors,
    edges_full: { converges: full.converges.size, informs: full.informs.size },
    per_k: per_k,
    embed_ms: embed_ms,
    full_pass_ms: full.ms,
    cosine_pass_ms: cos.ms,
    informs_floor: floors.informs,
    converges_floor: floors.converges,
    model: emb.provenance && emb.provenance.model,
    dim: emb.provenance && emb.provenance.dim,
  };
}

function chooseK(legs) {
  for (const k of K_CHOICES) {
    const ok = legs.every((leg) => {
      const r = leg.per_k[String(k)];
      return r.recall_converges >= RECALL_MIN && r.recall_informs >= RECALL_MIN;
    });
    if (ok) return { chosen_k: k, recall_shortfall: false };
  }
  return { chosen_k: 20, recall_shortfall: true };
}

async function main() {
  lowerPriority();
  const classifier = require(path.join(ROOT, 'lib', 'core', 'graph-derive-classifier.cjs'));
  const { scoreMeasured } = require(path.join(ROOT, 'lib', 'core', 'rs-differential-scorer.cjs'));
  const spine = require(path.join(ROOT, 'lib', 'core', 'semantic-index', 'embedding-spine.cjs'));

  const room = resolveRoom();
  let roomDir = room.dir;
  let roomSource = room.source;
  let status = 'ok';
  let tmp = null;
  let realRoom = fs.existsSync(roomDir) && fs.statSync(roomDir).isDirectory();
  try {
    if (!realRoom) {
      tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-379-probe-k-'));
      const { buildFixtureRoom224 } = require(path.join(ROOT, 'tests', 'helpers', 'fixture-room-224.cjs'));
      const fixture = await buildFixtureRoom224(tmp, { artifactCount: 44 });
      roomDir = fixture.roomDir;
      roomSource = 'fixture-224';
      status = 'room_absent_used_fixture';
    }

    const all = classifier._test.enumerateArtifacts(roomDir);
    const baselineArts = realRoom ? all.filter((a) => !isBaselineSkipped(a.path)) : all;
    note('enumerated ' + all.length + ' artifacts, baseline ' + baselineArts.length);
    const baseline = await measureLeg(baselineArts.map((a) => a.text), spine, scoreMeasured, classifier, 'baseline');
    if (baseline.encoderUnavailable) {
      const out = baseResult('encoder_unavailable');
      const per_k = {};
      K_LIST.forEach((k) => { per_k[String(k)] = { candidates: null, recall_converges: null, recall_informs: null }; });
      Object.assign(out, {
        artifact_count: baselineArts.length,
        full_pairs: (baselineArts.length * (baselineArts.length - 1)) / 2,
        edges_full: { converges: null, informs: null },
        per_k: per_k,
        cosine_pass_ms: null,
        model: spine.encoderProvenance().model,
        dim: spine.encoderProvenance().dim,
        chosen_k: 20,
        recall_shortfall: true,
        large_sample: null,
        fallback_note: FALLBACK_NOTE,
        room_source: roomSource,
      });
      writeResult(out);
      note('encoder unavailable; wrote the disclosed fallback');
      return;
    }

    let large_sample = null;
    let sample_note;
    if (realRoom) {
      const sorted = all.slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
      const picked = [];
      for (let i = 0; i < sorted.length && picked.length < PROBE_K_SAMPLE_MAX; i += SAMPLE_STRIDE) picked.push(sorted[i].text);
      const sample = await measureLeg(picked, spine, scoreMeasured, classifier, 'large sample');
      if (sample.encoderUnavailable) {
        sample_note = 'encoder failed on the large sample leg';
      } else {
        large_sample = {
          artifact_count: sample.artifact_count,
          stride: SAMPLE_STRIDE,
          full_pairs: sample.full_pairs,
          score_errors: sample.score_errors,
          edges_full: sample.edges_full,
          per_k: sample.per_k,
          embed_ms: sample.embed_ms,
          cosine_pass_ms: sample.cosine_pass_ms,
          full_pass_ms: sample.full_pass_ms,
        };
      }
    } else {
      sample_note = SAMPLE_NOTE_ABSENT;
    }

    const legs = [baseline];
    if (large_sample) legs.push(large_sample);
    const choice = chooseK(legs);

    const out = baseResult(status);
    Object.assign(out, {
      artifact_count: baseline.artifact_count,
      enumerated_total: all.length,
      full_pairs: baseline.full_pairs,
      score_errors: baseline.score_errors,
      edges_full: baseline.edges_full,
      per_k: baseline.per_k,
      embed_ms: baseline.embed_ms,
      full_pass_ms: baseline.full_pass_ms,
      cosine_pass_ms: baseline.cosine_pass_ms,
      informs_floor: baseline.informs_floor,
      converges_floor: baseline.converges_floor,
      model: baseline.model,
      dim: baseline.dim,
      chosen_k: choice.chosen_k,
      recall_shortfall: choice.recall_shortfall,
      large_sample: large_sample,
      room_source: roomSource,
    });
    if (sample_note) out.sample_note = sample_note;
    writeResult(out);
    note('chosen_k ' + choice.chosen_k + ' recall_shortfall ' + choice.recall_shortfall);
  } finally {
    if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (require.main === module) {
  main().then(() => process.exit(0)).catch((e) => {
    const out = baseResult('error');
    out.error = scrub(e && e.message);
    out.chosen_k = 20;
    out.recall_shortfall = true;
    out.large_sample = null;
    try { writeResult(out); } catch (_e) { /* nothing more to do */ }
    process.stderr.write('probe-k: error ' + out.error + '\n');
    process.exit(1);
  });
}

module.exports = { cosinePass, recallOf, chooseK, K_LIST, K_CHOICES, RECALL_MIN };
