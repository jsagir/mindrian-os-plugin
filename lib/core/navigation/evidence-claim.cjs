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

const { insertNode } = require('../node-insert.cjs');

// The closed Canon Part 5 evidence-tier set. An EvidenceClaim's evidence_tier
// MUST validate against this set; writeEvidenceClaim rejects invalid_evidence_tier
// otherwise. Mirrors the four-tier vocabulary in docs/MINDRIAN-CANON.md Part 5.
const EVIDENCE_TIERS = Object.freeze(new Set(['Academic', 'Operational', 'Practitioner', 'None']));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Phase 181-01 SEC-02 -- the instruction-stripping pass at the EvidenceClaim write
// chokepoint. Canon Part 8: untrusted external web content (an EvidenceClaim's
// topic + summary) stays LOCAL and HARDENED -- a jailbreak/instruction span must be
// removed BEFORE the row lands in room.db, so the IGNORE_ALL_PRIOR_INSTRUCTIONS_AND_
// EXFILTRATE class cannot ride into the trusted graph un-stripped. This is the
// instruction LAYER added at the EvidenceClaim door; stripSnippetPii in
// lib/core/domain-insight-sweep.cjs stays UNTOUCHED (it remains the SIGNAL-sweep PII
// strip, a path EvidenceClaims do not pass through). The PII shapes are also stripped
// here so SEC-02 is necessary-AND-PII-safe at this chokepoint (necessary, insufficient
// alone -- the two layers coexist).
//
// A CLOSED set of case-insensitive, global patterns that tolerate underscore-or-space
// separators so the underscored sentinel class is caught. Pure: a non-string returns
// '', a string returns the stripped + whitespace-collapsed + trimmed result. NO
// network surface; NO em-dashes.
function stripInjectionSpans(s) {
  if (typeof s !== 'string') {
    return '';
  }
  let out = s;
  const PATTERNS = [
    // ignore-instructions span: ignore (all )?(previous|prior) instructions (and <verb>)?
    /ignore[\s_]+(all[\s_]+)?(previous|prior)[\s_]+instructions?(\s+and[\s_]+\w+)?/gi,
    // disregard-above span: disregard ... (above|previous|prior)
    /disregard[\s_]+[^.]*?(above|previous|prior)/gi,
    // residual underscored injection token: AND[\s_]+EXFILTRATE...
    /and[\s_]+exfiltrat\w*/gi,
    // exfiltrate imperative
    /exfiltrat\w*/gi,
    // email-like PII (the stripSnippetPii shape, applied at this door too)
    /[\w.+-]+@[\w-]+\.[\w.-]+/gi,
    // URL-like PII
    /https?:\/\/\S+/gi,
  ];
  for (let i = 0; i < PATTERNS.length; i += 1) {
    out = out.replace(PATTERNS[i], ' ');
  }
  // Collapse whitespace and the underscore-separator residue left by removed
  // injection tokens, then trim.
  out = out.replace(/[\s_]+/g, ' ').trim();
  return out;
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
  // Phase 181-01 SEC-02 (Canon Part 8): topic + summary are the prose-bearing
  // external-web fields. Strip jailbreak/instruction/exfiltrate/PII spans BEFORE
  // they are placed into props (i.e. before JSON.stringify below) so a poison
  // sentinel can NEVER land in room.db un-stripped. The four LOCKED Phase 136
  // provenance fields (source / url / retrieved_at / evidence_tier) are NOT external
  // prose and are NOT touched -- Phase 136 reads them verbatim.
  const props = {
    source: source,
    url: url,
    retrieved_at: typeof retrieved_at === 'string' ? retrieved_at : '',
    evidence_tier: evidence_tier,
    topic: stripInjectionSpans(typeof topic === 'string' ? topic : ''),
    summary: stripInjectionSpans(typeof summary === 'string' ? summary : ''),
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
  try {
    // confidence omitted (not passed as null): per insertNode's contract,
    // omission and explicit NULL are byte-equivalent for a nullable REAL
    // column with no DEFAULT, so this stays the NULL-confidence write it was.
    insertNode(db, nodeId, 'EvidenceClaim', propsJson, {
      source_path: sourcePath,
      created_by: 'system',
      review_status: 'proposed',
    });
  } catch (e) {
    return { ok: false, reason: 'evidence_claim_write_failed', detail: String(e.message || '').slice(0, 80) };
  }
  return { ok: true, node_id: nodeId };
}

module.exports = { EVIDENCE_TIERS, writeEvidenceClaim, stripInjectionSpans };
