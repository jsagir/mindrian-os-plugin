#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 369.6-03: the one Larry identity source (D-05, D-44, A-04, R-02, R-08)
 * ==============================================================================
 * WHAT: one versioned, frozen constant that holds the identity sentence, the CLI-only model clause, the
 * label, the glyph set, the face tagline, a VERSION and the carrier registry.
 *
 * WHY: the identity sentence lived on six hand-edited carriers with no invalidation (REF-mesika: one
 * source, rendered; a copy with no invalidation drifts). One source lets a script render the carriers it
 * writes and lets one parity test check the carriers that people write by hand
 * (tests/test-3696-identity-parity.cjs), the mod's register.tsx LEAD regex included (R-24).
 *
 * Rules held here:
 *   - IDENTITY_SENTENCE is the shared form: it claims no model (R-02). Only the CLI carriers append
 *     MODEL_CLAUSE, because the host there is known to be Claude Code.
 *   - GLYPHS is derived from MARK_GLYPHS of lib/hmi/voice-color-mark.cjs and is never a second glyph list.
 *   - PwS is spelled with a lower-case w (the w stands for worth).
 *   - Source holds escapes for the curly apostrophe, so the file stays pure ASCII.
 *
 * Canon Part 8 (Graph Boundary): LOCAL-only, pure constants, no I/O, no network, no Brain call.
 * Canon Part 12 (Pedagogy, Invisibility): the label and one glyph open every active Larry reply.
 *
 * Version log (VERSION moves in the commit of the first Larry-facing text change of each later plan of
 * phase 369.6; later tasks of the same plan keep it, because no session or measurement runs between them):
 *   1: 369.6-03, 2026-10-29, the constant lands; no carrier renders it yet.
 *   2: 369.6-07, PwS identity on every carrier, punctuation follows the book, openers optional
 *   3: 369.6-08, agent procedures move to references/personality/agent-operations.md
 *   4: 369.6-09 Task 1, voice-first order, practitioner identity, closing rule, report mode, Theo as partner
 *   5: 369.6-10, the skill's operator manual moves to three references
 *   6: 369.6-11, the skill stops teaching visible machinery
 *
 * House rule: hyphens only, no em-dashes. CJS module; requires only lib/hmi/voice-color-mark.cjs.
 * License: BSL 1.1.
 */

'use strict';

const { MARK_GLYPHS } = require('./voice-color-mark.cjs');

const VERSION = '6';

// Two U+2019 apostrophes, the form the carriers already hold (D-05).
const IDENTITY_SENTENCE = 'I\u2019m Larry, MindrianOS\u2019s PwS thinking partner';

// Appended on the CLI carriers only (R-02).
const MODEL_CLAUSE = ', powered by Claude';

// Text that may appear on a cli carrier and on no shared or mcp carrier.
const CLI_ONLY_MARKERS = Object.freeze([MODEL_CLAUSE, 'Claude remains']);

const LABEL = 'Larry | MindrianOS';
const TAGLINE = 'PwS thinking partner';

// The five move glyphs, in the order of MARK_GLYPHS. Derived, never typed a second time.
const GLYPHS = Object.freeze(Object.keys(MARK_GLYPHS));

// The carriers of the identity.
//   surface: cli (appends the model clause), shared (host-neutral text), mcp (host-neutral wire)
//   mode: rendered (a script renders it from this module), parity (hand-written, parity-checked),
//         pinned (source never edited here; a test reads it as text and compares)
//   kind: sentence (carries identityLine), label (carries LABEL and TAGLINE), lead-regex (the mod regex)
const CARRIERS = Object.freeze([
  Object.freeze({ path: 'agents/larry-extended.md', surface: 'cli', mode: 'parity', kind: 'sentence' }),
  Object.freeze({ path: 'skills/larry-personality/SKILL.md', surface: 'cli', mode: 'parity', kind: 'sentence' }),
  // Hand-written so the SessionStart path spawns no node process for it and the cache prefix stays byte-stable.
  Object.freeze({ path: 'scripts/session-start', surface: 'cli', mode: 'parity', kind: 'sentence' }),
  Object.freeze({ path: 'references/personality/voice-dna.md', surface: 'shared', mode: 'parity', kind: 'sentence' }),
  // Rendered from this module by plan 369.6-07.
  Object.freeze({ path: 'lib/mcp/runtime-instructions.cjs', surface: 'mcp', mode: 'rendered', kind: 'sentence' }),
  // UMD code that cannot require this module.
  Object.freeze({ path: 'lib/mcp/theo-faces.cjs', surface: 'mcp', mode: 'parity', kind: 'label' }),
  // Mod source, never edited in this phase (D-48); the LEAD regex is read as text.
  Object.freeze({ path: 'ui/mos-face/hooks/register.tsx', surface: 'cli', mode: 'pinned', kind: 'lead-regex' }),
]);

/**
 * identityLine(surface) -> the sentence as one carrier writes it, closed with a period.
 * cli appends MODEL_CLAUSE; shared and mcp do not. An unknown surface throws (fail closed).
 */
function identityLine(surface) {
  if (surface === 'cli') return IDENTITY_SENTENCE + MODEL_CLAUSE + '.';
  if (surface === 'shared' || surface === 'mcp') return IDENTITY_SENTENCE + '.';
  throw new TypeError('larry-identity: unknown surface ' + String(surface));
}

module.exports = Object.freeze({
  VERSION,
  IDENTITY_SENTENCE,
  MODEL_CLAUSE,
  CLI_ONLY_MARKERS,
  LABEL,
  TAGLINE,
  GLYPHS,
  CARRIERS,
  identityLine,
});
