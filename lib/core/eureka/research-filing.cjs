'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 219-05 -- research-filing: the D-16 Research Corpus Contract.
 *
 * Deep-research outputs are a CORPUS, not dead markdown (D-16, navigator
 * 2026-07-13). Three legs live here:
 *
 *   fileResearchArtifact(roomDir, params)  -- D-16 item 1: file the research
 *     artifact NESTED as research/<dated-slug>/<dated-slug>.md (D-21, Decision
 *     16: the folder IS the artifact; never a loose file) with YAML
 *     frontmatter carrying date + sources (each url + accessed) + topic
 *     handles (the /mos:research provenance conventions), atomic tmp+rename
 *     write (the research-cache/scaffold idiom), directory identity ROOM.md
 *     rendered from the EXISTING room-skeleton scaffold template (never
 *     hand-minted), and the memory_artifact node registered through
 *     navigation.writeMemoryArtifactNode -- the artifact is a graph citizen
 *     at birth.
 *
 *   runPostFilingExtraction(roomDir, sessionId, artifactPaths) -- D-16 item 2:
 *     open/work/close per 218 D-05, invoke the SAME runExtraction path
 *     entity-extract.cjs uses, scoped via opts.paths to EXACTLY the new
 *     artifact paths (the Plan 02 seam -- never a full-room re-extract), then
 *     link the extracted proposed entities to the artifact node with
 *     DERIVED_FROM edges (via navigation.writeEdge) where the extractor's
 *     DESCRIBES provenance has not already carried the derivation edge. The
 *     filed research becomes graph-visible to ALL engines at filing time.
 *
 *   queryRoomCorpus(roomDir, topicHandles) -- D-16 item 3: the OFFLINE
 *     degrade. When the web leg is unavailable, the explore chain queries the
 *     room's OWN research corpus: tri-modal retrieval consumed READ-ONLY
 *     (lexicalSearch; tri-modal-index.cjs is NOT modified -- Plan 02 owns it
 *     this phase) filtered to research/ memory_artifact nodes, with a
 *     structural token-overlap fallback when the lexical leg is absent
 *     (bi-modal machines) or cold. Provenance reads EXACTLY
 *     "web: absent (room-corpus degrade)" -- never a crash, never a silent
 *     skip. The D-19 envelope (research_mode + per-provider status) composes
 *     onto the source-lens-driver seam (composeResearchMode / RESEARCH_MODES)
 *     -- one mode vocabulary, one composition rule.
 *
 * Canon Part 9: every node/edge write routes through navigation.cjs
 *   (writeMemoryArtifactNode / writeEdge / the entity-extract batch). Zero raw
 *   INSERT (the run-all-219 grep gate covers this file).
 * Canon Part 8: zero network primitives in this module. The web leg lives in
 *   the chain's host executor behind the frozen deep_research reach; this
 *   module only files, extracts, and reads LOCAL room.db.
 * 218 D-05: room.db handles are open/work/close per invocation (room-db.cjs
 *   openRoomDb with timeout:5000 + WAL), never a persistent daemon.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { openRoomDb, closeRoomDb } = require('../room-db.cjs');
const navigation = require('../navigation.cjs');
const triModal = require('./tri-modal-index.cjs');

// The exact D-16 item 3 provenance string (test-pinned; the same honest-degrade
// discipline as the vec0/FTS5 probes).
const OFFLINE_PROVENANCE = 'web: absent (room-corpus degrade)';

// The room-skeleton identity template home (Canon decision 15: every directory
// carries ROOM.md; the scaffold owns the format -- reuse, never hand-mint).
const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', '..', 'templates', 'room-skeleton');

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

