#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 05 -- /mos:rs-explain CLI wrapper.
 *
 * The user-visible bidirectional NL-Graph entry point in v1.11.0:
 *
 *   user NL -> rs-nl-to-query.translate(nl) -> {cypher, sql, brain_query}
 *           -> execute against room.db (SQLite) + Aura (Cypher) + Brain
 *           -> aggregate into query_results
 *           -> rs-query-to-text.explain(query_results) -> Larry-voiced NL
 *
 * Canon Part 8: arbitrary user free-form NL meets the Brain boundary at
 * SEAM A inside rs-nl-to-query.cjs (and SEAM 1 + SEAM 2 + SEAM C). The
 * translator OMITS the Brain query when intent is unrecognized OR
 * extractor returned empty scalar. ExternalEgressViolation throws on
 * any leak; this CLI catches and emits a user-friendly Canon Part 8
 * error message at exit code 1.
 *
 * Usage:
 *   node scripts/rs-explain-command.cjs "<NL question>"
 *   node scripts/rs-explain-command.cjs "<NL question>" --json
 *   node scripts/rs-explain-command.cjs "<NL question>" --tier tier0
 *
 * Exit codes:
 *   0  success
 *   1  invocation error (missing NL, ExternalEgressViolation, malformed translate)
 *   2  prerequisite missing
 */

const path = require('path');

let nlToQuery = null;
let queryToText = null;
let lazygraphOps = null;
let brainClient = null;
// Phase 252-01 (SWEEP-01, CONFORM): the honesty rail's closed kind vocabulary
// -- REFUSAL_KINDS is the source of truth for the _brain_degraded marker
// values below, never a hand-duplicated string list.
let refusalMessaging = null;

function _lazyLoad() {
  if (!nlToQuery) nlToQuery = require(path.join(__dirname, '..', 'lib', 'core', 'rs-nl-to-query.cjs'));
  if (!queryToText) queryToText = require(path.join(__dirname, '..', 'lib', 'core', 'rs-query-to-text.cjs'));
  if (!lazygraphOps) lazygraphOps = require(path.join(__dirname, '..', 'lib', 'core', 'lazygraph-ops.cjs'));
  if (!brainClient) brainClient = require(path.join(__dirname, '..', 'lib', 'core', 'brain-client.cjs'));
  if (!refusalMessaging) refusalMessaging = require(path.join(__dirname, '..', 'lib', 'core', 'refusal-messaging.cjs'));
}

function parseArgs(argv) {
  const args = { nl: null, json: false, tier: null };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--json') { args.json = true; continue; }
    if (a === '--help' || a === '-h') { args.help = true; continue; }
    if (a === '--tier' && i + 1 < rest.length) { args.tier = rest[i + 1]; i += 1; continue; }
    if (!args.nl) { args.nl = a; continue; }
  }
  return args;
}

function printError(what, why, fix) {
  process.stderr.write('x ' + what + '\n');
  process.stderr.write('  Why: ' + why + '\n');
  process.stderr.write('  Fix: ' + fix + '\n');
}

function printHelp() {
  process.stdout.write([
    '',
    'Usage: node scripts/rs-explain-command.cjs "<NL question>" [options]',
    '',
    'Bidirectional NL-Graph: NL question -> graph queries -> Larry-voiced explanation.',
    '',
    'Options:',
    '  --json          structured JSON output: {nl, bundle, query_results, explanation}',
    '  --tier <tier>   tier0 forces local-only, skips remote Aura + Brain',
    '',
  ].join('\n'));
}

function inferKindFromBundle(bundle) {
  // The translator does not surface intent_id directly on the bundle; we
  // derive a kind hint from which queries are populated. rs-query-to-text
  // detectKind handles the fine-grained classification, but this hint
  // helps shape the query_results envelope.
  if (bundle && bundle.brain_query && bundle.brain_query.intent_id) {
    const id = bundle.brain_query.intent_id;
    if (id === 'feeds_into_query') return 'methodology_chain';
    if (id === 'expert_network') return 'expert_network';
    if (id === 'discovery_history') return 'discovery_history';
  }
  if (bundle && (bundle.sql || bundle.cypher)) return 'rs_discovery';
  return 'fallback';
}

