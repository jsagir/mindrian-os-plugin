#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 245-04 Task 2 -- build-time derivation of the VERB_REACH_AFFINITY table
 * in lib/core/verb-reach-affinity.cjs (D-30).
 *
 * WHAT THIS IS
 *
 * A one-time AUTHORING tool, not a build gate. It embeds the 10 frozen
 * CANONICAL_VERBS and the 6 reaches' REACH_EXEMPLARS with the already-shipped
 * fully local encoder (lib/core/eureka/embedding-spine.cjs), scores each verb
 * against each reach by MAX cosine over that reach's exemplar set, and rewrites
 * the generated table block in lib/core/verb-reach-affinity.cjs. At runtime
 * nothing calls this script: the committed constant is read as a plain frozen
 * lookup at zero cost.
 *
 * WHY MAX-COSINE NEAREST-NEIGHBOR, AND WHY THE WHAT/WHY CLASSIFIER IS NOT CALLED
 *
 * The shape is deliberately the one lib/core/eureka/embedding-classifier.cjs
 * uses (embedTexts plus the exported cosineSimilarity, MAX similarity per side,
 * a top1-minus-top2 margin, and an explicit not-confident branch) at the ~40
 * term scale that module's own header names as its design target. That module's
 * exported entry point is NOT reused directly, because it is hardwired to a
 * TWO-way WHAT/WHY comparison and structurally cannot express a SIX-way problem.
 * Reusing the PATTERN and the spine primitives is Canon Part 7 reuse; bending a
 * two-way classifier into a six-way one would not be.
 *
 * DECISION RULE, per verb: GROUND TRUTH FIRST, COSINE ONLY WHERE IT CAN HELP
 *
 * `reachIdToSkillFamily` (lib/core/navigation-engine.cjs) is a canon-frozen
 * FORWARD mapping. `hats -> 'Synthesize'` is a FACT, not a hypothesis. So the
 * derivation is seeded by inverting that forward map, and cosine is used only
 * for the two questions the forward map genuinely leaves open:
 *
 *   (a) A verb with EXACTLY ONE forward preimage -> { that_reach: 1 }.
 *       Ground truth wins outright. Cosine is still computed and reported by
 *       --print as CORROBORATION, but it does not decide.
 *   (b) A verb with SEVERAL forward preimages ('Run Methodology', the only one)
 *       -> cosine arbitrates among ONLY those preimages:
 *            top1 - top2 >= AFFINITY_MARGIN -> { winner: 1 }
 *            top1 - top2 <  AFFINITY_MARGIN -> even split across the tied ones.
 *       This is the principled resolution of the one genuine ambiguity, which
 *       is the single most valuable thing the encoder contributes.
 *   (c) A verb with NO forward preimage -> cosine decides against ALL six:
 *            top1 <  AFFINITY_FLOOR -> null (the documented no-op)
 *            top1 >= AFFINITY_FLOOR -> the winner, or an even split across
 *                                      everything within AFFINITY_MARGIN of it.
 *
 * The forward map is READ BY CALLING reachIdToSkillFamily at derivation time,
 * never hand-copied here. That is the whole anti-brittleness point (D-15): if
 * the engine's mapping ever changes, a re-run picks it up and `--check` reddens,
 * instead of a stale hand-maintained duplicate drifting silently.
 *
 * WHY GROUND TRUTH HAD TO COME FIRST (245-04 Task 2 deviation, Rule 1)
 *
 * The plan specified pure cosine with a single AFFINITY_MARGIN serving as both
 * the relative margin AND the absolute floor. The first live run proved that
 * rule unusable on two counts. (1) This encoder returns roughly 0.40 to 0.55
 * between two ARBITRARY UNRELATED English phrases, so a 0.05 absolute floor is
 * unreachable, the null branch is dead code, and every verb is force-fitted onto
 * some reach: the run emitted a 5-way 0.2 split for 'Synthesize' and a 3-way
 * split for 'Bank Opportunity'. (2) Pure cosine also OVERWROTE canon: it ranked
 * `hats` only THIRD for 'Synthesize' (0.6023 against context_block's 0.6099, an
 * 0.008 spread that is pure noise) and would have discarded a frozen forward-map
 * fact on the strength of that noise. See lib/core/verb-reach-affinity.cjs for
 * the AFFINITY_FLOOR calibration note.
 *
 * What the encoder DOES earn, on the corrected rule: it independently confirms
 * three of the four unambiguous forward-map verbs by wide margins (Spawn
 * Sub-Agent 0.7955 at margin 0.2664, Navigate Graph 0.8626 at 0.1547, Devil's
 * Advocate 0.8365 at 0.2464), it arbitrates 'Run Methodology' as a genuine tie
 * (context_block 0.7819 against brain_consult 0.7615, margin 0.0204, below
 * AFFINITY_MARGIN), and it confirms that all five no-preimage verbs sit below
 * the floor and therefore carry no reach affinity to record.
 *
 * INPUTS ARE EXCLUSIVELY IN-REPO CONSTANTS. There is no roomDir argument, no
 * room read, no turn text, and no user byte anywhere in this script. The whole
 * input surface is CANONICAL_VERBS (lib/core/navigation-engine-shared.cjs), the
 * reachIdToSkillFamily forward map (lib/core/navigation-engine.cjs), and
 * REACH_EXEMPLARS + AFFINITY_MARGIN + AFFINITY_FLOOR
 * (lib/core/verb-reach-affinity.cjs).
 *
 * CANON PART 8 (Graph Boundary): the spine's boundary holds verbatim. The ONLY
 * network touch anywhere in this script is the spine's one-time generic
 * model-weight download by model id. No user text, no room content, and no verb
 * or reach data leaves the machine. This script opens no wire of its own and
 * loads no remote-graph transport module.
 *
 * ENCODER-UNAVAILABLE PATH (the whole point of committing the constant, A7)
 *
 * If the encoder cannot load, the weights are not cached and cannot be fetched,
 * or any embedding step fails, this script prints a clear diagnostic naming the
 * failure and exits NON-ZERO WITHOUT touching lib/core/verb-reach-affinity.cjs.
 * The committed table stands. That is why this is an authoring dependency and
 * NOT a build-gate dependency: do NOT add this script to scripts/release.sh, to
 * scripts/verify-release, or to scripts/doctor.cjs --acceptance. A network touch
 * (even a Part-8-clean generic model-weight fetch) must never gate a release.
 *
 * USAGE
 *
 *   node scripts/derive-verb-reach-affinity.cjs            # derive and WRITE
 *   node scripts/derive-verb-reach-affinity.cjs --check    # derive and DIFF (non-zero on drift)
 *   node scripts/derive-verb-reach-affinity.cjs --print    # full cosine matrix + margins
 *
 * Test hook: MINDRIAN_AFFINITY_FORCE_ENCODER_UNAVAILABLE=1 forces the spine's
 * own _forceUnavailable path, so the degrade branch is provable offline without
 * deleting anybody's model cache.
 *
 * process.argv switch-case router, no Commander and no yargs (repo convention).
 * No em-dashes anywhere in this file.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const TABLE_FILE = path.join(ROOT, 'lib', 'core', 'verb-reach-affinity.cjs');

