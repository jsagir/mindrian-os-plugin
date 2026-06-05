'use strict';
/*
 * Phase 131-01 -- evidence-claim: the typed EvidenceClaim node-write chokepoint
 * for the source-lens research pipeline (Stage 7 ACCEPT path). This is the LOCKED
 * Phase 136 forward-contract node schema: a research finding becomes a typed
 * truth-claim node so Phase 136's detail-pane dual-render and getConfirmedFacts
 * read consume it WITHOUT a migration.
 *
 * This module is an allow-listed navigation submodule (scripts/check-substrate.cjs
 * regex /^lib\/core\/navigation\// covers it). It takes a db handle owned by the
 * caller (via lib/core/room-db.cjs openRoomDb) EXACTLY like
 * lib/core/navigation/lens-nodes.cjs writeLensFinding and edges.cjs writeEdge: it
 * NEVER requires node:sqlite and NEVER opens room.db itself, so it stays inside
 * the navigation allow-list with zero substrate bypass. The caller-owned handle
 * lets the Plan 04 wirer batch an EvidenceClaim node write and its INFORMS /
 * CONTRADICTS / SUPERSEDES cascade edge on a single handle.
 *
 * Exports:
 *   writeEvidenceClaim(db, params) -> { ok, node_id } | { ok:false, reason }
 *
 * Canon Part 9 role 5 (the human gate): an EvidenceClaim is a TRUTH-CLAIM node --
 *   it asserts something about the venture's world. So it lands review_status
 *   'proposed' and is NEVER auto-confirmed by an agent. Promotion to 'confirmed'
 *   requires a human APPROVE at a Decision Gate (the Plan 04 wirer routes that
 *   through navigation.confirmNode). This is the deliberate contrast with the
 *   system-bookkeeping HatState node (lens-nodes.cjs), which the Part 9 v1.5
 *   audit-node carve-out lets land 'confirmed' without a human; an EvidenceClaim
 *   is NOT carved out -- it is a real truth claim.
 *
 * Canon Part 5: an EvidenceClaim carries a graded evidence_tier from the closed
 *   {Academic, Operational, Practitioner, None} set; an invalid tier is rejected.
 *
 * Canon Part 8: zero network surface. Pure LOCAL SQLite over a caller-owned
 *   handle. No Brain calls; no user content ever leaves the room.
 *
 * Forward contracts (LOCKED 2026-06-01) -- consumed by Phase 136: the four
 *   provenance fields source / url / retrieved_at / evidence_tier are the locked
 *   schema. Phase 136's detail-pane dual-render and getConfirmedFacts read EXACTLY
 *   these fields. Do NOT rename or drop any of the four without a Phase 136
 *   migration.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

// The closed Canon Part 5 evidence-tier set. An EvidenceClaim's evidence_tier
// MUST validate against this set; writeEvidenceClaim rejects invalid_evidence_tier
// otherwise. Mirrors the four-tier vocabulary in docs/MINDRIAN-CANON.md Part 5.
const EVIDENCE_TIERS = Object.freeze(new Set(['Academic', 'Operational', 'Practitioner', 'None']));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// writeEvidenceClaim(db, params) -- UPSERT a typed EvidenceClaim node.
//
// params = { topic, source, url, retrieved_at, evidence_tier, summary, sessionId }.
// Node id 'EvidenceClaim:'+sessionId+':'+sha-of(url) so the same source URL in the
// same session is idempotent. type 'EvidenceClaim', created_by 'system',
// review_status 'proposed' (a TRUTH-CLAIM node per Canon Part 9 role 5 -- never
// auto-confirmed; promotion is the Plan 04 human gate), confidence NULL,
// created_at / last_seen_at = Date.now(), properties = the LOCKED schema
// { source, url, retrieved_at, evidence_tier, topic, summary }. The INSERT shape
// mirrors lens-nodes.cjs writeLensFinding verbatim (full provenance columns).
// Defensive: never throws on caller input; returns { ok:false, reason } on failure.
function writeEvidenceClaim(db, params) {
  if (!isPlainObject(params)) {
    return { ok: false, reason: 'invalid_params' };
  }
  const { topic, source, url, retrieved_at, evidence_tier, summary, sessionId, artifact_path } = params;
  if (typeof url !== 'string' || url.length === 0) {
    return { ok: false, reason: 'invalid_url' };
  }
  if (typeof source !== 'string' || source.length === 0) {
    return { ok: false, reason: 'invalid_source' };
  }
  if (typeof evidence_tier !== 'string' || !EVIDENCE_TIERS.has(evidence_tier)) {
    return { ok: false, reason: 'invalid_evidence_tier', detail: String(evidence_tier).slice(0, 40) };
  }
  // The LOCKED Phase 136 forward-contract schema. The four provenance fields
  // (source / url / retrieved_at / evidence_tier) are named here so a future
  // reader sees the contract; topic + summary are the human-facing finding body.
  const props = {
    source: source,
    url: url,
    retrieved_at: typeof retrieved_at === 'string' ? retrieved_at : '',
    evidence_tier: evidence_tier,
    topic: typeof topic === 'string' ? topic : '',
    summary: typeof summary === 'string' ? summary : '',
  };
  // D-10 (Phase 141 FILEVAL-02): artifact_path is a PURELY ADDITIVE optional
  // provenance key inside this same properties JSON blob. NO column migration
  // (properties is already TEXT). It reserves the nested-fractal-artifact path
  // template <section>/<research-topic-slug>/<research-topic-slug>.md for the
  // deferred Phase 143 MEMDIAL render-from-graph projection (D-09). It NEVER
  // renames or drops the 4 LOCKED Phase 136 provenance fields above (source /
  // url / retrieved_at / evidence_tier). Only set when the caller supplies it,
  // so the locked schema is byte-identical when artifact_path is absent.
  if (typeof artifact_path === 'string' && artifact_path.length > 0) {
    props.artifact_path = artifact_path;
  }
  let propsJson;
  try {
    propsJson = JSON.stringify(props);
  } catch (_e) {
    return { ok: false, reason: 'properties_serialize_failed' };
  }
  // Idempotency key off the source URL: re-filing the same URL in the same session
  // UPSERTs rather than duplicating. A crypto-free, dependency-free stable hash
  // over the url string keeps the node id bounded (no new npm dep; native only).
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : 'nosession';
  let urlHash = 0;
  for (let i = 0; i < url.length; i += 1) {
    urlHash = (urlHash * 31 + url.charCodeAt(i)) >>> 0;
  }
  const nodeId = 'EvidenceClaim:' + sid + ':' + urlHash.toString(16);
  const sourcePath = 'research:' + source + ':' + sid;
  const nowMs = Date.now();
  try {
    db.prepare(
      'INSERT INTO nodes ' +
      '(id, type, properties, source_path, created_by, confidence, review_status, created_at, last_seen_at) ' +
      "VALUES (?, 'EvidenceClaim', ?, ?, 'system', NULL, 'proposed', ?, ?) " +
      'ON CONFLICT(id) DO UPDATE SET ' +
      'properties = excluded.properties, last_seen_at = excluded.last_seen_at'
    ).run(nodeId, propsJson, sourcePath, nowMs, nowMs);
  } catch (e) {
    return { ok: false, reason: 'evidence_claim_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: nodeId };
}

module.exports = { EVIDENCE_TIERS, writeEvidenceClaim };