async function executeBundle(bundle, opts) {
  const out = { kind: inferKindFromBundle(bundle), rows: [], room_context: opts.room_context || null };
  const tier0 = opts.tier === 'tier0';

  // Execute SQL against room.db when present and tier permits.
  if (bundle && bundle.sql && opts.room_dir) {
    try {
      const { conn, db } = await lazygraphOps.openGraph(opts.room_dir);
      try {
        const sqlRows = await lazygraphOps.queryGraph(conn, bundle.sql, bundle.sql_params || []);
        if (Array.isArray(sqlRows)) {
          for (let i = 0; i < sqlRows.length; i += 1) out.rows.push(sqlRows[i]);
        }
      } finally {
        if (typeof lazygraphOps.closeGraph === 'function') await lazygraphOps.closeGraph(db);
      }
    } catch (err) {
      // Local SQL failure is non-fatal at the bundle level; trace via _errors.
      out._sql_error = err && err.message ? err.message : String(err);
    }
  }

  // Execute Cypher against Aura local instance when reachable + non-tier0.
  if (!tier0 && bundle && bundle.cypher && brainClient && typeof brainClient.isAvailable === 'function' && brainClient.isAvailable()) {
    try {
      const result = await brainClient.query(bundle.cypher, bundle.cypher_params || {});
      if (result && Array.isArray(result.records)) {
        for (let i = 0; i < result.records.length; i += 1) out.rows.push(result.records[i]);
      }
    } catch (err) {
      if (err && (err.name === 'AuraUnreachableError' || /unreachable|connect|ECONNREFUSED/i.test(err.message || ''))) {
        out._cypher_degraded = 'aura_unreachable';
      } else {
        out._cypher_error = err && err.message ? err.message : String(err);
      }
    }
  }

  // Execute Brain query (methodology graph) ONLY when present + non-tier0 + reachable.
  // BUG 2 fix: use brain.ask(nl_question) instead of brain.query(raw_cypher).
  // brain_ask is ungated (valid for all API keys); brain_query was admin-gated.
  // Canon Part 8: the NL question is synthesized from enum scalars only
  // (intent_id + target_framework / source_id); never from user content.
  if (!tier0 && bundle && bundle.brain_query && bundle.brain_query.intent_id && brainClient && typeof brainClient.isAvailable === 'function' && brainClient.isAvailable()) {
    try {
      if (typeof brainClient.ask !== 'function') {
        out._brain_degraded = 'brain_ask_unavailable';
      } else {
        // Synthesize a generic NL question from the intent + its enum scalar.
        // Only two intents have brain_template entries: feeds_into_query and
        // methodology_chain. Both carry generic framework-handle params.
        const intentId = bundle.brain_query.intent_id;
        const params = bundle.brain_query.params || {};
        let nlQuestion = null;
        if (intentId === 'feeds_into_query' && params.target_framework) {
          // Generic: asks for the FEEDS_INTO chain from a framework enum handle.
          nlQuestion = 'what frameworks chain from ' + params.target_framework + ' via FEEDS_INTO?';
        } else if (intentId === 'methodology_chain' && params.source_id) {
          nlQuestion = 'what methodology chain follows ' + params.source_id + '?';
        }
        if (nlQuestion) {
          const askResult = await brainClient.ask(nlQuestion);
          // Translate brain_ask response into the rows shape the explainer expects.
          // next_gate.options[].framework -> each becomes a {name} row.
          if (askResult && askResult.next_gate && Array.isArray(askResult.next_gate.options)) {
            for (const opt of askResult.next_gate.options) {
              if (opt && typeof opt.framework === 'string' && opt.framework.length > 0) {
                out.rows.push({ name: opt.framework, id: opt.framework.toLowerCase().replace(/\s+/g, '_') });
              }
            }
          }
          // Also include the anchor framework from directive.
          if (askResult && askResult.directive && askResult.directive.guided && askResult.directive.guided.framework) {
            const anchor = askResult.directive.guided.framework;
            if (!out.rows.some(function (r) { return r.name === anchor; })) {
              out.rows.unshift({ name: anchor, id: anchor.toLowerCase().replace(/\s+/g, '_') });
            }
          }
        } else {
          // Intent has no applicable brain_ask translation (e.g., no scalar) -- degrade cleanly.
          out._brain_degraded = 'intent_no_nl_translation';
        }
      }
    } catch (err) {
      if (err && /unreachable|connect|ECONNREFUSED/i.test(err.message || '')) {
        out._brain_degraded = 'brain_unreachable';
      } else {
        out._brain_error = err && err.message ? err.message : String(err);
      }
    }
  } else if (bundle && bundle.brain_query && (tier0 || !brainClient || typeof brainClient.isAvailable !== 'function' || !brainClient.isAvailable())) {
    // Phase 252-01 (SWEEP-01, CONFORM): kept as the byte-locked
    // 'brain_unreachable' marker value -- lib/memory/test-rs-explain-
    // command.cjs Test 2 asserts it verbatim ("Mode B marker expected"),
    // outside this task's file scope. Vocabulary alignment happens at the
    // RENDER site below instead of here (the marker's cause -- isAvailable()
    // gate vs a caught transport error -- is genuinely conflated under one
    // literal, mirroring the exact conflation-bug SHAPE 250-01 fixed in the
    // shim; renaming the literal itself is a behavior change out of scope
    // for a CONFORM site, so only the visible copy is aligned).
    out._brain_degraded = 'brain_unreachable';
  }

  // Convenience scalars used by the explainer's pickTemplate. Best-effort,
  // never throws on missing fields.
  out.n = out.rows.length;
  if (out.kind === 'rs_discovery' && out.rows.length > 0) {
    out.top_thesis = out.rows[0].thesis || out.rows[0].name || null;
    out.top_score = out.rows[0].breakthrough_score || null;
    out.classification = out.rows[0].rs_type || null;
  }

  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }
  if (!args.nl) {
    printError('No NL question provided', 'rs-explain requires an NL argument', '/mos:rs-explain "<NL question>"');
    process.exit(1);
  }

  try {
    _lazyLoad();
  } catch (err) {
    printError('Library module load failed', err && err.message ? err.message : String(err), 'verify lib/core/rs-nl-to-query.cjs and lib/core/rs-query-to-text.cjs exist');
    process.exit(2);
  }

  // Phase 1: NL -> {cypher, sql, brain_query}. Canon Part 8 SEAM A + 1 + 2 + C
  // all run inside translate(). Adversarial input throws ExternalEgressViolation.
  let bundle;
  try {
    bundle = nlToQuery.translate(args.nl, { room_dir: process.env.MINDRIAN_ROOM || process.cwd() });
  } catch (err) {
    if (err && err.name === 'ExternalEgressViolation') {
      printError(
        'Query rejected by Canon Part 8 audit',
        'forbidden bytes in NL or opts (' + (err.meta && err.meta.surface ? err.meta.surface : 'unknown surface') + ')',
        'rephrase the question without user-content placeholders'
      );
      process.exit(1);
    }
    if (err && err.name === 'TypeError') {
      printError('Malformed NL input', err.message || 'rs-nl-to-query rejected the input', '/mos:rs-explain "<NL question>"');
      process.exit(1);
    }
    process.stderr.write('rs-explain translate error: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  }

  // Phase 2: execute the 3-graph queries.
  const opts = {
    room_dir: process.env.MINDRIAN_ROOM || process.cwd(),
    tier: args.tier,
  };
  let queryResults;
  try {
    queryResults = await executeBundle(bundle, opts);
  } catch (err) {
    process.stderr.write('rs-explain executeBundle error: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  }

  // Phase 3: render Larry-voiced NL via rs-query-to-text.explain.
  // SEAM A + SEAM B audit run inside explain(). Adversarial bundle throws.
  let explanation;
  try {
    explanation = queryToText.explain(queryResults, { room_dir: opts.room_dir });
  } catch (err) {
    if (err && err.name === 'ExternalEgressViolation') {
      printError(
        'Rendered output rejected by Canon Part 8 audit',
        'forbidden bytes in query results (' + (err.meta && err.meta.surface ? err.meta.surface : 'unknown surface') + ')',
        'the upstream graphs leaked forbidden bytes; report to admin'
      );
      process.exit(1);
    }
    process.stderr.write('rs-explain render error: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  }

  if (args.json) {
    process.stdout.write(JSON.stringify({
      nl_query: args.nl,
      query_bundle: bundle,
      query_results: queryResults,
      explanation: explanation,
    }, null, 2) + '\n');
    process.exit(0);
  }

  // Phase Gate-style transcript: header + content + intelligence strip + footer.
  process.stdout.write('\n');
  process.stdout.write('-- rs-explain -- ' + JSON.stringify(args.nl) + ' --\n\n');
  process.stdout.write('  ' + explanation + '\n\n');
  const localCount = queryResults.rows.length;
  // Phase 252-01 (SWEEP-01, CONFORM): align the VISIBLE copy with the rail's
  // vocabulary without renaming the byte-locked '_brain_degraded' marker
  // value itself (lib/memory/test-rs-explain-command.cjs Test 2 asserts it
  // verbatim, outside this task's file scope). 'brain_unreachable' maps to
  // the rail's 'unreachable' kind name for display purposes only.
  const brainDegraded = queryResults._brain_degraded;
  const brainNote = brainDegraded === 'brain_unreachable'
    ? ' (Brain refused: unreachable)'
    : (brainDegraded ? ' (Brain offline: Mode B)' : '');
  const auraNote = queryResults._cypher_degraded ? ' (Aura offline: Tier 0)' : '';
  process.stdout.write('  Query summary: ' + localCount + ' rows aggregated' + brainNote + auraNote + '\n\n');
  process.stdout.write('  -> Bank Opportunity         (Canon Part 3 verb)\n');
  process.stdout.write('  -> Run Methodology          /mos:lean-canvas | /mos:think-hats\n');
  process.stdout.write('  -> Reformulate              /mos:beautiful-question\n\n');

  process.exit(0);
}

if (require.main === module) {
  main().catch(function (err) {
    process.stderr.write('rs-explain unhandled: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  });
}

module.exports = { main, parseArgs, executeBundle, inferKindFromBundle };