const BEGIN_SENTINEL = '// <<< GENERATED:VERB_REACH_AFFINITY >>>';
const END_SENTINEL = '// <<< END GENERATED:VERB_REACH_AFFINITY >>>';

const { CANONICAL_VERBS } = require('../lib/core/navigation-engine-shared.cjs');
const { reachIdToSkillFamily } = require('../lib/core/navigation-engine.cjs');
const affinityModule = require('../lib/core/verb-reach-affinity.cjs');
const spine = require('../lib/core/eureka/embedding-spine.cjs');

const REACH_EXEMPLARS = affinityModule.REACH_EXEMPLARS;
const REACH_IDS = affinityModule.REACH_IDS;
const AFFINITY_MARGIN = affinityModule.AFFINITY_MARGIN;
const AFFINITY_FLOOR = affinityModule.AFFINITY_FLOOR;

/**
 * forwardPreimages() -> { [verb]: reach_id[] }
 *
 * The inversion of the canon-frozen forward map, obtained by CALLING
 * reachIdToSkillFamily over the six frozen reach ids. Never hand-copied: engine
 * drift is picked up on the next run and reddens --check (D-15).
 *
 * Every canonical verb gets a key, so a verb with no preimage is an explicit
 * empty array rather than an absent key the decision rule could trip over.
 */
function forwardPreimages() {
  const inv = {};
  for (const verb of CANONICAL_VERBS) inv[verb] = [];
  for (const reachId of REACH_IDS) {
    const verb = reachIdToSkillFamily(reachId);
    if (typeof verb === 'string' && Object.prototype.hasOwnProperty.call(inv, verb)) {
      inv[verb].push(reachId);
    }
  }
  return inv;
}

