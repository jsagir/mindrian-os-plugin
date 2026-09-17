'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 209-06 (H3) -- the PRIMARY side-channel writer + reader.
 *
 * scripts/check-card-fire.cjs's PRIMARY (registry-keyed) detection has been
 * documented INERT since Phase 179: "a repo-wide grep finds ZERO producers
 * of ran_entries / reached_gate_entries" (its own doctrine header, :46-54).
 * This module is that producer's shared writer/reader, called from the
 * three places that mint a Shape-F gate envelope (H3's three sites):
 *   1. lib/hmi/selector-dispatcher.cjs's pickShape trailer door
 *   2. scripts/intent-classifier.cjs's engine-arm seam
 *   3. scripts/intent-classifier.cjs's emitBindingGate (F.8)
 *
 * SCHEMA NOTE (a deliberate departure from the plan's illustrative "surface#
 * shape" example): scripts/check-card-fire.cjs's gateReachingEntries() derives
 * its PRIMARY match set from data/render-coverage-registry.json's .cjs-
 * keyspace `entry` field, which is a BARE FILE PATH (e.g.
 * "lib/hmi/selector-dispatcher.cjs") with no "#shape" suffix (verified
 * live: every .cjs entry's `entry` value is the bare path). classifyCardFire
 * intersects `ran_entries` against that exact string set
 * (`ran.some(e => reaching.has(e))`). Recording "surface#shape" composite
 * strings would therefore NEVER intersect the registry and PRIMARY would
 * stay functionally inert despite being "wired" - the opposite of this
 * plan's purpose. So `readReachedGates` returns BARE surface-path strings
 * (matching the registry exactly); `shape` is still recorded and stored
 * per-entry for diagnostics, it is simply not concatenated into the
 * matched key.
 *
 * Never-throw contract (T-209-24): every fs operation is wrapped in
 * try/catch. A read failure (missing file, corrupt JSON, an oversized file)
 * degrades to []; a write failure is a silent no-op. Neither ever blocks the
 * 3000ms Stop-hook budget or crashes it.
 *
 * TTL (~10 minutes - a turn-scoped signal, generous for slow turns) +
 * size cap (~64KB, oldest-first truncation) keep the side-file bounded,
 * mirroring the existing card-fire-retries.json WR-02 discipline but with
 * an ADDITIONAL size cap (the retry store bounds only by TTL; this file can
 * also grow wide across many concurrent sessions, so both floors apply).
 * Writes are atomic (tmp file + rename) so a crash mid-write cannot corrupt
 * the file for a concurrent reader.
 *
 * Canon Part 8: records carry only { entry: <registry surface path>,
 * shape: <enum>, ts: <epoch ms> } - registry-keyed scalars, zero user text,
 * zero room content, LOCAL only (~/.mindrian). No Brain require, no
 * network. House rule: hyphens only, no em-dashes.
 *
 * 2026-07-05, the relevance-gate PRIMARY-path fix: records ADDITIVELY also
 * carry an OPTIONAL, bounded `subject` field (MAX_SUBJECT_CHARS = 300 chars,
 * sanitized + truncated, see sanitizeSubjectText below). This is a
 * deliberate, bounded departure from the "zero user text, zero room content"
 * phrasing above, not an unbounded one: `subject` carries the gate's OWN
 * rendered header/body/label text, computed at the presentation seam (the
 * gate's own content, e.g. `result.rendered.zones.header/body`), never raw
 * free-typed user chat. It stays LOCAL-only (~/.mindrian), never egresses to
 * Brain, and feeds ONLY scripts/check-card-fire.cjs's local relevance
 * predicate (gateTopicallyRelevant). Omitting `subjectText` at a call site
 * yields `subject: ''`, fully backward compatible with every pre-existing
 * record.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

// WR-02-style TTL: a turn-scoped signal. 10 minutes is generous for a slow
// turn while keeping the side-file from accumulating stale sessions.
const TTL_MS = 10 * 60 * 1000;

// Oldest-first truncation kicks in above this size. Generous for many
// concurrent sessions' worth of entries while still bounding the file.
const SIZE_CAP_BYTES = 64 * 1024;

// TURN_FRESH_MS -- the turn-scoped freshness window. TTL_MS above bounds the
// FILE (so it does not accumulate stale sessions); "a gate was reached THIS
// turn" is a far tighter signal than "some gate was minted in the last 10
// minutes". A gate reached this turn was minted seconds ago (the producer
// records it mid-turn, the Stop hook reads it at turn end, and every force
// retry re-records it fresh); a mint that is minutes old is a PRIOR turn's -- or
// a prior session's -- reach bleeding forward through the file TTL. 2 minutes is
// generous for a slow turn's own mint-to-Stop-hook gap while sitting far below
// the 3-to-21-minute cross-turn / cross-session bleed the live incident log
// showed. Used by fix (B): exposes the most-recent mint ts so the consumer can
// tell a fresh gate from a stale one, within a single session's OWN bucket.
// (Fix (A)'s original job -- scoping a NO_SESSION_KEY union to this window so a
// sessionless mint cannot leak across sessions -- was superseded 2026-09-17:
// a time window narrows a cross-session leak's probability, it cannot close
// it, so the union itself was removed rather than re-windowed again. See
// scopedRecords' own doc comment.)
// card-fire-over-enforcement (2026-07-20).
const TURN_FRESH_MS = 2 * 60 * 1000;

// stop-hook-fires-card-on-option-shaped-prose-sentence / card-fire-stale-f1-reach-
// suggestion-forces-block-regardless-of-relevance (2026-09-17, SECOND pass):
// this module used to export a SESSIONLESS_UNION_WINDOW_MS (20s) constant here,
// narrowing (not closing) the NO_SESSION_KEY union window in scopedRecords below.
// That FIRST pass was live-disconfirmed: the union unconditionally folds EVERY
// no-session record younger than the window into ANY session's read, with ZERO
// session-identity check -- narrowing the window only lowers the probability of a
// concurrent peer session's mint colliding with an unrelated session's read, it
// does not make the collision impossible, and live re-fire (with the 20s fix
// already on disk) confirmed the residual is real, not theoretical, on a machine
// running several concurrent Claude Code sessions in the same room. The window
// constant and the union it gated are BOTH removed below (see scopedRecords'
// updated doc comment): the real fix is (a) lib/hmi/selector-dispatcher.cjs's
// pickShape trailer door -- the ONLY producer that ever wrote into
// NO_SESSION_KEY -- now threads process.env.CLAUDE_CODE_SESSION_ID (a real,
// live-verified-matching session id, see that file's own updated comment) into
// its recordReachedGate call, so its mints land in a REAL session bucket
// directly and almost never need NO_SESSION_KEY at all; and (b), as a
// defense-in-depth floor for the residual case where no real session id resolves
// at all (a non-CLI invocation, a bare unit test), a NO_SESSION_KEY record is
// simply never unioned into any other session's read, at any age -- degrading to
// "invisible to every other session" rather than "leaks into every other
// session."

// A record with no resolvable session_id (the Stop stdin session_id is
// absent at the mint site) files under this degenerate bucket rather than
// being dropped silently, so the consumer can still see SOMETHING reached a
// gate even without a session key. Documented, not a silent gap.
const NO_SESSION_KEY = 'no-session';

// Bounded, LOCAL-only. Enough subject-token signal for gateTopicallyRelevant's
// token-overlap check, far short of the 64KB side-file size cap.
const MAX_SUBJECT_CHARS = 300;

/**
 * sanitizeSubjectText(v) -- pure helper: a non-string degrades to '';
 * otherwise trim + truncate to MAX_SUBJECT_CHARS. Never throws.
 */
function sanitizeSubjectText(v) {
  if (typeof v !== 'string') return '';
  return v.trim().slice(0, MAX_SUBJECT_CHARS);
}

/**
 * sideFilePath(opts) -- resolve the side-file path. Precedence: an explicit
 * opts.filePath (the test seam, mirroring room-chooser.cjs's
 * roomsHomeOverride idiom) > the CARD_FIRE_SIDECHANNEL_PATH env var (a
 * second test/ops seam) > the default ~/.mindrian/card-fire-reached.json
 * (MINDRIAN_HOME override honored, matching card-fire-retries.json).
 */
function sideFilePath(opts) {
  if (opts && typeof opts.filePath === 'string' && opts.filePath.length > 0) {
    return opts.filePath;
  }
  const envOverride = process.env.CARD_FIRE_SIDECHANNEL_PATH;
  if (typeof envOverride === 'string' && envOverride.length > 0) {
    return envOverride;
  }
  const home = process.env.MINDRIAN_HOME || path.join(os.homedir(), '.mindrian');
  return path.join(home, 'card-fire-reached.json');
}

/**
 * readStoreRaw(filePath) -- read + parse the side-file. Degrades to {} on
 * ANY fault: missing file, corrupt JSON, a non-object root, or a
 * pathologically oversized file (guarded well above the write-time cap so a
 * read never has to fully parse a multi-MB externally-corrupted blob).
 * Never throws.
 */
function readStoreRaw(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    if (Buffer.byteLength(raw, 'utf8') > SIZE_CAP_BYTES * 4) {
      return {};
    }
    const obj = JSON.parse(raw);
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? obj : {};
  } catch (_e) {
    return {};
  }
}

/**
 * pruneStore(store, now) -- drop entries older than TTL_MS; drop a session
 * key entirely once its record list is empty. Pure; never throws.
 */
function pruneStore(store, now) {
  const t = Number.isFinite(now) ? now : Date.now();
  const out = {};
  const src = store && typeof store === 'object' ? store : {};
  for (const sid of Object.keys(src)) {
    const list = Array.isArray(src[sid]) ? src[sid] : [];
    const kept = list.filter(function (rec) {
      return (
        rec &&
        typeof rec === 'object' &&
        typeof rec.entry === 'string' &&
        Number.isFinite(rec.ts) &&
        t - rec.ts <= TTL_MS
      );
    });
    if (kept.length > 0) out[sid] = kept;
  }
  return out;
}

/**
 * enforceSizeCap(store) -- oldest-first truncation across ALL sessions
 * until the serialized store fits SIZE_CAP_BYTES. Mutates and returns a
 * plain object (safe: only ever called on a freshly-pruned store this
 * function owns). Never throws (JSON.stringify on this shape cannot throw).
 */
function enforceSizeCap(store) {
  let serialized = JSON.stringify(store);
  if (Buffer.byteLength(serialized, 'utf8') <= SIZE_CAP_BYTES) return store;

  const flat = [];
  for (const sid of Object.keys(store)) {
    for (const rec of store[sid]) {
      flat.push({ sid: sid, rec: rec });
    }
  }
  flat.sort(function (a, b) {
    return a.rec.ts - b.rec.ts;
  });

  let idx = 0;
  while (Buffer.byteLength(serialized, 'utf8') > SIZE_CAP_BYTES && idx < flat.length) {
    const victim = flat[idx];
    const list = store[victim.sid];
    if (Array.isArray(list)) {
      const pos = list.indexOf(victim.rec);
      if (pos !== -1) list.splice(pos, 1);
      if (list.length === 0) delete store[victim.sid];
    }
    idx += 1;
    serialized = JSON.stringify(store);
  }
  return store;
}

/**
 * writeStoreAtomic(filePath, store) -- prune + size-cap, then write via a
 * tmp-file-plus-rename (atomic on the same filesystem, mirroring the
 * non-destructive-write idiom used elsewhere in this repo), so a crash
 * mid-write cannot leave a concurrent reader with a torn/partial file.
 * Best-effort: any failure is swallowed (T-209-24 - never block the hook).
 */
function writeStoreAtomic(filePath, store) {
  try {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    const now = Date.now();
    const pruned = pruneStore(store, now);
    const capped = enforceSizeCap(pruned);
    const tmp = filePath + '.tmp-' + process.pid + '-' + now;
    fs.writeFileSync(tmp, JSON.stringify(capped), 'utf8');
    fs.renameSync(tmp, filePath);
  } catch (_e) {
    /* best-effort; never block a producer call site on a side-file fault */
  }
}

/**
 * recordReachedGate({ sessionId, surface, shape, filePath? }) -- append a
 * reached-gate record for this session. `surface` MUST be the bare registry
 * surface path (e.g. "lib/hmi/selector-dispatcher.cjs") so it intersects
 * gateReachingEntries()'s output exactly (see the SCHEMA NOTE above).
 * `shape` is stored for diagnostics only. A missing/empty surface is a
 * silent no-op (nothing meaningful to record). A missing sessionId files
 * under NO_SESSION_KEY rather than being dropped. Never throws.
 */
function recordReachedGate(opts) {
  try {
    const o = opts && typeof opts === 'object' ? opts : {};
    const surface = typeof o.surface === 'string' && o.surface.length > 0 ? o.surface : '';
    if (!surface) return;
    const sessionId =
      typeof o.sessionId === 'string' && o.sessionId.length > 0 ? o.sessionId : NO_SESSION_KEY;
    const shape = typeof o.shape === 'string' ? o.shape : '';

    const filePath = sideFilePath(o);
    const store = readStoreRaw(filePath);
    const list = Array.isArray(store[sessionId]) ? store[sessionId] : [];
    list.push({
      entry: surface,
      shape: shape,
      ts: Date.now(),
      subject: sanitizeSubjectText(o.subjectText),
    });
    store[sessionId] = list;
    writeStoreAtomic(filePath, store);
  } catch (_e) {
    /* never throw out of a producer call site */
  }
}

/**
 * scopedRecords(pruned, sessionId, now) -- the TTL-pruned records visible to a
 * session read: ONLY the session-scoped bucket, exact match on `sessionId`.
 *
 * card-fire-over-enforcement (2026-07-20) fix (A) unioned the NO_SESSION_KEY
 * bucket into every session's read (first unboundedly, TTL_MS-wide; later
 * narrowed to TURN_FRESH_MS). stop-hook-fires-card-on-option-shaped-prose-
 * sentence / card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-
 * relevance (2026-09-17) proved live, TWICE, that narrowing a union window is
 * not the same as closing it: whatever the window, a sessionless record
 * carries NO session-identity information at all, so ANY session's read
 * inside the window is affected identically whether it is the legitimate
 * same-turn read-back or a completely unrelated CONCURRENT session's read
 * (confirmed live -- a peer session's genuine card render leaked into an
 * unrelated session's Stop hook with the FIRST pass's 20s-narrowed fix already
 * on disk). A time window is a probability knob, not a correctness fix; there
 * is no width that makes "the second session's read is NEVER affected"
 * actually true except zero.
 *
 * The SECOND pass removes the union entirely: a session's read sees ONLY its
 * own exact-match bucket, full stop. This is safe -- not merely narrower --
 * because the FIRST pass's real gap was upstream, not here: the ONE producer
 * that ever wrote into NO_SESSION_KEY (lib/hmi/selector-dispatcher.cjs's
 * pickShape trailer door) had no session id in scope at its mint point purely
 * because nobody had traced whether one was actually reachable there. It is:
 * process.env.CLAUDE_CODE_SESSION_ID, the SAME env var
 * lib/core/session-binding.cjs's resolveEffectiveSessionId already treats as a
 * reliable stdio-transport session id elsewhere in this codebase, live-
 * confirmed (.planning/debug/resolved/registry-active-session-unbound-
 * inheritance.md) to match the Stop hook's own stdin session_id on this exact
 * machine. That call site now threads it through, so its mints land in a REAL
 * per-session bucket directly and are found by this function's own exact-match
 * branch above -- no union, no window, no ambiguity, matched at ANY delay.
 * NO_SESSION_KEY still exists as recordReachedGate's fallback for the residual
 * case where no real session id resolves at all (a non-CLI invocation, a bare
 * unit test): such a record is now simply invisible to every other session's
 * read rather than leaking into it -- the safe default per this defect's own
 * post-mortem, not a probability reduction. A missing/empty sessionId at READ
 * time still resolves to the NO_SESSION_KEY bucket as ITS OWN primary (degenerate,
 * same-caller-has-no-context) bucket -- that is not a cross-session union, it is
 * one caller reading its own degenerate bucket. Pure; never throws.
 */
function scopedRecords(pruned, sessionId, now) {
  const src = pruned && typeof pruned === 'object' ? pruned : {};
  // `now` is accepted for signature stability (existing callers pass it) but is
  // no longer consulted: there is no time-window union left to gate.
  void now;
  const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : NO_SESSION_KEY;
  const out = [];
  const sessionList = Array.isArray(src[sid]) ? src[sid] : [];
  for (const rec of sessionList) out.push(rec);
  return out;
}

/**
 * readReachedGates(sessionId, opts?) -- return the DEDUPED array of bare
 * surface-path strings recorded for this session, TTL-filtered. A missing/
 * empty sessionId reads the NO_SESSION_KEY bucket only, as its OWN bucket (a
 * degenerate caller with no session context of its own). When sessionId IS a
 * real, non-empty string, ONLY that exact session's own bucket is read --
 * card-fire-stale-f1-reach-suggestion-forces-block-regardless-of-relevance /
 * stop-hook-fires-card-on-option-shaped-prose-sentence (2026-09-17, second
 * pass): NO_SESSION_KEY is never unioned into a real session's read anymore
 * (see scopedRecords' own doc comment for why a time-windowed union could
 * never be made safe). The pickShape trailer door
 * (lib/hmi/selector-dispatcher.cjs), the one producer that used to record
 * every mint under NO_SESSION_KEY unconditionally, now threads
 * process.env.CLAUDE_CODE_SESSION_ID through, so its mints land in a REAL
 * session's own bucket directly and are found by the exact-match branch
 * above like any other producer's records -- no union needed. Any fault
 * (missing file, corrupt JSON, oversized file) degrades to []. Never throws.
 */
function readReachedGates(sessionId, opts) {
  try {
    const filePath = sideFilePath(opts);
    const raw = readStoreRaw(filePath);
    const now = Date.now();
    const pruned = pruneStore(raw, now);
    const records = scopedRecords(pruned, sessionId, now);

    const seen = new Set();
    const out = [];
    for (const rec of records) {
      if (rec && typeof rec.entry === 'string' && rec.entry.length > 0 && !seen.has(rec.entry)) {
        seen.add(rec.entry);
        out.push(rec.entry);
      }
    }
    return out;
  } catch (_e) {
    return [];
  }
}

/**
 * mostRecentReachedTs(sessionId, opts?) -- the epoch-ms timestamp of the most
 * recent reached-gate record visible to this session (the same scopedRecords
 * set readReachedGates walks), or 0 when none. The consumer
 * (scripts/check-card-fire.cjs deriveTurnSignals) compares it against
 * TURN_FRESH_MS to decide whether the reached gate is FRESH (this turn) or STALE
 * (a prior turn's reach still inside the file TTL) -- the staleness signal
 * behind card-fire-over-enforcement fix (B). Any fault degrades to 0. Never
 * throws.
 */
function mostRecentReachedTs(sessionId, opts) {
  try {
    const filePath = sideFilePath(opts);
    const raw = readStoreRaw(filePath);
    const now = Date.now();
    const pruned = pruneStore(raw, now);
    const records = scopedRecords(pruned, sessionId, now);
    let maxTs = 0;
    for (const rec of records) {
      if (rec && Number.isFinite(rec.ts) && rec.ts > maxTs) maxTs = rec.ts;
    }
    return maxTs;
  } catch (_e) {
    return 0;
  }
}

/**
 * consumeReachedGates(sessionId, opts?) -- mark this session's reached-gate
 * records SPENT by deleting the session-scoped bucket, and return how many
 * records were removed (0 when there was nothing to consume). Never throws.
 *
 * card-fire-answered-gate-refires-within-ttl-window (2026-07-28), the RECORD
 * LIFECYCLE this module was missing. Before this function existed a record had
 * exactly ONE way to leave the store: the TTL_MS expiry. Nothing ever marked a
 * gate as fired, answered, or otherwise adjudicated, so a single mint kept
 * asserting "a gate was reached, force the card" on EVERY Stop evaluation
 * inside its TURN_FRESH_MS window -- including the turns AFTER the navigator had
 * already fired the card via AskUserQuestion and answered it. The consumer's own
 * `askuserquestion_fired` signal cannot cover this: it is scoped to the CURRENT
 * turn (it resets at every role:user transcript boundary), so a card fired and
 * answered in turn N is invisible to turn N+1's Stop hook while the mint from
 * turn N is still time-fresh. Freshness-by-elapsed-time and still-pending are
 * two different signals; this function supplies the second one.
 *
 * The contract is deliberately narrow: this module records and forgets, it does
 * NOT decide. The consumer (scripts/check-card-fire.cjs) calls this ONLY on a
 * TERMINAL verdict -- the card fired, the bounded escape degraded, or a
 * relevance pass declined to enforce. An active force-loop (intercept:true) must
 * NOT consume, or the record would vanish before the re-prompted turn is
 * re-checked and MAX_FORCE_RETRIES would become unreachable (a reverse
 * regression on the Phase 209 guarantee).
 *
 * NO_SESSION_KEY carve-out (deliberate, documented): when a real sessionId is
 * supplied only that session's own bucket is consumed; the NO_SESSION_KEY bucket
 * is left intact regardless. (2026-09-17, second pass: scopedRecords no longer
 * unions NO_SESSION_KEY into any real session's read at all, so this carve-out
 * is no longer strictly load-bearing for THAT leak -- but it is kept anyway,
 * unconditionally, because deleting a bucket a caller does not own is the wrong
 * default independent of what reads it: a caller with a real sessionId has no
 * business deleting the degenerate bucket, since some OTHER caller with no
 * session context of its own may still be relying on it as ITS OWN primary
 * bucket.) A caller with no sessionId of its own reads AND consumes the
 * NO_SESSION_KEY bucket as its own primary bucket, exactly mirroring
 * readReachedGates's precedence.
 */
function consumeReachedGates(sessionId, opts) {
  try {
    const filePath = sideFilePath(opts);
    const raw = readStoreRaw(filePath);
    const pruned = pruneStore(raw, Date.now());
    const sid = typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : NO_SESSION_KEY;
    const list = Array.isArray(pruned[sid]) ? pruned[sid] : null;
    if (list === null || list.length === 0) return 0;
    const removed = list.length;
    delete pruned[sid];
    writeStoreAtomic(filePath, pruned);
    return removed;
  } catch (_e) {
    return 0;
  }
}

/**
 * readReachedGateSubjects(sessionId, opts?) -- return the DEDUPED array of
 * non-empty `subject` strings recorded for this session, TTL-filtered.
 * Mirrors readReachedGates's control flow EXACTLY (prune via pruneStore,
 * resolve the exact-match sessionId bucket via scopedRecords the same way,
 * same sideFilePath(opts) precedence) but collects rec.subject values
 * (encounter order, non-empty only) instead of rec.entry. Completely
 * separate from readReachedGates - that function's bare entry-path-array
 * return contract is untouched (deriveTurnSignals's ran_entries assignment
 * depends on it byte-for-byte). Any fault degrades to []. Never throws.
 */
function readReachedGateSubjects(sessionId, opts) {
  try {
    const filePath = sideFilePath(opts);
    const raw = readStoreRaw(filePath);
    const now = Date.now();
    const pruned = pruneStore(raw, now);
    const records = scopedRecords(pruned, sessionId, now);

    const seen = new Set();
    const out = [];
    for (const rec of records) {
      if (
        rec &&
        typeof rec.subject === 'string' &&
        rec.subject.length > 0 &&
        !seen.has(rec.subject)
      ) {
        seen.add(rec.subject);
        out.push(rec.subject);
      }
    }
    return out;
  } catch (_e) {
    return [];
  }
}

// HEALTH_OK / HEALTH_UNAVAILABLE -- the two states sideChannelHealth(opts) below
// distinguishes. Distinct, non-empty strings; the exact string values are not a
// public contract, only distinctness and non-emptiness are (callers compare by
// identity against the exported constant, never by a hardcoded literal).
const HEALTH_OK = 'healthy';
const HEALTH_UNAVAILABLE = 'unavailable';

/**
 * sideChannelHealth(opts) -- Phase 238-08 (GATE-04, D-15): distinguishes a
 * healthy-but-empty side channel from a blind one, so a caller (classifyCardFire)
 * can decide whether the BACKSTOP's uncorroborated intercept is safe to suppress.
 *
 * A missing side file is HEALTHY, not broken: a fresh install or a session that
 * has minted no gates yet is the normal state at session start, and treating
 * "nothing recorded yet" as a fault would be exactly when a spurious backstop
 * intercept on ordinary prose would be most annoying (the whole reason this
 * function exists). Conversely, any read or parse fault -- the file exists but
 * cannot be read, is not valid JSON, does not parse to a plain object, or
 * exceeds SIZE_CAP_BYTES -- is UNAVAILABLE, because a blind side channel is
 * precisely when the backstop's last-resort independent authority must stay
 * armed rather than being silently disarmed by a corrupt file.
 *
 * Resolves the path through this module's own sideFilePath(opts), so the
 * CARD_FIRE_SIDECHANNEL_PATH override and the default branch behave identically
 * to every other reader in this file. Reuses SIZE_CAP_BYTES rather than adding a
 * second threshold. Never throws: every fault, expected or not, degrades to
 * HEALTH_UNAVAILABLE, the conservative direction (leave the backstop armed).
 */
function sideChannelHealth(opts) {
  try {
    const filePath = sideFilePath(opts);
    let raw;
    try {
      raw = fs.readFileSync(filePath, 'utf8');
    } catch (readErr) {
      if (readErr && readErr.code === 'ENOENT') return HEALTH_OK;
      // Any other read fault (EISDIR, EACCES, etc.) leaves the side channel
      // blind, so the backstop must keep its independent authority.
      return HEALTH_UNAVAILABLE;
    }
    if (Buffer.byteLength(raw, 'utf8') > SIZE_CAP_BYTES) return HEALTH_UNAVAILABLE;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object' && !Array.isArray(obj)) return HEALTH_OK;
    return HEALTH_UNAVAILABLE;
  } catch (_e) {
    return HEALTH_UNAVAILABLE;
  }
}

module.exports = {
  recordReachedGate: recordReachedGate,
  readReachedGates: readReachedGates,
  readReachedGateSubjects: readReachedGateSubjects,
  consumeReachedGates: consumeReachedGates,
  mostRecentReachedTs: mostRecentReachedTs,
  sideChannelHealth: sideChannelHealth,
  sideFilePath: sideFilePath,
  TTL_MS: TTL_MS,
  TURN_FRESH_MS: TURN_FRESH_MS,
  SIZE_CAP_BYTES: SIZE_CAP_BYTES,
  MAX_SUBJECT_CHARS: MAX_SUBJECT_CHARS,
  NO_SESSION_KEY: NO_SESSION_KEY,
  HEALTH_OK: HEALTH_OK,
  HEALTH_UNAVAILABLE: HEALTH_UNAVAILABLE,
};
