'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 160-02 Task 2 -- dual-stamp memory_events + Larry-speaks-time.
 * ===================================================================
 *
 * R4 (160-SPEC.md). A real-world-event memory_event carries BOTH:
 *   created_at = the FILING moment (when we wrote it down), and
 *   valid_at   = the REAL-WORLD moment (when it actually happened).
 * The two are distinct and the human owns valid_at. Both ride the memory_event
 * properties JSON additively (no DDL column, exactly like the Phase 150.8
 * valid_from/valid_until edge precedent), written ONLY through the Part 9
 * navigation.logMemoryEvent chokepoint -- NEVER a side-door INSERT.
 *
 * R3 (160-SPEC.md / FLAG-03). Larry SPEAKS time. renderTopicGreetingDelta() is
 * the CALLABLE render function the greeting doctrine in skills/context-engine/
 * SKILL.md invokes; it composes a humanDelta() string ("you raised this 3 days
 * ago") for the last-touched topic node against getReferenceNow(). It REUSES
 * the shipped humanDelta() from lib/core/feynman/timeline-renderer.cjs (Part 7
 * reuse-before-build) rather than re-implementing relative-time rendering.
 *
 * Part 8 (LOCAL -> BRAIN: NO). valid_at and created_at are epoch-ms SCALARS.
 * The raw user prose (payload.relative_time) is resolved to a scalar locally and
 * stays on the LOCAL node; nothing here egresses to Brain. The Phase 157
 * boundary scan stays GREEN.
 *
 * House rule: hyphens only, no em-dashes. Pure CJS.
 */

const navigation = require('../navigation.cjs');
const { resolveRelativeTime } = require('./resolve-relative-time.cjs');
const { getReferenceNow } = require('./reference-now.cjs');
const { humanDelta } = require('../feynman/timeline-renderer.cjs');

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/*
 * logDualStampedEvent(db, eventType, payload, opts)
 *   -> { ok, eventId?, validAtMs?, reason? }
 *
 * Resolves valid_at for a real-world event and writes it ADDITIVELY onto the
 * memory_event payload alongside the created_at the chokepoint stamps, all
 * through navigation.logMemoryEvent (Part 9). eventType MUST be an existing
 * frozen EVENT_TYPE (this helper is event-type-agnostic; it NEVER mints a new
 * type -- the EVENT_TYPES set is owned by memory-events.cjs).
 *
 * valid_at precedence:
 *   1. an explicit numeric payload.valid_at (the human already owns the date), else
 *   2. resolveRelativeTime(payload.relative_time) anchored to the reference, else
 *   3. omitted (pure ideas/assumptions are not dual-stamped here -- the silent
 *      valid_at = filing-time path is the Wave 5 gate's job, out of scope here).
 *
 * created_at is the chokepoint's nowMs, sourced from the options.now seam
 * (D-01a). opts.now is forwarded verbatim so created_at = the reference now.
 *
 * opts:
 *   now          injectable clock closure -> the options.now seam value (D-01a)
 *   referenceMs  explicit reference for relative-time resolution (test seam)
 *   currentDate  YYYY-MM-DD forwarded to the resolver / getReferenceNow
 *   seamPath     LOCAL seam file forwarded to the resolver
 *   created_by   provenance for the node (defaults to the chokepoint default)
 */
function logDualStampedEvent(db, eventType, payload, opts) {
  if (!isPlainObject(payload)) {
    return { ok: false, reason: 'invalid_payload' };
  }
  const o = opts && typeof opts === 'object' ? opts : {};

  // Resolve the reference used for relative-time resolution. Prefer an explicit
  // referenceMs; else derive from getReferenceNow via the same opts seams so the
  // resolver and the chokepoint agree on "now".
  let referenceMs;
  if (isFiniteNumber(o.referenceMs)) {
    referenceMs = o.referenceMs;
  } else {
    const ref = getReferenceNow({
      currentDate: typeof o.currentDate === 'string' ? o.currentDate : undefined,
      now: typeof o.now === 'function' ? o.now : undefined,
      seamPath: typeof o.seamPath === 'string' ? o.seamPath : undefined,
    });
    referenceMs = ref && isFiniteNumber(ref.referenceMs) ? ref.referenceMs : Date.now();
  }

  // valid_at: explicit numeric wins; else resolve from the relative_time prose.
  let validAtMs = null;
  if (isFiniteNumber(payload.valid_at)) {
    validAtMs = payload.valid_at;
  } else if (typeof payload.relative_time === 'string' && payload.relative_time.trim()) {
    const resolved = resolveRelativeTime(payload.relative_time, { referenceMs });
    if (resolved && isFiniteNumber(resolved.validAtMs)) {
      validAtMs = resolved.validAtMs;
    }
  }

  // Build the additive payload. valid_at rides the properties JSON as a scalar.
  // relative_time (the raw user prose) is dropped from the persisted payload so
  // only the resolved scalar lands on the node (Part 8 scalar discipline).
  const merged = Object.assign({}, payload);
  delete merged.relative_time;
  if (validAtMs != null) {
    merged.valid_at = validAtMs;
  }

  // Write through the Part 9 chokepoint. created_at is stamped by the chokepoint
  // from the options.now seam (D-01a) -- we forward opts.now verbatim.
  const chokepointOpts = {};
  if (typeof o.now === 'function') chokepointOpts.now = o.now;

  const res = navigation.logMemoryEvent(db, eventType, merged, chokepointOpts);
  if (!res || res.ok !== true) {
    return res || { ok: false, reason: 'logMemoryEvent_failed' };
  }
  return { ok: true, eventId: res.eventId, deduped: res.deduped, validAtMs };
}

/*
 * renderTopicGreetingDelta(node, opts) -> string
 *
 * R3. The CALLABLE greeting-delta renderer. Given the last-touched topic node
 * (carrying created_at epoch ms) and a reference, returns a Larry-voiced clause
 * carrying the humanDelta() delta -- e.g. "you raised this 3 days ago".
 *
 * Reuses humanDelta() (Part 7). Never throws: a missing/invalid created_at
 * yields a delta-free fallback clause so the greeting still renders.
 *
 * opts:
 *   referenceMs  explicit reference epoch ms (test seam / options.now value)
 *   now / currentDate / seamPath  forwarded to getReferenceNow when no referenceMs
 *   topicLabel   optional override for the topic phrase
 */
function renderTopicGreetingDelta(node, opts) {
  const o = opts && typeof opts === 'object' ? opts : {};
  const n = isPlainObject(node) ? node : {};

  let referenceMs;
  if (isFiniteNumber(o.referenceMs)) {
    referenceMs = o.referenceMs;
  } else {
    const ref = getReferenceNow({
      currentDate: typeof o.currentDate === 'string' ? o.currentDate : undefined,
      now: typeof o.now === 'function' ? o.now : undefined,
      seamPath: typeof o.seamPath === 'string' ? o.seamPath : undefined,
    });
    referenceMs = ref && isFiniteNumber(ref.referenceMs) ? ref.referenceMs : Date.now();
  }

  const topic = typeof o.topicLabel === 'string' && o.topicLabel
    ? o.topicLabel
    : (typeof n.topic === 'string' && n.topic ? n.topic : 'this');

  const createdAt = isFiniteNumber(n.created_at) ? n.created_at : null;
  if (createdAt == null) {
    // No timestamp to speak time against -- degrade to a delta-free clause.
    return 'I see you were working on ' + topic + '.';
  }

  const deltaMs = referenceMs - createdAt;
  const delta = humanDelta(deltaMs);
  return 'I see you raised ' + topic + ' ' + delta + '.';
}

module.exports = {
  logDualStampedEvent,
  renderTopicGreetingDelta,
};
