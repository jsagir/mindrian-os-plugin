#!/usr/bin/env node
'use strict';

/**
 * Phase 83-07: Mid-session intent classifier (Tier 2).
 *
 * UserPromptSubmit hook. Reads the user message from stdin (JSON payload
 * or raw text), scores it against every registered room plus every sealed
 * room under MindrianRooms, and writes a conversational warning to stdout
 * when the highest-scoring room is NOT the active room. Under the
 * UserPromptSubmit contract stdout is injected as additionalContext into
 * the conversation.
 *
 * Advisory only. Never blocks. Never exits non-zero on scope mismatch.
 * Only exits non-zero on internal error (and even then we prefer exit 0
 * so we do not pollute the conversation with error noise). Hard 200ms
 * budget; if exceeded mid-walk, exits 0 silently. Writes at most one
 * warning block per invocation.
 *
 * Design rules per plan 83-07:
 *   - No dependencies. CJS only. Inline helpers.
 *   - Speed beats accuracy. False positives are tolerable, 83-06 catches
 *     the write-time false negatives.
 *   - Sealed room names surface in the warning only, not sealed content;
 *     sealed names are already surfaced by the 83-03 SEALED ROOMS block
 *     so this is not a new leak vector.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const BUDGET_MS = 200;

// Phase 225-01 (PD-3, anti-overfire): the zero-score no-match gate fires only on a
// SUBSTANTIVE message. Short zero-score turns ("thanks", "do it") are common, and
// gating each would repeat the Phase-210 over-enforcement mistake that phase reverted.
// Default floor 8 surviving tokens, env-overridable via
// MINDRIAN_ZERO_SCORE_GATE_MIN_TOKENS (parseInt; a NaN or < 1 override falls back to 8).
const ZERO_SCORE_GATE_MIN_TOKENS = (function () {
  const n = parseInt(process.env.MINDRIAN_ZERO_SCORE_GATE_MIN_TOKENS, 10);
  if (Number.isNaN(n) || n < 1) return 8;
  return n;
})();

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'of', 'to', 'in', 'on', 'at',
  'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
]);

// Brand / boilerplate STOP-SET (2026-06-28 fix). Product-branded and paste-chrome
// tokens are credited by scoreRoom as if they were real room-name or entity
// signals, so a product-branded paste block (which mentions "mindrianOS", "Larry",
// "room" ...) spuriously trips the F.8 session-binding gate on nearly every turn.
// These tokens earn NEITHER name-match NOR entity-match credit: a room-scope
// interruption must be driven by a genuine venture/entity token, not by the
// product's own name. A real room-name mention still fires because scoreRoom
// requires at least one NON-boilerplate name token to have matched.
const BRAND_STOP_SET = new Set([
  'mindrianos', 'mindrian', 'larry', 'room', 'rooms',
  'paste', 'block', 'onboarding', 'mos', 'plugin',
]);

// ---------------------------------------------------------------------------
// Room root + registry resolution. Mirrors 83-06 helpers (kept inline rather
// than extracted to lib/core to avoid a retrofit of 83-06 for a tiny helper).
// ---------------------------------------------------------------------------

function resolveMindrianRoomsRoot() {
  const envRoot = process.env.MINDRIAN_ROOMS_ROOT;
  if (envRoot && fs.existsSync(envRoot)) return envRoot;
  const home = process.env.HOME || os.homedir();
  if (!home) return null;
  const defaultRoot = path.join(home, 'MindrianRooms');
  if (fs.existsSync(defaultRoot)) return defaultRoot;
  try {
    const entries = fs.readdirSync(home, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name === 'MindrianRooms') return path.join(home, e.name);
      const sub = path.join(home, e.name);
      try {
        const subEntries = fs.readdirSync(sub, { withFileTypes: true });
        for (const s of subEntries) {
          if (s.isDirectory() && s.name === 'MindrianRooms') {
            return path.join(sub, s.name);
          }
        }
      } catch (_) { /* ignore */ }
    }
  } catch (_) { /* ignore */ }
  return null;
}

