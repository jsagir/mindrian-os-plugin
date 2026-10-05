'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * SEED-103 (2026-10-01): the Eureka PERSPECTIVE, stages 01 (substrate) and
 * 02 (recall), for the one research planner. Design:
 * .planning/REVIEWS/2026-10-01-eureka-v2-design.md (ADR-E13, ADR-E14).
 *
 * WHAT IT DOES. Reads the bound room's local graph and its ICM structure and
 * proposes cross-domain candidate pairs that the room does NOT already
 * connect. It never embeds, never calls a model, never reaches the network.
 * The navigator's ruling: the canvas uses the local graph and the ICM
 * structure instead of embeddings.
 *
 * THREE RECALL LANES, all local:
 *   shared_entity  two things in different sections cite the same entity node
 *                  (the DESCRIBES edges entity-extract already wrote);
 *   lexical        token overlap (Jaccard over stopword-stripped tokens) across
 *                  sections, top-k per thing, above a floor;
 *   icm_declared   a section's CONTEXT.md "## Inputs" names another section:
 *                  the room's own contract says those two domains feed each
 *                  other, so a pair across them is worth a look.
 *
 * THE EXCLUSION SET (ADR-E14): a pair whose endpoints are already joined by
 * any edge, or already the evidence ids of an existing opportunity node, is
 * dropped before ranking. Phase 355 measured that 45 of 96 shown pairings
 * were already known to the navigator; the room already knows what it knows.
 *
 * EDIT SURFACES (ICM invariant 6): each stage writes one plain file under
 * <room>/.mindrian/eureka-perspective/<tag>/NN_stage/output/. Delete a line in
 * candidates.jsonl and the next stage judges what is left. STATUS.md is
 * derived from which files exist and is never hand-edited (invariant 9).
 *
 * Part 8: nothing here egresses to Theo. The question set this module builds
 * carries room titles for the navigator's plan card; a title becomes a WEB
 * search slot (ruling 2026-10-05, plan 369.2-04) only after the run grant card
 * shows the exact string. Theo leaves never use this path (find-connections
 * keeps its own strict canon-name rule).
 *
 * Slot rule: a pair side contributes its field title (title, name or label),
 * else a side-unique entity handle, else a canon handle; it never contributes
 * first-sentence text of a claim or artifact body. The title is a valid web slot
 * under the web rule (families.composableQuery: markdown stripped, cap 200,
 * control characters refused). A pair with no usable phrase becomes a local-only
 * leaf (researchable false, corpus room). SEED-104 gated this on the strict Theo
 * term rule; that gate belongs to the Theo lines only.
 *
 * Reads go through the navigation door (openRoomDbReadOnlyForCaller). This
 * module writes nothing to room.db. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const navigation = require('../../navigation.cjs');
const sectionRegistry = require('../../section-registry.cjs');
const verificationStamp = require('../../verification-stamp.cjs');
// Canon Part 7: the ONE scaffold predicate (Phase 363.1 scaffold-as-content
// bug class: BRAIN / FEYNMAN / MINTO / CONTEXT rows are the room's own
// scaffold, never candidates).
const scaffoldPredicate = require('../../scaffold-predicate.cjs');
// The ONE slot gate (stripMarkdown, composableQuery for web slots) shared with the composer.
const families = require('../families.cjs');
// Phase 366 plan 08 (D-06): the helpers every perspective shares live in one file.
const shared = require('./shared.cjs');
const parseProps = shared.parseProps;
const textOfProps = shared.textOfProps;
const hasFieldTitle = shared.hasFieldTitle;
const titleOfProps = shared.titleOfProps;
const tokenize = shared.tokenize;
const jaccard = shared.jaccard;
const pairKey = shared.pairKey;
const runTagNow = shared.runTagNow;
const writeJsonl = shared.writeJsonl;
const readJsonl = shared.readJsonl;
const deriveStatus = shared.deriveStatus;
const STAGES = shared.STAGES;

