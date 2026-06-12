#!/usr/bin/env node
'use strict';

/**
 * transcript-ingest.cjs (Quick task 260612-pkb -- Conversation Intake Plumbing)
 *
 * Dependency-free, OFFLINE parser that turns a Claude Code transcript JSONL
 * file into ordered conversation fragments, plus a tiny extractive summary
 * helper. This is the missing intake seam: cmdStop / cmdPreCompact in
 * memory-lifecycle.cjs read MINDRIAN_TRANSCRIPT_PATH (exported by scripts/on-stop),
 * parse the transcript here, and write real user/assistant fragments into the
 * active room's room.db. Every dormant downstream reader (voice_log writer,
 * sessions.summary, RECENT SESSIONS resume block) then lights up unchanged.
 *
 * Canon Part 8 (Graph Boundary): this module makes ZERO network calls and ZERO
 * remote-methodology-repository calls. It is a pure local read plus parse:
 * no outbound requests, no remote endpoints, no egress of any kind. The
 * Part-8 source-scan gate over this file MUST return zero matches for any
 * network or remote-endpoint token.
 *
 * Failure-mode contract (matches memory-lifecycle.cjs): every path is
 * try/catch + graceful return. A missing path returns []. A malformed line is
 * skipped. buildSummary of [] returns ''. Nothing here ever throws.
 *
 * Exports:
 *   parseTranscript(transcriptPath) -> Array<{role, content}>
 *   buildSummary(fragments)         -> string (3-5 sentence extractive summary)
 */

const fs = require('node:fs');

// Per-fragment safety cap: truncate any single fragment to this many chars.
const MAX_FRAGMENT_CHARS = 4000;
// Whole-session cap: keep at most this many fragments (most recent slice if
// exceeded, preserving chronological order of the kept slice).
const MAX_FRAGMENTS = 1000;

// User turns that are hook/command chrome, not conversation. Dropped.
const CHROME_PREFIXES = ['<command-', '<local-command', '<system-reminder'];

function truncate(s) {
  if (typeof s !== 'string') return '';
  if (s.length <= MAX_FRAGMENT_CHARS) return s;
  return s.slice(0, MAX_FRAGMENT_CHARS);
}

// Extract conversational text from a user message.content value.
// Normal user turns carry a STRING. Some carry an ARRAY of blocks (only
// 'text' blocks are conversational; 'tool_result' blocks are dropped).
function extractUserText(content) {
  if (typeof content === 'string') {
    return content.trim();
  }
  if (Array.isArray(content)) {
    const parts = [];
    for (const block of content) {
      if (block && block.type === 'text' && typeof block.text === 'string') {
        parts.push(block.text);
      }
      // tool_result and any other block type are dropped.
    }
    return parts.join('\n').trim();
  }
  return '';
}

// Extract conversational text from an assistant message.content value.
// Assistant turns carry an ARRAY of blocks. Keep only 'text' blocks; drop
// 'thinking' and 'tool_use' blocks.
function extractAssistantText(content) {
  if (Array.isArray(content)) {
    const parts = [];
    for (const block of content) {
      if (block && block.type === 'text' && typeof block.text === 'string') {
        parts.push(block.text);
      }
      // thinking and tool_use blocks are dropped.
    }
    return parts.join('\n').trim();
  }
  if (typeof content === 'string') {
    return content.trim();
  }
  return '';
}

function isChrome(text) {
  for (const prefix of CHROME_PREFIXES) {
    if (text.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * Parse a Claude Code transcript JSONL file into ordered conversation
 * fragments. Returns [] for a missing/unreadable path or on any failure.
 * @param {string} transcriptPath
 * @returns {Array<{role: string, content: string}>}
 */
function parseTranscript(transcriptPath) {
  if (!transcriptPath || typeof transcriptPath !== 'string') return [];
  let raw;
  try {
    raw = fs.readFileSync(transcriptPath, 'utf8');
  } catch (_) {
    return [];
  }
  if (!raw) return [];

  const out = [];
  const lines = raw.split('\n');
  for (const line of lines) {
    if (!line) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch (_) {
      continue; // skip malformed line
    }
    if (!record || !record.message) continue;
    const type = record.type;
    if (type !== 'user' && type !== 'assistant') continue;

    let text = '';
    if (type === 'user') {
      text = extractUserText(record.message.content);
      // Drop hook/command chrome and pure tool-result echoes.
      if (text && isChrome(text)) continue;
    } else {
      text = extractAssistantText(record.message.content);
    }

    if (!text || !text.trim()) continue; // skip empty/whitespace-only
    out.push({ role: type, content: truncate(text) });
  }

  // Whole-session cap: keep the most recent MAX_FRAGMENTS, preserving order.
  if (out.length > MAX_FRAGMENTS) {
    return out.slice(out.length - MAX_FRAGMENTS);
  }
  return out;
}

// First sentence of a block, truncated to ~maxChars. Sentence boundary is the
// first '. ' / '! ' / '? ' / newline; falls back to the whole (truncated) text.
function firstSentence(text, maxChars) {
  if (typeof text !== 'string' || !text.trim()) return '';
  const flat = text.replace(/\s+/g, ' ').trim();
  const m = flat.match(/^(.+?[.!?])(\s|$)/);
  let sentence = m ? m[1] : flat;
  if (sentence.length > maxChars) {
    sentence = sentence.slice(0, maxChars).trim() + '...';
  }
  return sentence;
}

function firstByRole(fragments, role) {
  for (const f of fragments) {
    if (f && f.role === role && typeof f.content === 'string' && f.content.trim()) {
      return f.content;
    }
  }
  return '';
}

function lastByRole(fragments, role) {
  for (let i = fragments.length - 1; i >= 0; i--) {
    const f = fragments[i];
    if (f && f.role === role && typeof f.content === 'string' && f.content.trim()) {
      return f.content;
    }
  }
  return '';
}

/**
 * Build a 3-5 sentence extractive (offline) summary from real fragments.
 * No em-dashes. Returns '' when there are no fragments.
 * @param {Array<{role: string, content: string}>} fragments
 * @returns {string}
 */
function buildSummary(fragments) {
  if (!Array.isArray(fragments) || fragments.length === 0) return '';

  const sentences = [];

  // Sentence 1: turn count.
  sentences.push('Session covered ' + fragments.length + ' exchanges.');

  // Sentence 2: opening ask (first user fragment).
  const firstUser = firstByRole(fragments, 'user');
  if (firstUser) {
    const opening = firstSentence(firstUser, 200);
    if (opening) sentences.push('Opening: ' + opening);
  }

  // Sentence 3: latest focus (last assistant fragment).
  const lastAssistant = lastByRole(fragments, 'assistant');
  if (lastAssistant) {
    const latest = firstSentence(lastAssistant, 200);
    if (latest) sentences.push('Latest: ' + latest);
  }

  // Sentence 4 (optional): a later user fragment that differs from the first.
  if (sentences.length < 5) {
    for (let i = fragments.length - 1; i >= 0; i--) {
      const f = fragments[i];
      if (f && f.role === 'user' && typeof f.content === 'string' && f.content.trim()) {
        if (f.content !== firstUser) {
          const also = firstSentence(f.content, 200);
          if (also) sentences.push('Also raised: ' + also);
        }
        break;
      }
    }
  }

  let joined = sentences.slice(0, 5).join(' ');
  if (joined.length > 800) {
    joined = joined.slice(0, 800).trim();
  }
  return joined;
}

module.exports = { parseTranscript, buildSummary, MAX_FRAGMENT_CHARS, MAX_FRAGMENTS };