function readRegistry(root) {
  try {
    const regPath = path.join(root, '.rooms', 'registry.json');
    const raw = fs.readFileSync(regPath, 'utf8');
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

function activeRoomFromRegistry(reg) {
  if (reg && typeof reg.active === 'string' && reg.active.length > 0) {
    return reg.active;
  }
  return null;
}

function registeredRoomNames(reg) {
  if (!reg) return [];
  // Support both array form and object form for rooms field.
  if (Array.isArray(reg.rooms)) {
    const out = [];
    for (const r of reg.rooms) {
      if (typeof r === 'string') out.push(r);
      else if (r && typeof r.name === 'string') out.push(r.name);
    }
    return out;
  }
  if (reg.rooms && typeof reg.rooms === 'object') {
    return Object.keys(reg.rooms);
  }
  return [];
}

// ---------------------------------------------------------------------------
// Phase 94-06: Room classifier strict-mode override
// ---------------------------------------------------------------------------
//
// When the user is unambiguous (numeric position, explicit slug, quoted
// exact name), bypass the similarity heuristic and resolve directly. The
// override emits a Section-8 decision-trace edge with
// routing_source: 'strict_mode' per Canon Part 4. Canon Part 3 (10-verb
// vocabulary) preserved: strict-mode is a routing OVERRIDE, not a new
// verb. Canon Part 7 (reuse before build): the detector lives in its
// own pure-function module under lib/core/ so unit tests can require it
// without booting the classifier hot path.
//
// Order of precedence (locked in plan 94-06 CONTEXT.md decisions):
//   1. numeric          'switch to 8' or '8'              -> registry[N-1]
//   2. explicit slug    'curriculum-redesign-fall-2026'    -> exact slug
//                       '/mos:rooms <slug>'
//   3. quoted name      '"Beta"' / '"Curriculum Redesign"' -> name OR slug
//   4. fall through     -> existing similarity heuristic (unchanged)
//
// First match wins. Lawrence Aronhime's 2026-04-28 callouts 1, 2, 4 are
// fenced by this layer. Callout 3 ("the curriculum room", natural
// language) is known-deferred to v1.11.3.
const strictModeMod = require(
  path.join(__dirname, '..', 'lib', 'core', 'room-classifier-strict-mode.cjs')
);

// Phase 127.3 Plan 02: canonical-single-source for active-room resolution.
// resolveActiveRoomDir() (defined ~line 680) is now a thin wrapper that
// delegates to lib/core/resolve-active-room.cjs (the Phase 127.3 Plan 00
// chokepoint). The wrapper bridges the env-var name MINDRIAN_ROOMS_ROOT
// (this script's Phase 91 nav convention) to MINDRIAN_ROOMS_HOME (the
// chokepoint's convention) so existing call sites + test fixtures that
// set MINDRIAN_ROOMS_ROOT continue to work without modification. Local
// helpers activeRoomFromRegistry + registeredRoomNames + readRegistry +
// resolveRoomsRootForNav are PRESERVED because they are consumed
// elsewhere in this script for scope-matching at multiple call sites.
const { resolveActiveRoomDir: _chokepointResolveActiveRoomDir } = require(
  path.join(__dirname, '..', 'lib', 'core', 'resolve-active-room.cjs')
);
const detectStrictMode = strictModeMod.detectStrictMode;
const STRICT_MODE_ROUTING_SOURCE = strictModeMod.STRICT_MODE_ROUTING_SOURCE;

// Phase 194-04 (PSB-04/06): the F.8 binding-gate decision, composed from the shipped
// session-binding-consumer. runBindingGate is the ONE session-scope test (D-02): the
// single-equality `best.name === active` silence test is graduated to SET membership
// in this session's binding. It FAILS OPEN by construction (a poisoned / unreadable
// binding returns {degraded:true, blocked:false}), so a degraded gate degrades to the
// legacy advisory and NEVER hard-blocks the turn (the 83-07 never-block contract).
const { runBindingGate: _runBindingGate } = require(
  path.join(__dirname, '..', 'lib', 'workflow', 'session-binding-consumer.cjs')
);
// The reserved dev-repo/no-room binding: a first-class F.8 option (label is human,
// the slug is the sentinel). Selecting it binds the session to "no room" and kills
// the false plugin-CLAUDE.md write-block (D-03/D-04).
const NO_ROOM_SLUG = '__no_room__';
const NO_ROOM_LABEL = 'dev repo / no room';

function isSealed(root, roomName) {
  try {
    return fs.existsSync(path.join(root, roomName, 'GUARDRAIL.md'));
  } catch (_) {
    return false;
  }
}

// Walk MindrianRooms root one level deep looking for GUARDRAIL.md. Matches
// 83-03 walker logic: sealed rooms are always direct children of the root.
function discoverSealedRooms(root, deadline) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch (_) {
    return out;
  }
  for (const e of entries) {
    if (Date.now() > deadline) return out;
    if (!e.isDirectory()) continue;
    if (e.name.startsWith('.')) continue;
    if (isSealed(root, e.name)) out.push(e.name);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tokenizer + fingerprint builder
// ---------------------------------------------------------------------------

function tokenize(text) {
  if (!text || typeof text !== 'string') return [];
  const lowered = text.toLowerCase();
  const rough = lowered.split(/[^a-z0-9]+/);
  const out = [];
  for (const t of rough) {
    if (!t) continue;
    if (t.length < 2) continue;
    if (STOP_WORDS.has(t)) continue;
    out.push(t);
  }
  return out;
}

function splitRoomName(name) {
  if (!name || typeof name !== 'string') return [];
  return tokenize(name.replace(/[-_]+/g, ' '));
}

// Read STATE.md frontmatter `project:` plus top-30-line capitalized phrases.
// The capitalized-phrase heuristic is deliberately crude: grab any two-or-more
// consecutive Capitalized words and treat them as entity candidates. Single
// Capitalized words are ignored (too noisy at line starts).
function buildFingerprint(root, roomName, deadline) {
  const tokens = new Set();
  for (const t of splitRoomName(roomName)) tokens.add(t);
  if (Date.now() > deadline) return tokens;
  let statePath = path.join(root, roomName, 'STATE.md');
  let raw = '';
  try {
    raw = fs.readFileSync(statePath, 'utf8');
  } catch (_) {
    return tokens;
  }
  const lines = raw.split('\n').slice(0, 30);
  // Parse frontmatter project: field if present.
  let inFrontmatter = false;
  for (const line of lines) {
    if (line.trim() === '---') {
      inFrontmatter = !inFrontmatter;
      continue;
    }
    if (inFrontmatter) {
      const m = line.match(/^project\s*:\s*(.+)\s*$/i);
      if (m) {
        const val = m[1].replace(/^["']|["']$/g, '');
        for (const t of tokenize(val)) tokens.add(t);
      }
      continue;
    }
    // Body: capitalized-phrase extraction. Match runs of 2+ Capitalized words.
    const phraseRe = /\b([A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)+)\b/g;
    let pm;
    while ((pm = phraseRe.exec(line)) !== null) {
      for (const t of tokenize(pm[1])) tokens.add(t);
    }
  }
  return tokens;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

function scoreRoom(messageTokenSet, roomName, fingerprint) {
  // Room-name exact match: every token of the room name must appear in the
  // message token set. Weight = 5.
  const nameTokens = splitRoomName(roomName);
  let nameHit = nameTokens.length > 0;
  let nameHasNonBrand = false;
  for (const t of nameTokens) {
    if (!messageTokenSet.has(t)) { nameHit = false; break; }
    if (!BRAND_STOP_SET.has(t)) nameHasNonBrand = true;
  }
  // Brand/boilerplate discount (2026-06-28): a name match composed ENTIRELY of
  // product/boilerplate tokens is not a real room signal (a product-branded paste
  // would satisfy it), so require at least one non-boilerplate name token.
  if (nameHit && !nameHasNonBrand) nameHit = false;
  let score = nameHit ? 5 : 0;
  let nameMatch = nameHit;
  let entityMatches = 0;
  for (const t of fingerprint) {
    // Do not double-count the room-name tokens as entity matches.
    if (nameTokens.indexOf(t) !== -1) continue;
    // Brand/boilerplate tokens earn no entity credit: a product-branded paste
    // block must not accumulate entity matches that trip the binding gate.
    if (BRAND_STOP_SET.has(t)) continue;
    if (messageTokenSet.has(t)) {
      score += 1;
      entityMatches += 1;
    }
  }
  return { score: score, nameMatch: nameMatch, entityMatches: entityMatches };
}

// ---------------------------------------------------------------------------
// Message extraction
// ---------------------------------------------------------------------------

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_) {
    return '';
  }
}

function extractMessage(raw) {
  if (!raw || !raw.trim()) return '';
  const trimmed = raw.trim();
  // Try JSON first.
  let parsed = null;
  try {
    parsed = JSON.parse(trimmed);
  } catch (_) { /* not json */ }
  if (parsed && typeof parsed === 'object') {
    const fields = ['user_message', 'prompt', 'message', 'text'];
    for (const f of fields) {
      const v = parsed[f];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    // Nested: some hook envelopes put the prompt in tool_input or payload.
    if (parsed.payload && typeof parsed.payload === 'object') {
      for (const f of fields) {
        const v = parsed.payload[f];
        if (typeof v === 'string' && v.length > 0) return v;
      }
    }
    return '';
  }
  // Raw text fallback.
  return trimmed;
}

// reach-sensor-relevance-gap A1 (root cause A): extract the Claude session UUID
// from the hook stdin payload. Claude Code passes { session_id, prompt, ... } to
// the UserPromptSubmit hook; extractMessage already parses this envelope for the
// MESSAGE but DISCARDS session_id. That id is the SAME UUID the MCP room_bind
// writer keys the session binding under (tool-router.cjs effectiveSessionId =
// extra.sessionId). Lifting it here lets resolveSessionId align the CLI READ key
// with the MCP WRITE key, so a bound session is actually seen by the F.8 binding
// gate (and by Phase 225's zero-score gate, which reads the same key source).
// Pure + non-throwing: a non-JSON or session_id-less payload yields '' and
// resolveSessionId falls through to its prior env/hash resolution (byte-identical
// to the pre-fix behavior when no payload session_id is present).
function extractSessionId(raw) {
  if (!raw || !raw.trim()) return '';
  let parsed = null;
  try {
    parsed = JSON.parse(raw.trim());
  } catch (_) { return ''; }
  if (!parsed || typeof parsed !== 'object') return '';
  if (typeof parsed.session_id === 'string' && parsed.session_id.length > 0) {
    return parsed.session_id;
  }
  // Nested: some hook envelopes wrap the fields under `payload`.
  if (parsed.payload && typeof parsed.payload === 'object'
      && typeof parsed.payload.session_id === 'string'
      && parsed.payload.session_id.length > 0) {
    return parsed.payload.session_id;
  }
  return '';
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

// Phase 91-02: stdin is read ONCE at module-init time so the engine
// integration block can short-circuit on empty messages. The original
// Phase 83 main() reads it again, but readStdinSync of fd 0 returns ''
// on second call (EOF) -- which is fine because main() also early-
// exits on empty message. We pass the raw stdin in via module scope.
const STDIN_RAW = readStdinSync();
const STDIN_MESSAGE = extractMessage(STDIN_RAW);
// reach-sensor-relevance-gap A1: the real Claude session UUID from the hook
// payload (empty string when absent). resolveSessionId prefers this over the
// env/hash fallback so the CLI read key matches the MCP room_bind write key.
const STDIN_SESSION_ID = extractSessionId(STDIN_RAW);

// ---------------------------------------------------------------------------
// Phase 94-06: emitStrictModeOverride
//
// Writes the strict-mode override warning to stdout (additionalContext per
// the UserPromptSubmit hook contract) AND a Section-8 decision-trace edge
// with routing_source: 'strict_mode' per Canon Part 4. The trace edge is
// persisted under <activeRoomDir>/.mindrian/decision-traces/<session>.json
// using the same writer as the Phase 91-02 navigation-engine block so
// /mos:explain-decision (Plan 91-05) surfaces the override consistently
// with all other routing decisions.
//
// Failure discipline: any throw is swallowed; the user prompt is never
// disrupted. If trace persistence fails, the stdout warning still emits.
// ---------------------------------------------------------------------------
function emitStrictModeOverride(strictMatch, activeSlug, roomsRoot) {
  const overrideWarning =
    'Strict-mode override: input "' + strictMatch.input + '" matches room ' +
    strictMatch.slug + ' (pattern: ' + strictMatch.pattern + ', position-' +
    'or-slug-or-quoted-name match). Active room is ' + activeSlug + '. ' +
    'Acknowledge the explicit room reference in your next reply. Confirm ' +
    'with the user whether to switch rooms before drafting any artifact ' +
    'related to ' + strictMatch.slug + '.';

  const systemMessage =
    'strict-mode override: input matches room ' + strictMatch.slug +
    ' (pattern: ' + strictMatch.pattern + ') but active room is ' + activeSlug;

  const envelope = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: overrideWarning,
    },
    systemMessage: systemMessage,
  };

  try {
    process.stdout.write(JSON.stringify(envelope) + '\n');
  } catch (_e) {
    // Last-resort fallback: raw text.
    try { process.stdout.write(overrideWarning + '\n'); } catch (_e2) {}
  }

  // Persist a Section-8 decision-trace edge so /mos:explain-decision
  // surfaces this override alongside engine + legacy + mixed routings.
  // Best-effort; never throws back to main().
  try {
    const activeRoomDir = path.join(roomsRoot, activeSlug);
    if (!fs.existsSync(activeRoomDir)) return;
    const sessionId = resolveSessionId(activeRoomDir);
    const turn = appendTraceTurnNumber(activeRoomDir, sessionId);
    const traceEntry = {
      turn: turn,
      at: new Date().toISOString(),
      routing_source: STRICT_MODE_ROUTING_SOURCE,
      routing_reason: 'strict_mode_pattern_matched',
      strict_mode_pattern: strictMatch.pattern,
      strict_mode_input: strictMatch.input,
      resolved_slug: strictMatch.slug,
      active_slug_before: activeSlug,
    };
    persistDecisionTrace(activeRoomDir, sessionId, traceEntry);
  } catch (_e) { /* fire-and-forget */ }
}

function main() {
  const start = Date.now();
  const deadline = start + BUDGET_MS;

  const message = STDIN_MESSAGE;
  if (!message) return 0;

  const root = resolveMindrianRoomsRoot();
  if (!root) return 0;

  const reg = readRegistry(root);
  const active = activeRoomFromRegistry(reg);
  const registered = registeredRoomNames(reg);

  if (Date.now() > deadline) return 0;

  // ----- Phase 94-06: Strict-mode override (top of room-resolution path) -----
  //
  // When the user's input is unambiguous (numeric position, explicit slug,
  // or quoted exact name), bypass the similarity heuristic and resolve
  // directly. The override emits a Section-8 trace edge with
  // routing_source: 'strict_mode' per Canon Part 4. The similarity
  // heuristic stays as fallback for ambiguous natural-language input.
  //
  // This block fires BEFORE the similarity loop and can short-circuit
  // main() with an explicit override warning. The standard similarity
  // path is unchanged when strict-mode does not match.
  const strictMatch = detectStrictMode(message, reg);
  if (strictMatch && active && strictMatch.slug !== active) {
    // User's input matched a strict-mode pattern AND the matched room is
    // NOT the active room. Emit a high-confidence override warning + a
    // Section-8 trace edge that downstream readers can attribute to the
    // strict-mode layer.
    emitStrictModeOverride(strictMatch, active, root);
    return 0;
  }
  // If strictMatch is non-null AND matches the active room, route the silence
  // through session scope too (PSB-04): do NOT leave a second single-active-room
  // path alive. A BOUND session whose strict-named room is on-scope silences (the
  // user is just confirming a bound room). An UNBOUND session falls THROUGH to the
  // similarity path so the F.8 binding gate can bind it (naming the room explicitly
  // is a strong bind signal). Fails open: any error preserves the legacy silence.
  if (strictMatch && active && strictMatch.slug === active) {
    let strictGate = null;
    try {
      const sessionId = resolveSessionId(resolveActiveRoomDir());
      strictGate = _runBindingGate({ sessionId: sessionId, topRoom: strictMatch.slug, home: root });
    } catch (_e) {
      strictGate = null; // fail-open: preserve the legacy silence
    }
    // On-scope OR a degraded/unavailable gate -> legacy silence. Only a healthy
    // off-scope gate falls through to bind.
    if (!strictGate || strictGate.degraded || strictGate.onScope) {
      return 0;
    }
  }
  // strictMatch is null: continue to similarity heuristic (existing path).
  // ----- end Phase 94-06 strict-mode override -----

  const sealedRooms = discoverSealedRooms(root, deadline);
  if (Date.now() > deadline) return 0;

  // Deduplicate room corpus.
  const corpus = [];
  const seen = new Set();
  for (const name of registered.concat(sealedRooms)) {
    if (!name || seen.has(name)) continue;
    seen.add(name);
    corpus.push(name);
  }
  if (corpus.length === 0) return 0;

  const messageTokens = tokenize(message);
  if (messageTokens.length === 0) return 0;
  const messageTokenSet = new Set(messageTokens);

  let best = null;
  let activeScore = null;
  const scored = [];
  for (const roomName of corpus) {
    if (Date.now() > deadline) return 0;
    const fp = buildFingerprint(root, roomName, deadline);
    const s = scoreRoom(messageTokenSet, roomName, fp);
    scored.push({ name: roomName, score: s.score });
    if (roomName === active) {
      activeScore = s;
    }
    if (!best || s.score > best.score) {
      best = { name: roomName, score: s.score, nameMatch: s.nameMatch, entityMatches: s.entityMatches };
    }
  }

  // ----- Phase 225-01 (SEED-039 proving_case_2): the zero-score no-match gate -----
  //
  // best.score === 0 means NO room fingerprint matched this message. The pre-225
  // blanket `return 0` here silently suppressed the Phase-194 F.8 gate on a
  // conversational reframe (the Gaurav student-reframe incident, 2026-07-14), so the
  // write landed unchallenged in the old bound primary (threat T-225-01). When the
  // session HAS a bound primary AND the message is substantive, fire a distinct
  // "no room matched" gate offering continue-in-primary / new-project / no-room
  // (REQ-1). On a zero score best.name is corpus[0] (semantically meaningless,
  // Pitfall 1), so the gate NEVER reuses it (REQ-2). Every path terminates in
  // `return 0`; the whole branch is wrapped fail-open (REQ-3, Canon 83-07).
  //
  // IN-01 fix (Phase 225 REVIEW-FIX): `best` is guaranteed non-null here, not
  // merely defensive -- `corpus.length === 0` (line 499) and
  // `messageTokens.length === 0` (line 502) both return early above, so the
  // scoring loop (lines 508-519) always executes at least one iteration and
  // always assigns `best` on its first pass. No `!best` guard needed.
  if (best.score === 0) {
    try {
      // PD-3 substantiality floor: short zero-score messages are common; gating each
      // would repeat the Phase-210 over-enforcement mistake.
      //
      // WR-02 fix (Phase 225 REVIEW-FIX): measure DISTINCT surviving tokens
      // (messageTokenSet.size), not the raw duplicate-inclusive count
      // (messageTokens.length). The floor's stated intent (docs/ENV-TUNING.md
      // PD-3: "a trivial acknowledgement... must NOT fire the gate") is a
      // SUBSTANTIALITY check -- a message needs real distinct content, not just
      // enough words. Counting raw tokens let a trivial, repetitive message like
      // "ok ok ok ok ok ok ok ok" (8 raw tokens, 1 distinct) clear an 8-token
      // floor and fire the interruptive gate, exactly the over-enforcement this
      // floor exists to prevent. messageTokenSet is already built one line above
      // (line 503) for the scoring loop; reusing it here costs nothing extra.
      if (messageTokenSet.size >= ZERO_SCORE_GATE_MIN_TOKENS) {
        const roomDir = resolveActiveRoomDir();
        const sessionId = resolveSessionId(roomDir);
        const binding = require(
          path.join(__dirname, '..', 'lib', 'core', 'session-binding.cjs')
        ).readSessionBinding(sessionId, { home: root });
        // Fire only for a session with a real bound primary. An unbound session
        // (primary null), or one that explicitly chose dev-repo/no-room
        // (primary === __no_room__, where every substantive dev-repo message scores
        // 0), must never be nagged (REQ-3/REQ-6 no-regression). PD-1: this
        // deliberately does NOT check binding.sticky -- a total-miss is a
        // strong-enough new-project signal to prompt ONCE even under sticky.
        if (binding && typeof binding.primary === 'string' && binding.primary.length > 0
            && binding.primary !== NO_ROOM_SLUG
            && !zeroScoreGateAlreadyOffered(roomDir, sessionId)) {
          if (emitNoMatchGate({ primary: binding.primary, roomDir: roomDir, sessionId: sessionId })) {
            return 0; // gate rendered
          }
          // emitNoMatchGate returned false (renderer unavailable) -> legacy silence.
        }
      }
    } catch (_e) {
      // fail-open: any fault falls through to the identical legacy silence (83-07).
    }
    // Unbound session, short message, no-room primary, already-offered, or any fault:
    // ALL take the identical legacy silence (byte-for-byte the pre-225 return 0).
    return 0;
  }

  // ----- Phase 194-04 (PSB-04): graduate the tripwire to the F.8 binding gate -----
  //
  // The pre-194 silence test was a single-equality `best.name === active`: it went
  // quiet ONLY when the top room WAS the one global active room -- the racy
  // single-active-room brain this phase kills. The graduated test is SET membership
  // in THIS session's binding (runBindingGate -> resolveSessionScope, the ONE
  // on-scope test, D-02). resolveSessionId is COMPOSED (never re-derived). Pitfall 2
  // degenerate case: with no CLAUDE_SESSION_ID the fallback hashes roomDir+day, so a
  // CLI "session" is per-room-per-day -- acceptable per the plan.
  let bindingGate = null;
  try {
    const sessionId = resolveSessionId(resolveActiveRoomDir());
    bindingGate = _runBindingGate({ sessionId: sessionId, topRoom: best.name, home: root });
  } catch (_e) {
    bindingGate = null; // fail-open: fall through to the legacy advisory
  }

  // On-scope: the top room is a MEMBER of this session's bound SET -> SILENCE. This
  // is the spurious "intent mismatch" warning fix. A degraded gate is NOT on-scope,
  // so it correctly falls through to the legacy advisory below (never a hard block).
  if (bindingGate && !bindingGate.degraded && bindingGate.onScope) return 0;

  // Unbound / off-scope with a HEALTHY gate: render the F.8 multi-select binding gate
  // (candidate rooms + a first-class 'dev repo / no room' option) instead of the
  // legacy single-active-room nag. Fails open: a render/require error returns 0 and
  // falls through to the legacy advisory (PSB-06).
  if (bindingGate && !bindingGate.degraded && bindingGate.fire) {
    try {
      const roomDir = resolveActiveRoomDir();
      const sessionId = resolveSessionId(roomDir);
      if (emitBindingGate({ best: best, scored: scored, sealedRooms: sealedRooms, roomDir: roomDir, sessionId: sessionId })) {
        return 0;
      }
      // emitBindingGate returned false (renderer unavailable) -> fall through to legacy.
    } catch (_e) {
      // fail-open: fall through to the legacy advisory.
    }
  }

  // ----- legacy advisory (fail-open fallback: reached only when the gate degraded or
  // the F.8 render was unavailable). Preserves the pre-194 racy behavior verbatim. --
  if (active && best.name === active) return 0;

  // Tie-break: prefer active. If active has same score as best, silence.
  if (active && activeScore && activeScore.score >= best.score) return 0;

  // Weak-match silencing: a single 1-point entity match is not strong enough.
  if (!best.nameMatch && best.entityMatches < 2) return 0;

  const otherCount = best.score;
  const activeCountDisplay = activeScore ? activeScore.score : 0;
  const activeDisplay = active || '(none)';

  let warning =
    'Intent mismatch detected. User message contains ' + otherCount +
    ' tokens matching room ' + best.name + ', only ' + activeCountDisplay +
    ' matching active room ' + activeDisplay + '. ' +
    'Acknowledge the mismatch in your next reply. Confirm with the user ' +
    'whether to switch rooms before drafting any artifact related to ' +
    best.name + '.';

  if (sealedRooms.indexOf(best.name) !== -1) {
    warning += '\nNote: ' + best.name + ' is a sealed room. Any artifact ' +
      'related to it must be authored from inside that room (see 83-06).';
  }

  // 88.1-03: systemMessage retrofit. Emit a JSON envelope so Claude Code
  // 2.1.x renders a one-line status alongside the additionalContext
  // injection. LOCAL-only (Canon Part 8): room slugs only, no user prompt
  // text echoed. Silent on the happy path (no message when rooms match).
  const systemMessage = 'intent mismatch: suggested room ' + best.name +
    ' (score ' + otherCount + ') outweighs active room ' + activeDisplay +
    ' (score ' + activeCountDisplay + ')';
  const envelope = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: warning
    },
    systemMessage: systemMessage
  };
  try {
    process.stdout.write(JSON.stringify(envelope) + '\n');
  } catch (_e) {
    // Last-resort fallback: raw text (preserves pre-retrofit behavior).
    process.stdout.write(warning + '\n');
  }
  return 0;
}

// ---------------------------------------------------------------------------
// Phase 84-06: graph-findings injection (env-gated, default ON)
//
// Reads the active room's .proactive-intelligence.json and writes the top 3
// non-suppressed insights to stdout as an additionalContext block. The block
// is appended after any topic-mismatch warning emitted by main().
//
// Kill switch: set MINDRIAN_COPILOT_INJECT_FINDINGS=0 for byte-identical
// Phase 83 behavior. Any non-zero/unset value enables injection.
//
// Hard cap of 3 findings IS the suppression mechanism (Dependabot lesson:
// push channels without built-in caps become noise). No config to raise it.
//
// Failure discipline: ALL errors swallowed silently. If anything goes wrong,
// nothing is written and the hook exits 0. The user prompt is never
// disrupted. Closes SCOPE-NB-08.
// ---------------------------------------------------------------------------

const FINDINGS_BUDGET_MS = 200;
const FINDINGS_RESERVED_MS = 50; // require >= 50ms remaining of the 200ms budget
const FINDINGS_SUPPRESS_THRESHOLD = 3; // mirrors lib/core/proactive-intelligence.cjs
const FINDINGS_CAP = 3;

function injectionEnabled() {
  const v = process.env.MINDRIAN_COPILOT_INJECT_FINDINGS;
  if (v === undefined || v === null || v === '') return true;
  if (v === '0' || v === 'false') return false;
  return true;
}

function confidenceRank(c) {
  if (typeof c !== 'string') return 0;
  const lc = c.toLowerCase();
  if (lc === 'high') return 3;
  if (lc === 'medium' || lc === 'med') return 2;
  if (lc === 'low') return 1;
  return 0;
}

function formatFinding(insight) {
  const type = (insight && typeof insight.type === 'string') ? insight.type : 'insight';
  const message = (insight && typeof insight.message === 'string') ? insight.message : '';
  return type + ': ' + message;
}

function injectGraphFindings(injectionStart) {
  // Budget guard: require enough remaining headroom of the 200ms budget.
  const elapsed = Date.now() - injectionStart;
  if (elapsed > (FINDINGS_BUDGET_MS - FINDINGS_RESERVED_MS)) return;

  const root = resolveMindrianRoomsRoot();
  if (!root) return;
  const reg = readRegistry(root);
  const active = activeRoomFromRegistry(reg);
  if (!active) return;

  const filePath = path.join(root, active, '.proactive-intelligence.json');
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (_) {
    return;
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (_) {
    return;
  }

  const insights = (data && Array.isArray(data.insights)) ? data.insights : [];
  if (insights.length === 0) return;

  // Filter: drop suppressed (times_shown >= threshold).
  const live = [];
  for (const ins of insights) {
    if (!ins || typeof ins !== 'object') continue;
    const shown = (typeof ins.times_shown === 'number') ? ins.times_shown : 0;
    if (shown >= FINDINGS_SUPPRESS_THRESHOLD) continue;
    live.push(ins);
  }
  if (live.length === 0) return;

  // Deterministic sort: confidence desc, then stable original order.
  // (Stable sort is guaranteed in V8 since Node 12.)
  const decorated = live.map(function (ins, idx) {
    return { ins: ins, idx: idx, rank: confidenceRank(ins.confidence) };
  });
  decorated.sort(function (a, b) {
    if (b.rank !== a.rank) return b.rank - a.rank;
    return a.idx - b.idx;
  });

  const top = decorated.slice(0, FINDINGS_CAP);
  if (top.length === 0) return;

  // Re-check budget before writing; if we blew it, skip silently.
  if ((Date.now() - injectionStart) > (FINDINGS_BUDGET_MS - FINDINGS_RESERVED_MS)) return;

  const lines = ['## GRAPH FINDINGS (top 3)', ''];
  for (let i = 0; i < top.length; i++) {
    lines.push((i + 1) + '. ' + formatFinding(top[i].ins));
  }
  process.stdout.write(lines.join('\n') + '\n');
}

// ---------------------------------------------------------------------------
// Phase 91-02: Navigation Engine integration block.
//
// On every UserPromptSubmit hook invocation we resolve the active section,
// read the quadruple + USER.md, call navigation-engine.decide() with a
// 1200ms hard timeout, persist a decision_trace under
// .mindrian/decision-traces/<session-id>.json (atomic + 50-entry rotation),
// and emit a NAVIGATION DECISION (engine v1) block to additionalContext.
//
// Canon Part 8 (Graph Boundary): this block is LOCAL-only. brainAvailable
// is hard-coded to false in Wave 1; Plan 91-07 (Wave 3) opts into the
// scalar brain-client.isAvailable() handle. ZERO Brain network surface
// is added here. The decision-trace JSON file is LOCAL.
//
// Risk 2 mitigation (engine latency): Promise.race against a 1200ms
// timeout leaves 800ms hook headroom before the 2000ms ceiling fires.
// Risk 6 mitigation (trace budget): persisted to disk, rotated at 50
// entries (drop oldest 10), atomic tmp+rename writes.
//
// Failure discipline: any throw or timeout inside this block returns null
// engineDecision. The Phase 83 classifier flow continues unchanged. No
// stderr noise on the happy or failure path.
// ---------------------------------------------------------------------------

const NAV_HARD_TIMEOUT_MS = 1200;
const TRACE_ROTATE_AT = 50;
const TRACE_KEEP_AFTER_ROTATE = 40;

function resolveActiveSectionPathForRoom(roomDir) {
  if (!roomDir) return null;
  try {
    const activeJson = path.join(roomDir, '.mindrian', 'active-section.json');
    if (fs.existsSync(activeJson)) {
      try {
        const data = JSON.parse(fs.readFileSync(activeJson, 'utf8'));
        if (data && typeof data.section === 'string' && data.section.length > 0) {
          const candidate = path.isAbsolute(data.section)
            ? data.section
            : path.join(roomDir, data.section);
          if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
            return candidate;
          }
        }
      } catch (_e) { /* fall through */ }
    }
  } catch (_e) {}
  // Fallback: most-recently-modified subdir containing MINTO.md.
  try {
    const entries = fs.readdirSync(roomDir, { withFileTypes: true })
      .filter(function (d) { return d.isDirectory() && !d.name.startsWith('.'); });
    let best = null;
    let bestMtime = 0;
    for (const d of entries) {
      const sectionPath = path.join(roomDir, d.name);
      const mintoPath = path.join(sectionPath, 'MINTO.md');
      try {
        if (!fs.existsSync(mintoPath)) continue;
        const st = fs.statSync(mintoPath);
        if (st.mtimeMs > bestMtime) {
          bestMtime = st.mtimeMs;
          best = sectionPath;
        }
      } catch (_e) {}
    }
    return best;
  } catch (_e) {
    return null;
  }
}

function resolveRoomsRootForNav() {
  // Wider env-var acceptance than Phase 83 resolveMindrianRoomsRoot.
  // Phase 83 uses MINDRIAN_ROOMS_ROOT; resolve-room (the bash sibling)
  // uses MINDRIAN_ROOMS_HOME. The Phase 91 hot path accepts either so
  // tests + bash + node converge on the same fixture without divergent
  // env conventions.
  const envRoot = process.env.MINDRIAN_ROOMS_ROOT;
  if (envRoot && fs.existsSync(envRoot)) return envRoot;
  const envHome = process.env.MINDRIAN_ROOMS_HOME;
  if (envHome && fs.existsSync(envHome)) return envHome;
  return resolveMindrianRoomsRoot();
}

function resolveActiveRoomDir() {
  // Phase 127.3 Plan 02: delegate to the canonical chokepoint
  // (lib/core/resolve-active-room.cjs). The chokepoint reads
  // MINDRIAN_ROOMS_HOME; this script's pre-127.3 convention was
  // MINDRIAN_ROOMS_ROOT. Bridge the env-var name BEFORE delegating so
  // existing fixtures + production callers that set ROOT (Phase 91 nav
  // convention) keep working. Guard with the "only if HOME not already
  // set" check so callers that set BOTH (with potentially different
  // values) preserve their explicit HOME choice.
  if (process.env.MINDRIAN_ROOMS_ROOT && !process.env.MINDRIAN_ROOMS_HOME) {
    process.env.MINDRIAN_ROOMS_HOME = process.env.MINDRIAN_ROOMS_ROOT;
  }
  return _chokepointResolveActiveRoomDir();
}

function resolveSessionId(roomDir) {
  // reach-sensor-relevance-gap A1 (root cause A): PREFER the hook stdin payload's
  // session_id -- the real Claude session UUID that the MCP room_bind writer keys
  // the binding under (tool-router.cjs effectiveSessionId = extra.sessionId).
  // CLAUDE_SESSION_ID is UNSET in the UserPromptSubmit hook process, so before
  // this the reader always fell through to the sha256(roomDir+ISO-day) hash -- a
  // DIFFERENT namespace from the UUID writer, so readSessionBinding always missed
  // and the F.8 gate (and Phase 225's zero-score gate) fired every turn. Resolution
  // order: payload.session_id -> CLAUDE_SESSION_ID -> sha256 fallback.
  if (typeof STDIN_SESSION_ID === 'string' && STDIN_SESSION_ID.length > 0) {
    return STDIN_SESSION_ID;
  }
  const env = process.env.CLAUDE_SESSION_ID;
  if (typeof env === 'string' && env.length > 0) return env;
  // Fallback: sha256(roomDir + ISO-date).slice(0,12). Date precision day
  // means same room on same day shares a session file when the env hint
  // is missing -- acceptable per the plan's Section "Session ID
  // resolution".
  try {
    const day = new Date().toISOString().slice(0, 10);
    return crypto.createHash('sha256').update((roomDir || '') + day)
      .digest('hex').slice(0, 12);
  } catch (_) {
    return 'unknown';
  }
}

function persistDecisionTrace(roomDir, sessionId, traceEntry) {
  // Fire-and-forget. Any error is swallowed; the engine block never
  // disrupts the user prompt.
  try {
    const dir = path.join(roomDir, '.mindrian', 'decision-traces');
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
    const filePath = path.join(dir, sessionId + '.json');
    let data = { version: 1, session_id: sessionId, traces: [] };
    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && Array.isArray(parsed.traces)) {
        data = parsed;
        if (data.session_id !== sessionId) data.session_id = sessionId;
        if (data.version !== 1) data.version = 1;
      }
    } catch (_) { /* first write OR corruption -> reset */ }
    data.traces.push(traceEntry);
    // Rotate per Plan 91-02 contract: when length exceeds 50, drop the
    // oldest 10 entries before write. Result: keep last 40 + the just-
    // pushed current = 41 entries on disk after a rotation event.
    if (data.traces.length > TRACE_ROTATE_AT) {
      data.traces = data.traces.slice(10);
    }
    // Atomic tmp + rename. Defensive open with 'wx' to fail-fast on
    // stale tmp.
    const rnd = Math.random().toString(36).slice(2, 10);
    const tmpPath = filePath + '.tmp.' + process.pid + '.' + rnd + '.trace';
    let fd;
    try {
      fd = fs.openSync(tmpPath, 'wx');
    } catch (e) {
      if (e && e.code === 'EEXIST') {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
        fd = fs.openSync(tmpPath, 'wx');
      } else {
        return;
      }
    }
    try {
      fs.writeSync(fd, JSON.stringify(data, null, 2));
      try { fs.fsyncSync(fd); } catch (_) {
        // ENOTSUP on tmpfs / overlayfs / Windows ImDisk. Best-effort
        // durability is acceptable for decision-trace.
      }
    } finally {
      try { fs.closeSync(fd); } catch (_) {}
    }
    try {
      fs.renameSync(tmpPath, filePath);
    } catch (_) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  } catch (_) { /* fire-and-forget */ }
}