// ---------------------------------------------------------------------------
// Embedding + scoring
// ---------------------------------------------------------------------------

function encoderOpts() {
  const forced = process.env.MINDRIAN_AFFINITY_FORCE_ENCODER_UNAVAILABLE;
  if (typeof forced === 'string' && forced.trim() !== '' && forced.trim() !== '0') {
    return { _forceUnavailable: true };
  }
  return {};
}

/**
 * scoreMatrix() -> { ok: true, matrix, provenance } | { ok: false, error, detail }
 *
 * matrix[verb][reach_id] = MAX cosine of the verb against that reach's exemplars.
 * Never throws: every failure comes back as { ok: false } so the caller can exit
 * non-zero WITHOUT having touched the committed table.
 */
async function scoreMatrix() {
  const opts = encoderOpts();

  // One flat embed call for verbs + every exemplar, so the encoder loads once.
  const verbTexts = CANONICAL_VERBS.slice();
  const exemplarTexts = [];
  const exemplarOwner = [];
  for (const reachId of REACH_IDS) {
    const list = REACH_EXEMPLARS[reachId] || [];
    for (const phrase of list) {
      exemplarTexts.push(phrase);
      exemplarOwner.push(reachId);
    }
  }

  const all = verbTexts.concat(exemplarTexts);

  let emb;
  try {
    emb = await spine.embedTexts(all, opts);
  } catch (err) {
    return { ok: false, error: 'embed_threw', detail: String(err && err.message) };
  }
  if (!emb || emb.success !== true || !Array.isArray(emb.vectors) || emb.vectors.length !== all.length) {
    return {
      ok: false,
      error: (emb && emb.error) || 'embed_failed',
      detail: (emb && emb.detail) || 'vector count mismatch',
    };
  }

  const verbVectors = emb.vectors.slice(0, verbTexts.length);
  const exemplarVectors = emb.vectors.slice(verbTexts.length);

  const matrix = {};
  for (let i = 0; i < verbTexts.length; i += 1) {
    const row = {};
    for (const reachId of REACH_IDS) row[reachId] = -Infinity;
    for (let j = 0; j < exemplarVectors.length; j += 1) {
      const reachId = exemplarOwner[j];
      let sim;
      try {
        sim = spine.cosineSimilarity(verbVectors[i], exemplarVectors[j]);
      } catch (err) {
        return { ok: false, error: 'cosine_failed', detail: String(err && err.message) };
      }
      if (typeof sim !== 'number' || !Number.isFinite(sim)) {
        return { ok: false, error: 'cosine_failed', detail: 'non-finite similarity' };
      }
      if (sim > row[reachId]) row[reachId] = sim;
    }
    matrix[verbTexts[i]] = row;
  }

  return { ok: true, matrix: matrix, provenance: emb.provenance || spine.encoderProvenance() };
}

/**
 * decideRow(row, preimages) -> { entry, basis, top1, top2, margin, tied }
 *
 * `preimages` is this verb's forward-map preimage list (possibly empty).
 * `basis` names WHICH branch decided, so --print shows the provenance of every
 * row rather than a bare number: 'forward_map' | 'cosine_arbitrated' |
 * 'cosine_only' | 'below_floor'.
 *
 * entry is null or a { reach_id: weight } map whose weights are rounded to 4
 * decimal places and sum to exactly 1 (the rounding residual lands on the LAST
 * key, so a 3-way split reads 0.3333 / 0.3333 / 0.3334 rather than summing to
 * 0.9999). 4 decimal places makes the committed artifact byte-stable across
 * machines whose float tails differ.
 */
