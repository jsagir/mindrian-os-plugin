#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 354 Plan 10 Task 1 -- provider-compatibility regression for the
 * taxonomy-ladder rung casing (THEO-01, CTX-TAXO, P2).
 *
 * THE SEAM THIS PROVES: lib/core/strategy/rung-vocabulary.cjs's
 * LADDER_RUNG_BY_THEO_ID and lib/core/part8-egress-guard.cjs's
 * TAXONOMY_RUNGS previously agreed with EACH OTHER (a lowercase/hyphenated
 * ladder vocabulary), but neither agreed with Theo's actual
 * taxonomy_ladder input schema, `z.enum([...PROBLEM_TYPE_IDS])` with
 * `PROBLEM_TYPE_IDS = ['UnDefined', 'IllDefined', 'WellDefined', 'Wicked']`
 * (/home/jsagi/Theo/src/mcp/content/vocabulary.ts:53-58,
 * taxonomy-ladder.ts:285-286). Two locally-consistent layers, disagreeing
 * with the one layer that actually matters: the provider's schema. This
 * test reads the PROVIDER's real enum (read-only: fs.readFileSync only,
 * never a file-write or a git mutation of any kind against that checkout)
 * instead of re-asserting the plugin's own vocabulary against itself, which
 * is how CTX-TAXO shipped green in the first place.
 *
 * SCOPE LOCK (CTX-CORRECTED, CTX-TAXO): only the taxonomy_ladder path. T4
 * below pins that lib/core/brain-client.cjs's recommendChain()
 * origin-specific normalization (BRAIN_PROBLEM_TYPE_ALIASES_THEO) is
 * untouched -- this plan's files_modified list does not include
 * brain-client.cjs, and no assertion here requires editing it.
 *
 * Four legs:
 *   T1 -- every rungVocabulary.THEO_RUNGS member maps, through toLadderRung,
 *         to a string that IS a member of the provider's real enum.
 *   T2 -- through the REAL client call path (taxonomy-climb's renderLadder,
 *         the shared SSE capture server), all four ids' captured
 *         taxonomy_ladder requests carry a provider-set rung, and none of
 *         the four calls is dropped.
 *   T3 -- part8-egress-guard.classify() allows a Theo-cased rung for
 *         taxonomy_ladder and does NOT allow the old lowercase/hyphenated
 *         form.
 *   T4 -- scope pin: brain-client.cjs's own Theo problem-type alias table
 *         (reached only through recommendChain(), never edited by this
 *         plan) still maps 'ill-defined'/'undefined'/'well-defined' to
 *         'IllDefined'/'UnDefined'/'WellDefined' -- the recommendChain path
 *         is unaffected by this plan's taxonomy_ladder-only fix.
 *
 * Run against UNFIXED code: T1, T2 and T3 fail (exit 1). Run: node
 * tests/test-354-taxonomy-ladder-casing.cjs. Plain Node harness, house
 * style (hand-rolled ok(), fails process.exit(1)). Hyphens only, no
 * em-dashes (CLAUDE.md HARD RULE).
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO = path.resolve(__dirname, '..');
const RUNG_VOCAB_PATH = path.join(REPO, 'lib', 'core', 'strategy', 'rung-vocabulary.cjs');
const TAXONOMY_CLIMB_PATH = path.join(REPO, 'lib', 'core', 'strategy', 'taxonomy-climb.cjs');
const BRAIN_CLIENT_PATH = path.join(REPO, 'lib', 'core', 'brain-client.cjs');
const GUARD_PATH = path.join(REPO, 'lib', 'core', 'part8-egress-guard.cjs');

const {
  startCaptureServer,
  captured,
  resetCaptured,
  stopCaptureServer,
} = require('./helpers/brain-capture-server.cjs');

let checks = 0;
let failed = 0;
const failedLegs = new Set();

function ok(leg, label, cond) {
  checks += 1;
  if (!cond) {
    failed += 1;
    failedLegs.add(leg);
    console.log('FAIL [' + leg + ']: ' + label);
  } else {
    console.log('ok   [' + leg + ']: ' + label);
  }
}

function requireFresh(modulePath) {
  delete require.cache[modulePath];
  return require(modulePath);
}

// ---------------------------------------------------------------------------
// Resolve the PROVIDER vocabulary, read-only, off the Theo checkout named by
// MINDRIAN_THEO_CHECKOUT (default /home/jsagi/Theo). fs.readFileSync only --
// this function never writes, adds, commits or pushes anything.
// ---------------------------------------------------------------------------
const PINNED_FALLBACK = Object.freeze(['UnDefined', 'IllDefined', 'WellDefined', 'Wicked']);

