'use strict';
// Phase 198-09 (SPEC-5, D-05) -- stop-gate-handler: the daemon-side host for
// the MOVED Stop-gate enforcement.
//
// D-05 (hard sequencing): the Stop-gate migrates LAST, and only after
// server-side gate dedup + relevance (lib/mcp/gate-dedup.cjs, Task 1 of this
// same plan) exists. handleStopEvent is the file behind the gate-dedup ->
// gate-render key_link named in 198-09-PLAN.md's must_haves:
//   1. Resolves the calling session's room binding (Canon: SEED-039 per-
//      session binding, the same D-02/D-04/D-07 precedence lib/mcp/tools/
//      gate.cjs and lib/mcp/tools/room.cjs already use, kept as an
//      independent copy per register-core-tools.cjs's "tool modules never
//      require each other" disjoint-file seam -- this file sits alongside
//      those tool modules, not inside lib/mcp/tools/).
//   2. Derives the turn's gate signals and consults gate-dedup.shouldFireGate
//      FIRST, before any card composition (Part 7: dedup/relevance is a
//      cheap pre-filter in front of the more expensive predicate below).
//   3. On a fire-eligible verdict, delegates the FINAL bounded-escape-aware
//      predicate to the SHIPPED scripts/check-card-fire.cjs logic (wrap,
//      never re-mint -- the frozen constitutional floor (MAX_FORCE_RETRIES,
//      MAX_SESSION_INTERCEPTS) stays declared in exactly one place and is
//      only ever READ here via that module's own exports).
//   4. Only on a genuine intercept verdict does it compose the gate through
//      lib/mcp/gate-render.cjs's renderGate (Plan 05's superset ladder) and
//      return that payload; a do-not-fire verdict returns { fire: false }
//      and composes nothing.
//   5. Owns the server-side share of on-stop's business close-out (STATE.md
//      persist + the memory-lifecycle/minto-debouncer/folder-memory
//      invocations) so scripts/on-stop's flag-ON branch can stay a thin
//      wake+query+render adapter with ZERO of those business-module tokens
//      in its own text (D-06). The existing scripts/modules are REQUIRED or
//      spawned as-is -- NOT re-implemented (Canon Part 7).
//
// Canon Part 8: LOCAL-only. No Brain/network token; every reach here is a
// local room directory, a local sqlite-backed room.db (via navigation.cjs
// through the existing tool surface), or a local child process.
// No em-dashes. CJS only.

const path = require('node:path');
const fs = require('node:fs');
const { execFileSync } = require('node:child_process');

const PLUGIN_ROOT = path.resolve(__dirname, '..', '..');

const gateDedup = require('./gate-dedup.cjs');
const gateRender = require('./gate-render.cjs');
const { isMcpFirst } = require('./mcp-first-flag.cjs');
const { resolveWriteRoom, resolveActiveRoom } = require('../core/resolve-active-room.cjs');

// The shipped Stop-hook predicate (scripts/check-card-fire.cjs). Required by
// absolute path so this module works identically whether loaded from
// lib/mcp/ or re-required from a test fixture -- the frozen floor
// (MAX_FORCE_RETRIES / MAX_SESSION_INTERCEPTS) lives ONLY in that file; this
// module never re-declares those scalars, it only reads the predicate's
// verdict.
const checkCardFire = require(path.join(PLUGIN_ROOT, 'scripts', 'check-card-fire.cjs'));

/**
 * resolveSessionRoomDir -- same D-02/D-04/D-07 precedence as lib/mcp/tools/
 * gate.cjs's own independent copy (kept disjoint per register-core-tools.
 * cjs's "tool modules never require each other" seam; this file mirrors that
 * shape rather than importing it).
 *
 * @param {string|undefined} sessionId
 * @param {{surface?: string}} [ctx]
 * @returns {string|null}
 */
function resolveSessionRoomDir(sessionId, ctx) {
  try {
    const surface = (ctx && typeof ctx.surface === 'string') ? ctx.surface : 'cli';
    if (isMcpFirst(surface)) {
      const r = resolveWriteRoom({ sessionId: sessionId, home: process.env.MINDRIAN_ROOMS_HOME });
      if (r && r.abs_path) return r.abs_path;
    }
    const active = resolveActiveRoom();
    if (active && active.abs_path) return active.abs_path;
  } catch (_e) {
    // fall through to null
  }
  return null;
}

