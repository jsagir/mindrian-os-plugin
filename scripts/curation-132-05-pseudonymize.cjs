#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 132 Plan 05 -- pseudonymize driver for the 6 internal-team :Person
 * nodes (RE-BASELINED MACHINERY; the live WRITE is DEFERRED to v1.14.0).
 * ======================================================================
 * RE-BASELINE (Phase 132 = code + tiny re-baselined live cleanup):
 *   The LIVE pseudonymize write of the 6 internal-team :Person nodes is DEFERRED
 *   to v1.14.0. See the Phase 132 deferred-items.md entry. This module ships the
 *   reversible, flag-matched, Part 8-clean BUILDER + a --dry-run that prints the
 *   Cypher WITHOUT mutating. The --execute path stays creds-gated through the
 *   132-01 runner but is NOT invoked in this plan: ZERO live Brain writes.
 *
 * WHY pseudonymize (Canon decision 5, 132-CONTEXT): the Brain MCP now ships to
 * the testers tier (a shared surface), so the no-real-names-in-tracked-surfaces
 * rule applies to it. The 6 internal-team :Person nodes (re-labeled with
 * mindrian_internal:true in the 2026-05-17 dogfooding session, names DELIBERATELY
 * not in the audit doc or any tracked file) get neutral pseudonyms while KEEPING
 * the mindrian_internal:true flag. The Aronhime node is the one PUBLIC exception
 * (Larry-persona namesake, wired AUTHORED to 7 PWS framework variants) and is
 * EXCLUDED.
 *
 * THE HARD INVARIANT (the no-real-names-in-tracked-files rule): the real names
 * must NEVER enter this tracked plugin repo. So:
 *   - The MATCH selector is the mindrian_internal:true FLAG, never a real-name
 *     string literal.
 *   - The forward Cypher binds only a neutral pseudonym + a stable opaque handle
 *     ordinal + the provenance scalar.
 *   - The real-name -> pseudonym binding happens IN-GRAPH at execute time: the
 *     forward write stores p.name into a temp property (name_pre_pseudonym)
 *     BEFORE overwriting p.name with the pseudonym, so the rollback restores the
 *     pre-batch name from in-graph state -- the repo never sees a real name.
 *
 * Every write routes through the 132-01 curation-batch runner (makeBatch) so it
 * inherits created_by stamping, the asserted rollback-by-created_by, the Part 8
 * no-user-content scan, and the write-time 130.7-contract guard on --execute.
 *
 * Default mode is --dry-run (creds-free, ZERO writes). Zero new deps. CJS only.
 * No em-dashes.
 */

const batchLib = require('../lib/brain/curation-batch.cjs');

const { makeBatch, assertRollbackPath, scanBatchForUserContent } = batchLib;

// The provenance scalar this batch stamps + the rollback selects on.
const BATCH_ID = 'phase-132-curation-batch-5';

// The public Larry-persona namesake node -- the one :Person with
// mindrian_internal:true that is NOT pseudonymized (it is wired AUTHORED to 7
// PWS framework variants and its public namesake must stay intact). Inlined as
// the documented EXCLUSION literal; this is a public persona, not a private
// internal-team member, so naming it here does not breach the hard rule.
const PUBLIC_PERSONA_EXCLUSION = 'Aronhime';

// The 6 stable opaque handles + their neutral pseudonyms. ZERO real names: the
// handles are positional (internal-person-1..6), the pseudonyms are neutral
// role-free placeholders. The handle ordinal pairs each matched in-graph node
// (ordered deterministically by elementId) with its pseudonym at execute time;
// the real-name -> pseudonym binding is purely in-graph, never in this repo.
const PSEUDONYM_HANDLES = Object.freeze([
  Object.freeze({ handle: 'internal-person-1', pseudonym: 'Internal Team Member One' }),
  Object.freeze({ handle: 'internal-person-2', pseudonym: 'Internal Team Member Two' }),
  Object.freeze({ handle: 'internal-person-3', pseudonym: 'Internal Team Member Three' }),
  Object.freeze({ handle: 'internal-person-4', pseudonym: 'Internal Team Member Four' }),
  Object.freeze({ handle: 'internal-person-5', pseudonym: 'Internal Team Member Five' }),
  Object.freeze({ handle: 'internal-person-6', pseudonym: 'Internal Team Member Six' }),
]);

// ---------------------------------------------------------------------------
// buildPseudonymizeBatch: the reversible, flag-matched, Part 8-clean batch.
// ---------------------------------------------------------------------------

/**
 * buildPseudonymizeBatch() -> a makeBatch batch.
 *
 * Builds one forward write per opaque handle. Each forward write:
 *   - MATCHes (p:Person {mindrian_internal:true}) EXCLUDING the Aronhime public
 *     persona, ordered deterministically (by elementId) so the handle ordinal
 *     maps the same in-graph node on every re-run (idempotent).
 *   - SETs p.name_pre_pseudonym = p.name BEFORE overwriting p.name (so rollback
 *     can restore the pre-batch name from in-graph state -- never from the repo).
 *   - SETs p.name = $pseudonym (a neutral placeholder, the only person-name
 *     string the repo binds).
 *   - SETs p.pseudonymized_by = $created_by (the rollback selector).
 *   - KEEPS mindrian_internal:true (it is the MATCH key; never removed/unset).
 * The paired rollback (audit Section 17 restore shape) restores name from
 * name_pre_pseudonym + REMOVEs the temp markers, by the pseudonymized_by selector.
 *
 * The match orders by elementId and applies a per-handle ordinal SKIP/LIMIT so a
 * single forward write touches exactly one of the 6 nodes; running all 6 forward
 * writes pseudonymizes all 6 deterministically.
 *
 * @returns {object} the makeBatch batch
 */