// The research-cache slugify port (one slug dialect across the phase).
function slugify(text) {
  const s = String(text == null ? '' : text).toLowerCase();
  return s.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// D-19 seam: lazy-require the driver so this module composes onto the ONE
// research_mode vocabulary + composition rule (source-lens-driver.cjs,
// Task 1). A require fault degrades to a local mirror of the same enum logic
// (defensive only; the driver is a plugin-local CJS file).
function driverSeam() {
  try {
    // eslint-disable-next-line global-require
    const drv = require('../../lens-engine/source-lens-driver.cjs');
    if (drv && typeof drv.composeResearchMode === 'function') return drv;
  } catch (_e) { /* fall through to the defensive mirror */ }
  return {
    RESEARCH_MODES: Object.freeze(['normal', 'web_degraded_local_fallback', 'local_only', 'insufficient_evidence']),
    composeResearchMode: function (providers, opts) {
      const list = Array.isArray(providers) ? providers : [];
      let items = 0; let anyError = false;
      for (const p of list) {
        if (!isPlainObject(p)) continue;
        items += (p.counts && typeof p.counts.items === 'number') ? p.counts.items : 0;
        if (p.status === 'error') anyError = true;
      }
      if (items === 0) return 'insufficient_evidence';
      if (isPlainObject(opts) && opts.localOnly === true) return 'local_only';
      if (anyError) return 'web_degraded_local_fallback';
      return 'normal';
    },
  };
}

// Atomic write (tmp in the SAME dir -> rename; the research-cache / scaffold
// idiom). A concurrent reader sees old-or-complete, never a partial.
function atomicWrite(filePath, content) {
  const suffix = process.pid + '.' + crypto.randomBytes(6).toString('hex');
  const tmpPath = filePath + '.tmp.' + suffix;
  fs.writeFileSync(tmpPath, content, 'utf8');
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch (_e) { /* best-effort */ }
    throw err;
  }
}

// Directory identity via the EXISTING scaffold generator surface: the shipped
// ROOM.md.identity.tmpl rendered through room-skeleton-scaffold.renderTemplate
// (D-21: identity files come from the room scaffolding, never hand-minted).
// Idempotent: an existing ROOM.md is never overwritten. Best-effort: a missing
// template is recorded, never a throw (the artifact filing itself is the
// load-bearing act).
function ensureDirIdentity(dirAbs, directoryType, purpose) {
  try {
    const roomMd = path.join(dirAbs, 'ROOM.md');
    if (fs.existsSync(roomMd)) return { ok: true, created: false };
    const tplPath = path.join(TEMPLATES_DIR, 'ROOM.md.identity.tmpl');
    if (!fs.existsSync(tplPath)) return { ok: false, reason: 'identity_template_missing' };
    // eslint-disable-next-line global-require
    const scaffold = require('../room-skeleton-scaffold.cjs');
    const content = scaffold.renderTemplate(fs.readFileSync(tplPath, 'utf8'), {
      DIRECTORY_TYPE: directoryType,
      DIRECTORY_PURPOSE: purpose,
    });
    atomicWrite(roomMd, content);
    return { ok: true, created: true };
  } catch (e) {
    return { ok: false, reason: 'identity_write_failed', detail: String(e && e.message || '').slice(0, 80) };
  }
}

