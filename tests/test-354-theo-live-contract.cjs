#!/usr/bin/env node
'use strict';

/*
 * tests/test-354-theo-live-contract.cjs -- Phase 354 Plan 12 Task 2.
 *
 * Opt-in live synthetic contract run against the real production Theo
 * origin (theo-mcp.onrender.com, the default lib/core/brain-client.cjs
 * URL, no override). Never runs by accident: SKIP contract mirrors
 * tests/test-339-theo-ask-e2e-live.cjs's gating idiom, but this file uses
 * the Phase 354 SKIP_EXIT_CODE=77 convention (tests/helpers/
 * fixture-room-354.cjs, tests/run-all-354.sh) instead of exit 0, so a CI
 * runner distinguishes SKIPPED from PASSED for every case, not only the
 * leading stdout line.
 *
 * A hermetic (mock-only) pass never certifies this live integration -- that
 * is the entire reason this file exists as a SEPARATE opt-in test from
 * tests/test-354-theo-journey.cjs.
 *
 * Canon Part 8: every argument sent below is a closed rung enum
 * (UnDefined/IllDefined/WellDefined/Wicked), the literal generic question
 * string named in this plan, or a bare integer (max_steps: 4) -- never room
 * content, never a room path, never anything read from disk via
 * fs.readFileSync. This file performs NO room read of any kind.
 *
 * Run:
 *   node tests/test-354-theo-live-contract.cjs
 *     -> SKIP, exit 77 (default, no env var set)
 *   MINDRIAN_354_LIVE=1 node tests/test-354-theo-live-contract.cjs
 *     -> live run against theo-mcp.onrender.com, exit 0 on full pass,
 *        exit 77 with an ENV GAP line if the Brain is unavailable,
 *        exit 1 on any live assertion failure (a NEW FINDING).
 *
 * Hyphens only, no em-dashes. Plain-Node harness, no framework.
 */

const path = require('node:path');

const SKIP_EXIT_CODE = 77;
const REPO_ROOT = path.resolve(__dirname, '..');
const RUNGS = ['UnDefined', 'IllDefined', 'WellDefined', 'Wicked'];
const LIVE_QUESTION = 'Which framework fits an ill-defined problem at the discovery stage?';

/**
 * sanitizedDigest(value) -> { top_level_keys, array_lengths }
 * Never echoes row/snippet CONTENT, only shape: top-level key names and the
 * length of every array-valued top-level field. Safe to print to stdout and
 * to a tracked evidence file.
 */
function sanitizedDigest(value) {
  if (value === null || typeof value !== 'object') {
    return { top_level_keys: [], array_lengths: {}, scalar_type: typeof value };
  }
  if (Array.isArray(value)) {
    return { top_level_keys: ['(root array)'], array_lengths: { '(root)': value.length } };
  }
  const topLevelKeys = Object.keys(value);
  const arrayLengths = {};
  for (const k of topLevelKeys) {
    if (Array.isArray(value[k])) arrayLengths[k] = value[k].length;
  }
  return { top_level_keys: topLevelKeys, array_lengths: arrayLengths };
}

function nowIso() {
  return new Date().toISOString();
}

