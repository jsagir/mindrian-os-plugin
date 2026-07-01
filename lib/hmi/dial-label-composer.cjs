/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 143.1 Plan 02 -- DIALTUI-04: the Feynman-JTBD dial-label composer.
 *
 * The dial table is authored in MECHANISM language (Context Block,
 * contradiction surface, cross-room reach, Brain consult, framework-led deep
 * research plan) -- exactly what the navigator must NOT read. This module is
 * the deterministic render-time alias: it swaps the mechanism-verb rows for
 * WHAT-THEY-GET labels at render time, while the canonical verb still
 * persists to the graph edge (so the mechanism term survives in room.db).
 *
 * Modeled BYTE-FOR-PATTERN on lib/core/rs-query-to-text.cjs (Canon Part 7):
 *   - frozen template families (one per reach_id) with {slot} placeholders
 *   - FNV-1a deterministic pick (same slot context -> same render)
 *   - the rs-egress-prompts.cjs dual-egress audit reused VERBATIM
 *   - NEVER imports the Brain client; NEVER invokes any network primitive;
 *     RENDERS only. Pure CJS, zero npm deps.
 *
 * Slot sources (UI-SPEC Section 9). The CALLER passes the resolved slot
 * context in; this module NEVER reads room.db directly (AP6). The slot values
 * originate from the navigation chokepoint:
 *   navigation.getActiveFocus(...)   -> the single {topic} focus node
 *   navigation.getNeighborhood(...)  -> the two-node {topic_a}/{topic_b} slot
 * (referenced here as the contract; resolution happens upstream in the
 * orchestrator, DIALTUI-01.)
 *
 * Canon Part 8 -- the dual-egress seam (UI-SPEC Section 11.1):
 *   The brain_consult and deep_research {framework} slots can become outbound
 *   queries. Their {framework} value MUST pass the egress audit BEFORE it can
 *   render -- only a GENERIC handle (framework name, phase id, problem type)
 *   crosses; raw user artifacts, numbers, names, and meeting text never reach
 *   the Brain or the web. The default on ambiguity is: do not egress (the
 *   audit throw is caught and the family degrades to its generic JTBD line).
 *   The other render-only families (context_block / contradiction / cross_room
 *   / hats / act) NEVER invoke the audit (hats carries no {framework} egress
 *   slot -- Phase 148 D-09 made it the 6th machine reach, render-only; act is
 *   the Phase 172-09 INV-19 pinned standing-suggestion family, render-only with
 *   {what}/{how} LOCAL handles only, no {framework} egress slot).
 *
 * License: BSL 1.1.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { auditQueryString } = require('../core/rs-egress-prompts.cjs');

// ---------- The 6 frozen template families (UI-SPEC Section 9) ----------
//
// WHAT-THEY-GET voice. Hyphens only, zero em-dashes, zero banned mechanism
// nouns. Each family carries its canonical_verb (the mechanism term that
// persists to the graph edge) and one or more templates (FNV-1a picks among
// them deterministically). Adding a template or family is a Plan-N revision
// (canon-amend discipline) -- the drift test guards the surface.
//
// The {framework} slot in brain_consult / deep_research is a GENERIC handle
// only (Part 8). The {topic}/{topic_a}/{topic_b}/{room_name} slots are
// LOCAL render-only handles, never egressed.

