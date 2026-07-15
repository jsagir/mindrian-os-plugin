#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 218-03 (D-03) -- the standalone entity-extraction pipeline dispatcher.
 *
 * This is a verbatim SHAPE-CLONE of scripts/eureka-command.cjs: a process.argv
 * switch-case router (no Commander/yargs -- CLAUDE.md convention) with the verbs
 * run | start | status | report | help, a positional ROOM_DIR SUBCOMMAND, the
 * 3-line What/Why/Fix error (never a stack trace), a status.json for observable
 * detached runs, and a main(argv) that returns a numeric exit code (the testable
 * seam via module.exports = { main }).
 *
 * WHY a standalone script and NOT a /mos: command (D-03): this adds ZERO Canon
 * Part 11 CIRS surface. There is no new command, agent, pipeline, or skill to
 * govern -- build-connector-registry.cjs --check must stay green as proof no
 * surface leaked. The pipeline is a plain script the navigator (or a future
 * governed command) shells.
 *
 * WHAT it does (the vertical wiring that makes Phase 218 real):
 *   1. openRoomDb(roomDir, { allowExtension: true }) -- single-writer,
 *      open-work-close, with the Plan 218-02 D-05 busy-wait window.
 *   2. Walk the room's artifact .md files via the memory_artifact provenance map
 *      (each memory_artifact node carries props.path -> its .md file), reading the
 *      real prose off disk.
 *   3. extractEntities(text, { sourceArtifactId }) (Plan 218-02) per artifact ->
 *      bounded, typed {entities, relations, frameworkTerms} candidates, zero egress.
 *   3b. Tier-2 semantic pass (two-tier, quick-task 260714-k44 over 260714-hzx):
 *      tier-2a is the LOCAL embedding classifier (embedding-classifier.cjs) -- zero
 *      egress, delegating to the embedding-spine boundary -- which resolves the
 *      confident majority of tier-1 survivors WHAT vs WHY for free. Only the
 *      low-margin residual escalates to tier-2b (entity-classifier.cjs, unchanged),
 *      called per artifact for the escalated names ONLY. WHAT flows through step 4
 *      unchanged; WHY joins the frameworkTerms signal merged onto the source
 *      artifact inside the transaction; NOISE (a tier-2b-only verdict) drops. The
 *      whole pass runs to completion BEFORE the transaction opens, so neither tier
 *      ever holds the write lock. Every degrade is honest: no LLM means the
 *      embedding best-guess with a disclosed low-confidence count, never a silent
 *      WHAT; an unavailable encoder degrades the whole tier to the prior hzx
 *      behavior verbatim (per-artifact tier-2b when keyed, else every-survivor WHAT).
 *   4. ONE explicit D-05 BEGIN/COMMIT/ROLLBACK transaction (node:sqlite has NO
 *      .transaction() helper, RESEARCH Pitfall 3) around the whole batch:
 *      navigation.writeEntityNode per entity, navigation.writeEdge per
 *      entity->artifact DESCRIBES link and per entity->entity relation. A
 *      mid-batch error rolls back ALL of it (T-218-09).
 *   5. Phase 219-02 (D-11, REQ-5): inside the SAME transaction, a deterministic
 *      zero-LLM frontmatter METADATA pass lifts scalar frontmatter fields
 *      (methodology, created/date, status, section, confidence) onto each
 *      exact memory_artifact node as additive JSON props via the insertNode
 *      UPSERT (merge discipline: existing props + review_status never
 *      clobbered; non-scalar values skipped, never thrown on).
 *   6. AFTER commit, a route-a best-effort re-embed via the EXISTING
 *      tri-modal-index.indexNodes path (REQ-3), in its OWN try/catch that degrades
 *      to lexical-only and NEVER throws or rolls back the entity writes (T-218-10,
 *      the degrade-never-throw contract).
 *
 * Phase 219-02 seam (D-16): runExtraction(db, roomDir, sessionId, max, opts)
 * accepts an OPTIONAL opts.paths allowlist of roomDir-relative artifact paths;
 * when present only those artifacts are collected (scoped-incremental -- the
 * post-filing extraction Plan 05 invokes). Default behavior (no opts.paths) is
 * byte-identical to the 218 full-room pass.
 *
 * CANON POSTURE:
 *   - Part 8 (Graph Boundary): THIS FILE'S OWN CODE and the tier-1 extractor make
 *     ZERO network reach -- no URL, no socket, no remote call -- and the grep gate
 *     enforces it. Tier-2a (embedding-classifier.cjs) is ALSO fully local and
 *     zero-egress: it delegates to the embedding-spine boundary (generic model
 *     weights by id only, no user bytes). The ONLY remote model reach in the whole
 *     pipeline lives inside the tier-2b classifier module
 *     (lib/core/eureka/entity-classifier.cjs), which documents its own boundary: a
 *     LOCAL classification call over the Anthropic LLM transport, never the Brain
 *     surface, degrade-to-passthrough -- and now for the escalated residual only.
 *     The re-embed uses the already-vendored local paths only.
 *   - Part 9 (Memory Locality): every entity node is born review_status='proposed'
 *     via navigation.writeEntityNode; only a human confirmNode promotes it. This
 *     script writes ONLY through the navigation chokepoint -- NO raw INSERT INTO
 *     nodes/edges anywhere (the aggregator greps for this).
 *
 * CJS, node built-ins only, process.argv switch-case router. No em-dashes, no
 * emoji anywhere.
 *
 * Usage:
 *   node scripts/entity-extract.cjs ROOM_DIR SUBCOMMAND [--session <id>] [--max <n>]
 *   node scripts/entity-extract.cjs --help
 *
 * Subcommands:
 *   run       run the extraction in-process; write nodes+edges + status.json; block until done
 *   start     fire-and-return: spawn the run detached, print paths, exit 0 immediately
 *   status    print status.json as one JSON line (or {"state":"none"})
 *   report    print a one-line human summary of the last run (or a 3-line error)
 *   help      show usage
 */

