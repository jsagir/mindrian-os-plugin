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
 * DOCTRINE UPDATE (Phase 209-06, H3): PRIMARY IS LIVE. WR-04 (below, historical record)
 * documented PRIMARY as deferred because no producer of `ran_entries` / `reached_gate_entries`
 * existed. That producer now exists: lib/core/card-fire-sidechannel.cjs (recordReachedGate /
 * readReachedGates), wired at the THREE places that mint a Shape-F gate envelope --
 * lib/hmi/selector-dispatcher.cjs's pickShape trailer door (gated on payload.emitTelemetry
 * === true, Canon Part 8 fs_scope), and scripts/intent-classifier.cjs's engine arm +
 * emitBindingGate (F.8). deriveTurnSignals (below) now reads the side file via
 * readReachedGates(session_id) whenever the envelope does NOT already carry ran_entries /
 * reached_gate_entries directly (direct-field envelopes -- the unit-test shape -- keep
 * PRECEDENCE, so the 22 existing predicate assertions stay byte-identical). The BACKSTOP
 * (transcript ASCII-box text detection) stays SECONDARY PERMANENTLY -- it is the only
 * detector that still works when the side-channel writer itself fails (a missing, corrupt,
 * or oversized side-file all degrade to [] inside readReachedGates, never throwing here).
 *
 * WR-04 (historical, PRE-209-06): "PRIMARY is DEFERRED, not live. PRIMARY keys off a
 * `ran_entries` / `reached_gate_entries` set that records which registry gate-reaching
 * surfaces ran this turn. A Stop-hook transcript yields assistant TEXT (the BACKSTOP
 * signal), NOT a reached-entries SET, and a repo-wide grep finds ZERO producers of
 * `ran_entries` / `reached_gate_entries` outside this file and its tests. So until a
 * side-channel writer exists ... PRIMARY has no live source and stays INERT." -- superseded
 * by the DOCTRINE UPDATE above; retained verbatim for the historical record.
 *
 * Bounded escape (T-179-01 DoS mitigation): a LOCAL retry side-file
 * (~/.mindrian/card-fire-retries.json) keyed by a TRANSCRIPT-GROWTH-INVARIANT turn identity
 * (the Stop stdin session_id + a stable gate identity) counts consecutive intercepts. The
 * gate identity is the GATE-IDENTIFYING CONTENT of the LAST assistant message -- the matched
 * ASCII-box glyph span plus the NORMALIZED option-label token SET (lowercased, prose and
 * whitespace stripped, labels sorted). The key is invariant across BOTH (WR-01) a re-worded
 * re-prompt (the gate signature anchors on the glyph + the option-label SET, not the full
 * message prose) AND (CR-02 / CR-03) a GROWING transcript: the model appends an assistant
 * turn every time it re-emits the blocked gate, so any transcript-LENGTH value (e.g. an
 * assistant-message counter) would mint a fresh key every retry and the bounded escape would
 * NEVER converge -- a production livelock. The gate-content signature stays FIXED across all
 * assistant re-emissions of the same stuck gate, so consecutive intercepts of the SAME gate
 * increment the SAME counter and MAX_FORCE_RETRIES is actually reachable.
 *
 * CR-03 (the root fix this wave ships): the key is anchored on the GATE, never the user
 * message. The prior fix anchored on the LAST USER message, which is EMPTY when the box turn
 * has no preceding role:user record (a compaction type:'summary' lead, OR this codebase's own
 * Phase 114/117 auto-fire-before-the-user-types) -- the empty anchor then fell back to
 * assistantCount (the growing counter) and the bounded escape livelocked again. Anchoring on
 * the gate-identifying content has NO such hole: it is present whenever a gate is detected
 * (the detection IS the gate content), it is growth-invariant, and two genuinely-different
 * gates get genuinely-different counters (WR-07: no cross-gate budget bleed). The
 * assistantCount / gate_turn_index fallback is DELETED from the key derivation entirely; if
 * the gate signature is somehow empty (degenerate), the key falls back to session_id ALONE
 * (coarse but ALWAYS converges -- any consecutive intercept in the session counts up), NEVER
 * to a growing value. A growing value is unreachable as the key.
 *
 * The store is pruned on write by a TTL (WR-02: each entry carries { count, ts }; entries
 * older than RETRY_TTL_MS are evicted, so the side-file cannot grow without bound). At
 * MAX_FORCE_RETRIES the predicate returns degrade=true and the envelope is
 * { continue: true, suppressOutput: true } (log to stderr, allow the turn).
 *
 * CR-04 (the TERMINAL convergence floor -- the session-wide intercept ceiling): the per-gate
 * counter above keys on the gate-identifying CONTENT (gate_signature), which is MODEL-controlled.
 * When the model re-emits the SAME stuck gate with DIFFERENT option labels each retry (the most
 * natural LLM behavior under this interceptor's own "re-emit this turn" re-prompt), the per-gate
 * signature FLAPS to a fresh key every retry, no single per-gate key ever reaches
 * MAX_FORCE_RETRIES, and the bounded escape livelocks forever. ANY key derived from model-emitted
 * content can be flapped; the ONLY identity that cannot be flapped is the SESSION itself. So a
 * SECOND, session-wide counter keyed on session_id ALONE (content-INDEPENDENT, stored at
 * `__session__:<id>` in the same TTL-pruned side-file) is bumped on EVERY intercept, with its own
 * hard ceiling MAX_SESSION_INTERCEPTS (set generously above the per-gate cap so normal multi-gate
 * sessions are unaffected). The predicate degrades if EITHER ceiling is reached. The session
 * ceiling is the load-bearing guarantee: a continuous run of intercepts in ONE session is bounded
 * by MAX_SESSION_INTERCEPTS REGARDLESS of how the gate content / per-gate key flaps. A degrade or
 * a no-intercept Stop turn resets the session counter (the navigator got unstuck).
 *
 * WR-08 (transcript read cap): readTranscriptTurn reads only the LAST TRANSCRIPT_TAIL_BYTES
 * of the transcript file (a pathological multi-hundred-MB transcript cannot stall the 3000ms
 * hook). The detection semantics are unchanged -- the LAST assistant message and the gate
 * signature both live at the tail; a partial leading line after the byte cut is dropped as a
 * malformed JSONL line by the existing per-line try/catch.
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

// Phase 210-05 (item 210-E-1): the shared relevance predicate module. It owns the
// option-label extraction (MOVED out of gateSignature below so there is exactly one
// implementation) plus the two relevance verdicts classifyCardFire consults before
// its final intercept. Pure LOCAL string work, never throws (Part 8).
const gateRelevance = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'gate-relevance.cjs'));

// data/render-coverage-registry.json is the Phase 178 R15 substrate. The interceptor
// keys PRIMARY detection off its card-emission entries; it does NOT hand-maintain a
// parallel gate list.
const REGISTRY_PATH = path.join(PLUGIN_ROOT, 'data', 'render-coverage-registry.json');

// The LOCAL retry side-file for the bounded escape (Part 8 LOCAL-only).
function retryFilePath() {
  const home = process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian');
  return path.join(home, 'card-fire-retries.json');
}