// Provenance edge types a section-less node may inherit its section through
// (a claim carries no section column; its SOURCED_FROM artifact does).
const SECTION_INHERIT_EDGES = Object.freeze(new Set(['SOURCED_FROM', 'DERIVED_FROM', 'STATES', 'EVIDENCES', 'BELONGS_TO']));

const BUDGETS = Object.freeze({
  max_candidates: 200,
  lexical_top_k: 5,
  lexical_floor: 0.08,
  body_cap: 2000,
  max_leaves: 8,
});

const SCHEMA_QS = 'mos.research-question-set/1';
const ID = 'eureka';
const TEMPLATE_ID = 'eureka';
const COMMAND = '/mos:eureka';
const RUN_ROOT = path.join('.mindrian', 'eureka-perspective');
const LENSES = Object.freeze(['eu.transfer', 'eu.known']);
// The room-only reason for a pair with no usable web phrase (369.2-04). No Part 8 claim: the web lines take a room
// phrase; the leaf is local only because the phrase is empty, over the 200 cap, or holds a control character.
const NOT_RESEARCHABLE_PAIR = 'No search phrase could be formed from this pair\'s titles (empty, over 200 characters, or a control character), so it is answered from the room only.';
const FALSIFIER = 'Published work where the two mechanisms are combined and the transfer fails, or where the pairing is already standard practice.';
// The recall lanes stage A credits (plus the entity floor): the shared judge reads this per module.
const STAGE_A_LANES = Object.freeze(['icm_declared', 'lexical']);
const STATUS_TITLE = 'Eureka perspective run';
const RUN_LANES = Object.freeze(['shared_entity', 'lexical', 'icm_declared']);

// Node types that are never "things": structure, memory, and outputs of this
// very perspective. Entities are bridges (lane shared_entity), not things.
const NON_THING_TYPES = Object.freeze(new Set([
  'Section', 'section', 'memory_artifact', 'memory_event', 'opportunity', 'jtbd',
  'reasoning', 'decision', 'open_question', 'WhitespaceZone', 'Breakthrough',
]));
const ENTITY_TYPES = Object.freeze(new Set(['company', 'market', 'technology', 'person', 'entity', 'framework', 'organization', 'product']));

// ---------------------------------------------------------------------------
// helpers (the shared ones live in ./shared.cjs)
// ---------------------------------------------------------------------------
// Sections that hold products or structure, never content to recall from
// (ICM L4 output folders and the registry's structural dirs): a rendered
// deck in exports/ and its copy in present/ are the same bytes twice.
const PRODUCT_SECTIONS = Object.freeze(new Set(['exports', 'present', 'assets', 'snapshots', 'meetings', 'team', 'references']));

function sectionOfNode(row, p, belongsTo) {
  if (typeof row.source_section === 'string' && row.source_section) return row.source_section;
  if (typeof p.section === 'string' && p.section) return p.section;
  const via = belongsTo[row.id];
  if (via) return via;
  if (typeof row.source_path === 'string' && row.source_path.indexOf('/') !== -1 && !/^[a-z]+:/.test(row.source_path)) {
    return row.source_path.split('/')[0];
  }
  return null;
}

function sectionSlugOfSectionNode(row, p) {
  if (typeof p.slug === 'string' && p.slug) return p.slug;
  if (typeof p.name === 'string' && p.name) return p.name;
  const id = String(row.id);
  return id.replace(/^section:/, '').replace(/^Section:/, '');
}

// A FEYNMAN row is scaffold only when its file on disk is the seeded template
// (scaffold-predicate.isScaffoldFile), the rule lib/core/eureka/candidate-exclusion.cjs
// applies. The on-disk path comes from source_path, props.path or the id; an
// absolute path or a `..` segment never steers a read outside the room
// (T-363.1-09). No roomDir, a missing file or an unreadable one: content wins.
function feynmanPathCandidates(row, p) {
  const raws = [row.source_path, p.path];
  if (typeof row.id === 'string' && row.id.indexOf('/') !== -1) raws.push(row.id);
  const out = [];
  raws.forEach(function (raw) {
    if (typeof raw !== 'string' || !raw || raw.indexOf(':') !== -1) return;
    let rel = raw.replace(/\\/g, '/');
    if (rel.charAt(0) === '/' || rel.split('/').indexOf('..') !== -1) return;
    if (!/\.md$/i.test(rel)) rel += '.md';
    if (rel.split('/').pop() === 'FEYNMAN.md') out.push(rel);
  });
  return out;
}

