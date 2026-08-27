'use strict';
// Phase 141-03 (RETR-01/03/04) -- getRoomContext: the 100%-local, in-process,
// three-leg fusion that lets Larry walk the room graph mid-conversation, seeded
// by the last ~2 conversation turns. It is the substrate behind the Capability
// Dial's "Context Block" reach.
//
// Composition NOT duplication (Canon Part 7): this module copies the compose-
// from-the-shipped-readers SHAPE of the Brain-packet builder but calls the three
// SHIPPED legs as-is. It NEVER imports the egress projection helpers -- those
// hash prose under the default local_summary_only mode (the RETR-03 egress
// antipattern). Larry needs RAW prose for in-process reasoning, so this fusion
// reuses the room-home.cjs raw safeShape path instead.
//
// Canon Part 8: the output feeds Larry's IN-PROCESS reasoning and MUST NOT cross
// the wire. Zero Brain calls, zero hashing, zero non-SQLite reads (Part 9). The
// db handle is owned by the caller (mirror evidence-claim.cjs): this module
// NEVER requires node:sqlite and NEVER opens room.db, keeping it inside the
// navigation allow-list (scripts/check-substrate.cjs regex /^lib\/core\/navigation\//).
//
// Canon Part 9: getRoomContext is the "Larry explains" face of SQL-as-local-mind.
// SELECT supersedes folder scanning. House rule: hyphens only, no em-dashes.

const { getNeighborhood } = require('./neighborhood.cjs');
const { getRoomHomeView } = require('./room-home.cjs');
const { getSessionHistory } = require('../memory-ops.cjs');
// Phase 160-03 (R5 / D-03): the APP-SIDE recency decay blend. Leg D fetches the
// cortex recency-ordered in SQL, then blends 0.995^(delta-h) here -- the visible
// decay constant lives in recency-decay.cjs so the Leg D ranking is frozen-tested.
// recency-decay.cjs is pure (zero requires) so it is a safe eager import.
const { rankByRecency } = require('../temporal/recency-decay.cjs');
// reference-now.cjs is loaded LAZILY inside resolveReferenceMs (not at module
// init) to break a require cycle: reference-now -> feynman/timeline-renderer ->
// navigation.cjs -> navigation/room-context (this file). A lazy require resolves
// the module after the cycle has settled, so getReferenceNow is fully defined at
// call time. The golden-file guard injects opts.now, bypassing this path entirely.

// Leg B windowing defaults (Claude's Discretion per CONTEXT D-04 / RESEARCH
// "Window size N"): the most recent session, its last ~6 fragments, each capped
// so an unbounded fragment dump cannot blow the 1200ms NAV budget (T-141-05).
const DEFAULT_FRAGMENT_WINDOW = 6;
const DEFAULT_FRAGMENT_CHAR_CAP = 400;
const DEFAULT_TOP_K = 10;
const DEFAULT_MAX_DEPTH = 2;
// How many of the most recent windowed fragments seed the focus-node resolver.
const SEED_FRAGMENT_COUNT = 2;

// Phase 270-09 (RESEARCH.md 3.2, Assumption A1): a char-count proxy, not a
// tokenizer. RESEARCH.md's Don't Hand-Roll table forbids vendoring a
// tokenizer for an estimate. This number is comparable only against another
// number produced by this same divisor (the same discipline
// tests/test-270-tool-schema-budget.cjs's approxTokens follows).
const CHARS_PER_TOKEN_PROXY = 4;

// Leg A: room-state summary via the shipped raw-prose driver. Reuse as-is.
function legA(db, roomId, opts) {
  try {
    return getRoomHomeView(db, roomId, opts);
  } catch (_) {
    return null;
  }
}

