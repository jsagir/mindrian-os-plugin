'use strict';
/*
 * Phase 130-02 -- lens-engine: the rotate() engine.
 *
 * THE single architectural for-loop. It absorbs the lens-rotation logic the
 * 5-cluster audit found duplicated across persona-ops.cjs:514 (the serial
 * for-loop over HAT_COLORS), the hat-persistence rotation, and find-analogies
 * Step 4. Plan 03 migrates the 4 cognitive-family commands (think-hats / persona
 * / hat-briefing / challenge-assumptions) to thin clients of this engine; what
 * stays per-client is the lens set, the per-lens prompt, and the synthesis
 * strategy choice (declared in command frontmatter).
 *
 * SUBSTRATE CONTRACT (the hard invariant, asserted by scripts/check-substrate.cjs
 * scanFiles in Plan Task 3): this module reaches room.db ONLY through
 * lib/core/navigation.cjs. It carries ZERO direct require of room-db.cjs /
 * lazygraph-ops.cjs / node:sqlite -- it is NOT in the substrate-guard allow-list,
 * so the guard must return clean on it. The db handle is CALLER-OWNED: it arrives
 * via input.db (the lens-nodes / writeEdge convention), opened by the caller (a
 * Plan 03 thin client or a test) through openRoomDb. The engine never opens or
 * closes room.db; it only routes writes through the navigation chokepoint:
 *   navigation.writeLensFinding(db, ...)  -- the typed lens_finding node.
 *   navigation.writeEdge(db, ...)          -- INFORMS (accept) / REJECTED_BECAUSE (reject).
 *   navigation.logMemoryEvent(db, ...)     -- the mandatory lifecycle events.
 *   navigation.confirmNode(db, ...)        -- human-attributed promotion (cascade persistence).
 *   navigation.resolveByUser(roomDir)      -- the non-agent byUser identity.
 *
 * The rotate() contract (130-CONTEXT):
 *   rotate({
 *     lensType, lensSet, input:{roomDir, topic, focusNodeId?, db},
 *     perLensFn, synthesize, surfaceSelector, persistence,
 *     onAccept, onReject, rotationMode
 *   }) -> { ok, findingIds, synthesis, selector } | { ok:false, reason }
 *
 * Pre-resolved 130-CONTEXT decisions honored here:
 *   - synthesizers receive the TYPED node IDs that were written (the
 *     lens_finding node objects), NOT raw per-lens output arrays.
 *   - rotation modes serial / parallel / single cover the cognitive family; the
 *     source-family weighted-by-context 4th mode LANDED in Phase 131 (Plan 03):
 *     it is now an active ROTATION_MODES member and the source registry slot is
 *     client_count 1 (the source-lens driver pilot). It runs the lens set ordered
 *     by descending supplied weight, reusing the serial dispatch internally.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Uses hyphens.
 * NO fenced code blocks in the source body; no literal Cypher-keyword token next
 *   to a template placeholder (the m4-cypher substrate-guard false-positive).
 */

const navigation = require('./navigation.cjs');
const userMdOps = require('./user-md-ops.cjs');
const selectorDispatcher = require('../hmi/selector-dispatcher.cjs');
const tensionMap = require('./synthesizers/tension-map.cjs');
const comparisonMatrix = require('./synthesizers/comparison-matrix.cjs');
const convergenceMap = require('./synthesizers/convergence-map.cjs');
const sourceComparison = require('./synthesizers/source-comparison.cjs');
const domainHierarchy = require('./synthesizers/domain-hierarchy.cjs');

