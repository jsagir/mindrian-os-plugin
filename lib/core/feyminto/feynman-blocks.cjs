'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.25 plan 15 -- the two generated blocks of the FEYNMAN face, and the room id stamp for a face.
 * =======================================================================================================
 * FeyMinto design v2 gives FEYNMAN.md two generated blocks next to the human body:
 *
 *   ## What changed (auto)                    what the last MINTO regeneration changed
 *   ## What we cannot yet explain (auto)      the gaps, the unanswered counterevidence, the unvalidated assumptions
 *
 * Each block sits between its own sentinel pair. writeFeynmanBlocks replaces the text BETWEEN a pair and never
 * touches a byte outside the pairs, so the human body (and the Phase 124 ## Timeline (auto) block) stay exactly
 * as written. The write goes through the shipped timeline-runner atomic write (tmp + rename), so a crash leaves
 * the previous file whole (one owner per state: the MINTO generator calls this after each successful write, and
 * the seed writer calls it at birth).
 *
 * stampFaceRoomId upserts the room_id frontmatter key of a face (FEYNMAN.md, BRAIN.md) by editing the frontmatter
 * TEXT: the timeline-runner frontmatter round trip drops any line that is not a flat key, and a stamp must keep
 * every other key and the body byte-identical.
 *
 * Both functions return { ok, reason } and never throw. Local files only: nothing here reaches the Brain
 * (Canon Part 8). Node built-ins plus the shipped timeline-runner. CommonJS. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');
const timelineRunner = require('../feynman/timeline-runner.cjs');

const WHAT_CHANGED_HEADING = '## What changed (auto)';
const CANNOT_EXPLAIN_HEADING = '## What we cannot yet explain (auto)';

const SENTINELS = Object.freeze({
  whatChanged: Object.freeze(['<!-- feyminto:what-changed:start -->', '<!-- feyminto:what-changed:end -->']),
  cannotExplain: Object.freeze(['<!-- feyminto:cannot-explain:start -->', '<!-- feyminto:cannot-explain:end -->']),
});

// A block keeps the FEYNMAN face small (FEYNMINTO-01 caps its body at 1500 tokens): at most this many lines.
const MAX_BLOCK_LINES = 8;

function toFacePath(p) {
  try {
    if (fs.statSync(p).isDirectory()) return path.join(p, 'FEYNMAN.md');
  } catch (_e) { /* a missing path is reported by the caller's read */ }
  return p;
}

function oneLine(s) {
  return String(s === undefined || s === null ? '' : s).replace(/\s+/g, ' ').trim();
}

// The lines of one block, each as a list item; capped, with the count of what was left out.
function renderLines(lines) {
  const clean = (Array.isArray(lines) ? lines : []).map(oneLine).filter((l) => l.length > 0);
  const shown = clean.slice(0, MAX_BLOCK_LINES).map((l) => '- ' + l);
  if (clean.length > MAX_BLOCK_LINES) shown.push('- and ' + (clean.length - MAX_BLOCK_LINES) + ' more (see the MINTO face)');
  return shown.join('\n');
}

// One block as it appears in the file: heading, blank, start sentinel, content, end sentinel.
function renderBlock(heading, pair, lines) {
  return heading + '\n\n' + pair[0] + '\n' + renderLines(lines) + '\n' + pair[1] + '\n';
}

// Replace the content between a sentinel pair; append the whole block (heading + pair) when the pair is absent.
function upsertBlock(text, heading, pair, lines) {
  const a = text.indexOf(pair[0]);
  const b = text.indexOf(pair[1]);
  if (a !== -1 && b !== -1 && b > a) {
    return text.slice(0, a + pair[0].length) + '\n' + renderLines(lines) + '\n' + text.slice(b);
  }
  const sep = text.length === 0 || text.endsWith('\n\n') ? '' : (text.endsWith('\n') ? '\n' : '\n\n');
  return text + sep + renderBlock(heading, pair, lines);
}

// The scaffold-predicate contract (lib/core/scaffold-predicate.cjs consumes each auto-block owner's own
// bodyOutsideSentinels + HEADER): a FEYNMAN.md that holds only what the system wrote is scaffold, and these two
// generated blocks are system-written. Each block is cut out whole, heading line included, so a seeded face
// that carries only its seed sentence and these blocks is still scaffold and never counts as the owner's work.
const HEADER = WHAT_CHANGED_HEADING;
function bodyOutsideSentinels(body) {
  let text = String(body === undefined || body === null ? '' : body);
  [[WHAT_CHANGED_HEADING, SENTINELS.whatChanged], [CANNOT_EXPLAIN_HEADING, SENTINELS.cannotExplain]].forEach((entry) => {
    const heading = entry[0];
    const pair = entry[1];
    const a = text.indexOf(pair[0]);
    const b = text.indexOf(pair[1]);
    if (a === -1 || b === -1 || b <= a) return;
    let from = a;
    const h = text.lastIndexOf(heading, a);
    if (h !== -1 && /^\s*$/.test(text.slice(h + heading.length, a))) from = h;
    let to = b + pair[1].length;
    if (text[to] === '\r') to += 1;
    if (text[to] === '\n') to += 1;
    text = text.slice(0, from) + text.slice(to);
  });
  return text;
}

/**
 * writeFeynmanBlocks(facePath, { whatChanged: [lines], cannotExplain: [lines] }) -> { ok, reason?, changed? }
 * facePath is the FEYNMAN.md file (a section directory is accepted and resolved to its FEYNMAN.md). A missing
 * FEYNMAN.md is not created here: the seed writer owns creation.
 */
function writeFeynmanBlocks(facePath, content) {
  try {
    const target = toFacePath(facePath);
    let text;
    try { text = fs.readFileSync(target, 'utf8'); } catch (_e) { return { ok: false, reason: 'feynman_missing' }; }
    const c = content || {};
    let next = text;
    if (Array.isArray(c.whatChanged)) next = upsertBlock(next, WHAT_CHANGED_HEADING, SENTINELS.whatChanged, c.whatChanged);
    if (Array.isArray(c.cannotExplain)) next = upsertBlock(next, CANNOT_EXPLAIN_HEADING, SENTINELS.cannotExplain, c.cannotExplain);
    if (next === text) return { ok: true, changed: false };
    timelineRunner.atomicWrite(target, next);
    return { ok: true, changed: true };
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e).slice(0, 200) };
  }
}