async function main() {
  if (process.env.MINDRIAN_354_LIVE !== '1') {
    console.log('SKIP: live Theo contract not requested (set MINDRIAN_354_LIVE=1)');
    process.exit(SKIP_EXIT_CODE);
    return;
  }

  // Default URL, no override -- the real production origin.
  const brainClient = require(path.join(REPO_ROOT, 'lib', 'core', 'brain-client.cjs'));
  const taxonomyClimb = require(path.join(REPO_ROOT, 'lib', 'core', 'strategy', 'taxonomy-climb.cjs'));

  const origin = brainClient.getBrainUrl();

  const available = await brainClient.ensureAvailable();
  if (!available) {
    console.log('ENV GAP: Brain unavailable (no key or no network)');
    process.exit(SKIP_EXIT_CODE);
    return;
  }

  const records = [];
  let allOk = true;

  // -----------------------------------------------------------------
  // recommendChain(rung, 4) for every rung. Never throws by contract; a
  // thrown exception here is itself a finding, so it is caught and
  // recorded rather than crashing the run.
  // -----------------------------------------------------------------
  for (const rung of RUNGS) {
    const startedAt = nowIso();
    const t0 = Date.now();
    let result = null;
    let threw = null;
    try {
      result = await brainClient.recommendChain(rung, 4);
    } catch (e) {
      threw = (e && e.message) ? e.message : String(e);
    }
    const durationMs = Date.now() - t0;

    const digest = sanitizedDigest(result);
    let firstFrameworkName = null;
    if (result && Array.isArray(result.chain) && result.chain.length > 0 && result.chain[0]) {
      firstFrameworkName = typeof result.chain[0].framework === 'string' ? result.chain[0].framework : null;
    }

    // Assertion: an array chain (possibly empty) OR an explicit provider
    // error object -- never a thrown exception.
    const ok = threw === null && result !== null && typeof result === 'object'
      && (Array.isArray(result.chain) || typeof result.error === 'string');
    if (!ok) allOk = false;

    records.push({
      tool: 'recommend_chain',
      origin,
      timestamp: startedAt,
      duration_ms: durationMs,
      argument_keys: ['problem_type', 'max_steps'],
      argument_values: { problem_type: rung, max_steps: 4 },
      digest,
      first_framework_name: firstFrameworkName,
      threw,
      ok,
    });
  }

  // -----------------------------------------------------------------
  // renderLadder(rung) for every Theo rung id. Asserts the returned ladder
  // marks EXACTLY the requested rung (real shape, confirmed live:
  // { rung, question_label, rungs: [{id, gloss, marked}], ladder }).
  // -----------------------------------------------------------------
  for (const rung of RUNGS) {
    const startedAt = nowIso();
    const t0 = Date.now();
    let result = null;
    let threw = null;
    try {
      result = await taxonomyClimb.renderLadder(rung);
    } catch (e) {
      threw = (e && e.message) ? e.message : String(e);
    }
    const durationMs = Date.now() - t0;

    const digest = sanitizedDigest(result);
    let markedRung = null;
    let ok = false;
    if (threw === null && result && typeof result === 'object') {
      if (Array.isArray(result.rungs)) {
        const markedEntries = result.rungs.filter((r) => r && r.marked === true);
        markedRung = (markedEntries.length === 1 && typeof markedEntries[0].id === 'string')
          ? markedEntries[0].id
          : null;
        ok = markedEntries.length === 1 && markedEntries[0].id === rung;
      } else if (typeof result.rung === 'string') {
        // Defensive fallback if the live shape lacks a rungs[] array on a
        // future Theo version: fall back to the top-level echo field.
        markedRung = result.rung;
        ok = result.rung === rung;
      }
    }
    if (!ok) {
      allOk = false;
      // Per the plan: "fail with the raw sanitized shape if it cannot be
      // found" -- the digest above already carries that raw sanitized shape
      // (top-level keys + array lengths), captured into this record
      // regardless of pass/fail so the evidence file shows exactly why.
    }

    records.push({
      tool: 'taxonomy_ladder',
      origin,
      timestamp: startedAt,
      duration_ms: durationMs,
      argument_keys: ['rung'],
      argument_values: { rung },
      digest,
      marked_rung: markedRung,
      threw,
      ok,
    });
  }

  // -----------------------------------------------------------------
  // ask(LIVE_QUESTION, { problem_type: 'IllDefined' }) -- the composed
  // envelope must carry the structurally-threaded rung, never a re-derived
  // one (grounding.problem_type === 'IllDefined', grounding.rung_source ===
  // 'structured' -- confirmed live shape).
  // -----------------------------------------------------------------
  {
    const startedAt = nowIso();
    const t0 = Date.now();
    let result = null;
    let threw = null;
    try {
      result = await brainClient.ask(LIVE_QUESTION, { problem_type: 'IllDefined' });
    } catch (e) {
      threw = (e && e.message) ? e.message : String(e);
    }
    const durationMs = Date.now() - t0;

    const digest = sanitizedDigest(result);
    let firstFrameworkName = null;
    if (result && result.next_gate && Array.isArray(result.next_gate.options) && result.next_gate.options[0]) {
      firstFrameworkName = typeof result.next_gate.options[0].framework === 'string'
        ? result.next_gate.options[0].framework
        : null;
    }

    const ok = threw === null && result && typeof result === 'object'
      && result.grounding && result.grounding.problem_type === 'IllDefined'
      && result.grounding.rung_source === 'structured';
    if (!ok) allOk = false;

    records.push({
      tool: 'brain_ask',
      origin,
      timestamp: startedAt,
      duration_ms: durationMs,
      argument_keys: ['question', 'problem_type'],
      argument_values: { question: LIVE_QUESTION, problem_type: 'IllDefined' },
      digest,
      first_framework_name: firstFrameworkName,
      grounding_problem_type: result && result.grounding ? result.grounding.problem_type : null,
      grounding_rung_source: result && result.grounding ? result.grounding.rung_source : null,
      threw,
      ok,
    });
  }

  // -----------------------------------------------------------------
  // Provider build/version -- read-only, brain_stats() is already wrapped
  // by the client. Theo's live brain_stats response (confirmed live, no
  // override) carries { nodes, relationships, labels[], diagnostics } and
  // no version/build/schema field of any kind -- honestly recorded as
  // 'not exposed', never fabricated.
  // -----------------------------------------------------------------
  let providerBuild = 'not exposed';
  let statsDigest = null;
  try {
    const statsResult = await brainClient.stats();
    statsDigest = sanitizedDigest(statsResult);
    if (statsResult && typeof statsResult === 'object') {
      const versionKey = ['version', 'build', 'schema_version', 'graphrag_version'].find(
        (k) => typeof statsResult[k] === 'string' || typeof statsResult[k] === 'number'
      );
      if (versionKey) providerBuild = String(statsResult[versionKey]);
    }
  } catch (_e) {
    providerBuild = 'not exposed';
  }

  console.log(JSON.stringify({
    probe: 'theo-live-contract-354-12',
    origin,
    node_version: process.version,
    provider_build: providerBuild,
    stats_digest: statsDigest,
    record_count: records.length,
    all_ok: allOk,
  }));
  for (const r of records) {
    console.log(JSON.stringify(r));
  }

  process.exit(allOk ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