const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const { openRoomDb, closeRoomDb } = require('../lib/core/room-db.cjs');
const navigation = require('../lib/core/navigation.cjs');
const { insertNode } = require('../lib/core/node-insert.cjs');
const { extractEntities } = require('../lib/core/eureka/entity-extractor.cjs');
const triModal = require('../lib/core/eureka/tri-modal-index.cjs');
// Tier-2a (quick-task 260714-k44): the LOCAL embedding WHAT-vs-WHY classifier. It
// is fully local and zero-egress (it delegates to the embedding-spine boundary),
// resolves the confident majority of candidates for free, and hands only the
// low-margin residual to tier-2b below. The dispatcher body in THIS file stays
// zero-network (grep-gated); the embedding tier adds no transport of its own.
const entityEmbedClassifier = require('../lib/core/eureka/embedding-classifier.cjs');
// Tier-2b (quick-task 260714-hzx): the semantic WHAT / WHY / NOISE classifier
// module. It is the ONLY model reach in this pipeline and documents its own
// boundary; it is now the ESCALATION-ONLY path, called per artifact for just the
// candidates tier-2a could not confidently resolve. resolveAnthropicKey gates
// whether that escalation runs at all (Part 7 reuse of the mva-classifier
// resolver, never a copy).
const entityClassifier = require('../lib/core/eureka/entity-classifier.cjs');
const { resolveAnthropicKey } = require('../lib/core/mva-classifier.cjs');
// Phase 219-02 (D-11, REQ-5): the SHIPPED zero-dep frontmatter parser (Canon
// Part 7 reuse-before-build -- never a new YAML parser). Deterministic,
// zero-LLM, zero network.
const { parseFrontmatter } = require('../lib/core/opportunity-ops.cjs');

// ---------------------------------------------------------------------------
// Path contract: everything this command writes lives under here. The subdir is
// .mindrian/entity-extract/ -- it NEVER collides with .mindrian/eureka/ (Pitfall
// 5: two independent pipelines must not share a status.json).
// ---------------------------------------------------------------------------

function reportDir(roomDir) { return path.join(roomDir, '.mindrian', 'entity-extract'); }
function statusPath(roomDir) { return path.join(reportDir(roomDir), 'status.json'); }

// ---------------------------------------------------------------------------
// Small helpers (verbatim from eureka-command.cjs).
// ---------------------------------------------------------------------------

function dirExists(p) {
  try { return fs.statSync(p).isDirectory(); } catch (_e) { return false; }
}

function fileExists(p) {
  try { return fs.statSync(p).isFile(); } catch (_e) { return false; }
}

// The 3-line What / Why / Fix error, to stderr. Never a stack trace.
function printError(what, why, fix) {
  process.stderr.write('entity-extract: ' + what + '\n');
  process.stderr.write('  Why: ' + why + '\n');
  process.stderr.write('  Fix: ' + fix + '\n');
}

function writeStatus(roomDir, obj) {
  fs.mkdirSync(reportDir(roomDir), { recursive: true });
  fs.writeFileSync(statusPath(roomDir), JSON.stringify(obj) + '\n', 'utf8');
}

const USAGE = [
  'entity-extract -- tier-1 entity extraction over a room, writing proposed',
  'company/technology/market nodes + typed edges through navigation.',
  '',
  'Usage:',
  '  node scripts/entity-extract.cjs ROOM_DIR SUBCOMMAND [--session <id>] [--max <n>]',
  '',
  'Subcommands:',
  '  run       run the extraction in-process; write nodes+edges + status.json; block until done',
  '  start     fire-and-return: spawn the run detached, print paths, exit 0 immediately',
  '  status    print status.json as one JSON line (or {"state":"none"})',
  '  report    print a one-line human summary of the last run (or a 3-line error)',
  '  help      show this usage',
  '',
  'Flags:',
  '  --session <id>  the session id every extracted node is minted under (default entity-extract)',
  '  --max <n>       maxPerArtifact extraction cap forwarded to the extractor (default 25)',
].join('\n');

// ---------------------------------------------------------------------------
// argv parse: ROOM_DIR SUBCOMMAND [flags].
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const out = { roomDir: null, sub: null, session: 'entity-extract', max: 25, sessionProvided: false, maxProvided: false, help: false };
  const positional = [];
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    switch (a) {
      case '-h':
      case '--help': out.help = true; break;
      case '--session': out.session = String(argv[i += 1] || ''); out.sessionProvided = true; break;
      case '--max': out.max = parseInt(argv[i += 1], 10); out.maxProvided = true; break;
      default: positional.push(a); break;
    }
  }
  if (!out.session) out.session = 'entity-extract';
  if (!Number.isFinite(out.max) || out.max <= 0) out.max = 25;
  out.roomDir = positional[0] || null;
  out.sub = (positional[1] || '').toLowerCase();
  return out;
}

// ---------------------------------------------------------------------------
// The extraction core: walk artifacts, extract, batch-write through navigation.
// Returns { artifacts, entitiesWritten, edgesWritten, embedded }.
// ---------------------------------------------------------------------------

