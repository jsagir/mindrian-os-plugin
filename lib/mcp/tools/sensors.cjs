'use strict';
// Phase 198-06 (SPEC-2, Task 1) -- suggest_next / reach_candidates /
// contradiction_check / whitespace_scan (sensors as PULL) + framework_run.
//
// The four sensors are READ-ONLY, session-scoped tools that pull through the
// SHIPPED reach path: lib/core/insight-sensors.cjs's dispatchSensors (the
// PRODUCER of candidate reaches, Phase 143) and lib/core/navigation.cjs's
// insight query primitives (findContradictions / findOpenQuestions /
// findUnsupportedClaims, Phase 109-05). This module mints NO second sensor
// registry and NO second SQL query -- it is a thin MCP surface over what
// already ships (Canon Part 7).
//
// framework_run wraps lib/workflow/command-resolver.cjs's composeWorkflow --
// the 107 methodology commands become PARAMETERS (a framework-name chain), not
// new tool surfaces. It does NOT mint a second selection brain (R4): it never
// re-implements framework-to-command resolution, and it never executes a
// material step unattended -- a material (non-autonomous_safe) step composes a
// gate via lib/mcp/gate-render.cjs's SAME renderGate ladder Plan 05 shipped
// (lib/mcp/tools/gate.cjs), and returns it instead of running the command.
//
// Canon Part 8: zero Brain/network tokens. Canon Part 9: any graph read routes
// through lib/core/navigation.cjs (findContradictions / findOpenQuestions /
// findUnsupportedClaims) -- this module never opens room.db directly.
// Canon Part 11: register(server, ctx) + connectors export, same disjoint-file
// module contract as room.cjs / graph.cjs / gate.cjs -- never requires those
// modules or lib/mcp/tool-router.cjs at module-load time. gate-render.cjs is
// NOT a lib/mcp/tools/*.cjs module (it lives one directory up), so requiring
// it here mirrors gate.cjs's own require -- not a tools/tools collision.
//
// No em-dashes. CJS only.

const { z } = require('zod');

const navigation = require('../../core/navigation.cjs');
const { dispatchSensors } = require('../../core/insight-sensors.cjs');
const reachHedgeRanker = require('../../workflow/reach-hedge-ranker.cjs');
const { composeWorkflow, validateChainAutonomy, advisorOptsForRoom } = require('../../workflow/command-resolver.cjs');
const gateRender = require('../gate-render.cjs');
// Quick 386-19 (B11): the ledger is not a tools/*.cjs module, so the disjoint-file seam holds
// (the same reason gate-render.cjs is required above). The framework_run halt path mints its gate here.
const gateLedger = require('../gate-ledger.cjs');
const { resolveEffectiveSessionId } = require('../../core/session-binding.cjs');
const { resolveSessionRoomDir } = require('../session-room.cjs');
// Quick 260819-c8j (WS-D wiring): chainOfferForReach lives in
// chain-recommender.cjs, which IS a classified ROUTE seam in
// tests/test-252-guard-census.cjs. This module deliberately does NOT
// require the Brain client module (lib/core) and NEVER calls isAvailable() /
// ensureAvailable() directly -- lib/mcp/tools/sensors.cjs is NOT in the
// frozen guard-census classification lists, so an executable guard call
// here would fail census.1. Availability is decided entirely inside
// chain-recommender.cjs's chainOfferForReach.
const chainRecommender = require('../../brain/chain-recommender.cjs');
// Phase 355.1-13 (Ruling 2, AMB-05): the process-memory note of which
// stamped SENS-13 card won a pull on this server process. Zero fs/room.db
// surface of its own (see the module's own header) -- requiring it here is
// not a chokepoint or write-door addition.
const surfacedOffers = require('../surfaced-offers.cjs');
// Phase 369.25 plan 21 (FBRIEF-03): suggest_next's next_move is read through the SAME function the navigation engine
// (decide()) and BRIEF.md use, so the three never propose different moves. Local files only, no Brain.
const feyNextMove = require('../../core/feyminto/next-move.cjs');
const nodeFs = require('node:fs');
const nodePath = require('node:path');

// Phase 395-02: how a first goal job is set with the tools that exist. A fixed sentence, sent only when no job is set
// and there are jobs to offer. It names no room content.
const HOW_TO_SET_JOB = [
  'No job ranks the next move in this nest.',
  'To set one: show the person job_offers and let the person pick a job id.',
  'Then call gate_render with kind "strategy_goal", a header that names the job, approving ["rewrite-jtbd"], and options '
    + JSON.stringify([{ id: 'rewrite-jtbd', label: 'Set this job', preview: JSON.stringify({ jtbd: '<job id>' }) }, { id: 'defer', label: 'Not now' }]) + '.',
  'To set the problem type too, add "rung" to the preview JSON: UnDefined, IllDefined, WellDefined or Wicked.',
  'After the person answers the card, call gate_answer with the gate_id, chosen ["rewrite-jtbd"] and verdict "approve", or chosen ["defer"] and verdict "defer".',
  'The job is set only when the gate_answer reply has strategy_ratification.goal_written true.',
].join(' ');