// ---------------------------------------------------------------------------
// The 5-family registry. cognitive is populated (4 clients in v1.13.1: think-hats
// / persona / hat-briefing / challenge-assumptions); the other 4 families get
// reserved slots with client_count 0 so the v1.14.0 migrations know what is
// expected. Frozen so a caller cannot mutate the contract at runtime.
// ---------------------------------------------------------------------------
const LENS_REGISTRY = Object.freeze({
  cognitive: Object.freeze({
    client_count: 4,
    lens_sets: Object.freeze(['six-hats', 'black-hat']),
    synthesizers: Object.freeze(['tension-map', 'comparison-matrix', 'convergence-map']),
  }),
  // ACTIVATED in Phase 163 (Plan 03): the domain family goes from the reserved
  // slot (client_count 0, reserved_for v1.14.0) to the active Engine-1 decomposition
  // slot. The five lens names are the Canon Part 2 Engine 1 DECOMPOSITION lenses
  // (Disciplinary / Stakeholder / System / Temporal / Scale) -- the five lenses that
  // decompose a topic into the domain -> subdomain -> focus_area tree. The
  // synthesizer is the domain-hierarchy strategy: it emits that tree plus the
  // cross_links to the existing nodes each lens surfaced. The OTHER reserved
  // families (framework / trend) stay client_count 0 -- no over-activation; the
  // broader v1.14.0 lens-family migrations are separate phases (163-CONTEXT
  // out-of-scope).
  domain: Object.freeze({
    client_count: 1,
    lens_sets: Object.freeze(['disciplinary', 'stakeholder', 'system', 'temporal', 'scale']),
    synthesizers: Object.freeze(['domain-hierarchy']),
  }),
  // ACTIVATED in Phase 131 (Plan 03): the source family goes from the reserved
  // slot (client_count 0) to the active pilot. The single pilot client is the
  // source-lens driver (lib/lens-engine/source-lens-driver.cjs); its lens names
  // are the context-derived source lenses computeLensSet (Plan 02) produces, each
  // mapping to a Phase 130.5 corpus source. The synthesizer is the source
  // comparison strategy. The OTHER reserved families (domain / framework / trend)
  // stay client_count 0 -- no over-activation; v1.14.0 fans them out.
  source: Object.freeze({
    client_count: 1,
    lens_sets: Object.freeze(['scholarly', 'industry', 'patent', 'brain', 'competitive-intelligence', 'grants']),
    synthesizers: Object.freeze(['source-comparison']),
  }),
  framework: Object.freeze({ client_count: 0, reserved_for: 'v1.14.0' }),
  trend: Object.freeze({ client_count: 0, reserved_for: 'v1.14.0' }),
});

// The rotation modes shipped here. The source-family weighted-by-context mode
// LANDED in Phase 131 (Plan 03) -- it was a documented Phase 130 TODO and is now
// an active ROTATION_MODES member. It runs the lens set ordered by descending
// weight; Phase 265 (Plan 11) moved its dispatch onto the concurrent
// (Promise.all) branch alongside 'parallel' -- see CONCURRENT_MODES below for
// why fetch order never mattered to this mode's caller.
const ROTATION_MODES = Object.freeze(['serial', 'parallel', 'single', 'weighted-by-context']);

// The modes that take the concurrent (Promise.all) dispatch branch below.
// Phase 265 (Plan 11): weighted-by-context joins 'parallel' here because the
// caller (the source-lens driver) supplies the lens array ALREADY ordered by
// descending Plan-02 weight and reads every result back by lens name AFTER
// rotate() returns -- fetch order carries no meaning to that caller, so
// serial dispatch was buying nothing but latency. This is data, not an ||
// chain, so a future mode can join the concurrent set by editing one array.
const CONCURRENT_MODES = Object.freeze(['parallel', 'weighted-by-context']);

// Named lens sets. A named set resolves to its lens array; a caller may also
// pass a dynamic array directly (for example ['black-hat'] for single mode).
const NAMED_LENS_SETS = Object.freeze({
  'six-hats': Object.freeze(['white-hat', 'red-hat', 'black-hat', 'yellow-hat', 'green-hat', 'blue-hat']),
  'black-hat': Object.freeze(['black-hat']),
  // The domain family's five Engine-1 DECOMPOSITION lenses (Canon Part 2 Engine 1).
  // Phase 163 (Plan 03): mirrors the 'six-hats' entry. Resolves to the five lens
  // names rotate() dispatches over to build the domain -> subdomain -> focus_area tree.
  'domain-five': Object.freeze(['disciplinary', 'stakeholder', 'system', 'temporal', 'scale']),
});

