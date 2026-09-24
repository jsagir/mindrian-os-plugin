#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 298-03 -- the single transcript reader (R-08 first half)
 * =================================================================
 * This is THE ONE transcript reader in the repo. It exists so that
 * `scripts/check-card-fire.cjs` and `scripts/check-voice-style.cjs` (the rung-2
 * voice hook, plan 298-07) read the last assistant turn through the SAME code
 * path instead of growing a second, drifting copy.
 *
 * Lifted verbatim from `scripts/check-card-fire.cjs:1411-1607`
 * (`readTranscriptTurn` 1411-1505, `readTranscriptTail` 1511-1531,
 * `extractAssistantText` 1535-1546, `classifyPrecedingUserContentSource`
 * 1567-1591, `scanContentForAskUserQuestion` 1595-1605, `TRANSCRIPT_TAIL_BYTES`
 * 250). Function bodies moved unchanged -- this is a LIFT, not a rewrite.
 *
 * Two live consumers:
 *   - `scripts/check-card-fire.cjs` (repointed in this same plan, Task 2)
 *   - `scripts/check-voice-style.cjs` (a later plan, 298-07)
 *
 * Canon Part 8 (Graph Boundary): this module does LOCAL FILE READS ONLY. It
 * never makes a network call and never egresses transcript content anywhere;
 * it reads a local `.jsonl` transcript path, returns plain strings/booleans to
 * its caller, and that is the entire contract.
 *
 * The retry-key content-hash helper originally at `scripts/check-card-fire.cjs:386`
 * DELIBERATELY did NOT come along on this lift. It requires the sibling
 * option-label-extraction module under `lib/core/` (the same one card-fire's
 * relevance predicate reads) plus the `ASCII_BOX_GLYPH_RE` / glyph-span-matching
 * machinery -- that is card-fire DOMAIN logic (the Decision-Gate detection
 * heuristic), not transcript reading. Pulling it in here would drag that
 * sibling module and the glyph regexes into a module whose only job is reading
 * text off disk. That content-hash helper and its glyph-span sibling stay in
 * `scripts/check-card-fire.cjs`; this module has no dependency on card-fire's
 * option-label-extraction sibling module (and must never gain one).
 *
 * Every read degrades rather than throws: a missing or unreadable transcript
 * path yields the documented empty state (never a thrown error), matching the
 * source's existing never-block-the-hook contract (WR-08 / T-298-07).
 */

'use strict';

const fs = require('node:fs');

// WR-08: the transcript-read tail cap. readTurnText / readTranscriptTurn read only
// the LAST TRANSCRIPT_TAIL_BYTES of the transcript file so a pathological
// multi-hundred-MB Stop transcript cannot stall the 3000ms hook. Detection
// semantics are unchanged: the LAST assistant message lives at the tail. 2 MiB
// comfortably holds many recent turns; a partial leading line introduced by the
// byte cut is dropped by the per-line JSON try/catch below.
const TRANSCRIPT_TAIL_BYTES = 2 * 1024 * 1024;

// readTranscriptTail(transcriptPath) -- WR-08: read at most the LAST TRANSCRIPT_TAIL_BYTES of
// the transcript file. For a file at or under the cap this is a plain read; for a larger file
// we open a descriptor, stat the size, and read only the trailing window. Returns the UTF-8
// string, or null on any error (the caller degrades to empty signals). Never throws.
function readTranscriptTail(transcriptPath) {
  let fd = null;
  try {
    const st = fs.statSync(transcriptPath);
    const size = st.size;
    if (size <= TRANSCRIPT_TAIL_BYTES) {
      return fs.readFileSync(transcriptPath, 'utf8');
    }
    fd = fs.openSync(transcriptPath, 'r');
    const start = size - TRANSCRIPT_TAIL_BYTES;
    const buf = Buffer.alloc(TRANSCRIPT_TAIL_BYTES);
    const bytesRead = fs.readSync(fd, buf, 0, TRANSCRIPT_TAIL_BYTES, start);
    return buf.slice(0, bytesRead).toString('utf8');
  } catch (_e) {
    return null;
  } finally {
    if (fd !== null) {
      try { fs.closeSync(fd); } catch (_e2) { /* best-effort */ }
    }
  }
}

