#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick 261005-mux -- a yes is a card, never prose (369.2-INPUT defect 4, SEED-120 P0).
 * ==========================================================================
 * The PreToolUse hook that stops a model answering a gate for the navigator.
 *
 * The defect: a model read a typed "i accept" and called gate_answer itself, so the card was never
 * fired and a basket, a grant or a plan went through on prose. Quick 261004-av2 made every answer
 * record answered_via, but on the CLI every card answer is relayed by the model, so the server cannot
 * refuse a relayed answer outright. The CLI does have a transcript, and this hook reads it: it allows a
 * gate_answer only when the transcript shows the gate's card was fired as an AskUserQuestion AFTER the
 * gate was rendered and the navigator's answer to that card names what gate_answer is about to ratify.
 *
 * What it reads (LOCAL only, Canon Part 8: no network, no Brain, no room file; the transcript is read,
 * scanned and discarded, never echoed to any log):
 *   1. the PreToolUse stdin envelope { tool_name, tool_input: { gate_id, chosen, verdict }, transcript_path };
 *   2. the last 8 MB of the transcript (the check-card-fire bounded-read idiom; the shared AskUserQuestion
 *      detector and text flattener come from lib/hmi/turn-text.cjs, the one transcript reader);
 *   3. the EARLIEST tool_result that carries the gate id and a card (any JSON `options`, `superset_options`
 *      or `verbs` list in that result: research_run, gate_render, chain_run and the meeting card all carry
 *      one). A gate id is minted once, so the earliest result is the render; a later gate_list or mirror that
 *      repeats the id must not move the anchor past a card the navigator already answered;
 *   4. the LATEST AskUserQuestion tool_use after that anchor whose option labels overlap the card's labels
 *      or ids, and its tool_result (the navigator's answer).
 *
 * Verdict:
 *   - deny  "never shown as a card": no overlapping AskUserQuestion after the render (a typed "i accept"
 *           lands here);
 *   - deny  "does not match the card": the card was answered, but not with what `chosen` names;
 *   - allow in every other case, including every case it cannot judge. Fail OPEN: a missing or unreadable
 *     transcript, a gate id the window does not hold, a card with no readable options, a card whose answer is
 *     not in the transcript yet, any internal error. Each such case logs exactly one stderr line,
 *     `surface_degraded:<why>` (ids and labels only; never room content), and exits 0. A false block is worse
 *     than a false allow for a safety hook (the part8-egress-guard-hook posture).
 *
 * The block signal is the PreToolUse JSON on stdout at exit 0:
 *   { "hookSpecificOutput": { "hookEventName": "PreToolUse", "permissionDecision": "deny",
 *     "permissionDecisionReason": "<why>" } }
 * The hook never throws and never exits non-zero.
 *
 * Tri-Polar: this is the CLI cure (and Cowork where it runs the plugin hooks). Claude Desktop runs no hooks;
 * its cure is server-side, the ledger renderer plus card_pending in lib/mcp/tools/gate.cjs.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Pure CJS, zero npm deps.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

// the check-card-fire idiom is a bounded tail read; a card and its answer live in the recent turns
const TAIL_BYTES = 8 * 1024 * 1024;
// one tool_result past this size is not parsed as a card result (a pathological tool output cannot stall a 2000 ms hook)
const MAX_RESULT_PARSE_CHARS = 2 * 1024 * 1024;
const MAX_JSON_BLOCK_ATTEMPTS = 24;

const REASON_NEVER_SHOWN = 'This gate was never shown as a card. Fire AskUserQuestion with the card\'s options, then call gate_answer with the navigator\'s choice; typed words such as \'i accept\' never answer a gate (Canon Part 9, SEED-021).';

let turnText = null;
try {
  turnText = require(path.join(__dirname, '..', 'lib', 'hmi', 'turn-text.cjs'));
} catch (_e) {
  turnText = null;
}

// ---------------------------------------------------------------------------
// exits
// ---------------------------------------------------------------------------
function allow() { process.exit(0); }

function degrade(why) {
  try { process.stderr.write('surface_degraded:' + why + '\n'); } catch (_e) { /* nothing to do */ }
  process.exit(0);
}

function deny(reason) {
  const out = {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  };
  process.stdout.write(JSON.stringify(out) + '\n');
  process.exit(0);
}

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch (_e) {
    return '';
  }
}