function formatEngineDecisionBlock(decision, routing, offerLine) {
  if (!decision || typeof decision !== 'object') return '';
  const trace = decision.decision_trace || {};
  const fireSkill = decision.fire_skill === null || decision.fire_skill === undefined
    ? 'null' : String(decision.fire_skill);
  const suppressSkills = Array.isArray(decision.suppress_skills)
    ? '[' + decision.suppress_skills.join(', ') + ']'
    : '[]';
  let offer = 'null';
  if (decision.offer_next_step && typeof decision.offer_next_step === 'object') {
    const cmd = decision.offer_next_step.command || '';
    const reason = decision.offer_next_step.reason || '';
    offer = '{command: ' + cmd + ', reason: ' + reason + '}';
  }
  let persona = 'null';
  if (decision.persona_updates && typeof decision.persona_updates === 'object') {
    const pu = decision.persona_updates;
    persona = '{archetype: ' + (pu.archetype || 'null')
      + ', problem_type: ' + (pu.problem_type || 'null')
      + ', venture_stage: ' + (pu.venture_stage || 'null') + '}';
  }
  const tierMode = trace.brain_md_tier_mode || 'tier_0';
  const recommended = trace.brain_md_recommended_marker_rendered === true
    ? 'true' : 'false';
  const why = trace.chosen_rationale || '';
  const lines = [
    '## NAVIGATION DECISION (engine v1)',
    '',
    'fire_skill: ' + fireSkill,
    'suppress_skills: ' + suppressSkills,
    'offer_next_step: ' + offer,
    'persona_updates: ' + persona,
    'tier_mode: ' + tierMode,
    'brain_md_recommended_marker_rendered: ' + recommended,
  ];
  // Phase 91-03: append router output (routing_source + activated_skills)
  // when the caller has computed it. Two new lines summarize which
  // activation set won (engine vs legacy vs mixed) and which skills are
  // active for this turn after composition.
  if (routing && typeof routing === 'object') {
    const routingSource = typeof routing.source === 'string' ? routing.source : 'legacy';
    const activated = Array.isArray(routing.activated_skills)
      ? '[' + routing.activated_skills.join(', ') + ']'
      : '[]';
    lines.push('activated_skills: ' + activated);
    lines.push('routing_source: ' + routingSource);
  }
  lines.push('');
  lines.push('Why: ' + why);
  // Phase 91-04: append the offer-presenter output (one-line grounded
  // suggestion, optional RECOMMENDED marker) after the Why line so it
  // is the LAST thing Larry sees in additionalContext. Skipped when
  // null (offer suppressed by grounding rule, per-turn cap, or
  // consecutive-ignore window).
  if (typeof offerLine === 'string' && offerLine.length > 0) {
    lines.push('');
    lines.push(offerLine);
  }
  return lines.join('\n');
}

/**
 * Phase 150-06 (D-08) -- THE RENDER UNLOCK.
 *
 * Wrap formatEngineDecisionBlock and, ON THE ENGINE ARM (routing_source ===
 * 'engine'), surface the grounded one-move onto the LIVE response block:
 *   1. build roomState.reachScores from the projected cortex via the new
 *      cortex-reach-adapter.buildReachScoresFromCortex(cortexNodes) (the legD
 *      field, threaded out on the LOCAL routing lane);
 *   2. rank with the FROZEN buildReachList(roomState) (MAX_K=3 / 0.70/0.15 /
 *      DIAL_REACH_K=6 untouched -- 150 FEEDS the selector, never re-architects it);
 *   3. present through dial-presenter.renderDial -- buildReachList -> dial-presenter
 *      gains its FIRST production caller (the C2 unlock; the navigator SEES it).
 *
 * Best-effort discipline (T-150-06-02): the entire dial render is wrapped so a
 * render fault NEVER blocks the user turn -- on any error the base engine block
 * is returned unchanged. The honest-negative (cortex absent) still renders the
 * engine's one-move from the orchestrator's flat-file fallback (D-02), proving
 * the wire, not a fixture. Canon Part 8: LOCAL-only, zero Brain calls, presence +
 * enums only (the adapter never reads cortex prose).
 *
 * ctx.cortexNodes: the legD projected cortex (array; defaults to []).
 * ctx.onRenderNote: optional fault-note callback (150.5-02 DIAL-ATOM-01).
 */
// Phase 209-01 (E3): pick a human display-name off a LOCAL node row for the
// {topic} dial slot. relevantNodes (getNeighborhood) rows carry id/type/... and
// cortexNodes (legD) rows carry id/type/properties; neither guarantees a name
// field, so we probe the common name-ish fields in order and fall back to the
// raw node id. Returns a trimmed non-empty string or null (caller omits the slot
// when null so the row degrades to the generic JTBD line rather than 'undefined').
// Canon Part 8: reads a LOCAL node scalar for a render-time label only; the
// egress-audited {framework} slot is NEVER sourced here (composer owns it).
function pickNodeDisplayName(node) {
  if (!node || typeof node !== 'object') return null;
  const candidates = [node.name, node.label, node.title];
  const props = (node.properties && typeof node.properties === 'object') ? node.properties : null;
  if (props) { candidates.push(props.name, props.title, props.label); }
  candidates.push(node.id);
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    if (typeof c === 'string' && c.trim().length > 0) return c.trim();
  }
  return null;
}

// reach-sensor-relevance-gap B1 (root cause B): resolve a genuinely DIFFERENT
// room for the cross_room reach's {room_name} slot from the live room context.
// A cross-room reference in the graph is a node that names ANOTHER room, either
// via a `room:<slug>` / `cross_room:<slug>` id or a `room` / `target_room` /
// `cross_room` property (getNeighborhood surfaces such nodes on relevantNodes;
// legD surfaces them on cortexNodes). Returns the FIRST target slug that differs
// from the current room, else null. Pure + non-throwing.
function resolveCrossRoomTargetSlug(roomContext, currentRoomName) {
  try {
    const rc = (roomContext && typeof roomContext === 'object') ? roomContext : null;
    if (!rc) return null;
    const current = (typeof currentRoomName === 'string') ? currentRoomName.toLowerCase() : null;
    const pools = [];
    if (Array.isArray(rc.relevantNodes)) pools.push(rc.relevantNodes);
    if (Array.isArray(rc.cortexNodes)) pools.push(rc.cortexNodes);
    for (const pool of pools) {
      for (const node of pool) {
        if (!node || typeof node !== 'object') continue;
        let cand = null;
        // id form: 'room:<slug>' or 'cross_room:<slug>'.
        if (typeof node.id === 'string') {
          const m = node.id.match(/^(?:room|cross_room):([a-z0-9][a-z0-9_-]{0,63})$/i);
          if (m) cand = m[1];
        }
        // property form: an explicit room reference.
        if (!cand && node.properties && typeof node.properties === 'object') {
          const p = node.properties;
          const ref = (typeof p.target_room === 'string' && p.target_room)
            || (typeof p.cross_room === 'string' && p.cross_room)
            || (typeof p.room === 'string' && p.room)
            || null;
          if (ref) cand = ref;
        }
        if (typeof cand === 'string' && cand.length > 0
            && (!current || cand.toLowerCase() !== current)) {
          return cand;
        }
      }
    }
    return null;
  } catch (_e) {
    return null;
  }
}

// Phase 209-01 (E3): derive the flat composeLabel slot map from the LIVE room
// context so the dial rows resolve {topic}/{room_name} instead of always
// degrading to the ELEVATION_DEFAULTS fallback (the RC-3 defect: renderDial was
// called with empty opts). Pure + non-throwing: any malformed input yields {}.
//   header_room <- path.basename(roomDir): the CURRENT room, for the decision-gate
//                  header context label ONLY (dial-presenter reads header_room).
//   room_name   <- reach-sensor-relevance-gap B1: the cross_room reach's slot is a
//                  genuinely DIFFERENT room resolved from the graph, NOT the current
//                  room. OMITTED when no different room resolves, so cross_room can
//                  never "borrow from self" (the observed bug); the relevance gate
//                  then suppresses the target-less cross_room row.
//   topic       <- the top relevantNodes display-name, else the first cortexNodes
//                  display-name; the key is OMITTED entirely when neither resolves.
// The {framework} slot is deliberately NOT set here (Part 8: the egress-audited
// slot stays owned by dial-label-composer's auditFrameworkSlot chokepoint).
function buildDialSlotContext(roomContext, roomDir) {
  try {
    const slots = {};
    let currentRoomName = null;
    if (typeof roomDir === 'string' && roomDir.length > 0) {
      const base = path.basename(roomDir);
      if (base && base.length > 0) {
        currentRoomName = base;
        // header_room: the CURRENT room, for the decision-gate header ONLY. This
        // REPLACES the old room_name=basename that cross_room borrowed from self.
        slots.header_room = base;
      }
    }
    const rc = (roomContext && typeof roomContext === 'object') ? roomContext : null;
    if (rc) {
      const topNode = (Array.isArray(rc.relevantNodes) && rc.relevantNodes.length > 0)
        ? rc.relevantNodes[0] : null;
      const cortexNode = (Array.isArray(rc.cortexNodes) && rc.cortexNodes.length > 0)
        ? rc.cortexNodes[0] : null;
      const topic = pickNodeDisplayName(topNode) || pickNodeDisplayName(cortexNode);
      if (typeof topic === 'string' && topic.length > 0) slots.topic = topic;
    }
    // B1: cross_room's {room_name} is a genuinely different, relevant room -- never
    // the current room. OMITTED when none resolves (the relevance gate suppresses
    // the target-less cross_room; composeLabel would otherwise degrade it to the
    // lateral elevation default, never borrow-from-self).
    const crossTarget = resolveCrossRoomTargetSlug(rc, currentRoomName);
    if (typeof crossTarget === 'string' && crossTarget.length > 0) {
      slots.room_name = crossTarget;
    }
    return slots;
  } catch (_e) {
    return {};
  }
}

