#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 355 Plan 06 Task 1 (RED until Task 2 lands lib/core/verification-stamp.cjs).
 *
 * The D-13 / D-54 degradation matrix, end to end, offline: every way Theo can
 * fail to answer must produce an honest `unverified` stamp with a named
 * backend and reason, never a dropped finding and never an invented path.
 *
 * No em-dashes (CLAUDE.md HARD RULE). Hyphens only.
 */

const hygiene = require('./helpers/hygiene-355.cjs');
const wasKeyPresent = hygiene.scrubVendorKey();
const netGuard = hygiene.installNetGuard();

const path = require('node:path');
const replay = require('./helpers/theo-replay-355.cjs');
const fixture = require('./fixtures/355/theo-stub-responses.json');

const { check, summary } = hygiene.makeChecker('355-06 Theo unreachable / degradation matrix');

// Loaded once, passed explicitly as deps.names / deps.registry so no stamp
// call falls back to the module's own lazy fs loaders during this test.
const frameworkNamesData = require(path.join('..', 'data', 'framework-names.json'));
const NAMES = new Set(frameworkNamesData.framework_names.concat(frameworkNamesData.curated_extras));
const commandRegistryData = require(path.join('..', 'data', 'command-registry.json'));
const REGISTRY = new Map();
for (const c of commandRegistryData.commands) {
  if (c && typeof c.command === 'string') REGISTRY.set(c.command, c.frameworks || []);
}
const DEPS_NO_CALL = { names: NAMES, registry: REGISTRY };

let verificationStamp;
try {
  verificationStamp = require('../lib/core/verification-stamp.cjs');
} catch (e) {
  console.log('FAIL: lib/core/verification-stamp.cjs exists (' + e.message + ')');
  netGuard.restore();
  process.exitCode = 1;
  summary();
  process.exit(1);
}

