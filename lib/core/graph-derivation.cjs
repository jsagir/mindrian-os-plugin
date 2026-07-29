'use strict';
/*
 * Phase 169-04 (GDH-02/03/05 + D-169-11) -- lib/core/graph-derivation.cjs
 * ======================================================================
 * The derivation COMPOSER + the RECURSIVE sub-room rollup. Three exports:
 *
 *   candidateToFinding(candidate) -> finding
 *     The explicit named adapter (D-169-06 producer/writer/adapter split). It
 *     turns a {source, target, edge_type, reason} producer tuple into the
 *     finding shape the WRITER consumes. The producer PRODUCES; findings-wirer /
 *     the navigation typed-claim writer WRITES; this adapter JOINS them. It is
 *     NOT a fork of the writer.
 *
 *   runDerivation({roomDir, runChain, selfCritiqueFn, deriveFn}) -> {proposedNodes, edges, trace}
 *     The runChain composer. deriveFn IS the LLM producer (defaults to
 *     graph-candidate-producer.produceCandidates, injectable for tests). Each
 *     step is material:true so fable-mode (167 selfCritiqueFn) critiques EACH
 *     candidate. Only critique-PASSED candidates flow through candidateToFinding
 *     and land as a PROPOSED truth-claim NODE (review_status='proposed' on the
 *     NODE) plus a typed EDGE via navigation.writeEdge (cascade edge_type from
 *     the frozen set, enum/scalar properties only). As of Phase 224 D-05
 *     review_status ALSO lives on the EDGE ROW's own review_status COLUMN: the
 *     derivation writer passes review_status:'proposed' so a derived edge is a
 *     proposal on BOTH the claim node AND the edge itself (the navigator's D-05
 *     ruling amended the original Part 9 Pitfall-1 "never on the edge" note).
 *     The edge PROPERTIES still carry enum/scalar only; review_status is a
 *     first-class column, not a property. An unjustified candidate (fable-mode
 *     {passed:false}) is
 *     dropped: no node, no edge (T-169-07). The proposed-node id is a stable
 *     content/source hash so a re-run does not re-mint it (sets up GDH-07).
 *
 *   rollupSubRooms(parentRoomDir) -> {edges}
 *     A RECURSIVE, TRANSITIVE read-side ATTACH (D-169-11 arbitrary depth). It
 *     walks the NESTED_WITHIN child links of parentRoomDir, ATTACHes each child
 *     room.db read-only, UNION-selects its edges, then RECURSES into the child's
 *     own NESTED_WITHIN children -- so a sub-sub-room's edges reach the TOP-level
 *     parent rollup. It NEVER writes the parent db (read-side only) and is
 *     cycle-guarded by a visited-set of resolved db paths (T-169-20). No cross-
 *     room-detect; cross-room TYPED edges stay deferred (Phase 83).
 *
 * Canon Part 8: derivation is LOCAL. The producer reads LOCAL artifact text and
 *   uses an injectable local llm (default anthropic-transport, NEVER the Brain).
 *   This composer adds NO new Brain wire. The rollup is a read-side ATTACH over
 *   LOCAL room.db files; NESTED_WITHIN is a LOCAL room.db edge and cross-room
 *   aggregation of the EDGE is not performed (the rollup READS, never writes a
 *   cross-room row into the parent).
 * Canon Part 9: every derived edge lands via a PROPOSED truth-claim NODE; the
 *   human confirms via navigation.confirmNode at a Decision Gate (Part 3/9 -- the
 *   derivation HALTS at the gate and NEVER auto-confirms). The proposed NODE is
 *   written through navigation.writeClaimNode (the chokepoint truth-claim
 *   writer); the typed EDGE through navigation.writeEdge. NO raw INSERT INTO
 *   edges here.
 * Canon Part 4: cascade edge_type ONLY from the frozen ALLOWED_EDGE_TYPES; the
 *   edge properties are enum/scalar.
 *
 * Em-dash discipline: hyphens only (CLAUDE.md HARD RULE). CJS only. No new deps.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');

const navigation = require('./navigation.cjs');
const { openRoomDb, closeRoomDb, RoomDbBusyError, RoomDbBrokenError } = require('./room-db.cjs');

// The frozen cascade subset a derived edge may carry. Mirrors the producer's
// CASCADE_SUBSET and is a strict subset of edges.cjs ALLOWED_EDGE_TYPES.
const CASCADE_SUBSET = Object.freeze(new Set([
  'CONTRADICTS', 'CONVERGES', 'INFORMS', 'INVALIDATES', 'ENABLES', 'REFINES', 'ROOT_CAUSES',
]));

// Map a cascade edge_type to a knowledge_type for the proposed claim node. The
// node represents the DERIVED relationship as a truth-claim; the enum is the
// closed KNOWLEDGE_TYPES set writeClaimNode validates. ROOT_CAUSES is causal;
// everything else is a 'fact'-tier derived relationship pending human confirm.
function _knowledgeTypeFor(edgeType) {
  if (edgeType === 'ROOT_CAUSES') return 'causal';
  if (edgeType === 'INVALIDATES') return 'assumption';
  return 'fact';
}

// Stable content/source hash id seed for a candidate (Pitfall 3 / GDH-07): a
// sha256 over the edge semantics so a re-run does not re-mint the proposed node.
function _candidateHash(candidate) {
  const key = [
    String(candidate.source || ''),
    String(candidate.target || ''),
    String(candidate.edge_type || ''),
  ].join('|');
  return crypto.createHash('sha256').update(key).digest('hex').slice(0, 16);
}

/**
 * candidateToFinding(candidate) -> finding
 * The explicit producer-tuple -> finding adapter. Returns the shape the writer
 * consumes: the proposed truth-claim intent (knowledge_type + text) plus the
 * typed-edge intent (source / target / edge_type) and the reason scalar. Never
 * throws on caller input; returns null for a non-object.
 */
