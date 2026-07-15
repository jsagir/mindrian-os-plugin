'use strict';
/*
 * Phase 223-02 -- close-loop-writer: the ONE close-the-loop graph-write spine
 * BOTH surfaces (Plan 03 bono, Plan 04 intel-pipeline) terminate through
 * (Req 4, BUILD-BRIEF Section 6 contract). Without this module neither surface
 * can close the loop, and Req 4's acceptance (BOTH stores, G-3) cannot pass.
 *
 * THE D-01 WRITE-ORDERING DECISION (locked, implemented verbatim in intent):
 *   Every opportunity is a DUAL write. The bank .md is written FIRST via the
 *   shipped opportunity-ops writer, the room.db opportunity node SECOND, and ONE
 *   shared artifact_id is minted BEFORE either write and embedded in BOTH stores.
 *   So a mid-crash between the two writes leaves a BANK-VISIBLE artifact (the
 *   .md on disk) and NEVER a dangling room.db node. The crash-ordering test leg
 *   (test-223-close-loop.cjs behavior 3) proves it: an injected node-writer that
 *   throws after the .md write leaves the .md on disk and zero opportunity nodes.
 *
 * Canon Part 9 (the chokepoint): EVERY node and edge write routes through
 *   navigation.cjs (writeClaimNode / writeOpportunityNode / writeOpenQuestionNode
 *   / writeEdge). This module issues NO raw INSERT INTO nodes|edges and never
 *   opens room.db itself -- the db handle is caller-owned (via openRoomDb).
 *   findPriorConclusion is a READ-ONLY SELECT over that same caller-owned handle
 *   (reads are legal outside the write chokepoint). All nodes are born
 *   review_status 'proposed'; nothing here promotes a node (only a human
 *   confirmNode(byUser) does -- Part 9 role 5).
 *
 * Canon Part 8: zero network surface. The bank .md write and the room.db writes
 *   are pure LOCAL; no Brain call, no egress. Edge properties are enum/scalar
 *   only (a reason scalar), never conversation prose.
 *
 * D-02: every SEMANTIC edge this spine writes (SUPPORTS / CONTRADICTS /
 *   CONVERGES / INFORMS / REJECTED_BECAUSE) lands review_status 'proposed' -- the
 *   223 surfaces carry stance knowledge the 224 background deriver cannot infer,
 *   so they enter the SAME proposal lifecycle a human ratifies.
 * D-04: the SUPERSEDES edge (routed through temporal/supersession.supersede)
 *   carries NO review_status -- it binds NULL, a purely mechanical system fact,
 *   not a proposal.
 * G-1: every claim node carries an extraProps `pipeline` provenance marker
 *   naming the calling surface, so downstream consumers can distinguish
 *   AI-pipeline-authored claims from human-filed ones.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). CJS only, zero deps.
 */

const navigation = require('./navigation.cjs');
const opportunityOps = require('./opportunity-ops.cjs');
const narrativeSchema = require('../memory/narrative-schema.cjs');
const supersession = require('./temporal/supersession.cjs');

// The writer-local SEMANTIC edge allow-list (defense in depth over the frozen
// ALLOWED_EDGE_TYPES in edges.cjs). A relations[] entry outside this set is
// rejected BEFORE writeEdge is even called -- SUPERSEDES / REJECTED_BECAUSE are
// written by their OWN dedicated paths (supersede / killed), never as a generic
// relation.
const SEMANTIC_RELATION_TYPES = Object.freeze(new Set([
  'SUPPORTS', 'CONTRADICTS', 'CONVERGES', 'INFORMS',
]));

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Crypto-free, dependency-free stable 31-multiplier hash (the typed-claim.cjs
// CLAIM_NODE_ID idiom) so the module ships zero new dependencies.
function hashStr(s) {
  const key = typeof s === 'string' && s.length > 0 ? s : 'empty';
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16);
}

// topicHashOf(topic) -- the stable per-topic hash the conclusion marker carries
// and findPriorConclusion joins on. Stable across runs (same topic -> same
// hash) so a re-run's findPriorConclusion locates the prior conclusion.
function topicHashOf(topic) {
  return hashStr(typeof topic === 'string' && topic.length > 0 ? topic : 'notopic');
}

