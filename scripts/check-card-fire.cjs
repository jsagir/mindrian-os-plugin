#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 179-01 -- the GA-4 card-fire interceptor (the R-1 cure, Wave 1)
 * =====================================================================
 * A Stop-hook-class turn-scan that moves card-fire enforcement BELOW the agent.
 *
 * R15 (Phase 178) proves a gate surface is WIRED to emit a card; it cannot force the
 * model to FIRE the card at runtime (the named R-1 residual). A prose fence shipped
 * (commit e22b9ea4) and the agent ignored it. This interceptor is the structural cure:
 * a deterministic turn-scan the LLM has no say in. On a reached-Decision-Gate turn with
 * no fired AskUserQuestion card it emits a Stop-block (decision:'block') +
 * additionalContext re-prompt forcing the card; after MAX_FORCE_RETRIES bounded retries
 * it degrades gracefully (log + allow) so a genuinely card-incapable surface cannot trap
 * the navigator.
 *
 * Hook class: this runs on the Stop event (hooks/hooks.json Stop block), NOT PostToolUse.
 * The block route is a JSON envelope `{ decision:'block', continue:false, ... }` written
 * to stdout on exit 0 -- a valid Stop-block path (the Claude Code Stop hook honors a
 * decision:'block' envelope to re-prompt the turn). It is NOT an exit-2 block; earlier
 * drafts of this header and 179-CONTEXT called it an "exit-2 PostToolUse interceptor" --
 * that was doc drift, reconciled here (IN-01) to match the shipped Stop-block-on-exit-0
 * route.
 *
 * Stop-stdin contract (BL-01, the live cure): the real Claude Code Stop hook delivers
 * `{ hook_event_name, transcript_path, stop_hook_active, session_id, ... }` -- it does
 * NOT deliver output_text / ran_entries / askuserquestion_fired directly. The interceptor
 * READS the turn by parsing `transcript_path` (mirroring scripts/on-stop:33): it extracts
 * the LAST assistant message text (drives the BACKSTOP) and scans the transcript's
 * tool-use records for an AskUserQuestion invocation (drives askuserquestion_fired). If
 * the envelope already carries the normalized signals directly (the unit-test shape),
 * those are used as-is (backward-compatible). An unreadable/missing transcript yields
 * empty signals -> a safe no-op (never throws, never blocks spuriously).
 *
 * Detection (CONTEXT decision 1: registry-keyed PRIMARY + output-text BACKSTOP):
 *   PRIMARY  (DEFERRED -- see doctrine note below) -- a render-coverage-registry
 *               gate-reaching surface (data/render-coverage-registry.json entries[] with
 *               render_coverage 'card-emission') ran this turn AND no AskUserQuestion
 *               tool-call fired. The enumeration is DERIVED from the registry, never
 *               hand-maintained.
 *   BACKSTOP (LIVE -- the detector this phase ships) -- the turn output text carries the
 *               ASCII-box gate glyphs (the `[1] [2] [3]` / "type 1, 2, or 3" anti-pattern)
 *               with no fired card -- intercepted even for an OFF-registry surface.
 *
 * DOCTRINE HONESTY (WR-04): PRIMARY is DEFERRED, not live. PRIMARY keys off a `ran_entries`
 * / `reached_gate_entries` set that records which registry gate-reaching surfaces ran this
 * turn. A Stop-hook transcript yields assistant TEXT (the BACKSTOP signal), NOT a
 * reached-entries SET, and a repo-wide grep finds ZERO producers of `ran_entries` /
 * `reached_gate_entries` outside this file and its tests. So until a side-channel writer
 * exists (a PreToolUse/PostToolUse hook that records reached-gate registry entries during
 * the turn for the Stop hook to read), PRIMARY has no live source and stays INERT. The
 * BACKSTOP (transcript ASCII-box text detection) is the LIVE detector this phase ships.
 * The PRIMARY code path is retained (it stays correct the instant a producer lands and the
 * unit tests exercise it via direct-field envelopes), but it is NOT presented as the live
 * cure. The side-channel writer is a named, deferred follow-on.
 *
 * Bounded escape (T-179-01 DoS mitigation): a LOCAL retry side-file
 * (~/.mindrian/card-fire-retries.json) keyed by a TRANSCRIPT-GROWTH-INVARIANT turn identity
 * (the Stop stdin session_id + a stable gate identity -- the reached-gate entry set when
 * present, else the LAST USER message anchor from the transcript) counts consecutive
 * intercepts. The key is invariant across BOTH (WR-01) a re-worded re-prompt (the gate
 * identity excludes the volatile output_text) AND (CR-02) a GROWING transcript: the model
 * appends an assistant turn every time it re-emits the blocked gate, so any transcript-LENGTH
 * value (e.g. an assistant-message counter) would mint a fresh key every retry and the bounded
 * escape would NEVER converge -- a production livelock. The last-USER-message anchor stays
 * FIXED across all assistant re-emissions of the same stuck gate, so consecutive intercepts of
 * the SAME gate increment the SAME counter and MAX_FORCE_RETRIES is actually reachable. (The
 * assistant-message counter is retained only as a LOWEST-precedence legacy fallback for the
 * direct-field unit-test shape; it is never the live gate identity.) The store is pruned on write
 * by a TTL (WR-02: each entry carries { count, ts }; entries older than RETRY_TTL_MS are
 * evicted, so the side-file cannot grow without bound). At MAX_FORCE_RETRIES the predicate
 * returns degrade=true and the envelope is { continue: true, suppressOutput: true } (log to
 * stderr, allow the turn).
 *
 * Envelope schema (Phase 95 BASH-95-01 invariant): top-level keys are a subset of
 * { decision, reason, continue, stopReason, suppressOutput, systemMessage,
 *   hookSpecificOutput }. additionalContext lives ONLY inside hookSpecificOutput.
 *
 * Canon Part 8 (The Graph Boundary): LOCAL-only. Reads the local registry + the hook
 * stdin envelope + the LOCAL transcript file (transcript_path is a local path, same as
 * scripts/on-stop reads it) + the local retry side-file; makes ZERO Brain reads/writes
 * and ZERO network calls. The interceptor opens no remote wire and loads no Brain module.
 * The transcript content the interceptor reads (an untrusted model turn) stays LOCAL and
 * is NEVER echoed to Brain or sent anywhere -- it is read, scanned for glyphs/tool-use,
 * and discarded.
 *
 * Additive only: mints no reach / posture / edge / node; the frozen Part 3 contracts
 * (MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, the glyphs) are
 * untouched.
 *
 * Defensive: any internal error -> stderr + { continue: true, suppressOutput: true } +
 * exit 0. The interceptor NEVER blocks the hook chain on a bug.
 *
 * House rule: hyphens only, no em-dashes. CJS module, Node built-ins only.
 *
 * License: BSL 1.1.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const PLUGIN_ROOT = path.resolve(__dirname, '..');