function resolveProviderVocabulary() {
  const checkout = process.env.MINDRIAN_THEO_CHECKOUT || '/home/jsagi/Theo';
  const vocabPath = path.join(checkout, 'src', 'mcp', 'content', 'vocabulary.ts');

  if (!fs.existsSync(vocabPath)) {
    console.log('ENV GAP: Theo checkout not found; provider leg skipped');
    return { ids: PINNED_FALLBACK.slice(), commit: null, skipped: true };
  }

  let text;
  try {
    text = fs.readFileSync(vocabPath, 'utf8');
  } catch (e) {
    console.log('ENV GAP: Theo checkout unreadable (' + (e && e.message) + '); provider leg skipped');
    return { ids: PINNED_FALLBACK.slice(), commit: null, skipped: true };
  }

  const sliceMatch = text.match(/export const PROBLEM_TYPE_IDS = \[([\s\S]*?)\] as const/);
  if (!sliceMatch) {
    console.log('ENV GAP: PROBLEM_TYPE_IDS literal not found in vocabulary.ts; provider leg skipped');
    return { ids: PINNED_FALLBACK.slice(), commit: null, skipped: true };
  }
  const quoted = sliceMatch[1].match(/'([^']+)'/g) || [];
  const ids = quoted.map((s) => s.slice(1, -1));

  let commit = null;
  try {
    commit = execFileSync('git', ['-C', checkout, 'log', '-1', '--format=%h'], {
      encoding: 'utf8',
    }).trim();
  } catch (e) {
    commit = null;
  }

  if (ids.length === 0) {
    console.log('ENV GAP: PROBLEM_TYPE_IDS parsed empty; provider leg skipped');
    return { ids: PINNED_FALLBACK.slice(), commit: commit, skipped: true };
  }

  return { ids: ids, commit: commit, skipped: false };
}

const provider = resolveProviderVocabulary();
const providerSet = new Set(provider.ids);

console.log('');
console.log('Provider vocabulary: ' + JSON.stringify(provider.ids));
console.log('Theo commit compared against: ' + (provider.commit || '(unavailable)'));
console.log('');