// SEED-020 pickShape exemption (150.5-02, documented decision): the dial render
// stays on the shipped 143.1 renderShapeF1 resolve/format path and does NOT fold
// through pickShape (its install-tier-0 refuse would kill the D-01 sensor-fired
// cold card); the trailer construction stays dispatcher-only.
function renderEngineDecisionWithDial(decision, routing, offerLine, ctx) {
  const base = formatEngineDecisionBlock(decision, routing, offerLine);
  // Only the engine arm surfaces the dial. Legacy / mixed / silent keep the
  // base block unchanged (no regression; the dial is the engine-decision face).
  const source = (routing && typeof routing.source === 'string') ? routing.source : null;
  if (source !== 'engine') return base;

  try {
    const adapter = require(
      path.join(__dirname, '..', 'lib', 'hmi', 'cortex-reach-adapter.cjs')
    );
    const orchestrator = require(
      path.join(__dirname, '..', 'lib', 'hmi', 'dial-reach-orchestrator.cjs')
    );
    const presenter = require(
      path.join(__dirname, '..', 'lib', 'hmi', 'dial-presenter.cjs')
    );

    const cortexNodes = (ctx && Array.isArray(ctx.cortexNodes)) ? ctx.cortexNodes : [];
    const reachScores = adapter.buildReachScoresFromCortex(cortexNodes);

    // Phase 158-03 (RJP-01..05 / SC-07): apply the upstream-computed reject
    // penalty. reach_penalties was folded on the live engine arm (db open) and
    // threaded out on ctx; here (db already closed) we MERGE the discounted
    // scores over the cortex-derived reachScores and pass the hard-suppression
    // set into buildReachList. buildReachList stays PURE: it receives only
    // scalars + a Set, never db. When reach_penalties is absent (no penalty
    // computed) or empty (zero rejections), reachScores is unchanged and
    // suppressedReachIds is empty -> byte-identical render (RJP-02).
    const reachPenalties = (ctx && ctx.reach_penalties && typeof ctx.reach_penalties === 'object')
      ? ctx.reach_penalties : null;
    if (reachPenalties && reachPenalties.discountedScores
        && typeof reachPenalties.discountedScores === 'object') {
      Object.assign(reachScores, reachPenalties.discountedScores);
    }
    const suppressedReachIds = (reachPenalties && Array.isArray(reachPenalties.suppressedReachIds))
      ? reachPenalties.suppressedReachIds : [];

    // The tier mode mirrors the engine trace so the frozen 0.70/0.15 gate is
    // applied exactly as buildReachList already does (mode_a / mode_b / tier_0).
    const trace = (decision && decision.decision_trace) || {};
    const tierMode = (typeof trace.brain_md_tier_mode === 'string')
      ? trace.brain_md_tier_mode : 'tier_0';

    // Phase 209-01 (E3): resolve the LIVE room-context slot map so the dial rows
    // resolve {topic}/{room_name} instead of degrading to ELEVATION_DEFAULTS.
    // reach-sensor-relevance-gap B1: this is resolved BEFORE buildReachList so the
    // structural relevance gate can read the cross_room slot content and drop the
    // reach BEFORE it ranks. buildDialSlotContext never throws and returns {} on
    // absent context.
    const slotContext = buildDialSlotContext(ctx && ctx.roomContext, ctx && ctx.roomDir);

    // reach-sensor-relevance-gap B1 (root cause B): the STRUCTURAL relevance gate.
    // Compare the live turn tokens to each cross-room-class reach's resolved slot
    // content and DROP the off-topic ones through the SAME suppressedReachIds path
    // buildReachList already honors -- the seam stays pure (buildReachList does the
    // drop; this seam never mutates the reach bank or the frozen gate). No-op when
    // there is no live turn (unit tests without a turn render byte-identically).
    let gatedSuppressed = suppressedReachIds;
    try {
      const relevanceGate = require(
        path.join(__dirname, '..', 'lib', 'hmi', 'reach-relevance-gate.cjs')
      );
      const liveTurnText = (ctx && typeof ctx.liveTurnText === 'string' && ctx.liveTurnText.length > 0)
        ? ctx.liveTurnText
        : STDIN_MESSAGE;
      const currentRoomName = (ctx && typeof ctx.roomDir === 'string' && ctx.roomDir.length > 0)
        ? path.basename(ctx.roomDir)
        : null;
      const offTopic = relevanceGate.computeOffTopicReachIds({
        slotContext: slotContext,
        liveTurnText: liveTurnText,
        currentRoomName: currentRoomName,
      });
      if (Array.isArray(offTopic) && offTopic.length > 0) {
        const merged = suppressedReachIds.slice();
        for (const id of offTopic) {
          if (merged.indexOf(id) === -1) merged.push(id);
        }
        gatedSuppressed = merged;
      }
    } catch (_e) {
      // Fail-open: a gate fault degrades to the un-gated suppression set.
      gatedSuppressed = suppressedReachIds;
    }

    const reachList = orchestrator.buildReachList({
      tierMode: tierMode,
      reachScores: reachScores,
      suppressedReachIds: gatedSuppressed,
    });

    const rendered = presenter.renderDial(reachList, {
      slotContext: slotContext,
    });
    if (rendered && typeof rendered.text === 'string' && rendered.text.length > 0) {
      // 150.5-02 (DIAL-ATOM-01): thread the AskUserQuestion contract through
      // the SEED-020 single construction door. The dispatcher mints the
      // trailer onto the envelope's scalar marker + binding + rendered.contract;
      // this caller only READS those fields positionally in the concatenation
      // below (never composes the trailer string, never assigns the marker).
      // The trailer rides EVERY engine arm including tier_0 -- that arm IS the
      // D-01 (LOCKED 2026-06-09) sensor-fired cold card: buildReachList's tier_0
      // path already renders the S4 framing + the no-signal confidence column,
      // and the live card contract now rides with them. No tier_mode gating.
      //
      // Phase 209-01 (E2/E3): the caller now reads marker + binding + contract
      // positionally. Each appended line is guarded on its own presence so a
      // missing field degrades to the prior marker-only behavior rather than
      // emitting 'undefined'. The contract line is built field-by-field from
      // rendered.contract and JSON.stringify'd -- never string-concat unescaped
      // label text into the bracket line (T-209-01 tampering mitigation).
      const dispatcher = require(
        path.join(__dirname, '..', 'lib', 'hmi', 'selector-dispatcher.cjs')
      );
      dispatcher.appendAskUserQuestionTrailer(rendered, 'F.1');
      const marker = rendered.askuserquestion_marker;
      if (typeof marker === 'string' && marker.length > 0) {
        let block = base + '\n\n' + rendered.text + '\n' + marker;
        const binding = rendered.askuserquestion_binding;
        if (typeof binding === 'string' && binding.length > 0) {
          block += '\n' + binding;
        }
        const contract = rendered.contract;
        if (contract && typeof contract === 'object') {
          const verbs = Array.isArray(contract.verbs)
            ? contract.verbs.filter(function (v) { return typeof v === 'string'; })
            : [];
          const compact = {
            shape: (typeof contract.shape === 'string') ? contract.shape : 'F.1',
            mode: (typeof contract.mode === 'string') ? contract.mode : null,
            verbs: verbs,
            recommended: (typeof contract.recommended === 'string') ? contract.recommended : null,
          };
          block += '\n[AskUserQuestion payload: ' + JSON.stringify(compact) + ']';
        }
        // Phase 209-06 (H3): the PRIMARY side-channel producer for the engine
        // arm. Lazy-required inside its own try/catch so a writer fault never
        // affects the rendered block. sessionId is threaded via ctx (the call
        // site above passes resolveSessionId(roomDir)); when absent the
        // record files under NO_SESSION_KEY (the module's documented
        // degenerate-floor bucket, unioned into every session-scoped read).
        try {
          const sidechannel = require(
            path.join(__dirname, '..', 'lib', 'core', 'card-fire-sidechannel.cjs')
          );
          sidechannel.recordReachedGate({
            sessionId: (ctx && typeof ctx.sessionId === 'string') ? ctx.sessionId : undefined,
            surface: 'scripts/intent-classifier.cjs',
            shape: 'F.1',
            subjectText: (typeof rendered.text === 'string' ? rendered.text : ''),
          });
        } catch (_e) {
          /* never let a side-channel fault affect the rendered block */
        }
        return block;
      }
    }
  } catch (e) {
    // A dial render fault NEVER blocks the turn (T-150-06-02), and it no
    // longer vanishes (the Phase 140 D-03 silent-failure class is closed at
    // this seam, 150.5-02): classify the fault into a scalar note for the
    // persisted decision trace via ctx.onRenderNote. Scalars only -- never
    // e.message or a stack (a message can carry filesystem paths; the note
    // is a classifier, not a payload). The callback is itself guarded so a
    // faulting callback cannot throw out of the fault handler.
    if (ctx && typeof ctx.onRenderNote === 'function') {
      try {
        ctx.onRenderNote({
          event: 'dial_render_fault',
          error_name: (e && e.name) || 'Error',
        });
      } catch (_cbErr) { /* never throw out of the fault handler */ }
    }
  }
  return base;
}

function navTestSleepMs() {
  const v = process.env.MOS_NAV_TEST_SLEEP;
  if (!v) return 0;
  const n = parseInt(v, 10);
  if (!isNaN(n) && n > 0) return n;
  return 0;
}

function navTestThrowing() {
  return process.env.MOS_NAV_TEST_THROW === '1';
}

// Phase 91-03: integration test stub for engine output. When set, the
// run-navigation-engine path overrides the decision's fire_skill (and
// optionally suppress_skills) so end-to-end tests can exercise the
// router without mocking the engine module. Production behavior is
// unchanged when env vars are unset (string equality, never coerced
// from absent values).
//   MOS_NAV_TEST_FIRE_SKILL=<verb>          -> set decision.fire_skill
//   MOS_NAV_TEST_FIRE_SKILL=__NULL__        -> force decision.fire_skill = null
//   MOS_NAV_TEST_SUPPRESS_SKILLS=a,b,c      -> set decision.suppress_skills (csv)
function navTestFireSkill() {
  const v = process.env.MOS_NAV_TEST_FIRE_SKILL;
  if (typeof v !== 'string' || v.length === 0) return undefined;
  if (v === '__NULL__') return null;
  return v;
}

function navTestSuppressSkills() {
  const v = process.env.MOS_NAV_TEST_SUPPRESS_SKILLS;
  if (typeof v !== 'string' || v.length === 0) return undefined;
  return v.split(',').map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
}

// Phase 91-04: integration test stubs for offer_next_step. Injected
// AFTER decide() returns so end-to-end tests can exercise the offer
// presenter without mocking the engine module. Mirrors Plan 91-03's
// MOS_NAV_TEST_FIRE_SKILL pattern. Production behavior is unchanged
// when env vars are unset.
//   MOS_NAV_TEST_OFFER_COMMAND=<cmd>     -> set decision.offer_next_step.command
//   MOS_NAV_TEST_OFFER_COMMAND=__NULL__  -> force decision.offer_next_step = null
//   MOS_NAV_TEST_OFFER_REASON=<reason>   -> set decision.offer_next_step.reason
function navTestOfferCommand() {
  const v = process.env.MOS_NAV_TEST_OFFER_COMMAND;
  if (typeof v !== 'string' || v.length === 0) return undefined;
  if (v === '__NULL__') return null;
  return v;
}

function navTestOfferReason() {
  const v = process.env.MOS_NAV_TEST_OFFER_REASON;
  if (typeof v !== 'string' || v.length === 0) return undefined;
  return v;
}

// Phase 91-03: compute the pre-91 (legacy) skill activation set based
// on observable file-state and env-var toggles. The router composes
// this with the engine decision per Canon Part 7 (Reuse Before Build):
// when engine is silent, this is the activation that fires; when
// engine is opinionated, this is the input the suppress list operates
// on. Skills observed:
//   - larry-personality      always-on (no activation directive)
//   - context-engine         always-on (no activation directive)
//   - room-passive           when active room resolves
//   - room-proactive         when active room resolves
// Env-var toggles honored:
//   MOS_NO_SKILL_<name>=1     -> remove from set
//   MOS_FORCE_SKILL_<name>=1  -> add to set even if file-state misses
function computeLegacyActivation(roomDir) {
  const set = [];
  const seen = new Set();
  function add(name) {
    if (typeof name !== 'string' || name.length === 0) return;
    if (seen.has(name)) return;
    if (process.env['MOS_NO_SKILL_' + name] === '1') return;
    seen.add(name);
    set.push(name);
  }
  add('larry-personality');
  add('context-engine');
  if (roomDir) {
    add('room-passive');
    add('room-proactive');
  }
  // FORCE_SKILL allows enabling a skill that file-state would not
  // activate. Iterate env keys looking for the prefix.
  for (const key of Object.keys(process.env)) {
    if (key.indexOf('MOS_FORCE_SKILL_') === 0 && process.env[key] === '1') {
      add(key.slice('MOS_FORCE_SKILL_'.length));
    }
  }
  return set;
}

function navTestCounterPath() {
  const v = process.env.MOS_NAV_TEST_COUNTER;
  if (typeof v === 'string' && v.length > 0) return v;
  return null;
}

function bumpReadCounter(counterFile) {
  if (!counterFile) return;
  try {
    let n = 0;
    try {
      const raw = fs.readFileSync(counterFile, 'utf8');
      const parsed = parseInt(String(raw).trim(), 10);
      if (!isNaN(parsed)) n = parsed;
    } catch (_) {}
    n += 1;
    try { fs.mkdirSync(path.dirname(counterFile), { recursive: true }); } catch (_) {}
    fs.writeFileSync(counterFile, String(n));
  } catch (_) { /* counter is best-effort */ }
}

function deferredSleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function callDecideWithTimeout(decideFn, turn, ctx, hardTimeoutMs) {
  // Promise.race: decide() runs synchronously and returns its result;
  // we wrap it in a microtask so race can compete cleanly. The sleep
  // arm resolves to a sentinel symbol so we can distinguish timeout.
  const TIMEOUT_SENTINEL = '__nav_timeout__';
  const decidePromise = new Promise(function (resolve) {
    // Honor MOS_NAV_TEST_SLEEP by deferring decide() execution.
    const sleepMs = navTestSleepMs();
    const launch = function () {
      try {
        const result = decideFn(turn, ctx);
        resolve(result);
      } catch (e) {
        // Throws inside decide become structured engine_fault decisions
        // upstream; if it bubbled here treat as null fallback.
        resolve(null);
      }
    };
    if (sleepMs > 0) {
      setTimeout(launch, sleepMs);
    } else {
      // Defer to next microtask so Promise.race actually races.
      setImmediate(launch);
    }
  });
  const timeoutPromise = deferredSleep(hardTimeoutMs).then(function () {
    return TIMEOUT_SENTINEL;
  });
  return Promise.race([decidePromise, timeoutPromise]).then(function (val) {
    if (val === TIMEOUT_SENTINEL) return null;
    return val;
  });
}

// RETR-02 / D-03 (Phase 141): derive a LOCAL conversation seed from the last
// ~2 conversation turns so retrieval seeds from what the navigator just said,
// not venture-state only. This closes the conversation-to-retrieval loop now
// that getRoomContext (Plan 03) exists to consume the seed.
//
// HARD FENCE (D-03a, Canon Part 8): the seed is LOCAL-only. It rides the turn
// object into the Navigation Engine (the local seed lane) and feeds getRoomContext
// downstream. It is NEVER added to any payload that reaches buildBrainPacket or
// the brain client -- the Brain keeps receiving generic handles only.
//
// Latency (T-141-12): windowed to the last SEED_TURN_COUNT fragments of the most
// recent session, each char-capped, so an unbounded fragment dump cannot blow the
// 1200ms NAV budget. getSessionHistory reads the caller-owned handle through the
// navigation chokepoint (sync-backed sqlite under a resolved Promise); on any
// fault the seed degrades to an empty string and the loop runs as before.
const SEED_TURN_COUNT = 2;
const SEED_CHAR_CAP = 400;

// Phase 150-04 (MEM-07 link L3): derive lowFillSections from a getRoomContext
// result's RAW-LOCAL cortexNodes (legD, Plan Task 2). A section is "low-fill"
// when it has a STATE memory_artifact node but NO governing_thought node STATES
// it (the MINTO governing-thought is unfilled). Returns an array of LOCAL section
// slugs -- never artifact bytes, never prose (D-03a LOCAL-lane fence; Part 8).
// Reuses the SAME getRoomContext result the caller already computed -- no second
// room.db read. Defensive: returns [] on any malformed/absent input; never throws.
function deriveLowFillSections(roomContext) {
  if (!roomContext || typeof roomContext !== 'object') return [];
  const nodes = Array.isArray(roomContext.cortexNodes) ? roomContext.cortexNodes : [];
  if (nodes.length === 0) return [];
  const stateSections = new Set();
  const governedSections = new Set();
  for (const n of nodes) {
    if (!n || typeof n !== 'object') continue;
    const props = (n.properties && typeof n.properties === 'object') ? n.properties : {};
    const section = typeof props.section === 'string' ? props.section : (typeof n.sourceSection === 'string' ? n.sourceSection : '');
    if (!section) continue;
    if (n.type === 'memory_artifact' && props.kind === 'STATE') {
      stateSections.add(section);
    } else if (n.type === 'governing_thought') {
      governedSections.add(section);
    }
  }
  const out = [];
  for (const s of stateSections) {
    if (!governedSections.has(s)) out.push(s);
  }
  return out;
}

function deriveConversationSeed(navMod, db) {
  // Returns Promise<string>. Never rejects -- a fault yields '' (empty seed).
  //
  // reach-gate-stale-turn-input FIX (2026-07-02): the CURRENT user turn
  // (STDIN_MESSAGE) is the freshest and most decision-relevant fragment, but at
  // UserPromptSubmit time it is NOT yet persisted to session history -- this hook
  // (intent-classifier, UserPromptSubmit #2) fires BEFORE operator-update /
  // jtbd-update store the turn. Without it the routing seed carried ONLY prior
  // stored turns, so turn.userText fed to decide()/dispatchSensors AND the
  // getRoomContext seedFragments were turn-independent: the engine decided on
  // stale input and produced a byte-identical reach gate across materially
  // different turns (the reach-gate-stale-turn-input defect). We now APPEND the
  // current message as the freshest seed line so the engine decides on the actual
  // turn. D-03a LOCAL-lane fence preserved: this string rides turn.userText +
  // seedFragments (LOCAL routing lane) exactly as the history seed already did; it
  // is NEVER threaded toward buildBrainPacket (Canon Part 8). When STDIN_MESSAGE is
  // empty the output is byte-identical to the pre-fix history-only seed.
  const currentTurn = (typeof STDIN_MESSAGE === 'string' && STDIN_MESSAGE.length > 0)
    ? (STDIN_MESSAGE.length > SEED_CHAR_CAP ? STDIN_MESSAGE.slice(0, SEED_CHAR_CAP) : STDIN_MESSAGE)
    : '';
  function withCurrentTurn(historySeed) {
    const parts = [];
    if (typeof historySeed === 'string' && historySeed.length > 0) parts.push(historySeed);
    if (currentTurn.length > 0) parts.push(currentTurn); // freshest turn last (resolveSeedNode + sensors prefer the tail)
    return parts.join('\n');
  }
  if (!navMod || !db || typeof navMod.getSessionHistory !== 'function') {
    return Promise.resolve(withCurrentTurn(''));
  }
  return Promise.resolve()
    .then(function () { return navMod.getSessionHistory(db, 1); })
    .then(function (sessions) {
      if (!Array.isArray(sessions) || sessions.length === 0) return withCurrentTurn('');
      const frags = Array.isArray(sessions[0].fragments) ? sessions[0].fragments : [];
      const recent = frags.slice(-SEED_TURN_COUNT);
      const seed = recent
        .map(function (f) {
          const c = f && typeof f.content === 'string' ? f.content : '';
          return c.length > SEED_CHAR_CAP ? c.slice(0, SEED_CHAR_CAP) : c;
        })
        .filter(function (c) { return c.length > 0; })
        .join('\n');
      return withCurrentTurn(seed);
    })
    .catch(function () { return withCurrentTurn(''); });
}