// extractAssistantText(content) -- flatten an assistant message's content into text. Content
// is either a plain string or an array of blocks; we concatenate the text blocks. Never throws.
function extractAssistantText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  const parts = [];
  for (const block of content) {
    if (typeof block === 'string') { parts.push(block); continue; }
    if (block && typeof block === 'object' && typeof block.text === 'string') {
      parts.push(block.text);
    }
  }
  return parts.join('\n');
}

// HARNESS_LEADS -- Phase 357-07 (D-07 amended by R-A), WIDENED by Phase 360-06 (SPEC R5,
// D-10) to five entries, tightened by 360-REVIEW WR-01 for one of the five. Structural
// leading-tag startsWith matches ONLY, never a match on meaning -- see leadMatchesHarnessTag
// below for the one exception:
//   - '<task-notification' and '[Cross-session idle notice]' -- unchanged from 357-07.
//     Measured from the 30-day evidence (RESEARCH Finding 4): a real task-notification
//     record and the idle-notice framing both appear as stored leading text.
//   - the 37-char peer stem 'Another Claude session sent a message' -- replaces 357-07's
//     40-char LONGEST-COMMON-PREFIX measurement ('Another Claude session sent a message:'
//     plus a newline and a tag-open bracket). The stem is a PREFIX of that measured LCP, so
//     every stored-peer match 357-07 made still matches; it additionally covers the
//     'while you were working' framing variant and a CRLF line ending the embedded-newline
//     LCP would have missed (RESEARCH Finding 7, Pitfall 6). WR-01 (360-REVIEW.md): a bare
//     startsWith on this entry alone also matches a human sentence that merely opens with
//     those words, so this ONE entry additionally requires PEER_STEM_FRAMING_RE to match
//     what immediately follows the stem (leadMatchesHarnessTag below) -- the other four
//     entries are unaffected and stay plain startsWith.
//   - '<agent-message' and '<cross-session-message' -- ADDED by 360-06. 357-07's R-A pass
//     dropped both because the 30-day STOP-path evidence showed 0 stored occurrences of
//     either as user text. The 360 UserPromptSubmit replay evidence shows they DO lead the
//     raw prompt text of 15 queued peer deliveries at UserPromptSubmit time (7 of which
//     fired the room-bind picker before this fix, SPEC R5). Adding them here closes that
//     gap for both hooks at once, since both share this one list; the two tags still have
//     0 stored occurrences on the Stop path, so D-11's replay proof (below) stays green.
// D-11 / Stop-path compatibility proof: tests/run-all-357.sh's replay leg stays green after
// this widening (0 pass->block flips, 0 new misses, 0 human-upstream flips), because the
// Stop-path rule that reads this list (rule 2 below) is origin-gated (fires only when
// originKind !== 'human'), unchanged by this edit.
const HARNESS_LEADS = Object.freeze([
  '<task-notification',
  '[Cross-session idle notice]',
  'Another Claude session sent a message',
  '<agent-message',
  '<cross-session-message',
]);

// PEER_STEM -- the one entry in HARNESS_LEADS above that needs a secondary
// discriminator (WR-01, 360-REVIEW.md). Kept as its own name so the check below reads
// as "this specific tag" rather than a magic string repeated twice.
const PEER_STEM = 'Another Claude session sent a message';

// PEER_STEM_FRAMING_RE -- WR-01 fix (360-REVIEW.md): a bare `lead.startsWith(PEER_STEM)`
// test also matches a plausible HUMAN sentence that merely opens with those words (for
// example, asking Larry about a peer notification the user just saw -- this plugin is the
// one surfacing peer messages to users, so that shape is not far-fetched). The two known
// binary framings this stem exists to catch (RESEARCH Finding 4/7) never stop at the bare
// stem: they continue either straight into ':' or into ' while you were working:', and in
// both stored forms that colon is immediately followed by (at most) inline whitespace and a
// line break, because Claude Code always places the <agent-message>/<cross-session-message>
// tag on the NEXT line, never the same line. Requiring that continuation shape after the
// stem is what tells the two real framings apart from a human sentence that happens to
// start the same way and then keeps going in prose. `[^\n\r:]*` bounds the "while you were
// working" gap without matching across a line boundary.
const PEER_STEM_FRAMING_RE = /^(?::|[ \t]+while\b[^\n\r:]*:)[ \t]*\r?\n/;

