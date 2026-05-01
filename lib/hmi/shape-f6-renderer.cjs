/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 101-01 -- Shape F.6 (JTBD-aware Next Move) renderer.
 *
 * Renders the Phase 100 JTBD signal into a Shape F selector body whose
 * verb vocabulary is drawn from `entries[i].next_move_verbs[]` of the
 * canonical taxonomy. Free-Text is appended last (D-10 hardcoded).
 * Mode A (tier >= 2) marks `recommendedVerb` with `▶`; Mode B suppresses
 * the marker (D-05). Falls through to F.1 if the taxonomy entry is
 * degenerate (verb set < 3 entries) or missing -- per D-04 + RESEARCH §8
 * pitfall 4. Keyboard contract delegates to F.1 (D-01).
 *
 * Allowed glyphs in body (per Canon Part 3 + skills/ui-system/SKILL.md
 * 12-glyph vocabulary): ▶ ▷ ■ • →. No box characters.
 *
 * Pure CJS, node built-ins only, zero deps (Phase 87 invariant).
 *
 * API:
 *   renderShapeF6({ jtbd, tier, recommendedVerb, header? })
 *     -> { zones, contract }
 *      | { error: string }                     // taxonomy missing
 *      | { fallthrough: true, reason: string } // degenerate verb set
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const TAXONOMY_PATH = path.join(__dirname, 'jtbd-taxonomy.json');
const FREE_TEXT = 'Free-Text';
const MIN_VERBS = 3; // D-04 + RESEARCH §8 pitfall 4: < 3 verbs = degenerate
const MARKER_RECOMMENDED = '▶';
const MARKER_ROW = '▷';

function loadTaxonomy() {
  // Taxonomy-missing graceful branch (D-12, CONTEXT). Out-of-order execution
  // (Phase 101 before Phase 100 Wave 1) returns 3-line error per Canon Part 3
  // Rule 2 instead of crashing.
  if (!fs.existsSync(TAXONOMY_PATH)) return null;
  try {
    const raw = fs.readFileSync(TAXONOMY_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function entriesOf(taxonomy) {
  if (!taxonomy) return [];
  if (Array.isArray(taxonomy.entries)) return taxonomy.entries;
  if (Array.isArray(taxonomy.jtbds)) return taxonomy.jtbds;
  return [];
}

function findEntry(taxonomy, jtbdId) {
  const list = entriesOf(taxonomy);
  if (!Array.isArray(list) || typeof jtbdId !== 'string') return null;
  return list.find(e => e && e.id === jtbdId) || null;
}

function defaultHeader(jtbdId) {
  // Zone 1 default per RESEARCH §2 step 6.
  return '-- mindrianOS -- ' + jtbdId + ' -- next move --';
}

function renderShapeF6(input) {
  const opts = (input && typeof input === 'object') ? input : {};
  const jtbd = typeof opts.jtbd === 'string' ? opts.jtbd : null;
  const tier = typeof opts.tier === 'number' ? opts.tier : 0;
  const recommendedVerb = typeof opts.recommendedVerb === 'string' && opts.recommendedVerb.length > 0
    ? opts.recommendedVerb : null;
  const header = typeof opts.header === 'string' && opts.header.length > 0
    ? opts.header : null;

  // Step 0: taxonomy-missing graceful branch (Canon Part 3 Rule 2 + D-12).
  const taxonomy = loadTaxonomy();
  if (!taxonomy) {
    return {
      error:
        'x lib/hmi/jtbd-taxonomy.json not found\n' +
        'Why: Phase 100 Wave 1 must ship before F.6 can render\n' +
        'Fix: complete Phase 100 plans 100-01 first',
    };
  }

  // Null-jtbd is dispatcher's job (D-02); F.6 expects non-null. Treat as
  // fallthrough so the dispatcher routes to F.1.
  if (!jtbd) {
    return { fallthrough: true, reason: 'jtbd_null' };
  }

  const entry = findEntry(taxonomy, jtbd);
  if (!entry) {
    return { fallthrough: true, reason: 'jtbd_unknown' };
  }

  const rawVerbs = Array.isArray(entry.next_move_verbs) ? entry.next_move_verbs.slice() : [];

  // Step 2: degenerate verb set (D-04 + RESEARCH §8 pitfall 4). Per the plan,
  // count is on raw taxonomy verbs (Free-Text is appended later).
  if (rawVerbs.length < MIN_VERBS) {
    return { fallthrough: true, reason: 'degenerate_verb_set' };
  }

  // Step 3: Free-Text always last (D-10 hardcoded). Caller cannot omit.
  // Defensive de-dup if taxonomy already lists Free-Text (current taxonomy
  // does for the explore JTBD; explore is < 3 anyway, but be safe).
  const verbsNoFree = rawVerbs.filter(v => v !== FREE_TEXT);
  const verbs = verbsNoFree.concat([FREE_TEXT]);

  // Step 4: Mode A (tier >= 2) renders recommendation; Mode B suppresses.
  const mode = tier >= 2 ? 'A' : 'B';
  const recInList = (mode === 'A' && recommendedVerb && verbs.indexOf(recommendedVerb) !== -1)
    ? recommendedVerb : null;

  // Step 6: render zones.
  const zone1 = header || defaultHeader(jtbd);
  const zone2Lines = verbs.map((verb, i) => {
    const prefix = (verb === recInList) ? MARKER_RECOMMENDED : MARKER_ROW;
    const num = String(i + 1);
    return prefix + ' ' + num + '. ' + verb;
  });

  const zones = {
    header: zone1,
    body: zone2Lines.join('\n'),
    signals: '',
    footer: null, // F.x is itself the selector; no separate Zone 4 footer.
  };

  // Step 7: contract -- keyboard inheritance from F.1 (D-01).
  const contract = {
    keyboard: 'f1-inheritance',
    verbs: verbs.slice(),
    mode: mode,
    recommended: recInList,
  };

  return { zones, contract };
}

module.exports = { renderShapeF6 };