// Phase 395-05 (finding MA1): the goal job of the room, sent with every suggest_next reply that has a room. A standard
// nest has a job of its own, so how_to_set_job above is not sent there, and before this change no reply said how a goal
// job is set. The offers are job ids from the closed job vocabulary (lib/core/section-registry.cjs JOB_VOCABULARY),
// `explore` left out (it names no intent), at most GOAL_JOB_OFFERS_MAX. Fixed sentences: no room content, no user words.
const GOAL_JOB_OFFERS_MAX = 24;
const GOAL_JOB_STEPS = [
  'Call gate_render with kind "strategy_goal", a header that names the job, approving ["rewrite-jtbd"], and options '
    + JSON.stringify([{ id: 'rewrite-jtbd', label: 'Set this job', preview: JSON.stringify({ jtbd: '<job id>' }) }, { id: 'defer', label: 'Not now' }]) + '.',
  'To set the problem type too, add "rung" to the preview JSON: UnDefined, IllDefined, WellDefined or Wicked.',
  'After the person answers the card, call gate_answer with the gate_id, chosen ["rewrite-jtbd"] and verdict "approve", or chosen ["defer"] and verdict "defer".',
  'On a host that takes the answer in a dialog of its own, the gate closes with that answer, gate_answer replies unknown_gate and no job is set: say so to the person.',
  'When the person closes a dialog with no answer, gate_answer replies card_pending and no job is set: show the card again.',
  'The job is set only when the gate_answer reply has strategy_ratification.goal_written true.',
].join(' ');
const GOAL_JOB_NOT_SET = 'No goal job ranks the next move. The job of a nest ranks the move in that nest, when the nest has one. '
  + 'To set a goal job: ask the person what they want to get done, show goal_job.offers, and let the person pick one job id. Do not pick for the person. ';
const GOAL_JOB_SET_HEAD = 'The goal job of this room ranks the next move in every nest: ';
const GOAL_JOB_SET_TAIL = '. To change it: let the person pick another job id from goal_job.offers. ';
// Phase 395-07 (cold check 395-05, MA3): with a goal job set nothing must change, so the reply carries the card and
// one closing sentence, not the six step sentences. The card text is the first two steps of GOAL_JOB_STEPS.
const GOAL_JOB_STEPS_SHORT = GOAL_JOB_STEPS.slice(0, GOAL_JOB_STEPS.indexOf(' After the person answers the card,'))
  + ' Then call gate_answer with the gate_id and the choice of the person. The job changes only when the gate_answer reply has'
  + ' strategy_ratification.goal_written true; a reply unknown_gate or card_pending means no change.';
// Phase 395-07 (cold check 395-04, MA4): a stored goal that does not rank is named, so "no goal job ranks" is the whole truth.
const GOAL_JOB_STORED_NO_RANK = 'A goal is stored for this room, but it does not rank: it is the job explore, or it is not a job id of the vocabulary. '
  + 'The gate does not take explore as a new goal job (reason goal_job_does_not_rank). ';

/**
 * goalJobFor(roomDir) -- the goal job field of the suggest_next reply. Reads the goal through the one read order
 * (jtbd-state resolveSelectionJob), so it agrees with the selector and with the brief. Local read only, never writes,
 * never throws. Returns undefined when there is no room or the read fails, so the reply omits the field.
 *
 * @returns {{ state: 'set'|'not_set', id: string|null, offers: string[], how_to: string }|undefined}
 */
function goalJobFor(roomDir) {
  if (typeof roomDir !== 'string' || !roomDir) return undefined;
  try {
    const sel = require('../../hmi/jtbd-state.cjs').resolveSelectionJob(roomDir, null);
    const vocabulary = require('../../core/section-registry.cjs').JOB_VOCABULARY;
    const offers = vocabulary.filter((id) => id !== 'explore').slice(0, GOAL_JOB_OFFERS_MAX);
    if (sel && sel.origin === 'goal' && typeof sel.id === 'string' && sel.id.length > 0) {
      return { state: 'set', id: sel.id, offers: offers, how_to: GOAL_JOB_SET_HEAD + sel.id + GOAL_JOB_SET_TAIL + GOAL_JOB_STEPS_SHORT };
    }
    const stored = require('../../hmi/jtbd-state.cjs').getGoal(roomDir);
    const storedNoRank = !!(stored && typeof stored.jtbd === 'string' && stored.jtbd.length > 0);
    return { state: 'not_set', id: null, offers: offers, how_to: GOAL_JOB_NOT_SET + (storedNoRank ? GOAL_JOB_STORED_NO_RANK : '') + GOAL_JOB_STEPS };
  } catch (_e) {
    return undefined;
  }
}

// Phase 400 plan 08 (CY-03, F-02): the room's cause and effect domain, sent with every suggest_next reply that has a
// room, so the host model can show the card. The domain is only the navigator's gate answer, read through the one
// reader (navigation.readCauseEffectForRoom, a read-only handle that never creates room.db). The verb order comes
// from data/cynefin-domains.json and the sentences from lib/core/cause-effect-card.cjs howToSentences: fixed text,
// no room content, no numbers.
let _cynefinVerbOrders = null;
function _verbOrderOf(domain) {
  if (_cynefinVerbOrders === null) {
    const data = JSON.parse(nodeFs.readFileSync(nodePath.join(__dirname, '..', '..', '..', 'data', 'cynefin-domains.json'), 'utf8'));
    _cynefinVerbOrders = new Map(data.domains.map((d) => [d.id, d.verb_order.slice()]));
  }
  const order = _cynefinVerbOrders.get(domain);
  return order ? order.slice() : null;
}

