#!/usr/bin/env node
'use strict';

/**
 * memory-lifecycle.cjs (Phase 84-03)
 *
 * Thin CLI that every SessionStart, Stop, PreCompact, PostCompact hook calls
 * into so the memory layer (lib/core/memory-ops.cjs) becomes load-bearing and
 * observable to Claude. Scoped strictly to the currently active room from
 * ~/MindrianRooms/.rooms/registry.json (Phase 83 canonical source).
 *
 * Subcommands:
 *   session-start <roomDir>   Open db, startSession, write pointer, fetch
 *                             history, emit RECENT SESSIONS block on stdout.
 *   stop <roomDir>            Read pointer, incrementally ingest new
 *                             transcript turns, upsert the session-summary
 *                             fragment, endSession (idempotent refresh),
 *                             write a FRESH voice_log row. Pointer is KEPT
 *                             (see Stop cardinality fix below).
 *   pre-compact <roomDir>     Read pointer, endSession. Pointer kept.
 *   post-compact <roomDir>    startSession new id, overwrite pointer,
 *                             addFragment(role='post-compact') marker.
 *
 * Stop cardinality fix (debug session
 * stale-voice-log-session-summary-banner-frozen-after-first-stop, 2026-07-06):
 * Claude Code's Stop hook fires after EVERY assistant turn, not once per
 * session (SessionStart:Stop is 1:N, not 1:1). cmdStop used to delete the
 * session pointer unconditionally in `finally`, so only the FIRST Stop event
 * of a session ever did real work; every later Stop found no pointer and
 * silently no-op'd, freezing voice_log/fragments/summary at turn 1 forever.
 * The fix: cmdStop no longer deletes the pointer. It is now safe -- and
 * REQUIRED -- to run on every Stop event:
 *   - ingestTranscriptFragments is INCREMENTAL (slices the parsed transcript
 *     by how many user/assistant fragments already exist for this session),
 *     so each call only inserts the NEW turns since the last Stop, never
 *     re-inserting or skipping.
 *   - the 'session-summary' fragment is UPSERTED (one row per session,
 *     refreshed in place) so repeated per-turn Stops cannot grow it
 *     unboundedly and pollute fragment-window readers (e.g.
 *     navigation/room-context.cjs Leg B).
 *   - memory.endSession is idempotent-safe to call every turn (a plain
 *     UPDATE keyed on session id; verified no reader anywhere treats
 *     `ended_at IS NULL` as a "session still live" signal), so it keeps
 *     running per-turn rather than needing a separate termination signal.
 *   - writeVoiceLogRow/writeVoiceLogStub already insert a new row per call,
 *     which is exactly what makes the Stop-hook banner advance every turn.
 * The pointer is only ever replaced (not deleted) at the next real
 * SessionStart, which simply overwrites it with the new session's id --
 * no orphan-cleanup pass is needed since endSession has already been kept
 * fresh through the prior session's own per-turn Stops.
 *
 * Design notes:
 *   - The "role" values 'session-summary' and 'post-compact' are intentionally
 *     new free-string values on the fragments table. The schema treats role as
 *     TEXT NOT NULL with no enum. Documented in 84-CONTEXT D-03.
 *   - Conversation intake (quick task 260612-pkb): on Stop and PreCompact the
 *     handlers now ingest the real user/assistant turns from the transcript at
 *     MINDRIAN_TRANSCRIPT_PATH (exported by scripts/on-stop) into the closing
 *     session's fragments table, scoped to the active room's room.db ONLY
 *     (Canon Part 8: no Brain egress). When real fragments exist the summary is
 *     extractive over those turns (transcript-ingest.buildSummary, 3-5
 *     sentences); this supersedes the D-12 "last 3 fragments, 500 chars" stub
 *     for the populated case. With no transcript / empty transcript the legacy
 *     stub path is byte-identical to before.
 *   - v1.10.8 session summaries are deliberately minimal (last 3 fragments
 *     concatenated, truncated to 500 chars) per 84-CONTEXT D-12. This is now the
 *     fallback used only when no conversation fragments were ingested. The
 *     synthesis voice will replace this with a real summarizer in a later release.
 *   - post-compact creates a NEW session id; the pre-compact handler closed
 *     the old one. Compact is a context discontinuity.
 *   - A stale .mindrian/current-session.json pointer (from a crashed session)
 *     causes the next session-start to simply create a new session row. No
 *     cleanup needed. Documented here.
 *   - No writes outside the active room directory. Phase 83 write-scope-check
 *     hook enforces this at the filesystem level too.
 *   - All failure modes are silent no-ops that exit 0. Hooks must never crash
 *     the session because memory is broken.
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOM_DB_MODULE = path.join(__dirname, '..', 'lib', 'core', 'room-db.cjs');

// ---------------------------------------------------------------------------
// Active room resolution (Phase 83 canonical registry)
// ---------------------------------------------------------------------------

function resolveRoomsRoot() {
  if (process.env.MINDRIAN_ROOMS_ROOT && process.env.MINDRIAN_ROOMS_ROOT.trim()) {
    return process.env.MINDRIAN_ROOMS_ROOT.trim();
  }
  const home = process.env.HOME || '';
  if (home) {
    const candidate = path.join(home, 'MindrianRooms');
    if (fs.existsSync(candidate)) return candidate;
  }
  return '';
}

function resolveActiveRoomDir() {
  const root = resolveRoomsRoot();
  if (!root) return '';
  const registry = path.join(root, '.rooms', 'registry.json');
  if (!fs.existsSync(registry)) return '';
  try {
    const raw = fs.readFileSync(registry, 'utf8');
    const parsed = JSON.parse(raw);
    const active = (parsed && typeof parsed.active === 'string') ? parsed.active.trim() : '';
    if (!active) return '';
    const dir = path.join(root, active);
    if (!fs.existsSync(dir)) return '';
    return dir;
  } catch (_) {
    return '';
  }
}

// Effective room dir: if an explicit argv path is provided AND exists, honor
// it (test fixtures). Otherwise fall back to the registry-resolved active.
function effectiveRoomDir(argPath) {
  if (argPath && typeof argPath === 'string' && fs.existsSync(argPath)) {
    return argPath;
  }
  return resolveActiveRoomDir();
}

// ---------------------------------------------------------------------------
// Session pointer file
// ---------------------------------------------------------------------------

function pointerPath(roomDir) {
  return path.join(roomDir, '.mindrian', 'current-session.json');
}

function readPointer(roomDir) {
  const p = pointerPath(roomDir);
  if (!fs.existsSync(p)) return null;
  try {
    const parsed = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (parsed && typeof parsed.id === 'number') return parsed;
    return null;
  } catch (_) {
    return null;
  }
}

function writePointer(roomDir, id, startedAt) {
  const dir = path.join(roomDir, '.mindrian');
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_) { /* ignore */ }
  fs.writeFileSync(
    pointerPath(roomDir),
    JSON.stringify({ id: id, started_at: startedAt }, null, 2)
  );
}