function yamlQuote(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

/**
 * fileResearchArtifact(roomDir, params) -> { ok, relPath, absPath, node_id,
 *                                            slug } | { ok:false, reason }
 *
 * params = { topicHandles: string[], body: string, sources: [{url, accessed}],
 *            engineMode?, researchMode?, date?, db?, slug?, frontmatterExtra? }
 *
 * Phase 220-02 ADDITIVE params (existing callers byte-unaffected):
 *   slug: a caller-owned dated slug (must match
 *     ^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,64}$; anything else falls back to the
 *     shipped topicHandles derivation). The url-ingest pipeline owns its
 *     path-safe slug + same-day collision suffixing (D-11), so the filing op
 *     must honor it rather than re-derive.
 *   frontmatterExtra: a plain object of EXTRA scalar frontmatter keys (the
 *     D-03 sidecar contract: artifact_id, original_url, content_sha256, ...).
 *     Keys must match ^[a-z_][a-z0-9_]*$ and not collide with the shipped
 *     keys; values are scalars ONLY (string/number/boolean -- the T-219-05
 *     non-scalar discipline); control chars in string values are flattened to
 *     spaces so a hostile title can never break the frontmatter fence.
 *
 * Files research/<dated-slug>/<dated-slug>.md with the D-16 item 1 frontmatter
 * (date, sources each with url + accessed, topic_handles; engine_mode when a
 * D-20 manual step produced the content -- the bankOpportunity optional-scalar
 * idiom; research_mode when the run was degraded, so the artifact is honestly
 * marked). Registers the memory_artifact node through navigation (caller-owned
 * db honored via params.db; otherwise open/work/close per invocation).
 * Never throws.
 */
function fileResearchArtifact(roomDir, params) {
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0 || !isPlainObject(params)) {
      return { ok: false, reason: 'invalid_params' };
    }
    const topicHandles = Array.isArray(params.topicHandles)
      ? params.topicHandles.filter((t) => typeof t === 'string' && t.length > 0)
      : [];
    if (topicHandles.length === 0) return { ok: false, reason: 'no_topic_handles' };
    const body = typeof params.body === 'string' ? params.body : '';
    const sources = Array.isArray(params.sources)
      ? params.sources.filter((s) => isPlainObject(s) && typeof s.url === 'string' && s.url.length > 0)
      : [];

    const date = (typeof params.date === 'string' && params.date.length >= 10)
      ? params.date.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const stem = slugify(topicHandles.join(' ')).slice(0, 60) || 'research';
    // Phase 220-02 additive slug override (validated; fallback = shipped derivation).
    const slug = (typeof params.slug === 'string' && /^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,64}$/.test(params.slug))
      ? params.slug
      : date + '-' + stem;

    const dirRel = path.join('research', slug);
    const dirAbs = path.join(roomDir, dirRel);
    fs.mkdirSync(dirAbs, { recursive: true });
    // ICM Layer 0 identities: the research/ root once, then the artifact folder.
    ensureDirIdentity(path.join(roomDir, 'research'), 'research',
      'Explore-chain deep-research corpus. Each entry nests as research/<dated-slug>/<dated-slug>.md with URL-cited provenance (D-16).');
    ensureDirIdentity(dirAbs, 'research-entry',
      'Research corpus entry ' + slug + ' (frontmatter carries date, sources, topic handles).');

    const fm = ['---', 'date: ' + yamlQuote(date)];
    fm.push('topic_handles:');
    for (const t of topicHandles) fm.push('  - ' + yamlQuote(t));
    fm.push('sources:');
    for (const s of sources) {
      fm.push('  - url: ' + String(s.url));
      fm.push('    accessed: ' + yamlQuote(typeof s.accessed === 'string' && s.accessed.length >= 10 ? s.accessed.slice(0, 10) : date));
    }
    if (sources.length === 0) fm[fm.length - 1] = 'sources: []';
    if (typeof params.engineMode === 'string' && params.engineMode.length > 0) {
      // D-20: manual output is honestly labeled and excluded from calibration.
      fm.push('engine_mode: ' + yamlQuote(params.engineMode));
    }
    if (typeof params.researchMode === 'string' && params.researchMode.length > 0) {
      // D-19: a degraded run stays honestly marked on the filed artifact.
      fm.push('research_mode: ' + yamlQuote(params.researchMode));
    }
    // Phase 220-02 ADDITIVE frontmatterExtra passthrough: the D-03 sidecar
    // keys ride here. Scalars only; shipped keys never clobbered; string
    // values control-char-flattened (frontmatter-injection fence).
    if (isPlainObject(params.frontmatterExtra)) {
      const shipped = new Set(['date', 'topic_handles', 'sources', 'engine_mode', 'research_mode']);
      for (const key of Object.keys(params.frontmatterExtra)) {
        if (!/^[a-z_][a-z0-9_]*$/.test(key) || shipped.has(key)) continue;
        const v = params.frontmatterExtra[key];
        if (typeof v === 'string') {
          // eslint-disable-next-line no-control-regex
          fm.push(key + ': ' + yamlQuote(v.replace(/[\u0000-\u001f\u007f]+/g, ' ')));
        } else if (typeof v === 'number' && Number.isFinite(v)) {
          fm.push(key + ': ' + v);
        } else if (typeof v === 'boolean') {
          fm.push(key + ': ' + v);
        }
        // non-scalar values are skipped (T-219-05 discipline), never a throw.
      }
    }
    fm.push('---');

    const content = fm.join('\n') + '\n\n# Research: ' + topicHandles.join(', ') + '\n\n' + body + '\n';
    const relPath = path.join(dirRel, slug + '.md');
    const absPath = path.join(roomDir, relPath);
    atomicWrite(absPath, content);

    // The graph citizen at birth: the memory_artifact node via navigation.
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    const register = (db) => navigation.writeMemoryArtifactNode(db, {
      section: dirRel.replace(/\\/g, '/'),
      kind: 'USER',
      path: relPath.replace(/\\/g, '/'),
      hash: hash,
    });
    let nodeResult;
    if (params.db) {
      nodeResult = register(params.db);
    } else {
      const db = openRoomDb(roomDir);
      try { nodeResult = register(db); } finally { closeRoomDb(db); }
    }
    if (!nodeResult || nodeResult.ok !== true) {
      return { ok: false, reason: 'artifact_node_write_failed', detail: nodeResult && nodeResult.reason, relPath: relPath.replace(/\\/g, '/') };
    }
    return {
      ok: true,
      relPath: relPath.replace(/\\/g, '/'),
      absPath: absPath,
      node_id: nodeResult.node_id,
      slug: slug,
    };
  } catch (e) {
    return { ok: false, reason: 'file_research_threw', detail: String(e && e.message || '').slice(0, 80) };
  }
}