/**
 * causeEffectFor(roomDir) -- the cause_effect field of the suggest_next reply. Local read only, never writes, never
 * throws. Returns undefined when there is no room or the read fails, so the reply omits the field.
 *
 * @returns {{ state: 'set'|'not_set', domain: string|null, verb_order: string[]|null, how_to: string }|undefined}
 */
function causeEffectFor(roomDir) {
  if (typeof roomDir !== 'string' || !roomDir) return undefined;
  try {
    const card = require('../../core/cause-effect-card.cjs');
    const stored = navigation.readCauseEffectForRoom(roomDir);
    const order = stored ? _verbOrderOf(stored.domain) : null;
    if (stored && order) {
      return { state: 'set', domain: stored.domain, verb_order: order, how_to: card.howToSentences(stored.domain) };
    }
    return { state: 'not_set', domain: null, verb_order: null, how_to: card.howToSentences(null) };
  } catch (_e) {
    return undefined;
  }
}

/**
 * problemLevelTestFor() -- Phase 400 plan 11 (AX-01, F-07): the reworded Well-defined test, sent only when the env
 * MINDRIAN_LEVEL_WORDING is 'v2'. Fixed text from data/problem-axes-wording.json, no room content, no numbers.
 * Returns undefined with the flag off or on any fault, so the default reply is byte-unchanged.
 *
 * @returns {{ version: 'v2', well_defined: string, wicked_note: string|null, status: string }|undefined}
 */
function problemLevelTestFor() {
  try {
    const w = require('../../core/problem-axes.cjs').levelWording();
    if (w.version !== 'v2' || typeof w.well_defined !== 'string') return undefined;
    return { version: w.version, well_defined: w.well_defined, wicked_note: w.wicked_note, status: w.status };
  } catch (_e) {
    return undefined;
  }
}

/**
 * methodJobFor(primary) -- Phase 395-10 (owner rulings 21 and 22): the job statement of the method behind the proposed
 * command, for display only. Read from data/framework-jobs.json AFTER the move is composed; no sort key, score, ledger
 * build or filter reads it. A draft carries status "draft" and a note that says so. Never throws; null when there is
 * no statement, so the reply omits the field.
 */
function methodJobFor(primary) {
  try {
    if (!primary || typeof primary.command !== 'string') return null;
    return require('../../core/framework-jobs.cjs').methodJobForCommand(primary.command);
  } catch (_e) {
    return null;
  }
}

