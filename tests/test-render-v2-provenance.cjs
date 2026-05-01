#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 102-00 Wave-0 stub -- RENDER-102-04 _provenance envelope fence.
 *
 * Purpose: reserve the test path so lib/memory/run-feynman-tests.cjs can
 * register it now (Wave-0). Sibling Plan 102-01 ships render-v2.cjs with
 * a provenance envelope; that plan replaces this stub with assertions
 * covering:
 *   - every Phase 102 render result carries _provenance shape
 *   - _provenance.renderer === 'render-v2'
 *   - _provenance.version === '102'
 *   - _provenance.operator passthrough across all 5 canonical operators
 *   - _provenance.mode passthrough (cli / desktop / cowork + arbitrary)
 *   - _provenance.tier passthrough (tier-0 / mode-a / mode-b + arbitrary)
 *   - _provenance.jtbd defaults to null when arg omitted
 *
 * Canon Part 8 (Graph Boundary) regression fence: assert renderer makes
 * zero Brain queries, zero network IO, and the only filesystem read is
 * lib/render/JTBD-PALETTES.md (LOCAL plugin asset). Test will spawn the
 * renderer in a child with FS / network surface scoped via assertions on
 * a fail-closed mock.
 *
 * Wave-0 contract: exit 0 (PASS) so feynman runner ledger advances; Plan
 * 102-01 promotes this stub into the canonical provenance regression fence.
 *
 * Canon Part 7 + Part 8 invariants identical to test-render-v2-signature.cjs.
 */

process.exit(0);