// mintArtifactId(topic, name) -- the D-01 cross-reference id (RESEARCH Open
// Question 1's recommendation, adopted). ONE id minted BEFORE either write,
// embedded in the .md frontmatter as artifact_id AND in the room.db opportunity
// node's extraProps.artifact_id. Deterministic per (topic, name, date) so a
// same-day re-run mints the SAME id and dedups sanely alongside bankOpportunity's
// problem_hash. dateStr is injectable (opts.dateStr) for hermetic tests.
function mintArtifactId(topic, name, dateStr) {
  const day = typeof dateStr === 'string' && dateStr.length > 0
    ? dateStr
    : new Date().toISOString().slice(0, 10);
  const t = typeof topic === 'string' ? topic : '';
  const n = typeof name === 'string' ? name : '';
  return 'artifact:' + hashStr(t + '|' + n + '|' + day);
}

// Wrap the compact conclusion payload {governing_thought, key_claims, topic} into
// a COMPLETE Feynman-MINTO narrative so navigation-schema.validateNarrative can
// gate it. The synthesized required fields (section / essence / plain_language /
// mental_model / sweet_spot) are DERIVED from the conclusion's own text and
// always satisfy their bounds, so the verdict is driven ENTIRELY by the two
// conclusion bounds the D-09 threat model names: governing_thought <= 250 chars
// and key_claims length in [3, 5]. An invalid conclusion is rejected before any
// node write; a valid one passes.
function conclusionToNarrative(conclusion) {
  const gt = typeof conclusion.governing_thought === 'string' ? conclusion.governing_thought : '';
  const kc = Array.isArray(conclusion.key_claims) ? conclusion.key_claims : [];
  const topic = (typeof conclusion.topic === 'string' && conclusion.topic.length > 0) ? conclusion.topic : 'conclusion';
  const clamp = (s, n) => {
    const base = (typeof s === 'string' && s.length > 0) ? s : topic;
    const out = base.slice(0, n);
    return out.length > 0 ? out : 'conclusion';
  };
  return {
    section: clamp(topic, 200),
    essence: clamp(gt, 200),
    plain_language: clamp(gt, 400),
    governing_thought: gt,
    mental_model: {
      analogy: clamp(topic, 150),
      mapping: clamp(gt, 500),
      limits: 'Bounded to the run topic.',
    },
    sweet_spot: clamp(gt, 600),
    key_claims: kc,
  };
}

// findPriorConclusion(db, topicHash, opts) -- SELECT the newest prior claim node
// whose properties carry kind 'conclusion' + the SAME topic_hash, EXCLUDING the
// current run's node (opts.excludeRunId). Read-only; this is the lookup Plan 03's
// --version-log uses to decide whether a prior conclusion exists to supersede.
// Returns { ok:true, node_id, run_id } or { ok:false, reason:'no_prior' }.
function findPriorConclusion(db, topicHash, opts) {
  if (!db || typeof db.prepare !== 'function') {
    return { ok: false, reason: 'invalid_db' };
  }
  const options = isPlainObject(opts) ? opts : {};
  const excludeRunId = typeof options.excludeRunId === 'string' ? options.excludeRunId : null;
  let rows;
  try {
    rows = db.prepare(
      "SELECT id, properties, created_at FROM nodes WHERE type = 'claim' ORDER BY created_at DESC"
    ).all();
  } catch (e) {
    return { ok: false, reason: 'read_failed', detail: String(e.message || '').slice(0, 80) };
  }
  for (const r of rows) {
    let props;
    try { props = JSON.parse(r.properties || '{}'); } catch (_e) { continue; }
    if (!isPlainObject(props)) continue;
    if (props.kind !== 'conclusion') continue;
    if (props.topic_hash !== topicHash) continue;
    if (excludeRunId !== null && props.run_id === excludeRunId) continue;
    return { ok: true, node_id: r.id, run_id: props.run_id };
  }
  return { ok: false, reason: 'no_prior' };
}