function candidateToFinding(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;
  const edge_type = (typeof candidate.edge_type === 'string') ? candidate.edge_type : '';
  const source = (typeof candidate.source === 'string') ? candidate.source : '';
  const target = (typeof candidate.target === 'string') ? candidate.target : '';
  const reason = (typeof candidate.reason === 'string') ? candidate.reason : '';
  const hash = _candidateHash({ source, target, edge_type });
  return {
    // The proposed truth-claim NODE intent (review_status lands on the NODE).
    knowledge_type: _knowledgeTypeFor(edge_type),
    text: edge_type + ': ' + source + ' -> ' + target + (reason ? (' (' + reason + ')') : ''),
    // The stable id seed (Pitfall 3): the same candidate re-derives the same node.
    node_seed: hash,
    // The typed-EDGE intent.
    edge: {
      source_id: source,
      target_id: target,
      edge_type: edge_type,
      // Part 8: enum/scalar only. The reason is a short scalar; NEVER review_status.
      properties: { relation: 'derived', reason: reason.slice(0, 64) },
    },
  };
}

// Run the fable-mode critique on a candidate. Mirrors the chain-executor seam:
// material:true so the critic always fires; a {passed:false} OR {quality:'low'}
// verdict drops the candidate. A thrown critic fails OPEN (the candidate is kept)
// per the Phase 167 T-167-12 seam -- a broken critic must not silently drop work.
function _critiquePasses(selfCritiqueFn, candidate) {
  if (typeof selfCritiqueFn !== 'function') return true;
  let verdict;
  try {
    // The candidate is BOTH the step subject and the result for fable-mode here:
    // the critic judges the candidate tuple directly. Pass it as both args so a
    // critic that reads arg-0 (the candidate-shaped step) and one that reads
    // arg-1 (the chain-executor result position) both see the candidate.
    verdict = selfCritiqueFn(candidate, candidate);
  } catch (_e) {
    return true; // fail open on the critic itself.
  }
  if (!verdict || typeof verdict !== 'object') return true;
  if (verdict.passed === false) return false;
  if (verdict.quality === 'low') return false;
  return true;
}

