'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 220-03 -- SENS-15 url-ingest detector: the pasted-URL tripwire.
 *
 * REQ-2 contextual surface (D-05): a navigator who pastes a URL into the
 * conversation should get an OFFER to ingest it as room knowledge -- not a
 * silent drop, and NEVER an auto-file. This sensor detects a bare http(s)
 * URL in the normalized turn TEXT (unlike sensor-eureka, which reads a
 * freshness side-channel: here the turn IS the input), dedups against the
 * Plan 02 url-ingest ledger, and fires the FROZEN deep_research reach as a
 * standing offer. The F.1 card downstream carries the verbs
 * [Ingest] [Ingest+Explore] [Skip]; only a navigator verb triggers the
 * fetch+file (Canon Part 3 Decision Gate; 220-RESEARCH Pitfall 3).
 *
 * SENSOR ID: SENS-15. Verified free at build time (2026-07-13) against the
 * LIVE lib/core/insight-sensors.cjs:
 *   grep -oE "SENS-[0-9]+" lib/core/insight-sensors.cjs | sort -uV | tail -3
 *   -> SENS-12, SENS-13, SENS-14
 * 219's SENS-14 (opportunity detector) has landed; SENS-15 is the next free
 * id (the 219-03 build-time re-check discipline).
 *
 * FROZEN REACH (CIRS R3, Phase 148 lockstep): rides the EXISTING
 * deep_research reach (member 5 of the frozen REACH_IDS six). Mints NO 7th
 * reach id; fails closed at load if the id ever drifts off the bank.
 *
 * POSTURE 'hold' (the SENS-SHOW / SENS-13 precedent): a standing offer at
 * the Decision Gate, never an auto-open. The sensor PROPOSES; decide()
 * decides surfacing; the navigator decides acting.
 *
 * DETECTION DISCRETION (D-05, documented here as the plan mandates):
 *   - Fenced code blocks (```...```) and inline code spans (`...`) are
 *     stripped FIRST: a URL inside code is reference material, not intent.
 *   - Straight-quoted URLs are skipped: double-quoted spans ("...") are
 *     stripped whole; single-quoted spans are stripped only when they
 *     contain no whitespace (so an apostrophe in prose never swallows the
 *     text between two contractions -- a conservative false-negative
 *     posture, never a false fire).
 *   - Markdown blockquote lines (leading '>') are dropped: quoted material
 *     is someone else's context, not a paste-intent.
 *   - The remaining text is matched with a conservative bare http(s)
 *     regex; trailing sentence punctuation is trimmed; each candidate must
 *     parse via WHATWG URL with an http/https protocol. The FIRST surviving
 *     candidate is the offer subject.
 *
 * DEDUP (D-05): the Plan 02 ledger <roomDir>/.mindrian/url-ingest-ledger.json
 * is the contract (lib/core/url-ingest.cjs LEDGER_RELPATH -- path replicated
 * here, module NEVER required: this is a read-only detector by construction,
 * grep-gated). A ledger entry for the URL -> already ingested -> null. A
 * ledger file that EXISTS but does not parse -> fail closed to null (a
 * corrupt dedup source must not re-offer an already-ingested URL). A ledger
 * that does not exist -> fresh room -> fire.
 *
 * CANON PART 8 (evidence bag is enum/handle-only): the bag carries
 * { url_count, first_url_host, first_url_handle, ledger_checked } -- flat
 * scalars, the bare hostname plus a 12-hex sha256 HANDLE of the URL, NEVER
 * the full URL and NEVER turn prose (T-220-13; the Part 8 five-tripwire
 * sweep spans lib/core/sensors/* automatically). The card host recovers the
 * URL locally from the turn context; nothing here egresses.
 *
 * Pure / sync / LOCAL-first, read-only (zero write primitives), soft-fail-
 * to-null on every malformed input; never throws. NEVER requires
 * insight-sensors.cjs (circular) -- only ./sensor-types.cjs + node built-ins.
 *
 * Naming rule (binding): tokens are url-ingest / pasted_url (219 owns its
 * own sensor vocabulary; no bare token from it appears in this module).
 *
 * House rule: hyphens only, no em-dashes.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { makeReach, REACH_IDS } = require('./sensor-types.cjs');

// SENS-15: the next free sensor id (build-time re-verified; see header).
const SENSOR_ID = 'SENS-15';

// FROZEN: rides the existing deep_research reach. Fail closed at load if it
// ever drifts off the frozen bank (mirrors sensor-eureka.cjs / sensor-room-pick.cjs).
const REACH_ID = 'deep_research';
if (REACH_IDS.indexOf(REACH_ID) === -1) {
  throw new Error('sensor-url-ingest: REACH_ID "' + REACH_ID + '" is not in the frozen REACH_IDS bank');
}

// The Plan 02 ledger relpath (lib/core/url-ingest.cjs LEDGER_RELPATH --
// REPLICATED, never required: read-only detector, no pipeline coupling).
const LEDGER_RELPATH = path.join('.mindrian', 'url-ingest-ledger.json');

// ---------- LOCAL helpers (replicated, sync, soft-fail) ----------

/**
 * Read + parse a JSON file, returning null on any failure. LOCAL only -- the
 * caller threads a room-local path; there is no network surface here.
 * (Replicated from the sensor-eureka precedent; a sensors/ file must not
 * require insight-sensors.cjs, that is circular.)
 */
function readJsonSafe(filePath) {
  try {
    if (typeof filePath !== 'string' || !filePath) return null;
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (_e) {
    return null;
  }
}

/**
 * Extract bare http(s) URL candidates from turn text per the D-05 detection
 * discretion (header): strip fenced blocks + inline code spans FIRST, drop
 * markdown-blockquote lines, strip straight-quoted spans, then match a
 * conservative regex and validate each candidate through WHATWG URL.
 * Returns an array of candidate URL strings (possibly empty). Never throws.
 */
function extractCandidateUrls(text) {
  if (typeof text !== 'string' || text.length === 0) return [];
  let t = text;
  // (1) fenced code blocks, then inline code spans.
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/`[^`\n]*`/g, ' ');
  // (2) markdown-blockquote lines.
  t = t.split('\n').filter(function (line) { return !/^\s*>/.test(line); }).join('\n');
  // (3) straight quotes: double-quoted spans whole; single-quoted spans only
  // when whitespace-free (the apostrophe-safe conservative rule).
  t = t.replace(/"[^"\n]*"/g, ' ');
  t = t.replace(/'[^'\s]*'/g, ' ');
  // (4) conservative bare http(s) match + trailing-punctuation trim + parse.
  const matches = t.match(/https?:\/\/[^\s<>"')\]]+/g) || [];
  const out = [];
  for (const m of matches) {
    const trimmed = m.replace(/[.,;:!?]+$/, '');
    if (!trimmed) continue;
    let parsed = null;
    try {
      parsed = new URL(trimmed);
    } catch (_e) {
      continue;
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') continue;
    out.push(trimmed);
  }
  return out;
}

// ---------- SENS-15: the pasted-URL sensor ----------

/**
 * SENS-15 -- bare http(s) URL in the turn text -> the deep_research reach
 * as a url-ingest offer.
 *
 * Fires (returns a Readonly reach) ONLY when ALL preconditions hold:
 *   - ctx.roomDir is a non-empty string (the ledger dedup needs a room), AND
 *   - turn.text yields at least one candidate URL after the D-05 stripping
 *     (fenced/inline code, markdown quotes, straight quotes), AND
 *   - the ledger dedup clears: the ledger file is either absent (fresh
 *     room) or parses cleanly WITHOUT an entry for the first candidate URL.
 *     A ledger that exists but does not parse fails CLOSED to null.
 *
 * On any malformed input it soft-fails to null and NEVER throws. It never
 * writes anything: no file, no ledger, no room.db (Part 3 / T-220-14).
 *
 * The dispatch slug 'url-ingest-offer' pairs with the /mos:research URL
 * mode (commands/research.md) -- the F.1 card host that renders
 * [Ingest] [Ingest+Explore] [Skip] and runs ingestUrl on the verb.
 *
 * @param {object} turn   -- the normalized turn ({ text }); normalizeTurn
 *                           upstream aliases text from utterance/userText
 * @param {object} _tuple -- the /mos:diagnose tuple (unused for detection)
 * @param {object} ctx    -- LOCAL context ({ roomDir })
 * @returns {Readonly<object>|null}
 */
function sensorUrlIngest(turn, _tuple, ctx) {
  try {
    const roomDir = (ctx && typeof ctx === 'object' && typeof ctx.roomDir === 'string') ? ctx.roomDir : '';
    if (!roomDir) return null;

    const text = (turn && typeof turn === 'object' && typeof turn.text === 'string') ? turn.text : '';
    const candidates = extractCandidateUrls(text);
    if (candidates.length === 0) return null;

    const firstUrl = candidates[0];

    // Ledger dedup (D-05): absent -> fresh room, fire; present-but-corrupt
    // -> fail closed; entry for this URL -> already ingested, null.
    const ledgerPath = path.join(roomDir, LEDGER_RELPATH);
    if (fs.existsSync(ledgerPath)) {
      const ledger = readJsonSafe(ledgerPath);
      if (!ledger || typeof ledger !== 'object') return null; // corrupt: fail closed
      const entries = (ledger.entries && typeof ledger.entries === 'object') ? ledger.entries : {};
      if (Object.prototype.hasOwnProperty.call(entries, firstUrl)) return null; // already ingested
    }

    let host = '';
    try {
      host = new URL(firstUrl).hostname;
    } catch (_e) {
      return null;
    }

    // Evidence: flat scalars, HOST + 12-hex HASH HANDLE only -- never the
    // full URL, never prose (Part 8 / T-220-13). The card host recovers the
    // URL locally from the turn context.
    return makeReach({
      reach_id: REACH_ID,
      posture: 'hold',
      dispatch: 'url-ingest-offer',
      companions: [],
      signal: 'pasted_url',
      evidence: {
        url_count: candidates.length,
        first_url_host: host,
        // PART8-SAFE-HASH: hashes the PUBLIC URL string only (never room/user
        // content) into a local dedup handle; never crosses the Brain boundary.
        // See tests/test-sensors-part8-sweep.cjs for the documented exception.
        first_url_handle: crypto.createHash('sha256').update(firstUrl).digest('hex').slice(0, 12),
        ledger_checked: true,
      },
    });
  } catch (_e) {
    return null; // soft-fail: a malformed input never throws out of the sensor
  }
}

module.exports = {
  sensorUrlIngest: sensorUrlIngest,
  SENSOR_ID: SENSOR_ID,
  REACH_ID: REACH_ID,
  LEDGER_RELPATH: LEDGER_RELPATH,
  // Replicated LOCAL helpers (exposed for the Task-3 suite).
  readJsonSafe: readJsonSafe,
  extractCandidateUrls: extractCandidateUrls,
};
