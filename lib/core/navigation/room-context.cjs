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
// Phase 347-06 (WD-347-4): the excluded node type is IMPORTED from the
// chain-state.cjs writer's own export, never re-typed as a string literal
// here, so the two modules cannot silently drift apart on the type name.
const { CHAIN_STATE_NODE_TYPE } = require('./chain-state.cjs');
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

// Phase 372 (SEED-134 Plan 01, D2/D8): the closed set of reasons a leg can name
// in _meta.omitted. This is the shared enum: the SessionStart envelope may adopt
// it later, it is NOT coupled to it in this phase. No depth reason exists on
// purpose (D4): knowing that max_depth cut nodes off needs an extra traversal.
const OMITTED_REASONS = Object.freeze([
  'leg_failed',
  'type_excluded',
  'top_k_cap',
  'char_cap',
  'window_cap',
  'estimate_only',
]);

// An error class name is the only error text that may enter _meta.omitted. The
// message, the stack and any error code can carry room content, so they never
// enter (T-372-01). A name that does not match the pattern becomes 'Error'.
const ERROR_LABEL_PATTERN = /^[A-Za-z][A-Za-z0-9_]{0,40}$/;
function errorClassLabel(err) {
  const name = err && typeof err === 'object' ? err.name : null;
  return typeof name === 'string' && ERROR_LABEL_PATTERN.test(name) ? name : 'Error';
}

// Phase 372 (D2): one collector for each getRoomContext call, threaded as the
// last parameter of each leg. No module-level state: the MCP tool serves
// concurrent sessions. One entry for each (leg, reason); the first entry wins.
// A count is a positive integer or null; 0 is never recorded (unknown is null).
function createOmissionCollector() {
  const entries = [];
  const seen = new Set();
  return {
    add(leg, reason, count, detail) {
      if (OMITTED_REASONS.indexOf(reason) === -1) return;
      if (count === 0) return;
      const key = leg + '|' + reason;
      if (seen.has(key)) return;
      seen.add(key);
      const safeCount = Number.isInteger(count) && count > 0 ? count : null;
      entries.push({ leg, reason, count: safeCount, detail });
    },
    toArray() {
      return entries.map((e) => ({ leg: e.leg, reason: e.reason, count: e.count, detail: e.detail }));
    },
  };
}

// Leg A: room-state summary via the shipped raw-prose driver. Reuse as-is.
function legA(db, roomId, opts, omit) {
  try {
    return getRoomHomeView(db, roomId, opts);
  } catch (err) {
    omit.add('legA', 'leg_failed', null, errorClassLabel(err));
    return null;
  }
}