function decideRow(row, preimages) {
  // Rank a given candidate set by cosine, descending, ties broken by id so the
  // output is deterministic across runs and machines.
  function rank(ids) {
    return ids
      .map((id) => ({ id: id, sim: row[id] }))
      .sort((a, b) => (b.sim - a.sim) || (a.id < b.id ? -1 : 1));
  }

  // (a) Exactly one forward preimage: ground truth wins outright.
  if (preimages.length === 1) {
    const r = rank(REACH_IDS);
    return {
      entry: { [preimages[0]]: 1 },
      basis: 'forward_map',
      top1: r[0].sim,
      top2: r[1].sim,
      margin: r[0].sim - r[1].sim,
      tied: [preimages[0]],
    };
  }

  // (b) Several forward preimages: cosine arbitrates among THOSE ONLY.
  if (preimages.length > 1) {
    const r = rank(preimages);
    const top1 = r[0].sim;
    const top2 = r[1].sim;
    const margin = top1 - top2;
    if (margin >= AFFINITY_MARGIN) {
      return { entry: { [r[0].id]: 1 }, basis: 'cosine_arbitrated', top1: top1, top2: top2, margin: margin, tied: [r[0].id] };
    }
    const tied = r.filter((x) => (top1 - x.sim) < AFFINITY_MARGIN).map((x) => x.id);
    return { entry: evenSplit(tied), basis: 'cosine_arbitrated', top1: top1, top2: top2, margin: margin, tied: tied };
  }

  // (c) No forward preimage: cosine decides against all six, against the floor.
  const r = rank(REACH_IDS);
  const top1 = r[0].sim;
  const top2 = r[1].sim;
  const margin = top1 - top2;

  if (!Number.isFinite(top1) || top1 < AFFINITY_FLOOR) {
    return { entry: null, basis: 'below_floor', top1: top1, top2: top2, margin: margin, tied: [] };
  }

  const tied = r.filter((x) => (top1 - x.sim) < AFFINITY_MARGIN).map((x) => x.id);
  if (margin >= AFFINITY_MARGIN || tied.length <= 1) {
    return { entry: { [r[0].id]: 1 }, basis: 'cosine_only', top1: top1, top2: top2, margin: margin, tied: [r[0].id] };
  }
  return { entry: evenSplit(tied), basis: 'cosine_only', top1: top1, top2: top2, margin: margin, tied: tied };
}

function evenSplit(ids) {
  const share = round4(1 / ids.length);
  const entry = {};
  let used = 0;
  for (let i = 0; i < ids.length; i += 1) {
    if (i === ids.length - 1) {
      entry[ids[i]] = round4(1 - used);
    } else {
      entry[ids[i]] = share;
      used = round4(used + share);
    }
  }
  return entry;
}

function round4(n) {
  return Number(Number(n).toFixed(4));
}

// ---------------------------------------------------------------------------
// Rendering + file surgery
// ---------------------------------------------------------------------------

// Single quotes unless the key itself contains one (then double), matching the
// hand-authored block's style so a no-change derivation is a no-change diff.
function quoteKey(k) {
  return k.indexOf("'") === -1 ? "'" + k + "'" : '"' + k + '"';
}

function renderBlock(table) {
  const lines = [];
  lines.push(BEGIN_SENTINEL);
  lines.push('const VERB_REACH_AFFINITY = Object.freeze({');
  for (const verb of CANONICAL_VERBS) {
    const entry = table[verb];
    if (entry === null || entry === undefined) {
      lines.push('  ' + quoteKey(verb) + ': null,');
      continue;
    }
    const pairs = Object.keys(entry).map((r) => r + ': ' + String(entry[r]));
    lines.push('  ' + quoteKey(verb) + ': Object.freeze({ ' + pairs.join(', ') + ' }),');
  }
  lines.push('});');
  lines.push(END_SENTINEL);
  return lines.join('\n');
}

function readCommittedBlock() {
  const src = fs.readFileSync(TABLE_FILE, 'utf8');
  const b = src.indexOf(BEGIN_SENTINEL);
  const e = src.indexOf(END_SENTINEL);
  if (b === -1 || e === -1 || e < b) {
    return { ok: false, error: 'sentinels_missing' };
  }
  return {
    ok: true,
    src: src,
    block: src.slice(b, e + END_SENTINEL.length),
    before: src.slice(0, b),
    after: src.slice(e + END_SENTINEL.length),
  };
}