function runNavigationEngine(roomDir, sessionId) {
  // Returns Promise<{decision, elapsed_ms} | null>. Never throws.
  return new Promise(function (resolve) {
    const startedAt = Date.now();
    // Phase 135-01: caller-owned room.db handle + its closer, declared at the
    // function scope so the outer catch can close the handle if anything throws
    // synchronously after the handle is opened (no leak on the error path).
    let roomDb = null;
    let navigationMod = null;
    function closeRoomDbHandle() {
      // Close the caller-owned room.db handle through the chokepoint. Tolerant of
      // a null handle. Called in the promise finally AND the outer catch so a
      // decide() fault or a synchronous throw never leaks the handle (Pitfall 5).
      if (roomDb && navigationMod && typeof navigationMod.closeRoomDbForCaller === 'function') {
        try {
          navigationMod.closeRoomDbForCaller(roomDb);
        } catch (_e) {
          /* tolerant: already closed */
        }
        roomDb = null;
      }
    }
    try {
      // Test-only fast paths.
      if (navTestThrowing()) {
        return resolve(null);
      }
      // Lazy-require so missing deps in Tier 0 environments do not blow
      // up the classifier hot path.
      let navEngine;
      let folderMemory;
      let userMdOps;
      try {
        navEngine = require(
          path.join(__dirname, '..', 'lib', 'core', 'navigation-engine.cjs')
        );
        folderMemory = require(
          path.join(__dirname, '..', 'lib', 'core', 'folder-memory.cjs')
        );
        userMdOps = require(
          path.join(__dirname, '..', 'lib', 'core', 'user-md-ops.cjs')
        );
      } catch (_e) {
        return resolve(null);
      }

      const sectionPath = resolveActiveSectionPathForRoom(roomDir);
      if (!sectionPath) {
        // No section to read; engine returns Tier 0 fallback. Still
        // useful to emit + persist so /mos:explain-decision has a row.
      }

      // Per-turn quadruple cache: a single read, observed by tests via
      // MOS_NAV_TEST_COUNTER.
      let quadruple = null;
      if (sectionPath) {
        const counterFile = navTestCounterPath();
        bumpReadCounter(counterFile);
        try {
          quadruple = folderMemory.readQuadruple(sectionPath);
        } catch (_e) {
          quadruple = null;
        }
      }

      // USER.md persona read (graceful on absent / malformed).
      let userMd = null;
      try {
        const userPath = path.join(roomDir, 'USER.md');
        userMd = userMdOps.readUserMd(userPath);
      } catch (_e) {
        userMd = null;
      }

      // Build context.userPersona shape expected by the engine's
      // buildIntentPersona reader (Plan 91-00).
      let userPersona = null;
      if (userMd && typeof userMd === 'object') {
        userPersona = {
          archetype: userMd.canonical_role || null,
          problem_type: userMd.problem_type === 'unknown' ? null : userMd.problem_type,
          venture_stage: userMd.venture_stage === 'unknown' ? null : userMd.venture_stage,
        };
      }

      // RETR-02 / D-03 (Phase 141): the per-turn turn object is now built AFTER
      // roomDb opens (below) so it can carry a real conversation seed derived from
      // the last ~2 turns -- it no longer hard-codes a null seed. See the
      // deriveConversationSeed + turn assembly just before callDecideWithTimeout.

      // Phase 91-07 Wave 3 upgrade: real brain-client.isAvailable()
      // scalar lookup. Per Canon Part 8 Section 9.3, isAvailable() is
      // an EXPLICITLY PERMITTED boolean scalar -- no user content
      // egress, no network when cached. The brain-client query, search,
      // and smartSearch entry points remain FORBIDDEN from the
      // Navigation Engine flow (no parentheses on purpose so a literal
      // grep guard for forbidden-call patterns reports zero matches in
      // this file).
      //
      // Failure modes:
      //   - require fails (module missing in degraded environments)
      //   - isAvailable not a function (older brain-client builds)
      //   - isAvailable throws (unexpected internal fault)
      // All three default brainAvailable to false, which is the safe
      // path: the engine gracefully degrades to mode_b (when BRAIN.md
      // carries brain_offline) or tier_0 (when BRAIN.md is absent).
      let brainAvailable = false;
      try {
        const brainClient = require(
          path.join(__dirname, '..', 'lib', 'core', 'brain-client.cjs')
        );
        if (typeof brainClient.isAvailable === 'function') {
          brainAvailable = !!brainClient.isAvailable();
        }
      } catch (_e) {
        brainAvailable = false;
      }

      // Phase 135-01: wire the COMPLETE resolver production input set into the
      // engine context. Before this, context carried only
      // { quadruple, brainAvailable, userPersona, intentSignal } and the offer
      // resolver (Phase 135-02) ran against an empty roomState -- the grounded
      // reason collapsed to [[undefined]] and the offer loop was dark in
      // production while in-memory unit tests passed. Every new read uses the
      // SAME lazy-require + try/catch + safe-default pattern as the
      // brainClient.isAvailable() read above, so a missing module or an absent
      // room.db degrades gracefully and never crashes the hot path. The path
      // stays SYNCHRONOUS and LOCAL-only (A3 LOCKED): no await is introduced,
      // getCurrentJTBD / openRoomDbForCaller are all sync chokepoint reads.

      // operator: drives the JUST_TALK silence rule (Phase 135 SC6). Default to
      // the operator.cjs cold-start string 'JUST_TALK' on any fault.
      let operatorState = 'JUST_TALK';
      try {
        const operatorMod = require(
          path.join(__dirname, '..', 'lib', 'conversation', 'operator.cjs')
        );
        if (operatorMod && typeof operatorMod.getCurrent === 'function') {
          const cur = operatorMod.getCurrent(roomDir);
          if (cur && typeof cur.current === 'string') {
            operatorState = cur.current;
          }
        }
      } catch (_e) {
        operatorState = 'JUST_TALK';
      }

      // jtbd: the active-JTBD intent leg (Phase 135 SC4). navigation.getCurrentJTBD
      // is roomDir-taking and opens room.db internally through the chokepoint
      // (sync, A3-compatible). Take .jtbd when .ok !== false, else null.
      let jtbd = null;
      try {
        navigationMod = require(
          path.join(__dirname, '..', 'lib', 'core', 'navigation.cjs')
        );
        if (navigationMod && typeof navigationMod.getCurrentJTBD === 'function') {
          const j = navigationMod.getCurrentJTBD(roomDir);
          if (j && j.ok !== false && typeof j.jtbd === 'string') {
            jtbd = j.jtbd;
          }
        }
      } catch (_e) {
        jtbd = null;
      }

      // roomState.db: a LIVE room.db handle opened via the allow-listed navigation
      // chokepoint (NOT a direct room-db.cjs require -- the substrate guard fails
      // that for scripts/intent-classifier.cjs). Guarded by fs.existsSync inside
      // openRoomDbForCaller; returns null when room.db is absent (Tier 0), in
      // which case the resolver and shouldExclude treat a null db as empty-state
      // and abstain gracefully. The handle MUST be CLOSED in a finally after
      // decide() settles (below) so a thrown decide() never leaks it (Pitfall 5).
      // roomDb + navigationMod are declared at the function scope above.
      if (navigationMod && typeof navigationMod.openRoomDbForCaller === 'function') {
        try {
          roomDb = navigationMod.openRoomDbForCaller(roomDir);
        } catch (_e) {
          roomDb = null;
        }
      }

      const context = {
        quadruple: quadruple,
        brainAvailable: brainAvailable,
        userPersona: userPersona,
        intentSignal: null,
        // Phase 135-01 resolver production inputs:
        operator: operatorState,
        sectionPath: sectionPath, // scope + the [[wikilink]] target the grounded reason needs
        problemType: userPersona && userPersona.problem_type, // rankForSelector input (null when unknown)
        jtbd: jtbd,
        // Phase 150-04 (MEM-07 link L3): thread the STARVED decide() sensor inputs
        // that decide() already READS (navigation-engine.cjs sensorTuple.stage :618,
        // sensorCtx.roomDir :621, sensorCtx.lowFillSections :622) but the producer
        // never SET -- so sensor-lagging-component + sensor-gate-approach abstained.
        //   stage           -- the venture_stage from the USER projection (the same
        //                      value already on userPersona.venture_stage); decide()
        //                      copies it onto sensorTuple.stage so gate-approach fires.
        //   roomDir         -- LOCAL room dir for sensorCtx.roomDir.
        //   lowFillSections -- set just-in-time from the cortex projection inside
        //                      attachRoomContextAndDecide (reuses the SAME
        //                      getRoomContext result; no second room.db read).
        // D-03a LOCAL-lane fence: these ride context ONLY (the routing lane); they
        // are NEVER added to the turn object or any path reaching buildBrainPacket.
        stage: userPersona && userPersona.venture_stage ? userPersona.venture_stage : undefined,
        roomDir: roomDir,
        roomState: {
          db: roomDb,
          roomDir: roomDir,
          // invocationsSinceDecision: optional fast-path counter populated by the
          // closer in Phase 135-03; read by shouldExclude. Left undefined for v1
          // so shouldExclude falls back to the memory_event tail via roomState.db.
        },
      };

      // RETR-02 / D-03a: build the turn with a real conversation seed (last ~2
      // turns) on the LOCAL lane only, then race decide() inside the existing
      // 1200ms envelope. deriveConversationSeed never rejects (faults -> '').
      deriveConversationSeed(navigationMod, roomDb)
        .then(function (conversationSeed) {
          // FIX-05 (Phase 150.6-03): stash the seed on the shared context (LOCAL
          // routing lane only; NEVER threaded toward buildBrainPacket per the
          // D-03a fence) so the sibling decision .then() can forward it to the
          // F.1 closer payload. The closer classifies it at the write seam via
          // recordSelectorDecision and stores ONLY the scalar boolean
          // venture_classified + source enum (Canon Part 8: the sentence itself
          // never enters any stored payload).
          context.conversationSeed =
            (typeof conversationSeed === 'string' && conversationSeed.length > 0)
              ? conversationSeed
              : null;
          const turn = {
            userText: conversationSeed, // LOCAL seed lane only (D-03a fence): never threads toward the Brain packet
            sectionPath: sectionPath,
            sessionId: sessionId,
          };
          // CASC-02 (Phase 142): compute the navigated neighborhood through the
          // navigation.cjs chokepoint on the CALLER-OWNED roomDb handle (Canon Part 9)
          // and thread it onto context.roomContext for decide(). The SAME conversation
          // seed feeds getRoomContext as seedFragments (one seed, both consumers); the
          // sectionPath rides as sectionContext so getRoomContext's Leg C focus-node
          // resolver reaches the section neighborhood. The await stays INSIDE this
          // single deriveConversationSeed().then() chain, so it is bounded by the same
          // NAV_HARD_TIMEOUT_MS race envelope -- no second timeout, no added await
          // outside the race (T-142-03: getRoomContext benchmarked ~1ms, ~1200x under
          // the 1200ms NAV budget). On any fault or absent room.db, context.roomContext
          // degrades to null and decide() proceeds exactly as before (graceful, no
          // throw, no leak -- the caller-owned handle is still closed once in finally).
          // D-03a fence: the neighborhood rides context ONLY (the LOCAL routing lane);
          // it is NEVER added to the turn object or any path reaching buildBrainPacket.
          function attachRoomContextAndDecide(roomContext) {
            context.roomContext = roomContext || null;
            // Phase 150-04 (MEM-07 link L3): derive lowFillSections from the SAME
            // getRoomContext cortex projection (no second room.db read). The
            // low-fill sections are the room sections whose cortex projection is
            // thin: a memory_artifact STATE node exists for the section but no
            // governing_thought node STATES it (an unfilled MINTO). LOCAL section
            // slugs only -- never artifact bytes (D-03a LOCAL-lane fence).
            context.lowFillSections = deriveLowFillSections(context.roomContext);
            return callDecideWithTimeout(navEngine.decide, turn, context, NAV_HARD_TIMEOUT_MS);
          }
          if (
            roomDb &&
            navigationMod &&
            typeof navigationMod.getRoomContext === 'function'
          ) {
            const roomId = path.basename(roomDir || '.') || 'room';
            const seedFragments = (typeof conversationSeed === 'string' && conversationSeed.length > 0)
              ? [{ role: 'user', content: conversationSeed, sectionContext: sectionPath || null }]
              : (sectionPath ? [{ role: 'user', content: '', sectionContext: sectionPath }] : []);
            return Promise.resolve()
              .then(function () {
                return navigationMod.getRoomContext(roomDb, roomId, { seedFragments: seedFragments });
              })
              .then(attachRoomContextAndDecide, function () {
                return attachRoomContextAndDecide(null); // fault -> null, proceed as before
              });
          }
          return attachRoomContextAndDecide(null);
        })
        .then(function (decision) {
          if (decision === null || decision === undefined) {
            return resolve(null);
          }
          // Phase 91-03 integration test stubs: when MOS_NAV_TEST_FIRE_SKILL
          // is set, override the engine's fire_skill so the router can be
          // exercised end-to-end without mocking the engine module. The
          // env vars are never set in production.
          const stubFire = navTestFireSkill();
          if (stubFire !== undefined) {
            decision.fire_skill = stubFire;
          }
          const stubSuppress = navTestSuppressSkills();
          if (stubSuppress !== undefined) {
            decision.suppress_skills = stubSuppress;
          }
          // Phase 91-04: offer_next_step stub injection.
          const stubOfferCmd = navTestOfferCommand();
          if (stubOfferCmd !== undefined) {
            if (stubOfferCmd === null) {
              decision.offer_next_step = null;
            } else {
              const stubOfferReason = navTestOfferReason();
              decision.offer_next_step = {
                command: stubOfferCmd,
                reason: typeof stubOfferReason === 'string' ? stubOfferReason : '',
              };
            }
          }
          // Quick-task 20260702 (Ruling 3a): persist THIS turn's actionable cue to
          // the LOCAL next-move side-channel so the statusline "Next:" goes live from
          // the per-turn decision (fire_skill / offer_next_step), not just the offer-
          // resolver. Runs HERE where the engine already runs (never in the hot
          // statusline process). Reuses the shipped writer (no second cache). Fully
          // guarded: any persist failure never affects the decision or the turn.
          //
          // Quick-task 260705-ui4: on the ABSTENTION leg (no routed offer / skill),
          // surface the active room's highest-priority `proposed` ratification item
          // as an enum/count-only cue instead of clearing to "Next: --". The provider
          // is LAZY -- the research/ scan runs only when the engine abstained, and the
          // scanner require is loaded inside the provider body so the common routed
          // path never pays for it.
          try {
            const nextMoveCache = require(
              path.join(__dirname, '..', 'lib', 'statusline', 'next-move-cache.cjs')
            );
            nextMoveCache.persistFromDecision(decision, {
              fallbackProvider: function () {
                try {
                  const ratNext = require(
                    path.join(__dirname, '..', 'lib', 'statusline', 'ratification-next.cjs')
                  );
                  const r = ratNext.scanRatificationNext();
                  return r && typeof r.cue === 'string' ? r.cue : null;
                } catch (_scanErr) { return null; }
              },
            });
          } catch (_persistErr) { /* graceful: the reader degrades to the jtbd proxy */ }
          const elapsedMs = Date.now() - startedAt;
          // Phase 150-06 (D-08 render unlock): thread the projected cortexNodes
          // (the Wave-2 legD field) out on the LOCAL routing lane so the decide()
          // tail can build roomState.reachScores via cortex-reach-adapter and
          // surface the dial render. Presence + enums only -- NEVER prose, NEVER
          // toward buildBrainPacket (D-03a LOCAL-lane fence; Canon Part 8).
          const cortexNodes = (context.roomContext
            && Array.isArray(context.roomContext.cortexNodes))
            ? context.roomContext.cortexNodes
            : [];
          // Phase 158-02 (RJP-06 / SC-06 / D-07): fire one reach_presented
          // memory_event per OFFERED top-3 reach_id on THIS live engine arm,
          // keyed by reach_id, while roomDb is still the OPEN handle (it is
          // closed only in the trailing finally at .then(closeRoomDbHandle)
          // below). The PURE render seam (renderEngineDecisionWithDial) cannot
          // do this -- by the time it runs the db is already closed (the dial
          // render path is db-free). This counter is the enabler of the M-floor
          // + periodic-parole fences (Plan 03): nothing else records WHICH reach
          // was offered (selector_presentation is command-anonymous; the render
          // path is pure). We recompute the would-be-offered top-3 the SAME way
          // the render seam does (buildReachScoresFromCortex -> buildReachList ->
          // slice(0, offered_count)) so the counter matches what the navigator
          // is shown. buildReachList stays PURE: it receives ONLY {tierMode,
          // reachScores}; db is NEVER threaded into dial-reach-orchestrator
          // (SC-07). Best-effort: any fault is swallowed and never blocks resolve,
          // never throws out of the .then, never prevents the finally
          // closeRoomDbHandle, never leaks the db handle. Payload is enum/scalar
          // only (reach_id + source_path + created_by) -- Part 8.
          try {
            if (roomDb
                && navigationMod
                && typeof navigationMod.logMemoryEvent === 'function'
                && Array.isArray(cortexNodes)
                && cortexNodes.length > 0) {
              const reachAdapter = require(
                path.join(__dirname, '..', 'lib', 'hmi', 'cortex-reach-adapter.cjs')
              );
              const reachOrchestrator = require(
                path.join(__dirname, '..', 'lib', 'hmi', 'dial-reach-orchestrator.cjs')
              );
              const reachTrace = (decision && decision.decision_trace) || {};
              const reachTierMode = (typeof reachTrace.brain_md_tier_mode === 'string')
                ? reachTrace.brain_md_tier_mode : 'tier_0';
              const reachScores = reachAdapter.buildReachScoresFromCortex(cortexNodes);
              const reachList = reachOrchestrator.buildReachList({
                tierMode: reachTierMode,
                reachScores: reachScores,
              });
              if (reachList
                  && Array.isArray(reachList.reaches)
                  && Number.isInteger(reachList.offered_count)) {
                const offered = reachList.reaches.slice(0, reachList.offered_count);
                for (const reach of offered) {
                  if (reach && typeof reach.reach_id === 'string' && reach.reach_id.length > 0) {
                    navigationMod.logMemoryEvent(roomDb, 'reach_presented', {
                      reach_id: reach.reach_id,
                      source_path: 'dial:presented:' + reach.reach_id,
                      created_by: 'system',
                    });
                  }
                }
                // Phase 183-01 METER-01 (gate_reached): one OBSERVATION per gate
                // render, beside the reach_presented loop, on THIS surface-shared
                // engine arm (NOT a CLI-only fork) so Desktop/Cowork gate-reaches are
                // counted too. Exactly ONE per gate (NOT one-per-reach): reach_count
                // = offered.length. Guarded by offered.length > 0. Deduped on the
                // turn-start handle (startedAt) so a re-entrant arm cannot
                // double-count one gate (the 60s logEvent idempotency window). The
                // payload is enum/scalar only -- counts + enums + the dedupe handle,
                // never prose, never a framework string, never user content (Part 8).
                // This is an OBSERVATION beside the render; it changes NOTHING about
                // what is offered (MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the
                // 6-reach bank, appendAskUserQuestionTrailer all untouched).
                // framework_invoked fires at ~0 production sites today, so the Gauge-1
                // density basis leans on reach_presented + gate_reached.
                if (offered.length > 0) {
                  navigationMod.logMemoryEvent(roomDb, 'gate_reached', {
                    reach_count: offered.length,
                    routing_source: 'engine',
                    source_path: 'gate:reached',
                    created_by: 'system',
                    dedupe_key: 'gate:' + startedAt,
                  });
                }
              }
            }
          } catch (_reachEmitErr) {
            // best-effort: a faulting emit never blocks the turn or leaks the db
          }
          // Phase 158-03 (RJP-01..05 / SC-07): fold the bounded reject penalty +
          // the hard-suppression set on THIS live engine arm, while roomDb is
          // still OPEN. computeReachPenalties reads the reach_id-keyed reject
          // counts + presentation counts (via the navigation chokepoint, Part 9;
          // enums/scalars only, Part 8) and returns { discountedScores,
          // suppressedReachIds }. We thread the result OUT alongside cortex_nodes;
          // the render seam (renderEngineDecisionWithDial, db already closed)
          // merges discountedScores over the cortex reachScores and passes
          // suppressedReachIds into the PURE buildReachList -- db is NEVER threaded
          // into dial-reach-orchestrator (SC-07). Best-effort: any fault degrades
          // to an empty penalty set so the render is un-discounted, never blocked.
          // Zero rejections -> discountedScores is byte-identity (base*(1-0)) and
          // suppressedReachIds is empty -> byte-identical render (RJP-02).
          let reachPenalties = { discountedScores: {}, suppressedReachIds: [] };
          try {
            if (roomDb && Array.isArray(cortexNodes) && cortexNodes.length > 0) {
              const reachReader = require(
                path.join(__dirname, '..', 'lib', 'workflow', 'reach-reject-reader.cjs')
              );
              const penAdapter = require(
                path.join(__dirname, '..', 'lib', 'hmi', 'cortex-reach-adapter.cjs')
              );
              const penScores = penAdapter.buildReachScoresFromCortex(cortexNodes);
              const pen = reachReader.computeReachPenalties(roomDb, {
                reachScores: penScores,
                db: roomDb,
                roomDir: roomDir,
              });
              if (pen && typeof pen === 'object') {
                reachPenalties = {
                  discountedScores: (pen.discountedScores && typeof pen.discountedScores === 'object')
                    ? pen.discountedScores : {},
                  suppressedReachIds: Array.isArray(pen.suppressedReachIds)
                    ? pen.suppressedReachIds : [],
                };
              }
            }
          } catch (_reachPenErr) {
            // best-effort: degrade to the un-discounted render, never block resolve
            reachPenalties = { discountedScores: {}, suppressedReachIds: [] };
          }
          resolve({
            decision: decision,
            elapsed_ms: elapsedMs,
            cortex_nodes: cortexNodes,
            reach_penalties: reachPenalties,
            // Phase 209-01 (E3): thread the LIVE room context OUT so the render
            // seam (db already closed) can derive the dial slot map from
            // relevantNodes/cortexNodes. Presence-only LOCAL fields; never a
            // Brain wire (Part 8). Absent -> null -> buildDialSlotContext {}.
            room_context: context.roomContext || null,
          });
        })
        .catch(function () { resolve(null); })
        .then(closeRoomDbHandle, closeRoomDbHandle); // finally: close the handle on resolve OR reject (no leak)
    } catch (_e) {
      closeRoomDbHandle(); // no leak if a synchronous throw occurred after the handle opened
      resolve(null);
    }
  });
}

