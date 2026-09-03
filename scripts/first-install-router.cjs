#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 267.2 W1b/W1d -- scripts/first-install-router.cjs (HOOK-08)
 *
 * The deterministic UserPromptSubmit hook that owns the first-install
 * first-contact moment. Repairs the 267.1 audit's central finding (the
 * Reward and Investment legs were asserted in prose and never wired) by
 * moving the ROUTING DECISION off prose and onto this hook. Only the verb
 * that must be model-executed -- invoking /mos:ignite -- stays as prose,
 * because no hook can invoke a slash command (see the `ignite` branch of
 * _buildAdditionalContext below, and the Architectural Responsibility Map
 * this plan's own research names).
 *
 * Cloned in SHAPE from scripts/mva-detect.cjs (the right hook-shape target
 * per 267.2-PATTERNS.md A2) and scripts/check-pending-breakthrough.cjs (the
 * cleanest in-repo emitContinue/emitContinueWithContext pair). Deliberately
 * NOT cloned from scripts/intent-classifier.cjs: that file is 3400+ lines
 * carrying seven unrelated concerns and is useful here only as corroboration
 * that the additionalContext envelope works in production.
 *
 * NON-NEGOTIABLE INVARIANT, shared by all three exemplar hooks: THIS HOOK
 * NEVER BLOCKS AND NEVER EXITS NON-ZERO. Every filesystem and spawn call is
 * wrapped so any failure degrades to {continue:true} + exit 0, and the
 * top-level uncaughtException handler below is the last-resort net.
 *
 * State machine (declared here, frozen, exported for the two plans that
 * extend it -- this plan implements armed -> routed only):
 *   armed -> routed -> reward_pending -> reward_delivered -> investment_asked -> done
 *   'reward_pending'/'reward_delivered' are written by plan 267.2-07.
 *   'investment_asked'/'done' are written by plan 267.2-09.
 *
 * ONE-SHOT GATE (Pitfall 3 mitigation, research 267.2-RESEARCH.md): the
 * onboarding marker (~/.mindrian-onboarded, read via scripts/check-onboard)
 * is read EXACTLY ONCE, at arm time, and only when this router's own
 * state.json does not yet exist. `check-onboard --write` is itself a prose
 * instruction the model may run between turns -- reading the marker a
 * second time would let that mid-flow write silently disarm the router.
 * After arming, this router's own state.json is the sole authority.
 *
 * Tri-Polar gap (decision D-K, stated not hidden): this hook fires on Claude
 * Code CLI only. Claude Desktop and Cowork do not run hooks/hooks.json, so
 * on those two surfaces the router is model-invoked and carries the same
 * model-compliance exposure the 267.1 audit scored -- a deliberate recorded
 * call, not an oversight. The classifier this router calls lives in
 * lib/core/ (not scripts/) precisely so one implementation can also serve a
 * future MCP handler on Desktop/Cowork.
 *
 * Plan 267.2-07 (HOOK-07) extends the state machine with the reward legs:
 * routed -> reward_pending -> reward_delivered. Decision D-D fixes the
 * architecture: this hook NEVER calls the MVA orchestrator module's
 * runPipeline inline -- runPipeline dispatches through a 45s global / 35s
 * per-agent budget (lib/core/mva-dispatcher.cjs's binding decision B2),
 * measured at up to 5337ms on the fresh-install no-key path (267.2-01),
 * against a 3000ms hook ceiling. Instead this hook fires
 * scripts/mva-run.cjs as a DETACHED, unref-ed child with its stdout
 * captured to a file, exactly the shape scripts/brain-derivation-drain.cjs
 * documents in its own header, and drains the captured render on a LATER
 * turn. Honest residual, stated not hidden: the reward is delivered by
 * machinery rather than by a prose promise (closing GAP R-1), but it lands
 * one turn after the sentence that triggers it, not the same turn.
 *
 * Canon Part 8 discipline (copied verbatim in spirit from
 * scripts/mva-detect.cjs:25-29): the raw prompt lives ONLY in the in-memory
 * `prompt` variable for the classification call; it is never written to
 * state.json, never written to telemetry, never logged. Telemetry carries
 * sha256(prompt) as the largest string it ever writes.
 *
 * Absolutely forbidden in this file, per CONTEXT.md D-07: reading the
 * Anthropic, Tavily, or Brain key env vars, or requiring the Brain client
 * chokepoint (lib/core/brain-client.cjs) or its lower-level MCP client
 * (bin/mindrian-brain-mcp-client.cjs). This router needs none of them --
 * classification is local, and the only downstream verb (/mos:ignite) is
 * left to the model, not called from here.
 *
 * Pure CJS, node built-ins only.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync, spawn } = require('node:child_process');

const HOOK_EVENT_NAME = 'UserPromptSubmit';
const STDIN_TIMEOUT_MS = 200;
const CHECK_ONBOARD_TIMEOUT_MS = 400;

// The frozen phase sequence. Advanced in this order and never skipped. This
// plan writes 'armed' and 'routed' only; the remaining four phases are
// declared here so plans 267.2-07 and 267.2-09 extend this array's meaning
// rather than redefining it.
const PHASES = Object.freeze([
  'armed',
  'routed',
  'reward_pending',
  'reward_delivered',
  'investment_asked',
  'done',
]);

/**
 * Pure state-transition predicate: true only when `toPhase` is the single
 * next phase after `fromPhase` in PHASES. No I/O. Exported so tests (this
 * plan's and the two that follow it) can drive the machine without
 * spawning the hook as a child process.
 * @param {string} fromPhase
 * @param {string} toPhase
 * @returns {boolean}
 */
function isValidTransition(fromPhase, toPhase) {
  const fromIdx = PHASES.indexOf(fromPhase);
  const toIdx = PHASES.indexOf(toPhase);
  if (fromIdx === -1 || toIdx === -1) return false;
  return toIdx === fromIdx + 1;
}

// ---------- Home resolution (called at CALL time, never module scope) ----------
// research Pitfall 6 / threat T-270-13: a module-scope constant would bind
// the real developer HOME for the rest of the process, breaking any
// isolated-HOME test fixture that overrides HOME after this file loads.

function homeDir() {
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function firstInstallDir() {
  return path.join(homeDir(), '.mindrian', 'first-install');
}

function stateFilePath() {
  return path.join(firstInstallDir(), 'state.json');
}

function telemetryDir() {
  return path.join(homeDir(), '.mindrian', 'telemetry', 'v1.13');
}

function telemetryFilePath() {
  return path.join(telemetryDir(), 'first-install-router.jsonl');
}

// ---------- Envelope helpers (mirrors mva-detect.cjs / check-pending-breakthrough.cjs) ----------

const ENVELOPE_ALLOWED = new Set([
  'decision', 'reason', 'continue', 'stopReason',
  'suppressOutput', 'systemMessage', 'hookSpecificOutput',
]);

function emitEnvelope(envelope) {
  const filtered = {};
  for (const k of Object.keys(envelope || {})) {
    if (ENVELOPE_ALLOWED.has(k)) filtered[k] = envelope[k];
  }
  if (filtered.continue === undefined) filtered.continue = true;
  try { process.stdout.write(JSON.stringify(filtered)); } catch (_e) { /* swallow */ }
  process.exit(0);
}

function emitEmpty() {
  emitEnvelope({ continue: true });
}

function emitContinueWithContext(additionalContext) {
  emitEnvelope({
    continue: true,
    hookSpecificOutput: {
      hookEventName: HOOK_EVENT_NAME,
      additionalContext: additionalContext,
    },
  });
}

process.on('uncaughtException', () => {
  try { emitEmpty(); } catch (_e) { process.exit(0); }
});

// ---------- Stdin read (200ms budget; mirrors mva-detect.cjs) ----------

function readStdinSync() {
  try {
    if (process.stdin.isTTY) return null;
    const buf = fs.readFileSync(0);
    const s = buf.toString('utf8');
    return s.length > 0 ? s : null;
  } catch (_e) {
    return null;
  }
}

function safeParseJSON(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

// ---------- State I/O (atomic write, mirrors lib/core/mva-state.cjs's pattern) ----------

function _readState() {
  try {
    const raw = fs.readFileSync(stateFilePath(), 'utf8');
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

function _atomicWriteState(obj) {
  try {
    fs.mkdirSync(firstInstallDir(), { recursive: true });
    const target = stateFilePath();
    const tmp = target + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
    fs.writeFileSync(tmp, JSON.stringify(obj), 'utf8');
    fs.renameSync(tmp, target);
    return true;
  } catch (_e) {
    return false;
  }
}

// ---------- Telemetry (append-only, scalar-only; mirrors mva-detect.cjs) ----------

function _appendTelemetry(record) {
  try {
    fs.mkdirSync(telemetryDir(), { recursive: true });
  } catch (_e) { /* best effort */ }
  try {
    fs.appendFileSync(telemetryFilePath(), JSON.stringify(record) + '\n', 'utf8');
  } catch (_e) { /* best effort -- a telemetry failure never affects the envelope */ }
}

// ---------- The one-shot marker read (exactly once, at arm time only) ----------

function _checkOnboardStatus() {
  try {
    const checkOnboardPath = path.join(__dirname, 'check-onboard');
    const result = spawnSync('bash', [checkOnboardPath], {
      timeout: CHECK_ONBOARD_TIMEOUT_MS,
      encoding: 'utf8',
      env: process.env,
    });
    if (!result || result.error || typeof result.stdout !== 'string') return null;
    const firstLine = result.stdout.split('\n')[0].trim();
    return firstLine;
  } catch (_e) {
    return null;
  }
}

// ---------- rooms_home_exists / active_room_bound proxies (mirrors mva-detect.cjs's resolveActiveRoomDir) ----------

function _resolveRoomsHome() {
  try {
    if (process.env.MINDRIAN_ROOMS_HOME && fs.existsSync(process.env.MINDRIAN_ROOMS_HOME)) {
      return process.env.MINDRIAN_ROOMS_HOME;
    }
    const defaultHome = path.join(homeDir(), 'MindrianRooms');
    if (fs.existsSync(defaultHome)) return defaultHome;
  } catch (_e) { /* graceful */ }
  return null;
}

function _roomsHomeExists() {
  return !!_resolveRoomsHome();
}

function _activeRoomBound() {
  try {
    const roomsHome = _resolveRoomsHome();
    if (!roomsHome) return false;
    const regPath = path.join(roomsHome, '.rooms', 'registry.json');
    if (!fs.existsSync(regPath)) return false;
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    if (reg && typeof reg.active === 'string' && reg.active.length > 0) {
      return fs.existsSync(path.join(roomsHome, reg.active));
    }
  } catch (_e) { /* graceful */ }
  return false;
}

// ---------- additionalContext payloads (the ONLY leg that stays prose) ----------

function _buildAdditionalContext(bucket, outcome) {
  if (outcome === 'ignite') {
    // The one verb that must stay prose: no hook can invoke a slash command.
    // Do not "fix" this by trying to spawn /mos:ignite from here -- see the
    // Architectural Responsibility Map (267.2-RESEARCH.md).
    return '[first-install-router] bucket=' + bucket + ' outcome=ignite. '
      + 'Open with a short Larry greeting carrying exactly one De Stijl glyph '
      + '(Canon Part 12), then invoke /mos:ignite. This is the one leg of the '
      + 'first-install flow that stays prose by design: no hook can invoke a '
      + 'slash command, so the model executes this verb while this router '
      + 'already made the decision that led here.';
  }
  if (outcome === 'clarify') {
    // Phrased as a named-choice question, never yes/no: a yes/no-shaped gate
    // falls into check-card-fire.cjs's isYesNoShapedGate exemption and is
    // never force-fired (research Pitfall 4).
    return '[first-install-router] bucket=' + bucket + ' outcome=clarify. '
      + 'The user referenced prior work. Ask exactly ONE clarifying exchange '
      + 'about what the prior work is and where it lives, phrased as a '
      + 'NAMED-CHOICE question, never a yes/no question -- a yes/no-shaped '
      + 'gate is exempt from force-fire and is never enforced. Do not proceed '
      + 'past this one clarifying exchange without the user\'s answer.';
  }
  // outcome === 'larry' (bucket is just_talk or ambiguous)
  return '[first-install-router] bucket=' + bucket + ' outcome=larry. '
    + 'Continue as plain Larry conversation. Do NOT render a menu or a '
    + 'command list -- the reward-before-investment rule requires a real '
    + 'reward to land before any investment ask, and a menu this early is '
    + 'itself an investment ask.';
}

// ---------- The armed turn: classify, route, transition to 'routed' ----------

function _classifyAndRoute(state, prompt, t0) {
  let bucket = 'ambiguous';
  let outcome = 'larry';
  let classification = null;
  try {
    const detector = require('../lib/core/greeting-intent-detector.cjs');
    classification = detector.classify(prompt);
    bucket = classification.bucket;
    outcome = detector.route(bucket);
  } catch (_e) {
    // degrade to the safe ambiguous/larry defaults already set above
  }

  const routedAtMs = Date.now();
  const routedState = Object.assign({}, state, {
    phase: 'routed',
    routed_at_ms: routedAtMs,
    bucket: bucket,
    outcome: outcome,
  });
  _atomicWriteState(routedState);

  try {
    const sentenceSha = (typeof prompt === 'string' && prompt.length > 0)
      ? crypto.createHash('sha256').update(prompt, 'utf8').digest('hex')
      : null;
    const features = (classification && classification.features) ? classification.features : {};
    _appendTelemetry({
      schema_version: 1,
      event: 'routed',
      ts_ms: routedAtMs,
      sentence_sha256: sentenceSha,
      bucket: bucket,
      outcome: outcome,
      margin: classification ? classification.margin : null,
      confidence: classification ? classification.confidence : null,
      word_count: typeof features.word_count === 'number' ? features.word_count : null,
      char_count: typeof features.char_count === 'number' ? features.char_count : null,
      features: features,
      elapsed_ms: Date.now() - t0,
    });
  } catch (_e) { /* telemetry is best-effort */ }

  const additionalContext = _buildAdditionalContext(bucket, outcome);
  return emitContinueWithContext(additionalContext);
}

// ---------- The next turn after routing: measure the ignite outcome (research Pitfall 5) ----------

function _emitOutcomeObserved(state) {
  const roomsHomeExists = _roomsHomeExists();
  const activeRoomBound = _activeRoomBound();
  try {
    _appendTelemetry({
      schema_version: 1,
      event: 'outcome_observed',
      ts_ms: Date.now(),
      sentence_sha256: null,
      bucket: state.bucket || null,
      outcome: state.outcome || null,
      routed_bucket: state.bucket || null,
      routed_outcome: state.outcome || null,
      margin: null,
      confidence: null,
      word_count: null,
      char_count: null,
      features: {},
      elapsed_ms: 0,
      rooms_home_exists: roomsHomeExists,
      active_room_bound: activeRoomBound,
    });
  } catch (_e) { /* telemetry is best-effort */ }

  // Do not attempt to detect the slash-command invocation itself; a proxy
  // stated as a proxy (the two booleans above) is better than a claim this
  // hook cannot support. This does not advance `phase` past 'routed' --
  // that transition belongs to plan 267.2-07 (reward_pending).
  const updated = Object.assign({}, state, { outcome_observed_at_ms: Date.now() });
  _atomicWriteState(updated);
  return emitEmpty();
}

// ---------- The reward fire: detached, fire-and-forget, never inline (D-D) ----------
//
// Runs once the outcome has already been observed on an earlier turn (so
// `existingState.phase === 'routed' && existingState.outcome_observed_at_ms`
// is set -- see main()). Gated on the shipped MVA classifier's own verdict
// (lib/core/mva-state.cjs::readPending), never on this router's opinion, and
// never fabricates a pending record: mva-detect.cjs / mva-classifier.cjs own
// that write, including the length guards, English-only rule and Hebrew
// refusal path. A throw anywhere in this block degrades to an honest skip;
// the envelope still emits and the state machine still advances.

const SKIP_REASONS = Object.freeze(['no_pending', 'hebrew_refusal', 'already_running']);

function _fireReward(state) {
  const startMs = Date.now();
  let sha8 = null;
  let skipReason = null;
  let capturePath = null;
  let sentenceSha256 = null;

  try {
    const mvaState = require('../lib/core/mva-state.cjs');
    const pending = mvaState.readPending();
    if (!pending || typeof pending.sentence_sha256 !== 'string' || pending.sentence_sha256.length < 8) {
      skipReason = 'no_pending';
    } else if (pending.hebrew_refusal === true) {
      skipReason = 'hebrew_refusal';
    } else if (mvaState.isAlreadyRunning()) {
      skipReason = 'already_running';
    } else {
      sentenceSha256 = pending.sentence_sha256;
      sha8 = sentenceSha256.slice(0, 8);
      const dir = firstInstallDir();
      fs.mkdirSync(dir, { recursive: true });
      capturePath = path.join(dir, 'brief-' + sha8 + '.md');
      let fd = null;
      try {
        fd = fs.openSync(capturePath, 'w');
        // Detached, unref-ed child (mirrors scripts/brain-derivation-drain.cjs
        // and scripts/auto-explore-fingerprint.cjs). This process does NOT
        // await the child and does NOT require the MVA orchestrator module
        // directly -- the child (scripts/mva-run.cjs) is the only caller
        // of runPipeline.
        const child = spawn(process.execPath, [path.join(__dirname, 'mva-run.cjs')], {
          detached: true,
          stdio: ['ignore', fd, 'ignore'],
          env: process.env,
        });
        child.unref();
      } finally {
        if (fd !== null) {
          try { fs.closeSync(fd); } catch (_e) { /* parent's copy only; best-effort */ }
        }
      }
    }
  } catch (_e) {
    // Any throw degrades to the skip path. An honest skip that is recorded
    // is worth more than a fabricated reward.
    sha8 = null;
    capturePath = null;
    if (!skipReason || SKIP_REASONS.indexOf(skipReason) === -1) skipReason = 'no_pending';
  }

  const firedAtMs = Date.now();
  const rewardState = Object.assign({}, state, {
    phase: 'reward_pending',
    sha8: sha8,
    fired_at_ms: firedAtMs,
    capture_path: capturePath,
    skip_reason: skipReason,
    drain_retries: 0,
  });
  _atomicWriteState(rewardState);

  try {
    _appendTelemetry({
      schema_version: 1,
      event: 'reward_fired',
      ts_ms: firedAtMs,
      sentence_sha256: sentenceSha256,
      sha8: sha8,
      skip_reason: skipReason,
      elapsed_ms: Date.now() - startMs,
    });
  } catch (_e) { /* telemetry is best-effort */ }

  return emitEmpty();
}

// ---------- The reward drain: consumed on a later turn, never wedges ----------
//
// Runs on every turn where state.json reads phase 'reward_pending'. A
// skipped fire (sha8 null) advances straight through with its skip_reason
// carried forward, so the investment gate in plan 267.2-09 still opens on a
// session where no brief was ever eligible (decision D-L: the investment ask
// never precedes the reward ATTEMPT). Never throws, never exits non-zero: a
// missing, empty, unreadable or malformed capture file is a not-ready state
// or a bounded timeout, never an error.

const DRAIN_MAX_RETRIES = 5;
const MAX_INJECTED_CHARS = 6000;

function _advanceToRewardDelivered(state, extra) {
  const deliveredAtMs = Date.now();
  const deliveredState = Object.assign({}, state, {
    phase: 'reward_delivered',
    delivered_at_ms: deliveredAtMs,
  }, extra || {});
  _atomicWriteState(deliveredState);
  return deliveredAtMs;
}

function _drainReward(state) {
  // The fire leg recorded a skip: advance straight through, reason carried.
  if (!state.sha8) {
    const deliveredAtMs = _advanceToRewardDelivered(state, {});
    try {
      _appendTelemetry({
        schema_version: 1,
        event: 'reward_delivered',
        ts_ms: deliveredAtMs,
        sha8: null,
        brief_bytes: 0,
        turns_waited: 0,
        skip_reason: state.skip_reason || null,
      });
    } catch (_e) { /* best-effort */ }
    return emitEmpty();
  }

  const retriesSoFar = typeof state.drain_retries === 'number' ? state.drain_retries : 0;

  let ready = false;
  let briefBytes = 0;
  try {
    if (state.capture_path && fs.existsSync(state.capture_path)) {
      const st = fs.statSync(state.capture_path);
      if (st.size > 0) {
        briefBytes = st.size;
        let mvaComplete = false;
        try {
          const mvaState = require('../lib/core/mva-state.cjs');
          const pending = mvaState.readPending();
          // The MVA orchestrator calls markComplete() on every terminating
          // path, including all-agents-failed, so this is the primary
          // readiness signal.
          mvaComplete = !!(pending && pending.pipeline_status === 'complete');
        } catch (_e) { mvaComplete = false; }
        // Fallback: the capture file has already survived one full turn
        // with non-zero size, since scripts/mva-run.cjs writes its whole
        // rendered brief in a single stdout write at process exit.
        const stableFallback = retriesSoFar >= 1;
        ready = mvaComplete || stableFallback;
      }
    }
  } catch (_e) {
    ready = false;
  }

  if (ready) {
    let briefText = null;
    try {
      briefText = fs.readFileSync(state.capture_path, 'utf8');
    } catch (_e) {
      briefText = null;
    }
    if (typeof briefText === 'string' && briefText.length > 0) {
      let injected = briefText;
      if (injected.length > MAX_INJECTED_CHARS) {
        injected = injected.slice(0, MAX_INJECTED_CHARS) + '\n\n[truncated -- brief continues beyond this point]';
      }
      const framing = 'This is the user\'s Instant Brief: already rendered by the wired MVA '
        + 'pipeline, one turn ago. Hand it over to the user in your own voice, with exactly '
        + 'one De Stijl glyph (Canon Part 12). Do NOT re-run any command to produce it -- it '
        + 'is already complete.\n\n';
      const deliveredAtMs = _advanceToRewardDelivered(state, {});
      try {
        _appendTelemetry({
          schema_version: 1,
          event: 'reward_delivered',
          ts_ms: deliveredAtMs,
          sha8: state.sha8,
          brief_bytes: briefBytes,
          turns_waited: retriesSoFar,
          skip_reason: null,
        });
      } catch (_e) { /* best-effort */ }
      return emitContinueWithContext(framing + injected);
    }
    // Read failed or came back empty despite a non-zero stat: fall through
    // to the not-ready / retry path below rather than treating this as ready.
  }

  const nextRetries = retriesSoFar + 1;
  if (nextRetries >= DRAIN_MAX_RETRIES) {
    // The counter is what stops a failed pipeline from silently costing the
    // user the rest of the flow: force reward_delivered so the investment
    // gate can still open.
    const deliveredAtMs = _advanceToRewardDelivered(state, { skip_reason: 'drain_timeout' });
    try {
      _appendTelemetry({
        schema_version: 1,
        event: 'reward_delivered',
        ts_ms: deliveredAtMs,
        sha8: state.sha8,
        brief_bytes: briefBytes,
        turns_waited: nextRetries,
        skip_reason: 'drain_timeout',
      });
    } catch (_e) { /* best-effort */ }
    return emitEmpty();
  }

  const retryState = Object.assign({}, state, { drain_retries: nextRetries });
  _atomicWriteState(retryState);
  return emitEmpty();
}

// ---------- Main ----------

function main() {
  const t0 = Date.now();
  const raw = readStdinSync();
  const payload = safeParseJSON(raw);
  const prompt = (payload && typeof payload.prompt === 'string') ? payload.prompt : null;

  const existingState = _readState();

  if (!existingState) {
    // ONE-SHOT GATE: state.json absent -> this is the only turn this router
    // ever reads the onboarding marker.
    const status = _checkOnboardStatus();
    if (status !== 'FIRST_INSTALL') {
      // Not a first install (or the marker read failed/timed out): emit and
      // exit without creating state, and never look again this session.
      return emitEmpty();
    }
    const armedAtMs = Date.now();
    const armedState = { phase: 'armed', armed_at_ms: armedAtMs, schema_version: 1 };
    _atomicWriteState(armedState);
    // Continue this turn: classify the same prompt that just armed the router.
    return _classifyAndRoute(armedState, prompt, t0);
  }

  if (existingState.phase === 'armed') {
    // Armed on an earlier turn (e.g. a crash between the arm-write and the
    // route-write) but never routed. Classify now, using THIS turn's prompt.
    return _classifyAndRoute(existingState, prompt, t0);
  }

  if (existingState.phase === 'routed' && !existingState.outcome_observed_at_ms) {
    return _emitOutcomeObserved(existingState);
  }

  if (existingState.phase === 'routed' && existingState.outcome_observed_at_ms) {
    // Outcome already observed on an earlier turn: this turn fires the
    // reward (plan 267.2-07) and advances routed -> reward_pending.
    return _fireReward(existingState);
  }

  if (existingState.phase === 'reward_pending') {
    // Drain leg (plan 267.2-07 Task 2): reward_pending -> reward_delivered,
    // either because the capture file is ready or because the bounded
    // retry counter forced a drain_timeout.
    return _drainReward(existingState);
  }

  // Any other phase (reward_delivered / investment_asked / done): this
  // plan's work here is done. Plan 267.2-09 owns everything past
  // reward_delivered.
  return emitEmpty();
}

if (require.main === module) {
  try {
    main();
  } catch (_e) {
    emitEmpty();
  }
}

module.exports = {
  PHASES,
  isValidTransition,
};