// ---------------------------------------------------------------------------
// transcript read: the last TAIL_BYTES, split into lines (a partial first line is dropped)
// ---------------------------------------------------------------------------
function readTailLines(file) {
  let fd = null;
  try {
    const size = fs.statSync(file).size;
    let raw;
    let truncated = false;
    if (size <= TAIL_BYTES) {
      raw = fs.readFileSync(file, 'utf8');
    } else {
      fd = fs.openSync(file, 'r');
      const buf = Buffer.alloc(TAIL_BYTES);
      const n = fs.readSync(fd, buf, 0, TAIL_BYTES, size - TAIL_BYTES);
      raw = buf.slice(0, n).toString('utf8');
      truncated = true;
    }
    const lines = raw.split('\n');
    if (truncated) lines.shift();
    return lines;
  } catch (_e) {
    return null;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (_e2) { /* best effort */ }
    }
  }
}

function parseRecord(line) {
  try {
    const obj = JSON.parse(line);
    return obj && typeof obj === 'object' ? obj : null;
  } catch (_e) {
    return null;
  }
}

function contentBlocks(rec) {
  const msg = rec && rec.message && typeof rec.message === 'object' ? rec.message : rec;
  const c = msg && msg.content;
  if (Array.isArray(c)) return c;
  return [];
}

// a tool_result block's text: a plain string, or the text of its text blocks
function resultText(block) {
  const c = block && block.content;
  if (typeof c === 'string') return c;
  if (Array.isArray(c)) {
    const parts = [];
    for (const b of c) {
      if (typeof b === 'string') parts.push(b);
      else if (b && typeof b.text === 'string') parts.push(b.text);
    }
    return parts.join('\n');
  }
  return '';
}

// ---------------------------------------------------------------------------
// card options out of one tool_result's text
// ---------------------------------------------------------------------------
// Every JSON value in the text: the whole text when it parses, else each balanced top-level
// object that starts a line (the meeting card is markdown with a JSON block inside).
function jsonValuesIn(text) {
  if (text.length > MAX_RESULT_PARSE_CHARS) return [];
  const t = text.trim();
  if (t.startsWith('{') || t.startsWith('[')) {
    try { return [JSON.parse(t)]; } catch (_e) { /* fall through to the block scan */ }
    const marker = t.indexOf('\n\n## ');
    if (marker > 0) {
      try { return [JSON.parse(t.slice(0, marker))]; } catch (_e) { /* fall through */ }
    }
  }
  const out = [];
  let attempts = 0;
  let from = 0;
  while (attempts < MAX_JSON_BLOCK_ATTEMPTS) {
    const nl = text.indexOf('\n{', from);
    const start = nl === -1 ? (from === 0 && text[0] === '{' ? 0 : -1) : nl + 1;
    if (start === -1) break;
    attempts += 1;
    const end = balancedEnd(text, start);
    if (end === -1) { from = start + 1; continue; }
    try { out.push(JSON.parse(text.slice(start, end + 1))); } catch (_e) { /* not JSON */ }
    from = end + 1;
  }
  return out;
}