// Phase 233-02 (RCA graph-derive-silent-clear item 4b) -- the DEFAULT deriveFn gate.
// ================================================================================
// Before this gate, a caller that FORGOT to inject a deriveFn silently resolved to
// graph-candidate-producer.produceCandidates, whose default transport is a direct
// fetch to api.anthropic.com. The RCA's Section 3 item 1 probed that account live
// and got 400 "credit balance is too low": the silent default was a guaranteed
// runtime failure dressed up as a working code path. Every real caller in this repo
// (scripts/gsd-graph-derive-drain.cjs, lib/core/graph-backfill.cjs, every test)
// already injects deriveFn explicitly, so nothing shipped depends on the fallback.
//
// The gate is a GATE, not a removal (233-CONTEXT.md leaves retire-vs-gate to
// discretion, requiring only that the dead default stop being reachable by
// accident): an operator who DELIBERATELY configures the hosted transport gets
// byte-identical behavior. Two conditions, both required:
//   MINDRIAN_ALLOW_HOSTED_DERIVE === '1'   the explicit opt-in
//   ANTHROPIC_API_KEY non-empty            the funded-key proxy
// Key PRESENCE, not a live balance probe: probing a balance is a network call this
// synchronous composer cannot make, and it is the same proxy the producer's own
// _resolveDefaultLlm already uses (anthropic_api_key_missing).
//
// Canon Part 8: unchanged. This gate only makes an ALREADY-LOCAL Anthropic
// transport harder to reach by accident; it opens no new wire and closes none.
// T-233-08: the message is a fixed literal. It never interpolates roomDir, the key
// value, or any other runtime data.
function _resolveDefaultDeriveFn() {
  const optIn = process.env.MINDRIAN_ALLOW_HOSTED_DERIVE === '1';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const hasKey = (typeof apiKey === 'string' && apiKey.length > 0);
  if (optIn && hasKey) {
    return require('./graph-candidate-producer.cjs').produceCandidates;
  }
  throw new Error(
    'deriveFn_required_no_hosted_default: runDerivation was called with no deriveFn '
    + 'injected. The dead hosted-API default is gated; inject the local score-based '
    + 'producer (graph-derive-classifier.cjs scoreBasedDeriveFn, see '
    + 'scripts/gsd-graph-derive-drain.cjs or lib/core/graph-backfill.cjs for the '
    + 'pattern), or set MINDRIAN_ALLOW_HOSTED_DERIVE=1 with a funded ANTHROPIC_API_KEY '
    + 'to opt into the hosted transport explicitly.'
  );
}

/**
 * runDerivation({roomDir, runChain, selfCritiqueFn, deriveFn, artifactPairs, llm})
 *   -> {proposedNodes, edges, trace}
 *
 * Drives deriveFn (= the producer) over artifact pairs as material steps,
 * fable-mode-critiques each candidate, and writes the survivors as PROPOSED
 * truth-claim nodes + typed edges through the navigation chokepoint.
 *
 * deriveFn is REQUIRED in practice (Phase 233-02 / RCA 4b): omitting it throws
 * deriveFn_required_no_hosted_default synchronously, before room.db is opened and
 * before any pair is processed, unless the hosted transport is explicitly opted
 * into (MINDRIAN_ALLOW_HOSTED_DERIVE=1 plus a non-empty ANTHROPIC_API_KEY), in
 * which case the default stays graph-candidate-producer.produceCandidates exactly
 * as before. Fail fast, fail loud, never a live 400 against a dead account.
 * NOTE: deriveFn must return an ARRAY synchronously. The default producer with
 * its default async llm transport returns a Promise, which this synchronous
 * composer rejects LOUDLY (throw) rather than silently deriving nothing; a
 * caller on the async default path must pre-resolve candidates per pair and
 * inject a sync wrapper (the drain/backfill pattern).
 * When the caller supplies a runChain (the chain-executor composer), each pair
 * is a material:true step; when it does not, the pairs are driven directly (the
 * test path). selfCritiqueFn defaults to a no-op pass-through.
 */