// data/render-coverage-registry.json is the Phase 178 R15 substrate. The interceptor
// keys PRIMARY detection off its card-emission entries; it does NOT hand-maintain a
// parallel gate list.
const REGISTRY_PATH = path.join(PLUGIN_ROOT, 'data', 'render-coverage-registry.json');

// The LOCAL retry side-file for the bounded escape (Part 8 LOCAL-only).
function retryFilePath() {
  const home = process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian');
  return path.join(home, 'card-fire-retries.json');
}

// The bounded-escape ceiling (named constant). After this many consecutive intercepts
// on the same turn-context, degrade to log + allow so a card-incapable surface cannot
// trap the navigator.
const MAX_FORCE_RETRIES = 3;

// WR-02: the retry side-file TTL. Each store entry carries { count, ts }; on every write
// entries older than this are evicted, so the LOCAL ~/.mindrian/card-fire-retries.json
// cannot grow without bound over a long-lived install. 24h is generous: a stuck gate
// resolves within one turn; an abandoned key is dead long before a day passes.
const RETRY_TTL_MS = 24 * 60 * 60 * 1000;

// The ASCII-box gate glyphs / literal anti-pattern the BACKSTOP scans for. A reached
// gate that renders as flat text instead of firing the card carries these.
const ASCII_BOX_GLYPH_RE = /\[\s*1\s*\]\s*.*\[\s*2\s*\]|type\s+1\s*,\s*2\s*,\s*or\s+3|\u25A0/i;

