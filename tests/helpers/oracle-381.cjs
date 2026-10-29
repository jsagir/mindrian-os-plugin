'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 01: the OLD oracle of the parity gate (the rest of this helper lands in Task 2).
 *
 * BASE_SHA = HEAD after quick sc6 4f470032b (which lands after quick D 261029-s9x) and the
 * injection hotfix quick 261029-u8x (at or after 5a2dcfd4d), recorded by plan 381-01 (ruling 9).
 * ORACLE_381_BASE_SHA overrides it.
 */
const BASE_SHA = process.env.ORACLE_381_BASE_SHA || '65aaf329f9c514c71fff2f1a530cd366c0b87b66';

module.exports = { BASE_SHA };