// CR-07: the LOCAL append-only diagnostic log path. Resolved the SAME way as
// retryFilePath (MINDRIAN_HOME override honored) so a test / ops re-point isolates both
// files identically. Part 8 LOCAL-only: this file is written to local disk (~/.mindrian),
// never to the Brain and never over any network wire.
function interceptLogPath() {
  const home = process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian');
  return path.join(home, 'card-fire-intercepts.log');
}

// The bounded-escape ceiling (named constant). After this many consecutive intercepts
// on the same turn-context (the per-gate key), degrade to log + allow so a card-incapable
// surface cannot trap the navigator. This is the per-gate counter: it gives good UX (each
// genuinely-distinct gate gets forced up to N times before we give up on it).
const MAX_FORCE_RETRIES = 3;

// CR-04 (the TERMINAL convergence floor): the SESSION-WIDE intercept ceiling. The per-gate
// counter above keys on the gate-identifying CONTENT (gate_signature), which is MODEL-
// CONTROLLED: when the model re-emits the SAME stuck gate with DIFFERENT option labels each
// retry (the single most natural LLM behavior under this interceptor's own "re-emit this
// turn" re-prompt), the per-gate signature FLAPS to a fresh key every retry, no single per-
// gate key ever reaches MAX_FORCE_RETRIES, and the bounded escape LIVELOCKS forever. ANY key
// derived from model-emitted content can be flapped; the ONLY identity that cannot be flapped
// is the SESSION itself. So we add a second, session-wide counter keyed on session_id ALONE
// (content-INDEPENDENT, un-flappable) with its own hard ceiling. On each intercept we bump
// BOTH counters and degrade if EITHER ceiling is reached. The session ceiling is the load-
// bearing guarantee: an unbroken run of intercepts in ONE session is bounded by
// MAX_SESSION_INTERCEPTS REGARDLESS of how the gate content / per-gate key flaps.
//
// It is set GENEROUSLY above the per-gate cap (4x MAX_FORCE_RETRIES, well above 2x) so that
// a normal multi-gate session is unaffected: the per-gate degrade fires first for each
// genuinely-distinct gate (WR-07's two-distinct-gates case degrades per-gate long before the
// session total reaches 12), and ONLY a flapping single-gate livelock -- which the per-gate
// counter cannot catch -- is bounded by this ceiling.
const MAX_SESSION_INTERCEPTS = 12;

// The session-counter key prefix in the shared side-file. A session entry lives at
// `__session__:<session_id>` alongside the per-gate `<ctxHash>` entries; both are { count, ts }
// shaped and both are TTL-pruned identically (WR-02), so the side-file still cannot grow
// without bound. The `__session__:` prefix cannot collide with a per-gate ctxHash (a 16-hex
// sha256 slice never starts with `__session__:`).
const SESSION_KEY_PREFIX = '__session__:';

// WR-02: the retry side-file TTL. Each store entry carries { count, ts }; on every write
// entries older than this are evicted, so the LOCAL ~/.mindrian/card-fire-retries.json
// cannot grow without bound over a long-lived install. 24h is generous: a stuck gate
// resolves within one turn; an abandoned key is dead long before a day passes.
const RETRY_TTL_MS = 24 * 60 * 60 * 1000;

// CR-07 (the LOCAL intercept diagnostic log -- backstop-benign-list-defeats-relevance-gate
// item 2b, feeding live-session-running-stale-plugin-cache-fixes-inert's still-open
// "unexplained backstop trigger" mystery). The truncation cap for output_text written to
// the log per record, so a pathological turn cannot bloat one log line. TTL-pruned by the
// SAME RETRY_TTL_MS as the retry side-file (WR-02) so it cannot grow without bound.
const INTERCEPT_LOG_TEXT_CAP = 4000;

// WR-08: the transcript-read tail cap. readTranscriptTurn reads at most the LAST this-many
// bytes of the transcript file so a pathological multi-hundred-MB Stop transcript cannot
// stall the 3000ms hook. Detection semantics are unchanged: the LAST assistant message and
// its gate signature both live at the tail. 2 MiB comfortably holds many recent turns; a
// partial leading line introduced by the byte cut is dropped by the per-line JSON try/catch.
const TRANSCRIPT_TAIL_BYTES = 2 * 1024 * 1024;

// The ASCII-box gate glyphs / literal anti-pattern the BACKSTOP scans for. A reached
// gate that renders as flat text instead of firing the card carries these.
//
// Phase 209-07 (H1): tuned after H3 PRIMARY (209-06) went live, per the LOCKED wave
// order (tune the floor only once the native path validates which branches still
// fire). Four alternatives:
//   1. Same-line labeled box: `[1] ... [2] ...` (unchanged from Wave 1).
//   2. The literal `type 1, 2, or 3` exemplar (unchanged from Wave 1).
//   3. Multiline labeled box: `[1] ...\n...\n[2] ...` (NEW -- verdict 25's exact
//      false-negative shape: a gate whose options wrap onto separate lines).
//   4. Numbered-prose gate: a line-anchored `1. <option>` followed by `2. <option>`
//      within a 3-line span (NEW -- the incident's "hand-rolled numbered list
//      instead of a card" shape). `(?:^|\n)` substitutes for per-line anchoring
//      without an `m` flag, so this alternative matches anywhere inside a larger
//      message, not only at the string's absolute start.
// The bare U+25A0 alternative is DELETED: a lone U+25A0 in a status/dial row with
// no option structure is SANCTIONED plugin UI vocabulary (selector-dispatcher.cjs:256,
// ui-system SKILL.md:131, dial-presenter.cjs:134) and must never intercept a turn on
// its own. A U+25A0 appearing WITHIN one of the four gate-shaped alternatives above
// still counts (it is part of the matched gate content, not a bare occurrence).
const ASCII_BOX_GLYPH_RE =
  /\[\s*1\s*\]\s*.*\[\s*2\s*\]|type\s+1\s*,\s*2\s*,\s*or\s+3|\[\s*1\s*\][^\n]*\n[\s\S]*?\[\s*2\s*\]|(?:^|\n)\s{0,3}1[.)]\s+\S[^\n]*\n(?:[^\n]*\n)?\s{0,3}2[.)]\s+\S/i;

