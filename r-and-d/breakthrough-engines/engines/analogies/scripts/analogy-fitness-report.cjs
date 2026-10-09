#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 214-03 -- the analogy-fitness-report runner (eureka-room-report style).
 *
 * ONE governed CLI door between the /mos:find-analogies prompt layer and the two
 * Phase 214 engines: the MEASURED two-leg fitness engine (214-01
 * lib/core/semantic-index/analogy-fitness.cjs) and the Part-8-safe egress composer
 * (214-02 lib/core/semantic-index/online-pattern-query.cjs). Larry writes JSON, this
 * script runs deterministic code and prints a JSON report plus a markdown matrix
 * the command renders. No decorative decimal ever leaves here: every number is
 * a MEASURED fitness carrying provenance, and when the encoder is unavailable
 * the runner degrades to a qualitative-only envelope (the command falls back to
 * honest band words) - it NEVER fabricates a score.
 *
 * --------------------------------------------------------------------------
 * CANON PART 8 (Graph Boundary): ZERO network calls. The score path embeds
 * LOCALLY through the shipped spine (its only possible network touch is the
 * one-time model-weight download BY ID, no room bytes egress). The
 * compose-queries path COMPOSES and AUDITS outbound strings but NEVER transmits
 * (the actual Tavily/WebSearch fetch lives at the command layer behind navigator
 * confirmation). This script opens no socket and names no model literal.
 * CANON PART 9 (Memory Locality): ZERO database writes. It reads Larry-authored
 * JSON and writes ONLY the optional --out report FILE. Scored analogies become
 * graph-refine-loop proposals at the command layer, never a direct edge write.
 * CANON DECISION #8 (graceful degradation): encoder-unavailable degrades to a
 * qualitative-only envelope with exit 0 - a degrade is a SUCCESSFUL honest
 * answer, not a failure.
 * --------------------------------------------------------------------------
 *
 * Usage:
 *   node scripts/analogy-fitness-report.cjs score <input.json> [--stub-encoder] [--out <file>]
 *   node scripts/analogy-fitness-report.cjs compose-queries <pattern.json>
 *
 *   score          input = {source:{text,sapphire}, candidates:[{id,domain,text,
 *                  sapphire,source_tier,source_date?}]}. Prints
 *                  {provenance, rows:[{rank,id,domain,text,band,fused,
 *                  restatementFlag,error?}]} + a markdown matrix. On an
 *                  unavailable encoder prints {degrade:'qualitative-only',reason}
 *                  and exits 0.
 *   --stub-encoder inject the deterministic offline dev/CI stub (TEST-ONLY seam).
 *   --out <file>   also write the JSON report to <file>. A relative path resolves against
 *                  the plugin root (legacy behaviour), an absolute path is used as given.
 *   --rank-mode <percentile|fixed>  (2026) percentile (default) derives per-layer
 *                  correspondence thresholds and the restatement trip from the candidate
 *                  corpus (needs >= 5 candidates, else it falls back to fixed and says so);
 *                  fixed reproduces the 2025 absolute thresholds (0.5 layer, 0.8 restatement).
 *   --legacy-rank  keep the 2025 order (a flagged restatement may lead when every candidate
 *                  is thin-banded). Default lifts the best non-restatement to Rank 1.
 *   --max-candidates <n>  bound the run (default 200); extra candidates are reported as
 *                  truncated, never silently dropped.
 *   compose-queries  input = {functionalKeywords,trizPrinciples,abstractFunction}.
 *                  Prints the composePatternQueries envelope verbatim, exits 0.
 *
 * Pure CJS, node built-ins + the shipped Phase 214 lib modules. No Commander.
 */

const path = require('node:path');
const fs = require('node:fs');

const REPO_ROOT = path.resolve(__dirname, '..');

const fitness = require(path.join(REPO_ROOT, 'lib/core/semantic-index/analogy-fitness.cjs'));
const online = require(path.join(REPO_ROOT, 'lib/core/semantic-index/online-pattern-query.cjs'));

// ---------------------------------------------------------------------------
// --stub-encoder: the deterministic offline dev/CI seam. It mirrors the
// angleVec lookup the 214-01 contract tests use - identical field strings map
// to the SAME unit vector (cosine 1.0, so a shared SAPPhIRE layer corresponds),
// different strings land at a fixed angle. TEST/DEV ONLY: it is NOT an encoder
// and carries NO embedding-quality signal (its provenance reads 'stub'). The
// shipped command runs the real local spine at runtime, never this stub.
// ---------------------------------------------------------------------------