function emitEngineDecisionBlock(roomDir, sessionId) {
  // Synchronous-from-caller wrapper that drives the async engine and
  // blocks the event loop only as long as the hard timeout. Used at the
  // tail of the classifier process so the user turn never proceeds
  // without the decision in hand.
  const result = runNavigationEngine(roomDir, sessionId);
  // Bridge promise to sync exit by pumping the event loop. Node 18+
  // does not expose deasync; we rely on process.exit happening from a
  // .then callback below. The function returns the promise; caller
  // awaits before exiting.
  return result;
}

function appendTraceTurnNumber(roomDir, sessionId) {
  // Compute next turn number based on existing trace file.
  try {
    const filePath = path.join(roomDir, '.mindrian', 'decision-traces', sessionId + '.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.traces) && parsed.traces.length > 0) {
      const last = parsed.traces[parsed.traces.length - 1];
      if (last && typeof last.turn === 'number') return last.turn + 1;
    }
  } catch (_) {}
  return 1;
}

// ---------------------------------------------------------------------------
// Phase 159-02 (HOW-4, DCW-01/04/06/08): consumePriorF1Pick -- the turn-start
// consumer attachment.
//
// The producer half is wired (the engine arm below persists
// decision_trace.f1_closer_payload near :1890). NOTHING reads it back at the
// START of the next turn, so the dial loop (accept / defer / reject / Free-Text)
// never records in a real room and Phase 158's computeReachPenalties structurally
// always reads 0. This helper closes that read seam: at turn start, before the new
// turn's dial render, it reads the PRIOR turn's persisted f1_closer_payload, routes
// the navigator's pick through the Wave-1 shared-core consumer (consumeF1Pick) over
// a navigation-chokepoint-owned room.db handle, and degrades to a no-op on any
// non-dial / cold / faulted turn (DCW-04 byte-unchanged invariant).
//
// Canon binding:
//   Part 7: thin glue over the SHIPPED captureCliPick + consumeF1Pick + the
//           closers. Net-new = read-prior-trace + open/close the handle, NOT a
//           re-implemented recorder.
//   Part 8: only {verb enum, outcome enum, reach_id enum} reach any row. The raw
//           navigator text rides the FIX-05 LOCAL sentence lane (captureCliPick
//           confines answer.text to the optional `sentence`, which consumeF1Pick
//           forwards to closeOffer({sentence}) for classification-to-scalar at the
//           write seam). The pick text NEVER enters a row body or a Brain packet.
//   Part 9: room.db is opened ONLY via navigation.openRoomDbForCaller and CLOSED in
//           a finally via navigation.closeRoomDbForCaller (no leak). consumeF1Pick
//           never opens room.db itself; closeOffer routes the write through the
//           navigation chokepoint. The decision-trace FILE read is the system's own
//           bookkeeping file (the same file appendTraceTurnNumber reads at :1633),
//           NOT room data -- so the fs read is Part 9 legal (Part 9 governs room.db).
//
// Wire-2 precondition (DCW-08): the grounding->verb map on the producer side
// (:1823-1834) already keys reachIds by a frozen REACH_IDS member when a sensor
// reach drove the fire; non-reach groundings forward as-is and are dropped by the
// downstream recordSelectorDecision enum-gate -> unkeyed write, never mis-keyed.
// This helper reads the persisted reachIds verbatim, so the keyed-or-unkeyed
// guarantee holds by construction.
//
// currentTurnAnswer: the AskUserQuestion F.1 answer shape captureCliPick accepts
//   ({ selectedOption, outcome?, text? }). On the live hook the caller passes the
//   turn's classified pick; the answer's raw text is confined to the LOCAL lane.
//
// Returns the consumeF1Pick result verbatim ({ ok, recorded?, reason?, outcome?,
// reach_id? }); a structured no-op on every cold / unmatched / absent-db / faulted
// turn. Wrapped best-effort: a fault returns { ok:false, reason } and NEVER throws.
// ---------------------------------------------------------------------------
function consumePriorF1Pick(roomDir, sessionId, currentTurnAnswer) {
  try {
    if (!roomDir || typeof roomDir !== 'string') {
      return { ok: false, reason: 'no_room' };
    }

    // (1) Read the PRIOR turn's persisted trace from the system's own bookkeeping
    // file (the same file appendTraceTurnNumber reads). Read the LAST entry's
    // f1_closer_payload. A missing / corrupt / payload-less trace is a non-dial turn.
    let priorPayload = null;
    try {
      const filePath = path.join(
        roomDir, '.mindrian', 'decision-traces', sessionId + '.json'
      );
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.traces) && parsed.traces.length > 0) {
        const last = parsed.traces[parsed.traces.length - 1];
        if (last && last.f1_closer_payload && typeof last.f1_closer_payload === 'object') {
          priorPayload = last.f1_closer_payload;
        }
      }
    } catch (_) { priorPayload = null; }

    // (2) Non-dial / cold turn: no prior payload -> immediate no-op. This is the
    // byte-unchanged guarantee (DCW-04): the helper emits nothing and writes nothing.
    if (!priorPayload || !Array.isArray(priorPayload.verbs) || priorPayload.verbs.length === 0) {
      return { ok: false, reason: 'no_prior_payload' };
    }

    // (3) Lazy-require the capture adapter + the shared-core consumer + the
    // navigation chokepoint (best-effort: a load failure degrades to a no-op,
    // mirroring the producer's :1806-1855 idiom). navigation.cjs is the ONLY door
    // to room.db (Part 9); this helper opens through it, never room-db.cjs directly.
    let captureMod;
    let consumerMod;
    let nav;
    try {
      captureMod = require(
        path.join(__dirname, '..', 'lib', 'hmi', 'f1-pick-capture-cli.cjs')
      );
      consumerMod = require(
        path.join(__dirname, '..', 'lib', 'workflow', 'f1-pick-consumer.cjs')
      );
      nav = require(
        path.join(__dirname, '..', 'lib', 'core', 'navigation.cjs')
      );
    } catch (_) {
      return { ok: false, reason: 'consumer_unavailable' };
    }
    if (!captureMod || typeof captureMod.captureCliPick !== 'function'
        || !consumerMod || typeof consumerMod.consumeF1Pick !== 'function') {
      return { ok: false, reason: 'consumer_unavailable' };
    }

    // Capture the pick from the current turn's answer (deterministic enum match
    // against priorPayload.verbs; the raw text stays on the LOCAL sentence lane).
    const captured = captureMod.captureCliPick(currentTurnAnswer, priorPayload);
    const pick = (captured && captured.pick) ? captured.pick : { verb: null, outcome: null };

    // (4) Open the caller-owned room.db ONLY via the navigation chokepoint, call the
    // consumer, and ALWAYS close the handle in a finally (Part 9, no leak). The
    // chokepoint returns null when room.db is absent (Tier 0); consumeF1Pick then
    // surfaces a structured no-op without crashing.
    let roomDb = null;
    try {
      if (nav && typeof nav.openRoomDbForCaller === 'function') {
        roomDb = nav.openRoomDbForCaller(roomDir);
      }
    } catch (_) { roomDb = null; }

    try {
      const roomState = { db: roomDb, roomDir: roomDir };
      // The matched verb completes its offer scaffold from the persisted generic
      // framework handle (carried on the payload by the producer, DCW-01). The
      // decision edge target_id is 'framework:' + framework, so the scaffold is what
      // lets the accept/defer/reject row write. A non-reach / framework-less payload
      // degrades: the consumer surfaces invalid_framework as a structured no-op.
      if (typeof priorPayload.framework === 'string' && priorPayload.framework.length > 0) {
        roomState.offer = { framework: priorPayload.framework };
      }
      // Forward the captured LOCAL sentence onto the payload the consumer sees so
      // closeOffer classifies it to a scalar at the write seam (FIX-05, Part 8).
      // The persisted payload.sentence already carries the producer-side seed; the
      // captured sentence (if any) only supplements it and never becomes a value.
      let payloadForConsumer = priorPayload;
      if (captured && typeof captured.sentence === 'string' && captured.sentence.length > 0
          && (typeof priorPayload.sentence !== 'string' || priorPayload.sentence.length === 0)) {
        payloadForConsumer = Object.assign({}, priorPayload, { sentence: captured.sentence });
      }
      return consumerMod.consumeF1Pick({
        priorPayload: payloadForConsumer,
        pick: pick,
        roomState: roomState,
      });
    } finally {
      try {
        if (nav && typeof nav.closeRoomDbForCaller === 'function') {
          nav.closeRoomDbForCaller(roomDb);
        }
      } catch (_) { /* tolerant: already closed */ }
    }
  } catch (_e) {
    // Best-effort: a fault is a no-op, never a throw -- a non-dial / cold / failed
    // turn is byte-unchanged from today (DCW-04, the load-bearing invariant).
    return { ok: false, reason: 'consumer_threw' };
  }
}

// ---------------------------------------------------------------------------
// Phase 194-04 (PSB-04): the F.8 binding-gate PRODUCER + the answer consumer.
//
// emitBindingGate COMPOSES the shipped shape-f8-renderer.renderShapeF8 (NO new
// selector shape -- Part 11 born-wired, one governed path) to render the unbound /
// off-scope binding gate: the scored candidate rooms (F.8 PAGES beyond its own
// MAX_TOGGLE_N, never truncates) PLUS a first-class 'dev repo / no room' option. It
// persists the offered option labels + their label->slug map on the decision trace
// (the SAME turn-boundary bookkeeping f1_closer_payload rides) so the NEXT turn's
// consumer can capture the confirmed answer. Fails open: a renderer / write fault
// returns false so the caller falls through to the legacy advisory.
//
// consumePriorBindingAnswer mirrors consumePriorF1Pick: it reads the prior turn's
// persisted binding-gate payload, COMPOSES captureCliActionSet (verbatim) to turn the
// AskUserQuestion answer into the confirmed toggle set, translates the human labels
// back to room slugs (the no-room label -> the reserved sentinel), and routes them to
// the net-new consumeSessionBinding SINK which WRITES the session binding file. It is
// best-effort by construction (a non-gate / cold turn is a no-op) and never throws.
// ---------------------------------------------------------------------------
function emitBindingGate(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const best = a.best;
  const scored = Array.isArray(a.scored) ? a.scored : [];
  const sealedRooms = Array.isArray(a.sealedRooms) ? a.sealedRooms : [];
  const roomDir = a.roomDir;
  const sessionId = a.sessionId;
  if (!best || typeof best.name !== 'string') return false;

  // Compose the shipped F.8 renderer (lazy require; a load fault degrades to the
  // legacy advisory).
  let renderer = null;
  try {
    renderer = require(path.join(__dirname, '..', 'lib', 'hmi', 'shape-f8-renderer.cjs'));
  } catch (_e) {
    return false;
  }
  if (!renderer || typeof renderer.renderShapeF8 !== 'function') return false;

  // Weak / dev-repo signal (the SAME test the legacy weak-match guard uses): a name
  // match OR >=2 entity matches is a STRONG room signal; otherwise the top score is a
  // dev-repo/weak match and the pre-check defaults to the reserved no-room sentinel.
  const weak = !best.nameMatch && best.entityMatches < 2;
  const preCheckLabel = weak ? NO_ROOM_LABEL : best.name;

  // Candidate options: the scored rooms (desc, deduped) PLUS the first-class no-room
  // option. renderShapeF8 pre-checks any option at/above the frozen 0.70 confidence,
  // so the pre-check target is handed 0.71 (display-only; NEVER auto-applies -- the
  // consumer only ever sees the CONFIRMED set) and the rest a low value.
  const ranked = scored.slice().sort(function (x, y) { return y.score - x.score; });
  const options = [];
  const labelToSlug = {};
  const seen = new Set();
  for (const r of ranked) {
    if (!r || typeof r.name !== 'string' || r.name.length === 0) continue;
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    labelToSlug[r.name] = r.name;
    options.push({ label: r.name, confidence: (r.name === preCheckLabel) ? 0.71 : 0.10 });
  }
  labelToSlug[NO_ROOM_LABEL] = NO_ROOM_SLUG;
  options.push({ label: NO_ROOM_LABEL, confidence: (preCheckLabel === NO_ROOM_LABEL) ? 0.71 : 0.10 });

  let rendered = null;
  try {
    rendered = renderer.renderShapeF8({
      options: options,
      header: '-- mindrianOS -- bind session -- select rooms --',
    });
  } catch (_e) {
    return false;
  }
  if (!rendered || !rendered.zones) return false;

  const zones = rendered.zones;

  // Phase 209-01 (E4): mint the AskUserQuestion trailer through the SEED-020
  // dispatcher-owned door (appendAskUserQuestionTrailer) so the F.8 gate carries
  // the self-decoding marker + BINDING imperative, exactly like the engine arm.
  //
  // SEED-020 pickShape exemption (mirrors the 150.5-02 engine-arm decision): this
  // gate does NOT route through pickShape('F.8'). pickShape applies the Canon
  // Part 3 install-tier-0 refuse, which would KILL the session-unbound gate on a
  // tier-0 room -- but a session that is not yet bound to a room MUST be able to
  // fire its binding card regardless of tier (same rationale as the D-01 cold
  // card). Routing through the trailer door reuses the single construction site
  // with NO new dispatcher branch (Canon Part 7). Capture the F.8 footer BEFORE
  // the trailer folds the marker + binding into zones.footer so the trailer is
  // appended to additionalContext exactly once (no duplication).
  const footerBase = (typeof zones.footer === 'string' && zones.footer.length > 0)
    ? zones.footer : '';
  try {
    const dispatcher = require(path.join(__dirname, '..', 'lib', 'hmi', 'selector-dispatcher.cjs'));
    dispatcher.appendAskUserQuestionTrailer(rendered, 'F.8');
  } catch (_e) { /* trailer fault: degrade to the untrailed gate, never block */ }

  // Phase 209-06 (H3): the PRIMARY side-channel producer for the F.8 binding
  // gate. sessionId is a direct arg here (unlike the pickShape door, which has
  // none in scope). Lazy-required inside its own try/catch; a writer fault
  // never affects the rendered gate.
  try {
    const sidechannel = require(
      path.join(__dirname, '..', 'lib', 'core', 'card-fire-sidechannel.cjs')
    );
    sidechannel.recordReachedGate({
      sessionId: sessionId,
      surface: 'scripts/intent-classifier.cjs',
      shape: 'F.8',
      subjectText: [zones.header, zones.body].filter(function (s) {
        return typeof s === 'string' && s.length > 0;
      }).join(' '),
    });
  } catch (_e) {
    /* never let a side-channel fault affect the rendered gate */
  }

  const bodyLines = [];
  if (zones.header) bodyLines.push(zones.header);
  if (zones.body) bodyLines.push(zones.body);
  if (zones.signals) bodyLines.push(zones.signals);
  if (footerBase) bodyLines.push(footerBase); // E4: the F.8 stat-strip footer
  const guidance =
    'Fire the AskUserQuestion card with these rooms as a multi-select (toggle every ' +
    'room this session may write to, pick ONE primary write target, and offer a ' +
    '"remember for this session" toggle); never reproduce this block as text (SEED-021). ' +
    'Selecting "' + NO_ROOM_LABEL + '" binds the session to no room (dev-repo work). ' +
    'Confirm the set with the user before writing any room artifact; the confirmed set ' +
    'becomes this session binding.';

  // E4: append the trailer marker + binding to additionalContext, each guarded on
  // its own presence (same idiom as the engine arm) so a missing field never
  // renders 'undefined'.
  const trailerLines = [];
  const bindMarker = rendered.askuserquestion_marker;
  const bindBinding = rendered.askuserquestion_binding;
  if (typeof bindMarker === 'string' && bindMarker.length > 0) trailerLines.push(bindMarker);
  if (typeof bindBinding === 'string' && bindBinding.length > 0) trailerLines.push(bindBinding);
  const additionalContext = bodyLines.join('\n') + '\n\n' + guidance
    + (trailerLines.length > 0 ? '\n\n' + trailerLines.join('\n') : '');

  const systemMessage = 'session unbound: choose which room(s) this session writes to';

  // Persist the offered gate payload on the decision trace so the next turn's consumer
  // can capture the answer (the SAME sink f1_closer_payload rides -- no new file family).
  try {
    if (roomDir && sessionId) {
      persistDecisionTrace(roomDir, sessionId, {
        ts: new Date().toISOString(),
        kind: 'binding_gate',
        binding_gate_payload: {
          options: options.map(function (o) { return o.label; }),
          labelToSlug: labelToSlug,
          preChecked: preCheckLabel,
        },
      });
    }
  } catch (_e) { /* fire-and-forget: persistence is best-effort */ }

  const envelope = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: additionalContext,
    },
    systemMessage: systemMessage,
  };
  try {
    process.stdout.write(JSON.stringify(envelope) + '\n');
  } catch (_e) {
    // Last-resort fallback: raw text (never throws back into the hook).
    try { process.stdout.write(additionalContext + '\n'); } catch (_) {}
  }
  return true;
}