function textResponse(payload, isError) {
  const result = { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
  if (isError) result.isError = true;
  return result;
}

/**
 * Build the minimal (turn, tuple, ctx) triple dispatchSensors expects, from an
 * MCP call's optional free-text + section params. Degrade-safe: an absent
 * user_text/section still dispatches (most sensors read turn/tuple/ctx
 * defensively per lib/core/insight-sensors.cjs's own soft-fail discipline).
 *
 * @param {string|undefined} sessionId
 * @param {string} roomDir
 * @param {{userText?: string, section?: string}} params
 */
function buildSensorInputs(sessionId, roomDir, params) {
  const turn = {
    userText: typeof params.userText === 'string' ? params.userText : '',
    sectionPath: typeof params.section === 'string' ? params.section : null,
    sessionId: sessionId,
  };
  const tuple = {}; // /mos:diagnose classification unknown to a bare MCP pull -- sensors degrade gracefully
  const ctx = { roomDir: roomDir, lowFillSections: null };
  return { turn, tuple, ctx };
}

/**
 * _noteWinningSens13(roomDir, reaches) -- Phase 355.1 Ruling 2: note the
 * winning stamped card in process memory; the pull stays a pure read of
 * disk and room.db; the close-out persists it. The ONE call site for
 * surfacedOffers.noteSurfaced in this module -- both dispatchCandidateReaches
 * return paths below flow through this single helper, so there is exactly
 * one place that decides "did SENS-13 actually win this pull". Soft-fail:
 * a note failure (or a monkeypatched/thrown noteSurfaced) must never break
 * a pull.
 *
 * @param {string} roomDir
 * @param {Array} reaches -- the (possibly ranked) fired-candidate array;
 *   only reaches[0] is ever considered the winner.
 */
function _noteWinningSens13(roomDir, reaches) {
  try {
    const top = (Array.isArray(reaches) && reaches.length > 0) ? reaches[0] : null;
    if (top && typeof top === 'object' && top.signal === 'eureka_bridge'
        && top.evidence && typeof top.evidence === 'object'
        && typeof top.evidence.opportunity_handle === 'string' && top.evidence.opportunity_handle) {
      surfacedOffers.noteSurfaced(roomDir, top.evidence.opportunity_handle);
    }
  } catch (_e) {
    // soft-fail: a note failure must never break the caller's pull
  }
}

/**
 * dispatchCandidateReaches -- the ONE call every sensor pull-tool routes
 * through. Never throws (dispatchSensors itself never throws; a defensive
 * try/catch here is belt-and-suspenders for a malformed params object).
 *
 * Returns { reaches, degraded }: the ordered candidate array plus the first
 * weight-state degrade enum token collected on this pull, or null. Nothing
 * outside this module consumes this function (it is exported only under
 * _internal), so the shape is contained to the two call sites below.
 *
 * @returns {{reaches: Array, degraded: string|null}}
 */
function dispatchCandidateReaches(sessionId, roomDir, params) {
  const { turn, tuple, ctx } = buildSensorInputs(sessionId, roomDir, params || {});
  try {
    const reaches = dispatchSensors(turn, tuple, ctx);
    const fired = Array.isArray(reaches) ? reaches : [];
    // Phase 222 (D-01/Req 1): no cortexNodes are threaded on this path (deferred,
    // SPEC boundary) - every candidate sits on the flat 0.5 D4 floor and the Hedge
    // outcome layer is the ONLY differentiator here (Req 3's MCP-path role). The
    // 0/1-candidate path skips the db open entirely: byte- AND cost-identical to
    // today.
    if (fired.length <= 1) {
      _noteWinningSens13(roomDir, fired);
      return { reaches: fired, degraded: null };
    }
    // Quick 260728-7kc: this pull is a DECLARED READ (hitl_shape 'none'), so it
    // opens through the READ-ONLY mode of the SAME navigation.cjs chokepoint. That
    // is a second MODE of entry, never a second chokepoint, so Canon Part 9 holds
    // and no substrate allow-list edit is needed. The distinction matters three
    // times over, because openRoomDbForCaller is not read-only:
    //   1. it mkdirSync's <roomDir>/.mindrian/ and runs 13 CREATE TABLE IF NOT
    //      EXISTS statements plus 5 migrations on EVERY open, so polling this tool
    //      in a Tier 0 room used to CREATE the user's database;
    //   2. the shared ranker's fire-and-forget Hedge fold used to persist a
    //      refitted weight snapshot from a call whose response was already computed;
    //   3. a degraded weight-state read used to mint a memory_event node.
    // Handing a write-capable handle to a shared module whose documented contract
    // includes a write is the same act as writing, which is why the fix is the
    // handle and the flag together rather than a promise not to write. sqlite now
    // rejects a write mechanically, so a future edit cannot silently reintroduce
    // one. The read is deliberately KEPT: dropping the handle would also stop the
    // write but would flatten the ranking to the 0.5 D4 floor.
    //
    // Nullable, exactly like the write door (the ranker degrades on a null db when
    // room.db is absent), and released through the SAME closeRoomDbForCaller in a
    // finally: per the door's contract there is deliberately no sibling close
    // helper, and that one already tolerates any bare DatabaseSync.
    const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
    const degradeSink = [];
    try {
      const ordered = reachHedgeRanker.rankFiredCandidates(fired, {
        roomDir: roomDir,
        db: db,
        readOnly: true,
        degradeSink: degradeSink,
      });
      // Req 7's disclosed-degrade signal is preserved, not deleted: it moves from a
      // room.db write to the response, so the fault is still disclosed to whoever
      // caused it. Closed enum tokens only, never prose.
      _noteWinningSens13(roomDir, ordered);
      return { reaches: ordered, degraded: degradeSink.length > 0 ? degradeSink[0] : null };
    } finally {
      if (db) navigation.closeRoomDbForCaller(db);
    }
  } catch (_e) {
    return { reaches: [], degraded: null };
  }
}

/**
 * resolveNextMove(sessionId, roomDir, section) -- Phase 369.25 plan 21. The bound room's active nest (the section
 * argument, else the nest the session's focus node sits in, read through the read-only mode of the navigation
 * chokepoint) composed by nextMoveForSection on the mcp surface. Never throws, never writes.
 *
 * @returns {{ next_move: {primary, alternatives, outcomes_differ}, next_move_source: 'feyminto_face'|'sensor_order',
 *   next_move_reason?: string, section?: string }}
 */
function resolveNextMove(sessionId, roomDir, section) {
  const none = (reason, alternatives, differ) => ({
    next_move: { primary: null, alternatives: alternatives || [], outcomes_differ: differ === true },
    next_move_source: 'sensor_order',
    next_move_reason: reason,
  });
  try {
    let nest = (typeof section === 'string' && section) ? section : null;
    if (!nest && typeof roomDir === 'string' && roomDir) {
      const db = navigation.openRoomDbReadOnlyForCaller(roomDir);
      try {
        const focus = db ? navigation.resolveFocusSection(db, sessionId) : null;
        if (focus && focus.ok === true && typeof focus.section === 'string') nest = focus.section;
      } finally {
        if (db) navigation.closeRoomDbForCaller(db);
      }
    }
    if (!nest || !/^[a-z0-9-]+$/.test(nest)) return none('no_active_nest');
    const sectionDir = nodePath.join(roomDir, nest);
    if (!nodeFs.existsSync(sectionDir)) return none('nest_not_found');
    const nm = feyNextMove.nextMoveForSection({ roomDir: roomDir, sectionDir: sectionDir, surface: 'mcp' });
    // Phase 395-01: the job that ranked the move travels with it, on every host.
    const jobFields = (m) => {
      const fields = {
        job: m && m.job ? m.job : null,
        job_state: m && typeof m.state === 'string' ? m.state : null,
        job_offers: m && Array.isArray(m.job_offers) ? m.job_offers : [],
      };
      // Phase 395-02: with no job and jobs to offer, say how a job is set.
      if (fields.job_state === 'job_unknown' && fields.job_offers.length > 0) fields.how_to_set_job = HOW_TO_SET_JOB;
      // Phase 399-07 (I-08): the decision advisor shortlist for the host model, band words and an explicit
      // no-strong-pick state, never a number. Omitted when absent (no job, advisor off). A local read; no write, no Brain call.
      if (m && m.advisor && typeof m.advisor === 'object') fields.advisor = m.advisor;
      return fields;
    };
    if (!nm || !nm.primary) {
      const out = none('no_runnable_primary', nm && nm.alternatives, nm && nm.outcomes_differ);
      Object.assign(out.next_move, jobFields(nm));
      return out;
    }
    // Phase 395-10: the job statement of the method behind the primary, shown beside the move. Omitted when none.
    const methodJob = methodJobFor(nm.primary);
    return {
      next_move: Object.assign({ primary: nm.primary, alternatives: nm.alternatives, outcomes_differ: nm.outcomes_differ }, jobFields(nm), methodJob ? { method_job: methodJob } : {}),
      next_move_source: 'feyminto_face',
      section: nest,
    };
  } catch (_e) {
    return none('face_read_failed');
  }
}

/**
 * detectClientCapabilities -- a one-line delegate to the one shared ruling,
 * gateRender.detectGateCapabilities (lib/mcp/gate-render.cjs, navigator
 * ruling 2026-10-02: a Claude host surface gets the card; a recognized
 * non-Claude host that declares elicitation keeps the dialog; everything else
 * is headless text). gate-render.cjs is not a tools/*.cjs module, so the
 * disjoint-file seam holds.
 */
function detectClientCapabilities(server, ctx) {
  return gateRender.detectGateCapabilities(server, ctx);
}

function register(server, ctx) {
  // --- suggest_next: the single top-ranked candidate reach (or none). ---
  server.registerTool(
    'suggest_next',
    {
      title: 'Suggest Next',
      description: "Next-action suggestion for this session's bound room. Pulls through the shipped dispatchSensors reach path (Phase 143) -- the SAME candidate-reach registry the per-turn navigation engine consumes, called here on demand as a read. Returns the first (highest-priority, canonical dispatch order) candidate reach, or none; next_move is the move for the active nest, from its FeyMinto brief, and next_move_source says which path produced it.",
      inputSchema: z.object({
        user_text: z.string().max(4000).optional()
          .describe('Optional free text to seed the pull (e.g. the user\'s last message). Absent -> sensors that read turn text degrade gracefully.'),
        section: z.string().regex(/^[a-z0-9-]+$/).optional()
          .describe('Optional section slug for section-scoped sensors.'),
      }),
    },
    async ({ user_text, section }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const pull = dispatchCandidateReaches(sessionId, roomDir, { userText: user_text, section: section });
      const reaches = pull.reaches;
      const top = reaches.length > 0 ? reaches[0] : null;

      // Quick 260819-c8j (WS-C wiring): an optional, read-only Brain offer
      // when the top reach carries a brain_framework_chain companion. Passes
      // an EMPTY opts object ON PURPOSE -- no `db` key -- so the divergence
      // write leg inside adaptChainToRunInput cannot fire and this tool's
      // declared "no write of any kind" (fence 5) stays literally true.
      // Degrades to null (omit-when-absent) on any error; never throws into
      // the caller. One Brain call per pull, on the top pick only --
      // reach_candidates deliberately is NOT wired (fanning the call across
      // the whole candidate set would multiply wire cost by reach breadth
      // for no additional first-offer value).
      //
      // Phase 254 (COMP-01): this call is enumerated in
      // lib/mcp/brain-composition-census.cjs as the 'suggest_next
      // (chainOfferForReach)' reaching site -- reaches_brain: true, belt:
      // 'callTool', bound_ms: 20000 (the Brain client module's default
      // BRAIN_REQUEST_TIMEOUT_MS, no override on this path). D-01
      // (254-CONTEXT.md) ratified this as SHIPPED, released behaviour. This
      // module still deliberately does NOT require the Brain client module directly
      // and never calls the availability guard itself (see the module
      // header above) -- availability is decided entirely inside
      // chain-recommender.cjs's chainOfferForReach, which IS the
      // census-declared reaching site.
      let chainOffer = null;
      try {
        chainOffer = top ? await chainRecommender.chainOfferForReach(top, {}) : null;
      } catch (_e) {
        chainOffer = null;
      }

      // Phase 369.25 plan 21 (FBRIEF-03): the move for the active nest, composed by the one function the engine and
      // BRIEF.md also call. `suggestion` stays the sensor reach it was composed beside.
      const nextMovePull = resolveNextMove(sessionId, roomDir, section);
      const faceMove = nextMovePull.next_move_source === 'feyminto_face';

      return textResponse({
        ok: true,
        room_dir: roomDir,
        suggestion: top,
        next_move: nextMovePull.next_move,
        next_move_source: nextMovePull.next_move_source,
        next_move_reason: nextMovePull.next_move_reason || undefined,
        // Phase 395-05 (finding MA1): the goal job of the room and how the person sets or changes it. Omitted with no room.
        goal_job: goalJobFor(roomDir),
        // Phase 400 plan 08 (CY-03): the cause and effect domain of the room and how the person sets it. Omitted with no room.
        cause_effect: causeEffectFor(roomDir),
        // Phase 400 plan 11 (AX-01): the provisional reworded level test, only with MINDRIAN_LEVEL_WORDING=v2.
        problem_level_test: problemLevelTestFor(),
        // Omit-when-absent, the same idiom note already uses, so the normal
        // payload is byte-unchanged and only a real fault adds a field.
        degraded: pull.degraded || undefined,
        note: faceMove
          ? "next_move is the move, from this nest's FeyMinto brief; suggestion is the sensor reach it was composed beside."
          : (top ? undefined : 'No candidate reach fired for this pull.'),
        chain_offer: chainOffer || undefined,
      });
    }
  );

  // --- reach_candidates: the full candidate set feeding a reach card. ---
  server.registerTool(
    'reach_candidates',
    {
      title: 'Reach Candidates',
      description: "The full candidate-reach set feeding a reach card for this session's bound room. Pulls through the SAME dispatchSensors reach path as suggest_next (Phase 143 SENSOR_REGISTRY, canonical order) -- this is the un-truncated list, not just the top pick.",
      inputSchema: z.object({
        user_text: z.string().max(4000).optional()
          .describe('Optional free text to seed the pull. Absent -> sensors that read turn text degrade gracefully.'),
        section: z.string().regex(/^[a-z0-9-]+$/).optional()
          .describe('Optional section slug for section-scoped sensors.'),
      }),
    },
    async ({ user_text, section }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const pull = dispatchCandidateReaches(sessionId, roomDir, { userText: user_text, section: section });
      const reaches = pull.reaches;
      return textResponse({
        ok: true,
        room_dir: roomDir,
        candidates: reaches,
        count: reaches.length,
        degraded: pull.degraded || undefined,
      });
    }
  );

  // --- contradiction_check: navigation.findContradictions through the chokepoint. ---
  server.registerTool(
    'contradiction_check',
    {
      title: 'Contradiction Check',
      description: "CONTRADICTS scan for this session's bound room, through the navigation.cjs chokepoint (lib/core/navigation/insights.cjs::findContradictions, Phase 109-05). Resolves the focus node from node_id, or from this session's active focus when node_id is absent.",
      inputSchema: z.object({
        node_id: z.string().min(1).optional()
          .describe('Explicit focus node id. Defaults to this session\'s active focus when absent.'),
        include_superseded: z.boolean().optional()
          .describe('Include claims whose review_status is superseded in the result; defaults to false, which excludes them. Superseded claims are closed, not deleted, so this flag is how their history stays reachable.'),
      }),
    },
    async ({ node_id, include_superseded }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) {
        return textResponse({ ok: false, reason: 'no_room_db', room_dir: roomDir }, true);
      }
      try {
        let focusNodeId = typeof node_id === 'string' && node_id ? node_id : null;
        if (!focusNodeId) {
          try {
            const focus = navigation.getActiveFocus(db, sessionId);
            focusNodeId = focus && focus.focusNodeId ? focus.focusNodeId : null;
          } catch (_e) {
            focusNodeId = null;
          }
        }
        if (!focusNodeId) {
          return textResponse({ ok: true, room_dir: roomDir, contradictions: [], note: 'No focus node. Pass node_id, or set a session focus first.' });
        }
        // SUPER-05: OPT-IN. Completes the five-caller matrix (348-04 Task
        // 3 left this row PENDING): this is the one caller that opts in,
        // because it is the only surface where a human can deliberately
        // ask to see closed history.
        const contradictions = navigation.findContradictions(db, focusNodeId, { includeSuperseded: include_superseded === true });
        return textResponse({ ok: true, room_dir: roomDir, focus_node_id: focusNodeId, contradictions: contradictions });
      } finally {
        navigation.closeRoomDbForCaller(db);
      }
    }
  );

  // --- whitespace_scan: findOpenQuestions + findUnsupportedClaims (gap scan). ---
  server.registerTool(
    'whitespace_scan',
    {
      // Phase 355 D-24 (HIPS-03): leads with the honest sentence, then names
      // exactly what this reads (unchanged behavior, unchanged name -- D-26,
      // no rename). The dropped clause used to close on "closest to
      // 'whitespace' (a gap not yet filled)", which read as a claim of BEING
      // the whitespace engine rather than merely adjacent to the word.
      title: 'Whitespace Scan',
      description: "Returns open questions and unsupported claims. This is NOT the `/mos:whitespace` HSI engine; run it in Claude Code. Gap scan for this session's bound room, through the navigation.cjs chokepoint: unanswered open_question nodes (findOpenQuestions) and claims with no SUPPORTS/EVIDENCES edge (findUnsupportedClaims), the two shipped Phase 109-05 insight primitives this tool actually calls. This module mints no third query.",
      inputSchema: z.object({}),
    },
    async (_args, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);
      const db = navigation.openRoomDbForCaller(roomDir);
      if (!db) {
        return textResponse({ ok: false, reason: 'no_room_db', room_dir: roomDir }, true);
      }
      try {
        const roomId = require('node:path').basename(roomDir);
        let openQuestions = [];
        let unsupportedClaims = [];
        try { openQuestions = navigation.findOpenQuestions(db, roomId) || []; } catch (_e) { openQuestions = []; }
        try { unsupportedClaims = navigation.findUnsupportedClaims(db, roomId) || []; } catch (_e) { unsupportedClaims = []; }
        return textResponse({
          ok: true,
          room_dir: roomDir,
          open_questions: openQuestions,
          unsupported_claims: unsupportedClaims,
          gap_count: openQuestions.length + unsupportedClaims.length,
        });
      } finally {
        navigation.closeRoomDbForCaller(db);
      }
    }
  );

  // --- framework_run: the 107 commands become PARAMETERS via composeWorkflow. ---
  server.registerTool(
    'framework_run',
    {
      title: 'Framework Run',
      description: "Resolve an ordered framework-name chain to its command plan via lib/workflow/command-resolver.cjs::composeWorkflow -- the ONE governed reach path (R4: this tool mints NO second resolver). A fully autonomous_safe chain returns the resolved plan. A chain with a material (non-autonomous_safe) step HALTS at that step and returns a gate (via the SAME gate-render.cjs ladder gate_render uses) instead of executing it unattended.",
      inputSchema: z.object({
        chain: z.array(z.string().min(1)).min(1)
          .describe('Ordered list of framework names (the same names lib/workflow/command-resolver.cjs\'s registry indexes).'),
        subject_node_id: z.string().min(1).optional()
          .describe('Opaque LOCAL room-graph node id, provenance only. Carried onto the halt card if this chain halts at a material step; nothing consumes it yet. Canon Part 8: must never be a Brain identifier or room content.'),
        evidence_node_ids: z.array(z.string().min(1)).optional()
          .describe('Opaque LOCAL room-graph node ids, provenance only. Carried onto the halt card if this chain halts at a material step; nothing consumes it yet. Canon Part 8: must never be Brain identifiers or room content.'),
      }),
    },
    async ({ chain, subject_node_id, evidence_node_ids }, extra) => {
      const sessionId = resolveEffectiveSessionId(undefined, extra);
      const roomDir = resolveSessionRoomDir(sessionId, ctx);

      // Phase 399-08 (I-07): the room's selection job and definition level let the decision advisor pick among a
      // framework's commands inside composeWorkflow. No job, or the advisor off, is the one-argument call of base.
      // Review WR-05: advisorOptsForRoom returns null before any room read when the advisor is off.
      const advisorOpts = advisorOptsForRoom(roomDir);
      const workflow = advisorOpts ? composeWorkflow(chain, advisorOpts) : composeWorkflow(chain);
      const autonomy = validateChainAutonomy(workflow);

      if (autonomy.runnable) {
        return textResponse({
          ok: true,
          room_dir: roomDir,
          workflow: workflow,
          runnable: true,
          note: 'Resolved plan only -- this tool composes the command plan; chain_run executes it server-side.',
        });
      }

      // Material step(s) found: halt and render a gate instead of proceeding.
      const first = autonomy.blockers[0];
      const step = workflow.find((w) => w.step === first.step);
      const card = {
        header: 'Confirm material step: ' + (step ? step.framework : 'unknown') + (first.command ? ' (' + first.command + ')' : ''),
        kind: 'general',
        select_mode: 'single',
        options: [
          { id: 'approve', label: 'Approve -- run ' + (first.command || step && step.framework || 'this step') },
          { id: 'skip', label: 'Skip this step' },
          { id: 'stop', label: 'Stop the chain' },
        ],
        subject_node_id: subject_node_id,
        evidence_node_ids: evidence_node_ids,
      };
      const capabilities = detectClientCapabilities(server, ctx);
      const renderCtx = { capabilities: capabilities, sessionId: sessionId };
      if (capabilities.elicitation && server && server.server && typeof server.server.elicitInput === 'function') {
        renderCtx.elicitInput = function (params) { return server.server.elicitInput(params); };
      }

      let rendered;
      try {
        rendered = await gateRender.renderGate(card, renderCtx);
      } catch (e) {
        return textResponse({ ok: false, reason: 'gate_render_failed', detail: String((e && e.message) || e) }, true);
      }

      // Quick 386-19 (B11): mint the gate so gate_answer can resolve the id this call returns. Without the
      // mint, gate_answer answered unknown_gate for a card the navigator was shown. The kind stays 'general'
      // (never 'material_step', which gate_answer would refuse for lack of a resumeFn): gate_answer records
      // the answer and runs NO step, as the halt note below says. Only the approve option is a yes. An
      // elicitation dialog the navigator already answered inline (rendered.answer) leaves nothing to answer.
      if (!rendered.answer && rendered.card && typeof rendered.card.gate_id === 'string' && rendered.card.gate_id.length > 0) {
        gateLedger.mintGate(rendered.card.gate_id, {
          card: rendered.card,
          sessionId: sessionId,
          kind: (typeof rendered.card.kind === 'string' && rendered.card.kind.length > 0) ? rendered.card.kind : 'general',
          renderer: gateRender.ledgerRenderer(rendered, renderCtx),
          approving: ['approve'],
        });
      }

      return textResponse({
        ok: true,
        room_dir: roomDir,
        workflow: workflow,
        runnable: false,
        blockers: autonomy.blockers,
        gate: { gate_id: rendered.card.gate_id, renderer: rendered.renderer, rendered: rendered.rendered, answer: rendered.answer },
        note: 'Chain halted at a material step; it was NOT executed unattended.',
      });
    }
  );
}