function isSeededFeynmanRow(row, p, roomDir) {
  if (typeof roomDir !== 'string' || !roomDir) return false;
  return feynmanPathCandidates(row, p).some(function (rel) {
    return scaffoldPredicate.isScaffoldFile(path.join(roomDir, rel));
  });
}

// ---------------------------------------------------------------------------
// 01 substrate
// ---------------------------------------------------------------------------
/**
 * buildSubstrate(db, opts) -> the eight-key substrate every perspective consumes (366-08 contract)
 *   things:          [{ id, type, section, title, text, tokens: Set, degree, canon_handle, title_from_field }]
 *   entities:        { [entityId]: { id, type, title, title_from_field, things: Set<thingId> } }
 *   connected:       Set<pairKey> (any edge between two things, either direction)
 *   opp_pairs:       Set<pairKey> (evidence pairs of existing opportunity nodes)
 *   sections:        string[] (sorted section slugs that hold things)
 *   edges:           [{ source, target, type }] (every edge row, as read)
 *   framework_nodes: { [id]: { id, name } } for every node of type framework
 *   whitespace_zones:{ [id]: { id, title } } for every node of type WhitespaceZone
 * No byId and no nodes in the return: a consumer indexes things by id itself.
 */
function buildSubstrate(db, opts) {
  const o = opts || {};
  const cap = o.body_cap || BUDGETS.body_cap;
  const nodes = db.prepare('SELECT id, type, properties, source_path, source_section, created_at FROM nodes').all();
  const edges = db.prepare('SELECT source, target, type FROM edges').all();

  const byId = {};
  nodes.forEach(function (r) { byId[r.id] = r; });

  // section nodes -> slug; BELONGS_TO -> section for members
  const sectionSlug = {};
  nodes.forEach(function (r) {
    if (r.type === 'Section' || r.type === 'section') sectionSlug[r.id] = sectionSlugOfSectionNode(r, parseProps(r.properties));
  });
  const belongsTo = {};
  edges.forEach(function (e) {
    if (e.type === 'BELONGS_TO' && sectionSlug[e.target]) belongsTo[e.source] = sectionSlug[e.target];
  });

  const degree = {};
  edges.forEach(function (e) { degree[e.source] = (degree[e.source] || 0) + 1; degree[e.target] = (degree[e.target] || 0) + 1; });

  // Theo readiness (navigator, 2026-10-01: "reform the nodes in the local graph
  // to play better with Theo"). Phase 355 measured 80.2% of pairings as
  // not_called because neither side carried a canon Framework name. Each thing
  // records its canon handle: (1) the name of the framework node a USES_FRAMEWORK
  // edge points at, else (2) the ONE resolver (verification-stamp.resolveEndpoint:
  // frontmatter framework, then methodology through the command registry, then
  // the title, then a ratified room translation), else null (D-10, D-11). No
  // fuzzy matching, no Theo lookup. With no roomDir the resolver step is skipped
  // and the handle comes from the edge or is null; a missing roomDir never throws.
  const frameworkNodes = {};
  nodes.forEach(function (r) {
    if (r.type !== 'framework') return;
    const p = parseProps(r.properties);
    frameworkNodes[r.id] = { id: r.id, name: (typeof p.name === 'string' && p.name.trim()) ? p.name.trim() : titleOfProps(p, r.id) };
  });
  const frameworkOf = {};
  edges.forEach(function (e) {
    if (e.type === 'USES_FRAMEWORK' && frameworkNodes[e.target] && frameworkOf[e.source] === undefined) frameworkOf[e.source] = frameworkNodes[e.target].name;
  });
  let resolverCtx = o.resolverCtx || null;
  if (!resolverCtx && o.roomDir) {
    try { resolverCtx = verificationStamp.resolverCtxFor(o.roomDir); } catch (_e) { resolverCtx = null; }
  }
  function handleFor(id, p, title) {
    if (frameworkOf[id]) return frameworkOf[id];
    if (!resolverCtx) return null;
    return verificationStamp.resolveEndpoint({ framework: p.framework, methodology: p.methodology, title: title }, resolverCtx).name || null;
  }

  const things = [];
  const thingIds = new Set();
  const entities = {};
  nodes.forEach(function (r) {
    const p = parseProps(r.properties);
    if (ENTITY_TYPES.has(r.type)) {
      entities[r.id] = { id: r.id, type: r.type, title: titleOfProps(p, r.id), title_from_field: hasFieldTitle(p), things: new Set() };
      return;
    }
    if (NON_THING_TYPES.has(r.type)) return;
    const base = String(r.id).split('/').pop();
    if (p.scaffold === true) return;
    // FEYNMAN is body-dependent (Phase 363.1 B51-01, restored by 366-22): a
    // seeded template is scaffold, an authored FEYNMAN is content. Every other
    // scaffold basename drops by name.
    if (base === 'FEYNMAN') { if (isSeededFeynmanRow(r, p, o.roomDir)) return; }
    else if (scaffoldPredicate.isScaffoldBasename(base) || /^(CONTEXT|ROOM|MINTO|STATE|BRAIN)$/.test(base)) return;
    if (String(r.source_path || '').indexOf('system:') === 0 && r.type !== 'Artifact' && r.type !== 'claim') return;
    const text = textOfProps(p, cap);
    if (!text) return;
    const title = titleOfProps(p, r.id);
    things.push({ id: r.id, type: r.type, section: sectionOfNode(r, p, belongsTo), title: title, text: text, tokens: tokenize(text), degree: degree[r.id] || 0, canon_handle: handleFor(r.id, p, title), title_from_field: hasFieldTitle(p) });
  });

  // Second pass: a section-less thing (a claim, typically) inherits the section
  // of the thing it is sourced from, one hop, through provenance edges.
  const sectionById = {};
  things.forEach(function (t) { if (t.section) sectionById[t.id] = t.section; });
  edges.forEach(function (e) {
    if (!SECTION_INHERIT_EDGES.has(e.type)) return;
    if (sectionById[e.source] === undefined && sectionById[e.target]) sectionById[e.source] = sectionById[e.target];
  });
  // artifact_file writes a claim with source_path 'artifact:<id>' and no section
  // column (SEED-101 P1-3): inherit the artifact's section from that handle.
  const rowById = byId;
  const structural = new Set(PRODUCT_SECTIONS);
  (Array.isArray(sectionRegistry.STRUCTURAL_DIRS) ? sectionRegistry.STRUCTURAL_DIRS : []).forEach(function (d) { structural.add(String(d).replace(/\/$/, '')); });
  for (let i = things.length - 1; i >= 0; i -= 1) {
    const t = things[i];
    if (!t.section) {
      const row = rowById[t.id];
      const sp = row && typeof row.source_path === 'string' ? row.source_path : '';
      const m = sp.match(/^artifact:(.+)$/);
      t.section = sectionById[t.id] || (m && sectionById[m[1]]) || null;
    }
    if (!t.section || structural.has(t.section)) things.splice(i, 1); else thingIds.add(t.id);
  }

  // claims without a section inherit it from their SOURCED_FROM artifact (one hop)
  // (handled above when props.section or BELONGS_TO exist; a second pass for SOURCED_FROM)
  const connected = new Set();
  const oppPairs = new Set();
  edges.forEach(function (e) {
    if (entities[e.target] && thingIds.has(e.source)) entities[e.target].things.add(e.source);
    if (entities[e.source] && thingIds.has(e.target)) entities[e.source].things.add(e.target);
    if (thingIds.has(e.source) && thingIds.has(e.target)) connected.add(pairKey(e.source, e.target));
  });
  nodes.forEach(function (r) {
    if (r.type !== 'opportunity') return;
    const p = parseProps(r.properties);
    const ev = Array.isArray(p.evidence_ids) ? p.evidence_ids : [];
    for (let i = 0; i < ev.length; i += 1) for (let j = i + 1; j < ev.length; j += 1) oppPairs.add(pairKey(String(ev[i]), String(ev[j])));
  });

  const sections = Array.from(new Set(things.map(function (t) { return t.section; }))).sort();
  const whitespaceZones = {};
  nodes.forEach(function (r) {
    if (r.type === 'WhitespaceZone') whitespaceZones[r.id] = { id: r.id, title: titleOfProps(parseProps(r.properties), r.id) };
  });
  return { things: things, entities: entities, connected: connected, opp_pairs: oppPairs, sections: sections, edges: edges, framework_nodes: frameworkNodes, whitespace_zones: whitespaceZones };
}