// Resolve a filed artifact's memory_artifact node id by its room-relative path
// (read-only scan over memory_artifact rows; the collectArtifacts tier-a key).
function artifactNodeIdForPath(db, relPath) {
  const norm = path.normalize(relPath);
  let rows = [];
  try {
    rows = db.prepare("SELECT id, properties FROM nodes WHERE type = 'memory_artifact'").all();
  } catch (_e) {
    return null;
  }
  for (const row of rows) {
    try {
      const props = JSON.parse(row.properties || '{}');
      if (props && typeof props.path === 'string' && path.normalize(props.path) === norm) return row.id;
    } catch (_e) { /* skip unreadable props */ }
  }
  return null;
}

/**
 * runPostFilingExtraction(roomDir, sessionId, artifactPaths)
 *   -> Promise<{ ok, artifacts, entitiesWritten, edgesWritten,
 *                derivedFromWritten } | { ok:false, reason }>
 *
 * D-16 item 2: immediately after ANY explore-chain artifact files, run the
 * SAME extraction path entity-extract.cjs uses, scoped via opts.paths to
 * exactly the new artifact paths (the Plan 02 seam), then add DERIVED_FROM
 * edges from each extracted proposed entity to the artifact node (the
 * extractor's own provenance edge is DESCRIBES; DERIVED_FROM is the D-16
 * artifact-derivation contract -- both are existing ALLOWED_EDGE_TYPES
 * members, zero net-new). Open/work/close per D-05. Never throws.
 */
async function runPostFilingExtraction(roomDir, sessionId, artifactPaths) {
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0) {
      return { ok: false, reason: 'invalid_room_dir' };
    }
    const paths = Array.isArray(artifactPaths)
      ? artifactPaths.filter((p) => typeof p === 'string' && p.length > 0)
      : [];
    if (paths.length === 0) return { ok: false, reason: 'no_artifact_paths' };
    const sid = (typeof sessionId === 'string' && sessionId.length > 0) ? sessionId : 'explore-chain';

    // The Plan 02 scoped-incremental seam on the SHIPPED extractor.
    // eslint-disable-next-line global-require
    const { runExtraction } = require('../../../scripts/entity-extract.cjs');

    const db = openRoomDb(roomDir, { allowExtension: true });
    let extraction;
    let derivedFromWritten = 0;
    try {
      extraction = await runExtraction(db, roomDir, sid, 25, { paths: paths });

      // DERIVED_FROM pass: entity -> artifact derivation edges where the
      // extractor's DESCRIBES provenance exists but the D-16 edge does not.
      for (const rel of paths) {
        const artId = artifactNodeIdForPath(db, rel);
        if (!artId) continue;
        let described = [];
        try {
          described = db.prepare("SELECT source FROM edges WHERE target = ? AND type = 'DESCRIBES'").all(artId);
        } catch (_e) { described = []; }
        for (const d of described) {
          let existing = null;
          try {
            existing = db.prepare("SELECT source FROM edges WHERE source = ? AND target = ? AND type = 'DERIVED_FROM'").get(d.source, artId);
          } catch (_e) { existing = null; }
          if (existing) continue;
          const w = navigation.writeEdge(db, {
            source_id: d.source,
            target_id: artId,
            edge_type: 'DERIVED_FROM',
            properties: { relation: 'derived_from', origin: 'post_filing_extraction' },
          });
          if (w && w.ok === true) derivedFromWritten += 1;
        }
      }
    } finally {
      closeRoomDb(db);
    }

    return {
      ok: true,
      artifacts: extraction ? extraction.artifacts : 0,
      entitiesWritten: extraction ? extraction.entitiesWritten : 0,
      edgesWritten: extraction ? extraction.edgesWritten : 0,
      derivedFromWritten: derivedFromWritten,
    };
  } catch (e) {
    return { ok: false, reason: 'post_filing_extraction_threw', detail: String(e && e.message || '').slice(0, 120) };
  }
}

