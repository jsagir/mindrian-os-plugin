'use strict';

/*
 * Phase 218-02 Task 2 -- tier-1 entity-extractor (structural-first, zero model).
 *
 * A PURE regex/heading parser. It reads artifact markdown PROSE and returns
 * bounded, typed {entities, relations} candidates. It is the read/parse half of
 * REQ-1 ("reads artifact markdown text and writes new graph nodes"); the WRITE
 * half is Plan 218-01's typed-entity.cjs chokepoint, invoked by the Plan 218-03
 * dispatcher, which resolves these name candidates to node ids and routes every
 * write through lib/core/navigation.cjs.
 *
 * Canon Part 8 (graph boundary): ZERO network egress. This module performs no
 * network call, imports no node-networking builtin, and touches no Brain surface.
 * It operates entirely on the input string. A grep gate in the test asserts this.
 *
 * Four disciplines inherited verbatim from shallow-doc-parser.cjs:
 *   (1) operate over markdown.split(/\r?\n/) -- no markdown-AST dependency.
 *   (2) bounded output via a maxPerArtifact cap (parseClaims(max) precedent), so
 *       a greedy capitalization regex cannot re-flood the graph with junk
 *       (RESEARCH Pitfall 4 -- the noise this phase exists to remove).
 *   (3) top-level try/catch returns { entities: [], relations: [] } -- the
 *       parser NEVER throws on caller input.
 *   (4) zero egress -- no network, no db, no Brain.
 *
 * Extraction is deliberately shallow (tier-1). MISC-label disambiguation is
 * tier-2 and OUT of scope per 218-CONTEXT: typing goes no deeper than
 * capitalization + heading-context lean. Entity types are the three well-signaled
 * kinds Plan 218-01 mints: company / technology / market.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const DEFAULT_MAX_PER_ARTIFACT = 25;
const ENTITY_TYPES = Object.freeze(['company', 'technology', 'market']);
const DEFAULT_TYPE = 'company'; // venture prose proper nouns default to company.

// Capitalized sentence-starters and function words that a greedy Title-Case
// regex would otherwise mis-tag as entities. Reused to strip leading noise from
// a proper-noun run and to drop single-word noise tokens (Pitfall 4).
const STOPWORDS = new Set([
  'The', 'This', 'That', 'These', 'Those', 'A', 'An', 'It', 'We', 'They', 'He',
  'She', 'I', 'In', 'On', 'At', 'As', 'Of', 'For', 'And', 'Or', 'But', 'To',
  'From', 'With', 'By', 'Is', 'Are', 'Was', 'Were', 'Be', 'Been', 'Our', 'Your',
  'Their', 'His', 'Her', 'Its', 'My', 'No', 'Not', 'So', 'If', 'Then', 'Than',
  'When', 'While', 'Where', 'What', 'Who', 'Which', 'How', 'Why', 'All', 'Any',
  'Each', 'Some', 'Both', 'One', 'Two', 'Three', 'Also', 'However', 'Because',
]);

// A run of 1-3 TitleCase tokens (allowing internal &, ., -, digits for names
// like "Xtrac", "AT&T", "3M"). Mirrors the shallow-doc-parser stripPii idiom of
// isolating capitalized runs, but here we KEEP the run as a candidate.
const PROPER_RUN = /\b([A-Z][A-Za-z0-9&.\-]*(?:[ \t]+[A-Z][A-Za-z0-9&.\-]*){0,2})\b/g;

// Heading-context lean cues. A section whose heading matches one of these leans
// its body proper nouns toward the given type (Pitfall 4: use heading context to
// type). First match wins in listed order.
const SECTION_LEANS = [
  { type: 'company', rx: /\b(competitor|competition|rival|player|compan(?:y|ies)|incumbent|vendor|supplier)\b/i },
  { type: 'market', rx: /\b(market|segment|customer|sector|tam|sam|som|demand|audience|geograph)\b/i },
  { type: 'technology', rx: /\b(technolog|tech\b|platform|stack|component|architecture|infrastructure|tooling|system)\b/i },
];

// Relation cues. When two entity names co-occur on a line carrying one of these
// cues, emit the corresponding edge between the first two names. Order matters:
// the more specific rivalry/supply cues are checked before the generic
// component/use cue. Edge types match Plan 218-01's ENTITY_EDGE_SUBSET.
const RELATION_CUES = [
  { edge_type: 'COMPETES_WITH', rx: /\b(rival|rivals|compet(?:e|es|ing|itor)|versus|vs\.?|against)\b/i },
  { edge_type: 'SUPPLIES_TO', rx: /\b(supplier|supplies|supply|supplying|provides to|sells to|vendor to)\b/i },
  { edge_type: 'USES_COMPONENT', rx: /\b(uses|use|using|powered by|built on|based on|comprises|contains|incorporates|component)\b/i },
];

// Strip years / emails / URLs from a line before scanning (shallow-doc-parser
// stripPii idiom), so PII-ish tokens never become entity names.
function scrubLine(line) {
  return String(line)
    // inline code spans first (a `Widget` token is not prose signal)
    .replace(/`[^`]*`/g, ' ')
    // emails
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, ' ')
    // URLs
    .replace(/https?:\/\/[^\s]+/g, ' ')
    .replace(/www\.[^\s]+/g, ' ')
    // years
    .replace(/\b(19|20)\d{2}\b/g, ' ');
}

// Turn a raw proper-noun run into a clean candidate name, or null if it collapses
// to noise. Strips leading stopwords and drops single-word stopword tokens.
function cleanName(raw) {
  if (!raw) return null;
  const words = raw.trim().split(/[ \t]+/).filter(Boolean);
  // Strip leading stopwords ("The Prodrive" -> "Prodrive").
  while (words.length && STOPWORDS.has(words[0])) words.shift();
  if (words.length === 0) return null;
  // A lone stopword or a lone one-letter token is noise.
  if (words.length === 1 && (STOPWORDS.has(words[0]) || words[0].length < 2)) return null;
  const name = words.join(' ').trim();
  if (name.length < 2) return null;
  return name;
}

function sectionLeanFor(headingText) {
  for (const { type, rx } of SECTION_LEANS) {
    if (rx.test(headingText)) return type;
  }
  return null;
}

function relationCueFor(line) {
  for (const { edge_type, rx } of RELATION_CUES) {
    if (rx.test(line)) return edge_type;
  }
  return null;
}

/*
 * extractEntities(markdown, opts) -> { entities, relations }
 *
 *   entities:  [{ entityType, name, sourceArtifactId }]
 *   relations: [{ source, target, edge_type }]   (source/target are entity names)
 *
 * opts:
 *   sourceArtifactId  the artifact id every extracted entity is provenance-tagged
 *                     with (default null).
 *   maxPerArtifact    the output cap (default 25). Both entities and relations are
 *                     independently bounded by this cap.
 */