function stubEncode(texts) {
  return texts.map(function encode(t) {
    const str = String(t == null ? '' : t);
    let h = 0;
    for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) % 997;
    const a = (h / 997) * (Math.PI / 2);
    return [Math.cos(a), Math.sin(a)];
  });
}

// ---------------------------------------------------------------------------
// argv -- a switch/case router (the gsd-tools idiom), no dependency.
// ---------------------------------------------------------------------------

function parseArgv(argv) {
  const opts = { mode: argv[0], input: null, stub: false, out: null, rankMode: 'percentile', legacyRank: false, maxCandidates: 200 };
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--stub-encoder': opts.stub = true; break;
      case '--out': opts.out = argv[i += 1]; break;
      case '--rank-mode': opts.rankMode = argv[i += 1] === 'fixed' ? 'fixed' : 'percentile'; break;
      case '--legacy-rank': opts.legacyRank = true; break;
      case '--max-candidates': {
        const n = Number(argv[i += 1]);
        if (Number.isFinite(n) && n >= 1) opts.maxCandidates = Math.floor(n);
        break;
      }
      default:
        if (opts.input === null && typeof a === 'string' && a.indexOf('--') !== 0) opts.input = a;
        break;
    }
  }
  return opts;
}

function readJson(file) {
  const raw = fs.readFileSync(file, 'utf8');
  return JSON.parse(raw);
}

function badInput(reason) {
  process.stdout.write(JSON.stringify({ ok: false, reason: reason || 'bad_input' }) + '\n');
  return 1;
}

// ---------------------------------------------------------------------------
// Markdown matrix rendering (the human-readable half of the score report).
// ---------------------------------------------------------------------------

function renderMatrix(report) {
  const L = [];
  const hasPct = report.rows.some(function (r) { return typeof r.fusedPercentile === 'number'; });
  L.push('| Rank | ID | Domain | Band | Fused |' + (hasPct ? ' Pctile |' : '') + ' Restatement |');
  L.push('| ---- | -- | ------ | ---- | ----- |' + (hasPct ? ' ------- |' : '') + ' ----------- |');
  for (let i = 0; i < report.rows.length; i += 1) {
    const r = report.rows[i];
    const fused = (typeof r.fused === 'number') ? r.fused.toFixed(3) : 'n/a';
    const band = r.band || (r.error ? 'error' : 'none');
    const restate = r.restatementFlag ? '[restatement]' : '';
    const pct = (typeof r.fusedPercentile === 'number') ? ' ' + Math.round(r.fusedPercentile * 100) + ' |' : (hasPct ? ' n/a |' : '');
    L.push('| ' + r.rank + ' | ' + r.id + ' | ' + (r.domain || '') + ' | '
      + band + ' | ' + fused + ' |' + pct + ' ' + restate + ' |');
  }
  if (report.provenance) {
    L.push('');
    L.push('fitness measured by ' + report.provenance.model + ' (' + report.provenance.dim + '-dim)');
  }
  if (report.scoring) {
    L.push('threshold mode: ' + report.scoring.mode + ' (n=' + report.n_scored + ')'
      + (report.scoring.note ? '; ' + report.scoring.note : ''));
  }
  return L.join('\n');
}

// ---------------------------------------------------------------------------
// Mode: score
// ---------------------------------------------------------------------------