// WR-01 fix (Phase 225 REVIEW-FIX): the PD-1 "once per session per room" marker
// used to be a scan for a 'zero_score_gate' entry in the SHARED decision-trace
// file. That file also carries the Phase-91 navigation-engine's own trace entry
// on essentially every substantive turn (persistDecisionTrace, TRACE_ROTATE_AT =
// 50, drop-oldest-10 on rotation), so a 'zero_score_gate' marker had a BOUNDED
// lifetime (evicted after exactly 50 further trace-writing turns), not a session
// lifetime -- well within a normal working session, silently re-arming the gate
// mid-session, contradicting docs/ENV-TUNING.md's "fires at most once per room
// per session" claim. Root cause: reusing a rotated, high-churn shared file for a
// signal that needs session-lifetime durability. Fix: a DEDICATED marker file
// that this suppression check owns exclusively (never touched by
// persistDecisionTrace / TRACE_ROTATE_AT), so it cannot be rotated out no matter
// how many further turns the session runs. Same atomic tmp+rename durability
// idiom already used by persistDecisionTrace / writeSessionBinding in this repo.
function zeroScoreGateMarkerPath(roomDir, sessionId) {
  return path.join(roomDir, '.mindrian', 'decision-traces', sessionId + '.zero-score-gate-offered.json');
}

// Phase 225-01 (PD-1, once-per-session-per-room suppression), WR-01-fixed: read the
// dedicated marker file (never rotated -- see zeroScoreGateMarkerPath above). A
// missing / corrupt marker file means "not offered" (fail-open to false), so the
// gate is NEVER suppressed by a read fault. The whole body is in try/catch
// returning false, mirroring the never-block contract.
function zeroScoreGateAlreadyOffered(roomDir, sessionId) {
  try {
    if (!roomDir || !sessionId) return false;
    const raw = fs.readFileSync(zeroScoreGateMarkerPath(roomDir, sessionId), 'utf8');
    const parsed = JSON.parse(raw);
    return !!(parsed && parsed.offered === true);
  } catch (_e) {
    return false;
  }
}

// WR-01 fix companion: writes the dedicated, never-rotated PD-1 marker. Fire-
// and-forget (mirrors persistDecisionTrace): a write fault never blocks or
// crashes the gate, it only means PD-1 degrades to "may re-fire" instead of
// "definitely re-fires" -- strictly no worse than the pre-fix behavior.
function markZeroScoreGateOffered(roomDir, sessionId) {
  try {
    if (!roomDir || !sessionId) return;
    const markerPath = zeroScoreGateMarkerPath(roomDir, sessionId);
    try { fs.mkdirSync(path.dirname(markerPath), { recursive: true }); } catch (_) {}
    const rnd = Math.random().toString(36).slice(2, 10);
    const tmpPath = markerPath + '.tmp.' + process.pid + '.' + rnd;
    fs.writeFileSync(tmpPath, JSON.stringify({ offered: true, ts: new Date().toISOString() }, null, 2));
    try {
      fs.renameSync(tmpPath, markerPath);
    } catch (_e) {
      try { fs.unlinkSync(tmpPath); } catch (_) {}
    }
  } catch (_e) { /* fire-and-forget: never block or crash the gate */ }
}

// Phase 225-01 (SEED-039 proving_case_2): the "no room matched" F.8 Decision Gate.
// Distinct from emitBindingGate: on a zero score best.name is corpus[0] (semantically
// meaningless, Pitfall 1 / REQ-2), so this gate NEVER presents a scored room. Its three
// options are: continue in the session primary (pre-checked default at 0.71, PD-1),
// start a new project (-> the __no_room__ sentinel), and dev repo / no room (-> the same
// sentinel). Composition clones emitBindingGate step-for-step (renderer, trailer,
// side-channel, trace, envelope). Fails open: any renderer / compose fault returns false
// and the caller falls to the legacy return 0 silence (REQ-3, the 83-07 never-block
// contract). additionalContext carries room SLUGS only, never message content (Part 8).
function emitNoMatchGate(args) {
  const a = (args && typeof args === 'object') ? args : {};
  const primary = a.primary;
  const roomDir = a.roomDir;
  const sessionId = a.sessionId;
  if (typeof primary !== 'string' || primary.length === 0) return false;

  // Compose the shipped F.8 renderer (lazy require; a load fault degrades to silence).
  let renderer = null;
  try {
    renderer = require(path.join(__dirname, '..', 'lib', 'hmi', 'shape-f8-renderer.cjs'));
  } catch (_e) {
    return false;
  }
  if (!renderer || typeof renderer.renderShapeF8 !== 'function') return false;

  // Exactly three options, NEVER a scored room (REQ-2). 'continue in <primary>' is the
  // pre-checked default at 0.71 (PD-1: primary-as-default, the frozen 0.70 + epsilon).
  // Both 'start a new project' and the no-room label map to the reserved __no_room__
  // sentinel: picking either unbinds the write from the old primary (PD-5).
  const continueLabel = 'continue in ' + primary;
  const newProjectLabel = 'start a new project';
  const labelToSlug = {};
  labelToSlug[continueLabel] = primary;
  labelToSlug[newProjectLabel] = NO_ROOM_SLUG;
  labelToSlug[NO_ROOM_LABEL] = NO_ROOM_SLUG;
  const options = [
    { label: continueLabel, confidence: 0.71 },
    { label: newProjectLabel, confidence: 0.10 },
    { label: NO_ROOM_LABEL, confidence: 0.10 },
  ];

  let rendered = null;
  try {
    rendered = renderer.renderShapeF8({
      options: options,
      header: '-- mindrianOS -- no room matched -- new project? --',
    });
  } catch (_e) {
    return false;
  }
  if (!rendered || !rendered.zones) return false;
  const zones = rendered.zones;

  // Capture the F.8 footer BEFORE the trailer folds the marker into zones.footer, so the
  // trailer is appended to additionalContext exactly once (clone of emitBindingGate).
  const footerBase = (typeof zones.footer === 'string' && zones.footer.length > 0)
    ? zones.footer : '';
  try {
    const dispatcher = require(path.join(__dirname, '..', 'lib', 'hmi', 'selector-dispatcher.cjs'));
    dispatcher.appendAskUserQuestionTrailer(rendered, 'F.8');
  } catch (_e) { /* trailer fault: degrade to the untrailed gate, never block */ }

  // Card-fire side-channel: sessionId is a direct arg. A writer fault never affects the
  // rendered gate (its own try/catch).
  try {
    const sidechannel = require(
      path.join(__dirname, '..', 'lib', 'core', 'card-fire-sidechannel.cjs')
    );
    sidechannel.recordReachedGate({
      sessionId: sessionId,
      surface: 'scripts/intent-classifier.cjs',
      shape: 'F.8',
      subjectText: [zones.header, zones.body].filter(function (s) {
        return typeof s === 'string' && s.length > 0;
      }).join(' '),
    });
  } catch (_e) {
    /* never let a side-channel fault affect the rendered gate */
  }

  const bodyLines = [];
  if (zones.header) bodyLines.push(zones.header);
  if (zones.body) bodyLines.push(zones.body);
  if (zones.signals) bodyLines.push(zones.signals);
  if (footerBase) bodyLines.push(footerBase);
  // additionalContext carries room SLUGS only, never the user's message content (Part 8).
  const guidance =
    'No existing room matched this message. The session primary is ' + primary + '. ' +
    'Ask the user whether this is a new project: fire the AskUserQuestion card with ' +
    'these three options as a single-select ("' + continueLabel + '", "' + newProjectLabel +
    '", or "' + NO_ROOM_LABEL + '"); never reproduce this block as text (SEED-021). If the ' +
    'user confirms a new project, offer /mos:new-project; NEVER auto-create a room (Part 7 ' +
    'reuse before build). Selecting "' + newProjectLabel + '" or "' + NO_ROOM_LABEL + '" ' +
    'unbinds this write from ' + primary + '. Confirm the choice with the user before ' +
    'writing any room artifact.';

  const trailerLines = [];
  const bindMarker = rendered.askuserquestion_marker;
  const bindBinding = rendered.askuserquestion_binding;
  if (typeof bindMarker === 'string' && bindMarker.length > 0) trailerLines.push(bindMarker);
  if (typeof bindBinding === 'string' && bindBinding.length > 0) trailerLines.push(bindBinding);
  const additionalContext = bodyLines.join('\n') + '\n\n' + guidance
    + (trailerLines.length > 0 ? '\n\n' + trailerLines.join('\n') : '');

  const systemMessage = 'no room matched: is this a new project, or continue in ' + primary + '?';

  // Persist the gate payload under the SAME binding_gate_payload key the shipped
  // consumePriorBindingAnswer scans for (it keys on e.binding_gate_payload, NOT e.kind),
  // with kind 'zero_score_gate' for trace disambiguation. This trace entry is the
  // ANSWER-consumption channel (consumePriorBindingAnswer reads it on the very next
  // turn); it is NOT the PD-1 suppression signal (WR-01 fix -- see
  // zeroScoreGateAlreadyOffered / markZeroScoreGateOffered above, a dedicated
  // never-rotated marker, since this shared trace file rotates at 50 entries).
  try {
    if (roomDir && sessionId) {
      persistDecisionTrace(roomDir, sessionId, {
        ts: new Date().toISOString(),
        kind: 'zero_score_gate',
        binding_gate_payload: {
          options: options.map(function (o) { return o.label; }),
          labelToSlug: labelToSlug,
          preChecked: continueLabel,
        },
      });
    }
  } catch (_e) { /* fire-and-forget: persistence is best-effort */ }

  // WR-01 fix: stamp the dedicated, never-rotated PD-1 marker so
  // zeroScoreGateAlreadyOffered's suppression survives arbitrarily many further
  // trace-writing turns in this session (the shared decision-trace file above
  // does not -- see the comment on zeroScoreGateMarkerPath).
  try {
    if (roomDir && sessionId) {
      markZeroScoreGateOffered(roomDir, sessionId);
    }
  } catch (_e) { /* fire-and-forget: never block or crash the gate */ }

  const envelope = {
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: additionalContext,
    },
    systemMessage: systemMessage,
  };
  try {
    process.stdout.write(JSON.stringify(envelope) + '\n');
  } catch (_e) {
    // Last-resort fallback: raw text (never throws back into the hook).
    try { process.stdout.write(additionalContext + '\n'); } catch (_) {}
  }
  return true;
}

function consumePriorBindingAnswer(roomDir, sessionId, currentTurnAnswer, home) {
  try {
    if (!roomDir || typeof roomDir !== 'string') return { ok: false, reason: 'no_room' };

    // Read the most recent UN-consumed binding-gate payload. The producer persists it
    // early in main(), but the engine block appends its OWN trace entry afterward, so
    // the gate payload is NOT necessarily the last entry -- scan backwards. Stop at a
    // 'binding_gate_consumed' marker (a prior turn already bound this offer), so the
    // same answer is never re-consumed into a duplicate write.
    let gatePayload = null;
    // CR-01 (Phase 225 REVIEW-FIX): also capture which gate KIND produced this
    // payload. 'zero_score_gate' (emitNoMatchGate) offers exactly three fixed
    // labels (continue-in-primary / new-project / no-room) and NEVER lists the
    // session's other bound rooms as toggleable options (REQ-2: never a scored
    // room) -- unlike the pre-existing 'binding_gate' (emitBindingGate), whose
    // option set is the full scored corpus, giving the user visibility/control
    // over every room already in scope. That narrower option set is what makes
    // the zero-score gate's answer-consumption path need the union fix below.
    let gateKind = null;
    try {
      const filePath = path.join(roomDir, '.mindrian', 'decision-traces', sessionId + '.json');
      const raw = fs.readFileSync(filePath, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.traces)) {
        for (let i = parsed.traces.length - 1; i >= 0; i--) {
          const e = parsed.traces[i];
          if (!e || typeof e !== 'object') continue;
          if (e.kind === 'binding_gate_consumed') break; // already consumed -> no-op
          if (e.binding_gate_payload && typeof e.binding_gate_payload === 'object') {
            gatePayload = e.binding_gate_payload;
            gateKind = (typeof e.kind === 'string') ? e.kind : null;
            break;
          }
        }
      }
    } catch (_) { gatePayload = null; gateKind = null; }

    // Non-gate / cold turn: no prior gate payload -> no-op (byte-unchanged).
    if (!gatePayload || !Array.isArray(gatePayload.options) || gatePayload.options.length === 0) {
      return { ok: false, reason: 'no_gate_payload' };
    }

    // Lazy-require the shipped capture adapter + the net-new sink consumer (a load
    // fault degrades to a no-op).
    let captureMod;
    let consumerMod;
    try {
      captureMod = require(path.join(__dirname, '..', 'lib', 'hmi', 'f8-action-capture-cli.cjs'));
      consumerMod = require(path.join(__dirname, '..', 'lib', 'workflow', 'session-binding-consumer.cjs'));
    } catch (_) {
      return { ok: false, reason: 'consumer_unavailable' };
    }
    if (!captureMod || typeof captureMod.captureCliActionSet !== 'function'
        || !consumerMod || typeof consumerMod.consumeSessionBinding !== 'function') {
      return { ok: false, reason: 'consumer_unavailable' };
    }

    // Normalize the answer into the { selectedOptions:[...] } shape captureCliActionSet
    // accepts. A structured AskUserQuestion answer passes through; a raw-text turn maps
    // to a single selectedOption (best-effort, mirrors consumePriorF1Pick).
    let answer = currentTurnAnswer;
    if (typeof currentTurnAnswer === 'string') {
      try {
        const p = JSON.parse(currentTurnAnswer);
        answer = (p && typeof p === 'object') ? p : { selectedOptions: [currentTurnAnswer] };
      } catch (_) {
        answer = { selectedOptions: [currentTurnAnswer] };
      }
    }
    if (!answer || !Array.isArray(answer.selectedOptions)) {
      return { ok: false, reason: 'no_selection' };
    }

    // COMPOSE captureCliActionSet verbatim: the gate's option labels are the "verbs".
    const picks = captureMod.captureCliActionSet(answer, { verbs: gatePayload.options });
    const labelToSlug = (gatePayload.labelToSlug && typeof gatePayload.labelToSlug === 'object')
      ? gatePayload.labelToSlug : {};

    // Translate the confirmed labels back to room slugs (the no-room label -> the
    // reserved sentinel). A rejected toggle is dropped from the bound set.
    const slugs = [];
    for (const pk of picks) {
      if (!pk || typeof pk.verb !== 'string' || pk.verb.length === 0) continue;
      if (pk.outcome === 'reject') continue;
      const slug = (typeof labelToSlug[pk.verb] === 'string') ? labelToSlug[pk.verb] : pk.verb;
      if (slugs.indexOf(slug) === -1) slugs.push(slug);
    }
    if (slugs.length === 0) return { ok: false, reason: 'empty_confirm' };

    // CR-01 fix (Phase 225 REVIEW-FIX, root cause): consumeSessionBinding's sink
    // WRITE is a full REPLACE of the session's `bound` array, never a union
    // (session-binding-consumer.cjs:144-148). That is safe for the pre-existing
    // 'binding_gate' (Phase 194): its option set is the FULL scored corpus, so
    // every already-bound room is a visible, re-toggleable option and the
    // navigator controls what survives. The NEW 'zero_score_gate' (Phase 225)
    // never offers that visibility -- it renders exactly three fixed labels
    // (continue-in-primary / new-project / no-room) and NEVER lists sibling
    // bound rooms at all. So the single most natural answer ("continue in
    // <primary>") was silently REPLACING a multi-room `bound` set with just
    // [primary], un-stickying the session in the same stroke -- a room the
    // session was already bound to (e.g. room-b) became hard-blocked on its
    // next write (scripts/write-scope-check.cjs) with no warning the gate
    // answer would do this. Fix: for this gate kind only, union the confirmed
    // picks with the PRIOR bound set before the sink's replace-write, so
    // answering this gate can only ADD/confirm rooms, never silently drop one.
    let priorBindingForZeroScore = null;
    if (gateKind === 'zero_score_gate') {
      try {
        const sb = require(path.join(__dirname, '..', 'lib', 'core', 'session-binding.cjs'));
        priorBindingForZeroScore = sb.readSessionBinding(sessionId, { home: home });
        const priorBound = Array.isArray(priorBindingForZeroScore.bound)
          ? priorBindingForZeroScore.bound : [];
        for (const s of priorBound) {
          if (slugs.indexOf(s) === -1) slugs.push(s);
        }
      } catch (_e) { /* fail-open: union is best-effort, never blocks the bind */ }
    }

    // Primary + sticky: honor explicit answer fields, else default the primary to the
    // first confirmed slug.
    let primaryPick = null;
    if (typeof answer.primary === 'string' && answer.primary.length > 0) {
      primaryPick = (typeof labelToSlug[answer.primary] === 'string')
        ? labelToSlug[answer.primary] : answer.primary;
    }
    if (!primaryPick) primaryPick = slugs[0];
    // CR-01 fix: the zero-score gate's card has no "remember for this session"
    // toggle at all (unlike the binding_gate card, whose guidance text explicitly
    // asks for one), so answer.sticky is structurally always undefined for this
    // gate kind -- defaulting it to false on every answer would silently
    // un-sticky an already-sticky multi-room session. Preserve the prior sticky
    // value in that case instead of stomping it to false.
    let sticky = answer.sticky === true;
    if (gateKind === 'zero_score_gate' && typeof answer.sticky === 'undefined') {
      sticky = !!(priorBindingForZeroScore && priorBindingForZeroScore.sticky === true);
    }

    // Route to the net-new SINK: consumeSessionBinding WRITES the session binding file.
    const res = consumerMod.consumeSessionBinding({
      picks: slugs,
      primaryPick: primaryPick,
      sticky: sticky,
      sessionId: sessionId,
      home: home,
    });

    // Clear the consumed gate payload so the same answer is not re-consumed next turn
    // (append a trace entry WITHOUT the payload -> it is no longer the last entry's).
    try {
      persistDecisionTrace(roomDir, sessionId, {
        ts: new Date().toISOString(),
        kind: 'binding_gate_consumed',
      });
    } catch (_e) { /* fire-and-forget */ }

    return res;
  } catch (_e) {
    // Best-effort: a fault is a no-op, never a throw (the never-block contract).
    return { ok: false, reason: 'consumer_threw' };
  }
}