const TEMPLATE_FAMILIES = Object.freeze({
  context_block: Object.freeze({
    canonical_verb: 'Context Block',
    elevation: 'vertical',
    egress: false,
    slots: Object.freeze(['topic']),
    templates: Object.freeze([
      'Pull up what we decided about {topic}.',
      'Bring back what we worked out on {topic}.',
    ]),
  }),
  contradiction: Object.freeze({
    canonical_verb: 'contradiction surface',
    elevation: 'horizontal',
    egress: false,
    slots: Object.freeze(['topic_a', 'topic_b']),
    templates: Object.freeze([
      'Show where {topic_a} and {topic_b} pull against each other.',
      'Point out where {topic_a} and {topic_b} do not line up.',
    ]),
  }),
  cross_room: Object.freeze({
    canonical_verb: 'cross-room reach',
    elevation: 'lateral',
    egress: false,
    slots: Object.freeze(['room_name', 'topic']),
    templates: Object.freeze([
      'Bring in what {room_name} already worked out about {topic}.',
      'Borrow what {room_name} learned about {topic}.',
    ]),
  }),
  brain_consult: Object.freeze({
    canonical_verb: 'Brain consult',
    elevation: 'vertical',
    egress: true,
    slots: Object.freeze(['framework']),
    templates: Object.freeze([
      'Suggest the next move for {framework}.',
      'Recommend where to go next with {framework}.',
    ]),
  }),
  deep_research: Object.freeze({
    canonical_verb: 'framework-led deep research plan',
    elevation: 'lateral',
    egress: true,
    slots: Object.freeze(['topic', 'framework']),
    templates: Object.freeze([
      'Go find out what the world knows about {topic}, framed through {framework}.',
      'Look up what is known about {topic}, seen through {framework}.',
    ]),
  }),
  // Phase 148 D-09: the 6th machine reach. Render-only -- no {framework}
  // egress slot, so it stays in the 3-non-egress-family class (now four:
  // context_block / contradiction / cross_room / hats) and NEVER invokes the
  // Part-8 audit. The {topic} slot is a LOCAL render-only handle.
  hats: Object.freeze({
    canonical_verb: 'research personas hat-spin',
    elevation: 'lateral',
    egress: false,
    slots: Object.freeze(['topic']),
    templates: Object.freeze([
      'Spin up a research-personas hats pass on {topic}.',
      'Run the research-personas hat-spin over {topic}.',
    ]),
  }),
  // Phase 172-09 (INV-19): the PINNED /mos:act standing-suggestion render
  // family. act is NOT a reach (it mints no 7th reach_id; it is a standing UI
  // suggestion to invoke a command). This family is render-ONLY and NON-EGRESS
  // by construction -- it carries the LOCAL-derived buildActBlurb output ({what}
  // / {how} render-only handles), NOT a {framework} egress slot, so it stays in
  // the non-egress family class (now five: context_block / contradiction /
  // cross_room / hats / act) and NEVER invokes the Part-8 egress audit. The
  // {what} and {how} slots are LOCAL render-only handles composed by
  // lib/core/act-jtbd-blurb.cjs (enum/scalar + local text only, zero Brain).
  act: Object.freeze({
    canonical_verb: 'act standing suggestion',
    elevation: 'vertical',
    egress: false,
    slots: Object.freeze(['what', 'how']),
    templates: Object.freeze([
      '{what} {how}',
    ]),
  }),
});

const KNOWN_REACH_IDS = Object.freeze(Object.keys(TEMPLATE_FAMILIES));

// ---------- The generic JTBD fallback (degradation ladder, safety net) ----------
//
// Phase 188.1 note: when a slot cannot resolve, the family now drops to its
// ELEVATION-framed default (elevationDefault below), NOT this generic JTBD
// one_line. This loader remains the DEEPEST safety net -- used only if a family
// declares no known elevation direction (defensive; every shipped family does).
// The line it returns is the `explore` entry from jtbd-taxonomy.json ("No
// specific job - general thinking, talking, ranging."). NEVER render a raw
// {topic} slot. The file read is cached after first load; a read failure
// degrades to a hardcoded safe line (Tier 0 contract).

const TAXONOMY_PATH = path.join(__dirname, 'jtbd-taxonomy.json');
const HARDCODED_FALLBACK = 'Talk it through and see what surfaces.';

let _genericFallbackCache = null;

function loadGenericFallback() {
  if (_genericFallbackCache !== null) return _genericFallbackCache;
  let line = HARDCODED_FALLBACK;
  try {
    const raw = fs.readFileSync(TAXONOMY_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.entries)) {
      const explore = parsed.entries.find((e) => e && e.id === 'explore');
      if (explore && typeof explore.one_line === 'string' && explore.one_line.length > 0) {
        line = explore.one_line;
      }
    }
  } catch (_e) {
    line = HARDCODED_FALLBACK;
  }
  _genericFallbackCache = line;
  return line;
}

// ---------- Phase 188.1: elevation-framed degraded labels ----------
//
// Lawrence Aronhime's defect (2026-07-01): the LIVE selector printed the
// mechanism-blank explore one_line ("No specific job - general thinking,
// talking, ranging.") on every degraded row, telling the navigator nothing
// about what they get or how their thinking improves. Phase 188.1 replaces
// that blank degraded line with an ELEVATION-framed what-you-get default,
// keyed by each reach family's elevation direction (Canon Part 12, "three
// directions of elevation", amended 2026-07-01).
//
// These defaults are SLOT-FREE by construction: the degraded path is reached
// precisely because a {slot} could not resolve, so the line must stand on its
// own with no {topic}/{room_name}/{framework} substitution. The canonical_verb
// still persists to the graph edge (composeLabel keeps returning it); only the
// screen label changes. 205 owns the elevation MODEL (the FUSION/gear engine);
// 188.1 is the UI slice that makes the SELECTOR speak the vocabulary now.
//
// No em-dashes (hyphens only). No literal "(Recommended)" (glyph swap only).

