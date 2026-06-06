'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 143-02 Task 1 -- SENS-02 lagging-component detector.
 *
 * A net-new CONVERSATION-PATTERN detector over the SHIPPED Phase 89
 * reverse-salient engine. When the navigator names a lagging component (the
 * Appendix E "Risk surface identified" trigger, the Hughes 1983 reverse-salient
 * framing -- "the bottleneck is X", "X is lagging", "X is holding us back"),
 * this sensor SURFACES the find-bottlenecks / reverse-salient candidate reach.
 *
 * REUSE BEFORE BUILD (Canon Part 7): the underlying capability is shipped --
 * scripts/rs-engine.py (the 4-mode reverse-salient CLI) + commands/find-bottlenecks.md.
 * This sensor does NOT re-run rs-engine inline and does NOT re-implement
 * reverse-salient scoring. It surfaces the DISPATCH HANDLE only; the navigator
 * approves at the Decision Gate (Canon Part 3) before any engine runs.
 *
 * LOCAL surface (reach_id = 'context_block'): find-bottlenecks / reverse-salient
 * reads the room's OWN artifact corpus + section fill levels. It is a LOCAL
 * analysis surface, NOT a Brain or web surface -- so the reach is context_block,
 * never brain_consult or deep_research. The detector reads ONLY the turn text
 * (and, optionally, LOCAL section fill scalars threaded on ctx); it makes no
 * network call (Canon Part 8) and never throws on malformed input.
 *
 * Posture 'pull_back': a stated lagging component is a signal to pull back to
 * the weakest subsystem and re-set, rather than push forward past it.
 *
 * Phase 144 fence: this file PRODUCES a candidate reach; it never assigns
 * routing_source and never requires/defines decide(). The routing fence over
 * lib/core/sensors/ asserts this.
 *
 * Pure / sync / LOCAL-first. node built-ins + project libs only. No new deps.
 * House rule: hyphens only, no em-dashes.
 */

const path = require('node:path');

const { makeReach } = require('./sensor-types.cjs');

/**
 * Lagging-component / reverse-salient conversation patterns. Each matches the
 * shape "<component> is the bottleneck / is lagging / is holding us back / is
 * the reverse salient / is the weakest link / is the constraint". Case
 * insensitive. These are STRUCTURAL phrasings of the Hughes reverse-salient
 * framing, not user-content keywords -- the detector never inspects WHICH
 * component, only THAT a lagging component was named.
 */
const LAGGING_PATTERNS = [
  /\bbottleneck\b/i,
  /\bis lagging\b/i,
  /\bare lagging\b/i,
  /\blagging behind\b/i,
  /\bholding (?:us|me|it|the team|everything) back\b/i,
  /\breverse salient\b/i,
  /\bweakest (?:link|component|subsystem|section)\b/i,
  /\bis the constraint\b/i,
  /\bis the limiting (?:factor|step)\b/i,
];

/**
 * Pull the turn text as a string. Tolerant of the two turn shapes the dispatch
 * chokepoint may carry: { text } or { utterance }. Returns '' when absent or
 * non-string so the caller soft-fails to null rather than throwing.
 */
function turnText(turn) {
  if (!turn || typeof turn !== 'object') return '';
  if (typeof turn.text === 'string') return turn.text;
  if (typeof turn.utterance === 'string') return turn.utterance;
  return '';
}

/**
 * SENS-02 -- lagging-component -> the find-bottlenecks / reverse-salient reach.
 *
 * @param {object} turn  -- the turn signal bag (reads turn.text only)
 * @param {object} tuple -- the /mos:diagnose tuple (unused for detection; the
 *                          pattern is conversational, not classification-driven)
 * @param {object} ctx   -- LOCAL context (optional section fill scalars)
 * @returns {Readonly<object>|null}
 */
function sensorLaggingComponent(turn, tuple, ctx) {
  const text = turnText(turn);
  if (!text) return null;

  let matched = false;
  for (const rx of LAGGING_PATTERNS) {
    if (rx.test(text)) { matched = true; break; }
  }
  if (!matched) return null;

  // Optional LOCAL evidence scalar: a section-fill count threaded on ctx by the
  // caller (how many room sections are below the fill threshold). LOCAL only --
  // never a section name or artifact body, just a count.
  let lowFillSections = 0;
  if (ctx && typeof ctx === 'object' && typeof ctx.lowFillSections === 'number') {
    lowFillSections = ctx.lowFillSections;
  }

  return makeReach({
    reach_id: 'context_block',
    posture: 'pull_back',
    // Dispatch names the SHIPPED Phase 89 surface. A handle, not user content.
    dispatch: 'find-bottlenecks (rs-engine reverse-salient)',
    companions: [],
    signal: 'lagging_component',
    // LOCAL scalars only: the low-fill section count. No component name, no
    // turn text, no artifact body -- the WHICH never rides the reach.
    evidence: { low_fill_sections: lowFillSections, engine: 'rs-engine' },
  });
}

module.exports = {
  sensorLaggingComponent: sensorLaggingComponent,
};
