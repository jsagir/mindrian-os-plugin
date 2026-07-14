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
 * Extraction is deliberately shallow (tier-1). Typing goes no deeper than
 * capitalization + heading-context lean. Entity types are the three well-signaled
 * kinds Plan 218-01 mints: company / technology / market. The semantic
 * WHAT-vs-WHY disambiguation (is a surviving capitalized term a real entity, or
 * the room's own methodology vocabulary?) is TIER-2 and now exists in the sibling
 * module lib/core/eureka/entity-classifier.cjs -- a local classification call.
 * THIS module stays the zero-model, zero-egress tier-1: it performs no network
 * reach and loads no model (Part 8 graph-boundary guarantee, grep-gated by the
 * test). Its only tier-2 seam is additive: a capitalized term that hits the
 * FRAMEWORK_TERMS stoplist below is still excluded from entities, but is now
 * ALSO surfaced structurally into a third output bucket (frameworkTerms) so the
 * tier-2 pass and the dispatcher can capture it as a framework signal on the
 * source artifact rather than losing it silently.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE).
 */

const DEFAULT_MAX_PER_ARTIFACT = 25;
const ENTITY_TYPES = Object.freeze(['company', 'technology', 'market']);
const DEFAULT_TYPE = 'company'; // venture prose proper nouns default to company.

// Capitalized sentence-starters and function words that a greedy Title-Case
// regex would otherwise mis-tag as entities. Reused to strip leading noise from
// a proper-noun run and to drop single-word noise tokens (Pitfall 4).
// Matched case-INSENSITIVELY (see STOPWORDS_LOWER) so an ALL-CAPS emphasis
// variant ("NOT" in "does NOT apply") is caught the same as Title-case "Not".
const STOPWORDS = new Set([
  'The', 'This', 'That', 'These', 'Those', 'A', 'An', 'It', 'We', 'They', 'He',
  'She', 'I', 'In', 'On', 'At', 'As', 'Of', 'For', 'And', 'Or', 'But', 'To',
  'From', 'With', 'By', 'Is', 'Are', 'Was', 'Were', 'Be', 'Been', 'Our', 'Your',
  'Their', 'His', 'Her', 'Its', 'My', 'No', 'Not', 'So', 'If', 'Then', 'Than',
  'When', 'While', 'Where', 'What', 'Who', 'Which', 'How', 'Why', 'All', 'Any',
  'Each', 'Some', 'Both', 'One', 'Two', 'Three', 'Also', 'However', 'Because',
]);
const STOPWORDS_LOWER = new Set(Array.from(STOPWORDS, function (w) { return w.toLowerCase(); }));

/*
 * FRAMEWORK_TERMS (T-218-VD-2 split for tier-2): the room's own methodology,
 * constitutional vocabulary, and generic business-framework acronyms. Tier-1's
 * capitalization heuristic cannot tell "Sabra" (a real company) apart from
 * "Canon" (this repo's own constitution doc) or "TAM" (a generic market-SIZING
 * acronym, not the name of an actual market) -- both pass the PROPER_RUN regex
 * identically. Verified live against aion-eureka-synergy (218-VERIFICATION.md
 * "Second Finding"): once the cohort-stratification fix (T-218-VD) stopped
 * floor-pinning entity nodes, the unfiltered extractor's highest-degree
 * "entities" were dominated by exactly this vocabulary -- curated from that live
 * evidence, not guessed in the abstract.
 *
 * WHY THIS IS A SEPARATE SET FROM NOISE_TERMS (the tier-2 seed): these terms are
 * NOT garbage. They are the room's WHY vocabulary -- the language of HOW the
 * venture is being analyzed and documented, a real and meaningful signal that a
 * structural stoplist cannot promote to a graph node but should not throw away
 * either. A FRAMEWORK_TERMS hit is still excluded from entities and relation
 * endpoints (cleanName still returns null for it), but extractEntities now ALSO
 * records it into the additive frameworkTerms bucket so the tier-2 pass can
 * capture it as a framework signal on the source artifact. Matched
 * case-insensitively against the FULL cleaned candidate name, so a multi-word
 * term ("ICM Layer") matches as a whole rather than token-by-token (which would
 * risk over-suppressing a real company sharing one word with a framework phrase).
 *
 * As of quick-task 260714-k44 this set is ALSO the WHY reference seed for the
 * tier-2a embedding classifier (lib/core/eureka/embedding-classifier.cjs): it is
 * exported below and reused there per Canon Part 7 (reuse before build) rather
 * than copied, so the WHY vocabulary lives in exactly one place.
 */