function balancedEnd(text, start) {
  let depth = 0;
  let inStr = false;
  for (let i = start; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (ch === '\\') { i += 1; continue; }
      if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') depth += 1;
    else if (ch === '}') { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

// Walk a parsed value and collect every card option: the entries of any `options` or `superset_options`
// array (objects with a label and/or id, or bare strings) and any `verbs` array of strings.
// Returns [{ id, label }], either of which may be ''.
function collectOptions(value, out, depth) {
  if (depth > 12 || value === null || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const v of value) collectOptions(v, out, depth + 1);
    return;
  }
  for (const key of Object.keys(value)) {
    const v = value[key];
    if ((key === 'options' || key === 'superset_options' || key === 'verbs') && Array.isArray(v)) {
      for (const o of v) {
        if (typeof o === 'string' && o.length > 0) out.push({ id: o, label: o });
        else if (o && typeof o === 'object' && (typeof o.label === 'string' || typeof o.id === 'string')) {
          out.push({ id: typeof o.id === 'string' ? o.id : '', label: typeof o.label === 'string' ? o.label : '' });
        }
      }
    }
    collectOptions(v, out, depth + 1);
  }
}

function optionsOfResult(text) {
  const out = [];
  for (const v of jsonValuesIn(text)) collectOptions(v, out, 0);
  return out;
}

// ---------------------------------------------------------------------------
// matching
// ---------------------------------------------------------------------------
function norm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .replace(/\s*\((?:recommended|default)\)\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// a loose phrase match: equal, or one contains the other (the shorter at least 4 characters)
function phraseMatch(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  return short.length >= 4 && long.indexOf(short) !== -1;
}

function cardWords(options) {
  const words = new Set();
  for (const o of options) {
    const id = norm(o.id);
    const label = norm(o.label);
    if (id) words.add(id);
    if (label) words.add(label);
  }
  return words;
}

// the labels (and string options) of every question of one AskUserQuestion input
function askOptionLabels(input) {
  const labels = [];
  const qs = input && Array.isArray(input.questions) ? input.questions : [];
  for (const q of qs) {
    const opts = q && Array.isArray(q.options) ? q.options : [];
    for (const o of opts) {
      if (typeof o === 'string') labels.push(norm(o));
      else if (o && typeof o.label === 'string') labels.push(norm(o.label));
    }
  }
  return labels.filter(Boolean);
}

function overlaps(labels, words) {
  for (const l of labels) {
    for (const w of words) {
      if (phraseMatch(l, w)) return true;
    }
  }
  return false;
}

// the navigator's answer values out of an AskUserQuestion tool_result record: the structured
// toolUseResult.answers when present, else the `="value"` pairs of the result text
function answerValues(rec, block) {
  const values = [];
  const tur = rec && rec.toolUseResult;
  if (tur && typeof tur === 'object' && tur.answers && typeof tur.answers === 'object') {
    for (const k of Object.keys(tur.answers)) {
      const v = tur.answers[k];
      if (typeof v === 'string') values.push(v);
      else if (Array.isArray(v)) for (const x of v) if (typeof x === 'string') values.push(x);
    }
  }
  const text = resultText(block);
  if (values.length === 0) {
    const re = /="((?:[^"\\]|\\.)*)"/g;
    let m;
    while ((m = re.exec(text)) !== null) values.push(m[1]);
  }
  return { values: values.map(norm).filter(Boolean), text: norm(text) };
}