function runDerivation(args) {
  const opts = (args && typeof args === 'object') ? args : {};
  const roomDir = (typeof opts.roomDir === 'string') ? opts.roomDir : '';
  // RCA 4b: resolve the default BEFORE anything else in the body. The throw must
  // land ahead of openRoomDb and ahead of the first pair, so a caller that forgot
  // deriveFn gets a loud contract error and never a half-opened room.
  const deriveFn = (typeof opts.deriveFn === 'function')
    ? opts.deriveFn
    : _resolveDefaultDeriveFn();
  const selfCritiqueFn = (typeof opts.selfCritiqueFn === 'function') ? opts.selfCritiqueFn : null;
  const artifactPairs = Array.isArray(opts.artifactPairs) ? opts.artifactPairs : [];
  const sessionId = (typeof opts.sessionId === 'string' && opts.sessionId.length > 0)
    ? opts.sessionId
    : 'derive';

  const proposedNodes = [];
  const edges = [];
  const trace = [];

  // The candidate-derive step: invoke deriveFn for a pair (or once with no pair
  // when none are supplied -- the test path drives a stub deriveFn() with no
  // artifactPair). The producer MUST return an ARRAY synchronously: this composer
  // is a synchronous loop and cannot await. A Promise-returning deriveFn (for
  // example the default async anthropic transport, or the async score-based
  // producer) is REJECTED LOUDLY instead of silently deriving nothing -- the
  // silently-dropped Promise was the mechanical twin of the twice-reconfirmed
  // 0-typed-edge gap. Async producers are pre-resolved by the drain / backfill
  // wrappers before entering this composer.
  function deriveForPair(pair) {
    const candidates = deriveFn({ roomDir: roomDir, artifactPair: pair, llm: opts.llm });
    if (candidates && typeof candidates.then === 'function') {
      throw new Error(
        'runDerivation: deriveFn returned a Promise; this synchronous composer '
        + 'cannot await it. Pre-resolve the async producer per pair and inject a '
        + 'synchronous deriveFn wrapper (the drain/backfill pattern).'
      );
    }
    return Array.isArray(candidates) ? candidates : [];
  }

  // Open the room.db ONCE for the proposed-node + edge writes (caller-owned
  // handle through the navigation/openRoomDb chokepoint). When roomDir is absent
  // the writes are skipped (the composer still returns its trace shape).
  let db = null;
  if (roomDir) {
    // Phase 236 (GRAPHDB-02): the pre-236 bare `catch (_e) { db = null; }` here
    // collapsed a locked room, a mid-migration failure and a genuinely-absent
    // room into one indistinguishable null, so the composer cold-started as if
    // a room with history had none. Classification lives in room-db.cjs, NOT
    // here: this site adds no classification logic, it only stops swallowing
    // the two typed classes. Every other error keeps the old null, so a genuine
    // cold start is still a cold start and this is strictly narrower than before.
    try {
      db = openRoomDb(roomDir);
    } catch (e) {
      if (e instanceof RoomDbBusyError || e instanceof RoomDbBrokenError) throw e;
      db = null;
    }
  }

  try {
    // EXEC: one step per artifact pair (material:true). When no pairs are given,
    // run a single derive call (the stub-deriveFn test contract).
    const stepInputs = artifactPairs.length > 0 ? artifactPairs : [null];

    for (let s = 0; s < stepInputs.length; s += 1) {
      const pair = stepInputs[s];
      const candidates = deriveForPair(pair);
      trace.push({ step: s, material: true, candidates: candidates.length });

      for (const candidate of candidates) {
        // Frozen-subset guard (defense in depth -- the producer already filters).
        if (!candidate || !CASCADE_SUBSET.has(candidate.edge_type)) continue;

        // fable-mode: drop the unjustified candidate (no node, no edge).
        if (!_critiquePasses(selfCritiqueFn, candidate)) {
          trace.push({ dropped: candidate.edge_type, reason: 'critique_failed' });
          continue;
        }

        const finding = candidateToFinding(candidate);
        if (!finding) continue;

        // 1. Write the PROPOSED truth-claim NODE (review_status='proposed' on the
        //    NODE -- Part 9) through the navigation writeClaimNode chokepoint. The
        //    stable node_seed is the sourceSegment so a re-run UPSERTs (idempotent
        //    id) rather than duplicating.
        //
        //    THE IDEMPOTENCE GUARD (GDH-07, Pitfall 3): before the write, probe the
        //    node's stable id + review_status in the db. When it already exists at
        //    'proposed' OR 'confirmed', this run does NOT mint a new node (minted=
        //    false) and a 'confirmed' node is NEVER downgraded (writeClaimNode's
        //    ON CONFLICT already EXCLUDES review_status, but the guard records the
        //    pre-state truthfully so a re-run is a verifiable no-op). A confirmed
        //    edge is likewise left untouched.
        const stableId = navigation.CLAIM_NODE_ID
          ? navigation.CLAIM_NODE_ID(sessionId, finding.node_seed)
          : ('claim:' + sessionId + ':' + finding.node_seed);
        let nodeId = stableId;
        let preState = '';
        if (db) {
          try {
            const existing = db.prepare(
              'SELECT review_status FROM nodes WHERE id = ?'
            ).get(stableId);
            if (existing && typeof existing.review_status === 'string') {
              preState = existing.review_status;
            }
          } catch (_e) { preState = ''; }
        }
        const preProposed = (preState === 'proposed');
        const preConfirmed = (preState === 'confirmed');

        let reviewStatus = preConfirmed ? 'confirmed' : 'proposed';
        // minted is TRUE only when this run actually introduces the node (no prior
        // proposed/confirmed row). A re-run on a wired room finds preState set, so
        // minted is FALSE -- the no-op contract (GDH-07).
        const minted = !(preProposed || preConfirmed);
        if (db) {
          const claim = navigation.writeClaimNode(db, {
            knowledge_type: finding.knowledge_type,
            text: finding.text,
            sessionId: sessionId,
            sourceSegment: finding.node_seed,
          });
          if (claim && claim.ok && typeof claim.node_id === 'string') {
            nodeId = claim.node_id;
          }
        }
        proposedNodes.push({
          id: nodeId,
          review_status: reviewStatus,
          knowledge_type: finding.knowledge_type,
          edge_type: candidate.edge_type,
          minted: minted,
          preConfirmed: preConfirmed,
        });

        // 2. Write the typed EDGE through navigation.writeEdge (the chokepoint;
        //    no raw edge SQL). The edge PROPERTIES carry enum/scalar ONLY; as of
        //    Phase 224 D-05 the edge ALSO lands review_status:'proposed' on its
        //    own COLUMN (the navigator ruling amending Pitfall 1). writeEdge's
        //    upsert sets review_status at first insert only and never downgrades
        //    a confirmed edge on a re-run (the Ralph invariant).
        let edgeOk = true;
        if (db) {
          const res = navigation.writeEdge(db, {
            source_id: finding.edge.source_id,
            target_id: finding.edge.target_id,
            edge_type: finding.edge.edge_type,
            properties: finding.edge.properties,
            review_status: 'proposed',
          });
          edgeOk = !!(res && res.ok);
        }
        edges.push({
          source: finding.edge.source_id,
          target: finding.edge.target_id,
          type: finding.edge.edge_type,
          edge_type: finding.edge.edge_type,
          properties: finding.edge.properties,
          node_id: nodeId,
          ok: edgeOk,
        });
      }
    }
  } finally {
    if (db) { try { closeRoomDb(db); } catch (_e) { /* ignore */ } }
  }

  return { proposedNodes: proposedNodes, edges: edges, trace: trace };
}

