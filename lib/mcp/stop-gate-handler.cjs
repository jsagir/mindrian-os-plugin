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
//   2. Derives the turn's gate signals and delegates the FINAL bounded-
//      escape-aware predicate to the SHIPPED scripts/check-card-fire.cjs
//      logic (wrap, never re-mint -- the frozen constitutional floor
//      (MAX_FORCE_RETRIES, MAX_SESSION_INTERCEPTS) stays declared in exactly
//      one place and is only ever READ here via that module's own exports),
//      feeding it the REAL retry/session counts read from the SAME local
//      side-file the CLI Stop hook drives. A non-material verdict is TERMINAL
//      and returns immediately, clearing both counters and spending the
//      reached-gate records.
//   3. Only for a MATERIAL verdict does it consult gate-dedup.shouldFireGate,
//      the fire-once pre-filter in front of card composition (Part 7). Note
//      the ordering: that check used to run BEFORE step 2's terminal branch,
//      which made the terminal branch unreachable, since shouldFireGate
//      already returns false for every non-material verdict. See the
//      mcp-first-path-retry-ceiling-hardcoded-zero note inside
//      handleStopEvent.
//   4. Only on a genuine intercept verdict does it compose the gate through
//      lib/mcp/gate-render.cjs's renderGate (Plan 05's superset ladder) and
//      return that payload; a do-not-fire verdict returns { fire: false }
//      and composes nothing.
//   5. Owns the server-side share of on-stop's business close-out (STATE.md
//      persist + the memory-lifecycle/minto-debouncer/folder-memory
//      invocations, PLUS the Feynman-MINTO guardian's on-stop invariant
//      check as of Phase 241-05, F-1/MINTO-01 Tri-Polar parity) so
//      scripts/on-stop's flag-ON branch can stay a thin wake+query+render
//      adapter with ZERO of those business-module tokens in its own text
//      (D-06). The existing scripts/modules are REQUIRED or spawned as-is --
//      NOT re-implemented (Canon Part 7).
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
const sessionRoom = require('./session-room.cjs');

// The shipped Stop-hook predicate (scripts/check-card-fire.cjs). Required by
// absolute path so this module works identically whether loaded from
// lib/mcp/ or re-required from a test fixture -- the frozen floor
// (MAX_FORCE_RETRIES / MAX_SESSION_INTERCEPTS) lives ONLY in that file; this
// module never re-declares those scalars, it only reads the predicate's
// verdict.
const checkCardFire = require(path.join(PLUGIN_ROOT, 'scripts', 'check-card-fire.cjs'));

/**
 * resolveSessionRoomDir -- thin delegate to lib/mcp/session-room.cjs, the ONE
 * shared MCP resolver (Phase 248-01, CTX-01). Preserves this file's own
 * null-floor variant (no fallbackRoomDir, no cwd guess -- a Stop event with
 * no resolvable room must not invent one) via noFloor:true. The old
 * surface-defaults-'cli' line is dropped: resolution is surface-free now, so
 * a default surface value has nothing left to feed. Deliberately a `const`
 * arrow, not a `function` declaration -- the census gate
 * (tests/test-248-resolver-census.cjs, census.1) asserts `function
 * resolveSessionRoomDir` appears in exactly ONE file (session-room.cjs); a
 * function-keyword delegate here would be a second def site.
 *
 * @param {string|undefined} sessionId
 * @param {{surface?: string}} [ctx]
 * @returns {string|null}
 */
const resolveSessionRoomDir = (sessionId, ctx) =>
  sessionRoom.resolveMcpSessionRoom({ sessionId: sessionId, ctx: ctx, noFloor: true }).dir;

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

/**
 * _closeOutMintoDrain -- despite the name (kept for call-site/registry
 * stability, see Task 1 read_first), this path deliberately does NOT
 * drain. Phase 241-02 (F-0, MINTO-01) retired the unconditional
 * zero-age-floor vacuum that used to run here: it discarded every
 * pending regen intent before the live Phase 88-05 consumer (the drain
 * block inside scripts/intent-classifier, wired on UserPromptSubmit,
 * draining at olderThanMs=30000) ever got a turn. See
 * .planning/debug/resolved/minto-debounce-consumer-dead-end.md. This now
 * calls the debouncer's read-only peek() accessor and returns the real
 * pending-entry count so Desktop/Cowork surfaces (which read this
 * function's return value via closeOutRoom) see an honest figure instead
 * of a silently emptied queue.
 *
 * @param {string} roomDir
 * @returns {number} pending entry count, 0 on any fault (never throws).
 */