// does one chosen entry name something the navigator answered? candidates: the entry itself and, when it is an
// option id of the card, that option's label (and the reverse for a label)
function chosenAnswered(entry, options, answers) {
  const cands = new Set();
  const e = norm(entry);
  if (e) cands.add(e);
  for (const o of options) {
    if (norm(o.id) === e && o.label) cands.add(norm(o.label));
    if (norm(o.label) === e && o.id) cands.add(norm(o.id));
  }
  const pool = answers.values.length > 0 ? answers.values : [answers.text];
  for (const a of pool) {
    const pieces = [a].concat(a.split(/\s*,\s*/));
    for (const p of pieces) {
      for (const c of cands) {
        if (phraseMatch(p, c)) return true;
      }
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function isAskUserQuestion(block) {
  if (!block || typeof block !== 'object' || block.type !== 'tool_use') return false;
  if (turnText && typeof turnText.scanContentForAskUserQuestion === 'function') {
    return turnText.scanContentForAskUserQuestion([block]);
  }
  return /AskUserQuestion/i.test(String(block.name || ''));
}

function main() {
  const raw = readStdinSync();
  if (!raw || !raw.trim()) return degrade('empty_stdin');
  let env;
  try {
    env = JSON.parse(raw);
  } catch (_e) {
    return degrade('bad_stdin');
  }
  if (!env || typeof env !== 'object' || Array.isArray(env)) return degrade('bad_stdin');

  // not our tool: allow without a word (the matcher keeps this off the hot path, this is the belt)
  const tool = typeof env.tool_name === 'string' ? env.tool_name : '';
  if (!/(?:^|__)gate_answer$/.test(tool)) return allow();

  const input = env.tool_input && typeof env.tool_input === 'object' ? env.tool_input : null;
  const gateId = input && typeof input.gate_id === 'string' ? input.gate_id : '';
  const chosen = input && Array.isArray(input.chosen) ? input.chosen.filter(function (c) { return typeof c === 'string' && c.length > 0; }) : [];
  if (!gateId || chosen.length === 0) return degrade('bad_tool_input');

  const file = typeof env.transcript_path === 'string' ? env.transcript_path.trim() : '';
  if (!file) return degrade('no_transcript_path');
  const lines = readTailLines(file);
  if (lines === null) return degrade('transcript_unreadable');

  // 1. the anchor: the earliest tool_result that carries this gate id and a card
  let anchor = -1;
  let cardOptions = [];
  let sawIdInResult = false;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.indexOf(gateId) === -1 || line.indexOf('tool_result') === -1) continue;
    const rec = parseRecord(line);
    if (!rec) continue;
    for (const block of contentBlocks(rec)) {
      if (!block || block.type !== 'tool_result') continue;
      const text = resultText(block);
      if (text.indexOf(gateId) === -1) continue;
      sawIdInResult = true;
      const opts = optionsOfResult(text);
      if (opts.length > 0) {
        anchor = i;
        cardOptions = opts;
        break;
      }
    }
    if (anchor !== -1) break;
  }
  if (anchor === -1) return degrade(sawIdInResult ? 'no_card_options_for_gate' : 'gate_not_in_transcript');

  // 2. the latest AskUserQuestion after the anchor whose options overlap the card's
  const words = cardWords(cardOptions);
  let askId = '';
  let askIdx = -1;
  for (let i = anchor + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.indexOf('AskUserQuestion') === -1 || line.indexOf('tool_use') === -1) continue;
    const rec = parseRecord(line);
    if (!rec) continue;
    for (const block of contentBlocks(rec)) {
      if (!isAskUserQuestion(block)) continue;
      if (overlaps(askOptionLabels(block.input), words)) {
        askId = typeof block.id === 'string' ? block.id : '';
        askIdx = i;
      }
    }
  }
  if (askIdx === -1) return deny(REASON_NEVER_SHOWN);
  if (!askId) return degrade('card_tool_use_without_id');

  // 3. the navigator's answer to that card
  let answers = null;
  for (let i = askIdx + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.indexOf(askId) === -1 || line.indexOf('tool_result') === -1) continue;
    const rec = parseRecord(line);
    if (!rec) continue;
    for (const block of contentBlocks(rec)) {
      if (block && block.type === 'tool_result' && block.tool_use_id === askId) {
        answers = answerValues(rec, block);
        break;
      }
    }
    if (answers) break;
  }
  if (!answers) return degrade('card_answer_not_in_transcript');

  // 4. every chosen entry must name something the navigator answered
  for (const entry of chosen) {
    if (!chosenAnswered(entry, cardOptions, answers)) {
      const shown = answers.values.slice(0, 4).join(' / ').slice(0, 160) || '(no answer text)';
      return deny('chosen does not match the card\'s answer (' + shown + '). Call gate_answer with exactly what the navigator picked on the card, or fire the card again.');
    }
  }
  return allow();
}

process.on('uncaughtException', function () {
  try { process.stderr.write('surface_degraded:hook_error\n'); } catch (_e) { /* nothing to do */ }
  process.exit(0);
});

try {
  main();
} catch (_e) {
  try { process.stderr.write('surface_degraded:hook_error\n'); } catch (_e2) { /* nothing to do */ }
  process.exit(0);
}
