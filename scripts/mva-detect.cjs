#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-00 -- UserPromptSubmit detection hook for the 30-Second MVA
 * pipeline. The entry pin of Phase 118: every other plan reads the state
 * file this hook writes.
 *
 * Flow (per Plan 118-00 Task 2):
 *   1. Read stdin JSON payload; extract `prompt`. Bail (exit 0) on parse fail.
 *   2. If mva-state.isAlreadyRunning() -> exit 0 (don't re-fire mid-pipeline).
 *   3. classify(prompt) via lib/core/mva-classifier.cjs.
 *   4. If venture:true -> mvaState.writePending({ sentence_sha256, ... }).
 *   5. If reason='hebrew_unsupported_v1.13.0' -> mvaState.writePending(hebrew_refusal:true).
 *   6. Emit telemetry to ~/.mindrian/telemetry/v1.13/mva.jsonl (scalar-only;
 *      sha256_of_sentence is the LARGEST string written; raw prompt NEVER
 *      touches disk).
 *   7. Exit 0.
 *
 * Mirrors scripts/auto-explore-drain.cjs exit-0-on-any-error pattern. Hook
 * budget is 1500ms (set in hooks/hooks.json). The classifier's sync path
 * runs in single-digit ms; the deadline applies even if every layer errors.
 *
 * Per Canon Part 8: zero Brain MCP calls, zero raw-prompt egress to disk.
 *   - Telemetry carries sha256(prompt), source enum, venture bool, ms scalar.
 *   - State file carries sha256(prompt), classifier metadata, locale enum.
 *   - The raw prompt lives ONLY in the in-memory `prompt` variable for the
 *     classification call; never written to fs, never logged.
 *
 * Pure CJS, node built-ins only.
 */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const HOOK_EVENT_NAME = 'UserPromptSubmit';
const STDIN_TIMEOUT_MS = 200;
const TELEMETRY_DIR = path.join(
  process.env.HOME || process.env.USERPROFILE || os.homedir(),
  '.mindrian', 'telemetry', 'v1.13'
);
const TELEMETRY_FILE = path.join(TELEMETRY_DIR, 'mva.jsonl');

// ---------- Envelope helpers (mirrors auto-explore-drain.cjs) ----------

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
  try { process.stdout.write(JSON.stringify(filtered)); } catch (_e) {}
  process.exit(0);
}

function emitEmpty() {
  emitEnvelope({ continue: true });
}

process.on('uncaughtException', () => {
  try { emitEmpty(); } catch (_e) { process.exit(0); }
});

// ---------- Active room resolution (LOCAL; mirrors brain-derivation-drain) ----------

function resolveActiveRoomDir() {
  try {
    const root = (process.env.MINDRIAN_ROOMS_HOME && fs.existsSync(process.env.MINDRIAN_ROOMS_HOME))
      ? process.env.MINDRIAN_ROOMS_HOME
      : path.join(process.env.HOME || os.homedir(), 'MindrianRooms');
    const regPath = path.join(root, '.rooms', 'registry.json');
    if (!fs.existsSync(regPath)) return null;
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    if (reg && typeof reg.active === 'string' && reg.active.length > 0) {
      const cand = path.join(root, reg.active);
      if (fs.existsSync(cand)) return cand;
    }
  } catch (_e) { /* graceful */ }
  return null;
}

// ---------- Telemetry ----------

function _appendTelemetry(event) {
  try {
    fs.mkdirSync(TELEMETRY_DIR, { recursive: true });
  } catch (_e) { /* best effort */ }
  try {
    fs.appendFileSync(TELEMETRY_FILE, JSON.stringify(event) + '\n', 'utf8');
  } catch (_e) { /* best effort */ }
}

// ---------- Stdin read (200ms budget) ----------

