'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 260806-grant-grader-room-graph -- the grant-rubric graph writers:
 * the criteria/room_section map as REAL typed graph structure in room.db, not
 * JSON-fixture-only prose (the navigator's "schematically as a local graph"
 * ask). Lives in lib/core/navigation/ because raw node INSERTs are
 * substrate-banned outside this allow-listed directory
 * (scripts/check-substrate.cjs ALLOWED_DIRECT_IMPORT); re-exported on
 * navigation.cjs per the standing thin-additive-re-export idiom, so
 * lib/core/eureka/grade-grant.cjs's host command reaches these writers through
 * the single chokepoint door only.
 *
 * Two writers, both (db, params) over a CALLER-OWNED room.db handle (this
 * module NEVER opens room.db itself; Canon Part 9 chokepoint discipline,
 * the same contract as edges.cjs / node-insert.cjs):
 *
 *   writeGrantRubricGraph(db, rubric) -- the STATIC rubric map. One
 *     grant_criterion anchor node per criterion + one MAPS_TO_SECTION edge per
 *     criterion with a non-null room_section, targeting the standard Section
 *     nodes room-birth.cjs writeSectionNodes mints at birth (re-ensured here
 *     idempotently for pre-Section-node rooms). Criterion anchors are
 *     SYSTEM-BOOKKEEPING structural nodes (Part 9 v1.5 audit-node carve-out:
 *     they assert rubric structure, not a venture truth-claim -- the same
 *     class as Section / Room / birth_gate_anchor nodes), so
 *     created_by=system review_status=confirmed is canon-legal. Idempotent:
 *     insertNode upserts on id; writeEdge upserts on (source, target, type).
 *
 *   writeGradingSectionEdges(db, params) -- the PER-RUN coverage profile. One
 *     verdict -> Section INFORMS edge per mapped section carrying scalar
 *     counts only ({relation:'grant_gap_profile', program_id, total,
 *     evidenced, asserted, absent}). AGGREGATED per section deliberately
 *     (quick 260806 PLAN.md D2): the edges PK is (source, target, type), so
 *     per-criterion verdict->section edges for the three financial-model
 *     criteria would silently collapse into one row -- the aggregate IS the
 *     honest representable shape. INFORMS is a pre-existing allow-list member
 *     (the generic finding-informs-target cascade edge); no second new type is
 *     minted.
 *
 * Canon Part 8: everything here is LOCAL room.db writes. Edge/node properties
 *   are ENUM/scalar ONLY (slugs, closed-enum categories, counts); the
 *   criterion's details / common_mistake prose stays in the LOCAL fixture
 *   JSON and NEVER lands on a node or edge property, and NOTHING here crosses
 *   to Brain. The Brain-facing STRUCTURAL signal is composed separately (and
 *   purely) by grade-grant.cjs askBrainForStrategy from the verdict, not read
 *   back off these edges.
 *
 * All writers return { ok, ... } and NEVER throw.
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const { insertNode } = require('../node-insert.cjs');
const edges = require('./edges.cjs');
const roomBirth = require('./room-birth.cjs');

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.length > 0;
}

// The standard section slugs (single source of truth: room-birth.cjs).
const SECTION_SLUGS = new Set(roomBirth.SECTION_NAMES);

function criterionNodeId(programId, criterionId) {
  return 'grant_criterion:' + programId + ':' + criterionId;
}

/**
 * writeGrantRubricGraph(db, rubric) -- mint the rubric's room_section map as
 * typed graph structure. rubric is the validated shape loadRubric returns
 * (id + criteria[] with room_section). Returns
 * { ok, criteria_nodes, edges_written, sections_ensured } or
 * { ok:false, reason }. Idempotent; never throws.
 */