const NAMED_SYNTHESIZERS = Object.freeze({
  'tension-map': tensionMap.synthesizeTensionMap,
  'comparison-matrix': comparisonMatrix.synthesizeComparisonMatrix,
  'convergence-map': convergenceMap.synthesizeConvergenceMap,
  // The source-family synthesis strategy (Phase 131). The source-lens driver
  // passes 'source-comparison' by name.
  'source-comparison': sourceComparison.synthesizeSourceComparison,
  // The domain-family synthesis strategy (Phase 163). The domain lens driver (and
  // the Wave-4 trend agent) passes 'domain-hierarchy' by name; the engine hands it
  // the typed lens_finding node array and it emits the domain -> subdomain ->
  // focus_area tree plus the cross_links to the existing nodes each lens surfaced.
  'domain-hierarchy': domainHierarchy.synthesizeDomainHierarchy,
});

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// Resolve the lens array from a named set or a dynamic array. Returns null on a
// non-resolvable input so rotate() can fail defensively.
function resolveLensSet(lensSet) {
  if (Array.isArray(lensSet)) {
    const cleaned = lensSet.filter((l) => typeof l === 'string' && l.length > 0);
    return cleaned.length > 0 ? cleaned : null;
  }
  if (typeof lensSet === 'string' && NAMED_LENS_SETS[lensSet]) {
    return NAMED_LENS_SETS[lensSet].slice();
  }
  return null;
}

// Resolve the synthesize strategy: a named strategy string OR a caller-supplied
// pure function (the engine passes the typed finding-node array to it).
function resolveSynthesizer(synthesize) {
  if (typeof synthesize === 'function') return synthesize;
  if (typeof synthesize === 'string' && NAMED_SYNTHESIZERS[synthesize]) {
    return NAMED_SYNTHESIZERS[synthesize];
  }
  return null;
}

// The persona-aware framing hook (consumes Phase 115 role_blend). Reads USER.md
// via user-md-ops.readUserMd and returns the role_blend tuple (or null). Pure
// read; never throws on a missing / malformed USER.md.
function readRoleBlend(roomDir) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) return null;
  try {
    const userMdPath = roomDir.replace(/\/+$/, '') + '/USER.md';
    const user = userMdOps.readUserMd(userMdPath);
    if (user && isPlainObject(user.role_blend)) return user.role_blend;
  } catch (_e) {
    // Defensive: a persona-read failure must never break a rotation.
  }
  return null;
}

// Emit a memory_event through the navigation chokepoint when a db handle is
// present. Mandatory emission per Canon Part 9; a logging failure never aborts
// the rotation (the event log is best-effort journaling, not the write path).
function emitEvent(db, eventType, payload) {
  if (!db) return;
  try {
    navigation.logMemoryEvent(db, eventType, payload || {});
  } catch (_e) {
    // best-effort
  }
}

// Run one lens: invoke perLensFn with a persona-aware ctx, then (when a db
// handle is present) write the typed lens_finding node via the navigation
// chokepoint and return the typed node object the synthesizer consumes.
async function runOneLens(lens, opts) {
  const { lensType, input, perLensFn, roleBlend, sessionId, db } = opts;
  const ctx = {
    lensType,
    topic: input.topic,
    focusNodeId: input.focusNodeId || null,
    roomDir: input.roomDir,
    role_blend: roleBlend || undefined,
  };
  let finding;
  try {
    finding = await perLensFn(lens, ctx);
  } catch (_e) {
    finding = null;
  }
  if (!isPlainObject(finding)) return null;
  const summary = typeof finding.summary === 'string' ? finding.summary : '';
  const topic = typeof finding.topic === 'string' ? finding.topic : (input.topic || '');

  let nodeId = null;
  if (db) {
    const written = navigation.writeLensFinding(db, {
      lensType,
      lens,
      topic,
      summary,
      sessionId,
    });
    if (written && written.ok) {
      nodeId = written.node_id;
      emitEvent(db, 'lens_finding_written', { lens, lensType, node_id: nodeId });
    }
  }
  // The typed node object the synthesizer receives (id + parsed properties).
  return {
    id: nodeId || ('lens_finding:' + lensType + ':' + sessionId + ':' + lens),
    lens,
    lensType,
    topic,
    summary,
    raw: finding,
  };
}