// Collect the room's artifact prose. Two tiers (T-218-VD-4, live-verified
// against the corepower-isolation room):
//
// (a) memory_artifact-backed files (kind in ROOM/STATE/MINTO/BRAIN/FEYNMAN/
//     USER/DRIFT -- the closed vocabulary memory-artifacts.cjs's
//     MEMORY_KIND_SET enforces). Each carries props.path; read the real file
//     off disk, keyed by its OWN memory_artifact node id (exact per-file
//     provenance) -- the original behavior, unchanged.
//
// (b) every OTHER .md file in a section directory. Live-verified gap: a
//     room's actual named analysis documents (e.g.
//     "mv-mft-competitive-landscape.md", "reverse-salient-analysis.md") are
//     NOT memory_artifact-kinded -- the closed MEMORY_KIND_SET this module
//     does not own cannot register a new kind per filename, and inventing a
//     synthetic node id nothing else points at would break REQ-1's "edge
//     back to its memory_artifact" contract. Instead, these files' entities
//     link back to their SECTION's existing memory_artifact:<section>:ROOM
//     node (preferring the ROOM kind, falling back to whatever memory_artifact
//     exists for that section, then the room root). Coarser provenance
//     (section-level, not exact-file-level) but always a REAL, already-
//     materialized DESCRIBES target -- a section with no anchor at all is
//     skipped, never given an invented one.
//
// Phase 219-02 additions (both ADDITIVE -- a two-arg call is byte-identical):
//   - allowPaths (optional array of roomDir-relative paths): the D-16
//     scoped-incremental seam. When present, ONLY artifacts whose path is in
//     the allowlist are collected, so filing one explore-chain artifact never
//     triggers a full-room re-extract.
//   - each artifact entry now also carries { relPath, exact }: exact=true when
//     the entry's artifactId IS the memory_artifact node of that very file
//     (tier a); exact=false for the tier-b section-anchor fallback. The
//     metadata pass writes ONLY to exact nodes (a section anchor represents a
//     DIFFERENT file; writing another file's frontmatter onto it would lie).
function collectArtifacts(db, roomDir, allowPaths) {
  const allowSet = (Array.isArray(allowPaths) && allowPaths.length > 0)
    ? new Set(allowPaths.map(function (p) { return path.normalize(String(p)); }))
    : null;
  const isAllowed = function (rel) {
    return allowSet === null || allowSet.has(path.normalize(rel));
  };

  const rows = db.prepare("SELECT id, properties FROM nodes WHERE type = 'memory_artifact'").all();
  const artifacts = [];
  const coveredPaths = new Set();  // roomDir-relative paths already read via memory_artifact
  const sectionAnchor = new Map(); // section name ("_root" included) -> a valid memory_artifact node id

  for (const row of rows) {
    let props = {};
    try { props = JSON.parse(row.properties || '{}'); } catch (_e) { props = {}; }
    const rel = props && typeof props.path === 'string' ? props.path : null;
    if (rel) {
      if (isAllowed(rel)) {
        const abs = path.join(roomDir, rel);
        let text = null;
        try { text = fs.readFileSync(abs, 'utf8'); } catch (_e) { text = null; }
        if (text) {
          artifacts.push({ artifactId: row.id, text: text, relPath: rel, exact: true });
          coveredPaths.add(path.normalize(rel));
        }
      } else {
        // Scoped run only: mark the filtered-out memory_artifact-backed path
        // covered so tier (b) never re-reads it under a section anchor. On the
        // default path (no allowlist) this branch is unreachable, so the
        // default collection stays byte-identical to the 218 behavior.
        coveredPaths.add(path.normalize(rel));
      }
    }
    const section = props && typeof props.section === 'string' ? props.section : null;
    if (section) {
      const isRoomKind = props && props.kind === 'ROOM';
      if (isRoomKind || !sectionAnchor.has(section)) sectionAnchor.set(section, row.id);
    }
  }

  let sectionDirs = [];
  try {
    sectionDirs = fs.readdirSync(roomDir, { withFileTypes: true })
      .filter(function (d) { return d.isDirectory() && d.name.charAt(0) !== '.'; })
      .map(function (d) { return d.name; });
  } catch (_e) { sectionDirs = []; }

  for (const section of sectionDirs) {
    const anchor = sectionAnchor.get(section) || sectionAnchor.get('_root');
    if (!anchor) continue; // no valid DESCRIBES target for this section -- skip, never invent one
    let files = [];
    try { files = fs.readdirSync(path.join(roomDir, section)); } catch (_e) { files = []; }
    for (const fname of files) {
      if (!/\.md$/i.test(fname)) continue;
      const rel = path.join(section, fname);
      if (coveredPaths.has(path.normalize(rel))) continue;
      if (!isAllowed(rel)) continue;
      const abs = path.join(roomDir, rel);
      let text = null;
      try { text = fs.readFileSync(abs, 'utf8'); } catch (_e) { text = null; }
      if (!text) continue;
      artifacts.push({ artifactId: anchor, text: text, relPath: rel, exact: false });
      coveredPaths.add(path.normalize(rel));
    }
  }

  return artifacts;
}

// Phase 219-02 (D-11): the frontmatter keys the metadata pass lifts onto the
// artifact node as ADDITIVE JSON props. Values are JSON scalars ONLY
// (string/number/boolean); lists/objects/null are skipped (the frontmatter-
// injection threat T-219-05: a non-scalar never lands, a serialize failure
// skips the artifact with a counted warning, never a throw).
const METADATA_FM_KEYS = ['methodology', 'created', 'date', 'status', 'section', 'confidence'];

// applyArtifactMetadata(db, art) -- the per-artifact metadata merge, called
// INSIDE the D-05 batch transaction. Read the node's current props, merge the
// scalar frontmatter keys, write back through the shared insertNode UPSERT
// (ON CONFLICT updates type+properties only -- review_status and the
// provenance columns are NEVER touched). The structural `section` prop is
// scaffold-owned: it is only filled when absent, never overwritten by a
// conflicting frontmatter value (it anchors tier-b collection and ICM
// placement). All other metadata keys refresh on every run (metadata-owned).
// Returns 'applied' | 'skipped' | 'none'. NEVER throws.
function applyArtifactMetadata(db, art) {
  try {
    let fm = null;
    try { fm = parseFrontmatter(art.text); } catch (_e) { return 'skipped'; }
    if (!fm || typeof fm !== 'object') return 'none';

    const row = db.prepare('SELECT id, type, properties FROM nodes WHERE id = ?').get(art.artifactId);
    if (!row) return 'none';
    let props = {};
    try { props = JSON.parse(row.properties || '{}'); } catch (_e) { props = {}; }
    if (!props || typeof props !== 'object' || Array.isArray(props)) props = {};

    let changed = false;
    for (const key of METADATA_FM_KEYS) {
      const v = fm[key];
      const isScalar = (typeof v === 'string' && v.length > 0)
        || typeof v === 'number' || typeof v === 'boolean';
      if (!isScalar) continue;
      if (key === 'section' && typeof props.section === 'string' && props.section.length > 0) {
        continue; // structural section wins; never clobbered by frontmatter
      }
      if (props[key] !== v) {
        props[key] = v;
        changed = true;
      }
    }
    if (!changed) return 'none';

    let propsJson;
    try { propsJson = JSON.stringify(props); } catch (_e) { return 'skipped'; }
    // The node already exists (we just SELECTed it), so this UPSERT takes the
    // ON CONFLICT branch: properties refresh, review_status + provenance
    // columns stay exactly as they were (merge discipline, assumption A5).
    insertNode(db, row.id, row.type, propsJson);
    return 'applied';
  } catch (_e) {
    return 'skipped'; // defensive: one bad artifact never kills the batch
  }
}

// Tier-2 (quick-task 260714-hzx): the number of framework (WHY) terms merged onto
// any single artifact node is bounded (the T-219-05 scalar-only discipline).
const FRAMEWORK_TERM_CAP = 25;

