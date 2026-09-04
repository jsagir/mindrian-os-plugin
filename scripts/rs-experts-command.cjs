#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 89.5 Plan 05 -- /mos:rs-experts CLI wrapper.
 *
 * BUG 2 FIX (routing, 2026-05-22): the former Tier 1 path called
 * brainClient.query(cypher) which routes to the REMOTE Brain (the origin
 * resolved by getBrainUrl(), lib/core/brain-client.cjs; named via the
 * resolver rather than a host as of phase 339, 2026-09-03) when
 * MINDRIAN_BRAIN_KEY is set.
 * Author/Paper/Institution nodes do NOT exist in the remote Brain --
 * they live in the user's LOCAL Aura mirror (populated via /mos:rs-fetch).
 * Routing to the remote Brain would always return empty results AND
 * potentially expose topic strings (user-chosen search strings) to the
 * remote server, which is a Canon Part 8 concern.
 *
 * Fix: the remote-Brain Tier 1 path is removed. This command now relies
 * on the Tier 0 graceful-degradation path exclusively. A future phase
 * that ships a LOCAL Aura transport (not brain-client.cjs) can restore
 * an Aura-specific query path.
 *
 * Resolves the expert network for a topic via graceful Tier 0 guidance.
 * Tier 0 surfaces a message pointing the user to /mos:rs-fetch to
 * populate the local mirror first.
 *
 * F-7 FIX (296-02, 2026-09-03): the old Tier-0 message conflated three
 * distinct causes into one hand-rolled string, including dressing a
 * genuinely empty (correct) result as a fault. resolveExpertTier() now
 * distinguishes them and routes cause (b) through the shipped
 * refusal-messaging.cjs rail instead of a seventh invented phrasing.
 *

 * Usage:
 *   node scripts/rs-experts-command.cjs "<topic>"
 *   node scripts/rs-experts-command.cjs "<topic>" --json
 *   node scripts/rs-experts-command.cjs "<topic>" --limit 50
 *
 * Exit codes:
 *   0  success (including graceful Tier 0 message)
 *   1  invocation error (missing topic, ExternalEgressViolation)
 *   2  prerequisite missing
 *
 * Canon Part 8: topic is parameterized (NO concatenation). Audited via
 * auditQueryString BEFORE use. Remote Brain is never called from this
 * command -- Author/Paper/Institution nodes are LOCAL only.
 */

const path = require('path');

// NOTE: brainClient is intentionally NOT loaded here. rs-experts must never
// call the remote Brain -- Author/Paper/Institution nodes are LOCAL only
// (populated via /mos:rs-fetch into the user's Aura mirror). The former
// Tier 1 path via brainClient has been removed; see comment at top of file.
// Phase 296-02 (F-7): the only new require this task adds is
// lib/core/refusal-messaging.cjs, for its shipped 'unreachable' copy -- not
// a Brain client of any kind. Never mistake it for one.
let egressPrompts = null;
let refusal = null;

function _lazyLoad() {
  if (!egressPrompts) egressPrompts = require(path.join(__dirname, '..', 'lib', 'core', 'rs-egress-prompts.cjs'));
  if (!refusal) refusal = require(path.join(__dirname, '..', 'lib', 'core', 'refusal-messaging.cjs'));
}

function parseArgs(argv) {
  const args = { topic: null, json: false, limit: 25 };
  const rest = argv.slice(2);
  for (let i = 0; i < rest.length; i += 1) {
    const a = rest[i];
    if (a === '--json') { args.json = true; continue; }
    if (a === '--help' || a === '-h') { args.help = true; continue; }
    if (a === '--limit' && i + 1 < rest.length) {
      const n = parseInt(rest[i + 1], 10);
      if (Number.isFinite(n) && n > 0 && n < 1000) args.limit = n;
      i += 1;
      continue;
    }
    if (!args.topic) { args.topic = a; continue; }
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
    'Usage: node scripts/rs-experts-command.cjs "<topic>" [options]',
    '',
    'Resolve the expert network for <topic> from local Aura.',
    'Tier 0 (Aura unreachable) returns a graceful guidance message.',
    '',
    'Options:',
    '  --json          structured JSON output for Desktop MCP',
    '  --limit <n>     cap returned authors (default 25)',
    '',
  ].join('\n'));
}