function extractEntities(markdown, opts) {
  const out = { entities: [], relations: [] };
  if (!markdown || typeof markdown !== 'string') return out;

  const options = opts && typeof opts === 'object' ? opts : {};
  const sourceArtifactId = options.sourceArtifactId != null ? options.sourceArtifactId : null;
  const cap = Number.isInteger(options.maxPerArtifact) && options.maxPerArtifact > 0
    ? options.maxPerArtifact
    : DEFAULT_MAX_PER_ARTIFACT;

  try {
    const lines = markdown.split(/\r?\n/);
    let currentLean = null;      // heading-context type lean for the active section
    let inFence = false;         // inside a ``` fenced code block
    const seen = new Set();      // dedup by entityType|name

    for (const rawLine of lines) {
      const line = rawLine;

      // Toggle fenced code blocks; skip their contents entirely (code, not prose).
      if (/^\s*```/.test(line)) { inFence = !inFence; continue; }
      if (inFence) continue;

      // Heading line: update the section lean, do NOT extract from heading text
      // (Pitfall 4: skip heading-only tokens -- we only extract from body prose,
      // so a token that appears solely in a heading is inherently skipped).
      const headingMatch = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
      if (headingMatch) {
        currentLean = sectionLeanFor(headingMatch[1]);
        continue;
      }

      const scrubbed = scrubLine(line);
      if (!scrubbed.trim()) continue;

      const entityType = currentLean || DEFAULT_TYPE;

      // Collect the proper-noun candidates on this line (ordered), for both entity
      // emission and relation pairing.
      const lineNames = [];
      let m;
      PROPER_RUN.lastIndex = 0;
      while ((m = PROPER_RUN.exec(scrubbed)) !== null) {
        const name = cleanName(m[1]);
        if (!name) continue;
        lineNames.push(name);
        if (out.entities.length >= cap) continue; // stop minting once capped
        const key = entityType + '|' + name;
        if (seen.has(key)) continue;
        seen.add(key);
        out.entities.push({ entityType, name, sourceArtifactId });
      }

      // Relation candidate: a cue on this line + >= 2 distinct names -> emit an
      // edge between the first two distinct names.
      if (out.relations.length < cap && lineNames.length >= 2) {
        const edge_type = relationCueFor(scrubbed);
        if (edge_type) {
          const distinct = [];
          for (const n of lineNames) { if (!distinct.includes(n)) distinct.push(n); }
          if (distinct.length >= 2 && distinct[0] !== distinct[1]) {
            out.relations.push({ source: distinct[0], target: distinct[1], edge_type });
          }
        }
      }
    }
  } catch (_) {
    // Graceful degradation: never throw on caller input (discipline 3).
    return { entities: [], relations: [] };
  }

  return out;
}

module.exports = {
  extractEntities,
  ENTITY_TYPES,
  DEFAULT_MAX_PER_ARTIFACT,
};