// --- rollupSubRooms (RECURSIVE / TRANSITIVE, D-169-11) ---

function _roomDbPath(roomDir) {
  return path.join(path.resolve(roomDir), '.mindrian', 'room.db');
}

// Percent-encode the URI-significant bytes of a filesystem path for a SQLite
// file: URI. SQLite's URI parser treats ? as the query separator, # as the
// fragment start, and % as the escape byte -- a room path containing any of
// them (or read through a plain string splice, an apostrophe) silently broke
// the open/ATTACH. Everything else (spaces, quotes, unicode) passes through
// untouched: SQLite decodes %XX and takes the rest literally.
function _fileUriPath(p) {
  return String(p).replace(/%/g, '%25').replace(/\?/g, '%3F').replace(/#/g, '%23');
}

// Locate the child room directory for a NESTED_WITHIN child slug. The child is an
// immediate subdirectory of parentRoomDir whose `.room-root` slug matches. Falls
// back to a same-named subdirectory when the slug is not encoded in `.room-root`.
function _childDirForSlug(parentRoomDir, childSlug) {
  let entries;
  try {
    entries = fs.readdirSync(parentRoomDir, { withFileTypes: true });
  } catch (_e) {
    return '';
  }
  // First pass: match the `.room-root` slug.
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    const childDir = path.join(parentRoomDir, entry.name);
    const sentinel = path.join(childDir, '.room-root');
    if (!fs.existsSync(sentinel)) continue;
    try {
      const meta = JSON.parse(fs.readFileSync(sentinel, 'utf-8'));
      if (meta && meta.slug === childSlug) return childDir;
    } catch (_e) { /* keep scanning */ }
  }
  // Second pass: directory named exactly the slug (carrying a sentinel).
  const direct = path.join(parentRoomDir, childSlug);
  if (fs.existsSync(path.join(direct, '.room-root'))) return direct;
  return '';
}

// Read the direct NESTED_WITHIN child slugs from a room db. A child link is
// source 'room:<child>' -> target 'room:<parent>' (the Plan 00 lineage edge).
function _directChildSlugs(db) {
  let rows = [];
  try {
    rows = db.prepare("SELECT source FROM edges WHERE type = 'NESTED_WITHIN'").all();
  } catch (_e) {
    return [];
  }
  const slugs = [];
  for (const r of rows) {
    const src = (r && typeof r.source === 'string') ? r.source : '';
    if (src.indexOf('room:') === 0) slugs.push(src.slice('room:'.length));
  }
  return slugs;
}