// Leg B: window the verbatim session history to the most recent session's last
// N fragments, with a per-fragment char cap. RAW role/content/timestamp out --
// never a hash. This windowing/trim is the net-new step over getSessionHistory.
async function legB(db, fragmentWindow, charCap) {
  let sessions = [];
  try {
    sessions = await getSessionHistory(db, 1);
  } catch (_) {
    sessions = [];
  }
  if (!Array.isArray(sessions) || sessions.length === 0) return [];

  const mostRecent = sessions[0];
  const frags = Array.isArray(mostRecent.fragments) ? mostRecent.fragments : [];
  const windowed = frags.slice(-fragmentWindow);

  return windowed.map((f) => {
    const content = typeof f.content === 'string' ? f.content : '';
    const capped = content.length > charCap ? content.slice(0, charCap - 3) + '...' : content;
    return {
      role: f.role,
      content: capped, // RAW prose (RETR-03) -- never hashed.
      timestamp: f.timestamp,
      sectionContext: f.section_context || null,
    };
  });
}

// Leg C seed resolver (the load-bearing new wiring). Take the last ~2 windowed
// fragments and resolve a focus node:
//   1. match a fragment's section_context to a section:<context> node id
//   2. cheap lexical fallback against nodes.properties for the same section
// Guard with the ensureNodeExists idiom (mirror focus.cjs:101-104) before
// returning the id. A bad/unknown seed returns null, so Leg C degrades to [].
function resolveSeedNode(db, windowedFragments) {
  if (!Array.isArray(windowedFragments) || windowedFragments.length === 0) return null;
  const seeds = windowedFragments.slice(-SEED_FRAGMENT_COUNT);

  // Pass 1: section_context -> section:<context> node id (the primary path).
  for (let i = seeds.length - 1; i >= 0; i--) {
    const sc = seeds[i] && seeds[i].sectionContext;
    if (typeof sc === 'string' && sc.length > 0) {
      const candidate = 'section:' + sc;
      const row = db.prepare('SELECT id FROM nodes WHERE id = ?').get(candidate);
      if (row) return candidate;
    }
  }

  // Pass 2: cheap lexical fallback -- the most recently touched node whose
  // source_section matches a seed fragment's section_context. Bound params
  // only (T-141-06: never string-concat fragment text into SQL).
  for (let i = seeds.length - 1; i >= 0; i--) {
    const sc = seeds[i] && seeds[i].sectionContext;
    if (typeof sc === 'string' && sc.length > 0) {
      const row = db.prepare(
        'SELECT id FROM nodes WHERE source_section = ? ORDER BY last_seen_at DESC LIMIT 1'
      ).get(sc);
      if (row && row.id) return row.id;
    }
  }

  return null;
}

// Leg C: ranked graph neighbors around the conversation-derived focus node.
function legC(db, focusNodeId, topK, maxDepth) {
  if (!focusNodeId) return [];
  try {
    return getNeighborhood(db, focusNodeId, { topK, maxDepth }) || [];
  } catch (_) {
    return [];
  }
}

// Phase 150-04 (MEM-03): the projected cortex node types Leg D SELECTs over.
// These are the 150-01 writer node types (lib/core/navigation/memory-artifacts.cjs):
//   memory_artifact   -- the 6 user-memory MD files (ROOM/STATE/MINTO/BRAIN/FEYNMAN/USER)
//   governing_thought -- the MINTO governing-thought projection
//   navigator_persona -- the USER role-blend x journey-stage projection
//   decision          -- the MINTO/decisions decision_log projection (TRUTH-CLAIM)
//   claim             -- the Phase 150.8 typed truth-claim (DIKW knowledge node)
// Frozen so the SELECT cannot be widened by a caller; legD stays a closed read.
//
// Phase 150.8-04 (DIKW-09): 'claim' is added ADDITIVELY so legD surfaces typed
// truth-claim nodes (lib/core/navigation/typed-claim.cjs writeClaimNode) to the
// cortex-reach adapter (lib/hmi/cortex-reach-adapter.cjs CORTEX_NODE_TYPES mirrors
// this list per the lockstep comment). legD still returns RAW-LOCAL node fields
// only (id / type / properties / review_status) -- presence + enums, NO prose
// egress (the Part-8 LOCAL-reasoning discipline below is unchanged).
const CORTEX_NODE_TYPES = Object.freeze([
  'memory_artifact',
  'governing_thought',
  'navigator_persona',
  'decision',
  'claim',
]);