// writeCloseLoop(db, roomDir, payload, opts) -- the Section 6 contract.
//
// payload = { claims[], relations[], killed[], conclusion, knowns[], unknowns[],
//   opportunities[], priorConclusionId? }.
// opts = { surface ('bono'|'intel-pipeline'), run_id, sessionId?, dateStr?,
//   nodeWriters?{claim,opportunity,openQuestion}, edgeWriter?, bankWriteFn?,
//   supersedeFn? } -- the injectable seams the tests drive.
//
// Returns a scalar summary { ok, claim_ids, conclusion_id, opportunity:[{node_id,
//   md_path, artifact_id}], open_question_ids, edges_written, superseded,
//   failures:[{section, reason, detail?}] }. A degraded section is disclosed
//   structurally in `failures`, NEVER silently dropped (SEED-059).
function writeCloseLoop(db, roomDir, payload, opts) {
  const summary = {
    ok: false,
    claim_ids: [],
    conclusion_id: null,
    opportunity: [],
    open_question_ids: [],
    edges_written: 0,
    superseded: null,
    failures: [],
  };
  if (!db || typeof db.prepare !== 'function') {
    summary.failures.push({ section: 'root', reason: 'invalid_db' });
    return summary;
  }
  if (!isPlainObject(payload)) {
    summary.failures.push({ section: 'root', reason: 'invalid_payload' });
    return summary;
  }
  const options = isPlainObject(opts) ? opts : {};
  const surface = typeof options.surface === 'string' && options.surface.length > 0 ? options.surface : 'unknown';
  const runId = typeof options.run_id === 'string' && options.run_id.length > 0 ? options.run_id : 'run-' + Date.now();
  const sessionId = typeof options.sessionId === 'string' && options.sessionId.length > 0 ? options.sessionId : 'close-loop';
  const dateStr = typeof options.dateStr === 'string' ? options.dateStr : undefined;

  // Injectable seams (default to the navigation chokepoint + shipped writers).
  const nodeWriters = isPlainObject(options.nodeWriters) ? options.nodeWriters : {};
  const writeClaim = typeof nodeWriters.claim === 'function' ? nodeWriters.claim : navigation.writeClaimNode;
  const writeOpp = typeof nodeWriters.opportunity === 'function' ? nodeWriters.opportunity : navigation.writeOpportunityNode;
  const writeOQ = typeof nodeWriters.openQuestion === 'function' ? nodeWriters.openQuestion : navigation.writeOpenQuestionNode;
  const edgeWriter = typeof options.edgeWriter === 'function' ? options.edgeWriter : navigation.writeEdge;
  const bankFn = typeof options.bankWriteFn === 'function' ? options.bankWriteFn : opportunityOps.bankOpportunity;
  const supersedeFn = typeof options.supersedeFn === 'function' ? options.supersedeFn : supersession.supersede;

  const prov = { pipeline: surface, run_id: runId };

  // The claim-index -> node_id map so relations[] can reference claims by index.
  const claimByIndex = [];

  // --- payload.claims[] -> claim nodes with the G-1 provenance marker. --------
  const claims = Array.isArray(payload.claims) ? payload.claims : [];
  claims.forEach((c, i) => {
    if (!isPlainObject(c) || typeof c.text !== 'string' || c.text.length === 0) {
      summary.failures.push({ section: 'claim[' + i + ']', reason: 'invalid_claim' });
      claimByIndex[i] = null;
      return;
    }
    try {
      const res = writeClaim(db, {
        knowledge_type: typeof c.knowledge_type === 'string' ? c.knowledge_type : 'fact',
        text: c.text,
        sessionId: sessionId,
        sourceSegment: 'claim:' + runId + ':' + i,
        extraProps: Object.assign({}, prov),
      });
      if (res && res.ok) {
        summary.claim_ids.push(res.node_id);
        claimByIndex[i] = res.node_id;
      } else {
        summary.failures.push({ section: 'claim[' + i + ']', reason: (res && res.reason) || 'claim_write_failed' });
        claimByIndex[i] = null;
      }
    } catch (e) {
      summary.failures.push({ section: 'claim[' + i + ']', reason: 'claim_write_threw', detail: String(e.message || '').slice(0, 80) });
      claimByIndex[i] = null;
    }
  });

  // --- payload.conclusion -> validateNarrative FIRST, then one conclusion node.
  let topicHash = null;
  if (isPlainObject(payload.conclusion)) {
    const conclusion = payload.conclusion;
    const narrative = conclusionToNarrative(conclusion);
    const verdict = narrativeSchema.validateNarrative(narrative);
    if (!verdict.valid) {
      // Reject the WHOLE conclusion block; disclose; write nothing.
      summary.failures.push({ section: 'conclusion', reason: 'invalid_narrative', detail: verdict.errors.slice(0, 3).join('; ').slice(0, 160) });
    } else {
      topicHash = topicHashOf(conclusion.topic);
      try {
        const res = writeClaim(db, {
          knowledge_type: 'mental_model',
          text: conclusion.governing_thought,
          sessionId: sessionId,
          // Run-unique segment so a re-run mints a NEW conclusion node (required
          // for the SUPERSEDES chain -- Req 2).
          sourceSegment: 'conclusion:' + topicHash + ':' + runId,
          extraProps: {
            kind: 'conclusion',
            topic: typeof conclusion.topic === 'string' ? conclusion.topic : '',
            topic_hash: topicHash,
            pipeline: surface,
            run_id: runId,
          },
        });
        if (res && res.ok) {
          summary.conclusion_id = res.node_id;
        } else {
          summary.failures.push({ section: 'conclusion', reason: (res && res.reason) || 'conclusion_write_failed' });
        }
      } catch (e) {
        summary.failures.push({ section: 'conclusion', reason: 'conclusion_write_threw', detail: String(e.message || '').slice(0, 80) });
      }
    }
  }

  // --- payload.knowns[] -> claim nodes + SUPPORTS edge -> conclusion. ---------
  const knowns = Array.isArray(payload.knowns) ? payload.knowns : [];
  knowns.forEach((k, i) => {
    if (!isPlainObject(k) || typeof k.text !== 'string' || k.text.length === 0) {
      summary.failures.push({ section: 'known[' + i + ']', reason: 'invalid_known' });
      return;
    }
    try {
      const res = writeClaim(db, {
        knowledge_type: typeof k.knowledge_type === 'string' ? k.knowledge_type : 'fact',
        text: k.text,
        sessionId: sessionId,
        sourceSegment: 'known:' + runId + ':' + i,
        extraProps: Object.assign({}, prov),
      });
      if (!res || !res.ok) {
        summary.failures.push({ section: 'known[' + i + ']', reason: (res && res.reason) || 'known_write_failed' });
        return;
      }
      summary.claim_ids.push(res.node_id);
      if (summary.conclusion_id) {
        const er = edgeWriter(db, {
          source_id: res.node_id,
          target_id: summary.conclusion_id,
          edge_type: 'SUPPORTS',
          properties: { relation: 'supports' },
          review_status: 'proposed',
        });
        if (er && er.ok) summary.edges_written += 1;
        else summary.failures.push({ section: 'known[' + i + '].edge', reason: (er && er.reason) || 'support_edge_failed' });
      }
    } catch (e) {
      summary.failures.push({ section: 'known[' + i + ']', reason: 'known_write_threw', detail: String(e.message || '').slice(0, 80) });
    }
  });

  // --- payload.unknowns[] -> open_question nodes. ----------------------------
  const unknowns = Array.isArray(payload.unknowns) ? payload.unknowns : [];
  unknowns.forEach((u, i) => {
    const question = typeof u === 'string' ? u : (isPlainObject(u) && typeof u.question === 'string' ? u.question : null);
    if (!question || question.length === 0) {
      summary.failures.push({ section: 'unknown[' + i + ']', reason: 'invalid_unknown' });
      return;
    }
    try {
      const res = writeOQ(db, { question: question, sessionId: sessionId, source: surface, extraProps: Object.assign({}, prov) });
      if (res && res.ok) summary.open_question_ids.push(res.node_id);
      else summary.failures.push({ section: 'unknown[' + i + ']', reason: (res && res.reason) || 'open_question_write_failed' });
    } catch (e) {
      summary.failures.push({ section: 'unknown[' + i + ']', reason: 'open_question_write_threw', detail: String(e.message || '').slice(0, 80) });
    }
  });

  // --- payload.killed[] -> claim node + exactly one REJECTED_BECAUSE edge. ----
  // The killed claim is preserved as data (rejection IS data): mint it as a
  // proposed claim node, then a REJECTED_BECAUSE edge (proposed) FROM the killed
  // claim to the conclusion (rejected in favor of the conclusion) when one
  // exists, else a self-referential rejection record carrying the reason scalar.
  const killed = Array.isArray(payload.killed) ? payload.killed : [];
  killed.forEach((k, i) => {
    const text = isPlainObject(k) ? k.text : (typeof k === 'string' ? k : null);
    if (typeof text !== 'string' || text.length === 0) {
      summary.failures.push({ section: 'killed[' + i + ']', reason: 'invalid_killed' });
      return;
    }
    const reason = (isPlainObject(k) && typeof k.reason === 'string') ? k.reason : 'rejected';
    try {
      const res = writeClaim(db, {
        knowledge_type: 'fact',
        text: text,
        sessionId: sessionId,
        sourceSegment: 'killed:' + runId + ':' + i,
        extraProps: Object.assign({ killed: true }, prov),
      });
      if (!res || !res.ok) {
        summary.failures.push({ section: 'killed[' + i + ']', reason: (res && res.reason) || 'killed_write_failed' });
        return;
      }
      const target = summary.conclusion_id || res.node_id;
      const er = edgeWriter(db, {
        source_id: res.node_id,
        target_id: target,
        edge_type: 'REJECTED_BECAUSE',
        properties: { reason: reason },
        review_status: 'proposed',
      });
      if (er && er.ok) summary.edges_written += 1;
      else summary.failures.push({ section: 'killed[' + i + '].edge', reason: (er && er.reason) || 'rejection_edge_failed' });
    } catch (e) {
      summary.failures.push({ section: 'killed[' + i + ']', reason: 'killed_write_threw', detail: String(e.message || '').slice(0, 80) });
    }
  });

  // --- payload.relations[] -> semantic edges (D-02 proposed). ----------------
  // Writer-local allow-list restricted to SUPPORTS/CONTRADICTS/CONVERGES/INFORMS;
  // anything else is rejected BEFORE writeEdge (defense in depth).
  const relations = Array.isArray(payload.relations) ? payload.relations : [];
  relations.forEach((rel, i) => {
    if (!isPlainObject(rel) || typeof rel.edge_type !== 'string' || !SEMANTIC_RELATION_TYPES.has(rel.edge_type)) {
      summary.failures.push({ section: 'relation[' + i + ']', reason: 'edge_type_not_allowed', detail: String(rel && rel.edge_type).slice(0, 40) });
      return;
    }
    const src = typeof rel.source_id === 'string' ? rel.source_id
      : (Number.isInteger(rel.source_index) ? claimByIndex[rel.source_index] : null);
    const tgt = typeof rel.target_id === 'string' ? rel.target_id
      : (Number.isInteger(rel.target_index) ? claimByIndex[rel.target_index] : null);
    if (typeof src !== 'string' || typeof tgt !== 'string') {
      summary.failures.push({ section: 'relation[' + i + ']', reason: 'unresolved_endpoint' });
      return;
    }
    try {
      const er = edgeWriter(db, {
        source_id: src,
        target_id: tgt,
        edge_type: rel.edge_type,
        properties: { reason: typeof rel.reason === 'string' ? rel.reason : '' },
        review_status: 'proposed',
      });
      if (er && er.ok) summary.edges_written += 1;
      else summary.failures.push({ section: 'relation[' + i + ']', reason: (er && er.reason) || 'relation_edge_failed' });
    } catch (e) {
      summary.failures.push({ section: 'relation[' + i + ']', reason: 'relation_edge_threw', detail: String(e.message || '').slice(0, 80) });
    }
  });

  // --- payload.opportunities[] -> D-01 dual write (.md FIRST, node SECOND). ---
  const opportunities = Array.isArray(payload.opportunities) ? payload.opportunities : [];
  const topicForArtifact = isPlainObject(payload.conclusion) && typeof payload.conclusion.topic === 'string'
    ? payload.conclusion.topic : 'opportunity';
  opportunities.forEach((opp, i) => {
    if (!isPlainObject(opp) || typeof opp.name !== 'string' || opp.name.length === 0
      || typeof opp.problem !== 'string' || opp.problem.length === 0) {
      summary.failures.push({ section: 'opportunity[' + i + ']', reason: 'invalid_opportunity' });
      return;
    }
    // (a) mint the shared artifact_id BEFORE either write.
    const artifactId = mintArtifactId(topicForArtifact, opp.name, dateStr);
    const entry = { node_id: null, md_path: null, artifact_id: artifactId };
    // (b) bank .md FIRST (chosen over fileOpportunity for problem_hash dedup on
    //     re-runs; the additive artifact_id + six reader fields pass through).
    try {
      const bankRes = bankFn(roomDir, {
        problem: opp.problem,
        funder: opp.funder,
        program: opp.program,
        deadline: opp.deadline,
        relevance_score: opp.relevance_score,
        artifact_id: artifactId,
        status: 'banked',
        created: typeof opp.created === 'string' ? opp.created : undefined,
        source_framework: surface,
        domain: typeof opp.domain === 'string' ? opp.domain : '',
        evidence: typeof opp.evidence === 'string' ? opp.evidence : '',
        mirror_solution: typeof opp.mirror_solution === 'string' ? opp.mirror_solution : '',
        confidence: typeof opp.relevance_score === 'number' ? opp.relevance_score : 0,
      });
      if (bankRes && (bankRes.banked || bankRes.updated) && bankRes.path) {
        entry.md_path = bankRes.path;
      } else {
        summary.failures.push({ section: 'opportunity[' + i + '].bank', reason: (bankRes && bankRes.error) || 'bank_write_failed' });
      }
    } catch (e) {
      summary.failures.push({ section: 'opportunity[' + i + '].bank', reason: 'bank_write_threw', detail: String(e.message || '').slice(0, 80) });
    }
    // (c) room.db node SECOND. A throw here (crash ordering) leaves the .md on
    //     disk and NO node -- disclosed, never swallowed (D-01 + SEED-059).
    try {
      const nres = writeOpp(db, {
        name: opp.name,
        sessionId: sessionId,
        lifecycle: 'candidate',
        section: typeof opp.section === 'string' ? opp.section : 'unknown',
        extraProps: { artifact_id: artifactId, pipeline: surface, run_id: runId },
      });
      if (nres && nres.ok) {
        entry.node_id = nres.node_id;
        // (d) SUPPORTS edges from the opportunity node to its claims (proposed).
        const supports = Array.isArray(opp.supports_claim_ids) ? opp.supports_claim_ids : [];
        supports.forEach((cid) => {
          const target = typeof cid === 'string' ? cid : (Number.isInteger(cid) ? claimByIndex[cid] : null);
          if (typeof target !== 'string') return;
          const er = edgeWriter(db, {
            source_id: nres.node_id, target_id: target, edge_type: 'SUPPORTS',
            properties: { relation: 'supports' }, review_status: 'proposed',
          });
          if (er && er.ok) summary.edges_written += 1;
        });
      } else {
        summary.failures.push({ section: 'opportunity[' + i + '].node', reason: (nres && nres.reason) || 'opportunity_node_failed' });
      }
    } catch (e) {
      // The D-01 partial-write disclosure: the .md is banked, the node is not.
      summary.failures.push({ section: 'opportunity[' + i + '].node', reason: 'opportunity_node_threw', detail: String(e.message || '').slice(0, 80) });
    }
    summary.opportunity.push(entry);
  });

  // --- payload.priorConclusionId -> supersede (D-04 NULL). -------------------
  // NEVER on a first run (no priorConclusionId -> no SUPERSEDES edge -- Req 2's
  // no-false-chain acceptance). supersede passes NO review_status.
  if (typeof payload.priorConclusionId === 'string' && payload.priorConclusionId.length > 0 && summary.conclusion_id) {
    try {
      const sres = supersedeFn(db, payload.priorConclusionId, summary.conclusion_id);
      summary.superseded = sres;
      if (!sres || !sres.ok) {
        summary.failures.push({ section: 'supersession', reason: (sres && sres.reason) || 'supersede_failed' });
      }
    } catch (e) {
      summary.failures.push({ section: 'supersession', reason: 'supersede_threw', detail: String(e.message || '').slice(0, 80) });
    }
  }

  summary.ok = summary.failures.length === 0;
  return summary;
}

module.exports = { writeCloseLoop, findPriorConclusion, mintArtifactId, topicHashOf };