// ---------------------------------------------------------------------------
// Server-side business close-out (Task 1 read_first: "the STATE.md persist
// path, the memory-lifecycle/folder-memory/minto-debouncer invocations --
// the business logic the daemon will own"). Every step is best-effort
// (try/catch swallow, mirroring scripts/on-stop's own `|| true` discipline)
// so a close-out failure can NEVER surface as a Stop-hook error. The existing
// scripts/modules do the real work -- this function only orchestrates them,
// same shape scripts/on-stop's bash body already had, moved server-side.
// ---------------------------------------------------------------------------

function _closeOutStateMd(roomDir) {
  try {
    const computeStatePath = path.join(PLUGIN_ROOT, 'scripts', 'compute-state');
    if (!fs.existsSync(computeStatePath)) return false;
    const out = execFileSync('bash', [computeStatePath, roomDir], { timeout: 2000, encoding: 'utf8' });
    fs.writeFileSync(path.join(roomDir, 'STATE.md'), out || '');
    return true;
  } catch (_e) {
    return false;
  }
}

function _closeOutMemoryLifecycle(roomDir) {
  try {
    const scriptPath = path.join(PLUGIN_ROOT, 'scripts', 'memory-lifecycle.cjs');
    if (!fs.existsSync(scriptPath)) return false;
    execFileSync('node', [scriptPath, 'stop', roomDir], { timeout: 2000, stdio: 'ignore' });
    return true;
  } catch (_e) {
    return false;
  }
}

function _closeOutMintoDrain(roomDir) {
  try {
    const debouncer = require(path.join(PLUGIN_ROOT, 'scripts', 'minto-debouncer.cjs'));
    if (typeof debouncer.drain !== 'function') return false;
    debouncer.drain(roomDir, { timeoutMs: 1500, olderThanMs: 0 });
    return true;
  } catch (_e) {
    return false;
  }
}

function _closeOutRecompile(roomDir) {
  try {
    const recompiler = require(path.join(PLUGIN_ROOT, 'scripts', 'recompile-room-references.cjs'));
    if (typeof recompiler.recompile !== 'function') return false;
    let entries = [];
    try {
      entries = fs.readdirSync(roomDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    } catch (_e2) {
      entries = [];
    }
    for (const d of entries) {
      const sectionDir = path.join(roomDir, d.name);
      if (!fs.existsSync(path.join(sectionDir, 'ROOM.md'))) continue;
      try { recompiler.recompile(sectionDir); } catch (_e3) { /* best-effort, per-section */ }
    }
    return true;
  } catch (_e) {
    return false;
  }
}

/**
 * _closeOutFolderMemorySnapshot -- mirrors scripts/on-stop's own Phase 88-06
 * inline node snippet (readTriple per section, atomic snapshot + stale
 * write). Ported verbatim in spirit, not re-implemented from scratch: the
 * SAME lib/core/folder-memory.cjs::readTriple contract every other on-stop
 * consumer already uses.
 *
 * @param {string} roomDir
 * @param {string|undefined} sessionId
 * @returns {{sections: number, stale: number}}
 */
function _closeOutFolderMemorySnapshot(roomDir, sessionId) {
  const result = { sections: 0, stale: 0 };
  try {
    const fm = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'folder-memory.cjs'));
    let entries = [];
    try {
      entries = fs.readdirSync(roomDir, { withFileTypes: true })
        .filter((d) => d.isDirectory() && d.name[0] !== '.');
    } catch (_e) {
      entries = [];
    }
    const sections = {};
    const stale = [];
    for (const d of entries) {
      const sp = path.join(roomDir, d.name);
      if (!fs.existsSync(path.join(sp, 'ROOM.md'))) continue;
      let triple;
      try {
        triple = fm.readTriple(sp);
      } catch (e) {
        stale.push({ section: d.name, reason: 'readtriple_failed', error: String((e && e.message) || e), last_generated_at: null });
        continue;
      }
      sections[d.name] = triple;
      if (triple && triple.reasoning && triple.reasoning.is_stale) {
        stale.push({ section: d.name, reason: triple.reasoning.stale_reason || 'unknown', last_generated_at: triple.reasoning.last_generated_at || null });
      }
    }
    const snapshotAt = new Date().toISOString();
    const snapshot = {
      version: 1,
      session_id: sessionId || ('sess-' + Date.now()),
      snapshot_at: snapshotAt,
      active_room: roomDir,
      sections: sections,
    };
    const mindrianDir = path.join(roomDir, '.mindrian');
    fs.mkdirSync(mindrianDir, { recursive: true });
    const snapPath = path.join(mindrianDir, 'session-snapshot.json');
    const tmp = snapPath + '.tmp.' + process.pid;
    fs.writeFileSync(tmp, JSON.stringify(snapshot, null, 2));
    fs.renameSync(tmp, snapPath);
    if (stale.length > 0) {
      const stalePath = path.join(mindrianDir, 'minto-stale.json');
      const tmp2 = stalePath + '.tmp.' + process.pid;
      fs.writeFileSync(tmp2, JSON.stringify({ version: 1, at: snapshotAt, sections: stale }, null, 2));
      fs.renameSync(tmp2, stalePath);
    }
    result.sections = Object.keys(sections).length;
    result.stale = stale.length;
  } catch (_e) {
    // best-effort: leave result at its zero defaults
  }
  return result;
}