// Read ALL edges from a child db via a read-only ATTACH over the parent's
// connection, so no second writable handle is opened and the parent db is never
// written. Returns the child's edge rows (shaped for the rollup union).
function _readChildEdgesViaAttach(parentConn, childDbPath) {
  const rows = [];
  let attached = false;
  try {
    // PARAMETERIZED ATTACH (never a string splice): a directory name carrying an
    // apostrophe used to break the statement (the child silently contributed
    // nothing), and a crafted name could inject arbitrary SQL on the parent
    // connection. The filename rides a bind parameter; only the URI-significant
    // bytes are percent-encoded.
    parentConn.prepare('ATTACH DATABASE ? AS rollup_child')
      .run('file:' + _fileUriPath(childDbPath) + '?mode=ro');
    attached = true;
    const got = parentConn.prepare(
      'SELECT source, target, type, properties FROM rollup_child.edges'
    ).all();
    for (const r of got) {
      rows.push({
        source: r.source,
        target: r.target,
        type: r.type,
        edge_type: r.type,
        properties: r.properties,
      });
    }
  } catch (_e) {
    // a missing / unreadable child db contributes nothing (degrade quietly).
  } finally {
    if (attached) {
      try { parentConn.exec('DETACH DATABASE rollup_child'); } catch (_de) { /* ignore */ }
    }
  }
  return rows;
}

/**
 * rollupSubRooms(parentRoomDir) -> {edges}
 *
 * RECURSIVE / TRANSITIVE read-side ATTACH walking the NESTED_WITHIN lineage edge
 * at arbitrary depth (D-169-11). It opens the parent room.db, enumerates its
 * direct NESTED_WITHIN children, ATTACHes each child room.db read-only, unions
 * its edges, and recurses into the child's own NESTED_WITHIN children -- so a
 * sub-sub-room edge reaches the top rollup. It NEVER writes the parent db. The
 * recursion is cycle-guarded by a visited-set of resolved child db paths.
 */
function rollupSubRooms(parentRoomDir, _visited) {
  const resolvedParent = path.resolve(typeof parentRoomDir === 'string' ? parentRoomDir : '');
  const visited = (_visited instanceof Set) ? _visited : new Set();
  const out = { edges: [] };

  const parentDbPath = _roomDbPath(resolvedParent);
  if (visited.has(parentDbPath)) return out;
  visited.add(parentDbPath);

  if (!fs.existsSync(parentDbPath)) return out;

  // Open the parent db READ ONLY (file: URI mode=ro) so the rollup can never
  // write the parent. The NESTED_WITHIN walk + the child ATTACHes ride this one
  // read-only connection.
  let parentConn = null;
  try {
    parentConn = new DatabaseSync('file:' + _fileUriPath(parentDbPath) + '?mode=ro');
  } catch (_e) {
    return out;
  }

  try {
    const childSlugs = _directChildSlugs(parentConn);
    for (const slug of childSlugs) {
      const childDir = _childDirForSlug(resolvedParent, slug);
      if (!childDir) continue;
      const childDbPath = _roomDbPath(childDir);
      if (visited.has(childDbPath)) continue;

      // Read-side ATTACH: union the child's edges WITHOUT writing the parent.
      const childEdges = _readChildEdgesViaAttach(parentConn, childDbPath);
      for (const e of childEdges) out.edges.push(e);

      // RECURSE: the child's own NESTED_WITHIN children (arbitrary depth).
      const deeper = rollupSubRooms(childDir, visited);
      for (const e of deeper.edges) out.edges.push(e);
    }
  } finally {
    try { parentConn.close(); } catch (_e) { /* ignore */ }
  }

  return out;
}

module.exports = {
  runDerivation,
  rollupSubRooms,
  candidateToFinding,
  CASCADE_SUBSET,
  // Exported for cross-language parity checking only (the same "exported for
  // hermetic unit tests" idiom the doctor modules use). scripts/compute-hsi.py
  // now carries the SAME three-byte rule for the SAME room.db path, and
  // tests/test-233-hsi-uri-path-encoding.sh runs both over identical adversarial
  // inputs so the two can never silently drift into opening different rooms.
  _fileUriPath,
};