async function main() {
  const rungVocabulary = requireFresh(RUNG_VOCAB_PATH);

  // -------------------------------------------------------------------------
  // T1: every THEO_RUNGS member's toLadderRung() output is a provider-set
  // member.
  // -------------------------------------------------------------------------
  console.log('--- T1: toLadderRung output is a provider-enum member, all four rungs ---');
  rungVocabulary.THEO_RUNGS.forEach((theoRung) => {
    const ladderRung = rungVocabulary.toLadderRung(theoRung);
    ok(
      'T1',
      'toLadderRung(' + theoRung + ') = ' + JSON.stringify(ladderRung) + ' is in the provider set',
      typeof ladderRung === 'string' && providerSet.has(ladderRung)
    );
  });

  // -------------------------------------------------------------------------
  // T2: through the real client call path -- capture server, taxonomy-climb
  // renderLadder for all four ids.
  // -------------------------------------------------------------------------
  console.log('');
  console.log('--- T2: real client path (renderLadder -> callTool -> captured request) ---');

  const { server, url } = await startCaptureServer();
  process.env.MINDRIAN_BRAIN_URL = url;
  process.env.MINDRIAN_BRAIN_KEY = 'synthetic-354-10-key';
  process.env.MINDRIAN_BRAIN_ROUTE_TIMEOUT_MS = '5000';

  requireFresh(BRAIN_CLIENT_PATH);
  const taxonomyClimb = requireFresh(TAXONOMY_CLIMB_PATH);

  resetCaptured();
  // A valid jtbd slug for one call, undefined (omitted) for the others --
  // renderLadder's own contract (question_label is optional, closed-set
  // validated); this test does not need to exercise that validation itself,
  // only prove the rung argument's casing reaches the wire correctly.
  const T2_SLUGS = ['decide-pursue', undefined, undefined, undefined];
  for (let i = 0; i < rungVocabulary.THEO_RUNGS.length; i++) {
    const theoRung = rungVocabulary.THEO_RUNGS[i];
    // eslint-disable-next-line no-await-in-loop
    await taxonomyClimb.renderLadder(theoRung, T2_SLUGS[i]);
  }

  const taxCalls = captured.filter((c) => c.name === 'taxonomy_ladder');
  ok('T2', 'exactly four taxonomy_ladder calls were captured (no drops)', taxCalls.length === 4);

  rungVocabulary.THEO_RUNGS.forEach((theoRung, i) => {
    const call = taxCalls[i];
    ok(
      'T2',
      'captured call ' + i + ' (' + theoRung + ') has arguments.rung in the provider set',
      !!call && call.arguments && providerSet.has(call.arguments.rung)
    );
  });

  await stopCaptureServer(server);

  // -------------------------------------------------------------------------
  // T3: part8-egress-guard.classify() -- a Theo-cased rung allows
  // taxonomy_ladder; the old lowercase/hyphenated form does not.
  // -------------------------------------------------------------------------
  console.log('');
  console.log('--- T3: egress guard allows Theo-cased rung, refuses the old lowercase form ---');

  const guard = requireFresh(GUARD_PATH);

  const allowVerdict = guard.classify({ rung: 'IllDefined' }, { toolName: 'taxonomy_ladder' });
  ok(
    'T3',
    "classify({rung: 'IllDefined'}, {toolName: 'taxonomy_ladder'}) verdict is allow / known_tool_shape, got " +
      JSON.stringify(allowVerdict),
    allowVerdict.verdict === 'allow' && allowVerdict.class === 'known_tool_shape'
  );

  const oldVerdict = guard.classify({ rung: 'ill-defined' }, { toolName: 'taxonomy_ladder' });
  ok(
    'T3',
    "classify({rung: 'ill-defined'}, {toolName: 'taxonomy_ladder'}) is NOT allow, got " +
      JSON.stringify(oldVerdict),
    oldVerdict.verdict !== 'allow'
  );

  // -------------------------------------------------------------------------
  // T4: scope pin -- brain-client.cjs's own Theo alias table (recommendChain
  // path) is untouched. Mirrors 354-09's own technique
  // (tests/test-354-theo-router-contract.cjs): point MINDRIAN_BRAIN_URL at
  // the REAL Theo origin string while stubbing global.fetch directly, so
  // brain-client.cjs's origin-keyed selector (THEO_ORIGINS) picks
  // BRAIN_PROBLEM_TYPE_ALIASES_THEO exactly as production does. This file
  // never edits brain-client.cjs; this leg observes its EXISTING, unmodified
  // behavior only.
  // -------------------------------------------------------------------------
  console.log('');
  console.log('--- T4: scope pin -- brain-client.cjs recommendChain alias table unchanged ---');

  process.env.MINDRIAN_BRAIN_URL = 'https://theo-mcp.onrender.com';
  process.env.MINDRIAN_BRAIN_KEY = 'synthetic-354-10-theo-key';
  const brainClient = requireFresh(BRAIN_CLIENT_PATH);

  const originalFetch = global.fetch;
  const T4_CASES = [
    ['ill-defined', 'IllDefined'],
    ['undefined', 'UnDefined'],
    ['well-defined', 'WellDefined'],
  ];

  for (let i = 0; i < T4_CASES.length; i++) {
    const [localSlug, expectedTheoId] = T4_CASES[i];
    let sentProblemType = null;
    global.fetch = async (_url, opts) => {
      const request = JSON.parse(opts.body);
      if (request.method === 'initialize') {
        return {
          ok: true,
          status: 200,
          text: async () => 'data: ' + JSON.stringify({
            jsonrpc: '2.0', id: request.id,
            result: { protocolVersion: '2024-11-05', capabilities: {} },
          }) + '\n',
        };
      }
      if (request.method === 'tools/call') {
        sentProblemType = request.params && request.params.arguments && request.params.arguments.problem_type;
        return {
          ok: true,
          status: 200,
          text: async () => 'data: ' + JSON.stringify({
            jsonrpc: '2.0', id: request.id,
            result: { content: [{ type: 'text', text: JSON.stringify({ grounded: false, chain: [] }) }] },
          }) + '\n',
        };
      }
      return {
        ok: true,
        status: 200,
        text: async () => 'data: ' + JSON.stringify({ jsonrpc: '2.0', id: request.id, result: {} }) + '\n',
      };
    };
    // eslint-disable-next-line no-await-in-loop
    await brainClient.recommendChain(localSlug);
    ok(
      'T4',
      "recommendChain('" + localSlug + "') sends problem_type " + expectedTheoId + ', got ' + sentProblemType,
      sentProblemType === expectedTheoId
    );
  }
  global.fetch = originalFetch;

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log('');
  console.log('======================================');
  console.log('Checks: ' + checks + '  Failed: ' + failed);
  if (failedLegs.size > 0) {
    console.log('Failed legs: ' + Array.from(failedLegs).sort().join(', '));
  }
  console.log('======================================');

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('FAIL: test-354-taxonomy-ladder-casing');
  console.error(e && e.stack ? e.stack : e);
  process.exit(1);
});