// The accept path: write an INFORMS edge FROM the lens finding TO the target the
// onAccept hook names; emit lens_finding_accepted. When persistence requests the
// cascade-edge tier AND the finding warrants promotion, route a human-attributed
// promotion through navigation.confirmNode with resolveByUser(roomDir) so a
// proposed lens_finding is promoted to confirmed by a NON-agent byUser (Canon
// Part 9 v1.5). Defensive: an edge failure never aborts the rotation.
function applyAccept(db, node, decision, roomDir, persistence) {
  if (!db || !isPlainObject(decision) || typeof decision.target_id !== 'string') return false;
  const props = {};
  if (typeof decision.reason === 'string') props.reason = decision.reason;
  const edge = navigation.writeEdge(db, {
    source_id: node.id,
    target_id: decision.target_id,
    edge_type: 'INFORMS',
    properties: props,
  });
  if (!edge || !edge.ok) return false;
  emitEvent(db, 'lens_finding_accepted', { lens: node.lens, node_id: node.id, target_id: decision.target_id });
  if (persistence === 'memory_event+cascade-edge' && decision.promote === true) {
    try {
      const byUser = navigation.resolveByUser(roomDir);
      navigation.confirmNode(db, node.id, byUser, typeof decision.reason === 'string' ? decision.reason : undefined);
    } catch (_e) {
      // promotion is best-effort; the INFORMS edge is the load-bearing write.
    }
  }
  return true;
}

// The reject path: write a REJECTED_BECAUSE edge carrying a single enum reason
// scalar (rejection-as-data per Canon Part 4); emit lens_finding_rejected.
function applyReject(db, node, decision) {
  if (!db || !isPlainObject(decision) || typeof decision.target_id !== 'string') return false;
  const reason = typeof decision.reason === 'string' ? decision.reason : 'unspecified';
  const edge = navigation.writeEdge(db, {
    source_id: node.id,
    target_id: decision.target_id,
    edge_type: 'REJECTED_BECAUSE',
    properties: { reason },
  });
  if (!edge || !edge.ok) return false;
  emitEvent(db, 'lens_finding_rejected', { lens: node.lens, node_id: node.id, reason });
  return true;
}

/**
 * rotate(opts) -- the single architectural lens-rotation for-loop.
 * See the module header for the full contract. Returns
 *   { ok:true, findingIds, synthesis, selector }  on success
 *   { ok:false, reason }                            on a defensive rejection
 */
