#!/usr/bin/env node
/**
 * causal-to-lazygraph.cjs -- SQLite Writer for Causal Extraction Results
 * =====================================================================
 * Reads .causal-extract.json and creates CausalClaim nodes + EXTRACTED_FROM edges.
 * Also creates CASCADES_TO edges from the cascades array (Phase 54).
 * Enforces Three Gaps quality (mechanism + falsifiable_prediction required),
 * max 5 claims per artifact, confidence by extraction method, domain validation.
 *
 * Usage: node scripts/causal-to-lazygraph.cjs /path/to/room
 *
 * Follows the open-use-close pattern established in Phase 15.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { openGraph, closeGraph, createCausalClaim, createExtractedFromEdge, createCascadesToEdge } = require('../lib/core/lazygraph-ops.cjs');

/** Valid domains for CausalClaim classification */
const VALID_DOMAINS = ['materials', 'business', 'competitive', 'financial', 'team', 'legal', 'general'];

/** Confidence score by extraction method (D-04) */
const CONFIDENCE_BY_METHOD = { observed: 0.7, asserted: 0.5, inferred: 0.3 };

/** Maximum claims per artifact (D-03) */
const MAX_CLAIMS = 5;

async function main() {
  const roomDir = process.argv[2];
  if (!roomDir) {
    process.stderr.write('Usage: node scripts/causal-to-lazygraph.cjs /path/to/room\n');
    process.exit(1);
  }

  const resolvedRoom = path.resolve(roomDir);
  const extractPath = path.join(resolvedRoom, '.causal-extract.json');

  // Exit silently if no extract file
  if (!fs.existsSync(extractPath)) {
    process.exit(0);
  }

  // Read and parse
  let data;
  try {
    const raw = fs.readFileSync(extractPath, 'utf-8');
    data = JSON.parse(raw);
  } catch (e) {
    // Malformed or empty -- exit silently
    process.exit(0);
  }

  if (!data || !Array.isArray(data.claims) || data.claims.length === 0) {
    process.exit(0);
  }

  const sourceArtifact = data.source_artifact || '';
  const extractedAt = data.extracted_at || '';

  let db;
  try {
    const graph = await openGraph(resolvedRoom);
    db = graph.db;
    const conn = graph.conn;

    let written = 0;

    for (const claim of data.claims) {
      // Enforce max claims (D-03, EXTRACT-05)
      if (written >= MAX_CLAIMS) {
        process.stderr.write(`Causal: max ${MAX_CLAIMS} claims reached, skipping remaining\n`);
        break;
      }

      // Three Gaps enforcement: mechanism + falsifiable_prediction required (D-02, EXTRACT-06)
      if (!claim.mechanism || claim.mechanism.trim() === '') {
        process.stderr.write(`Causal: skipping claim ${claim.id || '?'} -- missing mechanism\n`);
        continue;
      }
      if (!claim.falsifiable_prediction || claim.falsifiable_prediction.trim() === '') {
        process.stderr.write(`Causal: skipping claim ${claim.id || '?'} -- missing falsifiable_prediction\n`);
        continue;
      }

      // Set confidence by extraction method (D-04, EXTRACT-03)
      const method = claim.extraction_method || 'inferred';
      const confidence = CONFIDENCE_BY_METHOD[method] !== undefined ? CONFIDENCE_BY_METHOD[method] : 0.3;

      // Validate domain (EXTRACT-04)
      const domain = VALID_DOMAINS.includes(claim.domain) ? claim.domain : 'general';

      // Build claim object
      const claimObj = {
        id: claim.id || `causal-${Date.now()}-${written}`,
        cause: claim.cause || '',
        mechanism: claim.mechanism || '',
        effect: claim.effect || '',
        confidence,
        evidence: Array.isArray(claim.evidence) ? JSON.stringify(claim.evidence) : (claim.evidence || '[]'),
        source_artifact: claim.source_artifact || sourceArtifact,
        domain,
        falsifiable_prediction: claim.falsifiable_prediction || '',
        novelty_score: typeof claim.novelty_score === 'number' ? claim.novelty_score : 0.0,
        extraction_method: method,
        created: extractedAt,
      };

      await createCausalClaim(conn, claimObj);

      // Create provenance edge
      const artifactId = claim.source_artifact || sourceArtifact;
      if (artifactId) {
        try {
          await createExtractedFromEdge(conn, claimObj.id, artifactId);
        } catch (e) {
          // Artifact node may not exist -- skip edge silently
        }
      }

      written++;
    }

    process.stderr.write(`Wrote ${written} causal claims from ${sourceArtifact} to KuzuDB\n`);

    // --- Phase 54: Create CASCADES_TO edges from cascades array ---
    if (Array.isArray(data.cascades) && data.cascades.length > 0) {
      let cascadeWritten = 0;
      for (const cascade of data.cascades) {
        if (!cascade.from_claim_id || !cascade.to_claim_id) {
          continue;
        }
        try {
          await createCascadesToEdge(conn, cascade.from_claim_id, cascade.to_claim_id, {
            cascade_type: cascade.cascade_type || 'invalidation',
            severity: cascade.severity || 'medium',
          });
          cascadeWritten++;
        } catch (e) {
          // One or both claim nodes may not exist -- skip silently
          process.stderr.write(`Causal: cascade edge ${cascade.from_claim_id}->${cascade.to_claim_id} skipped: ${e.message}\n`);
        }
      }
      process.stderr.write(`Wrote ${cascadeWritten} CASCADES_TO edges to KuzuDB\n`);
    }

  } catch (e) {
    process.stderr.write(`Causal-to-KuzuDB error: ${e.message}\n`);
    process.exit(1);
  } finally {
    if (db) {
      try {
        await closeGraph(db);
      } catch (e) {
        // Ignore close errors (KuzuDB segfault on exit is known)
      }
    }
  }
}

main();