function writeGrantRubricGraph(db, rubric) {
  try {
    if (!db || !isPlainObject(rubric) || !isNonEmptyString(rubric.id)
      || !Array.isArray(rubric.criteria)) {
      return { ok: false, reason: 'invalid_params' };
    }
    // Ensure the referenced Section anchor nodes exist (idempotent re-ensure
    // for rooms born before Phase 162's Section nodes, and for bare test dbs).
    const referenced = [];
    for (const c of rubric.criteria) {
      if (isPlainObject(c) && SECTION_SLUGS.has(c.room_section)
        && referenced.indexOf(c.room_section) === -1) {
        referenced.push(c.room_section);
      }
    }
    const sectionsEnsured = roomBirth.writeSectionNodes(db, referenced);

    let criteriaNodes = 0;
    let edgesWritten = 0;
    for (const c of rubric.criteria) {
      if (!isPlainObject(c) || !isNonEmptyString(c.id)) continue;
      const nodeId = criterionNodeId(rubric.id, c.id);
      // ENUM/scalar props only (Part 8 discipline): slugs + closed enums, never
      // the details/common_mistake prose.
      const props = JSON.stringify({
        program: rubric.id,
        criterion: c.id,
        category: isNonEmptyString(c.category) ? c.category : 'unknown',
        room_section: SECTION_SLUGS.has(c.room_section) ? c.room_section : null,
        created_by: 'system',
      });
      try {
        insertNode(db, nodeId, 'grant_criterion', props, {
          source_path: 'system:grant-rubric:' + rubric.id,
          created_by: 'system',
          // R17-02: 'observation' -- system-bookkeeping reference data (a
          // rubric criterion definition), not a truth-claim.
          epistemic_type: 'observation',
        });
        // System-bookkeeping promote (the writeSectionNodes idiom): tolerated
        // as a no-op on the un-migrated 3-column schema.
        try {
          db.prepare("UPDATE nodes SET review_status = 'confirmed' WHERE id = ? AND type = 'grant_criterion'").run(nodeId);
        } catch (_e) {
          // Un-migrated schema has no review_status column; tolerate.
        }
        criteriaNodes += 1;
      } catch (_e) {
        // Tolerate a single-node insert failure; the rest still write.
        continue;
      }
      if (SECTION_SLUGS.has(c.room_section)) {
        const written = edges.writeEdge(db, {
          source_id: nodeId,
          target_id: c.room_section,
          edge_type: 'MAPS_TO_SECTION',
          properties: {
            relation: 'rubric_map',
            program: rubric.id,
            category: isNonEmptyString(c.category) ? c.category : 'unknown',
          },
        });
        if (written && written.ok === true) edgesWritten += 1;
      }
    }
    return {
      ok: true,
      criteria_nodes: criteriaNodes,
      edges_written: edgesWritten,
      sections_ensured: sectionsEnsured,
    };
  } catch (e) {
    return { ok: false, reason: 'rubric_graph_threw', detail: String(e && e.message || '').slice(0, 80) };
  }
}

/**
 * writeGradingSectionEdges(db, params) -- mint the per-run coverage profile.
 * params = { verdict_node_id, verdict, rubric }: verdict_node_id is the claim
 * node writeGradingResult minted; verdict is the scoreApplication result
 * (per_criterion rows); rubric supplies the room_section map. One INFORMS edge
 * per mapped section, scalar counts only. Returns { ok, edges_written,
 * sections } or { ok:false, reason }. Idempotent per (verdict, section);
 * never throws.
 */
function writeGradingSectionEdges(db, params) {
  try {
    if (!db || !isPlainObject(params) || !isNonEmptyString(params.verdict_node_id)
      || !isPlainObject(params.verdict) || !Array.isArray(params.verdict.per_criterion)
      || !isPlainObject(params.rubric) || !Array.isArray(params.rubric.criteria)) {
      return { ok: false, reason: 'invalid_params' };
    }
    const verdict = params.verdict;
    const rubric = params.rubric;
    const statusById = {};
    for (const row of verdict.per_criterion) {
      if (isPlainObject(row) && isNonEmptyString(row.criterion_id)) {
        statusById[row.criterion_id] = row.status;
      }
    }
    // Aggregate per mapped section (D2: the PK-honest shape).
    const profile = {};
    for (const c of rubric.criteria) {
      if (!isPlainObject(c) || !isNonEmptyString(c.id) || !SECTION_SLUGS.has(c.room_section)) continue;
      if (!profile[c.room_section]) {
        profile[c.room_section] = { total: 0, evidenced: 0, asserted: 0, absent: 0 };
      }
      const p = profile[c.room_section];
      p.total += 1;
      const status = statusById[c.id];
      if (status === 'evidenced') p.evidenced += 1;
      else if (status === 'asserted') p.asserted += 1;
      else p.absent += 1;
    }
    const sections = Object.keys(profile).sort();
    let edgesWritten = 0;
    for (const slug of sections) {
      const p = profile[slug];
      const written = edges.writeEdge(db, {
        source_id: params.verdict_node_id,
        target_id: slug,
        edge_type: 'INFORMS',
        properties: {
          relation: 'grant_gap_profile',
          program_id: isNonEmptyString(verdict.program_id) ? verdict.program_id : 'unknown',
          total: p.total,
          evidenced: p.evidenced,
          asserted: p.asserted,
          absent: p.absent,
        },
      });
      if (written && written.ok === true) edgesWritten += 1;
    }
    return { ok: true, edges_written: edgesWritten, sections: sections };
  } catch (e) {
    return { ok: false, reason: 'section_edges_threw', detail: String(e && e.message || '').slice(0, 80) };
  }
}

module.exports = { writeGrantRubricGraph, writeGradingSectionEdges, criterionNodeId };