// backstop-numbered-prose-retired (card-fire-relevance-check-gap, navigator decision
// 2026-07-17 "widen scope: fix both mechanisms"): ASCII_BOX_GLYPH_RE above stays
// BYTE-IDENTICAL (the retry-key signature in gateSignature and the Phase 209 regex-matrix
// tests both depend on it verbatim). The BACKSTOP intercept now keys on ONE tier only:
//   - UNCONDITIONAL (alternatives 1-3: same-line bracket box, the "type 1, 2, or 3"
//     literal, the multiline bracket box). These are shape-specific enough that ordinary
//     prose practically never renders them by accident, so a match alone is a backstop hit.
// The Phase 209-07 bare numbered-prose alternative (formerly ASCII_BOX_NUMBERED_PROSE_RE,
// gated by GATE_FRAMING_RE within GATE_FRAMING_WINDOW) is RETIRED. Live evidence -- the 7
// real backstop fires in ~/.mindrian/card-fire-intercepts.log -- showed the framing
// co-requirement could not separate the ONE genuine fork (cfec3113, "Two honest paths --
// pick one: build vs file") from the SIX false positives, an ~86% false-positive net: pairs
// of clarifying questions, informational step lists, and even a disclaimer that literally
// said "NOT options to pick between" all tripped the bare `?`/verb cue, and two fires
// carried the cue INSIDE unrelated content (a Neo4j tool description reading "silently pick
// the single best match"). A `1. ... 2. ...` list is the exact shape of a benign Action
// Footer, a step-by-step explanation, or a set of caveats, and a shape-plus-nearby-cue proxy
// provably cannot tell those from a genuine fork. Catching a genuine numbered-prose fork is
// now the MODEL's own Phase-210 / SEED-021 judgment responsibility (its system prompt
// already mandates firing AskUserQuestion for a real decision fork); the flat-text safety net
// is deliberately removed because it did more harm than good. A genuine gate rendered as a
// real `[1]...[2]` bracket box is still caught by arms 1-3.
const ASCII_BOX_UNCONDITIONAL_RE =
  /\[\s*1\s*\]\s*.*\[\s*2\s*\]|type\s+1\s*,\s*2\s*,\s*or\s+3|\[\s*1\s*\][^\n]*\n[\s\S]*?\[\s*2\s*\]/i;

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
// gateSignature(outputText) -- a STABLE structural signature of the GATE-IDENTIFYING content
// of an assistant message: the matched ASCII-box glyph span plus the NORMALIZED option-label
// token SET. This is the CR-03 / WR-07 root anchor: it is present whenever a gate is detected
// (the detection IS this content), it is INVARIANT across transcript growth and surrounding
// prose re-wording, and two genuinely-different gates produce genuinely-different signatures.
//
// Normalization (WR-01 robustness): re-wording the PROSE between retries must not change the
// signature, so we anchor ONLY on (a) the matched glyph span (the literal anti-pattern the
// BACKSTOP fires on) and (b) the option labels as a lowercased, prose/whitespace-stripped,
// SORTED token set. The labels are the `[1] foo`, `[2] bar` option bodies; we take the label
// TEXT after each `[n]` marker, normalize it, and sort the resulting set so option re-ordering
// does not flap the key.
//
// CR-04 (corrected -- this comment previously claimed the empty-only session-alone floor bounds
// the flap; it does NOT, and that false claim is DELETED). If the model MATERIALLY changes the
// option labels each retry, this per-gate signature DOES flap to a fresh key every retry, and
// the EMPTY-only degenerate floor in turnContextHash (which fires only when BOTH glyph span and
// labels are empty) provably NEVER catches a flapping NON-empty signature. The flap is bounded
// instead by the SESSION-WIDE intercept ceiling (MAX_SESSION_INTERCEPTS, applied in main): the
// session counter is keyed on session_id ALONE and is content-INDEPENDENT, so it climbs to its
// ceiling regardless of how this per-gate signature flaps, and degrades the run. The per-gate
// signature stays the GOOD-UX granularity for the common stable case (each genuinely-distinct
// gate gets its own per-gate budget); the session ceiling is the un-flappable convergence floor
// behind it.
//
// Returns '' (degenerate) when no gate content is recoverable; turnContextHash then falls back
// to session_id ALONE -- NEVER to a growing value. Part 8: pure local string work; the result
// feeds a local sha256 and never egresses.
// ---------------------------------------------------------------------------
function gateSignature(outputText) {
  const text = typeof outputText === 'string' ? outputText : '';
  if (!text) return '';
  // (a) the matched glyph span -- the literal anti-pattern the BACKSTOP fired on. We normalize
  //     the matched substring (lowercased, whitespace collapsed) so trivial spacing churn does
  //     not move the key. A non-glyph caller (no match) contributes ''.
  const glyphMatch = text.match(ASCII_BOX_GLYPH_RE);
  const glyphSpan = glyphMatch
    ? glyphMatch[0].toLowerCase().replace(/\s+/g, ' ').trim()
    : '';
  // (b) the option-label token SET. Pull the label TEXT after each `[n]` (or `n)` / `n.`)
  //     option marker, normalize each (lowercased, non-alphanumeric stripped), drop empties,
  //     dedupe, and SORT so option re-ordering does not flap the signature.
  //     Phase 210-05: the extraction itself (the OPTION_LABEL_RE loop, including its
  //     load-bearing whitespace-separator requirement) MOVED verbatim to
  //     lib/core/gate-relevance.cjs::extractOptionLabels so the retry-key signature and
  //     the relevance predicate share exactly ONE implementation. Same regex, same
  //     normalization, same encounter-order dedupe -- the signature output is
  //     byte-equivalent across the move, so retry keys do not change.
  const labelSet = gateRelevance.extractOptionLabels(text);
  labelSet.sort();
  const sig = 'glyph:' + glyphSpan + '|labels:' + labelSet.join(',');
  // Degenerate: no glyph span AND no labels recovered -> '' so the key floors to session alone.
  if (!glyphSpan && labelSet.length === 0) return '';
  return crypto.createHash('sha256').update(sig).digest('hex').slice(0, 24);
}

// ---------------------------------------------------------------------------
// turnContextHash(turn) -- a STABLE LOCAL key for the bounded-escape retry counter.
//
// WR-01 + CR-02 + CR-03: the key MUST be stable across re-PROMPTS on the SAME stuck gate, or
// MAX_FORCE_RETRIES is never reachable. There are ways the key can drift, and each is fatal to
// convergence:
//   - WR-01 (re-worded prose): the model re-emits the same gate with different PROSE, so an
//     output_text-derived key would mint a fresh key every retry.
//   - CR-02 / CR-03 (transcript GROWTH): on the LIVE BACKSTOP path the model APPENDS one
//     assistant turn every time the interceptor blocks and it re-emits, so ANY
//     transcript-LENGTH-derived identity (an assistant-message counter, OR a last-USER-message
//     anchor that is EMPTY on a no-role:user transcript and falls back to that counter) mints a
//     fresh key every retry -- a production livelock.
// ROOT FIX: anchor the gate identity on the GATE-IDENTIFYING CONTENT itself (gate_signature):
//   - session_id     : the Stop stdin session_id (the same conversation across retries).
//   - gate identity (in precedence order, each transcript-growth-INVARIANT):
//       1. the reached-gate entry SET when present (PRIMARY signal -- deferred, no producer).
//       2. the GATE SIGNATURE (gate_signature): the matched glyph span + normalized option-label
//          SET of the LAST assistant message. Present whenever a gate is detected, invariant
//          across transcript growth and prose re-wording, per-gate (two different gates ->
//          different signatures -> different counters; WR-07).
//   DEGENERATE FLOOR: if BOTH are empty, the key is session_id ALONE -- coarse but ALWAYS
//   converges. NEVER the output text (WR-01), NEVER assistantCount / gate_turn_index / any
//   transcript-length value (CR-02 / CR-03). A growing value is UNREACHABLE as the key.
// Part 8: a local sha256 over local stable identity scalars; never egresses.
// ---------------------------------------------------------------------------
function turnContextHash(turn) {
  const t = turn && typeof turn === 'object' ? turn : {};
  const session = typeof t.session_id === 'string' ? t.session_id : '';
  // Gate identity, in precedence order. Each candidate is invariant across BOTH a re-worded
  // re-prompt (WR-01) AND a growing transcript (CR-02 / CR-03).
  const ran = Array.isArray(t.ran_entries) && t.ran_entries.length > 0
    ? t.ran_entries.slice().sort().join('|')
    : '';
  // gate_signature: the transcript-growth-INVARIANT, per-gate identity for the LIVE BACKSTOP
  // path (CR-03 / WR-07 root anchor). It is derived from the GATE CONTENT, never the user
  // message and never a transcript-length counter, so the no-role:user path has no livelock
  // hole and distinct gates never share a counter.
  const gateSig = typeof t.gate_signature === 'string' ? t.gate_signature : '';
  const gateIdentity = ran || gateSig;
  // DEGENERATE FLOOR (gateIdentity empty): key on session_id ALONE. This always converges (any
  // consecutive intercept in the session increments the same counter). It is NEVER a growing
  // value -- the assistantCount / gate_turn_index fallback is DELETED.
  return crypto
    .createHash('sha256')
    .update('s:' + session + '|g:' + gateIdentity)
    .digest('hex')
    .slice(0, 16);
}

