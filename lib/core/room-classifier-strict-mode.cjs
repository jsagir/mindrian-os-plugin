/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Phase 94-06 -- Room classifier strict-mode override
 *
 * Pure-function detector that resolves three unambiguous user-input
 * patterns directly to a registered room, bypassing the similarity
 * heuristic in scripts/intent-classifier.cjs:
 *
 *   1. Numeric position    'switch to 8' or '8'              -> registry[N-1]
 *   2. Explicit slug       'curriculum-redesign-fall-2026'    -> exact slug
 *                          '/mos:rooms <slug>'
 *   3. Quoted exact name   '"Beta"' / '"Curriculum Redesign"' -> name OR slug
 *
 * First match wins (numeric, then slug, then quoted). When NO pattern
 * matches, returns null and the classifier falls through to its existing
 * similarity heuristic. The override is forward-additive: similarity
 * heuristic is unchanged.
 *
 * Canon Part 3 (10-verb vocabulary preserved): strict-mode is a routing
 * OVERRIDE, not a new verb. The 10 canonical verbs in
 * lib/core/navigation-engine-shared.cjs are untouched.
 *
 * Canon Part 4 (every choice is graph data): when the override fires,
 * the caller emits a Section-8 decision-trace edge with
 * routing_source: 'strict_mode' so /mos:explain-decision can attribute
 * the resolution.
 *
 * Canon Part 7 (reuse before build): extends scripts/intent-classifier.cjs
 * by composition (separate helper module imported by the classifier),
 * NOT by replacing the existing similarity heuristic. The justification
 * bar for net-new capability is met: strict-mode handles cases the
 * similarity heuristic cannot disambiguate (numeric position has no
 * token overlap; explicit slug should never be misrouted; quoted exact
 * name is the user's clearest signal).
 *
 * Lawrence Aronhime reproducer fence (2026-04-28 38-min live test):
 * with two rooms loaded ('core-power-isolation' +
 * 'curriculum-redesign-fall-2026'), Lawrence's four utterances kept
 * resolving to the WRONG room. Plan 94-06 fences callouts 1 (numeric),
 * 2 (slug-form), and 4 (slash command) via this module. Callout 3
 * ('the curriculum room', natural language) is known-deferred to
 * v1.11.3 because it requires a natural-language intent layer.
 *
 * Pure CJS, zero npm deps. Never throws.
 */
'use strict';

// ---------- Routing source constant ----------

// Section-8 decision-trace edge value when this layer fires. Forward-
// additive per Phase 91 invariant: existing routing_source values
// ('engine' | 'legacy' | 'mixed' | 'classifier') are unaffected.
const STRICT_MODE_ROUTING_SOURCE = 'strict_mode';

// ---------- Pattern regexes ----------

// Numeric: 'switch to 8' or '8' or 'go to 5' or 'jump to 3' or
// 'move to 2'. Bounded to a small synonym set so we don't accidentally
// match prose like 'jump 3 hoops' (no 'to' keyword).
const NUMERIC_PATTERN = /^(?:(?:switch|go|jump|move)\s+to\s+)?(\d+)$/i;

// Explicit slug: lowercase letters, digits, hyphens. 3-80 chars total.
// Starts AND ends with alphanumeric (no leading/trailing hyphen).
// Optional '/mos:rooms ' prefix to honor the canonical command form.
const SLUG_PATTERN = /^(?:\/mos:rooms\s+)?([a-z0-9][a-z0-9-]{1,78}[a-z0-9])$/;

// Quoted: any quoted span (single or double). The captured inner text
// is the candidate room name OR slug.
const QUOTED_PATTERN = /^['"]([^'"]+)['"]$/;

// ---------- Registry parsing ----------

/**
 * parseRegistryRooms(reg) -> [{slug, name, path?}]
 *
 * Normalize the registry rooms field into a deterministic array of room
 * records. Tolerates the array form, the object form, and the legacy
 * string-only form. Preserves insertion order so 1-indexed numeric
 * position is deterministic.
 */
function parseRegistryRooms(reg) {
  if (!reg || !reg.rooms) return [];
  const out = [];
  if (Array.isArray(reg.rooms)) {
    for (const r of reg.rooms) {
      if (typeof r === 'string') {
        out.push({ slug: r, name: r });
      } else if (r && typeof r === 'object') {
        const slug = (typeof r.slug === 'string' && r.slug)
          ? r.slug
          : (typeof r.name === 'string' ? r.name : null);
        if (!slug) continue;
        const name = (typeof r.name === 'string' && r.name) ? r.name : slug;
        out.push({ slug: slug, name: name, path: r.path || null });
      }
    }
    return out;
  }
  if (typeof reg.rooms === 'object') {
    // Object form: keys are slugs; values are metadata objects. Order
    // is the JSON insertion order (V8 preserves; per ES2015 spec for
    // string keys). 1-indexed numeric position resolves to
    // Object.keys(...)[N-1].
    for (const slug of Object.keys(reg.rooms)) {
      const meta = reg.rooms[slug];
      const name = (meta && typeof meta.venture_name === 'string' && meta.venture_name)
        ? meta.venture_name
        : (meta && typeof meta.name === 'string' && meta.name ? meta.name : slug);
      out.push({
        slug: slug,
        name: name,
        path: (meta && typeof meta.path === 'string') ? meta.path : null,
      });
    }
    return out;
  }
  return [];
}

// ---------- Strict-mode detector ----------

/**
 * detectStrictMode(prompt, registry) -> {slug, name, pattern, routing_source} | null
 *
 * Pure function. Tries the three strict-mode patterns in precedence
 * order and returns the first match. Returns null when no pattern
 * applies (caller falls through to similarity heuristic).
 *
 * Never throws. Defensive on registry shape (array OR object form).
 *
 * @param {string} prompt
 * @param {object} registry
 * @returns {{slug:string, name:string, pattern:string, routing_source:string} | null}
 */
function detectStrictMode(prompt, registry) {
  if (typeof prompt !== 'string') return null;
  const trimmed = prompt.trim();
  if (!trimmed) return null;

  const rooms = parseRegistryRooms(registry);
  if (rooms.length === 0) return null;

  // Pattern 1: numeric (1-indexed registry position).
  const numMatch = trimmed.match(NUMERIC_PATTERN);
  if (numMatch) {
    const idx = parseInt(numMatch[1], 10) - 1;
    if (idx >= 0 && idx < rooms.length) {
      const r = rooms[idx];
      return {
        slug: r.slug,
        name: r.name,
        path: r.path,
        pattern: 'numeric',
        routing_source: STRICT_MODE_ROUTING_SOURCE,
        input: prompt,
      };
    }
    // Numeric pattern matched syntactically but index out of bounds.
    // Return null so the similarity heuristic gets a turn.
    return null;
  }

  // Pattern 2: explicit slug (case-sensitive against registry slugs).
  const slugMatch = trimmed.match(SLUG_PATTERN);
  if (slugMatch) {
    const candidate = slugMatch[1];
    for (const r of rooms) {
      if (r.slug === candidate) {
        return {
          slug: r.slug,
          name: r.name,
          path: r.path,
          pattern: 'slug',
          routing_source: STRICT_MODE_ROUTING_SOURCE,
          input: prompt,
        };
      }
    }
    // Pattern matched but slug not registered. Fall through to
    // pattern 3 / similarity (do NOT short-circuit; the slug form
    // may also be a quoted-or-natural-language input that happens
    // to look slug-like).
  }

  // Pattern 3: quoted exact name OR slug. Single OR double quote span.
  // Name match is case-insensitive; slug match is case-insensitive too
  // (slugs in registry are lowercase by convention but user may type
  // 'Curriculum-Redesign-Fall-2026' with title case).
  const quoteMatch = trimmed.match(QUOTED_PATTERN);
  if (quoteMatch) {
    const candidate = quoteMatch[1];
    const candidateLower = candidate.toLowerCase();
    for (const r of rooms) {
      if (r.slug === candidate
        || (typeof r.name === 'string' && r.name === candidate)
        || (typeof r.name === 'string' && r.name.toLowerCase() === candidateLower)
        || r.slug.toLowerCase() === candidateLower) {
        return {
          slug: r.slug,
          name: r.name,
          path: r.path,
          pattern: 'quoted',
          routing_source: STRICT_MODE_ROUTING_SOURCE,
          input: prompt,
        };
      }
    }
    // Pattern matched but no name/slug matches. Fall through.
  }

  return null;
}

// ---------- Exports ----------

module.exports = {
  detectStrictMode: detectStrictMode,
  parseRegistryRooms: parseRegistryRooms,
  STRICT_MODE_ROUTING_SOURCE: STRICT_MODE_ROUTING_SOURCE,
  // Pattern regexes are exported for downstream tooling that wants to
  // reuse the canonical patterns (e.g. /mos:explain-decision rendering
  // or future natural-language layer that wants to disambiguate from
  // strict-mode patterns).
  NUMERIC_PATTERN: NUMERIC_PATTERN,
  SLUG_PATTERN: SLUG_PATTERN,
  QUOTED_PATTERN: QUOTED_PATTERN,
};
