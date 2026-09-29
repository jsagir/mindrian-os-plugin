#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Quick 260929-obr -- the live 211 gold-card judge, on Jev.
 *
 * Jev (usefulness_judge) replaces the retired Plurai cross-topic-connection
 * judge (Plurai retired 2026-09-29: hosted endpoint returns HTTP 404).
 *
 * LIVE and KEY-GATED. Only SYNTHETIC gold-card text egresses (Part 8 + the
 * spike-skill IP egress ruling): the transferable dark-matter pairing must judge
 * useful|already_known, the unrelated davinci/lovelace pairing must judge
 * not_useful|none.
 *
 * Exit contract: 0 PASS, 1 FAIL, 77 SKIPPED (ENV GAP) when there is no key or the
 * vendor is unreachable -- never reported as PASSED. This leg writes no baseline
 * file. All logic lives in tests/helpers/jev-gold-card-leg.cjs (contract-tested
 * offline by tests/test-211-jev-leg-contract.cjs).
 *
 * No em-dashes. Hyphens only.
 */

const path = require('node:path');
const leg = require(path.join(__dirname, 'helpers', 'jev-gold-card-leg.cjs'));

leg.main(['transferable_darkmatter', 'unrelated_davinci_lovelace'])
  .then(function (code) { process.exit(code); })
  .catch(function (e) {
    console.log('FAIL Jev gold-card leg threw: ' + (e && e.message ? e.message : e));
    process.exit(1);
  });
