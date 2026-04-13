'use strict';

/**
 * Phase 80 Stage 02 -- Meeting Detector (pure function).
 *
 * detectMeetings(fileEntries, opts) flags files that match at least 2 of 3
 * meeting signals:
 *   1. date_in_filename  -- YYYY-MM-DD (or YYYYMMDD, YYYY_MM_DD) in source_path
 *   2. attendees_header  -- "## Attendees" or "## Participants" list
 *   3. dialogue_shape    -- 3+ lines of "Speaker: text" at line start
 *
 * Output matches the MANIFEST.json meetings[] schema subset. Detection only --
 * actual filing into room/meetings/ happens in Stage 03c (80-04 orchestrator)
 * via /mos:file-meeting.
 *
 * Pure: no fs writes, no child_process, no AI calls. Body access goes
 * through opts.bodyLoader (default is fs.readFileSync(source_abs_path)).
 */

const fs = require('node:fs');

// Match YYYY-MM-DD, YYYYMMDD, or YYYY_MM_DD anywhere in the path.
const DATE_RE = /(?:^|[^\d])(\d{4})[-_]?(\d{2})[-_]?(\d{2})(?:[^\d]|$)/;

// Body header for the attendees list.
const ATTENDEES_HEADER_RE = /##\s*(?:Attendees|Participants)\s*\n((?:\s*[-*]\s*.+\n?)+)/i;

// "Speaker: text" line-start pattern. Global + multiline so match() with /g
// returns every matching line.
const DIALOGUE_LINE_RE = /^([A-Z][a-zA-Z'\- ]{1,40}):\s+\S/gm;

function detectMeetings(fileEntries, opts) {
  opts = opts || {};
  const loader = opts.bodyLoader || function (f) {
    try { return fs.readFileSync(f.source_abs_path, 'utf8'); } catch (e) { return ''; }
  };
  const out = [];

  for (const f of fileEntries) {
    const signals = [];
    let detectedDate = null;
    let attendees = [];

    // Signal 1: date in filename
    const dm = (f.source_path || '').match(DATE_RE);
    if (dm) {
      detectedDate = dm[1] + '-' + dm[2] + '-' + dm[3];
      signals.push('date_in_filename');
    }

    // Load body
    let body = '';
    try { body = loader(f) || ''; } catch (e) { body = ''; }

    // Signal 2: attendees / participants header
    const am = body.match(ATTENDEES_HEADER_RE);
    if (am) {
      signals.push('attendees_header');
      const lines = am[1].split('\n');
      for (const line of lines) {
        const mm = line.match(/^\s*[-*]\s*(.+?)\s*$/);
        if (mm && mm[1]) attendees.push(mm[1]);
      }
    }

    // Signal 3: dialogue shape (3+ "Speaker:" lines)
    DIALOGUE_LINE_RE.lastIndex = 0;
    const dialogueMatches = body.match(DIALOGUE_LINE_RE) || [];
    if (dialogueMatches.length >= 3) {
      signals.push('dialogue_shape');
    }

    // 2-of-3 rule: any two signals -> meeting
    if (signals.length >= 2) {
      out.push({
        source_file_id: f.id,
        detected_date: detectedDate,
        detected_attendees: attendees,
        detection_signals: signals
      });
    }
  }

  return out;
}

module.exports = {
  detectMeetings: detectMeetings,
  DATE_RE: DATE_RE,
  ATTENDEES_HEADER_RE: ATTENDEES_HEADER_RE,
  DIALOGUE_LINE_RE: DIALOGUE_LINE_RE
};