function renderTranscript(topic, authors) {
  process.stdout.write('\n');
  process.stdout.write('-- rs-experts -- ' + topic + ' -- ' + authors.length + ' authors --\n\n');
  if (authors.length === 0) {
    process.stdout.write('  No experts found for topic.\n');
    process.stdout.write('  -> /mos:rs-fetch ' + JSON.stringify(topic) + '   Populate the mirror with fresh papers\n\n');
    return;
  }
  process.stdout.write('  Rank  Author                      Institution(s)               Papers  Score\n');
  process.stdout.write('  ' + '-'.repeat(78) + '\n');
  authors.forEach(function (a, i) {
    const rank = String(i + 1).padEnd(6);
    const name = String(a.name || 'unknown').padEnd(28).slice(0, 28);
    const insts = (a.institutions || []).slice(0, 2).join(', ').padEnd(28).slice(0, 28);
    const papers = String(a.paper_count || 0).padEnd(8);
    const score = (typeof a.score === 'number') ? a.score.toFixed(2) : 'n/a';
    process.stdout.write('  ' + rank + name + '  ' + insts + '  ' + papers + score + '\n');
  });
  process.stdout.write('\n  -> /mos:persona               Build engagement strategy\n');
  process.stdout.write('  -> /mos:rs-fetch ' + JSON.stringify(topic) + '       Refresh papers and re-resolve\n\n');
}

/**
 * Phase 296-02 (F-7 fix): resolve one of three genuinely distinct causes
 * instead of one hand-rolled string, routed through the shipped refusal
 * rail rather than a seventh invented phrasing (Theo CONN-05, Canon
 * Part 7).
 *
 * (a) No Tier-1 transport ships at all (the only branch reachable in
 *     production today -- no local Aura transport exists yet). A capability
 *     statement, not a fault: refusal_code AURA_TRANSPORT_ABSENT.
 * (b) A transport is injected (opts._transport, the vector-store.cjs
 *     options._forceVec0Unavailable test-seam idiom) and rejects with an
 *     error shaped like an outage: refusal_code sourced verbatim from
 *     refusal-messaging.cjs's KIND_STATUS.unreachable value, never retyped
 *     as a literal here.
 * (c)/(d) The transport resolves (with zero or more rows): a SUCCESS,
 *     tier1, `authors` present (possibly empty), `matched` set, and NO
 *     refusal_code key at all -- Theo CONN-05's empty-versus-broken rule.
 *     A genuinely empty result is a CORRECT answer, never a fault.
 * A non-unreachable-shaped rejection (a real query-shape bug) gets its own
 * AURA_QUERY_FAILED code with a bounded detail, so it never masquerades as
 * an outage either.
 *
 * Both refusal branches OMIT `authors` entirely rather than carrying it as
 * `[]` (Theo's omit-never-null rule, CONN-05: an absent key says nothing;
 * an empty array asserts a query ran and matched zero, which is a claim
 * about a query that never executed).
 * See /home/jsagi/Theo/src/mcp/content/normalize-framework-name.ts:41-52.
 *
 * @param {string} topic
 * @param {{_transport?: function}} [opts]  opts._transport is a test-only
 *   injectable seam; production always passes it as undefined/absent, which
 *   is the only branch reachable today (no local Aura transport ships).
 * @returns {Promise<object>}  never throws.
 */