// Phase 150-06 (D-08): export the engine-decision render helpers so the
// render-unlock suite can drive the dial wiring without self-executing the hook.
// The self-execution below is gated on require.main === module so a require()
// from a test (or any consumer) loads the module without firing the hook.
// Phase 159-02 (HOW-4): export consumePriorF1Pick so the turn-start wiring suite
// can drive the consumer without spawning the whole hook.
// Phase 194-04 (PSB-04): export the F.8 binding-gate producer + answer consumer.
module.exports = {
  renderEngineDecisionWithDial: renderEngineDecisionWithDial,
  buildDialSlotContext: buildDialSlotContext,
  formatEngineDecisionBlock: formatEngineDecisionBlock,
  consumePriorF1Pick: consumePriorF1Pick,
  emitBindingGate: emitBindingGate,
  consumePriorBindingAnswer: consumePriorBindingAnswer,
  // reach-gate-stale-turn-input: exported so the regression can assert the CURRENT
  // turn (STDIN_MESSAGE) is threaded into the LOCAL routing seed (never the Brain).
  deriveConversationSeed: deriveConversationSeed,
  // reach-sensor-relevance-gap A1: exported so the key-alignment regression can
  // assert the CLI read key derives from the hook payload session_id (the MCP
  // room_bind write UUID), not the sha256 hash fallback.
  extractSessionId: extractSessionId,
  resolveSessionId: resolveSessionId,
};

if (require.main === module) {
try {
  const injectionStart = Date.now();
  const code = main();
  if (injectionEnabled()) {
    try {
      injectGraphFindings(injectionStart);
    } catch (_) {
      // Fail-silent: never disrupt the prompt.
    }
  }
  // Phase 91-02 navigation engine block (always LAST so the decision
  // appears below any Phase 83 / Phase 84 emissions in additionalContext).
  // Skipped on empty stdin to preserve Phase 83's silent-exit contract;
  // the engine has no useful turn to decide on an empty message.
  let navP = Promise.resolve(null);
  try {
    if (STDIN_MESSAGE && STDIN_MESSAGE.length > 0) {
    const roomDir = resolveActiveRoomDir();
    if (roomDir) {
      const sessionId = resolveSessionId(roomDir);
      // Phase 159-02 (HOW-4, DCW-01/04): the turn-start consumer. Fire BEFORE the
      // new turn's dial render, reading the PRIOR turn's persisted f1_closer_payload
      // and routing the navigator's pick through the navigation-chokepoint-owned
      // consumer. Best-effort by construction (consumePriorF1Pick never throws and
      // returns a structured no-op on every non-dial / cold / faulted turn), so a
      // turn with no prior dial offer is BYTE-UNCHANGED from today (DCW-04). The raw
      // STDIN_MESSAGE rides ONLY the LOCAL lane (captureCliPick confines it to the
      // optional sentence); the selected verb is the deterministic enum match.
      try {
        consumePriorF1Pick(roomDir, sessionId, {
          selectedOption: STDIN_MESSAGE,
          text: STDIN_MESSAGE,
        });
      } catch (_) { /* fire-and-forget: never disrupt the prompt (DCW-04) */ }
      // Phase 194-04 (PSB-05): the F.8 binding-gate ANSWER consumer. Fire BEFORE the
      // engine block persists its own trace (so the prior binding_gate_payload is
      // still the last trace entry), reading the PRIOR turn's persisted gate offer and
      // routing the confirmed set through captureCliActionSet -> consumeSessionBinding
      // (the net-new session-file SINK). Best-effort: a non-gate / cold turn is a
      // no-op, never a throw (PSB-06, the never-block contract).
      try {
        consumePriorBindingAnswer(roomDir, sessionId, STDIN_MESSAGE);
      } catch (_) { /* fire-and-forget: never disrupt the prompt (PSB-06) */ }
      navP = emitEngineDecisionBlock(roomDir, sessionId).then(function (out) {
        if (!out || !out.decision) return null;
        // Phase 91-03: compose engine decision with legacy file-state +
        // env activation through the skill-activation-router. The router
        // enforces Canon Part 3 closed 10-verb vocabulary on engine
        // outputs and falls back to legacy when engine is silent.
        // Lazy-require so missing module degrades gracefully (the engine
        // block still emits with routing absent).
        let routing = null;
        try {
          const router = require(
            path.join(__dirname, '..', 'lib', 'core', 'skill-activation-router.cjs')
          );
          const legacyActivation = computeLegacyActivation(roomDir);
          routing = router.routeActivation(out.decision, legacyActivation);
        } catch (_e) {
          routing = null;
        }

        // Phase 91-04: offer presenter integration.
        //
        // Step 1 (close the ignore-loop on the previous turn): if the
        // most recent history entry is 'shown' for this same session,
        // reclassify it as 'acted' (user invoked the suggested command)
        // or 'ignored' (user did not). This is the simple Wave-1
        // heuristic from PLAN: classifyTurnOutcome on the previous
        // 'shown' record using the current STDIN_MESSAGE.
        //
        // Step 2 (present this turn's offer if any): call presentOffer
        // and, when an offer renders, record a 'shown' outcome so the
        // next turn can reclassify it. If the engine returned null
        // offer or grounding rejected it, no shown record is written.
        //
        // Lazy-require so missing module degrades gracefully (the
        // engine + routing block still emits with no Offer line).
        let offerLine = null;
        // Phase 135-03: the F.1 Next-Move closer payload (built when an offer
        // survives grounding). Persisted to the trace so /mos:explain-decision and
        // the consumer surface render the locked F.1 selector with the Free-Text
        // escape. Null when no offer renders.
        let f1Payload = null;
        try {
          const presenter = require(
            path.join(__dirname, '..', 'lib', 'core', 'offer-presenter.cjs')
          );

          // Step 1: reclassify previous 'shown' record (if any) using
          // the user's current message as the acted/ignored signal.
          try {
            const history = presenter.readOfferHistory(roomDir);
            const arr = (history && Array.isArray(history.history)) ? history.history : [];
            // Walk backwards to find the most recent entry for this
            // session; reclassify if and only if its outcome is 'shown'.
            for (let i = arr.length - 1; i >= 0; i -= 1) {
              const e = arr[i];
              if (!e || typeof e !== 'object') continue;
              if (e.session_id === sessionId && e.outcome === 'shown') {
                const newOutcome = presenter.classifyTurnOutcome(
                  { command: e.command }, STDIN_MESSAGE
                );
                // In-place update + atomic rewrite.
                e.outcome = newOutcome;
                try {
                  const fp = path.join(roomDir, '.mindrian', 'offer-history.json');
                  const tmpDir = path.join(roomDir, '.mindrian');
                  try { fs.mkdirSync(tmpDir, { recursive: true }); } catch (_) {}
                  const rnd = Math.random().toString(36).slice(2, 10);
                  const tmpPath = fp + '.tmp.' + process.pid + '.' + rnd;
                  fs.writeFileSync(tmpPath, JSON.stringify(history, null, 2));
                  fs.renameSync(tmpPath, fp);
                } catch (_) { /* best-effort reclassification */ }
                break;
              }
              // Stop walking once we hit any non-'shown' entry for this
              // session (older turns are already classified).
              if (e.session_id === sessionId) break;
            }
          } catch (_) { /* ignore-loop is best-effort */ }

          // Step 2: present this turn's offer (if engine produced one).
          let history2;
          try { history2 = presenter.readOfferHistory(roomDir); } catch (_) {
            history2 = { version: 1, history: [] };
          }
          const sessionCtx = { offeredThisTurn: false, sessionId: sessionId };
          let presented;
          try {
            presented = presenter.presentOffer(out.decision, history2, sessionCtx);
          } catch (_) { presented = null; }
          if (presented && typeof presented.offerLine === 'string' && presented.offerLine.length > 0) {
            offerLine = presented.offerLine;
            // Record 'shown' so next turn can reclassify.
            try {
              const offer = (out.decision && out.decision.offer_next_step) || {};
              presenter.recordOfferOutcome(roomDir, {
                outcome: 'shown',
                session_id: sessionId,
                command: typeof offer.command === 'string' ? offer.command : null,
                reason: typeof offer.reason === 'string' ? offer.reason : null,
              });
            } catch (_) { /* fire-and-forget */ }

            // Phase 135-03: the reliable F.1 Next-Move closer.
            //
            // The offer survived grounding + suppression + cap (offerLine is
            // non-empty). Fire the F.1 Next-Move selector for it via the SHIPPED
            // selector-dispatcher pickShape({requestedShape:'F.1'}) (the
            // cross-surface AskUserQuestion primitive) so
            // the offer becomes a CHOICE with the Free-Text escape (the 10th
            // canonical verb) -- never a bespoke prompt string (the
            // test-no-bespoke-brain-prompts.sh tripwire). The rendered F.1 surface
            // is persisted to the decision trace so the consumer surface (Larry on
            // CLI / Desktop / Cowork) renders the locked selector identically (SC8;
            // no surface-specific branch).
            //
            // The pick lands on the NEXT turn (this hook emits additionalContext;
            // it does not block on a user answer). When the user picks, the same
            // closer.closeOffer routes it: accept/defer/reject -> a typed decision
            // edge via recordSelectorDecision; Free-Text -> a miss memory_event via
            // recordSelectorMiss (user_intent stays LOCAL per Part 8). When an
            // accepted offer files an artifact, the closer injects the wikilink
            // footer idempotently via the Phase 76 injector
            // wikilink-builder.injectFiledToFooter (dedupes via content.includes;
            // SC5 -- the decision edge carries the [[wikilink]] reason as
            // provenance). A reject
            // writes the f_selector_decision row the resolver's shouldExclude reads
            // next turn -- the SC6 backoff loop closes through this pair (the
            // offer-closer.test.cjs backoff-persistence case proves it). The closer
            // NEVER opens room.db itself (substrate guard): the consumer populates
            // roomState.db via the navigation chokepoint when recording the pick.
            //
            // Lazy-require + try/catch: a missing closer module degrades gracefully
            // -- the offerLine alone still emits (no crash, no surface branch).
            try {
              const closer = require(
                path.join(__dirname, '..', 'lib', 'workflow', 'offer-closer.cjs')
              );
              const offerForF1 = (out.decision && out.decision.offer_next_step) || {};
              const decisionTrace = (out.decision && out.decision.decision_trace) || null;
              // Phase 158-01 (RJP-07 / SC-02): the two-turn offer->close keying
              // pin. The reach_id that GROUNDED this offer is named in the LOCAL
              // decision trace (context_assembly.decision_grounding -- a frozen
              // reach_id when a sensor reach drove the fire, else 'wicked' /
              // 'brain_verb' / 'neighborhood' / null). Map it onto the offer's
              // command verb so buildF1Payload carries a parallel per-verb reachIds
              // map; the persisted f1_closer_payload then survives the turn boundary
              // and the next-turn pick routes back to closeReach keyed by reach_id.
              // Non-reach groundings ('wicked'/'brain_verb'/...) are forwarded as-is
              // and dropped by the recordSelectorDecision enum-gate downstream, so
              // only a real REACH_IDS member ever lands on the persisted payload.
              let reachIdByVerb = null;
              try {
                const grounding = decisionTrace
                  && decisionTrace.context_assembly
                  && decisionTrace.context_assembly.decision_grounding;
                const offerCmd = (offerForF1 && typeof offerForF1.command === 'string')
                  ? offerForF1.command : null;
                if (typeof grounding === 'string' && grounding.length > 0 && offerCmd) {
                  reachIdByVerb = {};
                  reachIdByVerb[offerCmd] = grounding;
                }
              } catch (_) { reachIdByVerb = null; }
              const rendered = closer.renderF1(offerForF1, {
                roomDir: roomDir,
                operator: operatorState,
                decisionTrace: decisionTrace,
                reachIdByVerb: reachIdByVerb,
              });
              if (rendered && rendered.payload) {
                f1Payload = rendered.payload;
                // FIX-05 (Phase 150.6-03): carry the LOCAL conversation seed on
                // the persisted F.1 payload so the consumer surface forwards it
                // as closeOffer({ sentence }) on the NEXT turn (the seam where
                // the pick is routed to recordSelectorDecision). The closer
                // classifies it at the write seam and stores ONLY the scalar
                // boolean + source enum; the sentence never enters any payload
                // (Canon Part 8). This is the LOCAL routing lane only -- the
                // seed is NEVER threaded toward buildBrainPacket (D-03a fence).
                if (context.conversationSeed) {
                  f1Payload.sentence = context.conversationSeed;
                }
                // Phase 159-02 (DCW-01): carry the offer's GENERIC framework handle
                // onto the persisted payload so the turn-start consumer
                // (consumePriorF1Pick, next turn) can complete the matched verb's
                // offer scaffold and write the f_selector_decision edge whose
                // target_id is 'framework:' + framework (selector-decisions.cjs:277).
                // The framework is a generic methodology name (never user content,
                // Canon Part 8); this is the IDENTICAL additive post-build mutation
                // idiom as the FIX-05 sentence carry directly above (the persist
                // mechanism + the reachIds/verbs keying are untouched). Without it the
                // accept/defer/reject row cannot be written and the dial loop stays
                // dark, so this is a load-bearing additive field.
                if (typeof offerForF1.framework === 'string' && offerForF1.framework.length > 0) {
                  f1Payload.framework = offerForF1.framework;
                }
              }
            } catch (_) { /* closer is best-effort; offerLine still emits */ }
          }
        } catch (_e) {
          offerLine = null;
        }

        // Compose trace entry. Persist routing source/notes alongside
        // engine trace so /mos:explain-decision (Plan 91-05) surfaces
        // which activation set won.
        const turnNo = appendTraceTurnNumber(roomDir, sessionId);
        const baseTrace = (out.decision && out.decision.decision_trace) || {};
        const traceEntry = Object.assign({}, baseTrace, {
          turn: turnNo,
          at: new Date().toISOString(),
          elapsed_ms: out.elapsed_ms,
        });
        if (routing && typeof routing === 'object') {
          traceEntry.routing_source = routing.source;
          traceEntry.routing_reason = routing.reason;
          traceEntry.routing_activated_skills = routing.activated_skills;
          traceEntry.routing_suppressed_skills = routing.suppressed_skills;
          if (Array.isArray(routing.trace_notes) && routing.trace_notes.length > 0) {
            traceEntry.routing_trace_notes = routing.trace_notes;
          }
        }
        // Phase 91-04: persist the rendered offer line (or null) into
        // the decision trace for /mos:explain-decision (Plan 91-05).
        if (typeof offerLine === 'string' && offerLine.length > 0) {
          traceEntry.offer_rendered = offerLine;
        }
        // Phase 135-03: persist the F.1 closer payload (verbs ending with the
        // Free-Text escape + the Mode A recommendedVerb marker) so the consumer
        // surface renders the locked selector and the pick on the next turn routes
        // back through closer.closeOffer.
        if (f1Payload && Array.isArray(f1Payload.verbs) && f1Payload.verbs.length > 0) {
          traceEntry.f1_closer_payload = f1Payload;
        }
        // Emit additionalContext block. Phase 150-06 (D-08 render unlock): on the
        // engine arm, surface buildReachList -> dial-presenter onto the live
        // response block, grounded by the projected cortex (the legD cortex_nodes
        // threaded out on the LOCAL routing lane). Best-effort: the render never
        // blocks the turn (renderEngineDecisionWithDial wraps + degrades).
        // 150.5-02 (DIAL-ATOM-01): the render runs BEFORE persistDecisionTrace
        // so a dial_render_fault note (ctx.onRenderNote) merges into the SAME
        // persisted decision trace routing_trace_notes already rides (the
        // shipped Phase-91 surface; zero new write paths, threat T-150.5-07).
        const block = renderEngineDecisionWithDial(
          out.decision, routing, offerLine, {
            cortexNodes: out.cortex_nodes,
            // Phase 209-01 (E3): the live room context + active room dir, so the
            // dial slot map resolves {topic}/{room_name} from live nodes.
            roomContext: out.room_context,
            roomDir: roomDir,
            // Phase 209-06 (H3): threaded so the engine-arm PRIMARY side-channel
            // producer can key its record by session (sessionId is already in
            // scope in this closure via resolveSessionId(roomDir) above).
            sessionId: sessionId,
            // Phase 158-03 (SC-07): the upstream-computed bounded reject penalty +
            // hard-suppression set, folded on the live arm (db open) and threaded
            // out on the resolved object. The render seam merges discountedScores
            // over reachScores + passes suppressedReachIds into the PURE
            // buildReachList. Absent/empty -> un-discounted byte-identical render.
            reach_penalties: out.reach_penalties,
            onRenderNote: function (note) { traceEntry.dial_render_note = note; },
          }
        );
        persistDecisionTrace(roomDir, sessionId, traceEntry);
        if (block && block.length > 0) {
          try { process.stdout.write(block + '\n'); } catch (_) {}
        }
        return null;
      }).catch(function () { return null; });
    }
    }
  } catch (_) { /* engine block is fire-and-forget */ }
  // Wait for engine to settle (bounded by NAV_HARD_TIMEOUT_MS) before
  // exiting so the additionalContext write lands before stdout closes.
  navP.then(function () {
    process.exit(typeof code === 'number' ? code : 0);
  }, function () {
    process.exit(typeof code === 'number' ? code : 0);
  });
} catch (_) {
  // Fail-silent on any unexpected error. Classifier is advisory.
  process.exit(0);
}
}