const ELEVATION_DEFAULTS = Object.freeze({
  vertical: 'Go a level deeper here - see what is under the surface.',
  horizontal: 'Connect two threads you are holding as separate - they may be one argument.',
  lateral: 'Bring in a reference from outside your frame - one you would not have found alone.',
});

// elevationDefault(family) -> the slot-free elevation-framed what-you-get line
// for the family's elevation direction. Falls back to the generic JTBD line
// only if a family somehow declares no (or an unknown) elevation direction
// (defensive; every shipped family declares one).
function elevationDefault(family) {
  const dir = family && typeof family.elevation === 'string' ? family.elevation : null;
  if (dir && Object.prototype.hasOwnProperty.call(ELEVATION_DEFAULTS, dir)) {
    return ELEVATION_DEFAULTS[dir];
  }
  return loadGenericFallback();
}

// ---------- Audit instrumentation (render-only proof, DIALTUI-05) ----------
//
// The drift test proves render-only by asserting the 3 non-egress families
// never move this counter, while the 2 egress families always do.

let _AUDIT_CALLS = 0;
function _auditCallCount() {
  return _AUDIT_CALLS;
}

// auditFrameworkSlot: the Part-8 chokepoint for the {framework} value. Returns
// the value on pass, throws on a forbidden-pattern hit (default-deny upstream
// catches and degrades). Called ONLY by the 2 egress families.
function auditFrameworkSlot(value, reachId) {
  _AUDIT_CALLS++;
  // auditQueryString throws ExternalEgressViolation on any FORBIDDEN_PATTERNS
  // hit; returns the input on pass.
  return auditQueryString(String(value), 'dial-label-composer:' + reachId + ':framework');
}

// ---------- FNV-1a deterministic template pick ----------
//
// Same reach_id + same slot context -> same template index. Matters on CLI
// (stable render across runs); matters less on Desktop.

function pickTemplate(reachId, templates, slotContext) {
  if (!Array.isArray(templates) || templates.length === 0) return '';
  if (templates.length === 1) return templates[0];
  let seedStr = String(reachId);
  const sc = slotContext && typeof slotContext === 'object' ? slotContext : {};
  // Build the seed from the slot values in a stable key order.
  const keys = Object.keys(sc).sort();
  for (const k of keys) {
    const v = sc[k];
    if (typeof v === 'string') seedStr += '|' + k + '=' + v;
    else if (typeof v === 'number' || typeof v === 'boolean') seedStr += '|' + k + '=' + String(v);
  }
  let h = 0x811c9dc5;
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return templates[h % templates.length];
}

// ---------- Slot resolution (the degradation ladder, DIALTUI-04) ----------
//
// Resolve every {slot} the template needs from slotContext. Returns:
//   { ok: true, values: {slot: resolvedString} }   -- all slots resolved
//   { ok: false }                                   -- a slot is unresolvable
//
// Ladder per slot:
//   1. full focus      -> slotContext[slot]            (the resolved noun)
//   2. recent message  -> slotContext.message_noun     (a noun from the message)
//   3. unresolvable    -> { ok: false }                (caller drops to generic)
//
// For the {framework} egress slot, the resolved value passes the Part-8 audit
// before it is accepted; an audit throw makes the slot unresolvable (so the
// family degrades to the generic JTBD line rather than egressing user content).