// ----- envelope schema allowlist (Phase 95 BASH-95-01) -----

const ALLOWED_ENVELOPE_KEYS = new Set([
  'decision',
  'reason',
  'continue',
  'stopReason',
  'suppressOutput',
  'systemMessage',
  'hookSpecificOutput',
]);

// ---------------------------------------------------------------------------
// loadRegistry() -- read the render-coverage registry. Pure local read; never throws
// (returns { entries: [] } on any error so the interceptor degrades to the BACKSTOP
// signal alone rather than blocking the hook chain).
// ---------------------------------------------------------------------------
function loadRegistry() {
  try {
    const raw = fs.readFileSync(REGISTRY_PATH, 'utf8');
    const reg = JSON.parse(raw);
    return reg && typeof reg === 'object' ? reg : { entries: [] };
  } catch (_e) {
    return { entries: [] };
  }
}

// ---------------------------------------------------------------------------
// gateReachingEntries(registry) -- DERIVE the gate-reaching enumeration from the
// registry's card-emission entries (Phase 178 R15). render-only-excluded entries are
// NOT gate-reaching. Returns an array of entry paths. Never throws.
// ---------------------------------------------------------------------------
function gateReachingEntries(registry) {
  const reg = registry && typeof registry === 'object' ? registry : {};
  const entries = Array.isArray(reg.entries) ? reg.entries : [];
  const out = [];
  for (const e of entries) {
    if (e && e.render_coverage === 'card-emission' && typeof e.entry === 'string') {
      out.push(e.entry);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// turnContextHash(turn) -- a STABLE LOCAL key for the bounded-escape retry counter.
//
// WR-01 + CR-02: the key MUST be stable across re-PROMPTS on the SAME stuck gate, or
// MAX_FORCE_RETRIES is never reachable. There are TWO ways the key can drift, and both
// are fatal to convergence:
//   - WR-01 (re-worded prose): the model re-emits the same gate with different PROSE, so
//     an output_text-derived key would mint a fresh key every retry.
//   - CR-02 (transcript GROWTH): on the LIVE BACKSTOP path the model APPENDS one assistant
//     turn every time the interceptor blocks and it re-emits, so any transcript-LENGTH-
//     derived identity (e.g. an assistant-message counter) ALSO mints a fresh key every
//     retry -- a production livelock, the same failure class as WR-01.
// So the gate identity must be invariant across BOTH re-wording AND transcript growth:
//   - session_id        : the Stop stdin session_id (the same conversation across retries).
//   - gate identity (in precedence order, each transcript-growth-INVARIANT):
//       1. the reached-gate entry SET when present (PRIMARY signal -- deferred, no producer).
//       2. the LAST USER message anchor (last_user_anchor): a hash of the index + content of
//          the last user message. The model APPENDS assistant turns on re-prompt; the last
//          USER message stays FIXED across all retries of the same stuck response, and is
//          per-gate (a different user request -> a different anchor -> a different counter).
//       3. (legacy) a stable gate_turn_index ONLY if no anchor exists (direct-field shape).
//   NEVER the output text (WR-01), NEVER assistantCount / any transcript-length value (CR-02).
// Part 8: a local sha256 over local stable identity scalars; never egresses.
// ---------------------------------------------------------------------------
function turnContextHash(turn) {
  const t = turn && typeof turn === 'object' ? turn : {};
  const session = typeof t.session_id === 'string' ? t.session_id : '';
  // Gate identity, in precedence order. Each candidate is invariant across BOTH a re-worded
  // re-prompt (WR-01) AND a growing transcript (CR-02). NEVER the output text, NEVER a
  // transcript-length-derived counter as the PRIMARY identity.
  const ran = Array.isArray(t.ran_entries) && t.ran_entries.length > 0
    ? t.ran_entries.slice().sort().join('|')
    : '';
  // last_user_anchor: the transcript-growth-INVARIANT gate identity for the LIVE BACKSTOP
  // path. It keys off the LAST USER message (fixed across all assistant re-emissions of the
  // same stuck gate), so consecutive intercepts of the SAME gate increment the SAME counter.
  const userAnchor = typeof t.last_user_anchor === 'string' ? t.last_user_anchor : '';
  // gate_turn_index is retained ONLY as a last-resort legacy fallback (direct-field unit-test
  // shape). It is NOT used when a user anchor is present, because assistantCount grows as the
  // transcript grows (CR-02). It is intentionally LOWEST precedence.
  const gateIndex = Number.isFinite(t.gate_turn_index) ? String(t.gate_turn_index) : '';
  const gateIdentity = ran || userAnchor || gateIndex;
  return crypto
    .createHash('sha256')
    .update('s:' + session + '|g:' + gateIdentity)
    .digest('hex')
    .slice(0, 16);
}

// ---------------------------------------------------------------------------
// classifyCardFire(turn, registry) -- THE deterministic predicate.
//
// Returns { intercept, reason, degrade }:
//   - intercept=true  : a reached gate fired no card; force it (decision:block-on-exit-0 re-prompt).
//   - intercept=false : ordinary turn, card already fired, or degraded.
//   - degrade=true    : the bounded escape released (retry_count >= MAX_FORCE_RETRIES);
//                       stop forcing, log + allow.
//
// turn shape (the normalized turn signals a Stop hook derives):
//   { ran_entries: string[], askuserquestion_fired: bool, output_text: string,
//     retry_count?: number }
//
// Pure code, deterministic, no network, no clock, no random. Never throws.
// ---------------------------------------------------------------------------
function classifyCardFire(turn, registry) {
  try {
    const t = turn && typeof turn === 'object' ? turn : {};
    const ran = Array.isArray(t.ran_entries) ? t.ran_entries : [];
    const cardFired = t.askuserquestion_fired === true;
    const outputText = typeof t.output_text === 'string' ? t.output_text : '';

    // If the card already fired, there is nothing to force.
    if (cardFired) {
      return { intercept: false, reason: 'card-fired', degrade: false };
    }

    // PRIMARY signal: did a render-coverage-registry gate-reaching surface run?
    const reaching = new Set(gateReachingEntries(registry));
    const primaryHit = ran.some(function (e) { return reaching.has(e); });

    // BACKSTOP signal: does the turn output carry the ASCII-box gate glyphs? Catches
    // the literal anti-pattern even for an off-registry surface.
    const backstopHit = ASCII_BOX_GLYPH_RE.test(outputText);

    if (!primaryHit && !backstopHit) {
      // No gate-reaching signal on this turn -> zero forced cards (ordinary turn).
      return { intercept: false, reason: 'no-gate-signal', degrade: false };
    }

    // A reached gate with no fired card is a candidate intercept. Apply the bounded
    // escape: if the retry count for this turn-context has hit the ceiling, degrade.
    const retryCount = Number.isFinite(t.retry_count) ? t.retry_count : 0;
    if (retryCount >= MAX_FORCE_RETRIES) {
      return {
        intercept: false,
        degrade: true,
        reason: 'bounded-escape-released-after-' + MAX_FORCE_RETRIES + '-retries',
      };
    }

    const reason = primaryHit
      ? 'reached-registry-gate-no-card'
      : 'ascii-box-backstop-no-card';
    return { intercept: true, reason: reason, degrade: false };
  } catch (_e) {
    // Defensive: never throw out of the predicate.
    return { intercept: false, reason: 'predicate-error', degrade: false };
  }
}

// ---------------------------------------------------------------------------
// buildEnforcementEnvelope(verdict) -- shape the Stop-hook output envelope from a
// classifyCardFire verdict.
//   - degrade  -> { continue: true, suppressOutput: true } (log + allow; no loop).
//   - intercept-> the decision:block-on-exit-0 block: { decision:'block', ..., hookSpecificOutput:
//                 { additionalContext: <re-prompt to fire the AskUserQuestion card> } }.
//   - neither  -> { continue: true, suppressOutput: true } (nothing to do).
// additionalContext lives ONLY inside hookSpecificOutput. Returns a key-filtered
// envelope. Never throws.
// ---------------------------------------------------------------------------
function buildEnforcementEnvelope(verdict) {
  const v = verdict && typeof verdict === 'object' ? verdict : {};

  let raw;
  if (v.degrade === true) {
    raw = {
      continue: true,
      suppressOutput: true,
      reason: typeof v.reason === 'string' ? v.reason : 'card-fire-bounded-escape',
    };
  } else if (v.intercept === true) {
    raw = {
      decision: 'block',
      reason: typeof v.reason === 'string' ? v.reason : 'card-fire-intercept',
      continue: false,
      hookSpecificOutput: {
        hookEventName: 'Stop',
        additionalContext:
          'This turn REACHED a Decision Gate but did NOT fire the interactive card. ' +
          'You MUST fire the AskUserQuestion card NOW with the gate options as ' +
          'arrow-key-navigable choices. Do NOT render a flat ASCII box or "type 1, 2, ' +
          'or 3" text. Re-emit this turn with the AskUserQuestion tool call.',
      },
    };
  } else {
    raw = { continue: true, suppressOutput: true };
  }

  const filtered = {};
  for (const k of Object.keys(raw)) {
    if (ALLOWED_ENVELOPE_KEYS.has(k)) filtered[k] = raw[k];
  }
  if (filtered.continue === undefined && filtered.decision === undefined) {
    filtered.continue = true;
  }
  return filtered;
}

// ---------------------------------------------------------------------------
// readRetryCount(ctxHash) / bumpRetryCount(ctxHash) / clearRetryCount(ctxHash) --
// the LOCAL bounded-escape side-file (Part 8 LOCAL-only). Best-effort: any error is
// swallowed (a missing/corrupt side-file degrades to a fresh count of 0, never blocks).
// ---------------------------------------------------------------------------
function readRetryStore() {
  try {
    const raw = fs.readFileSync(retryFilePath(), 'utf8');
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' ? obj : {};
  } catch (_e) {
    return {};
  }
}

// pruneRetryStore(store, now) -- WR-02: evict entries older than RETRY_TTL_MS so the
// side-file cannot grow without bound. Each entry is { count, ts }; a legacy bare-integer
// entry (pre-WR-02 format) is normalized to { count, ts: now } on read so it is not lost
// but does become subject to the TTL going forward. Pure; returns a fresh pruned store.
function pruneRetryStore(store, now) {
  const t = Number.isFinite(now) ? now : Date.now();
  const out = {};
  const src = store && typeof store === 'object' ? store : {};
  for (const k of Object.keys(src)) {
    const e = normalizeRetryEntry(src[k], t);
    if (e && (t - e.ts) <= RETRY_TTL_MS) {
      out[k] = e;
    }
  }
  return out;
}

// normalizeRetryEntry(v, now) -- coerce a store value to { count, ts }. Tolerates the
// legacy bare-integer shape (pre-WR-02) and the { count, ts } shape; anything else -> null.
function normalizeRetryEntry(v, now) {
  const t = Number.isFinite(now) ? now : Date.now();
  if (Number.isFinite(v)) return { count: v, ts: t };
  if (v && typeof v === 'object' && Number.isFinite(v.count)) {
    return { count: v.count, ts: Number.isFinite(v.ts) ? v.ts : t };
  }
  return null;
}

function writeRetryStore(store) {
  try {
    const fp = retryFilePath();
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    // WR-02: prune on every write.
    fs.writeFileSync(fp, JSON.stringify(pruneRetryStore(store, Date.now())), 'utf8');
  } catch (_e) {
    /* best-effort; never block on a side-file write */
  }
}

function readRetryCount(ctxHash) {
  const store = readRetryStore();
  const e = normalizeRetryEntry(store[ctxHash], Date.now());
  return e ? e.count : 0;
}

function bumpRetryCount(ctxHash) {
  const store = readRetryStore();
  const now = Date.now();
  const e = normalizeRetryEntry(store[ctxHash], now);
  const next = (e ? e.count : 0) + 1;
  store[ctxHash] = { count: next, ts: now };
  writeRetryStore(store);
  return next;
}

function clearRetryCount(ctxHash) {
  const store = readRetryStore();
  if (ctxHash in store) {
    delete store[ctxHash];
    writeRetryStore(store);
  }
}

// ----- stdin / envelope helpers (the on-stop idiom from operator-update.cjs) -----

function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    if (!raw || !raw.trim()) return {};
    return JSON.parse(raw);
  } catch (_e) {
    return {};
  }
}

function emitEnvelope(obj) {
  const filtered = {};
  for (const k of Object.keys(obj || {})) {
    if (ALLOWED_ENVELOPE_KEYS.has(k)) filtered[k] = obj[k];
  }
  if (filtered.continue === undefined && filtered.decision === undefined) {
    filtered.continue = true;
  }
  process.stdout.write(JSON.stringify(filtered));
  process.exit(0);
}

function silentSuccess() {
  emitEnvelope({ continue: true, suppressOutput: true });
}

// ---------------------------------------------------------------------------
// readTranscriptTurn(transcriptPath) -- parse the Stop-hook transcript JSONL and extract
// the signals a transcript can yield. Mirrors the scripts/on-stop:33 idiom: the Stop hook
// delivers a `transcript_path` (a LOCAL .jsonl file, one JSON object per line); we read it,
// walk the lines, and pull:
//   - output_text         : the text of the LAST assistant message (drives the BACKSTOP).
//   - askuserquestion_fired: true ONLY if the LAST assistant message fired the AskUserQuestion
//                            card. Scoped to the SAME message that produced output_text (WR-06):
//                            a STALE earlier card must NOT suppress interception of the CURRENT
//                            (last) box turn -- the two signals MUST share the same turn scope.
//   - last_user_anchor     : a transcript-growth-INVARIANT gate identity for the WR-01/CR-02
//                            retry key -- a hash of the LAST USER message's index + content.
//                            The model APPENDS assistant turns on re-prompt, so the last USER
//                            message stays FIXED across all retries of the same stuck gate
//                            (unlike an assistant counter, which grows -- CR-02). Per-gate:
//                            a different user request yields a different anchor.
//   - gate_turn_index      : a count of assistant messages, retained ONLY as a legacy
//                            last-resort fallback for the WR-01 key (NOT used when an anchor
//                            exists; it grows with the transcript -- CR-02).
// Defensive (Part 8 / on-stop discipline): a missing / unreadable / malformed transcript
// returns empty signals; NEVER throws. The transcript content stays LOCAL -- read, scanned,
// discarded; never egressed (last_user_anchor is a sha256 hash, not the user text itself).
// ---------------------------------------------------------------------------
function readTranscriptTurn(transcriptPath) {
  const empty = {
    output_text: '',
    askuserquestion_fired: false,
    gate_turn_index: 0,
    last_user_anchor: '',
  };
  if (typeof transcriptPath !== 'string' || !transcriptPath.trim()) return empty;
  let raw;
  try {
    raw = fs.readFileSync(transcriptPath, 'utf8');
  } catch (_e) {
    return empty;
  }
  let lastAssistantText = '';
  // WR-06: askFired is the AskUserQuestion state of the LAST assistant message ONLY, not an
  // OR across the whole conversation. We track the last assistant message's content object and
  // evaluate scanContentForAskUserQuestion on IT ALONE after the walk, so a stale earlier card
  // cannot mask the current box turn. (The old whole-transcript `|= true` accumulation is the
  // exact cross-turn bleed WR-06 flagged; removed.)
  let lastAssistantContent = null;
  let assistantCount = 0;
  // CR-02: track the last USER message's index + content for the transcript-growth-invariant
  // gate anchor. Index is the user-message ordinal (stable across appended assistant turns).
  let userIndex = 0;
  let lastUserIndex = 0;
  let lastUserText = '';
  const lines = raw.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch (_e) {
      continue; // skip a malformed line, never throw
    }
    if (!obj || typeof obj !== 'object') continue;
    const msg = obj.message && typeof obj.message === 'object' ? obj.message : obj;
    const role = msg.role || obj.type;
    if (role === 'assistant') {
      assistantCount += 1;
      const text = extractAssistantText(msg.content);
      if (text) lastAssistantText = text;
      // Record THIS assistant message's content as the current last; askFired is decided from
      // the last one after the walk (WR-06 scoping). Prefer the message.content; fall back to
      // a top-level obj.content only when this same record carries it (no cross-turn bleed).
      lastAssistantContent = (msg.content !== undefined && msg.content !== null)
        ? msg.content
        : (obj.content !== undefined ? obj.content : null);
    } else if (role === 'user') {
      userIndex += 1;
      const utext = extractAssistantText(msg.content);
      lastUserIndex = userIndex;
      lastUserText = typeof utext === 'string' ? utext : '';
    }
  }
  // WR-06: evaluate the card-fired signal on the LAST assistant message's content ALONE.
  const askFired = scanContentForAskUserQuestion(lastAssistantContent);
  // CR-02: the anchor is a sha256 over the last-user index + content (Part 8: a hash, the raw
  // user text never leaves this function). Empty when there is no user message.
  let lastUserAnchor = '';
  if (lastUserIndex > 0) {
    lastUserAnchor = crypto
      .createHash('sha256')
      .update('u:' + lastUserIndex + '|' + lastUserText)
      .digest('hex')
      .slice(0, 24);
  }
  return {
    output_text: lastAssistantText,
    askuserquestion_fired: askFired,
    gate_turn_index: assistantCount,
    last_user_anchor: lastUserAnchor,
  };
}