// ---------------------------------------------------------------------------
// ICM lane: declared section coupling from per-section CONTEXT.md "## Inputs"
// ---------------------------------------------------------------------------
function declaredCouplings(roomDir, sections) {
  const couplings = new Set();
  const known = new Set(sections);
  let all = [];
  try { all = sectionRegistry.discoverSections(roomDir).all || []; } catch (_e) { all = []; }
  all.forEach(function (s) { known.add(s); });
  known.forEach(function (sec) {
    const file = path.join(roomDir, sec, 'CONTEXT.md');
    let body = '';
    try { body = fs.readFileSync(file, 'utf8'); } catch (_e) { return; }
    const m = body.match(/^##\s+Inputs\s*$([\s\S]*?)(?=^##\s|\Z)/m);
    const inputs = m ? m[1] : '';
    known.forEach(function (other) {
      if (other === sec) return;
      const re = new RegExp('(^|[\\s`(/])(\\.\\./)?' + other.replace(/[-]/g, '\\-') + '/', 'm');
      if (re.test(inputs)) couplings.add(pairKey(sec, other));
    });
  });
  return couplings;
}

// ---------------------------------------------------------------------------
// 02 recall
// ---------------------------------------------------------------------------
/**
 * recallCandidates(substrate, roomDir, budgets, opts) -> { candidates, counts, pairs_truncated }
 *   candidates: [{ a, b, section_a, section_b, title_a, title_b, lanes: [], lexical, shared_entities: [] }]
 *   opts.extraLanes (Phase 366 plan 18, the spike vector arm): an array of synchronous functions
 *     (substrate) -> [{ a, b, lane, score? }]. Each proposal goes through the SAME exclusion-set
 *     upsert and the SAME cap as the built-in lanes (a score lands on the row under the lane's name
 *     and only breaks ties after lexical). With no extraLanes nothing changes: the output equals the
 *     366-08 golden byte for byte. A lane that throws throws; it is never skipped silently.
 */
function recallCandidates(substrate, roomDir, budgets, opts) {
  const B = Object.assign({}, BUDGETS, budgets || {});
  const extraLanes = (opts && Array.isArray(opts.extraLanes)) ? opts.extraLanes.filter(function (f) { return typeof f === 'function'; }) : [];
  const things = substrate.things;
  // The one exclusion-set upsert every perspective reuses (shared.makeCandidateStore).
  const store = shared.makeCandidateStore(substrate);
  // known_pairs: the exclusion set's size (edges between things + evidence pairs of
  // existing opportunity nodes); excluded_known: how many lane proposals it caught.
  const counts = { things: things.length, sections: substrate.sections.length, canon_resolved: things.filter(function (t) { return !!t.canon_handle; }).length, known_pairs: substrate.connected.size + substrate.opp_pairs.size, shared_entity: 0, lexical: 0, icm_declared: 0, excluded_known: 0 };

  // lane 1: shared entity
  Object.keys(substrate.entities).forEach(function (eid) {
    const ent = substrate.entities[eid];
    const ids = Array.from(ent.things);
    for (let i = 0; i < ids.length; i += 1) for (let j = i + 1; j < ids.length; j += 1) {
      if (store.upsert(ids[i], ids[j], 'shared_entity', { entity: ent.title })) counts.shared_entity += 1;
    }
  });

  // lane 2: lexical top-k per thing, cross-section
  things.forEach(function (t) {
    const scored = [];
    things.forEach(function (u) {
      if (u.id === t.id || u.section === t.section) return;
      const s = jaccard(t.tokens, u.tokens);
      if (s >= B.lexical_floor) scored.push([s, u.id]);
    });
    scored.sort(function (x, y) { return y[0] - x[0] || (x[1] < y[1] ? -1 : 1); });
    scored.slice(0, B.lexical_top_k).forEach(function (pair) {
      if (store.upsert(t.id, pair[1], 'lexical', { lexical: pair[0] })) counts.lexical += 1;
    });
  });

  // injected lanes (the spike's vector arm): same upsert, same exclusion set, counted per lane name
  extraLanes.forEach(function (laneFn) {
    const proposals = laneFn(substrate);
    (Array.isArray(proposals) ? proposals : []).forEach(function (pr) {
      if (!pr || typeof pr.a !== 'string' || typeof pr.b !== 'string' || typeof pr.lane !== 'string' || !pr.lane) return;
      const extra = {};
      if (typeof pr.score === 'number' && Number.isFinite(pr.score)) { extra.fields = {}; extra.fields[pr.lane] = pr.score; }
      if (store.upsert(pr.a, pr.b, pr.lane, extra)) counts[pr.lane] = (counts[pr.lane] || 0) + 1;
    });
  });

  // lane 3: ICM declared coupling between sections
  const couplings = declaredCouplings(roomDir, substrate.sections);
  if (couplings.size) {
    store.rows().forEach(function (c) {
      if (couplings.has(pairKey(c.section_a, c.section_b)) && c.lanes.indexOf('icm_declared') === -1) { c.lanes.push('icm_declared'); counts.icm_declared += 1; }
    });
    // declared coupling with no other lane hit: surface the best lexical pair across the two sections
    couplings.forEach(function (k) {
      const secs = k.split('\u0000');
      const hasAny = store.rows().some(function (c) { return pairKey(c.section_a, c.section_b) === k; });
      if (hasAny) return;
      let best = null;
      things.forEach(function (t) {
        if (t.section !== secs[0]) return;
        things.forEach(function (u) {
          if (u.section !== secs[1]) return;
          const s = jaccard(t.tokens, u.tokens);
          if (!best || s > best[0]) best = [s, t.id, u.id];
        });
      });
      if (best) { store.upsert(best[1], best[2], 'icm_declared', { lexical: best[0] }); counts.icm_declared += 1; }
    });
  }

  counts.excluded_known = store.excludedKnown();
  let list = store.rows();
  list.sort(function (x, y) {
    return (y.lanes.length - x.lanes.length) || (y.shared_entities.length - x.shared_entities.length) || (y.lexical - x.lexical) || ((y.vector || 0) - (x.vector || 0)) || (x.a < y.a ? -1 : 1) || (x.b < y.b ? -1 : 1);
  });
  const total = list.length;
  const truncated = Math.max(0, total - B.max_candidates);
  list = list.slice(0, B.max_candidates);
  counts.candidates = list.length;
  return { candidates: list, counts: counts, pairs_truncated: truncated, couplings: Array.from(couplings).map(function (k) { return k.split('\u0000'); }) };
}

// ---------------------------------------------------------------------------
// run files (edit surfaces) and STATUS.md (derived)
// ---------------------------------------------------------------------------
function runDirFor(roomDir, tag) { return shared.runDirFor(roomDir, RUN_ROOT, tag); }

function writeRunFiles(roomDir, tag, substrate, recall) {
  return shared.writeRunFiles(roomDir, RUN_ROOT, tag, substrate, recall, { title: STATUS_TITLE, lanes: RUN_LANES.slice() });
}

function readCandidates(roomDir, tag) { return shared.readCandidates(roomDir, RUN_ROOT, tag); }

// ---------------------------------------------------------------------------
// the question set the planner consumes
// ---------------------------------------------------------------------------
const BAD_SLOT_CHARS = /["\n\t()\\]/g;
function slotTerm(raw) {
  // A plain phrase for a WEB line: markdown stripped, forbidden characters and
  // boolean tokens removed, then the web rule (composableQuery: cap 200, control
  // characters refused; ruling 2026-10-05). Theo leaves never use this path. There
  // is no truncation and no body-token fallback: both produced room-prose fragments.
  const t = families.stripMarkdown(raw).replace(BAD_SLOT_CHARS, ' ').replace(/\b(AND|OR|NOT)\b/g, ' ').replace(/\s+/g, ' ').trim();
  return families.composableQuery(t);
}

// abstractTerm(thing, handlesByThing, sharedTitles) -> a clean term or null.
// Candidates, in order: the thing's own field title; the titles of entity nodes
// linked to it (sorted by entity id), excluding the pair's shared bridge entities
// (they would give both sides the same term); its canon handle.
function abstractTerm(thing, handlesByThing, sharedTitles) {
  if (!thing) return null;
  const shared = Array.isArray(sharedTitles) ? sharedTitles : [];
  const cands = [];
  if (thing.title_from_field) cands.push(thing.title);
  const handles = handlesByThing && Array.isArray(handlesByThing[thing.id]) ? handlesByThing[thing.id] : [];
  handles.forEach(function (h) { if (shared.indexOf(h) === -1) cands.push(h); });
  cands.push(thing.canon_handle);
  for (let i = 0; i < cands.length; i += 1) {
    const t = slotTerm(cands[i]);
    if (t) return t;
  }
  return null;
}

function questionSetFor(recall, substrate, opts) {
  const o = opts || {};
  const maxLeaves = o.max_leaves || BUDGETS.max_leaves;
  const tag = typeof o.tag === 'string' && o.tag ? o.tag : runTagNow(o.now);
  const byId = {};
  substrate.things.forEach(function (t) { byId[t.id] = t; });
  // entity handles per thing, in sorted entity-id order (only entities that carry
  // a real name field; an entity whose "title" fell back to text or its id is not a handle)
  const handlesByThing = {};
  Object.keys(substrate.entities).sort().forEach(function (eid) {
    const ent = substrate.entities[eid];
    if (!ent.title_from_field) return;
    Array.from(ent.things).forEach(function (tid) {
      if (!handlesByThing[tid]) handlesByThing[tid] = [];
      handlesByThing[tid].push(ent.title);
    });
  });
  const leaves = [];
  recall.candidates.slice(0, maxLeaves).forEach(function (c, i) {
    const ta = byId[c.a]; const tb = byId[c.b];
    const termA = abstractTerm(ta, handlesByThing, c.shared_entities);
    const termB = abstractTerm(tb, handlesByThing, c.shared_entities);
    const question = 'Does the mechanism behind "' + c.title_a + '" (' + c.section_a + ') transfer to "' + c.title_b + '" (' + c.section_b + ')?';
    // 366-02: the closed pair the pyramid carries into the plan hash and the
    // filer turns into two DERIVED_FROM edges. lanes stays a separate field.
    const pair = { a: c.a, b: c.b, perspective: 'eureka', run_tag: tag };
    if (!termA || !termB || termA.trim().toLowerCase() === termB.trim().toLowerCase()) {
      // No usable, distinct phrase for this pair (web rule); it is answered from the room only.
      leaves.push({
        id: 'eu-' + (i + 1),
        question: question,
        origin: 'framework_dimension',
        dimension: 'eu:mechanism_transfer',
        lens: 'eu.transfer',
        researchable: false,
        not_researchable_reason: NOT_RESEARCHABLE_PAIR,
        falsifier: { text: FALSIFIER },
        corpus: 'room',
        pair: pair,
        lanes: c.lanes.slice(),
      });
      return;
    }
    leaves.push({
      id: 'eu-' + (i + 1),
      question: question,
      origin: 'framework_dimension',
      dimension: 'eu:mechanism_transfer',
      lens: 'eu.transfer',
      researchable: true,
      falsifier: { text: FALSIFIER },
      corpus: 'openalex',
      slots: { term: termA, term2: termB },
      pair: pair,
      lanes: c.lanes.slice(),
    });
  });
  leaves.push({
    id: 'eu-known',
    question: 'Which of these pairs does the room already connect under other words?',
    origin: 'framework_dimension',
    dimension: 'eu:already_known',
    lens: 'eu.known',
    researchable: true,
    falsifier: { text: 'A room artifact that already states the connection.' },
    corpus: 'room',
  });
  const secs = recall.candidates.slice(0, maxLeaves).map(function (c) { return c.section_a + ' and ' + c.section_b; });
  return {
    schema: SCHEMA_QS,
    template_id: TEMPLATE_ID,
    command: COMMAND,
    stated_question: 'Which cross-domain pairs in this room share a mechanism that nobody has connected yet, and are they worth exploring?',
    scqa: {
      situation: 'The room holds ' + substrate.things.length + ' things across ' + substrate.sections.length + ' sections; ' + recall.candidates.length + ' cross-section pairs are not yet connected in the graph.',
      complication: 'Vocabulary overlap is not mechanism transfer, and the room may already hold a connection under other words.',
      question: 'Which of the recalled pairs transfer a mechanism, and is that transfer documented anywhere outside the room?',
    },
    key_line: [
      { id: 'k1', label: 'Mechanism transfer', dimension: 'eu:mechanism_transfer' },
      { id: 'k2', label: 'Already known', dimension: 'eu:already_known' },
    ],
    leaves: leaves,
    sections_spanned: Array.from(new Set(secs)),
    mode_hint: 'quick',
  };
}

// ---------------------------------------------------------------------------
// runRecall: the whole stage 01 + 02 pass for one room, read-only on room.db
// ---------------------------------------------------------------------------
function runRecall(roomDir, opts) {
  const o = opts || {};
  const resolved = path.resolve(roomDir);
  const db = navigation.openRoomDbReadOnlyForCaller(resolved);
  let substrate; let recall;
  try {
    substrate = buildSubstrate(db, Object.assign({}, o, { roomDir: resolved }));
    recall = recallCandidates(substrate, resolved, o.budgets || {}, { extraLanes: o.extraLanes });
  } finally {
    try { db.close(); } catch (_e) { /* read-only handle */ }
  }
  const tag = o.tag || runTagNow(o.now);
  const dir = writeRunFiles(resolved, tag, substrate, recall);
  const qs = questionSetFor(recall, substrate, Object.assign({}, o, { tag: tag }));
  return { ok: true, tag: tag, run_dir: dir, counts: recall.counts, pairs_truncated: recall.pairs_truncated, couplings: recall.couplings, candidates: recall.candidates, question_set: qs };
}

module.exports = {
  ID: ID,
  BUDGETS: BUDGETS,
  TEMPLATE_ID: TEMPLATE_ID,
  COMMAND: COMMAND,
  LENSES: LENSES,
  FALSIFIER: FALSIFIER,
  RUN_ROOT: RUN_ROOT,
  STAGE_A_LANES: STAGE_A_LANES,
  STATUS_TITLE: STATUS_TITLE,
  STAGES: STAGES,
  buildSubstrate: buildSubstrate,
  recallCandidates: recallCandidates,
  declaredCouplings: declaredCouplings,
  writeRunFiles: writeRunFiles,
  readCandidates: readCandidates,
  runDirFor: runDirFor,
  deriveStatus: deriveStatus,
  writeJsonl: writeJsonl,
  readJsonl: readJsonl,
  questionSetFor: questionSetFor,
  runRecall: runRecall,
  _test: { tokenize: tokenize, jaccard: jaccard, pairKey: pairKey, slotTerm: slotTerm, abstractTerm: abstractTerm, runTagNow: runTagNow, NOT_RESEARCHABLE_PAIR: NOT_RESEARCHABLE_PAIR },
};