// Leg D: surface the projected cortex as RAW-LOCAL node fields, RECENCY-RANKED
// (Phase 150-04 MEM-03 + Phase 160-03 R5 / D-03).
//
// A single caller-owned-db, in-room SELECT over the five 150-01 projected cortex
// node types. Mirrors legA/legC: it NEVER opens room.db, NEVER imports the egress
// projection helpers, and returns RAW-LOCAL node fields (id / type / properties /
// review_status + the new created_at / last_seen_at date scalars) exactly like the
// other legs -- NO content-digest hashing, NO egress. This is the Part-8
// LOCAL-reasoning discipline the module header mandates: the cortex feeds Larry's
// in-process routing, never the wire (threat T-150-04-01).
//
// Phase 160-03 (R5 / D-03): the cortex no longer sorts alphabetically. It SELECTs
// created_at + last_seen_at and fetches ORDER BY created_at DESC (the recency-
// ordered fetch), then blends the 0.995^(delta-h) decay APP-SIDE via rankByRecency
// against getReferenceNow() so the more-recent cortex node ranks first. The decay
// constant is visible in recency-decay.cjs (never buried in this SQL), and the
// determinism is guarded by tests/test-legd-recency-golden.cjs. The reference
// clock is injectable via opts.now (the D-01a options.now seam) so the golden-file
// guard fixes a frozen reference; absent an injected clock, getReferenceNow()
// (Phase 160-01) supplies the authoritative LOCAL reference -- no network read.
//
// Defensive: a single try/catch defaulting to [] so a legD fault degrades
// cortexNodes to [] without blowing the 1200ms NAV budget (threat T-150-04-04)
// and without disturbing the other legs. The properties string is parsed
// best-effort; a malformed properties row falls back to the raw string.
function legD(db, _roomId, opts) {
  if (!db || typeof db.prepare !== 'function') return [];
  try {
    const placeholders = CORTEX_NODE_TYPES.map(() => '?').join(', ');
    const rows = db.prepare(
      'SELECT id, type, properties, review_status, source_section, created_at, last_seen_at ' +
      'FROM nodes WHERE type IN (' + placeholders + ') ' +
      'ORDER BY created_at DESC'
    ).all(...CORTEX_NODE_TYPES);
    if (!Array.isArray(rows)) return [];
    const mapped = rows.map((r) => {
      let props = null;
      if (typeof r.properties === 'string' && r.properties.length > 0) {
        try { props = JSON.parse(r.properties); } catch (_) { props = r.properties; }
      }
      return {
        id: r.id,                       // RAW-local node id, present verbatim.
        type: r.type,                   // one of CORTEX_NODE_TYPES.
        properties: props,              // RAW-local properties (handles/enums only by 150-01 contract).
        review_status: r.review_status, // proposed/confirmed -- the truth state.
        sourceSection: r.source_section || null,
        created_at: typeof r.created_at === 'number' ? r.created_at : null, // RAW-local date scalar.
        last_seen_at: typeof r.last_seen_at === 'number' ? r.last_seen_at : null, // RAW-local date scalar.
      };
    });
    // APP-SIDE decay blend (D-03): resolve the authoritative reference clock once
    // (opts.now wins for test determinism; else getReferenceNow()), then rank.
    const referenceMs = resolveReferenceMs(opts);
    return rankByRecency(mapped, referenceMs);
  } catch (_) {
    return [];
  }
}

