#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 357-06 -- extract-dogfood-stop-events.cjs: the local-only dogfood
 * Stop-event extractor (source (d) of the replay corpus).
 * =====================================================================
 * DEV-TIME ONLY. LOCAL-ONLY. Never required from lib/ or hooks/, never a
 * hook itself. Makes ZERO network calls for the whole run (globalThis.fetch
 * is replaced with a thrower, matching scripts/replay-card-fire.cjs's own
 * ban). Reads the navigator's own dev-session snapshot at the R-D raw dir
 * (default ~/.cache/mindrian-dev/357-raw/, verified against SHA256SUMS
 * before any mode runs) -- it never reads the LIVE transcript store (the
 * Claude Code per-project session directory) or the live intercept-log
 * path (the local mindrian home dir's card-fire-intercepts.log). Every raw
 * artifact this file writes (candidates.json, selected.json, the
 * sanitized-map input, the sanitize report, the denylist) stays INSIDE the
 * raw dir at mode 600 and is NEVER committed into this repo. Stdout carries
 * COUNTS ONLY, never transcript text (Part 8, T-357-11). No em-dashes
 * anywhere (hyphens only, CLAUDE.md HARD RULE).
 *
 * Modes (D-04, D-05, D-06):
 *   --scan                                reconstruct real Stop events from
 *                                          the snapshot, run each against
 *                                          the pre-phase code, write
 *                                          candidates.json
 *   --select                               pick the dogfood set (every
 *                                          non-partial live block minus the
 *                                          two source (c) anchors, the R-C
 *                                          case, a stratified pass sample),
 *                                          write selected.json
 *   --apply-sanitized <map.json>           verdict-preserving sanitization
 *                                          check + write dogfood.json
 *   --write-review-sheet [--with-head-verdicts]
 *                                           write 357-DOGFOOD-LABELS.md
 *   --leak-check <file> [<file> ...]       scan named (committed) files for
 *                                          a leak, print file + rule id only
 */

'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const checkCardFire = require(path.join(__dirname, 'check-card-fire.cjs'));

// classifyStopOutcome anchors (WR-02, 357-REVIEW.md): derived from
// check-card-fire.cjs's own buildEnforcementEnvelope output shape at
// require-time, instead of hardcoded magic byte-lengths cross-checked
// against nothing. A future change to the hook's real stdout shape (even a
// whitespace/wording change) now updates these anchors automatically
// instead of silently returning null and dropping candidates from a
// future --scan rerun.
const PASS_STDOUT_LEN = JSON.stringify(
  checkCardFire.buildEnforcementEnvelope({ intercept: false, degrade: false })
).length;
const DEGRADE_STDOUT_LEN = JSON.stringify(
  checkCardFire.buildEnforcementEnvelope({ intercept: false, degrade: true })
).length;

const REPO_ROOT = path.join(__dirname, '..');
const PHASE_DOCS_DIR = path.join(
  REPO_ROOT, '.planning', 'phases',
  '357-gate-triad-ledger-jev-scored-at-dev-time-is-fork-answered-re'
);
const REVIEW_SHEET_PATH = path.join(PHASE_DOCS_DIR, '357-DOGFOOD-LABELS.md');
const DOGFOOD_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'card-fire-replay', 'dogfood.json');

const DEFAULT_RAW_DIR = path.join(os.homedir(), '.cache', 'mindrian-dev', '357-raw');

// D-04, R-D: the two source (c) anchors this dogfood set MUST exclude
// (already fixtured by hand in tests/fixtures/card-fire-replay/live-2026-09-23.json).
// Matched by session id prefix + Stop timestamp within 5 seconds.
const ANCHOR_EXCLUSIONS = Object.freeze([
  { sessionPrefix: '56924067', hhmmss: '085052' },
  { sessionPrefix: '56924067', hhmmss: '094016' },
]);

// The R-C case (CONTEXT R-C, RESEARCH Open Question 2): the 09:20 human-typed
// block in session 0f86dd63.
const R_C_SESSION_PREFIX = '0f86dd63';
const R_C_HHMMSS = '0920';

const MINT_WINDOW_MS = 10 * 60 * 1000; // 10-minute prune (Finding 1)
const FRESH_WINDOW_MS = 120 * 1000; // 120-second freshness (Finding 1)
const SIDECHANNEL_LOOKBACK_MS = 600000; // R1: mints within 600000 ms before the Stop
const MAX_SUBJECT_CHARS = 300;

const SELECT_MIN = 24;
const SELECT_MAX = 36;