// artifactExcerpt(text) -- the first ~10 non-empty prose lines of an artifact,
// capped at 600 chars, passed to the classifier module for domain context. Skips
// headings and fence markers so the excerpt is representative prose, never a wall
// of scaffolding. Pure, never throws.
function artifactExcerpt(text) {
  try {
    const lines = String(text || '').split(/\r?\n/);
    const picked = [];
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      if (line.charAt(0) === '#') continue;   // heading
      if (/^```/.test(line)) continue;         // fence marker
      picked.push(line);
      if (picked.length >= 10) break;
    }
    return picked.join(' ').slice(0, 600);
  } catch (_e) {
    return '';
  }
}

// fallbackLabels(names) -- the pass-through label map: every candidate 'what'.
function fallbackLabels(names) {
  const labels = {};
  for (const n of names) labels[n] = 'what';
  return labels;
}

// routeLabel(e, label, whatEntities, whyTerms, lowConfidence) -- apply one resolved
// label to one entity: WHAT keeps the entity flowing (byte-identical write path), WHY
// joins the framework-term signal on its source artifact, NOISE drops. Returns the
// applied label so the caller can tally the NOISE drops. The optional lowConfidence
// flag (quick 260715-cu8) rides a WHY term through to its artifact node so a term that
// landed via the no-LLM embedding best-guess is disclosed per-term, not just in the
// aggregate status.json counter. All existing call sites stay unflagged (confident);
// only the runTier2 no-LLM escalation branch passes it true.
function routeLabel(e, label, whatEntities, whyTerms, lowConfidence) {
  if (label === 'why') {
    const entry = { name: e.name, sourceArtifactId: e.sourceArtifactId };
    if (lowConfidence === true) entry.lowConfidence = true;
    whyTerms.push(entry);
  } else if (label === 'noise') {
    return 'noise';
  } else {
    whatEntities.push(e);
  }
  return label;
}

// runDegradeHzx(...) -- the verbatim prior (quick-task 260714-hzx) per-artifact
// pass, used ONLY when tier-2a (the embedding tier) is unavailable (ok:false).
// Groups every survivor by artifact and asks tier-2b for all of that artifact's
// candidates when keyed, else the every-name-WHAT fallback. classifier_source
// stays model/fallback/mixed exactly as before this quick task. This preserves
// "an unavailable encoder means the prior behavior verbatim".
async function runDegradeHzx(textById, byArtifact, tier1WhyTerms, classifyImpl, keyPresent) {
  const whatEntities = [];
  const whyTerms = tier1WhyTerms.slice();
  let droppedNoise = 0;
  let usedModel = false;
  let usedFallback = false;

  for (const [artifactId, arr] of byArtifact) {
    const names = arr.map(function (e) { return e.name; });
    let result;
    if (!keyPresent) {
      result = { labels: fallbackLabels(names), source: 'fallback' };
    } else {
      const excerpt = artifactExcerpt(textById.get(artifactId) || '');
      try {
        result = await classifyImpl({ names: names, excerpt: excerpt });
      } catch (_e) {
        result = { labels: fallbackLabels(names), source: 'fallback' };
      }
      if (!result || typeof result !== 'object' || !result.labels || typeof result.labels !== 'object') {
        result = { labels: fallbackLabels(names), source: 'fallback' };
      }
    }
    if (result.source === 'model') usedModel = true;
    else usedFallback = true;

    for (const e of arr) {
      const raw = result.labels[e.name];
      const label = (raw === 'why' || raw === 'noise') ? raw : 'what';
      if (routeLabel(e, label, whatEntities, whyTerms) === 'noise') droppedNoise += 1;
    }
  }

  let classifierSource;
  if (usedModel && usedFallback) classifierSource = 'mixed';
  else if (usedModel) classifierSource = 'model';
  else classifierSource = 'fallback';

  return {
    whatEntities: whatEntities,
    whyTerms: whyTerms,
    droppedNoise: droppedNoise,
    classifierSource: classifierSource,
    embeddingResolved: 0,
    escalated: 0,
    modelResolved: usedModel ? whatEntities.length + (whyTerms.length - tier1WhyTerms.length) + droppedNoise : 0,
    lowConfidence: 0,
  };
}

// runTier2(artifacts, entities, tier1WhyTerms, classifyImpl, embedClassifyImpl,
//   keyPresent) -- the LOCKED two-tier semantic pass. Tier-2a (the embedding
// classifier) runs first over ALL unique survivor names in ONE call; confident
// candidates resolve for free. Only the low-margin residual escalates to tier-2b
// (the LLM classifier), grouped per artifact, escalated names ONLY. Every model
// call completes here, BEFORE the caller opens the D-05 transaction, so neither
// tier holds the write lock. Returns
//   { whatEntities, whyTerms, droppedNoise, classifierSource,
//     embeddingResolved, escalated, modelResolved, lowConfidence }.
async function runTier2(artifacts, entities, tier1WhyTerms, classifyImpl, embedClassifyImpl, keyPresent) {
  const textById = new Map();
  for (const art of artifacts) textById.set(art.artifactId, art.text);

  const byArtifact = new Map(); // artifactId -> [entity]
  for (const e of entities) {
    if (!byArtifact.has(e.sourceArtifactId)) byArtifact.set(e.sourceArtifactId, []);
    byArtifact.get(e.sourceArtifactId).push(e);
  }

  // Tier-2a: ONE embedding call over the unique candidate names (the module
  // batches the embedding internally). A dedup keeps the reference-vs-candidate
  // scoring bounded regardless of how many artifacts share a name.
  const uniqueNames = Array.from(new Set(entities.map(function (e) { return e.name; })));
  let embed = null;
  try {
    embed = await embedClassifyImpl({ names: uniqueNames });
  } catch (_e) {
    embed = { ok: false, error: 'embed_failed' };
  }

  // Tier-2a unavailable -> the ENTIRE tier degrades to the prior hzx behavior.
  if (!embed || embed.ok !== true || !embed.results || typeof embed.results !== 'object') {
    return runDegradeHzx(textById, byArtifact, tier1WhyTerms, classifyImpl, keyPresent);
  }

  const whatEntities = [];
  const whyTerms = tier1WhyTerms.slice(); // tier-1 structural WHY seed (zero model cost)
  let droppedNoise = 0;
  let embeddingResolved = 0;
  let escalated = 0;
  let modelResolved = 0;
  let lowConfidence = 0;

  // Partition: confident embedding results resolve now; unconfident ones (or a
  // missing result) collect into the per-artifact escalation set, carrying their
  // embedding best-guess label as the no-LLM / failed-LLM fallback.
  const escByArtifact = new Map(); // artifactId -> [{ e, bestGuess }]
  for (const e of entities) {
    const er = embed.results[e.name];
    if (er && er.confident === true && (er.label === 'what' || er.label === 'why')) {
      routeLabel(e, er.label, whatEntities, whyTerms);
      embeddingResolved += 1;
    } else {
      const bestGuess = (er && (er.label === 'what' || er.label === 'why')) ? er.label : 'what';
      if (!escByArtifact.has(e.sourceArtifactId)) escByArtifact.set(e.sourceArtifactId, []);
      escByArtifact.get(e.sourceArtifactId).push({ e: e, bestGuess: bestGuess });
      escalated += 1;
    }
  }

  // Tier-2b escalation: per artifact, the escalated names ONLY.
  for (const [artifactId, items] of escByArtifact) {
    const escNames = items.map(function (it) { return it.e.name; });
    let modelLabels = null;
    if (keyPresent) {
      const excerpt = artifactExcerpt(textById.get(artifactId) || '');
      let result;
      try {
        result = await classifyImpl({ names: escNames, excerpt: excerpt });
      } catch (_e) {
        result = null;
      }
      // Accept model labels only when the call succeeded with source 'model';
      // a throw, a bad shape, or a fallback source routes THIS artifact's
      // escalated candidates to the embedding best-guess (disclosed low-confidence).
      if (result && typeof result === 'object' && result.labels
          && typeof result.labels === 'object' && result.source === 'model') {
        modelLabels = result.labels;
      }
    }

    for (const it of items) {
      if (modelLabels) {
        const raw = modelLabels[it.e.name];
        const label = (raw === 'why' || raw === 'noise' || raw === 'what') ? raw : it.bestGuess;
        if (routeLabel(it.e, label, whatEntities, whyTerms) === 'noise') droppedNoise += 1;
        modelResolved += 1;
      } else {
        // No LLM (no key, or the escalation failed): the embedding best-guess
        // stands, counted as low-confidence -- NEVER a silent WHAT default. The
        // lowConfidence flag threads the disclosure per-term to the artifact node
        // (quick 260715-cu8), not just into the aggregate lowConfidence counter.
        routeLabel(it.e, it.bestGuess, whatEntities, whyTerms, true);
        lowConfidence += 1;
      }
    }
  }

  // classifier_source honesty (K44-REQ-3): which tier actually resolved candidates.
  const resolvedByEmbedding = embeddingResolved > 0 || lowConfidence > 0;
  const resolvedByModel = modelResolved > 0;
  let classifierSource;
  if (resolvedByModel && resolvedByEmbedding) classifierSource = 'mixed';
  else if (resolvedByModel) classifierSource = 'model';
  else if (resolvedByEmbedding) classifierSource = 'embedding';
  else classifierSource = 'fallback'; // nothing resolved semantically (no candidates)

  return {
    whatEntities: whatEntities,
    whyTerms: whyTerms,
    droppedNoise: droppedNoise,
    classifierSource: classifierSource,
    embeddingResolved: embeddingResolved,
    escalated: escalated,
    modelResolved: modelResolved,
    lowConfidence: lowConfidence,
  };
}

// applyFrameworkTerms(db, artifactId, terms) -- the WHY-signal merge, called
// INSIDE the D-05 transaction alongside the metadata pass. Mirrors
// applyArtifactMetadata EXACTLY: SELECT the node, parse props, union the new
// framework terms with any existing props.framework_terms (comma-split), and write
// back SCALAR PROPS ONLY via the shared insertNode UPSERT: framework_terms
// (comma-joined, capped), framework_term_count (number), and -- additively, quick
// 260715-cu8 -- framework_terms_low_confidence (comma-joined subset naming the terms
// that landed via the no-LLM embedding best-guess degrade). `terms` is an array of
// { name, lowConfidence } entries (a bare string is tolerated and treated confident).
// Scalars only (T-219-05); never a new node type, never an edge; review_status and
// provenance are never touched. Returns 'applied' | 'skipped' | 'none'. NEVER throws.
//
// Reader-audit finding (planning_findings item 3, quick 260715-cu8): framework_terms
// has NO production readers outside this pipeline. A grep (node_modules + .planning
// excluded) shows the ONLY writer is this file and the ONLY readers are
// tests/test-218-what-why-classifier.cjs and tests/test-218-extend-to-artifacts.cjs,
// both via substring indexOf checks on the comma-joined string. framework_terms stays
// a plain comma-joined scalar (byte-compatible for those substring readers); the new
// framework_terms_low_confidence is a purely additive sibling scalar that cannot break
// any existing reader.
function applyFrameworkTerms(db, artifactId, terms) {
  try {
    const row = db.prepare('SELECT id, type, properties FROM nodes WHERE id = ?').get(artifactId);
    if (!row) return 'none';
    let props = {};
    try { props = JSON.parse(row.properties || '{}'); } catch (_e) { props = {}; }
    if (!props || typeof props !== 'object' || Array.isArray(props)) props = {};

    // Normalize the incoming WHY terms. Preserve order for first-seen casing;
    // split into the incoming name list, the low-confidence names, and the set of
    // names that arrived CONFIDENT this call (a bare string counts as confident).
    const incomingNames = [];
    const incomingLowConf = [];
    const incomingConfidentKeys = new Set();
    for (const t of terms) {
      let name, low;
      if (typeof t === 'string') { name = t; low = false; }
      else if (t && typeof t === 'object') { name = t.name; low = t.lowConfidence === true; }
      else { continue; }
      if (typeof name !== 'string' || name.length === 0) continue;
      incomingNames.push(name);
      if (low) incomingLowConf.push(name);
      else incomingConfidentKeys.add(name.toLowerCase());
    }

    const existing = (typeof props.framework_terms === 'string' && props.framework_terms.length > 0)
      ? props.framework_terms.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      : [];

    // Union existing + new, case-insensitive dedup, first-seen casing wins, capped.
    const seen = new Set();
    const merged = [];
    for (const t of existing.concat(incomingNames)) {
      if (typeof t !== 'string' || t.length === 0) continue;
      const k = t.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(t);
      if (merged.length >= FRAMEWORK_TERM_CAP) break;
    }
    if (merged.length === 0) return 'none';

    props.framework_terms = merged.join(', ');
    props.framework_term_count = merged.length;

    // Sibling scalar prop maintenance (quick 260715-cu8): union the prior low-conf
    // names with this call's low-conf names, DROP any that arrived confident this
    // call (upgrade wins), prune to the merged framework_terms set (subset
    // invariant), dedup case-insensitively, cap. Write when non-empty; DELETE when
    // empty (never an empty string). Same scalar-only merge discipline as above.
    const existingLow = (typeof props.framework_terms_low_confidence === 'string' && props.framework_terms_low_confidence.length > 0)
      ? props.framework_terms_low_confidence.split(',').map(function (s) { return s.trim(); }).filter(Boolean)
      : [];
    const mergedKeys = new Set(merged.map(function (m) { return m.toLowerCase(); }));
    const lowSeen = new Set();
    const lowMerged = [];
    for (const t of existingLow.concat(incomingLowConf)) {
      if (typeof t !== 'string' || t.length === 0) continue;
      const k = t.toLowerCase();
      if (lowSeen.has(k)) continue;               // case-insensitive dedup, first-seen casing
      if (incomingConfidentKeys.has(k)) continue; // confident this call -> upgrade removes the marker
      if (!mergedKeys.has(k)) continue;           // subset invariant: only names present in framework_terms
      lowSeen.add(k);
      lowMerged.push(t);
      if (lowMerged.length >= FRAMEWORK_TERM_CAP) break;
    }
    if (lowMerged.length > 0) {
      props.framework_terms_low_confidence = lowMerged.join(', ');
    } else {
      delete props.framework_terms_low_confidence;
    }

    let propsJson;
    try { propsJson = JSON.stringify(props); } catch (_e) { return 'skipped'; }
    // The node already exists (just SELECTed), so this UPSERT takes the ON
    // CONFLICT branch: properties refresh, review_status + provenance untouched.
    insertNode(db, row.id, row.type, propsJson);
    return 'applied';
  } catch (_e) {
    return 'skipped';
  }
}

async function runExtraction(db, roomDir, sessionId, maxPerArtifact, opts) {
  const options = opts || {};
  // opts.paths (optional, ADDITIVE): the D-16 scoped-incremental allowlist.
  // Absent -> full-room collection, byte-identical to the 218 behavior.
  const artifacts = collectArtifacts(db, roomDir, options.paths);

  // Aggregate all candidates first (pure, no writes yet). Tier-1 now also yields
  // a structural WHY seed (frameworkTerms) at zero model cost -- these never go to
  // the model, they are already known framework vocabulary.
  const rawEntities = [];   // { entityType, name, sourceArtifactId }
  const relations = [];     // { source, target, edge_type }
  const tier1WhyTerms = []; // { name, sourceArtifactId }
  for (const art of artifacts) {
    const res = extractEntities(art.text, { sourceArtifactId: art.artifactId, maxPerArtifact: maxPerArtifact });
    for (const e of res.entities) rawEntities.push(e);
    for (const r of res.relations) relations.push(r);
    if (Array.isArray(res.frameworkTerms)) {
      for (const t of res.frameworkTerms) tier1WhyTerms.push(t);
    }
  }

  // Tier-2 (two-tier, quick-task 260714-k44): the semantic pass runs AFTER
  // aggregation and strictly BEFORE db.exec('BEGIN'). Tier-2a (the embedding
  // classifier) resolves the confident majority for free; only the low-margin
  // residual escalates to tier-2b (the LLM classifier). Two additive seams mirror
  // the classifyImpl idiom:
  //   opts.embedClassifyImpl - the tier-2a surrogate (defaults to the real
  //     classifyByEmbedding); a test injects deterministic embedding verdicts.
  //   opts.classifyImpl      - the tier-2b surrogate (defaults to the real
  //     classifyArtifactCandidates); injecting it bypasses the key gate.
  //   opts._forceNoLlm       - test-only: forces keyPresent false so the honest
  //     no-LLM degrade leg is deterministic regardless of the machine key state.
  const classifyInjected = typeof options.classifyImpl === 'function';
  const classifyImpl = classifyInjected
    ? options.classifyImpl
    : entityClassifier.classifyArtifactCandidates;
  const embedInjected = typeof options.embedClassifyImpl === 'function';
  const embedClassifyImpl = embedInjected
    ? options.embedClassifyImpl
    : entityEmbedClassifier.classifyByEmbedding;
  const forceNoLlm = options._forceNoLlm === true;
  const keyPresent = forceNoLlm
    ? false
    : (classifyInjected ? true : (resolveAnthropicKey() !== null));

  const tier2 = await runTier2(artifacts, rawEntities, tier1WhyTerms, classifyImpl, embedClassifyImpl, keyPresent);
  const entities = tier2.whatEntities;

  // Relation filter: an edge endpoint node exists only for a surviving WHAT name.
  // Drop any relation whose source or target was rerouted to WHY or dropped.
  const whatNames = new Set(entities.map(function (e) { return e.name; }));
  const survivingRelations = relations.filter(function (r) {
    return whatNames.has(r.source) && whatNames.has(r.target);
  });

  // Aggregate the WHY terms per artifact for the in-transaction merge. Each entry
  // carries { name, lowConfidence } (quick 260715-cu8) so applyFrameworkTerms can
  // maintain the per-term disclosure sibling prop; a bare confident term reduces to
  // lowConfidence:false.
  const whyByArtifact = new Map(); // artifactId -> [{ name, lowConfidence }]
  for (const t of tier2.whyTerms) {
    if (!whyByArtifact.has(t.sourceArtifactId)) whyByArtifact.set(t.sourceArtifactId, []);
    whyByArtifact.get(t.sourceArtifactId).push({ name: t.name, lowConfidence: t.lowConfidence === true });
  }

  let entitiesWritten = 0;
  let edgesWritten = 0;
  let metadataApplied = 0;
  let metadataSkipped = 0;
  let frameworkApplied = 0;
  let frameworkSkipped = 0;

  // D-05 batch: ONE explicit transaction around the whole node+edge batch.
  // node:sqlite has NO .transaction() helper (Pitfall 3) -- BEGIN/COMMIT/ROLLBACK
  // via db.exec. A mid-batch error rolls back ALL of it (T-218-09).
  db.exec('BEGIN');
  try {
    // 1. Entity nodes -- born review_status='proposed' via the chokepoint.
    for (const e of entities) {
      const r = navigation.writeEntityNode(db, {
        entityType: e.entityType,
        name: e.name,
        sessionId: sessionId,
      });
      if (r && r.ok) entitiesWritten += 1;
    }
    // 2. entity -> artifact DESCRIBES links (provenance). Direction source=entity
    //    target=memory_artifact. Routed through navigation.writeEdge (never raw
    //    SQL). The target is a real memory_artifact node (collectArtifacts).
    for (const e of entities) {
      const entityId = navigation.ENTITY_NODE_ID(sessionId, e.name);
      const r = navigation.writeEdge(db, {
        source_id: entityId,
        target_id: e.sourceArtifactId,
        edge_type: 'DESCRIBES',
        properties: { relation: 'describes', entity_node: entityId },
      });
      if (r && r.ok) edgesWritten += 1;
    }
    // 3. entity -> entity domain-relationship edges. The extractor names the
    //    endpoints; ENTITY_NODE_ID resolves each name to the same node id
    //    writeEntityNode minted under this sessionId. Only relations whose BOTH
    //    endpoints survived tier-2 as WHAT are written (a WHY/NOISE endpoint has
    //    no entity node to point at).
    for (const rel of survivingRelations) {
      const srcId = navigation.ENTITY_NODE_ID(sessionId, rel.source);
      const tgtId = navigation.ENTITY_NODE_ID(sessionId, rel.target);
      const r = navigation.writeEdge(db, {
        source_id: srcId,
        target_id: tgtId,
        edge_type: rel.edge_type,
        properties: { relation: String(rel.edge_type).toLowerCase() },
      });
      if (r && r.ok) edgesWritten += 1;
    }
    // 4. Phase 219-02 (D-11, REQ-5): the frontmatter metadata pass, INSIDE the
    //    same D-05 transaction. Only EXACT artifacts (the node IS that file)
    //    receive metadata -- a tier-b section anchor stands for a different
    //    file, so writing another file's frontmatter onto it would lie.
    //    Deterministic, zero-LLM, zero network; a skip is counted, never a
    //    throw (the batch survives, T-219-05).
    for (const art of artifacts) {
      if (!art.exact) continue;
      const outcome = applyArtifactMetadata(db, art);
      if (outcome === 'applied') metadataApplied += 1;
      else if (outcome === 'skipped') metadataSkipped += 1;
    }
    // 5. Tier-2 (quick-task 260714-hzx): the framework-term (WHY) merge, INSIDE
    //    the same D-05 transaction. Two scalar props only (framework_terms +
    //    framework_term_count); never a new node type, never an edge. A per-
    //    artifact failure is counted and skipped, never thrown (the batch
    //    survives). Merges onto the WHY term's source artifact node regardless of
    //    exact/anchor -- the term names framework vocabulary observed in that
    //    file's prose, attributed to its provenance artifact.
    for (const [artifactId, terms] of whyByArtifact) {
      const outcome = applyFrameworkTerms(db, artifactId, terms);
      if (outcome === 'applied') frameworkApplied += 1;
      else if (outcome === 'skipped') frameworkSkipped += 1;
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  // Route-a best-effort re-embed (REQ-3, Open Q2). AFTER commit, in its OWN
  // try/catch: a slow/absent encoder degrades to lexical-only and must NEVER
  // throw or roll back the entity writes (T-218-10). indexNodes is idempotent
  // (per-node DELETE-then-INSERT), so re-running is safe.
  let embedded = false;
  // Tier-2 additive result fields (entitiesWhat / termsWhy / droppedNoise /
  // classifierSource) ride both the success and the degrade branch identically.
  const tier2Result = {
    entitiesWhat: entities.length,
    termsWhy: tier2.whyTerms.length,
    droppedNoise: tier2.droppedNoise,
    classifierSource: tier2.classifierSource,
    frameworkApplied: frameworkApplied,
    frameworkSkipped: frameworkSkipped,
    // Two-tier (quick-task 260714-k44) additive per-tier counts: how many
    // candidates each tier resolved, how many escalated, and how many landed on a
    // disclosed low-confidence embedding best-guess (never a silent WHAT).
    tier2Embedding: tier2.embeddingResolved,
    tier2Escalated: tier2.escalated,
    tier2Model: tier2.modelResolved,
    tier2LowConfidence: tier2.lowConfidence,
  };
  return triModal.indexNodes(db, { roomDir: roomDir })
    .then(function (idx) {
      embedded = !!(idx && idx.embedded);
      return Object.assign({
        artifacts: artifacts.length,
        entitiesWritten: entitiesWritten,
        edgesWritten: edgesWritten,
        embedded: embedded,
        metadataApplied: metadataApplied,
        metadataSkipped: metadataSkipped,
      }, tier2Result);
    })
    .catch(function () {
      // Degrade-never-throw: the entity writes are already committed.
      return Object.assign({
        artifacts: artifacts.length,
        entitiesWritten: entitiesWritten,
        edgesWritten: edgesWritten,
        embedded: false,
        metadataApplied: metadataApplied,
        metadataSkipped: metadataSkipped,
      }, tier2Result);
    });
}

// ---------------------------------------------------------------------------
// Subcommands.
// ---------------------------------------------------------------------------

async function cmdRun(opts) {
  const roomDir = opts.roomDir;
  if (!dirExists(roomDir)) {
    printError('room directory not found', String(roomDir) + ' is not a directory', 'pass a valid room path, or run /mos:new-project');
    return 1;
  }

  const startedAt = new Date().toISOString();
  writeStatus(roomDir, { state: 'running', started_at: startedAt, pid: process.pid });

  let db = null;
  try {
    db = openRoomDb(roomDir, { allowExtension: true });
    const result = await runExtraction(db, roomDir, opts.session, opts.max);
    writeStatus(roomDir, {
      state: 'done',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      pid: process.pid,
      artifacts: result.artifacts,
      entities: result.entitiesWritten,
      edges: result.edgesWritten,
      embedded: result.embedded,
      metadata_applied: result.metadataApplied,
      metadata_skipped: result.metadataSkipped,
      // Tier-2 (quick-task 260714-hzx) additive observability keys.
      entities_what: result.entitiesWhat,
      terms_why: result.termsWhy,
      dropped_noise: result.droppedNoise,
      classifier_source: result.classifierSource,
      framework_applied: result.frameworkApplied,
      framework_skipped: result.frameworkSkipped,
      // Two-tier (quick-task 260714-k44) additive per-tier observability keys.
      tier2_embedding: result.tier2Embedding,
      tier2_escalated: result.tier2Escalated,
      tier2_model: result.tier2Model,
      tier2_low_confidence: result.tier2LowConfidence,
      session: opts.session,
    });
    return 0;
  } catch (err) {
    const msg = String(err && err.message ? err.message : err).split('\n')[0];
    writeStatus(roomDir, {
      state: 'failed',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      pid: process.pid,
      error: msg,
    });
    printError('entity extraction failed', msg, 'inspect ' + statusPath(roomDir) + ' then re-run entity-extract');
    return 1;
  } finally {
    if (db) { try { closeRoomDb(db); } catch (_e) { /* already closed */ } }
  }
}

function cmdStart(opts) {
  const roomDir = opts.roomDir;
  if (!dirExists(roomDir)) {
    printError('room directory not found', String(roomDir) + ' is not a directory', 'pass a valid room path, or run /mos:new-project');
    return 1;
  }
  fs.mkdirSync(reportDir(roomDir), { recursive: true });

  const forwarded = [];
  if (opts.sessionProvided) forwarded.push('--session', String(opts.session));
  if (opts.maxProvided) forwarded.push('--max', String(opts.max));

  const child = spawn(process.execPath, [__filename, roomDir, 'run'].concat(forwarded), {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();

  process.stdout.write('entity extraction started (background)\n');
  process.stdout.write('status: ' + statusPath(roomDir) + '\n');
  return 0;
}

function cmdStatus(opts) {
  const roomDir = opts.roomDir;
  const sp = statusPath(roomDir);
  if (fileExists(sp)) {
    let parsed = null;
    try { parsed = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch (_e) { parsed = null; }
    if (parsed) {
      process.stdout.write(JSON.stringify(parsed) + '\n');
      return 0;
    }
  }
  process.stdout.write(JSON.stringify({ state: 'none' }) + '\n');
  return 0;
}

function cmdReport(opts) {
  const roomDir = opts.roomDir;
  const sp = statusPath(roomDir);
  if (!fileExists(sp)) {
    printError('no extraction run yet', 'no status.json for this room', 'run entity-extract ROOM_DIR run');
    return 1;
  }
  let parsed = null;
  try { parsed = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch (_e) { parsed = null; }
  if (!parsed) {
    printError('unreadable status', statusPath(roomDir) + ' is not valid JSON', 're-run entity-extract ROOM_DIR run');
    return 1;
  }
  if (parsed.state === 'done') {
    // Two-tier (quick-task 260714-k44): disclose the per-tier split. The
    // low-confidence count is printed explicitly when > 0 -- an embedding
    // best-guess resolution is disclosed, never dressed up as a full resolution.
    const lowConf = parsed.tier2_low_confidence || 0;
    const lowConfNote = lowConf > 0 ? ', ' + lowConf + ' low-confidence' : '';
    process.stdout.write(
      'entity-extract done: ' + (parsed.entities || 0) + ' entities, ' + (parsed.edges || 0) +
      ' edges from ' + (parsed.artifacts || 0) + ' artifacts (embedded=' + (parsed.embedded ? 'yes' : 'no') + '); ' +
      'tier-2: ' + (parsed.entities_what || 0) + ' what, ' + (parsed.terms_why || 0) + ' why, ' +
      (parsed.dropped_noise || 0) + ' noise (classifier=' + (parsed.classifier_source || 'fallback') + '); ' +
      'routing: ' + (parsed.tier2_embedding || 0) + ' embedding, ' + (parsed.tier2_escalated || 0) +
      ' escalated, ' + (parsed.tier2_model || 0) + ' model' + lowConfNote + '\n'
    );
  } else if (parsed.state === 'running') {
    process.stdout.write('entity-extract running (started ' + (parsed.started_at || '?') + ')\n');
  } else if (parsed.state === 'failed') {
    process.stdout.write('entity-extract failed: ' + (parsed.error || 'unknown error') + '\n');
  } else {
    process.stdout.write(JSON.stringify(parsed) + '\n');
  }
  return 0;
}

// ---------------------------------------------------------------------------
// main -- the testable seam. Returns a numeric exit code (async for run).
// ---------------------------------------------------------------------------

async function main(argv) {
  const opts = parseArgs(argv);

  if (opts.help || !opts.roomDir) {
    process.stdout.write(USAGE + '\n');
    return 0;
  }

  switch (opts.sub) {
    case 'run': return cmdRun(opts);
    case 'start': return cmdStart(opts);
    case 'status': return cmdStatus(opts);
    case 'report': return cmdReport(opts);
    case 'help': process.stdout.write(USAGE + '\n'); return 0;
    default:
      printError('unknown subcommand', 'no subcommand "' + opts.sub + '"', 'run one of: run | start | status | report | help');
      return 1;
  }
}

if (require.main === module) {
  main(process.argv.slice(2)).then(function (code) { process.exit(code); });
}

// runExtraction is exported ADDITIVELY (Phase 219-02) so the D-16 post-filing
// hook (and tests) can run a scoped-incremental pass over an explicit
// opts.paths allowlist against a caller-owned db handle. Tier-2 (quick-task
// 260714-hzx) adds an optional opts.classifyImpl injection seam (same additive-
// opts idiom): when present it IS the model surrogate and bypasses the key gate,
// so integration tests exercise the WHY reroute / degrade paths fully offline.
// main stays the dispatcher seam.
// collectArtifacts is exported ADDITIVELY (quick-task 260714-k44) so a read-only
// measurement harness can count tier-1 candidates and run tier-2a over a real room
// WITHOUT calling runExtraction or opening a write transaction (the K44-REQ-5
// key-less call-volume measurement). It takes a caller-owned db handle and never
// writes.
module.exports = { main: main, runExtraction: runExtraction, collectArtifacts: collectArtifacts };