async function runScore(opts) {
  let parsed;
  try {
    parsed = readJson(opts.input);
  } catch (_e) {
    return badInput('bad_input');
  }
  if (!parsed || typeof parsed !== 'object'
      || !parsed.source || typeof parsed.source !== 'object' || !Array.isArray(parsed.candidates)) {
    return badInput('bad_input');
  }
  if (opts.out !== null && (typeof opts.out !== 'string' || opts.out === '' || opts.out.indexOf('--') === 0)) {
    return badInput('out_requires_path');
  }

  const encodeOpts = opts.stub ? { encodeFn: stubEncode } : {};
  encodeOpts.thresholdMode = opts.rankMode === 'fixed' ? 'fixed' : 'percentile';

  // Bound the run (2026) and report what was cut; never drop silently.
  const allCands = parsed.candidates;
  const cap = Number.isFinite(opts.maxCandidates) ? opts.maxCandidates : 200;
  const used = allCands.slice(0, cap);
  const truncated = allCands.length - used.length;
  const candObjs = used.map(function (c) { return (c && typeof c === 'object') ? c : {}; });

  // Per-candidate figure-guard now lives inside scoreCandidates (one bad candidate becomes a
  // per-row error, it never kills the run). Encoder-unavailable is a GLOBAL degrade there.
  const batch = await fitness.scoreCandidates(parsed.source, candObjs, encodeOpts);
  if (!batch.success) {
    process.stdout.write(JSON.stringify({
      degrade: 'qualitative-only',
      reason: batch.reason || 'encoder_unavailable',
    }) + '\n');
    return 0;
  }
  const scored = batch.results;
  scored.forEach(function (r, i) {
    r._id = candObjs[i].id;
    r._domain = candObjs[i].domain;
    r._text = candObjs[i].text;
    r._trail = {
      source_id: candObjs[i].source_id != null ? candObjs[i].source_id : candObjs[i].id,
      source_url: candObjs[i].source_url || candObjs[i].url || null,
      source_tier: candObjs[i].source_tier || null,
      retrieved_at: candObjs[i].retrieved_at || candObjs[i].source_date || null,
      evidence: candObjs[i].evidence || null,
      novelty_check: candObjs[i].novelty_check || 'not_checked',
    };
  });

  const ranked = fitness.rankCandidates(scored, { legacy: opts.legacyRank === true });

  // Provenance derived from the FIRST successful result (they all share it).
  let provenance = null;
  for (let i = 0; i < ranked.length; i += 1) {
    if (ranked[i] && ranked[i].success && ranked[i].provenance) {
      provenance = ranked[i].provenance;
      break;
    }
  }

  const rows = ranked.map(function toRow(r, idx) {
    const row = {
      rank: idx + 1,
      id: r._id,
      domain: r._domain,
      text: r._text,
      band: (r.structural && r.structural.band) || null,
      fused: (typeof r.fused === 'number') ? r.fused : null,
      restatementFlag: r.restatementFlag === true,
    };
    if (r.percentile) row.fusedPercentile = r.percentile.fused;
    if (r.z) row.fusedZ = r.z.fused;
    if (r.legacy) row.legacyBand = r.legacy.band;
    if (r._trail) row.source_trail = r._trail;
    if (r._rowError) row.error = r._rowError;
    return row;
  });

  const report = {
    provenance: provenance,
    rows: rows,
    // 2026 additive provenance: what was computed, with which parameters, and when.
    scoring: batch.scoring,
    n_scored: batch.n,
    candidates_truncated: truncated,
    generated_at: batch.scoring.computed_at,
    stub_encoder: opts.stub === true,
  };

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.stdout.write('\n' + renderMatrix(report) + '\n');

  if (opts.out) {
    const outPath = path.isAbsolute(opts.out) ? opts.out : path.join(REPO_ROOT, opts.out);
    try {
      fs.mkdirSync(path.dirname(outPath), { recursive: true });
      fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
    } catch (err) {
      // 2026: report the write failure instead of crashing after the report already printed.
      process.stderr.write('analogy-fitness-report: could not write --out file: ' + (err && err.message) + '\n');
      return 1;
    }
  }

  return 0;
}

// ---------------------------------------------------------------------------
// Mode: compose-queries -- print the composer envelope verbatim, exit 0. A
// degrade envelope is a SUCCESSFUL honest answer (local-only), not an error.
// ---------------------------------------------------------------------------

function runComposeQueries(opts) {
  let pattern;
  try {
    pattern = readJson(opts.input);
  } catch (_e) {
    return badInput('bad_input');
  }
  if (!pattern || typeof pattern !== 'object') {
    return badInput('bad_input');
  }
  const envelope = online.composePatternQueries(pattern);
  process.stdout.write(JSON.stringify(envelope) + '\n');
  return 0;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main(argv) {
  const opts = parseArgv(argv);

  if (opts.mode === 'score') {
    if (!opts.input) return badInput('bad_input');
    return runScore(opts);
  }
  if (opts.mode === 'compose-queries') {
    if (!opts.input) return badInput('bad_input');
    return runComposeQueries(opts);
  }
  return badInput('bad_input');
}

if (require.main === module) {
  // 2026: set exitCode instead of process.exit so piped stdout is flushed before exit.
  main(process.argv.slice(2)).then(function done(code) { process.exitCode = code; });
}

module.exports = {
  parseArgv: parseArgv,
  stubEncode: stubEncode,
  renderMatrix: renderMatrix,
  main: main,
  runScore: runScore,
};