// Not called by cmdStop as of the Stop-cardinality fix (2026-07-06) -- Stop
// no longer deletes the pointer (see cmdStop's finally block). Kept as a
// utility for the session-start overwrite path and any future explicit
// pointer-reset need.
function deletePointer(roomDir) {
  try {
    fs.unlinkSync(pointerPath(roomDir));
  } catch (_) { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Summary extraction (minimal v1.10.8 algorithm per D-12)
// ---------------------------------------------------------------------------

function summarizeSession(db, sessionId) {
  try {
    const rows = db.prepare(
      'SELECT role, content FROM fragments WHERE session_id = ? ORDER BY timestamp DESC LIMIT 3'
    ).all(sessionId);
    if (!rows || rows.length === 0) return '';
    const parts = rows.reverse().map((r) => r.content || '');
    const joined = parts.join(' | ');
    return joined.slice(0, 500);
  } catch (_) {
    return '';
  }
}

// ---------------------------------------------------------------------------
// RECENT SESSIONS block formatter
// ---------------------------------------------------------------------------

function formatHistoryBlock(sessions) {
  if (!sessions || sessions.length === 0) return '';
  const lines = [];
  lines.push('## RECENT SESSIONS IN THIS ROOM');
  lines.push('');
  lines.push('The following sessions are recorded in the active room\'s memory layer');
  lines.push('(lib/core/memory-ops.cjs, room/.mindrian/room.db). This is real cross-session');
  lines.push('memory for THIS room only. It does not reach any other room on this machine.');
  lines.push('');
  for (const s of sessions) {
    const when = s.started_at || 'unknown-time';
    const sid = typeof s.id === 'number' ? s.id : 'unknown';
    const summary = (s.summary && String(s.summary).trim()) || 'no summary yet';
    lines.push('- ' + when + ' session ' + sid + ': ' + summary);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Subcommand: session-start
// ---------------------------------------------------------------------------

async function cmdSessionStart(roomDir) {
  const { openRoomDb, closeRoomDb } = require(ROOM_DB_MODULE);
  const memory = require(path.join(__dirname, '..', 'lib', 'core', 'memory-ops.cjs'));

  const handle = { db: openRoomDb(roomDir) };
  try {
    const session = await memory.startSession(handle.db);
    writePointer(roomDir, session.id, session.started_at);

    const limitRaw = parseInt(process.env.MINDRIAN_MEMORY_HISTORY_LIMIT || '5', 10);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 5;

    // Prior sessions exclude the just-created row: fetch limit+1 then drop the
    // newest if it matches the new id.
    const rows = await memory.getSessionHistory(handle.db, limit + 1);
    const prior = rows.filter((r) => r.id !== session.id).slice(0, limit);

    const block = formatHistoryBlock(prior);
    if (block) process.stdout.write(block + '\n');
  } finally {
    await closeRoomDb(handle);
  }
}

// ---------------------------------------------------------------------------
// Helpers: fragment harvest + artifact/contradiction extraction (84-07)
// ---------------------------------------------------------------------------

const FRAGMENT_HARVEST_CAP = 500;

// Quick task 260612-pkb: conversation intake helper. Reads MINDRIAN_TRANSCRIPT_PATH,
// parses the transcript offline, and writes the real user/assistant turns into
// the given session as 'user'/'assistant' fragments.
//
// INCREMENTAL as of the Stop-cardinality fix (2026-07-06): Claude Code's
// transcript file is cumulative (append-only across the whole session), so
// parseTranscript(transcriptPath) always returns the FULL ordered turn list
// from the start of the session through "now". Rather than a one-shot
// all-or-nothing guard (which froze ingestion at turn 1 once cmdStop started
// running every turn), this slices off the leading N turns already stored
// (N = count of existing user/assistant fragments for this session) and
// inserts only the DELTA. Safe to call every Stop event: turn 1 inserts
// turns[0:], turn 2 inserts turns[N1:], etc. Never re-inserts, never skips.
// (Edge case, accepted as out of scope: transcript-ingest.cjs caps parsed
// output at MAX_FRAGMENTS=1000 turns; a session that blows past that cap
// could desync the slice-by-count math. Not addressed here -- no session in
// practice approaches 1000 turns.)
// Every path is graceful: no env var, an unreadable transcript, or a
// per-fragment write error are silent no-ops. LOCAL-only (Canon Part 8): the
// parser does pure local read+parse, and rows are written only to the active
// room's room.db. No network, no Brain.
async function ingestTranscriptFragments(db, sessionId, memory, transcriptIngest) {
  const transcriptPath = process.env.MINDRIAN_TRANSCRIPT_PATH || '';
  if (!transcriptPath) return;

  let alreadyHas = 0;
  try {
    const row = db.prepare(
      "SELECT COUNT(*) AS n FROM fragments WHERE session_id = ? AND role IN ('user','assistant')"
    ).get(sessionId);
    alreadyHas = (row && row.n) || 0;
  } catch (_) {
    alreadyHas = 0;
  }

  const turns = transcriptIngest.parseTranscript(transcriptPath); // [] on any failure
  const newTurns = turns.slice(alreadyHas); // only the delta since the last Stop
  for (const t of newTurns) {
    if (!t || !t.content) continue;
    try {
      await memory.addFragment(db, {
        session_id: sessionId,
        role: t.role === 'assistant' ? 'assistant' : 'user',
        content: t.content,
      });
    } catch (_) { /* per-fragment graceful */ }
  }
}

// Upsert the single 'session-summary' fragment for a session. One row per
// session, refreshed in place on every Stop event -- NOT appended -- so a
// long session with many Stop events cannot grow an unbounded number of
// session-summary rows that would dilute fragment-window readers (e.g.
// navigation/room-context.cjs Leg B's "last ~6 fragments" window). No other
// reader in this codebase filters fragments by role='session-summary'
// directly, so refreshing in place is a pure improvement with no downstream
// consumer depending on the prior append-only history of this role.
async function upsertSessionSummaryFragment(db, sessionId, content) {
  const timestamp = new Date().toISOString();
  const safeContent = typeof content === 'string' && content ? content : 'session ended';
  try {
    const existing = db.prepare(
      "SELECT id FROM fragments WHERE session_id = ? AND role = 'session-summary' ORDER BY id DESC LIMIT 1"
    ).get(sessionId);
    if (existing && existing.id) {
      db.prepare('UPDATE fragments SET content = ?, timestamp = ? WHERE id = ?')
        .run(safeContent, timestamp, existing.id);
      return { id: existing.id, session_id: sessionId, timestamp };
    }
    const info = db.prepare(
      'INSERT INTO fragments (session_id, role, content, timestamp) VALUES (?, ?, ?, ?)'
    ).run(sessionId, 'session-summary', safeContent, timestamp);
    return { id: Number(info.lastInsertRowid), session_id: sessionId, timestamp };
  } catch (_) {
    return null; // advisory: never crash the Stop hook over the summary fragment
  }
}

function loadAllFragments(db, sessionId) {
  try {
    const rows = db.prepare(
      'SELECT id, role, content, timestamp FROM fragments WHERE session_id = ? ORDER BY timestamp ASC, id ASC LIMIT ?'
    ).all(sessionId, FRAGMENT_HARVEST_CAP);
    return Array.isArray(rows) ? rows : [];
  } catch (_) {
    return [];
  }
}

function pickFirstByRole(fragments, role) {
  for (const f of fragments) {
    if (f && f.role === role && typeof f.content === 'string' && f.content) return f;
  }
  return null;
}

function pickLastByRole(fragments, role) {
  for (let i = fragments.length - 1; i >= 0; i--) {
    const f = fragments[i];
    if (f && f.role === role && typeof f.content === 'string' && f.content) return f;
  }
  return null;
}

function extractArtifactIds(fragments) {
  // Naive scan: pick obvious artifact-id-shaped tokens from content (paths,
  // [[wikilinks]], OPP-XX style ids). Best-effort, dedupe, cap at 25.
  const out = new Set();
  const wikilink = /\[\[([^\]]+)\]\]/g;
  const idLike = /\b([A-Z]{2,6}-\d{2,5})\b/g;
  for (const f of fragments) {
    if (!f || typeof f.content !== 'string') continue;
    let m;
    while ((m = wikilink.exec(f.content)) !== null) {
      if (m[1]) out.add(m[1].trim());
      if (out.size >= 25) return Array.from(out);
    }
    while ((m = idLike.exec(f.content)) !== null) {
      if (m[1]) out.add(m[1]);
      if (out.size >= 25) return Array.from(out);
    }
  }
  return Array.from(out);
}

function loadContradictionIds(roomDir) {
  // Best-effort read of .proactive-intelligence.json contradictions section.
  // Empty array on any failure (advisory contract).
  try {
    const p = path.join(roomDir, '.proactive-intelligence.json');
    if (!fs.existsSync(p)) return [];
    const j = JSON.parse(fs.readFileSync(p, 'utf8'));
    if (!j) return [];
    const candidates = j.contradictions || j.held_contradictions || [];
    if (!Array.isArray(candidates)) return [];
    return candidates
      .map((c) => (c && (c.id || c.contradiction_id)) || null)
      .filter((x) => x !== null && x !== undefined)
      .slice(0, 25);
  } catch (_) {
    return [];
  }
}

function resolveSessionCommand(db, sessionId) {
  try {
    const row = db.prepare('SELECT methodology_used FROM sessions WHERE id = ?').get(sessionId);
    if (row && typeof row.methodology_used === 'string' && row.methodology_used) {
      return row.methodology_used;
    }
  } catch (_) { /* fall through */ }
  return 'session-summary';
}

// ---------------------------------------------------------------------------
// Subcommand: stop
// ---------------------------------------------------------------------------

async function cmdStop(roomDir) {
  const pointer = readPointer(roomDir);
  if (!pointer) return; // no active session, nothing to close

  const { openRoomDb, closeRoomDb } = require(ROOM_DB_MODULE);
  const memory = require(path.join(__dirname, '..', 'lib', 'core', 'memory-ops.cjs'));
  const transcriptIngest = require(path.join(__dirname, 'transcript-ingest.cjs'));

  const handle = { db: openRoomDb(roomDir) };
  try {
    // Quick task 260612-pkb: conversation intake. Before summarizing, ingest
    // the real conversation turns from MINDRIAN_TRANSCRIPT_PATH (exported by
    // scripts/on-stop) into the still-OPEN session. INCREMENTAL as of the
    // Stop-cardinality fix: Stop fires every turn, so this only inserts the
    // turns new since the last Stop (see ingestTranscriptFragments doc above).
    // LOCAL-only (Canon Part 8): parseTranscript reads a local file and the
    // rows land in the active room's room.db; no Brain egress.
    await ingestTranscriptFragments(handle.db, pointer.id, memory, transcriptIngest);

    // Summary: when real user/assistant fragments exist, build the extractive
    // multi-sentence summary; otherwise fall back to the legacy stub behavior.
    const convoForSummary = loadAllFragments(handle.db, pointer.id)
      .filter((f) => f && (f.role === 'user' || f.role === 'assistant'));
    const summary = convoForSummary.length > 0
      ? transcriptIngest.buildSummary(convoForSummary)
      : summarizeSession(handle.db, pointer.id);
    await upsertSessionSummaryFragment(handle.db, pointer.id, summary || 'session ended');
    await memory.endSession(handle.db, pointer.id, {
      summary: summary || null,
      key_decisions: [],
      open_questions: [],
      artifacts_filed: [],
    });

    // 84-07 writer: build a structured voice_log row from session fragments.
    // If there are no fragments at all, fall through to the stub for parity
    // with v1.10.8 behavior.
    const fragments = loadAllFragments(handle.db, pointer.id);
    if (fragments.length > 0) {
      const firstUser = pickFirstByRole(fragments, 'user');
      const lastAssistant = pickLastByRole(fragments, 'assistant');
      const command = resolveSessionCommand(handle.db, pointer.id);
      const question = firstUser ? firstUser.content : null;
      const answerSummary = (lastAssistant && lastAssistant.content) || summary || null;
      const artifactsCited = extractArtifactIds(fragments);
      const contradictionsFlagged = loadContradictionIds(roomDir);

      await memory.writeVoiceLogRow(handle.db, {
        command: command,
        question: question,
        answer_summary: answerSummary,
        artifacts_cited: artifactsCited,
        confidence: null,
        contradictions_flagged: contradictionsFlagged,
      });
    } else {
      await memory.writeVoiceLogStub(handle.db, {
        command: 'session-summary',
        answer_summary: summary || null,
      });
    }
  } finally {
    await closeRoomDb(handle);
    // Stop-cardinality fix: do NOT delete the pointer here. Stop fires once
    // per assistant turn (not once per session); deleting the pointer after
    // the FIRST Stop event made every later Stop in the same session a
    // silent no-op (readPointer returns null -> early return above), which
    // is the root cause this fix addresses. The pointer is only ever
    // replaced by the NEXT session-start's writePointer call, mirroring
    // cmdPreCompact's existing "pointer kept" pattern.
  }
}

// ---------------------------------------------------------------------------
// Subcommand: read-voice-tail (84-07 reader API)
// ---------------------------------------------------------------------------

async function cmdReadVoiceTail(roomDir, _sessionIdArg) {
  // sessionIdArg accepted for forward compatibility; v1.10.8 voice_log has no
  // session_id column so we return the latest row for the active room db.
  // Empty stdout literal "null" on no row, on error, or on missing room.
  const { openRoomDb, closeRoomDb } = require(ROOM_DB_MODULE);
  const memory = require(path.join(__dirname, '..', 'lib', 'core', 'memory-ops.cjs'));

  let handle = null;
  try {
    handle = { db: openRoomDb(roomDir) };
    const row = await memory.readVoiceLogTail(handle.db);
    if (!row) {
      process.stdout.write('null\n');
      return;
    }
    process.stdout.write(JSON.stringify(row) + '\n');
  } catch (_) {
    process.stdout.write('null\n');
  } finally {
    if (handle) {
      try { await closeRoomDb(handle); } catch (_) { /* ignore */ }
    }
  }
}

// ---------------------------------------------------------------------------
// Subcommand: pre-compact
// ---------------------------------------------------------------------------

async function cmdPreCompact(roomDir) {
  const pointer = readPointer(roomDir);
  if (!pointer) return;

  const { openRoomDb, closeRoomDb } = require(ROOM_DB_MODULE);
  const memory = require(path.join(__dirname, '..', 'lib', 'core', 'memory-ops.cjs'));
  const transcriptIngest = require(path.join(__dirname, 'transcript-ingest.cjs'));

  const handle = { db: openRoomDb(roomDir) };
  try {
    // Quick task 260612-pkb: a compact boundary is a context discontinuity
    // (Context Volatility failure mode #1). Capture the conversation before it
    // is discontinued, mirroring cmdStop. Same idempotency guard; LOCAL-only.
    await ingestTranscriptFragments(handle.db, pointer.id, memory, transcriptIngest);

    const convoForSummary = loadAllFragments(handle.db, pointer.id)
      .filter((f) => f && (f.role === 'user' || f.role === 'assistant'));
    const summary = convoForSummary.length > 0
      ? transcriptIngest.buildSummary(convoForSummary)
      : summarizeSession(handle.db, pointer.id);
    await memory.endSession(handle.db, pointer.id, {
      summary: summary || null,
      key_decisions: [],
      open_questions: [],
      artifacts_filed: [],
    });
  } finally {
    await closeRoomDb(handle);
    // Do NOT delete pointer: post-compact will overwrite it.
  }
}

// ---------------------------------------------------------------------------
// Subcommand: post-compact
// ---------------------------------------------------------------------------

async function cmdPostCompact(roomDir) {
  const { openRoomDb, closeRoomDb } = require(ROOM_DB_MODULE);
  const memory = require(path.join(__dirname, '..', 'lib', 'core', 'memory-ops.cjs'));

  const handle = { db: openRoomDb(roomDir) };
  try {
    const session = await memory.startSession(handle.db);
    writePointer(roomDir, session.id, session.started_at);
    await memory.addFragment(handle.db, {
      session_id: session.id,
      role: 'post-compact',
      content: 'session resumed after auto-compact context discontinuity',
    });
  } finally {
    await closeRoomDb(handle);
  }
}

// ---------------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------------

function usage() {
  process.stderr.write(
    'usage: memory-lifecycle.cjs <session-start|stop|pre-compact|post-compact|read-voice-tail> [sessionIdOrRoomDir] [roomDir]\n'
  );
}

async function main() {
  const sub = process.argv[2];

  if (!sub) {
    usage();
    process.exit(1);
  }

  // read-voice-tail has a different argv shape: arg[3] is the session id (for
  // forward compat), arg[4] is the optional roomDir override. All other
  // subcommands accept arg[3] as roomDir.
  let argPath;
  let voiceSessionArg;
  if (sub === 'read-voice-tail') {
    voiceSessionArg = process.argv[3];
    argPath = process.argv[4];
  } else {
    argPath = process.argv[3];
  }

  const roomDir = effectiveRoomDir(argPath);
  if (!roomDir) {
    // Graceful no-op: no active room, no registry, or room missing.
    if (sub === 'read-voice-tail') process.stdout.write('null\n');
    process.exit(0);
  }

  try {
    switch (sub) {
      case 'session-start': await cmdSessionStart(roomDir); break;
      case 'stop': await cmdStop(roomDir); break;
      case 'pre-compact': await cmdPreCompact(roomDir); break;
      case 'post-compact': await cmdPostCompact(roomDir); break;
      case 'read-voice-tail': await cmdReadVoiceTail(roomDir, voiceSessionArg); break;
      default:
        usage();
        process.exit(1);
    }
  } catch (err) {
    // Last-resort graceful no-op. Log to stderr at debug level so the hook
    // log still records something, but never crash the session.
    if (process.env.MINDRIAN_MEMORY_DEBUG === '1') {
      process.stderr.write('[memory-lifecycle] ' + sub + ' failed: ' + (err && err.message ? err.message : String(err)) + '\n');
    }
    if (sub === 'read-voice-tail') process.stdout.write('null\n');
    process.exit(0);
  }
}

main();