const FRAMEWORK_TERMS = new Set([
  // This system's own structural / constitutional vocabulary.
  'canon', 'icm layer', 'feynman', 'aaak record', 'section completeness',
  'evidence threshold', 'begin references', 'end references', 'foundry-level',
  'room', 'minto', 'destijl', 'de stijl', 'pws', 'mos', 'mindrianos', 'jtbd',
  // Generic business/portfolio-metric acronyms: a market-SIZING term or a
  // process acronym, never itself the name of a specific company or market.
  'tam', 'sam', 'som', 'gap', 'moa', 'eir', 'pair', 'kpi', 'roi', 'mvp', 'poc',
]);

/*
 * NOISE_TERMS (the true-garbage residue of the T-218-VD-2 split): common English
 * words that only got capitalized by sentence position (verbs/nouns/adverbs, so
 * STOPWORDS above -- function words only -- never covered them) or by markdown
 * emphasis (**Note:**, "NOT applicable"). Unlike FRAMEWORK_TERMS, these name
 * nothing at all, so a hit is silently dropped exactly as before: it is neither
 * an entity nor a framework signal.
 */
const NOISE_TERMS = new Set([
  'see', 'note', 'data', 'map', 'max', 'last', 'evidence', 'threshold',
  'record', 'layer', 'phase', 'part', 'reference', 'references', 'section',
  'not', 'plan', 'task', 'step', 'summary', 'context',
]);

// A run ending in a common file extension is a filename, never an entity --
// the single biggest observed noise source live ("ROOM.md", "STATE.md",
// "SKILL.md", "CLAUDE.md" all appear in ordinary MindrianOS prose as
// cross-references, e.g. "see ROOM.md for details").
const FILENAME_RX = /\.(md|cjs|js|mjs|json|txt|py|sh|ya?ml)$/i;

/*
 * T-218-VD-3 (second live re-verify): after NOISE_TERMS killed the curated
 * list, the remaining top-ranked "entities" on aion-eureka-synergy were
 * "Larry", "Seeded", "Governing Thought", "Auto-generated", "Status",
 * "Stage", "Progress" -- not random capitalized words, but auto-generated
 * STATUS-DASHBOARD FIELD VALUES ("Status: Seeded", "Source: Auto-generated",
 * ROOM.md/STATE.md-style completeness tables), not narrative sentences.
 * This is filename-agnostic and more general than blacklisting specific
 * files: a "Label: Value" line where the label is ALL-Title-Case (every
 * word capitalized -- "Governing Thought:", "Section Completeness:") is
 * structurally a metadata field, never venture prose. Deliberately narrower
 * than "any line with a colon": a real narrative sentence that happens to
 * contain one ("Prodrive announced: they will expand.") has a lowercase verb
 * after the first word and does NOT match this pattern, so it survives.
 * Tier-1 stays precision-first (Pitfall 4): a metadata line is skipped
 * WHOLESALE (both the label and the value side), never partially mined.
 */