function _closeOutMintoDrain(roomDir) {
  try {
    const debouncer = require(path.join(PLUGIN_ROOT, 'scripts', 'minto-debouncer.cjs'));
    if (typeof debouncer.peek !== 'function') return 0;
    const snap = debouncer.peek(roomDir);
    return (snap && Array.isArray(snap.entries)) ? snap.entries.length : 0;
  } catch (_e) {
    return 0;
  }
}

/**
 * _closeOutGuardianOnStop -- Phase 241-05 (F-1, MINTO-01 Tri-Polar parity).
 * The shared mindrian-core Stop path never invoked the Feynman-MINTO
 * guardian's on-stop invariant check at all (zero references to
 * feynman-minto-guardian anywhere in this file, confirmed by 241-RESEARCH.md's
 * grep). That left Desktop, Cowork, and CLI-under-MINDRIAN_MCP_FIRST blind
 * to the guardian's report even after Phase 241-01 fixed the CLI legacy
 * path (scripts/on-stop's own timeout/redirect discard). This sibling runs
 * the SAME guardian binary the CLI path runs (scripts/feynman-minto-guardian.cjs
 * on-stop <roomDir>), via execFileSync (mirrors _closeOutStateMd's bash
 * execFileSync idiom above), parses the LAST non-empty stdout line as JSON,
 * and returns its systemMessage. Never throws; a missing guardian file, a
 * timeout, or a parse failure all degrade to null -- this is advisory
 * reporting, never a close-out blocker.
 *
 * Ordering (behavioral, not cosmetic): called AFTER _closeOutMintoDrain and
 * _closeOutFolderMemorySnapshot in closeOutRoom below, because the
 * guardian's queue-health and snapshot-integrity validators read state
 * those two helpers produce. Running the guardian first would validate a
 * pre-close-out snapshot. Mirrors scripts/on-stop, where the Phase 88-13
 * guardian block deliberately sits after the Phase 88-06 drain and
 * snapshot.
 *
 * 3000ms timeout matches the outer ceiling Phase 241-01 set on the CLI
 * path (scripts/on-stop's GUARDIAN_TIMEOUT_S, default 3), so both surfaces
 * truncate at the same point rather than two different unstated ones. The
 * guardian's own internal soft walk budget (ONSTOP_WALK_BUDGET_MS) is the
 * primary bound; this is a last-resort backstop, same as on the CLI side.
 *
 * @param {string} roomDir
 * @returns {string|null} the guardian's systemMessage, or null on any fault
 *   (missing file, timeout, non-JSON output, or an empty/absent field).
 */