const LEAK_BUILTIN_RULES = [
  { id: 'email', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/ },
  { id: 'home-path', re: /\/home\// },
  { id: 'mindrian-rooms', re: /MindrianRooms/ },
  { id: 'uuid', re: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i },
];

// ---------------------------------------------------------------------------
// Network ban (D-13 precedent): applies for the whole process lifetime once
// main() runs. Exported for a test seam that wants to assert the throw
// message without invoking main().
// ---------------------------------------------------------------------------
const NETWORK_FORBIDDEN_MESSAGE = 'network forbidden in extract-dogfood-stop-events';
function banNetwork() {
  globalThis.fetch = function () {
    throw new Error(NETWORK_FORBIDDEN_MESSAGE);
  };
}

// ---------------------------------------------------------------------------
// sha256Verify(rawDir) -- recompute every SHA256SUMS-listed file's digest
// and compare. Refuses (throws) on any mismatch or missing file, or a
// missing SHA256SUMS itself. Never trusts the OS `sha256sum -c` binary --
// this is a pure Node re-implementation of the same check (R-D).
// ---------------------------------------------------------------------------
function sha256Verify(rawDir) {
  const sumsPath = path.join(rawDir, 'SHA256SUMS');
  if (!fs.existsSync(sumsPath)) {
    throw new Error('SHA256SUMS missing in raw dir: ' + rawDir);
  }
  const raw = fs.readFileSync(sumsPath, 'utf8');
  const lines = raw.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  const checked = [];
  for (const line of lines) {
    const m = /^([0-9a-f]{64})\s+\*?(.+)$/i.exec(line);
    if (!m) continue;
    const expected = m[1].toLowerCase();
    const rel = m[2].trim();
    const filePath = path.join(rawDir, rel);
    if (!fs.existsSync(filePath)) {
      throw new Error('SHA256SUMS entry missing on disk: ' + rel);
    }
    const buf = fs.readFileSync(filePath);
    const actual = crypto.createHash('sha256').update(buf).digest('hex');
    if (actual !== expected) {
      throw new Error('SHA256SUMS digest mismatch: ' + rel);
    }
    checked.push(rel);
  }
  if (checked.length === 0) {
    throw new Error('SHA256SUMS had no verifiable entries: ' + sumsPath);
  }
  return checked;
}

function refuseRawDirInsideRepo(rawDir) {
  const resolvedRaw = path.resolve(rawDir);
  const resolvedRepo = path.resolve(REPO_ROOT);
  if (resolvedRaw === resolvedRepo || resolvedRaw.indexOf(resolvedRepo + path.sep) === 0) {
    throw new Error('raw dir must not be inside the repo: ' + rawDir);
  }
}

function writePrivate(filePath, contents) {
  fs.writeFileSync(filePath, contents, { mode: 0o600 });
  try {
    fs.chmodSync(filePath, 0o600);
  } catch (_e) {
    /* best-effort on platforms without POSIX chmod semantics */
  }
}

// ---------------------------------------------------------------------------
// hhmmss(isoTs) -- UTC HHMMSS from an ISO timestamp string. Never throws.
// ---------------------------------------------------------------------------
function hhmmss(isoTs) {
  try {
    const d = new Date(isoTs);
    const p2 = function (n) { return String(n).padStart(2, '0'); };
    return p2(d.getUTCHours()) + p2(d.getUTCMinutes()) + p2(d.getUTCSeconds());
  } catch (_e) {
    return '000000';
  }
}

// ---------------------------------------------------------------------------
// recoverSubject(blockText) -- Finding 1: an F.1 subject is the text between
// the NAV block's "Why:" paragraph and the "[AskUserQuestion contract" line;
// an F.8 (or any shape with no "Why:" paragraph) subject is everything before
// that same contract line. Trimmed, cut to MAX_SUBJECT_CHARS. Pure, never
// throws. Returns '' when no contract line is present.
// ---------------------------------------------------------------------------
function recoverSubject(blockText) {
  try {
    if (typeof blockText !== 'string' || !blockText) return '';
    const contractIdx = blockText.indexOf('[AskUserQuestion contract');
    if (contractIdx === -1) return '';
    const head = blockText.slice(0, contractIdx);
    const whyMatch = /\nWhy:[^\n]*\n\s*\n/.exec(head);
    const body = whyMatch ? head.slice(whyMatch.index + whyMatch[0].length) : head;
    return body.trim().slice(0, MAX_SUBJECT_CHARS);
  } catch (_e) {
    return '';
  }
}

// ---------------------------------------------------------------------------
// extractMintsFromStdout(stdout, ts) -- scan a UserPromptSubmit hook_success
// stdout (plain text, optionally interleaved with a JSON hookSpecificOutput
// line) for every "[AskUserQuestion contract: shape=F.x" occurrence and
// recover its mint. A "[NAV DECISION unchanged" line mints nothing (Finding
// 1). Never throws; returns [] on any parse trouble.
// ---------------------------------------------------------------------------
function extractMintsFromStdout(stdout, ts) {
  const mints = [];
  if (typeof stdout !== 'string' || !stdout) return mints;

  // Plain-text scan (covers F.1 and any shape rendered as plain stdout).
  const shapeRe = /\[AskUserQuestion contract:\s*shape=([A-Za-z0-9.]+)/g;
  let m;
  const plainBlocks = [];
  // Split on JSON lines so the plain-text pass never double-counts a shape
  // marker that lives INSIDE a JSON line's own additionalContext string.
  const lines = stdout.split('\n');
  const plainLines = [];
  const jsonLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{')) {
      try {
        jsonLines.push(JSON.parse(trimmed));
      } catch (_e) {
        plainLines.push(line);
      }
    } else {
      plainLines.push(line);
    }
  }
  const plainText = plainLines.join('\n');

  if (plainText.indexOf('[NAV DECISION unchanged') !== -1) {
    // Suppression: mints nothing this turn, per Finding 1.
  } else {
    shapeRe.lastIndex = 0;
    while ((m = shapeRe.exec(plainText)) !== null) {
      const shape = m[1];
      const subject = recoverSubject(plainText.slice(0, m.index + m[0].length + 1));
      mints.push({ entry: 'scripts/intent-classifier.cjs', shape: shape, ts: ts, subject: subject });
    }
  }

  for (const j of jsonLines) {
    const hso = j && j.hookSpecificOutput;
    const ac = hso && typeof hso.additionalContext === 'string' ? hso.additionalContext : '';
    if (!ac) continue;
    const shapeMatch = /\[AskUserQuestion contract:\s*shape=([A-Za-z0-9.]+)/.exec(ac);
    if (!shapeMatch) continue;
    const subject = recoverSubject(ac);
    mints.push({ entry: 'scripts/intent-classifier.cjs', shape: shapeMatch[1], ts: ts, subject: subject });
  }

  return mints;
}

// ---------------------------------------------------------------------------
// classifyStopOutcome(attachment) -- Finding 1's length/blockingError rule.
// Returns 'pass' | 'degrade' | 'block' | null (null = not a check-card-fire
// Stop attachment at all). Pure, never throws.
// ---------------------------------------------------------------------------
function classifyStopOutcome(attachment) {
  try {
    if (!attachment || attachment.hookEvent !== 'Stop') return null;
    if (attachment.type === 'hook_success') {
      const cmd = typeof attachment.command === 'string' ? attachment.command : '';
      if (cmd.indexOf('check-card-fire.cjs') === -1) return null;
      const stdout = typeof attachment.stdout === 'string' ? attachment.stdout : '';
      if (stdout.length === PASS_STDOUT_LEN) return 'pass';
      if (stdout.length === DEGRADE_STDOUT_LEN) return 'degrade';
      return null;
    }
    if (attachment.type === 'hook_blocking_error') {
      const be = attachment.blockingError;
      const cmd = be && typeof be.command === 'string' ? be.command : '';
      if (cmd.indexOf('check-card-fire.cjs') === -1) return null;
      return 'block';
    }
    return null;
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// isAnchorExclusion(sessionId, ts) -- true when this Stop is one of the two
// source (c) anchors (excluded from dogfood; already hand-fixtured).
// ---------------------------------------------------------------------------
function isAnchorExclusion(sessionId, ts) {
  const prefix = String(sessionId).slice(0, 8);
  const stamp = hhmmss(ts);
  return ANCHOR_EXCLUSIONS.some(function (a) {
    if (a.sessionPrefix !== prefix) return false;
    const target = a.hhmmss;
    const diff = Math.abs(Number(stamp) - Number(target));
    return diff <= 5 || stamp === target;
  });
}

function isRCCase(sessionId, ts) {
  const prefix = String(sessionId).slice(0, 8);
  const stamp = hhmmss(ts);
  return prefix === R_C_SESSION_PREFIX && stamp.slice(0, 4) === R_C_HHMMSS;
}

// ---------------------------------------------------------------------------
// isStopHookFeedbackRecord(rec) -- a synthetic 'user' record Claude Code
// injects into the transcript AFTER a Stop hook blocks, to feed the block
// reason back into the loop. It is a CONSEQUENCE of the very Stop decision
// being reconstructed, so it did not exist when the real Stop hook read the
// transcript, and array position alone cannot be trusted to keep it out of
// the reconstructed window (observed: it can land BEFORE the check-card-fire
// attachment record for the SAME block in write order). Treated as
// transparent: never counted as a turn boundary, never included in a
// candidate's transcript. Pure, never throws.
// ---------------------------------------------------------------------------
function isStopHookFeedbackRecord(rec) {
  try {
    if (!rec || rec.type !== 'user' || !rec.message) return false;
    const content = rec.message.content;
    let text = '';
    if (typeof content === 'string') {
      text = content;
    } else if (Array.isArray(content)) {
      const first = content.find(function (b) { return b && typeof b.text === 'string'; });
      text = first ? first.text : '';
    }
    return text.trimStart().indexOf('Stop hook feedback:') === 0;
  } catch (_e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// buildCandidate(pieces) -- pure assembly: turns the walk state at one Stop
// point into a D-02-shaped candidate (no runEntry call inside; the --scan
// driver runs the classifier separately so this stays testable in isolation).
// pieces: { sessionId, ts, liveOutcome, userRecords, assistantRecords,
//           mints, retryCount, sessionCount }
// ---------------------------------------------------------------------------
function buildCandidate(pieces) {
  const id = 'dogfood-' + String(pieces.sessionId).slice(0, 8) + '-' + hhmmss(pieces.ts);
  const transcript = pieces.userRecords.concat(pieces.assistantRecords);
  const nowMs = Date.parse(pieces.ts);
  const sidechannelRecords = (pieces.mints || [])
    .filter(function (mnt) {
      const ageMs = nowMs - Date.parse(mnt.ts);
      return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= SIDECHANNEL_LOOKBACK_MS;
    })
    .map(function (mnt) {
      return {
        entry: mnt.entry,
        shape: mnt.shape,
        subject: mnt.subject,
        age_ms: nowMs - Date.parse(mnt.ts),
      };
    });

  const mode = sidechannelRecords.length > 0 ? 'transcript+sidechannel' : 'transcript';
  return {
    id: id,
    session: String(pieces.sessionId).slice(0, 8),
    ts: pieces.ts,
    live_outcome: pieces.liveOutcome,
    envelope: {
      mode: mode,
      transcript: transcript,
      sidechannel_records: sidechannelRecords,
      counters: { retry: pieces.retryCount || 0, session: pieces.sessionCount || 0 },
    },
  };
}

// ---------------------------------------------------------------------------
// walkSession(sessionId, records) -- replay one session's records in order,
// minting from every UserPromptSubmit hook_success and building one
// candidate per check-card-fire Stop. Returns { candidates, stopCount }.
// ---------------------------------------------------------------------------
function walkSession(sessionId, records) {
  const candidates = [];
  let currentMints = [];
  let recentUserRecords = [];
  let currentTurnAssistant = [];
  let retryCount = 0;
  let sessionCount = 0;
  let stopCount = 0;

  for (const rec of records) {
    if (!rec || typeof rec !== 'object') continue;

    if (rec.type === 'user') {
      // Transparent: a Stop-hook-feedback record for a block this same walk is
      // about to reconstruct did not exist at real read time (see
      // isStopHookFeedbackRecord's doc comment). Skip it entirely: no reset,
      // no inclusion in the transcript.
      if (isStopHookFeedbackRecord(rec)) continue;
      const slim = {
        type: 'user',
        message: rec.message,
      };
      if (rec.isMeta === true) slim.isMeta = true;
      if (rec.origin && typeof rec.origin === 'object' && rec.origin.kind) {
        slim.origin = { kind: rec.origin.kind };
      }
      recentUserRecords.push(slim);
      if (recentUserRecords.length > 2) recentUserRecords = recentUserRecords.slice(-2);
      currentTurnAssistant = [];
      continue;
    }

    if (rec.type === 'assistant') {
      currentTurnAssistant.push({ type: 'assistant', message: rec.message });
      continue;
    }

    if (rec.type === 'attachment') {
      const att = rec.attachment || {};

      if (att.hookEvent === 'UserPromptSubmit' && att.type === 'hook_success') {
        const mints = extractMintsFromStdout(att.stdout, rec.timestamp);
        if (mints.length > 0) currentMints = currentMints.concat(mints);
        // 10-minute prune (Finding 1 / R1).
        const nowMs = Date.parse(rec.timestamp);
        currentMints = currentMints.filter(function (mnt) {
          const age = nowMs - Date.parse(mnt.ts);
          return Number.isFinite(age) && age <= MINT_WINDOW_MS;
        });
        continue;
      }

      const outcome = classifyStopOutcome(att);
      if (outcome !== null) {
        stopCount += 1;
        const candidate = buildCandidate({
          sessionId: sessionId,
          ts: rec.timestamp,
          liveOutcome: outcome,
          userRecords: recentUserRecords,
          assistantRecords: currentTurnAssistant,
          mints: currentMints,
          retryCount: retryCount,
          sessionCount: sessionCount,
        });
        candidates.push(candidate);

        if (outcome === 'block') {
          retryCount += 1;
          sessionCount += 1;
          // Keep mints (a block does not consume the side channel).
        } else {
          retryCount = 0;
          sessionCount = 0;
          currentMints = []; // consumption after a live non-block outcome.
        }
        currentTurnAssistant = [];
      }
    }
  }

  return { candidates: candidates, stopCount: stopCount };
}

// ---------------------------------------------------------------------------
// readSessionRecords(filePath) -- per-line JSON parse with a try/catch per
// line (a malformed line is skipped, never fatal). Returns an array.
// ---------------------------------------------------------------------------
function readSessionRecords(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const out = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      out.push(JSON.parse(trimmed));
    } catch (_e) {
      continue;
    }
  }
  return out;
}

function listSessionFiles(rawDir) {
  return fs.readdirSync(rawDir)
    .filter(function (f) { return f.endsWith('.jsonl'); })
    .sort();
}

// ---------------------------------------------------------------------------
// leakCheck(text, denylistTerms) -- built-in patterns + a case-insensitive
// whole-word denylist scan. Returns { ok, hits: [{id}] }. Never throws, never
// echoes the matched text (Threat T-357-05 / T-357-11).
// ---------------------------------------------------------------------------
function leakCheck(text, denylistTerms) {
  const hits = [];
  const s = typeof text === 'string' ? text : JSON.stringify(text);
  for (const rule of LEAK_BUILTIN_RULES) {
    if (rule.re.test(s)) hits.push({ id: rule.id });
  }
  const terms = Array.isArray(denylistTerms) ? denylistTerms : [];
  for (const term of terms) {
    const t = String(term).trim();
    if (!t) continue;
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('\\b' + escaped + '\\b', 'i');
    if (re.test(s)) hits.push({ id: 'denylist:' + t });
  }
  return { ok: hits.length === 0, hits: hits };
}

function readDenylist(rawDir) {
  const p = path.join(rawDir, 'denylist.txt');
  if (!fs.existsSync(p)) return [];
  return fs.readFileSync(p, 'utf8').split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
}

// ---------------------------------------------------------------------------
// runScan(rawDir) -- mode 1.
// ---------------------------------------------------------------------------
async function runScan(rawDir) {
  refuseRawDirInsideRepo(rawDir);
  sha256Verify(rawDir);
  banNetwork();

  const replayLib = require(path.join(REPO_ROOT, 'scripts', 'replay-card-fire.cjs'));
  const codeRootResult = replayLib.prepareCodeRoot('pre-phase');

  const sessionFiles = listSessionFiles(rawDir);
  let stops = 0;
  let liveBlocks = 0;
  let degrades = 0;
  let agreement = 0;
  let partial = 0;
  const allCandidates = [];

  try {
    for (const fname of sessionFiles) {
      const sessionId = fname.replace(/\.jsonl$/, '');
      const records = readSessionRecords(path.join(rawDir, fname));
      const { candidates } = walkSession(sessionId, records);
      for (const candidate of candidates) {
        stops += 1;
        if (candidate.live_outcome === 'block') liveBlocks += 1;
        if (candidate.live_outcome === 'degrade') degrades += 1;

        const runResult = await replayLib.runEntry(
          { id: candidate.id, envelope: candidate.envelope },
          { codeRoot: codeRootResult.dir, surface: 'cli' }
        );
        const rawVerdict = runResult.cli || { class: 'error' };
        candidate.raw_verdict = { class: rawVerdict.class, reason: rawVerdict.reason };

        const liveClassMapped = candidate.live_outcome === 'degrade' ? 'pass' : candidate.live_outcome;
        const rawClassMapped = rawVerdict.degrade ? 'pass' : rawVerdict.class;
        const disagrees = rawClassMapped !== liveClassMapped;
        candidate.envelope_partial = disagrees;
        if (disagrees) partial += 1; else agreement += 1;

        allCandidates.push(candidate);
      }
    }
  } finally {
    codeRootResult.cleanup();
  }

  const out = {
    meta: {
      generated_at: new Date().toISOString(),
      raw_dir: rawDir,
      session_files: sessionFiles,
    },
    counts: { sessions: sessionFiles.length, stops, live_blocks: liveBlocks, degrades, agreement, partial },
    candidates: allCandidates,
  };
  writePrivate(path.join(rawDir, 'candidates.json'), JSON.stringify(out));

  process.stdout.write(
    'extract-dogfood scan: sessions=' + sessionFiles.length +
    ' stops=' + stops +
    ' live_blocks=' + liveBlocks +
    ' degrades=' + degrades +
    ' agreement=' + agreement +
    ' partial=' + partial + '\n'
  );
  return 0;
}

// ---------------------------------------------------------------------------
// runSelect(rawDir) -- mode 2.
// ---------------------------------------------------------------------------
function runSelect(rawDir) {
  refuseRawDirInsideRepo(rawDir);
  sha256Verify(rawDir);

  const candPath = path.join(rawDir, 'candidates.json');
  if (!fs.existsSync(candPath)) {
    process.stderr.write('extract-dogfood select: candidates.json missing, run --scan first\n');
    return 2;
  }
  const data = JSON.parse(fs.readFileSync(candPath, 'utf8'));
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];

  const nonAnchor = candidates.filter(function (c) { return !isAnchorExclusion(c.session, c.ts); });

  const liveBlocks = nonAnchor.filter(function (c) {
    return c.live_outcome === 'block' && c.envelope_partial !== true && !isRCCase(c.session, c.ts);
  });

  const rcCandidates = nonAnchor.filter(function (c) { return isRCCase(c.session, c.ts); });

  const passPool = nonAnchor.filter(function (c) {
    return c.live_outcome !== 'block' && c.envelope_partial !== true;
  });

  function stratumOf(c) {
    const hasSidechannel = c.envelope.mode.indexOf('sidechannel') !== -1;
    const cardFired = (c.envelope.transcript || []).some(function (r) {
      if (!r || r.type !== 'assistant' || !r.message || !Array.isArray(r.message.content)) return false;
      return r.message.content.some(function (b) { return b && b.type === 'tool_use' && /AskUserQuestion/i.test(b.name || ''); });
    });
    if (cardFired) return 'card_fired';
    if (hasSidechannel) return 'fresh_gate_pass';
    return 'no_gate_signal';
  }

  const byStratum = { card_fired: [], fresh_gate_pass: [], no_gate_signal: [] };
  for (const c of passPool) {
    byStratum[stratumOf(c)].push(c);
  }

  const selected = [];
  const strataCounts = {};

  for (const c of liveBlocks) {
    selected.push(Object.assign({}, c, { stratum: 'live_block' }));
  }
  strataCounts.live_block = liveBlocks.length;

  if (rcCandidates.length > 0) {
    selected.push(Object.assign({}, rcCandidates[0], { stratum: 'r_c_case', r_c_case: true }));
  }
  strataCounts.r_c_case = rcCandidates.length > 0 ? 1 : 0;

  const passStrataOrder = ['card_fired', 'fresh_gate_pass', 'no_gate_signal'];
  const perStratumTarget = Math.max(1, Math.ceil(Math.max(SELECT_MIN - selected.length, 0) / passStrataOrder.length));

  for (const key of passStrataOrder) {
    const pool = byStratum[key];
    const picked = pool.slice(0, perStratumTarget);
    let pickedCount = 0;
    for (const c of picked) {
      if (selected.length >= SELECT_MAX) break;
      selected.push(Object.assign({}, c, { stratum: key }));
      pickedCount += 1;
    }
    strataCounts[key] = pickedCount;
  }

  // Top up from any remaining pass pool (round-robin) until SELECT_MIN, capped at SELECT_MAX.
  const usedIds = new Set(selected.map(function (s) { return s.id; }));
  let topupCursor = 0;
  const flatRemainingPasses = passStrataOrder.reduce(function (acc, key) {
    return acc.concat(byStratum[key].filter(function (c) { return !usedIds.has(c.id); }));
  }, []);
  while (selected.length < SELECT_MIN && topupCursor < flatRemainingPasses.length) {
    const c = flatRemainingPasses[topupCursor];
    topupCursor += 1;
    if (usedIds.has(c.id)) continue;
    selected.push(Object.assign({}, c, { stratum: stratumOf(c) + '_topup' }));
    usedIds.add(c.id);
  }

  const out = {
    meta: { generated_at: new Date().toISOString(), raw_dir: rawDir },
    counts_by_stratum: strataCounts,
    total: selected.length,
    selected: selected,
  };
  writePrivate(path.join(rawDir, 'selected.json'), JSON.stringify(out));

  process.stdout.write(
    'extract-dogfood select: total=' + selected.length +
    ' live_block=' + strataCounts.live_block +
    ' r_c_case=' + strataCounts.r_c_case +
    ' card_fired=' + (strataCounts.card_fired || 0) +
    ' fresh_gate_pass=' + (strataCounts.fresh_gate_pass || 0) +
    ' no_gate_signal=' + (strataCounts.no_gate_signal || 0) + '\n'
  );
  return 0;
}

// ---------------------------------------------------------------------------
// runApplySanitized(rawDir, mapPath) -- mode 3.
// ---------------------------------------------------------------------------
async function runApplySanitized(rawDir, mapPath) {
  refuseRawDirInsideRepo(rawDir);
  sha256Verify(rawDir);
  banNetwork();

  const corpusLoader = require(path.join(REPO_ROOT, 'scripts', 'card-fire-replay-corpus.cjs'));
  const replayLib = require(path.join(REPO_ROOT, 'scripts', 'replay-card-fire.cjs'));

  const selectedPath = path.join(rawDir, 'selected.json');
  if (!fs.existsSync(selectedPath)) {
    process.stderr.write('extract-dogfood apply-sanitized: selected.json missing, run --select first\n');
    return 2;
  }
  const selectedData = JSON.parse(fs.readFileSync(selectedPath, 'utf8'));
  const selectedById = {};
  for (const c of (selectedData.selected || [])) selectedById[c.id] = c;

  if (!fs.existsSync(mapPath)) {
    process.stderr.write('extract-dogfood apply-sanitized: map file missing: ' + mapPath + '\n');
    return 2;
  }
  const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
  const mapEntries = Array.isArray(mapData.entries) ? mapData.entries : [];

  const denylist = readDenylist(rawDir);

  const existingDogfood = fs.existsSync(DOGFOOD_PATH)
    ? JSON.parse(fs.readFileSync(DOGFOOD_PATH, 'utf8'))
    : { meta: {}, entries: [] };
  const fileMeta = existingDogfood.meta;

  const codeRootResult = replayLib.prepareCodeRoot('pre-phase');

  const failures = [];
  const builtEntries = [];
  const reportRows = [];

  try {
    for (const mapEntry of mapEntries) {
      const id = mapEntry.id;
      const candidate = selectedById[id];
      if (!candidate) {
        failures.push(id + ': not present in selected.json');
        continue;
      }

      const mode = (Array.isArray(mapEntry.sidechannel_records) && mapEntry.sidechannel_records.length > 0)
        ? 'transcript+sidechannel'
        : 'transcript';

      const entry = {
        id: id,
        source: 'dogfood',
        envelope: {
          mode: mode,
          transcript: mapEntry.transcript,
          sidechannel_records: mode === 'transcript+sidechannel' ? mapEntry.sidechannel_records : undefined,
          counters: candidate.envelope.counters,
        },
        expected_verdict_class: mapEntry.proposed,
        label_origin: 'local',
        why: mapEntry.why,
      };
      if (mode !== 'transcript+sidechannel') delete entry.envelope.sidechannel_records;
      if (mapEntry.r_c_case === true) entry.r_c_case = true;

      const validationErrors = corpusLoader.validateEntry(entry, fileMeta);
      if (validationErrors.length > 0) {
        failures.push(id + ': validateEntry failed: ' + validationErrors.join('; '));
        continue;
      }

      let sanitizedResult;
      try {
        sanitizedResult = await replayLib.runEntry(entry, { codeRoot: codeRootResult.dir, surface: 'both' });
      } catch (e) {
        failures.push(id + ': runEntry threw: ' + e.message);
        continue;
      }

      const rawVerdict = candidate.raw_verdict || {};
      const sanCli = sanitizedResult.cli || {};
      const sanMcp = sanitizedResult.mcp || {};

      if (sanCli.class !== rawVerdict.class || sanCli.reason !== rawVerdict.reason) {
        failures.push(id + ': verdict not preserved (raw=' + rawVerdict.class + '/' + rawVerdict.reason +
          ' sanitized=' + sanCli.class + '/' + sanCli.reason + ')');
        continue;
      }
      const mcpDedup = sanMcp.dedup === true;
      if (!mcpDedup && sanMcp.class !== sanCli.class) {
        failures.push(id + ': CLI/MCP parity broken on sanitized entry (' + sanCli.class + ' vs ' + sanMcp.class + ')');
        continue;
      }

      const leakTargets = [JSON.stringify(entry), String(mapEntry.gist || '')];
      let leaked = false;
      for (const target of leakTargets) {
        const lc = leakCheck(target, denylist);
        if (!lc.ok) {
          failures.push(id + ': leak check hit: ' + lc.hits.map(function (h) { return h.id; }).join(','));
          leaked = true;
          break;
        }
      }
      if (leaked) continue;

      builtEntries.push(entry);
      reportRows.push({
        id: id,
        // WR-01 (357-REVIEW.md): the real production Stop verdict (from the
        // navigator's own live session), threaded through so the review
        // sheet can show it distinctly from the pre-phase replay verdict
        // (raw_verdict.class) below -- these are two different observations
        // that can legitimately disagree (that disagreement is exactly what
        // runScan's envelope_partial computes).
        live_outcome: candidate.live_outcome,
        raw_verdict: rawVerdict,
        sanitized_cli: { class: sanCli.class, reason: sanCli.reason },
        sanitized_mcp: { class: sanMcp.class },
        gist: mapEntry.gist,
      });
    }
  } finally {
    codeRootResult.cleanup();
  }

  if (failures.length > 0) {
    process.stdout.write('extract-dogfood apply-sanitized: FAILED ' + failures.length + ' id(s)\n');
    for (const f of failures) process.stdout.write('  ' + f + '\n');
    return 1;
  }

  const outDogfood = {
    meta: Object.assign({}, fileMeta, {
      verdict_preservation: 'checked',
      extracted_from: 'R-D snapshot (local only)',
      entry_count: builtEntries.length,
    }),
    entries: builtEntries,
  };
  fs.writeFileSync(DOGFOOD_PATH, JSON.stringify(outDogfood, null, 2) + '\n');
  writePrivate(path.join(rawDir, 'sanitize-report.json'), JSON.stringify({ rows: reportRows }));

  process.stdout.write('extract-dogfood apply-sanitized: wrote ' + builtEntries.length + ' entries\n');
  return 0;
}

// ---------------------------------------------------------------------------
// runWriteReviewSheet(rawDir, withHeadVerdicts) -- mode 4.
// ---------------------------------------------------------------------------
async function runWriteReviewSheet(rawDir, withHeadVerdicts) {
  const mapPath = path.join(rawDir, 'sanitized-map.json');
  const gistById = {};
  if (fs.existsSync(mapPath)) {
    const mapData = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
    for (const e of (mapData.entries || [])) gistById[e.id] = e.gist;
  }
  // The real live outcome / raw pre-phase verdict live only in the local
  // sanitize-report.json (raw dir, never committed) -- dogfood.json itself
  // carries the RATIFIED label (expected_verdict_class), not the raw
  // observation. Fall back to expected_verdict_class when the report is
  // unavailable (e.g. a fresh checkout with no raw dir).
  //
  // WR-01 (357-REVIEW.md): these are two DISTINCT sources, not one value
  // pushed into two columns. `liveOutcomeById` is the real production Stop
  // verdict the navigator's own live session produced (row.live_outcome,
  // sourced from candidates.json via runScan's transcript reconstruction).
  // `rawVerdictById` is the pre-phase REPLAY verdict on the original
  // candidate (row.raw_verdict.class). Both fall back to
  // expected_verdict_class only when the report row itself is missing.
  const reportPath = path.join(rawDir, 'sanitize-report.json');
  const rawVerdictById = {};
  const liveOutcomeById = {};
  if (fs.existsSync(reportPath)) {
    const reportData = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
    for (const row of (reportData.rows || [])) {
      rawVerdictById[row.id] = row.raw_verdict && row.raw_verdict.class;
      liveOutcomeById[row.id] = row.live_outcome;
    }
  }

  if (!fs.existsSync(DOGFOOD_PATH)) {
    process.stderr.write('extract-dogfood write-review-sheet: dogfood.json missing\n');
    return 2;
  }
  const dogfood = JSON.parse(fs.readFileSync(DOGFOOD_PATH, 'utf8'));
  const entries = Array.isArray(dogfood.entries) ? dogfood.entries : [];

  let replayLib = null;
  let headResults = {};
  if (withHeadVerdicts) {
    replayLib = require(path.join(REPO_ROOT, 'scripts', 'replay-card-fire.cjs'));
    banNetwork();
    for (const entry of entries) {
      try {
        const r = await replayLib.runEntry(entry, { surface: 'cli' });
        headResults[entry.id] = r.cli ? r.cli.class : 'error';
      } catch (_e) {
        headResults[entry.id] = 'error';
      }
    }
  }

  const lines = [];
  lines.push('# Phase 357-06: Dogfood label review sheet (D-06)');
  lines.push('');
  lines.push('The navigator ratifies every row below at the plan-08 checkpoint. A confirmed row');
  lines.push('flips its `label_origin` from `local` to `human`. Dogfood text never goes to Jev');
  lines.push('(D-06, D-11) -- every gist below is a sanitized paraphrase, never raw transcript text.');
  lines.push('');
  const headerCols = withHeadVerdicts
    ? '| id | gist | live outcome | pre-phase verdict | HEAD verdict | proposed | why |'
    : '| id | gist | live outcome | pre-phase verdict | proposed | why |';
  const sepCols = withHeadVerdicts
    ? '|----|------|---------------|--------------------|--------------|----------|-----|'
    : '|----|------|---------------|--------------------|----------|-----|';
  lines.push(headerCols);
  lines.push(sepCols);

  let rcEntry = null;
  for (const entry of entries) {
    if (entry.r_c_case === true) rcEntry = entry;
    const gist = gistById[entry.id] || entry.why || '';
    // WR-01: distinct columns, distinct sources -- never the same value twice.
    const liveOutcome = liveOutcomeById[entry.id] || entry.expected_verdict_class;
    const prePhaseVerdict = rawVerdictById[entry.id] || entry.expected_verdict_class;
    const cells = [
      entry.id,
      gist.replace(/\|/g, '/'),
      liveOutcome,
      prePhaseVerdict,
    ];
    if (withHeadVerdicts) cells.push(headResults[entry.id] || 'unknown');
    cells.push(entry.expected_verdict_class);
    cells.push((entry.why || '').replace(/\|/g, '/').slice(0, 200));
    lines.push('| ' + cells.join(' | ') + ' |');
  }
  lines.push('');

  lines.push('## R-C case');
  lines.push('');
  if (rcEntry) {
    const headV = withHeadVerdicts ? (headResults[rcEntry.id] || 'unknown') : 'not computed until plan 08';
    lines.push('The 09:20 human-typed block, session 0f86dd63 (RESEARCH Open Question 2, CONTEXT R-C).');
    lines.push('');
    lines.push('- id: ' + rcEntry.id);
    lines.push('- pre-phase verdict: ' + rcEntry.expected_verdict_class);
    lines.push('- HEAD verdict: ' + headV);
    lines.push('- why: ' + (rcEntry.why || ''));
    lines.push('');
    lines.push('Question: is this a genuine relevant fork (block), or a false block with no');
    lines.push('deterministic rule to clear it (pass, recorded as known_false_block with a');
    lines.push('text-dependence reason and a follow-on phase opened)?');
  } else {
    lines.push('No r_c_case entry found in dogfood.json.');
  }
  lines.push('');

  lines.push('## How to answer');
  lines.push('');
  lines.push('Reply `approved`, or one line per correction: `<id>: block|pass <reason>`.');
  lines.push('For the R-C case: `r-c: block` or `r-c: known_false_block <reason>`.');
  lines.push('');

  fs.writeFileSync(REVIEW_SHEET_PATH, lines.join('\n') + '\n');
  process.stdout.write('extract-dogfood write-review-sheet: wrote ' + REVIEW_SHEET_PATH + '\n');
  return 0;
}

// ---------------------------------------------------------------------------
// runLeakCheck(rawDir, files) -- mode 5.
// ---------------------------------------------------------------------------
function runLeakCheck(rawDir, files) {
  const denylist = readDenylist(rawDir);
  let anyHit = false;
  for (const f of files) {
    const abs = path.resolve(f);
    let text;
    try {
      text = fs.readFileSync(abs, 'utf8');
    } catch (e) {
      process.stdout.write(f + ': read-error\n');
      anyHit = true;
      continue;
    }
    const lc = leakCheck(text, denylist);
    if (!lc.ok) {
      anyHit = true;
      for (const hit of lc.hits) {
        process.stdout.write(f + ': ' + hit.id + '\n');
      }
    }
  }
  return anyHit ? 1 : 0;
}

// ---------------------------------------------------------------------------
// parseArgs / main
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const opts = { mode: null, rawDir: DEFAULT_RAW_DIR, files: [], withHeadVerdicts: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '--scan': opts.mode = 'scan'; break;
      case '--select': opts.mode = 'select'; break;
      case '--apply-sanitized': opts.mode = 'apply-sanitized'; opts.mapPath = argv[i += 1]; break;
      case '--write-review-sheet': opts.mode = 'write-review-sheet'; break;
      case '--leak-check':
        opts.mode = 'leak-check';
        while (i + 1 < argv.length && argv[i + 1].indexOf('--') !== 0) {
          opts.files.push(argv[i += 1]);
        }
        break;
      case '--with-head-verdicts': opts.withHeadVerdicts = true; break;
      case '--raw-dir': opts.rawDir = argv[i += 1]; break;
      default:
        break;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let code = 0;
  try {
    if (opts.mode === 'scan') {
      code = await runScan(opts.rawDir);
    } else if (opts.mode === 'select') {
      code = runSelect(opts.rawDir);
    } else if (opts.mode === 'apply-sanitized') {
      code = await runApplySanitized(opts.rawDir, opts.mapPath);
    } else if (opts.mode === 'write-review-sheet') {
      code = await runWriteReviewSheet(opts.rawDir, opts.withHeadVerdicts);
    } else if (opts.mode === 'leak-check') {
      code = runLeakCheck(opts.rawDir, opts.files);
    } else {
      process.stderr.write('extract-dogfood-stop-events: no mode given (--scan|--select|--apply-sanitized|--write-review-sheet|--leak-check)\n');
      code = 2;
    }
  } catch (e) {
    process.stderr.write('[extract-dogfood-stop-events] ' + (e && e.message ? e.message : String(e)) + '\n');
    code = 2;
  }
  process.exitCode = code;
}

module.exports = {
  recoverSubject: recoverSubject,
  classifyStopOutcome: classifyStopOutcome,
  buildCandidate: buildCandidate,
  leakCheck: leakCheck,
  extractMintsFromStdout: extractMintsFromStdout,
  walkSession: walkSession,
  isStopHookFeedbackRecord: isStopHookFeedbackRecord,
  sha256Verify: sha256Verify,
  main: main,
};

if (require.main === module) {
  main();
}