function readStdinSync() {
  // Claude Code passes hook payload via stdin as JSON. We read synchronously
  // up to the 200ms budget. If stdin is a TTY (interactive run) or empty,
  // we return null and the caller bails.
  try {
    if (process.stdin.isTTY) return null;
    // Use readFileSync(0) for synchronous stdin -- standard Node idiom for
    // hook scripts.
    const buf = fs.readFileSync(0);
    const s = buf.toString('utf8');
    return s.length > 0 ? s : null;
  } catch (_e) {
    return null;
  }
}

// ---------- Main ----------

function main() {
  const t0 = Date.now();
  const raw = readStdinSync();
  if (!raw) return emitEmpty();
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch (_e) {
    return emitEmpty();
  }
  const prompt = (payload && typeof payload.prompt === 'string') ? payload.prompt : null;
  if (!prompt) return emitEmpty();

  // Gate: another pipeline running? skip.
  let mvaState;
  try {
    mvaState = require('../lib/core/mva-state.cjs');
  } catch (_e) {
    return emitEmpty();
  }
  try {
    if (mvaState.isAlreadyRunning()) return emitEmpty();
  } catch (_e) {
    return emitEmpty();
  }

  // Classify
  let classifier, classification;
  try {
    classifier = require('../lib/core/mva-classifier.cjs');
    classification = classifier.classify(prompt);
  } catch (e) {
    try { process.stderr.write('[mva-detect] classifier error: ' + (e && e.message || String(e)) + '\n'); } catch (_e) {}
    return emitEmpty();
  }

  const sentSha = crypto.createHash('sha256').update(prompt, 'utf8').digest('hex');
  const elapsed = Date.now() - t0;

  // Write state per venture-positive OR hebrew-refusal branch.
  try {
    if (classification.venture === true) {
      mvaState.writePending({
        sentence_sha256: sentSha,
        classified_at: Date.now(),
        classifier_source: classification.source,
        classifier_confidence: classification.confidence || null,
        locale: 'en',
      });

      // Phase 144.1-06 RETRO-03 (audit item 67): fire SENS-05 (context_block /
      // mva-brief / push_forward) through the navigation chokepoint so the engine
      // can observe a venture-positive MVA trigger -- memory_event_only. LOCAL
      // only (Canon Part 8): the fire carries the reach handles + the sentence
      // sha256 scalar + the classifier source enum, never the raw prompt (which
      // lives ONLY in the in-memory `prompt` variable, never on disk). Routes
      // through navigation.cjs::logSpineRead; best-effort, never throws.
      try {
        const roomDir = resolveActiveRoomDir();
        if (roomDir) {
          const navigation = require('../lib/core/navigation.cjs');
          if (navigation && typeof navigation.logSpineRead === 'function') {
            navigation.logSpineRead(roomDir, {
              surface: 'context_block',
              sensor: 'SENS-05',
              dispatch: 'mva-brief',
              posture: 'push_forward',
              sentence_sha256: sentSha,
              classifier_source: String(classification.source || 'unknown'),
              source: 'mva-detect',
            });
          }
        }
      } catch (_e) { /* never throw -- fire is advisory */ }
    } else if (classification.reason === 'hebrew_unsupported_v1.13.0') {
      mvaState.writePending({
        sentence_sha256: sentSha,
        classified_at: Date.now(),
        classifier_source: classification.source,
        classifier_confidence: null,
        locale: 'he',
        hebrew_refusal: true,
      });
    }
    // else: non-venture, English -> NO state mutation (the pipeline does not fire).
  } catch (_e) {
    // state-write best-effort; never block the hook
  }

  // Telemetry: scalar-only, hashed sentence, never raw text.
  _appendTelemetry({
    event: 'mva_classified',
    timestamp: new Date().toISOString(),
    sha256_of_sentence: sentSha,
    venture: classification.venture === true,
    source: String(classification.source || 'unknown'),
    confidence: classification.confidence || null,
    reason: classification.reason || null,
    classified_in_ms: elapsed,
  });

  return emitEmpty();
}

try {
  main();
} catch (_e) {
  emitEmpty();
}