// Leg B: window the verbatim session history to the most recent session's last
// N fragments, with a per-fragment char cap. RAW role/content/timestamp out --
// never a hash. This windowing/trim is the net-new step over getSessionHistory.
async function legB(db, fragmentWindow, charCap, omit) {
  let sessions = [];
  try {
    sessions = await getSessionHistory(db, 1);
  } catch (err) {
    omit.add('legB', 'leg_failed', null, errorClassLabel(err));
    sessions = [];
  }
  if (!Array.isArray(sessions) || sessions.length === 0) return [];

  const mostRecent = sessions[0];
  const frags = Array.isArray(mostRecent.fragments) ? mostRecent.fragments : [];
  const windowed = frags.slice(-fragmentWindow);
  // Phase 372 (D5): both counts are free, known at slice and map time.
  if (frags.length - windowed.length > 0) {
    omit.add('legB', 'window_cap', frags.length - windowed.length, 'fragment_window');
  }

  let cutCount = 0;
  const mapped = windowed.map((f) => {
    const content = typeof f.content === 'string' ? f.content : '';
    if (content.length > charCap) cutCount += 1;
    const capped = content.length > charCap ? content.slice(0, charCap - 3) + '...' : content;
    return {
      role: f.role,
      content: capped, // RAW prose (RETR-03) -- never hashed.
      timestamp: f.timestamp,
      sectionContext: f.section_context || null,
    };
  });
  if (cutCount > 0) omit.add('legB', 'char_cap', cutCount, 'fragment_char_cap');
  return mapped;
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

// Phase 347-06 (WD-347-4, docs/2026-09-14-CHAIN-SHARED-STATE-CONTRACT.md):
// the ranked-neighborhood dilution guard. The dogfood room already measures
// 5,535 memory_event of 8,467 nodes (65 percent bookkeeping); adding
// chain_state as a third bookkeeping type to Leg C's ranked set would
// dilute every context_assemble call in every room forever. Volume is not
// the risk, ranked-query dilution is (Assumptions Log entry A4,
// 347-RESEARCH.md). A single frozen set with exactly one member, applied
// APP-SIDE in legC only below -- NEVER in NEIGHBORHOOD_SQL or
// lib/core/navigation/neighborhood.cjs, which stay a closed graph primitive
// so every other getNeighborhood caller keeps seeing every type. Cheap to
// reverse: remove the one member from this set.
const RANKED_EXCLUDED_NODE_TYPES = Object.freeze([CHAIN_STATE_NODE_TYPE]);

// WD-347-4's carve-out: drop a ranked row whose type is excluded, UNLESS the
// focus node itself is of an excluded type -- an explicit focus on a
// chain_state record must still reach its own siblings (the exclusion is a
// default, not a wall). The focus-type lookup is one prepared SELECT bound
// with a placeholder, mirroring the anchor-existence check chain-state.cjs
// already uses for the same shape of question.
function filterRankedExclusions(db, focusNodeId, rows, omit) {
  let focusType = null;
  try {
    const focusRow = db.prepare('SELECT type FROM nodes WHERE id = ?').get(focusNodeId);
    focusType = focusRow ? focusRow.type : null;
  } catch (err) {
    omit.add('legC', 'leg_failed', null, errorClassLabel(err));
    focusType = null;
  }
  if (focusType && RANKED_EXCLUDED_NODE_TYPES.indexOf(focusType) !== -1) return rows;
  const kept = rows.filter((r) => RANKED_EXCLUDED_NODE_TYPES.indexOf(r.type) === -1);
  // Phase 372 (D5): the dropped count is rows before minus rows after. The
  // detail is built from the frozen exclusion set, never from a row.
  const dropped = rows.length - kept.length;
  if (dropped > 0) {
    const matched = RANKED_EXCLUDED_NODE_TYPES.filter((t) => rows.some((r) => r.type === t));
    omit.add('legC', 'type_excluded', dropped, matched.join(','));
  }
  return kept;
}

// Leg C: ranked graph neighbors around the conversation-derived focus node.
//
// Phase 372 (D1): ask for topK + 1 rows in the same single query. A row beyond
// topK proves the cap cut the ranked set (top_k_cap, count unknown, so null).
// Only the first topK rows go on to the filter, exactly as before. The golden
// snapshot and the tie probe in tests/helpers/fixture-room-372.cjs gate this.
function legC(db, focusNodeId, topK, maxDepth, omit) {
  if (!focusNodeId) return [];
  try {
    const fetched = getNeighborhood(db, focusNodeId, { topK: topK + 1, maxDepth }) || [];
    let rows = fetched;
    if (fetched.length > topK) {
      omit.add('legC', 'top_k_cap', null, 'top_k');
      rows = fetched.slice(0, topK);
    }
    return filterRankedExclusions(db, focusNodeId, rows, omit);
  } catch (err) {
    omit.add('legC', 'leg_failed', null, errorClassLabel(err));
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
function legD(db, _roomId, opts, omit) {
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
  } catch (err) {
    omit.add('legD', 'leg_failed', null, errorClassLabel(err));
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

  // Phase 372: one collector for this call. It feeds _meta.omitted at the end.
  const omit = createOmissionCollector();

  const tA = process.hrtime.bigint();
  const summary = legA(db, roomId, options, omit);
  const tB = process.hrtime.bigint();

  // Leg B: prefer caller-provided seedFragments (the per-turn hot-path lane),
  // else window the most recent stored session.
  let recentMessages;
  if (Array.isArray(options.seedFragments) && options.seedFragments.length > 0) {
    const seedWindowed = options.seedFragments.slice(-fragmentWindow);
    // Phase 372 (D5): the same two free counts as legB, for the seed lane.
    if (options.seedFragments.length - seedWindowed.length > 0) {
      omit.add('legB', 'window_cap', options.seedFragments.length - seedWindowed.length, 'fragment_window');
    }
    let seedCutCount = 0;
    recentMessages = seedWindowed.map((f) => {
      const content = typeof f === 'string' ? f : (f && (f.content || f.text) || '');
      if (content.length > charCap) seedCutCount += 1;
      const capped = content.length > charCap ? content.slice(0, charCap - 3) + '...' : content;
      return {
        role: (f && f.role) || 'user',
        content: capped,
        timestamp: (f && f.timestamp) || null,
        sectionContext: (f && (f.section_context || f.sectionContext)) || null,
      };
    });
    if (seedCutCount > 0) omit.add('legB', 'char_cap', seedCutCount, 'fragment_char_cap');
  } else {
    recentMessages = await legB(db, fragmentWindow, charCap, omit);
  }
  const tC = process.hrtime.bigint();

  // Leg C: derive the focus node from the last ~2 messages, then rank neighbors.
  //
  // Phase 347-06 (SHARED-05): options.focusNodeId is a caller-supplied lane,
  // additive only. A call carrying no options.focusNodeId is byte-identical
  // to the pre-347-06 path: the fragment-derived fallback below still runs
  // exactly as it did, over exactly the same recentMessages. _meta.seedNodeId
  // at :355 already echoes whichever value won this ternary, so no new
  // reporting surface was needed to make the seam observable. This is the
  // Phase 347 amendment to Phase 344 working decision WD-5 ("one context
  // assembler is the goal... this phase changes no assembly path",
  // docs/LAYER-CONTRACT.md:106): Phase 344 declared the goal and measured
  // the two budgets without touching assembly; this plan is the one that
  // amends it, on the record, recorded as Assumptions Log entry A7 in
  // 347-RESEARCH.md.
  const seedNodeId = (typeof options.focusNodeId === 'string' && options.focusNodeId.length > 0)
    ? options.focusNodeId
    : resolveSeedNode(db, recentMessages);
  const relevantNodes = legC(db, seedNodeId, topK, maxDepth, omit);
  const tD = process.hrtime.bigint();

  // Leg D (Phase 150-04 MEM-03 + Phase 160-03 R5): surface the projected cortex
  // RAW-LOCAL, recency-ranked app-side. options is threaded so the golden-file
  // guard can inject a frozen reference clock via options.now (D-01a). Defaults
  // to [] on any partial-leg failure, so the field is always an array.
  const cortexNodes = legD(db, roomId, options, omit) || [];
  const tEnd = process.hrtime.bigint();

  // Leg E (Phase 353 Plan 01, criterion 2): the per-turn self-location read.
  // Reads AT MOST two things from disk, through lib/core/room-map.cjs's OWN
  // reader + renderer (never a re-parse of ROOM.md frontmatter inline): the
  // rendered icm_self block of the active focus folder, and the room root's.
  // Lazy-required (not at file top) to match this file's own established
  // cycle-avoidance discipline for anything not proven acyclic; room-map.cjs
  // has no upward dependency on navigation.cjs or this file, but the lazy
  // require costs nothing and keeps that invariant visibly enforced here too.
  // Purely additive: no existing return field changes shape or meaning.
  // Zero network, zero writes -- readRoomMap only ever reads a JSON file
  // already on disk; renderSelfBlock is a pure string formatter.
  let legEText = '';
  try {
    const roomDirForFocus = typeof options.roomDir === 'string' && options.roomDir.length > 0
      ? options.roomDir
      : null;
    if (roomDirForFocus) {
      // eslint-disable-next-line global-require
      const roomMapMod = require('../room-map.cjs');
      const stored = roomMapMod.readRoomMap(roomDirForFocus);
      if (stored.ok && stored.map && Array.isArray(stored.map.nodes)) {
        const nodes = stored.map.nodes;
        const rootNode = nodes.find((n) => n.path === '.') || null;
        let focusNode = rootNode;
        if (typeof options.focusNodeId === 'string' && options.focusNodeId.length > 0
          && db && typeof db.prepare === 'function') {
          try {
            const row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(options.focusNodeId);
            const props = row && row.properties ? JSON.parse(row.properties) : null;
            const sectionSlug = props && typeof props.section === 'string' ? props.section : '';
            const matched = sectionSlug ? nodes.find((n) => n.path === sectionSlug) : null;
            if (matched) focusNode = matched;
          } catch (focusErr) {
            // Soft-fail to the room-root focus; never let a malformed focus
            // node or an absent properties blob break this leg. Phase 372:
            // the fault is named as legE leg_failed (class name only).
            omit.add('legE', 'leg_failed', null, errorClassLabel(focusErr));
          }
        }
        const blockTexts = [];
        if (rootNode) blockTexts.push(roomMapMod.renderSelfBlock(rootNode));
        if (focusNode && focusNode !== rootNode) blockTexts.push(roomMapMod.renderSelfBlock(focusNode));
        legEText = blockTexts.join('\n');
      }
    }
  } catch (mapErr) {
    omit.add('legE', 'leg_failed', null, errorClassLabel(mapErr));
    legEText = ''; // no map, no roomDir, or any other fault: empty, zero cost, never throws.
  }
  const tG = process.hrtime.bigint();

  // Phase 270-09 (MEMOP-11/12): a char/byte cost estimate alongside the
  // existing legTimingsMs. Cheap by construction -- the legs already have
  // their strings in hand at this point, so this ADDS a measurement pass,
  // never a second fetch. Measured in BYTES via Buffer.byteLength(JSON.
  // stringify(leg), 'utf8'), not JS string .length, so a multi-byte
  // character never silently under-counts (the same convention
  // tests/test-270-tool-schema-budget.cjs's own measure() uses). Mirrors
  // legTimingsMs's exact shape ({ legA, legB, legC, legD }) plus a `total`
  // (Phase 353 Plan 01 adds a fifth member, legE, alongside it below).
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
    // legEText is already a string, not an object needing JSON.stringify:
    // a raw Buffer.byteLength keeps its multi-byte-safe measurement without
    // adding the two JSON quote bytes legBytes would otherwise count.
    legE: Buffer.byteLength(legEText, 'utf8'),
  };
  legCostBytes.total = legCostBytes.legA + legCostBytes.legB + legCostBytes.legC + legCostBytes.legD + legCostBytes.legE;
  const legCostChars = legCostBytes; // byte count is the measurement used; see the comment above.
  const legCostTokensApprox = {
    legA: Math.round(legCostBytes.legA / CHARS_PER_TOKEN_PROXY),
    legB: Math.round(legCostBytes.legB / CHARS_PER_TOKEN_PROXY),
    legC: Math.round(legCostBytes.legC / CHARS_PER_TOKEN_PROXY),
    legD: Math.round(legCostBytes.legD / CHARS_PER_TOKEN_PROXY),
    legE: Math.round(legCostBytes.legE / CHARS_PER_TOKEN_PROXY),
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
  // Phase 372 (D7): estimate mode nulls four bodies. Each nulled body is named,
  // after the entries the legs already added (the legs still run in full).
  if (estimateOnly) {
    omit.add('legA', 'estimate_only', null, 'body');
    omit.add('legB', 'estimate_only', null, 'body');
    omit.add('legC', 'estimate_only', null, 'body');
    omit.add('legD', 'estimate_only', null, 'body');
  }

  // Defensive structured return even on partial-leg failure. cortexNodes is
  // purely ADDITIVE: every existing field (summary, recentMessages, relevantNodes,
  // _meta) stays byte-stable so the Phase 142 getRoomContext->decide() wire and the
  // dial's existing reads are unaffected. legCostChars/legCostTokensApprox and
  // estimateOnly are ALSO purely additive (Phase 270-09): a call with no
  // opts.estimateOnly returns byte-identical bodies to before this change,
  // plus the two new _meta keys. _meta.omitted (Phase 372) is ALSO purely
  // additive: it is always an array and always the LAST _meta key.
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
        legE: Number(tG - tEnd) / 1e6,
      },
      legCostChars,
      legCostTokensApprox,
      estimateOnly,
      omitted: omit.toArray(),
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
  // Phase 372 (D8): the shared reason enum, exported so the SessionStart
  // envelope can adopt it later. Not coupled in this phase.
  OMITTED_REASONS,
};