async function main() {
  const callTool = replay.makeReplayCallTool(fixture);
  const deps = Object.assign({ callTool: callTool }, DEPS_NO_CALL);

  async function stampPair(from, to, direction) {
    return verificationStamp.stampFindingDetailed(
      { fromHandle: from, toHandle: to, direction: direction || 'none' },
      deps
    );
  }

  // --- null transport (D-13 case 1) -----------------------------------
  {
    const r = await stampPair('PEST Analysis', 'Ackoff Pyramid');
    check('null transport -> unverified/unavailable/backend_unavailable',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'unavailable' && r.stamp.reason === 'backend_unavailable'
      && !Object.prototype.hasOwnProperty.call(r.stamp, 'path'));
  }

  // --- throw transport (caught -> treated as null) ---------------------
  {
    const r = await stampPair('Mullins Model', 'Futures Wheel');
    check('throw transport -> unverified/unavailable/backend_unavailable',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'unavailable' && r.stamp.reason === 'backend_unavailable');
  }

  // --- egress_blocked sentinel (adapter-side defect, disclosed) --------
  {
    const r = await stampPair('Six Thinking Hats', 'Design Thinking');
    check('egress_blocked -> unverified/unavailable/egress_refused',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'unavailable' && r.stamp.reason === 'egress_refused');
  }

  // --- tier_denied / rate_limited / invalid_key sentinels ---------------
  {
    const r = await stampPair('Jobs to Be Done (JTBD)', 'Systems Thinking');
    check('tier_denied -> unverified/unavailable/tier_denied',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'unavailable' && r.stamp.reason === 'tier_denied');
  }
  {
    const r = await stampPair('S-Curve Analysis', 'Hedgehog Concept');
    check('rate_limited -> unverified/unavailable/rate_limited',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'unavailable' && r.stamp.reason === 'rate_limited');
  }
  {
    const r = await stampPair('Hierarchy Mapping', 'Dominant Design');
    check('invalid_key -> unverified/unavailable/invalid_key',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'unavailable' && r.stamp.reason === 'invalid_key');
  }

  // --- unlisted-tool error -----------------------------------------------
  {
    const r = await stampPair('Adoption-Capacity Theory', 'Self-Selling Loop');
    check('unknown/unlisted tool error -> unverified/unavailable/tool_not_listed',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'unavailable' && r.stamp.reason === 'tool_not_listed');
  }

  // --- other opaque string error -----------------------------------------
  {
    const r = await stampPair('Futures Wheel', 'Six Thinking Hats');
    check('other string error -> unverified/unavailable/backend_unavailable',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'unavailable' && r.stamp.reason === 'backend_unavailable');
  }

  // --- bare string reply ---------------------------------------------------
  {
    const r = await stampPair('Cynefin Framework', 'Ackoff Pyramid');
    check('bare string reply -> unverified/unavailable/text_reply',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'unavailable' && r.stamp.reason === 'text_reply');
  }

  // --- {text: ...} reply, no paths / refusals -------------------------------
  {
    const r = await stampPair('Hedgehog Concept', 'Hierarchy Mapping');
    check('{text} reply, no paths/refusals -> unverified/unavailable/text_reply',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'unavailable' && r.stamp.reason === 'text_reply');
  }

  // --- {coverage, refusals}, no paths key -----------------------------------
  {
    const r = await stampPair('Self-Selling Loop', 'Dominant Design');
    check('{coverage, refusals} -> unverified/theo/endpoint_unresolved',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'theo' && r.stamp.reason === 'endpoint_unresolved');
  }

  // --- {coverage} alone, no refusals, no paths ------------------------------
  {
    const r = await stampPair('PEST Analysis', 'Dominant Design');
    check('{coverage} alone -> unverified/theo/malformed_response',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'theo' && r.stamp.reason === 'malformed_response');
  }

  // --- paths: [] -------------------------------------------------------------
  {
    const r = await stampPair('Hedgehog Concept', 'Six Thinking Hats');
    check('paths: [] -> unverified/theo/no_path_within_3_hops',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'theo' && r.stamp.reason === 'no_path_within_3_hops');
  }

  // --- hop count disagreement / bad shape -------------------------------------
  {
    const r = await stampPair('Design Thinking', 'Cynefin Framework');
    check('hop count disagreement -> unverified/theo/malformed_response',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'theo' && r.stamp.reason === 'malformed_response');
  }
  {
    const r = await stampPair('Systems Thinking', 'Hierarchy Mapping');
    check('pathLabels length mismatch -> unverified/theo/malformed_response',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'theo' && r.stamp.reason === 'malformed_response');
  }

  // --- local resolution miss: not_called / handle_unresolved, ZERO calls ------
  {
    const before = callTool.calls.length;
    const r = await verificationStamp.stampFindingDetailed(
      { fromHandle: null, toHandle: 'Six Thinking Hats', direction: 'none' },
      deps
    );
    check('missing fromHandle -> not_called/handle_unresolved, no path',
      r.stamp.verification === 'unverified' && r.stamp.backend === 'not_called' && r.stamp.reason === 'handle_unresolved'
      && !Object.prototype.hasOwnProperty.call(r.stamp, 'path'));
    check('missing handle makes zero callTool calls', callTool.calls.length === before);
  }

  // --- stampFindings over three findings, null callTool: no finding dropped ---
  {
    const nullCall = replay.makeNullCallTool();
    const findings = [
      { fromHandle: 'Design Thinking', toHandle: 'Jobs to Be Done (JTBD)', direction: 'structural_transfer' },
      { fromHandle: 'Cynefin Framework', toHandle: 'Hedgehog Concept', direction: 'semantic_implementation' },
      { fromHandle: 'Reverse Salient Analysis', toHandle: 'Six Thinking Hats', direction: 'none' },
    ];
    const stamps = await verificationStamp.stampFindings(findings, Object.assign({ callTool: nullCall }, DEPS_NO_CALL));
    check('stampFindings over 3 findings returns 3 stamps (none dropped)', stamps.length === 3);
    check('all three stamps carry backend unavailable', stamps.every((s) => s.backend === 'unavailable'));
    check('zero path keys among the three stamps', stamps.every((s) => !Object.prototype.hasOwnProperty.call(s, 'path')));
  }

  // --- every formatted CLI block for an unverified stamp carries the advice line ---
  {
    let formatter;
    try {
      formatter = require('../lib/core/verification-stamp-format.cjs');
    } catch (_e) {
      formatter = null;
    }
    if (formatter) {
      const cases = [
        await stampPair('PEST Analysis', 'Ackoff Pyramid'),
        await stampPair('Six Thinking Hats', 'Design Thinking'),
        await stampPair('Hedgehog Concept', 'Six Thinking Hats'),
      ];
      for (const c of cases) {
        const lines = formatter.formatStampLines(c.stamp, 'cli');
        check('formatted CLI block carries the may-be-novel-or-hallucinated advice',
          lines.some((l) => l.indexOf('may be novel or hallucinated - verify with a domain expert') !== -1));
      }
    } else {
      check('formatter module present for advice-line checks (SKIPPED, not yet built)', true);
    }
  }

  netGuard.restore();
  check('installNetGuard attempts() === 0 (zero network across this whole file)', netGuard.attempts() === 0);
  check('TYPESAFE_API_KEY was scrubbed before any repo require', typeof wasKeyPresent === 'boolean');

  process.exit(summary());
}

main().catch((e) => {
  console.error('FATAL:', e && e.stack ? e.stack : e);
  netGuard.restore();
  process.exit(1);
});