function _closeOutGuardianOnStop(roomDir) {
  try {
    const guardianPath = path.join(PLUGIN_ROOT, 'scripts', 'feynman-minto-guardian.cjs');
    if (!fs.existsSync(guardianPath)) return null;
    const out = execFileSync(process.execPath, [guardianPath, 'on-stop', roomDir], { timeout: 3000, encoding: 'utf8' });
    const lines = String(out || '').split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
    if (lines.length === 0) return null;
    let parsed;
    try {
      parsed = JSON.parse(lines[lines.length - 1]);
    } catch (_eParse) {
      return null;
    }
    if (parsed && typeof parsed.systemMessage === 'string' && parsed.systemMessage.length > 0) {
      return parsed.systemMessage;
    }
    return null;
  } catch (_e) {
    return null;
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
 * @returns {{room_dir: string|null, sections: number, stale: number, minto_pending: number, guardian_sm: string|null}}
 */
function closeOutRoom(roomDir, sessionId) {
  if (!roomDir || typeof roomDir !== 'string' || !fs.existsSync(roomDir)) {
    return { room_dir: null, sections: 0, stale: 0, minto_pending: 0, guardian_sm: null };
  }
  const mintoPending = _closeOutMintoDrain(roomDir);
  _closeOutRecompile(roomDir);
  const snap = _closeOutFolderMemorySnapshot(roomDir, sessionId);
  // Phase 241-05 (F-1, MINTO-01 Tri-Polar parity): AFTER both
  // _closeOutMintoDrain and _closeOutFolderMemorySnapshot -- see
  // _closeOutGuardianOnStop's own docstring for why the order is
  // behavioral, not cosmetic.
  const guardianSm = _closeOutGuardianOnStop(roomDir);
  _closeOutStateMd(roomDir);
  _closeOutMemoryLifecycle(roomDir);
  return { room_dir: roomDir, sections: snap.sections, stale: snap.stale, minto_pending: mintoPending, guardian_sm: guardianSm };
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

// ---------------------------------------------------------------------------
// mcp-first-path-retry-ceiling-hardcoded-zero (2026-07-28): best-effort wrappers
// around the SHARED bounded-escape accessors in scripts/check-card-fire.cjs.
//
// Those accessors are already best-effort internally (a missing, corrupt, or
// unwritable side-file degrades to a count of 0 there). These wrappers guard a
// DIFFERENT failure: a version skew in which an accessor is not exported at all.
// Unwrapped, that would throw, handleStopEvent's outer catch would return
// 'handler-error', and the Stop gate would silently stop firing ENTIRELY --
// trading an unbounded loop for a fully disabled gate, which is the worse
// direction. Degrading a read to 0 is exactly the CLI path's own store-level
// degrade, so both enforcement paths fail identically.
//
// Part 8: these only touch local scalars in a local file under ~/.mindrian.
// ---------------------------------------------------------------------------
function _safeCtxHash(turn) {
  try {
    return checkCardFire.turnContextHash(turn);
  } catch (_e) {
    return '';
  }
}

function _safeCount(fn, key) {
  try {
    if (typeof fn !== 'function') return 0;
    const v = fn(key);
    return Number.isFinite(v) ? v : 0;
  } catch (_e) {
    return 0;
  }
}

// _safeCounterWrite -- shared by the bump (force branch) and clear (terminal
// branch) call sites. A counter write must NEVER change the verdict.
function _safeCounterWrite(fn, key) {
  try {
    if (typeof fn === 'function') fn(key);
  } catch (_e) {
    /* best-effort, matching every other side-file helper in this cluster */
  }
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

    // mcp-first-path-retry-ceiling-hardcoded-zero (2026-07-28): feed the REAL
    // bounded-escape counters into the predicate.
    //
    // These two lines used to read `turn.retry_count = 0; turn.session_count = 0;`
    // -- an UNCONDITIONAL overwrite on every call, not a fallback default (the
    // turn object deriveTurnSignals returns carries neither field). Because
    // classifyCardFire's two ceiling checks read exactly these fields, both
    // MAX_FORCE_RETRIES and MAX_SESSION_INTERCEPTS were compared against a
    // permanent 0 and were structurally unreachable, so this path could force
    // cards without bound. The handler also never bumped or cleared either
    // counter, so a correct read alone would not have helped. Measured pre-fix:
    // 36 cards forced against a per-gate ceiling of 3 and a session ceiling of
    // 12 (tests/test-198-stop-gate-retry-ceiling.test.cjs).
    //
    // The counts come from the SAME accessors, keyed by the SAME
    // turnContextHash, against the SAME local side-file that
    // scripts/check-card-fire.cjs main() drives (its lines 1434-1439). Wired,
    // never re-derived: the two enforcement paths spend ONE shared budget rather
    // than two divergent ones (Part 7).
    const ctxHash = _safeCtxHash(turn);
    turn.retry_count = _safeCount(checkCardFire.readRetryCount, ctxHash);
    turn.session_count = _safeCount(checkCardFire.readSessionCount, sessionId);

    const verdict = checkCardFire.classifyCardFire(turn, registry);
    const material = verdict.intercept === true;

    // 4. TERMINAL verdict -- the shipped predicate says do not force: an ordinary
    //    turn, a card already fired, a relevance pass, or the bounded escape
    //    releasing. The predicate is the final authority; the dedup pre-filter
    //    below is never sufficient to fire on its own.
    //
    //    ORDERING NOTE (mcp-first-path-retry-ceiling-hardcoded-zero, 2026-07-28):
    //    this block used to sit BELOW the gate-dedup pre-filter, where it was
    //    DEAD CODE. gateDedup.shouldFireGate returns false whenever
    //    gateContext.material !== true, and material is exactly
    //    `verdict.intercept === true`, so every non-material verdict returned
    //    from the dedup branch and could never reach here. That silently
    //    disabled the record-lifecycle consumption the sibling RCA
    //    (card-fire-answered-gate-refires-within-ttl-window, 2026-07-28) wired
    //    into this handler: its Behavior 15 anti-drift assertion greps this
    //    file's SOURCE TEXT for the call, which was present but unreachable.
    //    Hoisting the check above the dedup pre-filter makes it live. The RETURN
    //    VALUE is unchanged ({ fire:false, reason: verdict.reason, business }),
    //    so no caller observes a different shape; only the side effects run now.
    if (!material) {
      // CLI parity: main()'s degrade branch and its no-intercept branch both do
      // exactly this. The navigator is being let through, so the session is
      // unstuck and the next genuine gate must start from a full budget instead
      // of inheriting a spent one.
      _safeCounterWrite(checkCardFire.clearRetryCount, ctxHash);
      _safeCounterWrite(checkCardFire.clearSessionCount, sessionId);
      // Record lifecycle: a TERMINAL verdict means this Stop evaluation
      // adjudicated the side-channel reached-gate records, so they are spent.
      // Leaving them alive is what let one mint force again on every later turn
      // inside its TURN_FRESH_MS window. intercept:true is an ACTIVE force-loop
      // and deliberately does NOT consume (consumeReachedGatesForVerdict
      // self-guards on that), exactly as in the CLI path. Best-effort: a
      // consumption fault never changes the verdict.
      checkCardFire.consumeReachedGatesForVerdict(turn, verdict);
      return { fire: false, reason: verdict.reason, business: business };
    }

    // 5. gate-dedup -- the fire-once pre-filter, in front of (never instead of)
    //    the shipped predicate's bounded-escape-aware verdict above. Only a
    //    MATERIAL verdict reaches it now, which is the only case it ever decided.
    const gateContext = {
      gate: 'stop',
      sid: sessionId,
      subject: turn.gate_signature || '',
      material: material,
    };
    const state = _stateFor(sessionId);
    if (!gateDedup.shouldFireGate(gateContext, state)) {
      // Suppressed, so NO card is forced this turn. Deliberately neither bumps
      // nor clears: no forced card means no retry budget was spent, and clearing
      // would hand budget back on a gate that is still pending. Leaving the
      // counters untouched keeps them monotone toward the ceiling across a daemon
      // restart, which matters because this dedup ledger is in-memory and
      // per-process while the counters are on disk.
      return { fire: false, reason: 'dedup-already-fired-this-session', business: business };
    }
    // Mark fired BEFORE composing (fire-once discipline, mirrors D-04's
    // mint-before-render shape in gate-render.cjs).
    state.fired[gateDedup.dedupKey(gateContext)] = true;

    // 6. FORCE the card. CLI parity (main()'s intercept branch): bump BOTH the
    //    per-gate counter and the session-wide counter. Bumping the session
    //    counter on every forced card is what makes a FLAPPING per-gate key still
    //    converge -- a model that re-words its options each retry mints a fresh
    //    gate signature, which flaps the per-gate key AND gate-dedup's own
    //    subject, so the content-INDEPENDENT session counter is the only thing
    //    that can bound that loop (CR-04). Bumping here rather than at the verdict
    //    means the budget tracks cards ACTUALLY forced: a dedup-suppressed turn
    //    forces nothing, so it spends nothing.
    _safeCounterWrite(checkCardFire.bumpRetryCount, ctxHash);
    _safeCounterWrite(checkCardFire.bumpSessionCount, sessionId);

    // 7. compose + render the gate (Plan 05 superset ladder). A Stop event
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