function resolveSlots(reachId, family, slotContext) {
  const sc = slotContext && typeof slotContext === 'object' ? slotContext : {};
  const values = Object.create(null);

  for (const slot of family.slots) {
    let resolved = null;

    // Rung 1: full focus value.
    if (typeof sc[slot] === 'string' && sc[slot].trim().length > 0) {
      resolved = sc[slot].trim();
    } else if (typeof sc.message_noun === 'string' && sc.message_noun.trim().length > 0) {
      // Rung 2: a noun lifted from the recent message (caller-supplied,
      // single generic handle, not the raw message body).
      resolved = sc.message_noun.trim();
    }

    if (resolved === null) {
      // Rung 3: unresolvable -> degrade to the generic JTBD line.
      return { ok: false };
    }

    // Part-8 seam: the {framework} slot of an egress family must clear the
    // egress audit before it can render. Default-deny on a hit (treat as
    // unresolvable so the family degrades to the generic line; never egress
    // raw user content).
    if (family.egress && slot === 'framework') {
      try {
        auditFrameworkSlot(resolved, reachId);
      } catch (_e) {
        return { ok: false };
      }
    }

    values[slot] = resolved;
  }

  return { ok: true, values: values };
}

// fillTemplate: substitute {slot} placeholders from the resolved values.
// Any placeholder not present in values is a bug (resolveSlots guarantees
// coverage), but we defensively never emit a raw '{...}' -- an unresolved
// placeholder collapses the result to the generic fallback at the caller.
function fillTemplate(template, values) {
  let unresolved = false;
  const out = template.replace(/\{([a-z_][a-z0-9_]*)\}/gi, function (_m, key) {
    if (Object.prototype.hasOwnProperty.call(values, key) && typeof values[key] === 'string') {
      return values[key];
    }
    unresolved = true;
    return '';
  });
  return { text: out.replace(/\s{2,}/g, ' ').replace(/\s+([.,;:!?])/g, '$1').trim(), unresolved: unresolved };
}

// ---------- Top-level entry point ----------
//
// composeLabel(reach_id, slotContext) -> { label, canonical_verb, degraded }
//
//   label          the WHAT-THEY-GET render-time alias (never a mechanism
//                  noun, never a raw {slot}).
//   canonical_verb the mechanism term that persists to the graph edge
//                  (DIALTUI-04: the verb survives even though the row label
//                  is swapped).
//   degraded       true when the degradation ladder dropped to the generic
//                  JTBD one_line (a slot was unresolvable or default-denied).

function composeLabel(reachId, slotContext) {
  const family = TEMPLATE_FAMILIES[reachId];
  if (!family) {
    throw new Error('dial-label-composer: unknown reach_id "' + String(reachId) + '"');
  }

  const resolution = resolveSlots(reachId, family, slotContext);

  if (!resolution.ok) {
    // Degradation ladder, deepest rung: the generic JTBD one_line. Never a
    // raw {topic} slot. The canonical verb still persists.
    return Object.freeze({
      label: elevationDefault(family),
      canonical_verb: family.canonical_verb,
      degraded: true,
    });
  }

  const template = pickTemplate(reachId, family.templates, slotContext);
  const filled = fillTemplate(template, resolution.values);

  if (filled.unresolved || filled.text.indexOf('{') !== -1 || filled.text.length === 0) {
    // Defensive: a placeholder slipped through. Degrade rather than emit a
    // raw slot.
    return Object.freeze({
      label: elevationDefault(family),
      canonical_verb: family.canonical_verb,
      degraded: true,
    });
  }

  return Object.freeze({
    label: filled.text,
    canonical_verb: family.canonical_verb,
    degraded: false,
  });
}

// ---------- Exports ----------

module.exports = {
  composeLabel: composeLabel,
  TEMPLATE_FAMILIES: TEMPLATE_FAMILIES,
  KNOWN_REACH_IDS: KNOWN_REACH_IDS,
  // Phase 205 (item 8 + item 11): elevationDefault is now a FIRST-CLASS export.
  // 188.1 shipped it under _test as fixture introspection; 205 is the production
  // consumer it was built for (nav-dial + shape-f1-renderer frame their rows as
  // the elevation the navigator receives). The slot-free what-you-get line for a
  // family's elevation direction (vertical / horizontal / lateral).
  elevationDefault: elevationDefault,
  ELEVATION_DEFAULTS: ELEVATION_DEFAULTS,
  // Render-only proof instrumentation (DIALTUI-05).
  _auditCallCount: _auditCallCount,
  // Internal helpers exposed for fixture introspection only.
  _test: {
    pickTemplate: pickTemplate,
    resolveSlots: resolveSlots,
    fillTemplate: fillTemplate,
    loadGenericFallback: loadGenericFallback,
    // Phase 188.1: the elevation-framed degraded-label surface.
    elevationDefault: elevationDefault,
    ELEVATION_DEFAULTS: ELEVATION_DEFAULTS,
  },
};