// Token overlap for the structural fallback leg (the driver's tokenize
// discipline: lowercase alnum runs, >=3 chars). Pure, deterministic.
function tokenSet(text) {
  const words = String(text == null ? '' : text).toLowerCase().match(/[a-z0-9]+/g) || [];
  const set = new Set();
  for (const w of words) if (w.length >= 3) set.add(w);
  return set;
}

function overlapScore(queryTokens, text) {
  if (queryTokens.size === 0) return 0;
  const t = tokenSet(text);
  let hits = 0;
  for (const q of queryTokens) if (t.has(q)) hits += 1;
  return Math.round((hits / queryTokens.size) * 1000) / 1000;
}

/**
 * queryRoomCorpus(roomDir, topicHandles) -> { ok, results, research_mode,
 *   providers, provenance, fts_backend } -- never throws, never crashes.
 *
 * D-16 item 3: tri-modal retrieval consumed READ-ONLY, scoped to research/
 * memory_artifact nodes. lexicalSearch supplies the ranked leg (it returns []
 * honestly when the FTS5 probe reports absent -- the Plan 02 bi-modal
 * degrade); a structural token-overlap scan over research/ artifact titles +
 * paths is the fallback so an FTS5-less machine still degrades to its corpus.
 * A COLD corpus returns research_mode 'insufficient_evidence' with ZERO
 * fabricated results (D-19), never ok:true+empty-without-a-mode.
 */