/**
 * stampFaceRoomId(facePath, roomId) -> { ok, reason?, changed? }
 * Adds or replaces the room_id frontmatter key. Every other frontmatter line and the whole body stay
 * byte-identical. A face with no frontmatter gains a frontmatter block holding only room_id.
 */
function stampFaceRoomId(facePath, roomId) {
  try {
    if (typeof roomId !== 'string' || roomId.length === 0) return { ok: false, reason: 'invalid_room_id' };
    let text;
    try { text = fs.readFileSync(facePath, 'utf8'); } catch (_e) { return { ok: false, reason: 'face_missing' }; }
    const line = 'room_id: ' + roomId;
    let next;
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/);
    if (!m) {
      next = '---\n' + line + '\n---\n' + text;
    } else {
      const fmText = m[1];
      const eol = text.indexOf('\r\n') !== -1 && text.indexOf('\r\n') < m[0].length ? '\r\n' : '\n';
      const lines = fmText.split(/\r?\n/);
      const idx = lines.findIndex((l) => /^room_id:/.test(l));
      if (idx !== -1) lines[idx] = line; else lines.push(line);
      next = '---' + eol + lines.join(eol) + eol + '---' + m[2] + text.slice(m[0].length);
    }
    if (next === text) return { ok: true, changed: false };
    timelineRunner.atomicWrite(facePath, next);
    return { ok: true, changed: true };
  } catch (e) {
    return { ok: false, reason: String((e && e.message) || e).slice(0, 200) };
  }
}

module.exports = {
  writeFeynmanBlocks,
  stampFaceRoomId,
  renderBlock,
  bodyOutsideSentinels,
  HEADER,
  WHAT_CHANGED_HEADING,
  CANNOT_EXPLAIN_HEADING,
  SENTINELS,
  MAX_BLOCK_LINES,
};