// Resolve the reference clock for the Leg D recency blend. opts.now is the D-01a
// clock seam: a number, or a function returning a number (the options.now
// closure shape), wins so the golden-file guard injects a frozen reference.
// Absent an injected clock, getReferenceNow() supplies the authoritative LOCAL
// reference (no network). Degrades to Date.now() if anything throws.
function resolveReferenceMs(opts) {
  try {
    const now = opts && opts.now;
    if (typeof now === 'number' && Number.isFinite(now)) return now;
    if (typeof now === 'function') {
      const v = now();
      if (typeof v === 'number' && Number.isFinite(v)) return v;
    }
    // Lazy require breaks the reference-now -> timeline-renderer -> navigation ->
    // room-context cycle (see the import note above).
    const { getReferenceNow } = require('../temporal/reference-now.cjs');
    const ref = getReferenceNow(opts && typeof opts === 'object' ? opts : undefined);
    if (ref && typeof ref.referenceMs === 'number' && Number.isFinite(ref.referenceMs)) {
      return ref.referenceMs;
    }
  } catch (_) { /* degrade below */ }
  return Date.now();
}

/**
 * Local in-process 3-leg fusion. 100% local. NEVER egresses. Canon Part 8 + 9.
 *
 * @param {import('node:sqlite').DatabaseSync} db caller-owned room.db handle
 * @param {string} roomId the room id (for Leg A's room: root composition)
 * @param {object} [opts] { seedFragments?, topK?, fragmentWindow?, maxDepth? }
 * @returns {Promise<{summary, recentMessages, relevantNodes, cortexNodes, _meta}>}
 */