// Born-wired SOURCE of truth (Part 11 R1/R16). The four sensors reach no
// navigator-facing Decision-Gate fork (hitl_shape 'none' -- WR-04: per
// docs/HITL-SHAPE-DECLARATION-CONTRACT.md, hitl_shape classifies whether a
// surface reaches a place the NAVIGATOR picks among options, not whether it
// performs a write, so 'none' is correct on its own terms for all four).
// suggest_next and reach_candidates hold a READ-ONLY room.db handle
// (navigation.openRoomDbReadOnlyForCaller) and pass readOnly: true into the
// shared ranker, so they perform no write of any kind and 'none' is now also
// true in the plain-reading sense a future doctor or audit surface would
// assume. framework_run reaches a genuine material-step fork (hitl_shape 'F.1',
// the same shape gate_render/gate_answer carry).
// scripts/build-connector-registry.cjs discovers this export and regenerates
// data/mcp-tool-connectors.json + data/connector-registry.json from it; never
// hand-edit either generated file.
const connectors = [
  {
    tool: 'suggest_next',
    surface: 'suggest_next',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pulls the top candidate reach through the shipped dispatchSensors path -- no navigator-facing fork. It reads the Hedge weight state through a READ-ONLY room.db handle, so the call performs no write of any kind: no schema migration, no memory_event, no weight-state snapshot. Quick 260819-c8j: it may now make ONE optional read-only Brain call (chainRecommender.chainOfferForReach) when the top reach carries a brain_framework_chain companion; it passes no db handle into that call, so it still performs no write of any kind, and a Brain absence degrades to a grounded:false disclosure rather than an error.',
    layer: 'graph',
    layer_why: 'Pulls the top candidate reach through the dispatchSensors path; a reach-dispatch coordination decision, the rubric\'s own step 1 signal.',
  },
  {
    tool: 'reach_candidates',
    surface: 'reach_candidates',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pulls the full candidate-reach set through the shipped dispatchSensors path -- no navigator-facing fork. It reads the Hedge weight state through a READ-ONLY room.db handle, so the call performs no write of any kind: no schema migration, no memory_event, no weight-state snapshot.',
    layer: 'graph',
    layer_why: 'Pulls the full candidate-reach set through the dispatchSensors path; the same reach-dispatch coordination as suggest_next.',
  },
  {
    tool: 'contradiction_check',
    surface: 'contradiction_check',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read: navigation.cjs findContradictions through the chokepoint, no fork.',
    layer: 'harness',
    layer_why: 'Pure graph read (findContradictions) through the navigation.cjs chokepoint; a graph-infrastructure query, not a dispatch decision.',
  },
  {
    tool: 'whitespace_scan',
    surface: 'whitespace_scan',
    connector: 'mcp-tool',
    hitl_shape: 'none',
    hitl_why: 'Pure read: navigation.cjs findOpenQuestions + findUnsupportedClaims through the chokepoint, no fork.',
    layer: 'harness',
    layer_why: 'Pure graph read (findOpenQuestions/findUnsupportedClaims) through the navigation.cjs chokepoint; a graph-infrastructure query.',
  },
  {
    tool: 'framework_run',
    surface: 'framework_run',
    connector: 'mcp-tool',
    hitl_shape: 'F.1',
    hitl_why: 'Resolves a framework chain via composeWorkflow; a material (non-autonomous_safe) step is a genuine Decision-Gate fork -- it halts and renders a gate rather than executing unattended.',
    layer: 'loop',
    layer_why: 'Resolves and runs one framework\'s chain to its material step; a single framework\'s own cycle to a stopping condition, the rubric\'s own single hitl_shape fork signal.',
  },
];

module.exports = {
  register,
  connectors,
  _internal: {
    resolveSessionRoomDir,
    dispatchCandidateReaches,
    detectClientCapabilities,
    // Phase 400 plan 08 (CY-03): exposed for tests/test-400-domain-suggest-next.cjs.
    causeEffectFor,
    // Phase 400 plan 11 (AX-01): exposed for tests/test-400-problem-axes-wording.cjs.
    problemLevelTestFor,
  },
};
