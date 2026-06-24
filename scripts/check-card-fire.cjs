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
 * no fired AskUserQuestion card it emits an exit-2 block + additionalContext re-prompt
 * forcing the card; after MAX_FORCE_RETRIES bounded retries it degrades gracefully
 * (log + allow) so a genuinely card-incapable surface cannot trap the navigator.
 *
 * Detection (CONTEXT decision 1: registry-keyed PRIMARY + output-text BACKSTOP):
 *   PRIMARY  -- a render-coverage-registry gate-reaching surface
 *               (data/render-coverage-registry.json entries[] with render_coverage
 *               'card-emission') ran this turn AND no AskUserQuestion tool-call fired.
 *               The enumeration is DERIVED from the registry, never hand-maintained.
 *   BACKSTOP -- the turn output text carries the ASCII-box gate glyphs
 *               (the `[1] [2] [3]` / "type 1, 2, or 3" anti-pattern) with no fired
 *               card -- intercepted even for an OFF-registry surface.
 *
 * Bounded escape (T-179-01 DoS mitigation): a LOCAL retry side-file
 * (~/.mindrian/card-fire-retries.json) keyed by turn-context hash counts consecutive
 * intercepts; at MAX_FORCE_RETRIES the predicate returns degrade=true and the envelope
 * is { continue: true, suppressOutput: true } (log to stderr, allow the turn).
 *
 * Envelope schema (Phase 95 BASH-95-01 invariant): top-level keys are a subset of
 * { decision, reason, continue, stopReason, suppressOutput, systemMessage,
 *   hookSpecificOutput }. additionalContext lives ONLY inside hookSpecificOutput.
 *
 * Canon Part 8 (The Graph Boundary): LOCAL-only. Reads the local registry + the hook
 * stdin envelope + the local retry side-file; makes ZERO Brain reads/writes and ZERO
 * network calls. The interceptor opens no remote wire and loads no Brain module. The
 * turn content the interceptor reads (an untrusted model turn) is NEVER echoed to Brain.
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
// turnContextHash(turn) -- a stable LOCAL key for the bounded-escape retry counter.
// Hashes the gate-reaching signal of the turn (the ran-entries set + a short prefix of
// the output text) so consecutive intercepts on the SAME stuck turn-context increment
// the same counter. Part 8: a local sha256 over local turn signals; never egresses.
// ---------------------------------------------------------------------------
function turnContextHash(turn) {
  const t = turn && typeof turn === 'object' ? turn : {};
  const ran = Array.isArray(t.ran_entries) ? t.ran_entries.slice().sort().join('|') : '';
  const txt = typeof t.output_text === 'string' ? t.output_text.slice(0, 256) : '';
  return crypto.createHash('sha256').update(ran + ' ' + txt).digest('hex').slice(0, 16);
}

// ---------------------------------------------------------------------------
// classifyCardFire(turn, registry) -- THE deterministic predicate.
//
// Returns { intercept, reason, degrade }:
//   - intercept=true  : a reached gate fired no card; force it (exit-2 re-prompt).
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
//   - intercept-> the exit-2 block: { decision:'block', ..., hookSpecificOutput:
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

function writeRetryStore(store) {
  try {
    const fp = retryFilePath();
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(store), 'utf8');
  } catch (_e) {
    /* best-effort; never block on a side-file write */
  }
}

function readRetryCount(ctxHash) {
  const store = readRetryStore();
  const v = store[ctxHash];
  return Number.isFinite(v) ? v : 0;
}

function bumpRetryCount(ctxHash) {
  const store = readRetryStore();
  store[ctxHash] = (Number.isFinite(store[ctxHash]) ? store[ctxHash] : 0) + 1;
  writeRetryStore(store);
  return store[ctxHash];
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
// deriveTurnSignals(env) -- best-effort extraction of the normalized turn signals
// from the Stop-hook stdin envelope. The CLI hook substrate concatenates the
// reached-gate marker as opaque turn TEXT (the Phase 178 GA-4 spike finding), so the
// PRIMARY ran-entries signal is read from the side-channel when present and the
// output text drives the BACKSTOP. Tolerant of missing fields (Tier 0). Never throws.
// ---------------------------------------------------------------------------
function deriveTurnSignals(env) {
  const e = env && typeof env === 'object' ? env : {};
  const ranEntries = Array.isArray(e.ran_entries)
    ? e.ran_entries
    : (Array.isArray(e.reached_gate_entries) ? e.reached_gate_entries : []);
  const outputText =
    typeof e.output_text === 'string' ? e.output_text
      : (typeof e.last_assistant_text === 'string' ? e.last_assistant_text : '');
  const askFired =
    e.askuserquestion_fired === true ||
    e.ask_user_question_fired === true;
  return {
    ran_entries: ranEntries,
    askuserquestion_fired: askFired,
    output_text: outputText,
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
    // Force the card: bump the bounded-escape counter and emit the exit-2 block.
    bumpRetryCount(ctxHash);
    return emitEnvelope(buildEnforcementEnvelope(verdict));
  }

  // The card fired (or no gate signal): clear any stale counter and allow.
  clearRetryCount(ctxHash);
  return silentSuccess();
}

module.exports = {
  MAX_FORCE_RETRIES,
  classifyCardFire,
  buildEnforcementEnvelope,
  gateReachingEntries,
  turnContextHash,
  deriveTurnSignals,
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