function buildPseudonymizeBatch() {
  const forward = [];
  const rollback = [];

  PSEUDONYM_HANDLES.forEach(function (entry, ordinal) {
    // Forward: store the pre-name, then overwrite with the pseudonym, keeping the
    // mindrian_internal flag and excluding the Aronhime public persona. The
    // ordinal SKIP/LIMIT over an elementId-ordered match makes the handle ->
    // node pairing deterministic and idempotent on re-run.
    forward.push({
      cypher:
        '// pseudonymize internal-team :Person node by the mindrian_internal flag\n' +
        '// (handle ' + entry.handle + '); the Aronhime public persona is excluded.\n' +
        'MATCH (p:Person {mindrian_internal: true})\n' +
        'WHERE p.name <> $public_persona AND coalesce(p.is_public_persona, false) = false\n' +
        '  AND p.pseudonymized_by IS NULL\n' +
        'WITH p ORDER BY elementId(p) SKIP $ordinal LIMIT 1\n' +
        'SET p.name_pre_pseudonym = p.name\n' +
        'SET p.name = $pseudonym\n' +
        'SET p.pseudonymized_by = $created_by\n' +
        'SET p.pseudonym_handle = $handle\n' +
        'RETURN $handle AS handle',
      params: {
        ordinal: ordinal,
        pseudonym: entry.pseudonym,
        handle: entry.handle,
        public_persona: PUBLIC_PERSONA_EXCLUSION,
        created_by: BATCH_ID,
      },
    });
    // Rollback: restore the pre-batch name + clear the temp markers, by selector.
    rollback.push({
      cypher:
        'MATCH (p:Person) WHERE p.pseudonymized_by = $created_by AND p.pseudonym_handle = $handle\n' +
        'SET p.name = p.name_pre_pseudonym\n' +
        'REMOVE p.name_pre_pseudonym, p.pseudonymized_by, p.pseudonym_handle',
      params: { created_by: BATCH_ID, handle: entry.handle },
    });
  });

  const batch = makeBatch({ batchId: BATCH_ID, forwardCyphers: forward, rollbackCyphers: rollback });
  // Prove the contracts at build time (fail loud, like 132-03).
  assertRollbackPath(batch);
  return batch;
}

// ---------------------------------------------------------------------------
// CLI: --dry-run (default, creds-free) / --execute (DEFERRED to v1.14.0).
// ---------------------------------------------------------------------------

function printDryRun() {
  process.stdout.write('Phase 132 Plan 05 -- pseudonymize 6 internal-team :Person nodes (DRY RUN)\n');
  process.stdout.write('RE-BASELINED: the LIVE write is DEFERRED to v1.14.0 (see deferred-items.md).\n');
  process.stdout.write('This dry-run prints the Cypher WITHOUT mutating. ZERO live Brain writes.\n\n');

  const batch = buildPseudonymizeBatch();
  const d = batch.dryRun();
  process.stdout.write('PSEUDONYMIZE batch ' + d.batchId + ': ' + d.summary.forward_count +
    ' forward / ' + d.summary.rollback_count + ' rollback writes (one per opaque handle)\n');
  process.stdout.write('  handles: ' + PSEUDONYM_HANDLES.map(function (h) { return h.handle; }).join(', ') + '\n');
  process.stdout.write('  match: (p:Person {mindrian_internal:true}) excluding ' +
    PUBLIC_PERSONA_EXCLUSION + ' (the public Larry-persona namesake)\n');
  process.stdout.write('  mindrian_internal:true is preserved (it is the MATCH key, never removed).\n\n');

  const v = scanBatchForUserContent(batch);
  process.stdout.write('Part 8 scan: ' + (v.length === 0 ? 'clean' : JSON.stringify(v)) + '\n');
}

function main() {
  const args = process.argv.slice(2);
  if (args.indexOf('--execute') !== -1 || args.indexOf('--rollback') !== -1) {
    process.stderr.write(
      'refusing --execute/--rollback: the live pseudonymize of the 6 internal-team :Person ' +
      'nodes is DEFERRED to v1.14.0 (Phase 132 deferred-items.md). This plan ships MACHINERY ' +
      'only; ZERO live Brain writes.\n'
    );
    process.exit(3);
  }
  printDryRun();
}

if (require.main === module) {
  main();
}

module.exports = {
  buildPseudonymizeBatch: buildPseudonymizeBatch,
  PSEUDONYM_HANDLES: PSEUDONYM_HANDLES,
  BATCH_ID: BATCH_ID,
  PUBLIC_PERSONA_EXCLUSION: PUBLIC_PERSONA_EXCLUSION,
};
