'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 391 plan 01 (CC391-H): changelog slicer for /mos:radar --fetch.
 *
 * WHAT IT DOES, IN PLAIN WORDS
 * Take the text of the Claude Code changelog and a mark (the newest version
 * the capability ledger already covers). Give back the complete entries that
 * are newer than the mark, newest first. Also give back a coverage object that
 * says, without guessing, whether every version between the newest entry and
 * the mark was read. A read that stopped early must never look complete.
 *
 * WHY IT EXISTS (391-RESEARCH.md, "Radar fetch bug: root cause")
 * The radar bug had four stacked causes:
 *   1. WebFetch returns at most 100000 of about 1175667 characters.
 *   2. The prompt asked for "the 10 most recent entries", not "newer than the mark".
 *   3. Nothing compared the oldest version read with the ledger mark.
 *   4. No deterministic path existed, so the model decided what to keep.
 * This module closes cause 3 (the coverage object) and is the base of the fix
 * for cause 4 (a deterministic parser; the fetch script in plan 391-03 uses it).
 *
 * PART 7 JUSTIFICATION (reuse before build)
 * A search of scripts, lib, bin, hooks, commands, agents and skills found no
 * code that splits the Claude Code changelog by version header. Every hit for
 * CHANGELOG is a reader of this repo's own release notes (scripts/check-update,
 * scripts/session-start, scripts/release.sh) or the radar prose itself, which is
 * the bug. The net-new surface is this one pure module plus one script in plan
 * 391-03. No command, agent, skill or pipeline is added, so no Part 11
 * born-wired declaration is needed. compareDotted is exported once here; the
 * older private copies (tests/test-265-capability-ledger-schema.cjs and
 * lib/core/doctor/capability-ledger-module.cjs) are left alone.
 *
 * PART 8 STATEMENT
 * Pure. No network, no file system, no child process. It takes text and returns
 * data. The changelog is untrusted input: every bullet leaves this module
 * without a backtick, link, HTML tag, URL, control mark or zero-width mark, and
 * at most 240 characters long, so instruction-shaped text cannot ride into
 * data/capability-ledger.json as markup.
 *
 * API
 *   sliceChangelog(text, { after, maxChars }) -> { entries, coverage }
 *   sanitizeBullet(s) -> string
 *   compareDotted(a, b) -> number
 *   isDotted(s) -> boolean
 */

const MAX_BULLET = 240;
const HEADER_RE = /^## (\d+\.\d+\.\d+)[ \t]*$/;
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f]/g;
const INVISIBLE_RE = /[­​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

function isDotted(s) {
  return typeof s === 'string' && /^\d+\.\d+\.\d+$/.test(s);
}

function compareDotted(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

function sanitizeBullet(s) {
  let t = String(s === undefined || s === null ? '' : s);
  t = t.replace(CONTROL_RE, ' ');
  t = t.replace(INVISIBLE_RE, '');
  t = t.replace(/<!--[\s\S]*?-->/g, ' ');
  t = t.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
  t = t.replace(/!?\[([^\]]*)\]\[[^\]]*\]/g, '$1');
  t = t.replace(/<\/?[a-zA-Z][^>]*>/g, ' ');
  t = t.replace(/https?:\/\/\S+/gi, ' ');
  t = t.replace(/`/g, '');
  t = t.replace(/\s+/g, ' ').trim();
  if (t.length > MAX_BULLET) {
    t = t.slice(0, MAX_BULLET);
    const last = t.charCodeAt(t.length - 1);
    if (last >= 0xd800 && last <= 0xdbff) t = t.slice(0, -1);
    t = t.trimEnd();
  }
  return t;
}

function sliceChangelog(text, opts) {
  const o = opts || {};
  if (typeof text !== 'string') throw new TypeError('text must be a string');
  if (!isDotted(o.after)) throw new TypeError('opts.after must be a dotted triple such as 2.1.288');
  let maxChars = null;
  if (o.maxChars !== undefined && o.maxChars !== null) {
    if (!Number.isInteger(o.maxChars) || o.maxChars < 1) throw new TypeError('opts.maxChars must be a positive integer');
    maxChars = o.maxChars;
  }
  const mark = o.after;
  const charsTotal = text.length;
  const truncated = maxChars !== null && maxChars < charsTotal;
  const examined = truncated ? text.slice(0, maxChars) : text;

  // A cut inside a line leaves a partial last line. Ignore it, so a header cut
  // in the middle (for example "## 2.1.3" from "## 2.1.309") is never taken as real.
  const lines = examined.split('\n');
  if (truncated && !examined.endsWith('\n')) lines.pop();

  const heads = [];
  const fenced = new Array(lines.length).fill(false);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/\r$/, '');
    if (/^```/.test(line)) {
      inFence = !inFence;
      fenced[i] = true;
      continue;
    }
    if (inFence) {
      fenced[i] = true;
      continue;
    }
    const m = HEADER_RE.exec(line);
    if (m) heads.push({ version: m[1], line: i });
  }

  const entries = [];
  let cutMidEntry = null;
  for (let k = 0; k < heads.length; k++) {
    const hasNext = k + 1 < heads.length;
    const isComplete = hasNext || !truncated;
    if (!isComplete) {
      cutMidEntry = heads[k].version;
      continue;
    }
    if (compareDotted(heads[k].version, mark) <= 0) continue;
    const end = hasNext ? heads[k + 1].line : lines.length;
    const bullets = [];
    for (let i = heads[k].line + 1; i < end; i++) {
      if (fenced[i]) continue;
      const line = lines[i].replace(/\r$/, '');
      if (line.indexOf('- ') !== 0) continue;
      const b = sanitizeBullet(line.slice(2));
      if (b) bullets.push(b);
    }
    entries.push({ version: heads[k].version, bullets: bullets });
  }

  const complete = heads.some(function (h) { return compareDotted(h.version, mark) <= 0; });
  const newest = entries.length ? entries[0].version : null;
  const oldest = entries.length ? entries[entries.length - 1].version : null;

  let reason;
  if (heads.length === 0) {
    reason = 'no version headers found';
  } else if (complete) {
    reason = entries.length
      ? 'all versions newer than ' + mark + ' were read: ' + newest + ' down to ' + oldest
      : 'no entry is newer than ' + mark;
  } else if (truncated) {
    const stopped = cutMidEntry ? ' (the cut fell inside entry ' + cutMidEntry + ')' : '';
    reason = entries.length
      ? 'read covers ' + newest + ' to ' + oldest + ' only' + stopped +
        '; versions below ' + oldest + ' down to ' + mark + ' were not read'
      : 'read stopped before one complete entry was read' + stopped +
        '; versions newer than ' + mark + ' were not read';
  } else {
    let first = heads[0].version;
    heads.forEach(function (h) { if (compareDotted(h.version, first) < 0) first = h.version; });
    reason = 'source starts at ' + first + ', which is newer than the mark ' + mark +
      '; older versions are not in the source';
  }

  return {
    entries: entries,
    coverage: {
      complete: complete,
      truncated: truncated,
      newest: newest,
      oldest: oldest,
      after: mark,
      headers: heads.length,
      charsRead: examined.length,
      charsTotal: charsTotal,
      cutMidEntry: cutMidEntry,
      reason: reason
    }
  };
}

module.exports = { sliceChangelog, sanitizeBullet, compareDotted, isDotted };