async function resolveExpertTier(topic, opts) {
  _lazyLoad();
  const o = (opts && typeof opts === 'object') ? opts : {};
  const transport = o._transport;

  if (typeof transport !== 'function') {
    // Cause (a): the only branch reachable in production today. No local
    // Aura transport ships (commands/rs-experts.md line 68 names this; see
    // also this file's own top-of-file BUG 2 fix comment). The seam exists
    // so causes (b)/(c)/(d) are testable now and a future local transport
    // is a one-line wiring change rather than a rewrite of this function.
    return {
      tier: 'tier0',
      refusal_code: 'AURA_TRANSPORT_ABSENT',
      degraded_note: 'local_aura_transport_not_yet_available',
      reason: 'No local Aura transport is configured for rs-experts yet. ' +
        'This is a capability gap, not an outage.',
      next_moves: ['run_rs_fetch', 'continue_without'],
    };
  }

  let rows;
  try {
    rows = await transport(topic);
  } catch (err) {
    const msg = err && err.message ? err.message : String(err);
    if (/unreachable|connect|ECONNREFUSED|ETIMEDOUT/i.test(msg)) {
      // Cause (b): the rail's shipped copy, never a retyped literal.
      const env = refusal.refusalResponse('unreachable', { tool: 'rs-experts' });
      return {
        tier: 'tier0',
        refusal_code: env.status,
        reason: env.reason,
        next_moves: env.next_moves,
      };
    }
    // A query-shape bug (not an outage): its own distinct code, bounded
    // detail (T-296-12: never an env value or a topic echo).
    return {
      tier: 'tier0',
      refusal_code: 'AURA_QUERY_FAILED',
      reason: 'The local Aura query failed for rs-experts.',
      detail: msg.slice(0, 500),
      next_moves: ['retry', 'continue_without'],
    };
  }

  // Cause (c) or (d): the transport ran. Zero rows is a SUCCESS -- a
  // genuinely empty expert list is a correct answer, never dressed as a
  // fault. No refusal_code key at all on this branch.
  const authors = Array.isArray(rows) ? rows : [];
  return {
    tier: 'tier1',
    authors: authors,
    matched: authors.length,
  };
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.help) { printHelp(); process.exit(0); }
  if (!args.topic) {
    printError('No topic provided', 'rs-experts requires a topic argument', '/mos:rs-experts <topic>');
    process.exit(1);
  }

  try {
    _lazyLoad();
  } catch (err) {
    printError('Library module load failed', err && err.message ? err.message : String(err), 'verify lib/core/rs-egress-prompts.cjs exists');
    process.exit(2);
  }

  // Canon Part 8 input audit on the bound parameter BEFORE any use.
  try {
    egressPrompts.auditQueryString(args.topic, 'rs-experts-command-input');
  } catch (err) {
    if (err && err.name === 'ExternalEgressViolation') {
      printError('Canon Part 8 audit failed', 'forbidden bytes in topic (' + (err.meta && err.meta.surface ? err.meta.surface : 'unknown surface') + ')', 'rephrase the topic without user-content placeholders');
      process.exit(1);
    }
    throw err;
  }

  // Phase 296-02 (F-7 fix): route through resolveExpertTier's three
  // distinguishable causes instead of one hand-rolled string. The remote
  // Brain (brain-client.cjs) is never used here. Author/Paper/Institution
  // nodes live in the user's LOCAL Aura mirror, populated by /mos:rs-fetch.
  const result = await resolveExpertTier(args.topic, {});

  if (args.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    process.exit(0);
  }

  if (result.refusal_code === 'AURA_TRANSPORT_ABSENT') {
    printError(
      'Expert transport not available',
      'no local Aura transport is configured for rs-experts yet; this is a capability gap, not an outage',
      '/mos:rs-fetch ' + JSON.stringify(args.topic) + ' first to populate the local SQLite mirror, then retry'
    );
    process.exit(0); // Tier 0 fallback is graceful, not an error
  }

  // Read the unreachable status off the rail itself rather than retyping
  // its status literal here (mirrors resolveExpertTier's own never-retype
  // rule).
  const unreachableStatus = refusal.refusalResponse('unreachable', { tool: 'rs-experts' }).status;
  if (result.refusal_code === unreachableStatus) {
    process.stdout.write(refusal.renderRefusal('unreachable', { tool: 'rs-experts' }));
    process.exit(0);
  }

  if (!result.refusal_code) {
    // Cause (c) or (d): the EXISTING renderTranscript already prints the
    // honest "No experts found for topic." success branch for an empty
    // list. Do not add a second empty-state renderer.
    renderTranscript(args.topic, result.authors);
    process.exit(0);
  }

  // AURA_QUERY_FAILED: a real query-shape bug, still graceful (never a
  // crash), still exits 0.
  printError(
    'Expert query failed',
    result.reason + (result.detail ? ' (' + result.detail + ')' : ''),
    'retry, or /mos:rs-fetch ' + JSON.stringify(args.topic) + ' to refresh the local mirror'
  );
  process.exit(0);
}

if (require.main === module) {
  main().catch(function (err) {
    process.stderr.write('rs-experts unhandled: ' + (err && err.message ? err.message : String(err)) + '\n');
    process.exit(1);
  });
}

module.exports = { main, parseArgs, renderTranscript, resolveExpertTier };
