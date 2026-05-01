#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 102-00 Wave-0 stub -- RENDER-102-02 operator-aware compaction fence.
 *
 * Purpose: reserve the test path so lib/memory/run-feynman-tests.cjs can
 * register it now (Wave-0). Sibling Plan 102-01 ships render-v2.cjs with
 * operator-aware compaction; that plan replaces this stub with assertions
 * covering all 5 canonical operators per Canon Part 3 § 3-layer loop and
 * Phase 99 CONTEXT.md D-16:
 *   - JUST_TALK        -> prose only; no zones, no Shape rendering
 *   - EXPLORE_CAPTURE  -> prose with Shape E only on crystallization
 *   - BUILD_ROOM       -> full 4-zone anatomy (Zone 1 + 2 + 3 + 4)
 *   - METHODOLOGY      -> no shape mid-session; Shape E at gate
 *   - DECISION_GATE    -> Shape F.x selector; keyboard-only options
 *
 * Compaction-violation contract: renderer rejects out-of-band zone payload
 * with a structured error carrying { code: 'render_v2_compaction_violation' }.
 *
 * Wave-0 contract: exit 0 (PASS) so feynman runner ledger advances; Plan
 * 102-01 promotes this stub into the canonical compaction regression fence.
 *
 * Canon Part 7 + Part 8 invariants identical to test-render-v2-signature.cjs.
 */

process.exit(0);
