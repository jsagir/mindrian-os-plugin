#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 212-04 -- the OPTIONAL deployed-classifier leg (navigator Q3 lock),
 * now on Jev (renamed from test-212-plurai-leg.cjs, quick 260929-obr).
 *
 * WHAT THIS IS
 *   The local two-stage critic (lib/core/eureka-critic.cjs) is the CORE of the
 *   Grounding Guard. This leg is a SEPARATELY-GATED calibration signal: Jev's
 *   usefulness_judge scored on the SYNTHETIC gold-card transferable pairing
 *   (dark matter), which must judge useful|already_known.
 *
 *   Plurai retirement note: the Plurai cross-topic-connection judge this leg used
 *   to call was retired 2026-09-29 (hosted endpoint returns HTTP 404); the
 *   navigator directive is "evals using jev not plurai".
 *
 * EXIT CONTRACT
 *   0 PASS, 1 FAIL, 77 SKIPPED (ENV GAP) with no key or an unreachable vendor,
 *   never reported as PASSED. run-all-212.sh maps 77 to SKIPPED (ENV GAP). This
 *   leg writes no baseline file.
 *
 * --------------------------------------------------------------------------
 * PART 8 EGRESS RULE (stated once, enforced structurally):
 * The vendor judge is BUILD/CI ONLY, never the runtime path, never real-room
 * content. This leg scores ONLY the pseudonymous, synthetic-by-construction
 * gold-card texts from evals/eureka/cases/. It never opens any room database.
 * (The local critic is the runtime Grounding Guard; this judge is an offline
 * calibration signal.)
 * --------------------------------------------------------------------------
 *
 * Reuse before build (Part 7): the whole leg is tests/helpers/jev-gold-card-leg.cjs
 * (jev() + makeUsefulnessCeiling), contract-tested offline by
 * tests/test-211-jev-leg-contract.cjs. No hand-rolled REST client.
 *
 * No em-dashes. Hyphens only.
 */

const path = require('node:path');
const leg = require(path.join(__dirname, 'helpers', 'jev-gold-card-leg.cjs'));

leg.main(['transferable_darkmatter'])
  .then(function (code) { process.exit(code); })
  .catch(function (e) {
    console.log('FAIL Jev gold-card leg threw: ' + (e && e.message ? e.message : e));
    process.exit(1);
  });