/**
 * closeOutRoom(roomDir, sessionId) -- the full server-side business close-out
 * scripts/on-stop's flag-ON branch delegates to. Every sub-step is
 * best-effort; the aggregate NEVER throws.
 *
 * @param {string|null} roomDir
 * @param {string|undefined} sessionId
 * @returns {{room_dir: string|null, sections: number, stale: number}}
 */
function closeOutRoom(roomDir, sessionId) {
  if (!roomDir || typeof roomDir !== 'string' || !fs.existsSync(roomDir)) {
    return { room_dir: null, sections: 0, stale: 0 };
  }
  _closeOutMintoDrain(roomDir);
  _closeOutRecompile(roomDir);
  const snap = _closeOutFolderMemorySnapshot(roomDir, sessionId);
  _closeOutStateMd(roomDir);
  _closeOutMemoryLifecycle(roomDir);
  return { room_dir: roomDir, sections: snap.sections, stale: snap.stale };
}

// The SAME option-marker shape lib/core/gate-relevance.cjs::OPTION_LABEL_RE
// matches (`[n] text` / `n) text` / `n. text`), but WITHOUT that module's
// signature-stability normalization (lowercase + non-alphanumeric strip) --
// this extraction is for HUMAN-FACING card display, where the original
// casing/punctuation should survive. Kept local (not exported from gate-
// relevance.cjs) because the two extractions serve different consumers with
// genuinely different normalization needs; the underlying option-marker
// shape is copied, not the normalization behavior.
const RAW_OPTION_LABEL_RE = /^\s*(?:\[\s*[1-9]\s*\]|[1-9][).])\s+(.+?)\s*$/;

