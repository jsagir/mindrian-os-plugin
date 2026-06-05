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

// Leg B windowing defaults (Claude's Discretion per CONTEXT D-04 / RESEARCH
// "Window size N"): the most recent session, its last ~6 fragments, each capped
// so an unbounded fragment dump cannot blow the 1200ms NAV budget (T-141-05).
const DEFAULT_FRAGMENT_WINDOW = 6;
const DEFAULT_FRAGMENT_CHAR_CAP = 400;
const DEFAULT_TOP_K = 10;
const DEFAULT_MAX_DEPTH = 2;
// How many of the most recent windowed fragments seed the focus-node resolver.
const SEED_FRAGMENT_COUNT = 2;

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

/**
 * Local in-process 3-leg fusion. 100% local. NEVER egresses. Canon Part 8 + 9.
 *
 * @param {import('node:sqlite').DatabaseSync} db caller-owned room.db handle
 * @param {string} roomId the room id (for Leg A's room: root composition)
 * @param {object} [opts] { seedFragments?, topK?, fragmentWindow?, maxDepth? }
 * @returns {Promise<{summary, recentMessages, relevantNodes, _meta}>}
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
  const tEnd = process.hrtime.bigint();

  // Defensive structured return even on partial-leg failure.
  return {
    summary,
    recentMessages,
    relevantNodes,
    _meta: {
      seedNodeId: seedNodeId || null,
      fragmentWindow,
      topK,
      maxDepth,
      legTimingsMs: {
        legA: Number(tB - tA) / 1e6,
        legB: Number(tC - tB) / 1e6,
        legC: Number(tEnd - tC) / 1e6,
      },
    },
  };
}

module.exports = { getRoomContext };