// leadMatchesHarnessTag(lead, tag) -- rule 2's per-entry match. Every entry is a plain
// startsWith(tag) except PEER_STEM, which additionally requires PEER_STEM_FRAMING_RE to
// match the text immediately following the stem (WR-01). Never throws (callers already run
// inside a try/catch).
function leadMatchesHarnessTag(lead, tag) {
  if (!lead.startsWith(tag)) return false;
  if (tag === PEER_STEM) {
    return PEER_STEM_FRAMING_RE.test(lead.slice(tag.length));
  }
  return true;
}

// classifyPrecedingUserContentSourceBase(content) -- the original structural
// classification, UNCHANGED (this is the byte-identical 1-arg body; see the exported
// classifyPrecedingUserContentSource below for the R-A extension). Never throws.
function classifyPrecedingUserContentSourceBase(content) {
  try {
    if (typeof content === 'string') {
      return content.trim() ? 'typed' : 'none';
    }
    if (!Array.isArray(content) || content.length === 0) return 'none';
    let sawSynthetic = false;
    for (const block of content) {
      if (typeof block === 'string') {
        if (block.trim()) return 'typed';
        continue;
      }
      if (block && typeof block === 'object') {
        if (typeof block.text === 'string' && block.text.trim()) return 'typed';
        // A tool_result block (type:'tool_result', or carrying a tool_use_id) is the
        // CONFIRMED synthetic shape from the RCA evidence. Any other object-shaped block
        // with no text field is treated the same way (never promoted to 'typed' on a guess).
        sawSynthetic = true;
      }
    }
    return sawSynthetic ? 'tool_result' : 'none';
  } catch (_e) {
    return 'none';
  }
}

// classifyPrecedingUserContentSource(content, rec) -- room-bind-gate-fires-on-notification-
// only-turns (2026-07-23), extended by Phase 357-07 (D-07 amended by R-A, the V3
// human-upstream carve-out): distinguishes a genuinely HUMAN-typed preceding user turn from
// a SYNTHETIC transcript record that merely carries the role:user marker with no
// human-authored text at all -- a tool_result envelope (a background tool call's result), an
// automated task-notification block, or a harness hand-back / idle-notice record (a
// subagent's completion notice or a background peer message, which Claude Code surfaces as a
// role:user record with a REAL text block, not an empty one). Returns one of:
//   'typed'       - at least one block carries real human-authored text (or a non-empty bare
//                   string), and neither harness rule below fires -- KEEP the existing
//                   conservative force-floor for this case.
//   'tool_result' - every content block is a tool_result / non-text synthetic envelope, so
//                   NO human text field exists anywhere in the record.
//   'harness'     - the record carries a REAL text block (so the base class would be 'typed'),
//                   but the record itself is structurally non-human: EITHER it is flagged
//                   isMeta and the immediately preceding user record was not itself
//                   human-upstream (rule 1), OR its origin is not 'human' and its text leads
//                   with a known harness tag (rule 2, HARNESS_LEADS). The PRIMARY-path
//                   relevance check must NOT treat this as "insufficient signal from a
//                   human", because there was no human turn to have insufficient signal.
//   'none'        - no content at all (null/undefined/empty array/empty string) -- an
//                   unexplained absence, not a CONFIRMED synthetic record; stays conservative.
//
// The R-A carve-out (rule 1's `prevHumanUpstream` guard) is what keeps a Skill-body or
// image-placeholder isMeta record sitting directly after a human-typed prompt classified
// 'typed', not 'harness' -- these are real human-initiated turns whose immediate next record
// merely carries harness-shaped bookkeeping, not a hand-off from another actor.
//
// The match is STRUCTURAL ONLY (the isMeta flag, origin.kind, or a leading tag), never on
// meaning -- rec is optional and 1-arg callers get the byte-identical base classification
// (test-209 Behavior 14). Never throws.
// @param {*} content
// @param {{isMeta?: boolean, originKind?: string, prevHumanUpstream?: boolean}} [rec]
function classifyPrecedingUserContentSource(content, rec) {
  try {
    const base = classifyPrecedingUserContentSourceBase(content);
    if (!rec || typeof rec !== 'object') return base;
    const isMeta = rec.isMeta === true;
    const originKind = typeof rec.originKind === 'string' ? rec.originKind : undefined;
    const prevHumanUpstream = rec.prevHumanUpstream === true;
    // Rule 1: isMeta on a record that DOES carry real text (base 'typed'), AND
    // the previous user record was not itself human-upstream. Gating on
    // base === 'typed' keeps an isMeta record with empty/absent content
    // (base 'none') at the conservative 'none' floor instead of being
    // silently promoted to 'harness' (CR-01, 357-REVIEW.md).
    if (isMeta && base === 'typed' && !prevHumanUpstream) return 'harness';
    // Rule 2: a non-human origin whose text leads with a known harness tag. Gated on
    // origin so a human who happens to PASTE one of these tags still reads 'typed'.
    if (originKind !== 'human') {
      const lead = extractAssistantText(content).trimStart();
      if (HARNESS_LEADS.some(function (tag) { return leadMatchesHarnessTag(lead, tag); })) {
        return 'harness';
      }
    }
    return base;
  } catch (_e) {
    return 'none';
  }
}

