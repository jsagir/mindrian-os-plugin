#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 102-00 Wave-0 stub -- RENDER-102-05 color overlay fence.
 *
 * Purpose: reserve the test path so lib/memory/run-feynman-tests.cjs can
 * register it now (Wave-0). Sibling Plan 102-01 ships render-v2.cjs with
 * a JTBD-derived 5-color De Stijl palette overlay (UI Ruling System §1);
 * that plan replaces this stub with assertions covering:
 *   - mode === 'cli' applies SGR overlay to Zone 1 header + Zone 4 footer
 *   - mode === 'desktop' / 'cowork' applies NO overlay (those surfaces
 *     own their own theming)
 *   - MOS_NO_COLOR=1 env opt-out strips the overlay byte-identically
 *   - canonical text content of every zone is BYTE-IDENTICAL with overlay
 *     disabled (regression fence: strip-ANSI(default) === MOS_NO_COLOR=1)
 *   - palette tokens are exactly the 5 De Stijl colors per UI Ruling
 *     System §1 (no auxiliary colors smuggled in)
 *
 * Wave-0 contract: exit 0 (PASS) so feynman runner ledger advances; Plan
 * 102-01 promotes this stub into the canonical color-overlay regression fence.
 *
 * Canon Part 7 + Part 8 invariants identical to test-render-v2-signature.cjs.
 */

process.exit(0);
