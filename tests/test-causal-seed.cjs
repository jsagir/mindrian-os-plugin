#!/usr/bin/env node
/**
 * test-causal-seed.cjs -- Populate a test room with CausalClaim graph data
 * =========================================================================
 * Creates 6 CausalClaim nodes, 5 CASCADES_TO edges (including an intentional cycle),
 * 6 EXTRACTED_FROM edges, plus cross-reference test fixtures (HSI, RS, Analogy).
 * Then calls exportCausalGraph() to write .lazygraph-causal-export.json.
 *
 * Usage: node tests/test-causal-seed.cjs /path/to/test-room
 *
 * Graph topology:
 *   Chain:    A -> B -> C  (plus A -> C shortcut)
 *   Cycle:    D -> E -> D  (intentional circular reasoning)
 *   Isolated: F            (no CASCADES_TO edges)
 *
 * Claim IDs: claim-001 through claim-006
 * Artifact IDs: artifact-problem-pain, artifact-solution-coating, artifact-market-size,
 *               artifact-team-lead, artifact-financial-model, artifact-competitor-analysis
 * Section names: problem-definition, solution-design, market-analysis, financial-model
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  openGraph,
  closeGraph,
  initSchema,
  createCausalClaim,
  createExtractedFromEdge,
  createCascadesToEdge,
  exportCausalGraph,
  queryGraph,
} = require('../lib/core/lazygraph-ops.cjs');

// --- Test Data Definitions ---

const CLAIMS = [
  {
    id: 'claim-001',
    cause: 'Etch chamber downtime costs $2-5M/year per fab',
    mechanism: 'Qualification timelines create switching costs that lock in incumbent suppliers',
    effect: 'Semiconductor fabs adopt plasma-enhanced coatings to reduce downtime',
    confidence: 0.7,
    evidence: '["industry-report-2025"]',
    source_artifact: 'problem-definition/market-pain',
    domain: 'materials',
    falsifiable_prediction: 'Fabs with >$3M downtime costs will adopt within 18 months of qualification',
    novelty_score: 0.3,
    extraction_method: 'observed',
    created: '2026-04-01',
  },
  {
    id: 'claim-002',
    cause: 'Plasma-enhanced coatings extend chamber life by 3x',
    mechanism: 'Ceramic nanocomposite bonds resist fluorine plasma erosion at molecular level',
    effect: 'Maintenance intervals increase from 500 to 1500 wafer-hours',
    confidence: 0.8,
    evidence: '["lab-test-batch-7"]',
    source_artifact: 'solution-design/coating-tech',
    domain: 'materials',
    falsifiable_prediction: '1500 wafer-hour lifetime achievable in production environment',
    novelty_score: 0.6,
    extraction_method: 'observed',
    created: '2026-04-01',
  },
  {
    id: 'claim-003',
    cause: 'Extended chamber life reduces total cost of ownership',
    mechanism: 'Fewer replacements + less downtime = lower annualized cost per wafer',
    effect: 'Fabs realize 40% reduction in chamber-related expenses',
    confidence: 0.5,
    evidence: '["financial-model-v2"]',
    source_artifact: 'financial-model/unit-economics',
    domain: 'financial',
    falsifiable_prediction: '40% cost reduction measurable within first year of deployment',
    novelty_score: 0.2,
    extraction_method: 'asserted',
    created: '2026-04-01',
  },
  {
    id: 'claim-004',
    cause: 'Competitor X holds 60% market share in etch chamber coatings',
    mechanism: 'First-mover advantage + long qualification cycles create switching barriers',
    effect: 'New entrants must demonstrate 2x performance improvement to justify switching cost',
    confidence: 0.6,
    evidence: '["market-report-q4"]',
    source_artifact: 'market-analysis/competitive-landscape',
    domain: 'competitive',
    falsifiable_prediction: 'Market share will shift >10% within 24 months if 2x performance proven',
    novelty_score: 0.1,
    extraction_method: 'inferred',
    created: '2026-04-01',
  },
  {
    id: 'claim-005',
    cause: 'New entrants demonstrating 2x performance gain can capture market share',
    mechanism: 'Qualification data breaks switching inertia when ROI exceeds switching cost',
    effect: 'Competitor X loses 15% share within 3 years of new entrant qualification',
    confidence: 0.4,
    evidence: '["analog-market-study"]',
    source_artifact: 'market-analysis/competitive-landscape',
    domain: 'competitive',
    falsifiable_prediction: '15% share shift observable in semiconductor coatings market by 2029',
    novelty_score: 0.4,
    extraction_method: 'inferred',
    created: '2026-04-01',
  },
  {
    id: 'claim-006',
    cause: 'Team lacks semiconductor industry sales experience',
    mechanism: 'No existing relationships with fab procurement departments',
    effect: 'Sales cycle will be 18+ months instead of typical 6-9 months',
    confidence: 0.5,
    evidence: '["team-assessment"]',
    source_artifact: 'problem-definition/market-pain',
    domain: 'team',
    falsifiable_prediction: 'First qualified sale will take >12 months from initial contact',
    novelty_score: 0.0,
    extraction_method: 'asserted',
    created: '2026-04-01',
  },
];

const CASCADES = [
  // Chain: A -> B -> C
  { from: 'claim-001', to: 'claim-002', cascade_type: 'dependency', severity: 'high' },
  { from: 'claim-002', to: 'claim-003', cascade_type: 'dependency', severity: 'high' },
  // Shortcut: A -> C
  { from: 'claim-001', to: 'claim-003', cascade_type: 'invalidation', severity: 'medium' },
  // Cycle: D -> E -> D (intentional circular reasoning)
  { from: 'claim-004', to: 'claim-005', cascade_type: 'weakening', severity: 'medium' },
  { from: 'claim-005', to: 'claim-004', cascade_type: 'weakening', severity: 'low' },
];

const ARTIFACTS = [
  { id: 'problem-definition/market-pain', title: 'Market Pain Analysis', section: 'problem-definition' },
  { id: 'solution-design/coating-tech', title: 'Coating Technology', section: 'solution-design' },
  { id: 'market-analysis/competitive-landscape', title: 'Competitive Landscape', section: 'market-analysis' },
  { id: 'financial-model/unit-economics', title: 'Unit Economics', section: 'financial-model' },
  { id: 'problem-definition/team-assessment', title: 'Team Assessment', section: 'problem-definition' },
  { id: 'market-analysis/market-size', title: 'Market Size', section: 'market-analysis' },
];

const SECTIONS = [
  { name: 'problem-definition', label: 'PROBLEM DEFINITION' },
  { name: 'solution-design', label: 'SOLUTION DESIGN' },
  { name: 'market-analysis', label: 'MARKET ANALYSIS' },
  { name: 'financial-model', label: 'FINANCIAL MODEL' },
];

async function main() {
  const roomDir = process.argv[2];
  if (!roomDir) {
    process.stderr.write('Usage: node tests/test-causal-seed.cjs /path/to/test-room\n');
    process.exit(1);
  }

  const resolved = path.resolve(roomDir);

  // Create room and .lazygraph directories if needed
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }

  let db;
  try {
    const graph = await openGraph(resolved);
    db = graph.db;
    const conn = graph.conn;

    // 1. Create Section nodes
    for (const sec of SECTIONS) {
      await conn.query(
        `MERGE (s:Section {name: '${sec.name}'}) ON CREATE SET s.label = '${sec.label}'`
      );
    }
    process.stderr.write(`Created ${SECTIONS.length} Section nodes\n`);

    // 2. Create Artifact nodes + BELONGS_TO edges
    for (const art of ARTIFACTS) {
      await conn.query(
        `MERGE (a:Artifact {id: '${art.id}'}) ON CREATE SET a.title = '${art.title}', a.section = '${art.section}', a.content_hash = 'test'`
      );
      await conn.query(
        `MATCH (a:Artifact {id: '${art.id}'}), (s:Section {name: '${art.section}'}) MERGE (a)-[:BELONGS_TO]->(s)`
      );
    }
    process.stderr.write(`Created ${ARTIFACTS.length} Artifact nodes\n`);

    // 3. Create CausalClaim nodes
    for (const claim of CLAIMS) {
      await createCausalClaim(conn, claim);
    }
    process.stderr.write(`Created ${CLAIMS.length} CausalClaim nodes\n`);

    // 4. Create EXTRACTED_FROM edges (claim -> artifact)
    for (const claim of CLAIMS) {
      if (claim.source_artifact) {
        await createExtractedFromEdge(conn, claim.id, claim.source_artifact);
      }
    }
    process.stderr.write(`Created ${CLAIMS.length} EXTRACTED_FROM edges\n`);

    // 5. Create CASCADES_TO edges
    for (const cascade of CASCADES) {
      await createCascadesToEdge(conn, cascade.from, cascade.to, {
        cascade_type: cascade.cascade_type,
        severity: cascade.severity,
      });
    }
    process.stderr.write(`Created ${CASCADES.length} CASCADES_TO edges\n`);

    // 6. Create cross-reference test fixtures

    // HSI_CONNECTION between two artifacts (for ENGINE-05 testing)
    await conn.query(
      `MATCH (a:Artifact {id: 'problem-definition/market-pain'}), (b:Artifact {id: 'solution-design/coating-tech'})
       MERGE (a)-[r:HSI_CONNECTION]->(b)
       ON CREATE SET r.hsi_score = 0.42, r.surprise_type = 'cross-section', r.breakthrough_potential = 0.7`
    );
    process.stderr.write(`Created 1 HSI_CONNECTION edge (cross-ref fixture)\n`);

    // REVERSE_SALIENT between two sections (for ENGINE-06 testing)
    await conn.query(
      `MATCH (s1:Section {name: 'problem-definition'}), (s2:Section {name: 'solution-design'})
       MERGE (s1)-[r:REVERSE_SALIENT]->(s2)
       ON CREATE SET r.differential_score = 0.65, r.innovation_thesis = 'Problem outpaces solution maturity'`
    );
    process.stderr.write(`Created 1 REVERSE_SALIENT edge (cross-ref fixture)\n`);

    // ANALOGOUS_TO between two artifacts (for ENGINE-07 testing)
    await conn.query(
      `MATCH (a:Artifact {id: 'market-analysis/competitive-landscape'}), (b:Artifact {id: 'market-analysis/market-size'})
       MERGE (a)-[r:ANALOGOUS_TO]->(b)
       ON CREATE SET r.analogy_distance = 'near', r.structural_fitness = 0.55`
    );
    process.stderr.write(`Created 1 ANALOGOUS_TO edge (cross-ref fixture)\n`);

    // 7. Export causal graph
    process.stderr.write('Exporting causal graph...\n');

  } catch (e) {
    process.stderr.write(`Seed error: ${e.message}\n`);
    process.exit(1);
  } finally {
    if (db) {
      try {
        await closeGraph(db);
      } catch (e) {
        // Ignore close errors
      }
    }
  }

  // Export in a separate open-close cycle (exportCausalGraph manages its own connection)
  try {
    const result = await exportCausalGraph(resolved);
    process.stderr.write(`Exported: ${result.metadata.node_count} nodes, ${result.metadata.edge_count} edges\n`);
    process.stderr.write(`Written to: ${path.join(resolved, '.lazygraph-causal-export.json')}\n`);
  } catch (e) {
    process.stderr.write(`Export error: ${e.message}\n`);
    process.exit(1);
  }
}

main();