// LEAD_ONLY_REC -- Phase 360-06 (D-01, D-02): the rec classifyUserPromptText below passes
// to classifyPrecedingUserContentSource. isMeta stays false because forwarding an assumed
// isMeta flag with no provable previous record would break the R-A carve-out (rule 1 above
// needs a real prevHumanUpstream signal this hook cannot supply, so it never fires here);
// originKind stays undefined because the UserPromptSubmit hook stdin carries no origin
// field at all at the currently-installed Claude Code version (A1, re-checked live against
// the installed docs; RESEARCH Finding 1); prevHumanUpstream is a harmless default (rule 1
// never reads it while isMeta is false). The net effect is that this rec reduces
// classifyPrecedingUserContentSource to rule 2 only: a lead-only startsWith test against
// HARNESS_LEADS, gated on originKind !== 'human' (which undefined satisfies).
const LEAD_ONLY_REC = Object.freeze({ isMeta: false, originKind: undefined, prevHumanUpstream: true });

// classifyUserPromptText(text) -- Phase 360-06: the UserPromptSubmit hook's entry point
// into the ONE shared classifier (SPEC R4, R5). scripts/intent-classifier.cjs calls this
// instead of holding a harness-tag list, a regex, or an isMeta/origin rule of its own, so
// the Stop hook and the UserPromptSubmit hook share one rule body and one HARNESS_LEADS
// list (D-02).
//
// D-01's working name (classifyUserPromptPayload(payload, opts)) was replaced, under
// Claude's Discretion, by this 1-arg text signature: the hook already extracts the prompt
// text itself before calling this, so judging exactly that text needs no second JSON parse
// and no payload object threaded into this module.
//
// D-03 is moot and D-04 is SUPERSEDED here (RESEARCH Findings 1 and 4): the
// UserPromptSubmit stdin carries no origin or isMeta field at all, and even where a bounded
// tail read might have supplied one, the docs say that read can lag the hook's own
// invocation -- so the verdict below is LEAD-ONLY, with no added file access of any kind
// beyond what already exists elsewhere in this module for the Stop-hook path. Accepted
// limit (0 observed cases in a 2,154-prompt human census, SPEC R5): a human prompt whose
// very first characters happen to match a harness lead is treated as harness.
//
// Never throws (PSB-06 never-block contract); a non-string input returns 'none' directly.
// @param {*} text
// @returns {'harness'|'typed'|'tool_result'|'none'}
function classifyUserPromptText(text) {
  try {
    if (typeof text !== 'string') return 'none';
    return classifyPrecedingUserContentSource(text, LEAD_ONLY_REC);
  } catch (_e) {
    return 'none';
  }
}