// extractAssistantText(content) -- flatten an assistant message's content into text. Content
// is either a plain string or an array of blocks; we concatenate the text blocks. Never throws.
function extractAssistantText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const block of content) {
    if (typeof block === 'string') { parts.push(block); continue; }
    if (block && typeof block === 'object' && typeof block.text === 'string') {
      parts.push(block.text);
    }
  }
  return parts.join('\n');
}

// scanContentForAskUserQuestion(content) -- true if any tool_use block names the
// AskUserQuestion tool. Tolerates string content, a single block, or an array. Never throws.
function scanContentForAskUserQuestion(content) {
  if (!content) return false;
  const blocks = Array.isArray(content) ? content : [content];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const isToolUse = block.type === 'tool_use' || typeof block.name === 'string';
    const name = typeof block.name === 'string' ? block.name : '';
    if (isToolUse && /AskUserQuestion/i.test(name)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// deriveTurnSignals(env) -- normalize the turn signals from the Stop-hook stdin envelope.
//
// BL-01 (the live cure): the REAL Stop-hook stdin delivers a `transcript_path`, NOT the
// normalized fields. So when the envelope carries `transcript_path`, we PARSE the transcript
// (readTranscriptTurn, mirroring scripts/on-stop:33): the last assistant text drives the
// BACKSTOP and an AskUserQuestion tool-use drives askuserquestion_fired.
//
// BACKWARD-COMPAT: if the envelope already carries the normalized signals directly
// (output_text / last_assistant_text / ran_entries / askuserquestion_fired -- the unit-test
// shape), those are used as-is, so the 22 existing predicate assertions stay green.
//
// session_id + last_user_anchor (CR-02) + gate_turn_index (legacy fallback) thread through
// for the WR-01/CR-02 stable retry key. PRIMARY's ran_entries stays read from the envelope (it
// has no transcript source -- the WR-04 deferred note). Tolerant of missing fields; never throws.
// ---------------------------------------------------------------------------
function deriveTurnSignals(env) {
  const e = env && typeof env === 'object' ? env : {};

  // PRIMARY ran-entries: side-channel only (no transcript source -- WR-04 deferred).
  const ranEntries = Array.isArray(e.ran_entries)
    ? e.ran_entries
    : (Array.isArray(e.reached_gate_entries) ? e.reached_gate_entries : []);

  // Direct-field signals (the unit-test / side-channel shape).
  const directText =
    typeof e.output_text === 'string' ? e.output_text
      : (typeof e.last_assistant_text === 'string' ? e.last_assistant_text : null);
  const directAsk =
    e.askuserquestion_fired === true || e.ask_user_question_fired === true;

  // If no direct text was supplied but a transcript_path is present, parse the transcript
  // (the REAL Stop contract). Direct fields take precedence (backward-compat).
  let txn = null;
  if (directText === null && typeof e.transcript_path === 'string') {
    txn = readTranscriptTurn(e.transcript_path);
  }

  const outputText = directText !== null ? directText : (txn ? txn.output_text : '');
  const askFired = directAsk || (txn ? txn.askuserquestion_fired : false);
  const gateTurnIndex = Number.isFinite(e.gate_turn_index)
    ? e.gate_turn_index
    : (txn ? txn.gate_turn_index : 0);
  // CR-02: the transcript-growth-invariant gate anchor. A direct-field envelope may carry
  // last_user_anchor explicitly (test/side-channel shape); otherwise it comes from the parsed
  // transcript's last USER message. This is the gate identity the WR-01/CR-02 retry key prefers
  // over gate_turn_index (which grows with the transcript).
  const lastUserAnchor = typeof e.last_user_anchor === 'string'
    ? e.last_user_anchor
    : (txn ? txn.last_user_anchor : '');

  return {
    ran_entries: ranEntries,
    askuserquestion_fired: askFired,
    output_text: outputText,
    session_id: typeof e.session_id === 'string' ? e.session_id : '',
    gate_turn_index: gateTurnIndex,
    last_user_anchor: lastUserAnchor,
  };
}

// ----- main (Stop-hook entry) -----

function main() {
  const env = readStdinJson();
  const evt = env.hook_event_name || env.hookEventName || process.env.HOOK_EVENT_NAME || null;

  // Only act on the Stop event; any other event is a no-op (defensive: do not block).
  if (evt && evt !== 'Stop') return silentSuccess();

  const registry = loadRegistry();
  const turn = deriveTurnSignals(env);
  const ctxHash = turnContextHash(turn);
  turn.retry_count = readRetryCount(ctxHash);

  const verdict = classifyCardFire(turn, registry);

  if (verdict.degrade === true) {
    // Bounded escape released: log + allow + clear the counter so the next genuinely
    // distinct turn-context starts fresh.
    process.stderr.write(
      '[check-card-fire] bounded escape released after ' + MAX_FORCE_RETRIES +
        ' retries; allowing turn (' + verdict.reason + ')\n'
    );
    clearRetryCount(ctxHash);
    return emitEnvelope(buildEnforcementEnvelope(verdict));
  }

  if (verdict.intercept === true) {
    // Force the card: bump the bounded-escape counter and emit the Stop-block (decision:block-on-exit-0).
    bumpRetryCount(ctxHash);
    return emitEnvelope(buildEnforcementEnvelope(verdict));
  }

  // The card fired (or no gate signal): clear any stale counter and allow.
  clearRetryCount(ctxHash);
  return silentSuccess();
}

module.exports = {
  MAX_FORCE_RETRIES,
  RETRY_TTL_MS,
  classifyCardFire,
  buildEnforcementEnvelope,
  gateReachingEntries,
  turnContextHash,
  deriveTurnSignals,
  readTranscriptTurn,
  pruneRetryStore,
  normalizeRetryEntry,
  loadRegistry,
};

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write('[check-card-fire] uncaught: ' + e.message + '\n');
    silentSuccess();
  }
}