// ---------------------------------------------------------------------------
// computeBackstopHit(outputText) -- the BACKSTOP signal. A hit ONLY on the shape-specific
// alternatives 1-3 (ASCII_BOX_UNCONDITIONAL_RE: same-line bracket box, the "type 1, 2, or 3"
// literal, the multiline bracket box). The Phase 209-07 bare numbered-prose alternative is
// RETIRED (see the retirement note above ASCII_BOX_UNCONDITIONAL_RE): it was an ~86%
// false-positive net in the live log, and a shape-plus-nearby-cue proxy cannot separate a
// benign numbered list from a genuine fork. A real numbered-prose fork is now the model's own
// Phase-210 / SEED-021 judgment. Pure LOCAL string work; never throws.
// ---------------------------------------------------------------------------
function computeBackstopHit(outputText) {
  const text = typeof outputText === 'string' ? outputText : '';
  if (!text) return false;
  // Arms 1-3 only: a literal `[1] ... [2]` bracket box or the "type 1, 2, or 3" literal.
  // Numbered-prose shape alone no longer counts (retired -- model judgment owns the fork).
  return ASCII_BOX_UNCONDITIONAL_RE.test(text);
}

// ---------------------------------------------------------------------------
// matchedGlyphSpan(outputText) -- CR-07 diagnostic helper: return the ACTUAL text of the
// ASCII_BOX_GLYPH_RE match (not just a boolean), so the LOCAL intercept log records exactly
// which glyph span tripped the scan. '' when nothing matched. Never throws. Part 8: pure
// local string work; the span is written only to the local diagnostic log, never egressed.
// ---------------------------------------------------------------------------
function matchedGlyphSpan(outputText) {
  const text = typeof outputText === 'string' ? outputText : '';
  if (!text) return '';
  const mm = text.match(ASCII_BOX_GLYPH_RE);
  return mm ? mm[0] : '';
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
//     retry_count?: number, session_count?: number }
//
// Bounded escape (CR-04): degrade when EITHER ceiling is reached --
//   - retry_count   >= MAX_FORCE_RETRIES     (the per-gate counter; good UX, per-gate granularity)
//   - session_count >= MAX_SESSION_INTERCEPTS (the SESSION-wide ceiling; the content-INDEPENDENT,
//                                              un-flappable convergence floor that catches a
//                                              flapping per-gate key the per-gate counter cannot).
// The session ceiling is the load-bearing guarantee: an unbroken run of intercepts in ONE
// session cannot exceed MAX_SESSION_INTERCEPTS regardless of how the gate content / per-gate key
// flaps. Both ceilings are checked; the session ceiling is reported distinctly so the degrade
// reason names WHICH floor fired.
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
    // the literal anti-pattern even for an off-registry surface. CR-05: a bare
    // numbered-prose list (alternative 4) is a hit ONLY when it carries a choice-framing
    // cue nearby, so a benign Action Footer / step-by-step list no longer force-fires.
    const backstopHit = computeBackstopHit(outputText);

    if (!primaryHit && !backstopHit) {
      // No gate-reaching signal on this turn -> zero forced cards (ordinary turn).
      return { intercept: false, reason: 'no-gate-signal', degrade: false };
    }

    // A reached gate with no fired card is a candidate intercept. Apply the bounded escape:
    // degrade if EITHER the per-gate counter OR the SESSION-wide counter has hit its ceiling.
    const sessionCount = Number.isFinite(t.session_count) ? t.session_count : 0;
    if (sessionCount >= MAX_SESSION_INTERCEPTS) {
      // The CR-04 convergence floor: the session ceiling catches a flapping per-gate key that
      // the per-gate counter never reaches. Content-INDEPENDENT, so it ALWAYS converges.
      return {
        intercept: false,
        degrade: true,
        reason: 'session-intercept-ceiling-reached-after-' + MAX_SESSION_INTERCEPTS + '-intercepts',
      };
    }

    const retryCount = Number.isFinite(t.retry_count) ? t.retry_count : 0;
    if (retryCount >= MAX_FORCE_RETRIES) {
      return {
        intercept: false,
        degrade: true,
        reason: 'bounded-escape-released-after-' + MAX_FORCE_RETRIES + '-retries',
      };
    }

    // Phase 210-05 (item 210-E-1): the RELEVANCE GATE, inserted between the bounded
    // escape above and the final intercept below. Two NARROW pass reasons only:
    //   - 'gate-already-answered'  : the preceding user turn already plainly answered
    //     the gate (the 2026-07-02 live incident: a plain-text "yes" to the question
    //     the gate would re-ask).
    //   - 'gate-irrelevant-to-turn': the gate's subject matter has ZERO token overlap
    //     with the current conversation (the stale-artifact pattern).
    // Empty/uncertain user text takes NEITHER pass (the conservative verdict inside
    // gate-relevance.cjs) and falls through to the existing intercept -- the Phase 209
    // guarantee (a genuine, relevant, unanswered fork still force-fires) is preserved.
    // CR-03: preceding_user_text feeds ONLY this verdict, never the retry key.
    //
    // 2026-07-05 relevance-gate PRIMARY-path fix (kept): gateAlreadyAnswered's gateLabels
    // (derived from outputText) is UNTOUCHED below -- only the relevance comparison's second
    // argument (the gate subject) is path-specific. WHY: on the PRIMARY path, outputText is
    // the CURRENT TURN's assistant reply, and the model naturally echoes the user's current
    // topic back when answering it -- so comparing precedingUserText against outputText almost
    // always looked "relevant" no matter what the stale reach was actually about (it compared
    // the user's turn against the assistant's OWN reply, never against the reach's real
    // subject).
    //
    // card-fire-relevance-check-gap (2026-07-17) PRIMARY-path gate-existence guard: a PRIMARY
    // hit means a registry gate-reaching surface (lib/hmi/selector-dispatcher.cjs) appears in
    // ran_entries -- but the side-channel's NO_SESSION_KEY union + ~10-min TTL bleeds ONE real
    // gate-mint into EVERY turn's ran_entries for the next ten minutes across all sessions (the
    // live log shows 10 consecutive false fires on status / "building" / "boot the real one"
    // turns spanning ~21 min and 4 session_ids). So ran_entries alone is NOT proof a gate was
    // reached THIS turn. Require CONFIRMED gate-existence: a non-empty reach-recorded subject
    // (t.gate_subject_text -- the gate's own recorded content from the side-channel). With no
    // subject there is no gate this turn -> 'primary-gate-existence-unconfirmed', no intercept.
    // Relevance on the primary path compares the preceding user turn against the reach's OWN
    // recorded subject ONLY, never the outputText fallback (which compares the user turn against
    // the assistant's own reply and almost always reads "relevant" -- the exact defect this
    // closes). This guard is PRIMARY-only; the BACKSTOP path carries its gate content in
    // outputText and keeps the outputText fallback below.
    const precedingUserText = typeof t.preceding_user_text === 'string'
      ? t.preceding_user_text
      : '';
    if (primaryHit && !backstopHit) {
      const primarySubject = (typeof t.gate_subject_text === 'string' && t.gate_subject_text)
        ? t.gate_subject_text
        : '';
      if (!primarySubject) {
        return { intercept: false, reason: 'primary-gate-existence-unconfirmed', degrade: false };
      }
      // card-fire-over-enforcement (2026-07-20) fix (B): a STALE side-channel
      // gate (bled forward by the file TTL) plus a low-signal terse turn is the
      // dominant over-enforcement class. Pass the gate's staleness so the
      // low-signal relevance branch stops defaulting to force. A FRESH gate
      // (gate_is_fresh !== false) keeps the conservative force floor unchanged.
      if (!gateRelevance.gateTopicallyRelevant(precedingUserText, primarySubject,
          { gateStale: t.gate_is_fresh === false })) {
        return { intercept: false, reason: 'gate-irrelevant-to-turn', degrade: false };
      }
    }
    const gateLabels = gateRelevance.extractOptionLabels(outputText);
    if (gateRelevance.gateAlreadyAnswered(precedingUserText, gateLabels)) {
      return { intercept: false, reason: 'gate-already-answered', degrade: false };
    }
    if (!(primaryHit && !backstopHit)) {
      // BACKSTOP path: outputText legitimately IS the gate content, so the fallback to
      // outputText is preserved here (and ONLY here).
      const gateSubjectText = (typeof t.gate_subject_text === 'string' && t.gate_subject_text)
        ? t.gate_subject_text
        : outputText;
      // BACKSTOP path: the gate content is THIS turn's own output_text, so the
      // gate is always fresh here -- gateStale:false preserves the WR-06 floor
      // (a terse turn against a freshly rendered box still force-fires).
      if (!gateRelevance.gateTopicallyRelevant(precedingUserText, gateSubjectText,
          { gateStale: false })) {
        return { intercept: false, reason: 'gate-irrelevant-to-turn', degrade: false };
      }
    }

    // Navigator decision (2026-07-05): a plain 2-option yes/no closer is a SIMPLE
    // BINARY, not a genuine multi-option Decision Gate, and is EXEMPT from the
    // card-fire requirement -- only genuine 3+-option forks force-fire. This pass-
    // reason sits AFTER the two relevance checks on purpose: placing it before
    // gate-already-answered would relabel an already-answered 2-option gate (the
    // relevance test's RELEASE_GATE is also 2-option) as gate-is-simple-binary and
    // change that pass-reason's precedence. Reuse the gateLabels already extracted
    // above (per the RCA: no new option-extraction path).
    //
    // intern-w1-card-discipline-decay (2026-07-11): the original condition was a
    // BARE `gateLabels.length === 2` cardinality check, which cannot distinguish a
    // trivial yes/no confirmation closer ("Want those?") from a genuine two-way
    // FORCED-CHOICE strategic fork ("run research vs build the plan" / "build the
    // plan now vs file evidence first"). All 3 of an intern's missed forks in one
    // QA session carried exactly 2 option labels and were swallowed by this
    // exemption regardless of content. Fixed by requiring the labels to be
    // YES/NO-SHAPED (gateRelevance.isYesNoShapedGate -- the SAME semantic test
    // gateAlreadyAnswered already uses for its own 2-option yes/no answer-matching,
    // reused here per Part 7 rather than re-implemented), not merely 2-in-number.
    // A genuine 2-option fork whose labels are NOT yes/no-shaped now falls through
    // to the final intercept below and force-fires, exactly like a 3+-way fork; a
    // real yes/no closer stays exempt.
    if (gateRelevance.isYesNoShapedGate(gateLabels)) {
      return { intercept: false, reason: 'gate-is-simple-binary', degrade: false };
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
//   - intercept-> the decision:block-on-exit-0 block: { decision:'block', ..., systemMessage,
//                 hookSpecificOutput: { additionalContext: <re-prompt to fire the card> } }.
//   - neither  -> { continue: true, suppressOutput: true } (nothing to do).
// additionalContext lives ONLY inside hookSpecificOutput. Returns a key-filtered
// envelope. Never throws.
//
// CR-06 (2026-07-11, backstop-benign-list-defeats-relevance-gate reopen of
// card-fire-block-surface Finding 1): the ORIGINAL fix added a systemMessage on the
// premise that Claude Code surfaces `reason` as "Stop hook error: <reason>" ONLY when no
// systemMessage override is present. Live observation (v1.15.3-beta.12) proved that premise
// FALSE -- Claude Code renders "Stop hook error: <reason>" REGARDLESS of systemMessage, so
// the internal slug (e.g. ascii-box-backstop-no-card) still reached the user looking like a
// crash. The only lever left is the `reason` CONTENT itself: on BOTH the intercept branch
// and the degrade branch it is now a calm, human-safe phrase, never the internal slug. The
// slug is PRESERVED for telemetry in the LOCAL intercept log (appendInterceptLog), not
// deleted. systemMessage stays on the intercept branch and hookSpecificOutput.additionalContext
// is untouched. The else branch keeps suppressOutput: true and carries no systemMessage.
// ---------------------------------------------------------------------------
function buildEnforcementEnvelope(verdict) {
  const v = verdict && typeof verdict === 'object' ? verdict : {};

  let raw;
  if (v.degrade === true) {
    raw = {
      continue: true,
      suppressOutput: true,
      // CR-06: calm, human-safe `reason` (never the internal slug). Claude Code surfaces
      // `reason` as "Stop hook error: <reason>" regardless of systemMessage, so the slug
      // must not live here. It is preserved for telemetry in the LOCAL intercept log.
      reason: 'continuing this turn',
    };
  } else if (v.intercept === true) {
    raw = {
      decision: 'block',
      // CR-06: calm, human-safe `reason` (never the internal slug -- see the branch note
      // above). The slug is preserved for telemetry in the LOCAL intercept log instead.
      reason: 'rendering your choices as a selectable card',
      // FIXED human-facing line (never interpolated from transcript content or the reason
      // slug; T-m9g-01). Retained from the original Finding 1 fix as the second calm surface.
      systemMessage: 'Re-rendering your choices as a selectable card...',
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

// ---------------------------------------------------------------------------
// CR-04 SESSION-WIDE intercept ceiling -- the content-INDEPENDENT convergence floor.
//
// sessionKey(sessionId) / readSessionCount(sessionId) / bumpSessionCount(sessionId) /
// clearSessionCount(sessionId) -- the session counter lives in the SAME side-file as the per-
// gate entries, at `__session__:<sessionId>`, { count, ts } shaped, TTL-pruned identically
// (WR-02). It is keyed on the OPAQUE session_id ALONE (no model-emitted content), so it cannot
// be flapped: a continuous run of intercepts in ONE session climbs the SAME session counter
// REGARDLESS of how the per-gate signature moves, and MAX_SESSION_INTERCEPTS hard-bounds it.
//
// Part 8: session_id is an opaque conversation identifier (not user content / not artifact
// text). The key is `__session__:<opaque-id>`; the value is a scalar count + timestamp. No raw
// text egress; the side-file is LOCAL (~/.mindrian) only. Best-effort like the per-gate helpers.
// ---------------------------------------------------------------------------
function sessionKey(sessionId) {
  const s = typeof sessionId === 'string' ? sessionId : '';
  return SESSION_KEY_PREFIX + s;
}

function readSessionCount(sessionId) {
  const store = readRetryStore();
  const e = normalizeRetryEntry(store[sessionKey(sessionId)], Date.now());
  return e ? e.count : 0;
}

function bumpSessionCount(sessionId) {
  const store = readRetryStore();
  const now = Date.now();
  const key = sessionKey(sessionId);
  const e = normalizeRetryEntry(store[key], now);
  const next = (e ? e.count : 0) + 1;
  store[key] = { count: next, ts: now };
  writeRetryStore(store);
  return next;
}

function clearSessionCount(sessionId) {
  const store = readRetryStore();
  const key = sessionKey(sessionId);
  if (key in store) {
    delete store[key];
    writeRetryStore(store);
  }
}

// ---------------------------------------------------------------------------
// CR-07 -- the LOCAL append-only intercept diagnostic log. Written whenever
// classifyCardFire returns intercept:true OR degrade:true, so the NEXT occurrence of the
// still-unexplained backstop trigger (live-session-running-stale-plugin-cache-fixes-inert)
// is a one-log-read diagnosis instead of a multi-hour forensic reconstruction. Each record
// preserves the ORIGINAL classification slug (verdict.reason) even though the user-facing
// envelope `reason` is now a calm phrase (CR-06), so telemetry survives the calming.
//
// TTL-pruned on every write by the SAME RETRY_TTL_MS the retry side-file uses (WR-02), so
// the JSONL cannot grow without bound. Best-effort like the retry helpers: any error is
// swallowed -- a diagnostic log write must NEVER block or throw the Stop hook.
//
// Part 8 (Graph Boundary): LOCAL-only. The record (including the truncated output_text,
// an untrusted model turn already on local disk in the transcript) is written to
// ~/.mindrian on local disk, never to the Brain and never over any network wire.
// ---------------------------------------------------------------------------
function readInterceptLogLines(fp, now) {
  const out = [];
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const lines = raw.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let obj;
      try { obj = JSON.parse(trimmed); } catch (_e) { continue; }
      // TTL-prune: keep only records younger than RETRY_TTL_MS (WR-02 parity).
      if (obj && Number.isFinite(obj.ts) && (now - obj.ts) <= RETRY_TTL_MS) {
        out.push(trimmed);
      }
    }
  } catch (_e) {
    /* missing / unreadable -> fresh log */
  }
  return out;
}

function appendInterceptLog(turn, verdict) {
  try {
    const t = turn && typeof turn === 'object' ? turn : {};
    const v = verdict && typeof verdict === 'object' ? verdict : {};
    const now = Date.now();
    const outputText = typeof t.output_text === 'string' ? t.output_text : '';
    const record = {
      ts: now,
      timestamp: new Date(now).toISOString(),
      session_id: typeof t.session_id === 'string' ? t.session_id : '',
      // The ORIGINAL classification slug -- preserved here even though the user-facing
      // envelope `reason` changes to a calm phrase (CR-06). This is the telemetry sink.
      reason: typeof v.reason === 'string' ? v.reason : '',
      gate_signature: typeof t.gate_signature === 'string' ? t.gate_signature : '',
      ran_entries: Array.isArray(t.ran_entries) ? t.ran_entries : [],
      matched_glyph_span: matchedGlyphSpan(outputText),
      output_text: outputText.slice(0, INTERCEPT_LOG_TEXT_CAP),
    };
    const fp = interceptLogPath();
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    const kept = readInterceptLogLines(fp, now);
    kept.push(JSON.stringify(record));
    fs.writeFileSync(fp, kept.join('\n') + '\n', 'utf8');
  } catch (_e) {
    /* best-effort; never block the hook on a diagnostic-log write */
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
//   - gate_signature       : the CR-03 / WR-07 transcript-growth-INVARIANT gate identity -- a
//                            sha256 over the GATE-IDENTIFYING content of the LAST assistant
//                            message (the matched glyph span + normalized option-label SET).
//                            Anchored on the GATE, never the user message and never an assistant
//                            counter, so the no-role:user path has no livelock hole (CR-03) and
//                            two distinct gates get distinct counters (WR-07).
// WR-08 (read cap): only the LAST TRANSCRIPT_TAIL_BYTES of the file are read, so a pathological
// multi-hundred-MB transcript cannot stall the 3000ms hook. The LAST assistant message and its
// gate signature live at the tail; a partial leading line from the byte cut is dropped by the
// per-line JSON try/catch -- detection semantics unchanged.
// Defensive (Part 8 / on-stop discipline): a missing / unreadable / malformed transcript
// returns empty signals; NEVER throws. The transcript content stays LOCAL -- read, scanned,
// discarded; never egressed (gate_signature is a sha256 hash, not the message text itself).
// ---------------------------------------------------------------------------
function readTranscriptTurn(transcriptPath) {
  const empty = {
    output_text: '',
    askuserquestion_fired: false,
    gate_signature: '',
    preceding_user_text: '',
  };
  if (typeof transcriptPath !== 'string' || !transcriptPath.trim()) return empty;
  const raw = readTranscriptTail(transcriptPath);
  if (raw === null) return empty;
  let lastAssistantText = '';
  // WR-06 (Phase 209-07, H2 widened): askFired is now an OR across every assistant
  // message of the CURRENT TURN (since the last role:user record), not the LAST
  // assistant message alone. The original Wave-1 fix (LAST-message-only) closed the
  // whole-transcript cross-turn bleed but over-corrected: a turn where the card
  // fires in an earlier assistant message and a LATER assistant message in the SAME
  // turn happens to carry gate-shaped text (e.g. a recap) would classify as no-card.
  // currentTurnAssistantContents collects every assistant message's content since
  // the last user boundary and RESETS on each role:user record, so:
  //   - fired-then-glyph within one turn -> askFired true (the fix).
  //   - a stale card from turn N does NOT mask a no-card box in turn N+1 (the
  //     original WR-06 cross-turn bleed stays fixed -- a user record resets the
  //     window).
  // CR-03 INVARIANT (unchanged, restated): user messages bound the WINDOW only.
  // They are NEVER folded into gate_signature or turnContextHash -- the retry key
  // is anchored on gate-identifying CONTENT alone (below), never on message counts
  // or user-message presence/absence. A transcript with no role:user record (a
  // compaction summary lead, or an auto-fire-before-the-user-types flow) is simply
  // ONE window spanning the whole tail (the degenerate case: the reset never fires,
  // so all assistant messages accumulate) -- this is intentional, not a gap.
  let currentTurnAssistantContents = [];
  // Phase 210-05 (item 210-E-1): capture the LAST role:user record's text so the
  // relevance predicate can see the preceding user turn. Per the CR-03 invariant
  // (restated above) this text feeds ONLY the relevance verdict in classifyCardFire;
  // it is NEVER folded into gate_signature or turnContextHash.
  let lastPrecedingUserText = '';
  const lines = raw.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch (_e) {
      continue; // skip a malformed line, never throw (also drops the WR-08 partial head line)
    }
    if (!obj || typeof obj !== 'object') continue;
    const msg = obj.message && typeof obj.message === 'object' ? obj.message : obj;
    const role = msg.role || obj.type;
    if (role === 'user') {
      // A user record resets the CURRENT-TURN window (T-209-29): a card fired in a
      // PRIOR turn must never mask a no-card box in the NEXT turn. It is NEVER part
      // of the retry key (CR-03 above). Phase 210-05 adds ONE more use: the LAST
      // user record's text is captured for the relevance verdict (and ONLY that
      // verdict -- never the signature, never the hash).
      const userContent = (msg.content !== undefined && msg.content !== null)
        ? msg.content
        : (obj.content !== undefined ? obj.content : null);
      lastPrecedingUserText = extractAssistantText(userContent);
      currentTurnAssistantContents = [];
      continue;
    }
    if (role === 'assistant') {
      const text = extractAssistantText(msg.content);
      if (text) lastAssistantText = text;
      // Prefer the message.content; fall back to a top-level obj.content only when
      // this same record carries it (no cross-record bleed).
      const content = (msg.content !== undefined && msg.content !== null)
        ? msg.content
        : (obj.content !== undefined ? obj.content : null);
      currentTurnAssistantContents.push(content);
    }
  }
  // H2: askFired is an OR across every assistant message since the last user
  // boundary (the CURRENT turn), not the last message alone.
  const askFired = currentTurnAssistantContents.some(scanContentForAskUserQuestion);
  // CR-03 / WR-07 ROOT ANCHOR: the gate signature over the LAST assistant message's
  // gate-identifying content (Part 8: a sha256 hash, the raw message text never leaves this
  // function). Growth-invariant, per-gate, present whenever a gate is detected.
  const gateSig = gateSignature(lastAssistantText);
  return {
    output_text: lastAssistantText,
    askuserquestion_fired: askFired,
    gate_signature: gateSig,
    preceding_user_text: lastPrecedingUserText,
  };
}

// readTranscriptTail(transcriptPath) -- WR-08: read at most the LAST TRANSCRIPT_TAIL_BYTES of
// the transcript file. For a file at or under the cap this is a plain read; for a larger file
// we open a descriptor, stat the size, and read only the trailing window. Returns the UTF-8
// string, or null on any error (the caller degrades to empty signals). Never throws.
function readTranscriptTail(transcriptPath) {
  let fd = null;
  try {
    const st = fs.statSync(transcriptPath);
    const size = st.size;
    if (size <= TRANSCRIPT_TAIL_BYTES) {
      return fs.readFileSync(transcriptPath, 'utf8');
    }
    fd = fs.openSync(transcriptPath, 'r');
    const start = size - TRANSCRIPT_TAIL_BYTES;
    const buf = Buffer.alloc(TRANSCRIPT_TAIL_BYTES);
    const bytesRead = fs.readSync(fd, buf, 0, TRANSCRIPT_TAIL_BYTES, start);
    return buf.slice(0, bytesRead).toString('utf8');
  } catch (_e) {
    return null;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (_e2) { /* best-effort */ }
    }
  }
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
// session_id + gate_signature (CR-03 / WR-07 root anchor) thread through for the
// WR-01/CR-02/CR-03 stable retry key. PRIMARY's ran_entries stays read from the envelope (it
// has no transcript source -- the WR-04 deferred note). Tolerant of missing fields; never throws.
// ---------------------------------------------------------------------------
function deriveTurnSignals(env) {
  const e = env && typeof env === 'object' ? env : {};

  // PRIMARY ran-entries: side-channel only (no transcript source -- WR-04 deferred).
  // Phase 209-06 (H3): WR-04's doctrine note is UPDATED here, not just above --
  // the producer now exists (lib/core/card-fire-sidechannel.cjs, wired at the
  // pickShape trailer door + the two intent-classifier.cjs sites: the engine
  // arm and emitBindingGate). Direct-field envelopes (the unit-test shape)
  // keep PRECEDENCE: the side file is consulted ONLY when the envelope did
  // NOT already carry ran_entries/reached_gate_entries, so the 22 existing
  // predicate assertions stay green byte-for-byte. Regex BACKSTOP stays
  // SECONDARY permanently -- it is the only detector when the side-channel
  // writer itself fails (a missing/corrupt/oversized file all degrade to []
  // inside readReachedGates, never throwing here).
  let ranEntries = Array.isArray(e.ran_entries)
    ? e.ran_entries
    : (Array.isArray(e.reached_gate_entries) ? e.reached_gate_entries : []);

  // 2026-07-05 relevance-gate fix: the reach's OWN recorded subject text
  // (side-channel only, populated ONLY when the side-channel itself supplied
  // ranEntries -- i.e. the true PRIMARY path). '' on the BACKSTOP path (no
  // side-channel producer runs there), so classifyCardFire falls back to its
  // prior output_text comparison unchanged for that path.
  let sideChannelSubjectText = '';

  // card-fire-over-enforcement (2026-07-20) fix (B): whether the reached gate is
  // FRESH (reached this turn) or STALE (a prior turn's reach bled forward by the
  // file TTL). Direct-field / BACKSTOP gates are always this-turn, so freshness
  // defaults to true; only a side-channel-sourced gate can be stale, decided by
  // comparing its most-recent mint ts against TURN_FRESH_MS below.
  let gateIsFresh = true;

  if (ranEntries.length === 0) {
    try {
      const sidechannel = require(path.join(PLUGIN_ROOT, 'lib', 'core', 'card-fire-sidechannel.cjs'));
      const sessionId = typeof e.session_id === 'string' ? e.session_id : '';
      const fromSideChannel = sidechannel.readReachedGates(sessionId);
      if (Array.isArray(fromSideChannel) && fromSideChannel.length > 0) {
        ranEntries = fromSideChannel;
        try {
          const subjects = sidechannel.readReachedGateSubjects(sessionId);
          sideChannelSubjectText = Array.isArray(subjects) ? subjects.join(' ') : '';
        } catch (_e2) {
          sideChannelSubjectText = '';
        }
        // Freshness verdict: a side-channel gate counts as reached THIS turn only
        // if its most recent mint is within the turn window. An older mint is a
        // prior turn's (or prior session's) reach still inside the file TTL.
        try {
          const ts = sidechannel.mostRecentReachedTs(sessionId);
          const freshWindow = typeof sidechannel.TURN_FRESH_MS === 'number'
            ? sidechannel.TURN_FRESH_MS
            : (2 * 60 * 1000);
          gateIsFresh = Number.isFinite(ts) && ts > 0 && (Date.now() - ts) <= freshWindow;
        } catch (_e3) {
          gateIsFresh = true;
        }
      }
    } catch (_e) {
      /* degrade to empty ran_entries; BACKSTOP alone still applies */
    }
  }

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
  // CR-03 / WR-07: the transcript-growth-invariant, per-gate retry anchor. Precedence:
  //   1. an explicit gate_signature on the envelope (test / side-channel shape);
  //   2. the parsed transcript's gate signature (the LIVE BACKSTOP path);
  //   3. DERIVED from the output text (the direct-field unit-test shape that supplies
  //      output_text but no transcript) so the key is stable without re-walking a transcript.
  // It is NEVER a transcript-length counter -- the gate_turn_index fallback is DELETED.
  let gateSig = '';
  if (typeof e.gate_signature === 'string' && e.gate_signature) {
    gateSig = e.gate_signature;
  } else if (txn && typeof txn.gate_signature === 'string' && txn.gate_signature) {
    gateSig = txn.gate_signature;
  } else {
    gateSig = gateSignature(outputText);
  }

  // Phase 210-05 (item 210-E-1): thread the preceding user text through for the
  // relevance verdict. Direct-field envelopes may supply it; the transcript path
  // derives it. Absent on both -> '' (the conservative verdict: intercept). Per
  // CR-03 it never feeds gate_signature or turnContextHash.
  const precedingUserText = typeof e.preceding_user_text === 'string'
    ? e.preceding_user_text
    : (txn ? txn.preceding_user_text : '');

  return {
    ran_entries: ranEntries,
    askuserquestion_fired: askFired,
    output_text: outputText,
    session_id: typeof e.session_id === 'string' ? e.session_id : '',
    gate_signature: gateSig,
    preceding_user_text: precedingUserText,
    // 2026-07-05 relevance-gate fix: direct-field envelopes (the unit-test
    // seam) keep precedence over the side-channel-derived subject text,
    // mirroring the existing ran_entries precedence rule exactly.
    gate_subject_text: (typeof e.gate_subject_text === 'string' && e.gate_subject_text)
      ? e.gate_subject_text
      : sideChannelSubjectText,
    // card-fire-over-enforcement (2026-07-20) fix (B): true when the reached
    // gate is this-turn (direct-field / BACKSTOP / a fresh side-channel mint),
    // false when a side-channel mint is stale (a prior turn's reach bled forward
    // by the file TTL). classifyCardFire feeds this to the low-signal relevance
    // branch so a terse turn no longer force-fires a stale gate.
    gate_is_fresh: gateIsFresh,
  };
}

// ----- main (Stop-hook entry) -----

function main() {
  // Phase 198-09 (D-05): once the Stop-gate enforcement has moved server-side
  // (scripts/on-stop's own thin adapter, querying lib/mcp/tools/stop-gate.cjs
  // -> lib/mcp/stop-gate-handler.cjs, which WRAPS this exact predicate --
  // Part 7, no fork), this hook-side copy must no-op rather than run a SECOND,
  // independent enforcement pass in parallel (hooks/hooks.json dispatches
  // on-stop and this script as two SEPARATE Stop hook entries; running both
  // enforcement paths at once would double-block or race on the same retry
  // side-file). Flag OFF (unset/empty, the default) keeps this entire file's
  // call path byte-identical -- the check below is the ONLY change to the
  // OFF behavior (a no-op it can never reach), everything past this point is
  // untouched. The daemon-side path decides for itself via the SAME
  // MINDRIAN_MCP_FIRST contract (lib/mcp/mcp-first-flag.cjs's isMcpFirst),
  // required here rather than re-checked via a bash mirror since this file is
  // already Node.
  try {
    const { isMcpFirst } = require(path.join(PLUGIN_ROOT, 'lib', 'mcp', 'mcp-first-flag.cjs'));
    if (isMcpFirst('cli')) return silentSuccess();
  } catch (_e) {
    // A flag-reader failure must never suppress enforcement -- fall through
    // to the full legacy predicate below (the conservative direction).
  }

  const env = readStdinJson();
  const evt = env.hook_event_name || env.hookEventName || process.env.HOOK_EVENT_NAME || null;

  // Only act on the Stop event; any other event is a no-op (defensive: do not block).
  if (evt && evt !== 'Stop') return silentSuccess();

  const registry = loadRegistry();
  const turn = deriveTurnSignals(env);
  const sessionId = turn.session_id;
  const ctxHash = turnContextHash(turn);
  // Feed BOTH counters into the predicate: the per-gate counter (per-gate UX granularity) and
  // the SESSION-wide counter (the CR-04 content-independent convergence floor). The predicate
  // degrades if EITHER ceiling is reached.
  turn.retry_count = readRetryCount(ctxHash);
  turn.session_count = readSessionCount(sessionId);

  const verdict = classifyCardFire(turn, registry);

  if (verdict.degrade === true) {
    // Bounded escape released (per-gate ceiling OR the CR-04 session ceiling): log + allow.
    // Clear BOTH the per-gate counter AND the session counter -- the navigator is being let
    // through, so the session is "unstuck" and the next continuous run starts fresh. Clearing
    // the session counter here is the sane reset: a continuous run of intercepts is bounded by
    // MAX_SESSION_INTERCEPTS, and a degrade ENDS that run.
    process.stderr.write(
      '[check-card-fire] bounded escape released; allowing turn (' + verdict.reason + ')\n'
    );
    // CR-07: record the degrade with its ORIGINAL slug before the envelope calms `reason`.
    appendInterceptLog(turn, verdict);
    clearRetryCount(ctxHash);
    clearSessionCount(sessionId);
    return emitEnvelope(buildEnforcementEnvelope(verdict));
  }

  if (verdict.intercept === true) {
    // Force the card: bump BOTH the per-gate counter AND the session-wide counter, then emit
    // the Stop-block (decision:block-on-exit-0). Bumping the session counter on EVERY intercept
    // is what makes a flapping per-gate key (CR-04) still converge: the session counter climbs
    // regardless of which per-gate key the intercept landed on.
    bumpRetryCount(ctxHash);
    bumpSessionCount(sessionId);
    // CR-07: record the intercept with its ORIGINAL slug before the envelope calms `reason`.
    appendInterceptLog(turn, verdict);
    return emitEnvelope(buildEnforcementEnvelope(verdict));
  }

  // The card fired (or no gate signal): the navigator got unstuck this turn, so clear the per-
  // gate counter AND reset the session counter (a no-intercept Stop turn ends any intercept run).
  clearRetryCount(ctxHash);
  clearSessionCount(sessionId);
  return silentSuccess();
}

module.exports = {
  MAX_FORCE_RETRIES,
  MAX_SESSION_INTERCEPTS,
  SESSION_KEY_PREFIX,
  RETRY_TTL_MS,
  TRANSCRIPT_TAIL_BYTES,
  ASCII_BOX_GLYPH_RE,
  computeBackstopHit,
  matchedGlyphSpan,
  classifyCardFire,
  buildEnforcementEnvelope,
  gateReachingEntries,
  gateSignature,
  turnContextHash,
  deriveTurnSignals,
  readTranscriptTurn,
  readTranscriptTail,
  pruneRetryStore,
  normalizeRetryEntry,
  sessionKey,
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