function writeBlock(rendered) {
  const cur = readCommittedBlock();
  if (!cur.ok) return cur;
  fs.writeFileSync(TABLE_FILE, cur.before + rendered + cur.after, 'utf8');
  return { ok: true, changed: cur.block !== rendered };
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

function printMatrix(matrix, decisions, provenance, preimages) {
  console.log('encoder: ' + JSON.stringify(provenance));
  console.log('AFFINITY_MARGIN: ' + AFFINITY_MARGIN + '  (relative top1-minus-top2 spread)');
  console.log('AFFINITY_FLOOR : ' + AFFINITY_FLOOR + '  (absolute has-any-affinity-at-all floor)');
  console.log('');
  const header = ['verb'].concat(REACH_IDS).concat(['margin', 'preimage', 'basis', 'outcome']);
  console.log('| ' + header.join(' | ') + ' |');
  console.log('|' + header.map(() => '---').join('|') + '|');
  for (const verb of CANONICAL_VERBS) {
    const row = matrix[verb];
    const d = decisions[verb];
    const cells = REACH_IDS.map((id) => row[id].toFixed(4));
    const outcome = d.entry === null
      ? 'null'
      : Object.keys(d.entry).map((r) => r + '=' + d.entry[r]).join(' ');
    const pre = preimages[verb].length ? preimages[verb].join('+') : '(none)';
    console.log('| ' + [verb].concat(cells).concat([d.margin.toFixed(4), pre, d.basis, outcome]).join(' | ') + ' |');
  }
}

function failEncoder(res) {
  console.error('');
  console.error('DERIVATION ABORTED: the local encoder is unavailable.');
  console.error('  error : ' + res.error);
  console.error('  detail: ' + (res.detail === undefined ? '(none)' : res.detail));
  console.error('');
  console.error('lib/core/verb-reach-affinity.cjs was NOT modified. The committed');
  console.error('hand-authored table stands and remains fully sufficient for the');
  console.error('phase acceptance criteria. This script gates no build and no');
  console.error('release by design.');
  process.exitCode = 1;
}

async function derive() {
  const res = await scoreMatrix();
  if (!res.ok) return res;
  const preimages = forwardPreimages();
  const decisions = {};
  const table = {};
  for (const verb of CANONICAL_VERBS) {
    const d = decideRow(res.matrix[verb], preimages[verb]);
    decisions[verb] = d;
    table[verb] = d.entry;
  }
  return {
    ok: true,
    matrix: res.matrix,
    provenance: res.provenance,
    decisions: decisions,
    table: table,
    preimages: preimages,
  };
}

// ---------------------------------------------------------------------------
// argv router
// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  const mode = argv.includes('--check') ? 'check'
    : argv.includes('--print') ? 'print'
      : argv.includes('--help') || argv.includes('-h') ? 'help'
        : 'write';

  switch (mode) {
    case 'help': {
      console.log('usage: node scripts/derive-verb-reach-affinity.cjs [--check | --print]');
      console.log('  (no flag)  derive with the local encoder and WRITE the table block');
      console.log('  --check    derive and byte-compare against the committed block');
      console.log('  --print    print the full cosine matrix and per-verb margins');
      return;
    }

    case 'print': {
      const d = await derive();
      if (!d.ok) { failEncoder(d); return; }
      printMatrix(d.matrix, d.decisions, d.provenance, d.preimages);
      return;
    }

    case 'check': {
      const d = await derive();
      if (!d.ok) { failEncoder(d); return; }
      const rendered = renderBlock(d.table);
      const cur = readCommittedBlock();
      if (!cur.ok) {
        console.error('CHECK FAILED: ' + cur.error + ' in ' + TABLE_FILE);
        process.exitCode = 1;
        return;
      }
      if (cur.block === rendered) {
        console.log('affinity table: OK (derived table byte-matches the committed table)');
        return;
      }
      console.error('affinity table: STALE (derived table differs from the committed table)');
      console.error('');
      const committed = affinityModule.VERB_REACH_AFFINITY;
      for (const verb of CANONICAL_VERBS) {
        const a = JSON.stringify(committed[verb]);
        const b = JSON.stringify(d.table[verb]);
        if (a !== b) console.error('  ' + verb + ': committed ' + a + '  ->  derived ' + b);
      }
      console.error('');
      console.error('Re-run without --check to adopt the derived table.');
      process.exitCode = 1;
      return;
    }

    case 'write':
    default: {
      const d = await derive();
      if (!d.ok) { failEncoder(d); return; }
      const rendered = renderBlock(d.table);
      const w = writeBlock(rendered);
      if (!w.ok) {
        console.error('WRITE FAILED: ' + w.error + ' in ' + TABLE_FILE);
        process.exitCode = 1;
        return;
      }
      printMatrix(d.matrix, d.decisions, d.provenance, d.preimages);
      console.log('');
      console.log(w.changed
        ? 'wrote derived table into lib/core/verb-reach-affinity.cjs'
        : 'derived table matches the committed table; file unchanged');
    }
  }
}

main().catch((err) => {
  // Never leave a half-written file behind an unhandled rejection: every write
  // path above is a single atomic writeFileSync AFTER a fully successful derive.
  console.error('DERIVATION ABORTED (unexpected): ' + String(err && err.message));
  console.error('lib/core/verb-reach-affinity.cjs was NOT modified.');
  process.exitCode = 1;
});