async function getRoomContext(db, roomId, opts) {
  const options = opts || {};
  const fragmentWindow = Number.isInteger(options.fragmentWindow) && options.fragmentWindow > 0
    ? options.fragmentWindow
    : DEFAULT_FRAGMENT_WINDOW;
  const charCap = Number.isInteger(options.fragmentCharCap) && options.fragmentCharCap > 0
    ? options.fragmentCharCap
    : DEFAULT_FRAGMENT_CHAR_CAP;
  const topK = Number.isInteger(options.topK) && options.topK > 0 ? options.topK : DEFAULT_TOP_K;
  const maxDepth = Number.isInteger(options.maxDepth) && options.maxDepth >= 1
    ? options.maxDepth
    : DEFAULT_MAX_DEPTH;

  const tA = process.hrtime.bigint();
  const summary = legA(db, roomId, options);
  const tB = process.hrtime.bigint();

  // Leg B: prefer caller-provided seedFragments (the per-turn hot-path lane),
  // else window the most recent stored session.
  let recentMessages;
  if (Array.isArray(options.seedFragments) && options.seedFragments.length > 0) {
    recentMessages = options.seedFragments.slice(-fragmentWindow).map((f) => {
      const content = typeof f === 'string' ? f : (f && (f.content || f.text) || '');
      const capped = content.length > charCap ? content.slice(0, charCap - 3) + '...' : content;
      return {
        role: (f && f.role) || 'user',
        content: capped,
        timestamp: (f && f.timestamp) || null,
        sectionContext: (f && (f.section_context || f.sectionContext)) || null,
      };
    });
  } else {
    recentMessages = await legB(db, fragmentWindow, charCap);
  }
  const tC = process.hrtime.bigint();

  // Leg C: derive the focus node from the last ~2 messages, then rank neighbors.
  const seedNodeId = resolveSeedNode(db, recentMessages);
  const relevantNodes = legC(db, seedNodeId, topK, maxDepth);
  const tD = process.hrtime.bigint();

  // Leg D (Phase 150-04 MEM-03 + Phase 160-03 R5): surface the projected cortex
  // RAW-LOCAL, recency-ranked app-side. options is threaded so the golden-file
  // guard can inject a frozen reference clock via options.now (D-01a). Defaults
  // to [] on any partial-leg failure, so the field is always an array.
  const cortexNodes = legD(db, roomId, options) || [];
  const tEnd = process.hrtime.bigint();

  // Phase 270-09 (MEMOP-11/12): a char/byte cost estimate alongside the
  // existing legTimingsMs. Cheap by construction -- the legs already have
  // their strings in hand at this point, so this ADDS a measurement pass,
  // never a second fetch. Measured in BYTES via Buffer.byteLength(JSON.
  // stringify(leg), 'utf8'), not JS string .length, so a multi-byte
  // character never silently under-counts (the same convention
  // tests/test-270-tool-schema-budget.cjs's own measure() uses). Mirrors
  // legTimingsMs's exact shape ({ legA, legB, legC, legD }) plus a `total`.
  function legBytes(leg) {
    try {
      return Buffer.byteLength(JSON.stringify(leg === undefined ? null : leg), 'utf8');
    } catch (_) {
      return 0;
    }
  }
  const legCostBytes = {
    legA: legBytes(summary),
    legB: legBytes(recentMessages),
    legC: legBytes(relevantNodes),
    legD: legBytes(cortexNodes),
  };
  legCostBytes.total = legCostBytes.legA + legCostBytes.legB + legCostBytes.legC + legCostBytes.legD;
  const legCostChars = legCostBytes; // byte count is the measurement used; see the comment above.
  const legCostTokensApprox = {
    legA: Math.round(legCostBytes.legA / CHARS_PER_TOKEN_PROXY),
    legB: Math.round(legCostBytes.legB / CHARS_PER_TOKEN_PROXY),
    legC: Math.round(legCostBytes.legC / CHARS_PER_TOKEN_PROXY),
    legD: Math.round(legCostBytes.legD / CHARS_PER_TOKEN_PROXY),
    total: Math.round(legCostBytes.total / CHARS_PER_TOKEN_PROXY),
  };

  // opts.estimateOnly (MEMOP-12): "see the cost before you pay it". All four
  // legs above are ALREADY cheap and bounded by design (the window/cap/topK/
  // frozen-5-types discipline this file's own comments document, inside the
  // same 1200ms NAV budget every normal call already respects) -- so the
  // honest "cheap structural work" IS the real computation above; there is
  // no cheaper-but-inexact path for any of the four legs that would not
  // itself risk mis-sizing the estimate. Every leg below is therefore an
  // EXACT size, not a guess: estimateOnly nulls the BODIES the caller would
  // otherwise pay context-window cost to receive, while keeping the exact
  // cost numbers already computed above.
  const estimateOnly = options.estimateOnly === true;

  // Defensive structured return even on partial-leg failure. cortexNodes is
  // purely ADDITIVE: every existing field (summary, recentMessages, relevantNodes,
  // _meta) stays byte-stable so the Phase 142 getRoomContext->decide() wire and the
  // dial's existing reads are unaffected. legCostChars/legCostTokensApprox and
  // estimateOnly are ALSO purely additive (Phase 270-09): a call with no
  // opts.estimateOnly returns byte-identical bodies to before this change,
  // plus the two new _meta keys.
  return {
    summary: estimateOnly ? null : summary,
    recentMessages: estimateOnly ? null : recentMessages,
    relevantNodes: estimateOnly ? null : relevantNodes,
    cortexNodes: estimateOnly ? null : cortexNodes,
    _meta: {
      seedNodeId: seedNodeId || null,
      fragmentWindow,
      topK,
      maxDepth,
      legTimingsMs: {
        legA: Number(tB - tA) / 1e6,
        legB: Number(tC - tB) / 1e6,
        legC: Number(tD - tC) / 1e6,
        legD: Number(tEnd - tD) / 1e6,
      },
      legCostChars,
      legCostTokensApprox,
      estimateOnly,
    },
  };
}

module.exports = {
  getRoomContext,
  // Phase 150.8-04 (DIKW-09): surfaced so the cortex-reach claim-branch test can
  // assert the CORTEX_NODE_TYPES mirror between this module and the adapter.
  CORTEX_NODE_TYPES,
  // Phase 270-09 (MEMOP-11/12): the single named home for the char/token
  // divisor, exported so a future recalibration is one edit.
  CHARS_PER_TOKEN_PROXY,
};