// scanContentForAskUserQuestion(content) -- true if any tool_use block names the
// AskUserQuestion tool. Tolerates string content, a single block, or an array. Never throws.
function scanContentForAskUserQuestion(content) {
  if (!content) return false;
  const blocks = Array.isArray(content) ? content : [content];
  for (const block of blocks) {
    if (!block || typeof block !== 'object') continue;
    const isToolUse = block.type === 'tool_use' || typeof block.name === 'string';
    const name = typeof block.name === 'string' ? block.name : '';
    if (isToolUse && /AskUserQuestion/i.test(name)) return true;
  }
  return false;
}

// readTurnText(transcriptPath) -- the new exported boundary function. Same parse walk as
// readTranscriptTurn below, but STOPS SHORT of askuserquestion_fired and gate_signature (both
// card-fire-domain computations that need the content-hash helper and ASCII_BOX_GLYPH_RE,
// which stayed behind in scripts/check-card-fire.cjs). Returns the raw assistant_contents
// array too, so a caller that DOES need askuserquestion_fired (card-fire) can recompute it
// itself via scanContentForAskUserQuestion without this module ever touching card-fire's
// option-label-extraction sibling module.
//
// Defensive (Part 8 / on-stop discipline): a missing / unreadable / malformed transcript
// returns the empty state; NEVER throws. The transcript content stays LOCAL -- read, scanned,
// discarded; never egressed.
function readTurnText(transcriptPath) {
  const empty = {
    output_text: '',
    preceding_user_text: '',
    preceding_user_text_source: 'none',
    preceding_user_is_meta: false,
    assistant_contents: [],
  };
  if (typeof transcriptPath !== 'string' || !transcriptPath.trim()) return empty;
  const raw = readTranscriptTail(transcriptPath);
  if (raw === null) return empty;
  let lastAssistantText = '';
  // WR-06 (Phase 209-07, H2 widened): currentTurnAssistantContents collects every assistant
  // message's content since the last role:user record, and RESETS on each role:user record --
  // see the fuller rationale in the original scripts/check-card-fire.cjs comment this was
  // lifted from (askFired scoping is computed by the CALLER from assistant_contents; this
  // function only collects the array).
  // CR-03 INVARIANT (unchanged, restated): user messages bound the WINDOW only. A transcript
  // with no role:user record (a compaction summary lead, or an auto-fire-before-the-user-types
  // flow) is simply ONE window spanning the whole tail (the degenerate case: the reset never
  // fires, so all assistant messages accumulate) -- this is intentional, not a gap.
  let currentTurnAssistantContents = [];
  // Phase 210-05 (item 210-E-1): capture the LAST role:user record's text so the
  // relevance predicate can see the preceding user turn. Per the CR-03 invariant
  // (restated above) this text feeds ONLY the relevance verdict in classifyCardFire;
  // it is NEVER folded into gate_signature or turnContextHash.
  let lastPrecedingUserText = '';
  // room-bind-gate-fires-on-notification-only-turns (2026-07-23): the source
  // classification alongside lastPrecedingUserText -- 'typed' | 'tool_result' | 'harness'
  // | 'none' (see classifyPrecedingUserContentSource; 'harness' added Phase 357-07,
  // D-07/R-A). Feeds ONLY the PRIMARY-path relevance check in classifyCardFire, same
  // CR-03 scoping as lastPrecedingUserText itself.
  let lastPrecedingUserTextSource = 'none';
  // Phase 357-07 (D-07/R-A): the LAST role:user record's own isMeta flag, threaded
  // alongside the source classification so a downstream consumer (none today; reserved
  // for a future harness-aware caller) can see the raw flag without re-parsing the
  // transcript. Same CR-03 scoping.
  let lastPrecedingUserIsMeta = false;
  // Phase 357-07 (D-07/R-A, Pattern 4): whether the PREVIOUS role:user record (the one
  // before the current one being classified) was itself human-upstream -- origin 'human',
  // or a non-meta record leading with a slash-command tag. This is the V3 carve-out input:
  // an isMeta record directly after a human-upstream record stays 'typed', not 'harness'.
  let prevUserHumanUpstream = false;
  const lines = raw.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch (_e) {
      continue; // skip a malformed line, never throw (also drops the WR-08 partial head line)
    }
    if (!obj || typeof obj !== 'object') continue;
    const msg = obj.message && typeof obj.message === 'object' ? obj.message : obj;
    const role = msg.role || obj.type;
    if (role === 'user') {
      // A user record resets the CURRENT-TURN window (T-209-29): a card fired in a
      // PRIOR turn must never mask a no-card box in the NEXT turn. It is NEVER part
      // of the retry key (CR-03 above). Phase 210-05 adds ONE more use: the LAST
      // user record's text is captured for the relevance verdict (and ONLY that
      // verdict -- never the signature, never the hash).
      const userContent = (msg.content !== undefined && msg.content !== null)
        ? msg.content
        : (obj.content !== undefined ? obj.content : null);
      const isMeta = obj.isMeta === true;
      const originKind = (obj.origin && typeof obj.origin === 'object' && typeof obj.origin.kind === 'string')
        ? obj.origin.kind
        : undefined;
      lastPrecedingUserText = extractAssistantText(userContent);
      lastPrecedingUserTextSource = classifyPrecedingUserContentSource(userContent, {
        isMeta: isMeta,
        originKind: originKind,
        prevHumanUpstream: prevUserHumanUpstream,
      });
      lastPrecedingUserIsMeta = isMeta;
      // Update the human-upstream tracker for the NEXT role:user record's rule-1 check:
      // human-upstream means an explicit origin 'human', or a non-meta record whose text
      // leads with a slash-command tag (a real human-typed command, which Claude Code
      // still surfaces without an origin.kind).
      prevUserHumanUpstream = originKind === 'human'
        || (!isMeta && /^(<command-name|<command-message)/.test(lastPrecedingUserText.trimStart()));
      currentTurnAssistantContents = [];
      continue;
    }
    if (role === 'assistant') {
      const text = extractAssistantText(msg.content);
      if (text) lastAssistantText = text;
      // Prefer the message.content; fall back to a top-level obj.content only when
      // this same record carries it (no cross-record bleed).
      const content = (msg.content !== undefined && msg.content !== null)
        ? msg.content
        : (obj.content !== undefined ? obj.content : null);
      currentTurnAssistantContents.push(content);
    }
  }
  return {
    output_text: lastAssistantText,
    preceding_user_text: lastPrecedingUserText,
    preceding_user_text_source: lastPrecedingUserTextSource,
    preceding_user_is_meta: lastPrecedingUserIsMeta,
    assistant_contents: currentTurnAssistantContents,
  };
}

// readTranscriptTurn(transcriptPath) -- a thin wrapper kept for source compatibility: calls
// readTurnText and adds askuserquestion_fired via scanContentForAskUserQuestion (an OR across
// every assistant message of the current turn, same H2 semantics as the original). Leaves
// gate_signature undefined; card-fire computes and supplies its own via its local
// content-hash helper (which stayed behind, see the module header).
function readTranscriptTurn(transcriptPath) {
  const turn = readTurnText(transcriptPath);
  const askFired = turn.assistant_contents.some(scanContentForAskUserQuestion);
  return {
    output_text: turn.output_text,
    askuserquestion_fired: askFired,
    gate_signature: undefined,
    preceding_user_text: turn.preceding_user_text,
    preceding_user_text_source: turn.preceding_user_text_source,
    preceding_user_is_meta: turn.preceding_user_is_meta,
  };
}

module.exports = {
  readTurnText,
  readTranscriptTurn,
  readTranscriptTail,
  extractAssistantText,
  classifyPrecedingUserContentSource,
  classifyUserPromptText,
  scanContentForAskUserQuestion,
  TRANSCRIPT_TAIL_BYTES,
  HARNESS_LEADS,
};
