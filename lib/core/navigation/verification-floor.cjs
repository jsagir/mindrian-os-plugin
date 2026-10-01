'use strict';

// Phase 365 B2: the verification floor reader and the why-line composer.
//
// D-01/D-02/D-22: the room's floor lives in the room-root ROOM.md frontmatter as
//   a DRAFT ladder rung id (`verification_floor: secondary_document`). This file
//   reads it, maps the provisional aliases to draft ids, applies the default
//   when the key or the file is absent, and reports an unknown value as
//   invalid_fell_back. It NEVER writes ROOM.md.
// D-03: the default predicate is "checked against a source document outside the
//   conversation", read from claimStanding (verification.cjs).
// D-05/D-21: composeFloorNotice returns the plain-words why-line that every
//   approval surface shows BEFORE the click. It is composed here, once, and
//   carried as card data; it opens nothing and writes nothing.
// D-24: the standing it shows comes from the one shared reader, claimStanding.
//
// Canon Part 8: nothing here reaches the network; the notice is local card text.
// Canon Part 9: every read goes through the db handle passed in; no node, edge
//   or event is written here.
// Canon Part 12: words describe what was DONE. A low standing is never framed as
//   failure.
//
// NO em-dashes or en-dashes in this file (CLAUDE.md HARD RULE); hyphens only.

const fs = require('node:fs');
const path = require('node:path');
const {
  FLOOR_IDS,
  FLOOR_ALIASES,
  DEFAULT_FLOOR_ID,
  FLOOR_WORDS,
  STANDING_WORDS,
  claimStanding,
  standingMeetsFloor,
} = require('./verification.cjs');

const HEAD_BYTES = 4096;
const NOTICE_CAP = 400;
const DASHES = new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']', 'g');

function defaultFloor(source, raw) {
  return { id: DEFAULT_FLOOR_ID, source: source, raw: raw === undefined ? null : raw };
}

/**
 * readVerificationFloor(roomDir) -> {id, source, raw}
 *   source: 'room_md' (declared and recognized), 'default' (key or file absent),
 *           'invalid_fell_back' (declared but not a floor id or alias).
 * Reads at most the first 4096 bytes of the room-root ROOM.md and only the text
 * between the opening `---` line and the next `---` line; the body is never read.
 * Never throws and never writes.
 */
function readVerificationFloor(roomDir) {
  let head;
  let fd;
  try {
    fd = fs.openSync(path.join(roomDir, 'ROOM.md'), 'r');
    const buf = Buffer.alloc(HEAD_BYTES);
    const bytesRead = fs.readSync(fd, buf, 0, HEAD_BYTES, 0);
    head = buf.slice(0, bytesRead).toString('utf8');
  } catch (_e) {
    return defaultFloor('default');
  } finally {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch (_e) { /* best effort */ }
    }
  }
  const fm = head.match(/^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!fm) return defaultFloor('default');
  const line = fm[1].match(/^verification_floor[ \t]*:[ \t]*(.*?)[ \t\r]*$/m);
  if (!line) return defaultFloor('default');
  let raw = line[1];
  const quoted = raw.match(/^(["'])(.*)\1$/);
  if (quoted) raw = quoted[2];
  if (FLOOR_IDS.has(raw)) return { id: raw, source: 'room_md', raw: raw };
  if (Object.prototype.hasOwnProperty.call(FLOOR_ALIASES, raw)) {
    return { id: FLOOR_ALIASES[raw], source: 'room_md', raw: raw };
  }
  return defaultFloor('invalid_fell_back', raw);
}

function parseJson(text) {
  try {
    const v = JSON.parse(text || '{}');
    return v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch (_e) {
    return {};
  }
}

function hostOf(url) {
  try {
    const h = new URL(url).hostname;
    return h || 'a linked source';
  } catch (_e) {
    return 'a linked source';
  }
}

// The accepted source, in words: host, optional locator, retrieval date.
function describeSource(db, claimId, st) {
  const ids = st.source_node_ids || [];
  let row;
  try {
    row = db.prepare('SELECT properties FROM nodes WHERE id = ?').get(ids[0]);
  } catch (_e) {
    row = null;
  }
  const props = parseJson(row && row.properties);
  let locator = typeof props.locator === 'string' ? props.locator.trim() : '';
  if (!locator) {
    try {
      const edge = db.prepare('SELECT properties FROM edges WHERE source = ? AND target = ?').get(claimId, ids[0]);
      const ep = parseJson(edge && edge.properties);
      if (typeof ep.locator === 'string') locator = ep.locator.trim();
    } catch (_e) {
      locator = '';
    }
  }
  let text = hostOf(props.url);
  if (st.standing === 'located_source' && locator) text += ', ' + locator;
  const when = typeof props.retrieved_at === 'string' ? props.retrieved_at.slice(0, 10) : '';
  if (when) text += ' (retrieved ' + when + ')';
  if (ids.length > 1) text += ' and ' + (ids.length - 1) + ' more';
  return text;
}

/**
 * composeFloorNotice(db, roomDir, subjectId) -> null | {
 *   notice, approve_label, landing, standing, floor_id, floor_source,
 *   floor_met, source_node_ids }
 * null unless the subject is a claim node. Read-only.
 */
function composeFloorNotice(db, roomDir, subjectId) {
  try {
    const row = db.prepare('SELECT id, type, review_status FROM nodes WHERE id = ?').get(subjectId);
    if (!row || row.type !== 'claim') return null;
    const st = claimStanding(db, subjectId);
    const floor = readVerificationFloor(roomDir);
    const met = standingMeetsFloor(st.standing, floor.id).met;

    const sourceLike = st.standing === 'source_edge' || st.standing === 'located_source';
    const checked = sourceLike
      ? describeSource(db, subjectId, st)
      : STANDING_WORDS[st.standing].checked_against;
    const parts = ['Checked against: ' + checked + '.'];

    const status = row.review_status;
    const actionable = status === 'proposed' || status === 'needs_evidence';
    let landing = 'unchanged';
    if (actionable) {
      landing = met ? 'confirmed' : 'needs_evidence';
      const stays = status === 'needs_evidence';
      const lands = stays ? 'so it stays at needs evidence.' : 'so approving files it as needs evidence.';
      if (floor.id === 'unchecked') {
        parts.push('This room sets no floor, so approving confirms it.');
      } else if (met) {
        parts.push("That meets this room's floor (" + FLOOR_WORDS[floor.id] + '), so approving confirms it.');
      } else if (floor.id === 'person') {
        parts.push("This room asks for a person's check, which the room cannot record yet, " + lands);
      } else {
        parts.push('This room asks for at least ' + FLOOR_WORDS[floor.id] + ', ' + lands);
      }
      if (floor.source === 'invalid_fell_back') {
        parts.push("(The room's verification_floor value was not recognized, so the default applies.)");
      }
    }

    let notice = parts.join(' ').replace(DASHES, '-').replace(/\s+/g, ' ').trim();
    if (notice.length > NOTICE_CAP) notice = notice.slice(0, NOTICE_CAP - 3) + '...';
    return {
      notice: notice,
      approve_label: landing === 'needs_evidence' ? 'Approve, mark as needs evidence' : null,
      landing: landing,
      standing: st.standing,
      floor_id: floor.id,
      floor_source: floor.source,
      floor_met: met,
      source_node_ids: st.source_node_ids,
    };
  } catch (_e) {
    return null;
  }
}

module.exports = {
  readVerificationFloor,
  composeFloorNotice,
};