function rawExtractOptionLabels(text) {
  if (typeof text !== 'string' || !text) return [];
  const out = [];
  const seen = new Set();
  for (const line of text.split('\n')) {
    const m = line.match(RAW_OPTION_LABEL_RE);
    if (!m) continue;
    const label = m[1].trim();
    if (!label || seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}

// ---------------------------------------------------------------------------
// buildStopGateCard(turn) -- compose a minimal gate-render superset card from
// the turn's own recovered gate content (the option labels recovered from the
// flat ASCII-box text, display-cased via rawExtractOptionLabels above). This
// lets the daemon render the ACTUAL pending gate through the real ladder
// (Plan 05) instead of only re-prompting the model to try firing a card
// again -- Canon Part 7 reuse: gate-render.cjs's renderGate composes the
// card, this function never draws its own.
// ---------------------------------------------------------------------------
function buildStopGateCard(turn) {
  const labels = rawExtractOptionLabels(turn && turn.output_text);
  const options = labels.length > 0
    ? labels.map((l) => ({ label: l }))
    : [{ label: 'Continue' }, { label: 'Stop and clarify' }];
  return {
    kind: 'stop',
    header: 'This turn reached a Decision Gate that has not been answered yet.',
    selectMode: 'single',
    options: options,
  };
}

// -----------------------------------------------------------------------
// Per-session dedup ledger (the gate-dedup sessionState this handler owns).
// In-memory, per daemon-process lifetime -- mirrors the SAME "mint once,
// consume once per session" shape as gate-render.cjs's own
// _firedBindingSessions Set and lib/mcp/tools/gate.cjs's T-198-10 live-gate
// Map (Canon Part 7: the established pattern, not a new one).
// -----------------------------------------------------------------------
const _sessionDedupState = new Map();

function _stateFor(sessionId) {
  const key = (typeof sessionId === 'string' && sessionId.length > 0) ? sessionId : '__no_session__';
  if (!_sessionDedupState.has(key)) _sessionDedupState.set(key, { fired: {} });
  return _sessionDedupState.get(key);
}

function _resetForTest() {
  _sessionDedupState.clear();
}

/**
 * handleStopEvent(sessionId, stopContext) -- the daemon-side host for the
 * moved Stop-gate enforcement (must_haves key_link: gate-dedup -> stop-gate-
 * handler -> gate-render).
 *
 * @param {string|undefined} sessionId
 * @param {object} stopContext -- the same shape scripts/check-card-fire.cjs's
 *   Stop-hook stdin envelope already carries (transcript_path, output_text,
 *   ran_entries, preceding_user_text, ...), PLUS optional { capabilities,
 *   elicitInput, surface } for the gate-render ladder (supplied by the
 *   calling MCP tool layer, lib/mcp/tools/stop-gate.cjs -- mirrors gate-
 *   render.cjs's own "capability detection stays in the tool layer" split).
 * @returns {Promise<{fire: boolean, reason?: string, business?: object,
 *   card?: object, renderer?: string, rendered?: object}>}
 */
async function handleStopEvent(sessionId, stopContext) {
  try {
    const ctx = (stopContext && typeof stopContext === 'object') ? stopContext : {};

    // 1. resolve the session's room binding (SEED-039).
    const roomDir = resolveSessionRoomDir(sessionId, ctx);

    // 2. server-side business close-out FIRST (mirrors scripts/on-stop's own
    //    ordering: STATE.md/memory work happens regardless of whether a gate
    //    ultimately fires -- a Stop event always closes out the session).
    const business = closeOutRoom(roomDir, sessionId);

    // 3. derive the turn's gate signals via the SHIPPED predicate module
    //    (wrap, never re-mint -- Part 7).
    const registry = checkCardFire.loadRegistry();
    const turn = checkCardFire.deriveTurnSignals(Object.assign({}, ctx, { session_id: sessionId }));
    turn.retry_count = 0;
    turn.session_count = 0;
    const verdict = checkCardFire.classifyCardFire(turn, registry);
    const material = verdict.intercept === true;

    // 4. gate-dedup FIRST -- the cheap fire-once + relevance pre-filter, in
    //    front of (never instead of) the shipped predicate's own bounded-
    //    escape-aware verdict above.
    const gateContext = {
      gate: 'stop',
      sid: sessionId,
      subject: turn.gate_signature || '',
      material: material,
    };
    const state = _stateFor(sessionId);
    if (!gateDedup.shouldFireGate(gateContext, state)) {
      return { fire: false, reason: material ? 'dedup-already-fired-this-session' : verdict.reason, business: business };
    }
    // Mark fired BEFORE composing (fire-once discipline, mirrors D-04's
    // mint-before-render shape in gate-render.cjs).
    state.fired[gateDedup.dedupKey(gateContext)] = true;

    if (verdict.intercept !== true) {
      // The dedup/relevance pre-filter alone is never sufficient to fire; the
      // shipped predicate's own verdict (bounded escape, gate-already-
      // answered, gate-irrelevant-to-turn, gate-is-simple-binary, etc.) is
      // the final authority.
      //
      // card-fire-answered-gate-refires-within-ttl-window (2026-07-28) PARITY:
      // wrap the SAME record-lifecycle consumption the CLI Stop hook applies
      // (scripts/check-card-fire.cjs main()'s terminal branches), never a second
      // implementation (Part 7). A TERMINAL verdict here means this Stop
      // evaluation adjudicated the side-channel reached-gate records, so they
      // are spent; leaving them alive is what let one mint force again on every
      // later turn inside its TURN_FRESH_MS window. intercept:true is an ACTIVE
      // force-loop and deliberately does NOT consume, exactly as in the CLI path.
      // Best-effort: a consumption fault never changes the verdict.
      checkCardFire.consumeReachedGatesForVerdict(turn, verdict);
      return { fire: false, reason: verdict.reason, business: business };
    }

    // 5. compose + render the gate (Plan 05 superset ladder). A Stop event
    //    is never a live, in-band tool call -- capabilities default to the
    //    headless text rung unless the calling tool layer supplied real
    //    capabilities (mirrors lib/mcp/tools/gate.cjs's own split).
    const card = buildStopGateCard(turn);
    const renderCtx = {
      capabilities: (ctx.capabilities && typeof ctx.capabilities === 'object') ? ctx.capabilities : {},
      sessionId: sessionId,
    };
    if (typeof ctx.elicitInput === 'function') renderCtx.elicitInput = ctx.elicitInput;
    const rendered = await gateRender.renderGate(card, renderCtx);

    return Object.assign({ fire: true, business: business }, rendered);
  } catch (_e) {
    // Defensive: a handler bug must never force a card. Degrades to
    // do-not-fire, matching gate-dedup's own error floor.
    return { fire: false, reason: 'handler-error' };
  }
}

module.exports = {
  handleStopEvent: handleStopEvent,
  closeOutRoom: closeOutRoom,
  buildStopGateCard: buildStopGateCard,
  resolveSessionRoomDir: resolveSessionRoomDir,
  _resetForTest: _resetForTest,
};