function queryRoomCorpus(roomDir, topicHandles) {
  const seam = driverSeam();
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0) {
      return { ok: false, reason: 'invalid_room_dir' };
    }
    const handles = Array.isArray(topicHandles)
      ? topicHandles.filter((t) => typeof t === 'string' && t.length > 0)
      : [];
    const query = handles.join(' ');
    const queryTokens = tokenSet(query);

    const db = openRoomDb(roomDir);
    let results = [];
    let ftsBackend = 'unknown';
    try {
      // Research-artifact universe: memory_artifact nodes whose props.path
      // lives under research/ (read-only SELECT; zero writes in this fn).
      const researchNodes = new Map();
      let rows = [];
      try {
        rows = db.prepare("SELECT id, properties FROM nodes WHERE type = 'memory_artifact'").all();
      } catch (_e) { rows = []; }
      for (const row of rows) {
        try {
          const props = JSON.parse(row.properties || '{}');
          const p = props && typeof props.path === 'string' ? props.path.replace(/\\/g, '/') : '';
          if (p.startsWith('research/')) {
            researchNodes.set(row.id, { node_id: row.id, path: p, section: props.section || '', kind: props.kind || '' });
          }
        } catch (_e) { /* skip unreadable props */ }
      }

      // Lexical leg (tri-modal, read-only). [] when the FTS5 probe is absent.
      const verdict = triModal.ensureFtsAvailable();
      ftsBackend = verdict && verdict.ok ? 'fts5' : 'absent (bi-modal degrade)';
      const hits = triModal.lexicalSearch(db, query, 20);
      for (const h of hits) {
        const entry = researchNodes.get(h.node_id);
        if (!entry) continue; // scope filter: research/ artifacts only
        results.push({ node_id: entry.node_id, path: entry.path, section: entry.section, score: 1 });
      }

      // Structural fallback: token overlap over path + section when the
      // lexical leg contributed nothing (absent FTS5, cold index, or no hits).
      if (results.length === 0 && queryTokens.size > 0) {
        for (const entry of researchNodes.values()) {
          const score = overlapScore(queryTokens, entry.path.replace(/[-/]/g, ' ') + ' ' + entry.section.replace(/[-/]/g, ' '));
          if (score > 0) {
            results.push({ node_id: entry.node_id, path: entry.path, section: entry.section, score: score });
          }
        }
        results.sort((a, b) => b.score - a.score);
        results = results.slice(0, 20);
      }
    } finally {
      closeRoomDb(db);
    }

    // The D-19 envelope, composed on the Task 1 driver seam: the absent web
    // leg is a TYPED error provider; the corpus is the local provider. So a
    // warm corpus composes 'web_degraded_local_fallback' and a cold corpus
    // composes 'insufficient_evidence' -- exactly the D-16/D-19 contract.
    const providers = [
      {
        provider: 'web',
        lens: 'web',
        status: 'error',
        reason: 'web_leg_unavailable',
        counts: { items: 0 },
        freshness: 'unknown',
      },
      {
        provider: 'room-corpus',
        lens: 'local',
        status: results.length > 0 ? 'ok' : 'empty',
        reason: 'tri_modal_research_scope',
        counts: { items: results.length },
        freshness: 'local',
      },
    ];
    return attachRecoveryDisclosure({
      ok: true,
      results: results,
      research_mode: seam.composeResearchMode(providers),
      providers: providers,
      provenance: OFFLINE_PROVENANCE,
      fts_backend: ftsBackend,
    }, handles);
  } catch (e) {
    // Never a crash, never a silent skip: the fault itself is typed.
    return attachRecoveryDisclosure({
      ok: true,
      results: [],
      research_mode: 'insufficient_evidence',
      providers: [{
        provider: 'room-corpus',
        lens: 'local',
        status: 'error',
        reason: 'corpus_query_failed:' + String(e && e.message || '').slice(0, 60),
        counts: { items: 0 },
        freshness: 'unknown',
      }],
      provenance: OFFLINE_PROVENANCE,
      fts_backend: 'unknown',
    }, Array.isArray(topicHandles) ? topicHandles.filter((t) => typeof t === 'string' && t.length > 0) : []);
  }
}

// Phase 221-04 (D-02 seam alignment, ADDITIVE): the full typed stage-envelope
// view + the annex-6 disclosure ride the queryRoomCorpus return alongside
// every landed 219-05 field (nothing renamed, nothing removed - existing
// consumers byte-unaffected). Lazy require: result-semantics lives in the
// recovery home; a require fault degrades to the bare landed shape (the
// driverSeam defensive idiom), never a crash.
function attachRecoveryDisclosure(out, topicHandles) {
  try {
    // eslint-disable-next-line global-require
    const rs = require('../recovery/result-semantics.cjs');
    out.stage_envelopes = rs.envelopesFromProviders(out.providers);
    out.disclosure = rs.composeRecoveryResult({
      envelopes: out.stage_envelopes,
      dispatch: null,
      recovery: null,
      ctx: {
        requestedScope: (Array.isArray(topicHandles) && topicHandles.length > 0)
          ? topicHandles : ['room-corpus'],
        base_research_mode: out.research_mode,
      },
    }).disclosure;
  } catch (_e) { /* additive only: the landed shape stands on its own */ }
  return out;
}

module.exports = {
  fileResearchArtifact,
  runPostFilingExtraction,
  queryRoomCorpus,
  OFFLINE_PROVENANCE,
  // internal, exposed for the explored-artifact writer (path -> node id).
  _internal: { artifactNodeIdForPath, slugify, ensureDirIdentity, atomicWrite, yamlQuote },
};
