#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * scripts/check-voice-style.cjs -- Phase 298-07 (R-08, rung 2: LOGGED)
 * =========================================================================
 * WHAT IT IS: the rung-2 voice observer. A Stop hook that scans the last
 * assistant turn for two prose-stated voice rules -- the hyphens-only rule
 * and the De Stijl voice-mark rule (Canon Part 12, agents/larry-extended.md
 * "Voice Signature") -- and appends one JSONL row per violation to the
 * local evidence log (lib/hmi/voice-style-log.cjs). Rung 1 (declared) is
 * already live in agent/skill prose; this hook is what gives a later
 * promotion decision (plan 298-08's evaluatePromotion) something to read.
 *
 * LOG ONLY. This hook NEVER blocks and NEVER fails a turn for the voice
 * check itself. Every code path emits {continue: true} and exits 0. A
 * violation is recorded, not enforced -- enforcement is rung 3, a future
 * plan, not this one.
 *
 * The two rules (the only real work in this file):
 *   - dash rule: the turn text contains U+2014 (em dash) or U+2013 (en
 *     dash), tested via the JavaScript escapes backslash-u-2014 and
 *     backslash-u-2013 so this source file itself stays hyphens-only. On a
 *     hit: one row,
 *     policy_id 'voice-hyphens-only', detail names the codepoint and the
 *     character offset of the first hit.
 *   - glyph rule: the turn does not open with exactly one valid De Stijl
 *     voice mark (lib/hmi/voice-color-mark.cjs::detectVoiceMark, the five
 *     glyphs named in agents/larry-extended.md's Voice Signature section).
 *     On an invalid verdict: one row, policy_id 'voice-glyph-present',
 *     detail names which of hasMark / count / isNativeHost explains it.
 * Both rules can fire in the same turn (two rows). An empty turn text
 * produces zero rows.
 *
 * Phase 369.6-06 (D-18, D-44, A-04, R-14) adds three things, all shadow mode (evaluate, log,
 * never block):
 *   - a denominator row, policy_id 'voice-turn-evaluated', one per evaluated turn, so a violation
 *     rate per policy and template version can be computed;
 *   - a framework-dump rule, policy_id 'voice-no-framework-dump', through
 *     detectFrameworkDump of lib/hmi/larry-reply-checks.cjs (reused, never a second detector);
 *   - a machinery-narration rule, policy_id 'voice-backend-noun-free', through
 *     findMachineryNarration of the same module.
 * Every row carries the template VERSION of lib/hmi/larry-identity.cjs (stamped by the log
 * module). No row carries reply text, user text or room content: detail fields hold counts and
 * term classes only. The punctuation pause (a spaced double hyphen) has no live rule here; it is
 * measured offline by findDashes (plan 369.6-01).
 *
 * Phase 383-07 (QA383-09) adds a fourth shadow rule, policy_id 'voice-length', through checkReplyLength of the
 * same module: a default reply over 8 sentences is logged as a count (sentences and the limit), never blocked.
 * A reply to an explicit request for a list, a plan or the full answer is exempt. The rule is 3 to 8 sentences by
 * default, longer only when asked (references/personality/voice-dna.md; agents/larry-extended.md line 41). The row
 * holds counts only, no reply text and no user text. Evaluate, log, never block.
 *
 * Canon Part 8 (Graph Boundary): LOCAL ONLY. This hook reads a local
 * transcript file (via lib/hmi/turn-text.cjs, the ONE transcript reader --
 * never a second copy) and writes a local JSONL row (via
 * lib/hmi/voice-style-log.cjs). Zero network calls, zero Brain calls.
 *
 * ENVELOPE CONTRACT: this script emits TOP-LEVEL keys only --
 * {continue: true, suppressOutput: true} -- on EVERY path, and NEVER emits
 * the hook-specific-output envelope block a richer hook response shape
 * would carry. scripts/check-hook-schema-compatibility.cjs reads the Stop
 * array off hooks/hooks.json, follows one level of subprocess invocation,
 * and greps the resulting files for the literal Stop-shaped envelope key,
 * exiting 1 on a hit -- that defect class has shipped four times in this
 * repo, one of which broke every turn for a real user. This hook must
 * never become the fifth.
 */

'use strict';

const fs = require('node:fs');

const ALLOWED_ENVELOPE_KEYS = new Set(['continue', 'suppressOutput']);

// emitEnvelope(obj) -- filters to the allowed top-level keys, writes JSON to
// stdout, and exits 0. Mirrors scripts/check-card-fire.cjs's emitEnvelope.
function emitEnvelope(obj) {
  const filtered = {};
  for (const k of Object.keys(obj || {})) {
    if (ALLOWED_ENVELOPE_KEYS.has(k)) filtered[k] = obj[k];
  }
  if (filtered.continue === undefined) filtered.continue = true;
  process.stdout.write(JSON.stringify(filtered));
  process.exit(0);
}

// silentSuccess() -- the never-block terminal state. Every path in this
// file ends here (directly or via emitEnvelope with the same payload).
function silentSuccess() {
  emitEnvelope({ continue: true, suppressOutput: true });
}

// readStdinJson() -- best-effort parse of the Stop stdin envelope. A
// malformed / empty / missing payload degrades to {}, never throws.
function readStdinJson() {
  try {
    const raw = fs.readFileSync(0, 'utf8');
    if (!raw || !raw.trim()) return {};
    return JSON.parse(raw);
  } catch (_e) {
    return {};
  }
}

// DASH_RE -- written as escapes on purpose (locked_constraints): the source
// file itself must stay hyphens-only even while it scans FOR em/en dashes.
const DASH_RE = /[\u2014\u2013]/;

// firstDashHit(text) -- tests text against DASH_RE and returns
// {codepoint, offset} for the first U+2014 or U+2013 hit, or null if none.
// Never throws.
function firstDashHit(text) {
  const m = DASH_RE.exec(text);
  if (!m) return null;
  const cp = m[0].codePointAt(0);
  return { codepoint: 'U+' + cp.toString(16).toUpperCase(), offset: m.index };
}

// scanTurn(text, appendRow, policyIdPrefixArgs) -- the two rules. Returns
// nothing; appends zero, one, or two rows via appendRow(row). Never throws
// (each rule is independently wrapped so one rule's fault cannot suppress
// the other rule's finding).
function scanTurn(text, sessionId, appendRow, userText) {
  const userTextSafe = typeof userText === 'string' ? userText : '';

  // Rule 0 (369.6-06): the denominator row. One per evaluated turn; counts only.
  try {
    let isNative = 'unknown';
    try {
      const { detectVoiceMark } = require('../lib/hmi/voice-color-mark.cjs');
      isNative = String(detectVoiceMark(text).isNativeHost);
    } catch (_eNative) {
      isNative = 'unknown';
    }
    appendRow({
      policy_id: 'voice-turn-evaluated',
      result: 'evaluated',
      detail: 'isNativeHost=' + isNative,
      session_id: sessionId,
    });
  } catch (_e0) {
    /* a scanner fault must never block the hook */
  }

  // Rule 1: dash scan.
  try {
    const hit = firstDashHit(text);
    if (hit) {
      appendRow({
        policy_id: 'voice-hyphens-only',
        detail: hit.codepoint + ' at offset ' + hit.offset,
        session_id: sessionId,
      });
    }
  } catch (_e1) {
    /* a scanner fault must never block the hook; the rule simply does not fire */
  }

  // Rule 2: glyph scan.
  try {
    const { detectVoiceMark } = require('../lib/hmi/voice-color-mark.cjs');
    const verdict = detectVoiceMark(text);
    if (!verdict.valid) {
      const reasonBits = [];
      reasonBits.push('hasMark=' + verdict.hasMark);
      reasonBits.push('count=' + verdict.count);
      reasonBits.push('isNativeHost=' + verdict.isNativeHost);
      appendRow({
        policy_id: 'voice-glyph-present',
        detail: reasonBits.join(', '),
        session_id: sessionId,
      });
    }
  } catch (_e2) {
    /* a scanner fault must never block the hook; the rule simply does not fire */
  }

  // Rule 3 (369.6-06, shadow): framework dump. detectFrameworkDump is reused from the reply checks.
  try {
    const { detectFrameworkDump } = require('../lib/hmi/larry-reply-checks.cjs');
    const v = detectFrameworkDump(text, { userText: userTextSafe });
    if (v && v.ok === false) {
      const hits = Array.isArray(v.hits) ? v.hits : [];
      let names = 0;
      let commands = 0;
      for (const h of hits) {
        if (h && h.kind === 'framework_names') names = Number(h.count) || 0;
        if (h && h.kind === 'mos_commands') commands = Number(h.count) || 0;
      }
      appendRow({
        policy_id: 'voice-no-framework-dump',
        detail: 'framework_names=' + names + ', mos_commands=' + commands,
        session_id: sessionId,
      });
    }
  } catch (_e3) {
    /* shadow detector fault: the rule simply does not fire */
  }

  // Rule 4 (369.6-06, shadow): machinery narration. findMachineryNarration is reused from the reply checks.
  try {
    const { findMachineryNarration } = require('../lib/hmi/larry-reply-checks.cjs');
    const v = findMachineryNarration(text, { userText: userTextSafe });
    if (v && v.ok === false) {
      const hits = Array.isArray(v.hits) ? v.hits : [];
      const classes = [];
      for (const h of hits) {
        const k = h && typeof h.kind === 'string' ? h.kind : '';
        if (k && classes.indexOf(k) === -1) classes.push(k);
      }
      appendRow({
        policy_id: 'voice-backend-noun-free',
        detail: 'hits=' + hits.length + ', classes=' + classes.join('|'),
        session_id: sessionId,
      });
    }
  } catch (_e4) {
    /* shadow detector fault: the rule simply does not fire */
  }

  // Rule 5 (383-07, shadow): reply length. checkReplyLength is reused from the reply checks. Counts only.
  try {
    const { checkReplyLength } = require('../lib/hmi/larry-reply-checks.cjs');
    const v = checkReplyLength(text, { userText: userTextSafe });
    if (v && v.ok === false) {
      appendRow({
        policy_id: 'voice-length',
        detail: 'sentences=' + v.fields.sentences + ', limit=' + v.fields.limit,
        session_id: sessionId,
      });
    }
  } catch (_e5) {
    /* shadow detector fault: the rule simply does not fire */
  }
}

// main() -- the Stop-hook entry point. Only real work: resolve the turn
// text, run the two rules, append findings, always end at silentSuccess().
function main() {
  const env = readStdinJson();
  const evt = env.hook_event_name || env.hookEventName || null;
  // Defensive: any event other than Stop is a no-op (never block a turn on
  // an event this hook was not registered for).
  if (evt && evt !== 'Stop') return silentSuccess();

  const transcriptPath = typeof env.transcript_path === 'string' ? env.transcript_path : '';
  const sessionId = typeof env.session_id === 'string' ? env.session_id : '';

  let text = '';
  let userText = '';
  if (transcriptPath) {
    try {
      const { readTurnText } = require('../lib/hmi/turn-text.cjs');
      const turn = readTurnText(transcriptPath);
      text = typeof turn.output_text === 'string' ? turn.output_text : '';
      userText = typeof turn.preceding_user_text === 'string' ? turn.preceding_user_text : '';
    } catch (_e) {
      text = '';
    }
  }

  if (text) {
    try {
      const { appendVoiceStyleRow } = require('../lib/hmi/voice-style-log.cjs');
      scanTurn(text, sessionId, appendVoiceStyleRow, userText);
    } catch (_eScan) {
      /* a logging fault must never block the hook */
    }
  }

  return silentSuccess();
}

module.exports = { main, scanTurn, firstDashHit, DASH_RE };

if (require.main === module) {
  try {
    main();
  } catch (e) {
    process.stderr.write('[check-voice-style] uncaught: ' + (e && e.message ? e.message : String(e)) + '\n');
    silentSuccess();
  }
}