async function rotate(opts) {
  if (!isPlainObject(opts)) {
    return { ok: false, reason: 'invalid_opts' };
  }
  const {
    lensType,
    lensSet,
    input,
    perLensFn,
    synthesize,
    surfaceSelector,
    persistence,
    onAccept,
    onReject,
    rotationMode,
    rejectAll,
  } = opts;

  // Validate the lens family against the registry.
  if (typeof lensType !== 'string' || !Object.prototype.hasOwnProperty.call(LENS_REGISTRY, lensType)) {
    return { ok: false, reason: 'invalid_lens_type' };
  }
  if (LENS_REGISTRY[lensType].client_count === 0) {
    return { ok: false, reason: 'lens_family_reserved' };
  }
  const mode = typeof rotationMode === 'string' ? rotationMode : 'serial';
  if (!ROTATION_MODES.includes(mode)) {
    return { ok: false, reason: 'invalid_rotation_mode' };
  }
  if (typeof perLensFn !== 'function') {
    return { ok: false, reason: 'invalid_per_lens_fn' };
  }
  const inputObj = isPlainObject(input) ? input : {};
  const lenses = resolveLensSet(lensSet);
  if (!lenses) {
    return { ok: false, reason: 'invalid_lens_set' };
  }
  const synthFn = resolveSynthesizer(synthesize);
  if (!synthFn) {
    return { ok: false, reason: 'invalid_synthesize_strategy' };
  }
  // single mode runs exactly one named lens; reject an ambiguous multi-lens set.
  if (mode === 'single' && lenses.length !== 1) {
    return { ok: false, reason: 'single_mode_requires_one_lens' };
  }

  const db = inputObj.db || null;
  const roomDir = typeof inputObj.roomDir === 'string' ? inputObj.roomDir : '';
  const sessionId = typeof inputObj.sessionId === 'string' && inputObj.sessionId.length > 0
    ? inputObj.sessionId
    : 's' + Date.now();

  // Mandatory emission: one lens_rotation_started per rotate() call.
  emitEvent(db, 'lens_rotation_started', { lensType, mode, lens_count: lenses.length, topic: inputObj.topic || '' });

  // The persona-aware framing hook (Phase 115 role_blend), read once per rotate.
  const roleBlend = readRoleBlend(roomDir);

  const runOpts = { lensType, input: inputObj, perLensFn, roleBlend, sessionId, db };

  // The single for-loop, dispatched by rotation mode.
  let findingNodes = [];
  if (CONCURRENT_MODES.includes(mode)) {
    // parallel AND weighted-by-context (Phase 265, Plan 11) share this branch.
    // Promise.all is used deliberately, NOT the settle-every-promise variant:
    // the serial path below also propagates a throw, so keeping Promise.all
    // keeps rejection semantics IDENTICAL between the two branches and
    // leaves /mos:persona --parallel's existing behavior untouched.
    // Swallowing a rejection here would reintroduce this repo's standing
    // silent-success bug class -- a partial result reported as complete.
    // See T-265-46 in this plan's threat model.
    findingNodes = await Promise.all(lenses.map((lens) => runOneLens(lens, runOpts)));
    // ORDER GUARANTEE: Promise.all resolves its array in INPUT order, not
    // completion order, so findingNodes (and therefore findingIds below) stay
    // in the same descending-weight order the serial loop would have
    // produced. The accept/reject hook loop further down iterates this same
    // ordered array, so a fast lens can never jump the queue in the output.
  } else {
    // serial AND single share the sequential path. single has exactly one
    // lens. weighted-by-context moved to the concurrent branch above in
    // Phase 265 (Plan 11); the weighting itself is still OWNED by Plan 02's
    // computeLensSet, which this engine never recomputes -- only the
    // dispatch mechanics changed, not who decides the order.
    for (const lens of lenses) {
      findingNodes.push(await runOneLens(lens, runOpts));
    }
  }
  findingNodes = findingNodes.filter((n) => isPlainObject(n));
  const findingIds = findingNodes.map((n) => n.id);

  // Accept / reject hooks. The engine surfaces each finding to the caller's
  // hook; the hook returns a decision object the engine routes through the
  // navigation chokepoint (INFORMS on accept, REJECTED_BECAUSE on reject).
  for (const node of findingNodes) {
    if (rejectAll === true && typeof onReject === 'function') {
      applyReject(db, node, onReject(node.lens, node.raw));
      continue;
    }
    if (typeof onAccept === 'function') {
      const decision = onAccept(node.lens, node.raw);
      if (isPlainObject(decision)) {
        applyAccept(db, node, decision, roomDir, persistence);
      }
    }
    if (typeof onReject === 'function' && rejectAll !== true) {
      // onReject only fires when the hook explicitly returns a decision object
      // (a no-op return means the finding was not rejected).
      const decision = onReject(node.lens, node.raw);
      if (isPlainObject(decision) && decision.reject === true) {
        applyReject(db, node, decision);
      }
    }
  }

  // Synthesize over the TYPED finding nodes (NOT the raw perLensFn arrays).
  let synthesis;
  try {
    synthesis = synthFn(findingNodes);
  } catch (_e) {
    synthesis = { ok: false, reason: 'synthesize_failed' };
  }
  emitEvent(db, 'lens_synthesis_completed', { lensType, finding_count: findingNodes.length });

  // Dispatch the F-shape surface selector (Phase 88.2 substrate).
  let selector = null;
  const requestedShape = typeof surfaceSelector === 'string' ? surfaceSelector : 'F.1';
  try {
    selector = selectorDispatcher.dispatchShapeFSubShape(requestedShape, {
      roomDir,
      tier: inputObj.tier || 0,
      mode: inputObj.selectorMode || 'B',
      payload: { topic: inputObj.topic || '' },
    });
  } catch (_e) {
    selector = { shape: requestedShape, rendered: null };
  }

  return { ok: true, findingIds, synthesis, selector };
}

module.exports = { rotate, LENS_REGISTRY, ROTATION_MODES };