const METADATA_FIELD_RX = /^\s*(?:[-*]\s+)?\*{0,2}[A-Z][a-z0-9]*(?:[ /_-][A-Z][a-z0-9]*){0,4}\*{0,2}\s*:\s*\S/;

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
// to noise or is excluded. Strips leading stopwords, drops single-word stopword
// tokens, and (T-218-VD-2) rejects filenames, framework vocabulary, and true
// noise. An optional onFrameworkTerm(name) collector is invoked at the exact
// point a FRAMEWORK_TERMS hit is rejected, so the tier-2 seed captures the WHY
// term instead of losing it (a NOISE_TERMS hit stays silently dropped).
function cleanName(raw, onFrameworkTerm) {
  if (!raw) return null;
  const words = raw.trim().split(/[ \t]+/).filter(Boolean);
  // Strip leading stopwords ("The Prodrive" -> "Prodrive"), case-insensitive
  // so an ALL-CAPS or lowercase emphasis variant is caught the same way.
  while (words.length && STOPWORDS_LOWER.has(words[0].toLowerCase())) words.shift();
  if (words.length === 0) return null;
  // A lone stopword or a lone one-letter token is noise.
  if (words.length === 1 && (STOPWORDS_LOWER.has(words[0].toLowerCase()) || words[0].length < 2)) return null;
  const name = words.join(' ').trim();
  if (name.length < 2) return null;
  // A filename is never an entity ("ROOM.md", "STATE.md").
  if (FILENAME_RX.test(name)) return null;
  const lower = name.toLowerCase();
  // Framework/methodology vocabulary is never an entity, but it IS a WHY signal:
  // record it via the collector at the exact rejection point, then drop it from
  // the entity stream (exact match on the full candidate, case-insensitive).
  if (FRAMEWORK_TERMS.has(lower)) {
    if (typeof onFrameworkTerm === 'function') onFrameworkTerm(name);
    return null;
  }
  // True noise names nothing at all -- silently dropped, not even a WHY signal.
  if (NOISE_TERMS.has(lower)) return null;
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
 * extractEntities(markdown, opts) -> { entities, relations, frameworkTerms }
 *
 *   entities:       [{ entityType, name, sourceArtifactId }]
 *   relations:      [{ source, target, edge_type }]   (source/target are entity names)
 *   frameworkTerms: [{ name, sourceArtifactId }]       (the tier-2 WHY seed)
 *
 * The frameworkTerms key is ADDITIVE: existing callers that destructure
 * { entities, relations } are byte-compatible. It is present on the parse path;
 * the empty-input and error paths return the historical { entities, relations }
 * shape unchanged (so the tier-1 test's empty-shape deepEqual stays green).
 *
 * opts:
 *   sourceArtifactId  the artifact id every extracted entity / framework term is
 *                     provenance-tagged with (default null).
 *   maxPerArtifact    the output cap (default 25). Entities, relations, and
 *                     frameworkTerms are each independently bounded by this cap.
 */
function extractEntities(markdown, opts) {
  const out = { entities: [], relations: [] };
  if (!markdown || typeof markdown !== 'string') return out;
  // Additive third bucket, present only on the parse path (keeps the empty-input
  // early return byte-identical to the historical { entities, relations } shape).
  out.frameworkTerms = [];

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
    const seenFramework = new Set(); // dedup framework terms case-insensitively
    // Collector invoked when cleanName rejects a FRAMEWORK_TERMS candidate. Deduped
    // case-insensitively and independently capped by maxPerArtifact.
    const collectFramework = function (fname) {
      if (out.frameworkTerms.length >= cap) return;
      const key = fname.toLowerCase();
      if (seenFramework.has(key)) return;
      seenFramework.add(key);
      out.frameworkTerms.push({ name: fname, sourceArtifactId: sourceArtifactId });
    };

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

      // T-218-VD-3: a metadata/status-field line ("Status: Seeded",
      // "**Source:** Auto-generated") is structured data, not narrative
      // prose, in ANY domain -- this check is deliberately shape-based, not
      // vocabulary-based, so it generalizes to a venture room this system
      // has never seen (its own field names, its own status values) exactly
      // as well as it does to a MindrianOS dogfooding room. See
      // METADATA_FIELD_RX's comment for why the label must be all-Title-Case
      // (so a real narrative sentence with a mid-line colon survives).
      if (METADATA_FIELD_RX.test(line)) continue;

      // A markdown table row is tabular data, never narrative prose, in any
      // domain -- same domain-agnostic rationale as the metadata-field check.
      // Covers both a data row ("| Business Model | Well-developed | ... |")
      // and a header-separator row ("|---|---|").
      if (/^\s*\|.*\|\s*$/.test(line) || /^\s*\|?[\s:|-]+\|[\s:|-]*\|?\s*$/.test(line)) continue;

      const scrubbed = scrubLine(line);
      if (!scrubbed.trim()) continue;

      const entityType = currentLean || DEFAULT_TYPE;

      // Collect the proper-noun candidates on this line (ordered), for both entity
      // emission and relation pairing.
      const lineNames = [];
      let m;
      PROPER_RUN.lastIndex = 0;
      while ((m = PROPER_RUN.exec(scrubbed)) !== null) {
        const name = cleanName(m[1], collectFramework);
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
  // Additive (quick-task 260714-k44): the frozen WHY vocabulary, exported so the
  // tier-2a embedding classifier reuses this exact Set as its WHY reference seed
  // (Canon Part 7) instead of copying the terms. Existing destructuring callers
  // that only take { extractEntities, ENTITY_TYPES, DEFAULT_MAX_PER_ARTIFACT }
  // are byte-compatible.
  FRAMEWORK_TERMS,
};
