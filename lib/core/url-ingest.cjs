'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 220-02 -- url-ingest: the REQ-1 ingestion spine.
 *
 * ingestUrl(roomDir, url, opts) -- URL in, graph-visible cited knowledge out,
 * in one governed move:
 *
 *   fetch-or-accept content -> D-02 byte bound -> content_sha256 ->
 *   idempotency / SUPERSEDES resolution (D-04) -> D-03 sidecar filing THROUGH
 *   research-filing.fileResearchArtifact (D-11 nesting, existing filing ops
 *   only) -> raw capture inside the artifact folder -> scoped post-filing
 *   extraction (the 219-02 opts.paths seam via runPostFilingExtraction) ->
 *   atomic ledger update -> the D-19 provider-status envelope.
 *
 * research_mode mapping (D-07 consumption; one rule, documented here):
 *   - rung-1 Tavily Extract success (fetched, or supplied with contentSource
 *     'tavily-extract') -> 'normal'
 *   - content supplied by a fallback rung (contentSource 'webfetch' or
 *     'llm_manual'; rungs 2-3 are surface-orchestrated at the command layer,
 *     Plan 03) -> 'web_degraded_local_fallback' with the providers bag
 *     telling the truth about which rung produced the bytes
 *   - nothing produced content -> 'insufficient_evidence' with outcome
 *     'provider_unavailable' (or 'size_exceeded' when the bound refused it)
 *   NEVER ok:true with an empty result and mode 'normal' (T-220-10).
 *
 * D-04 idempotency + evidence-tier note: same content_sha256 at the same URL
 *   is a typed 'no_op' (no re-file, no re-extract; the ledger timestamp
 *   refreshes). Changed bytes at the same URL file a NEW version and write a
 *   SUPERSEDES edge new-version -> prior artifact node; history is
 *   append-only, the prior file and node are NEVER rewritten or deleted.
 *   Evidence tier derives from validated source metadata (source_type /
 *   DOI / URL host), never from which adapter fetched the bytes.
 *
 * D-02: inbound content is DATA end to end -- never eval'd, never spliced
 *   into any prompt-shaped string, stored verbatim (the raw capture is the
 *   exact returned bytes; the normalized derivative wraps them in the D-03
 *   frontmatter). MAX_INGEST_BYTES (1_500_000) is the filing byte bound (the
 *   adapter already caps raw transport at 5MB); oversize is a typed
 *   'size_exceeded' refusal, nothing filed. Slugs are [a-z0-9-] whitelist,
 *   length-capped, date-prefixed -- path traversal impossible by
 *   construction; a symlink planted at the target folder is refused (typed
 *   'error'), never written through.
 *
 * D-08: this module has NO research-cache require at all -- the ingest path
 *   cannot write the public cache by construction (grep-gated).
 *
 * D-10: the manual rung is structurally unreachable from cadence -- origin
 *   'cadence' + contentSource 'llm_manual' returns a typed 'blocked' outcome
 *   before anything is fetched or filed. Manual output that IS accepted
 *   (on-demand only) is stamped engine_mode 'llm_manual_baseline' in the
 *   frontmatter and providers.llm_manual 'used' (excluded from calibration).
 *
 * D-11: research/<dated-slug>/<dated-slug>.md is the normalized artifact;
 *   <dated-slug>.raw.md (verbatim bytes, immutable after write) sits INSIDE
 *   the same folder; the normalized frontmatter carries derived_from. Filing
 *   goes through fileResearchArtifact so identity/ROOM.md + node registration
 *   fire through the existing ops -- the raw capture is the ONE permitted
 *   direct write (a derived attachment inside the artifact folder, the
 *   Obsidian folder-is-the-artifact convention, Decision 16).
 *
 * Canon Part 9: every node/edge write routes through navigation.cjs or the
 *   research-filing ops (zero raw INSERT, grep-gated). Canon Part 8: the only
 *   egress is fetchCorpus({source:'tavily-extract'}) -- the audited chokepoint
 *   Plan 01 shipped; outbound carries the URL only.
 *
 * Naming rule (binding): this plan's vocabulary is url-ingest; 219 owns its
 *   own sensor vocabulary -- no bare token from it appears in this module.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const { fetchCorpus } = require('./research-corpus.cjs');
const { openRoomDb, closeRoomDb } = require('./room-db.cjs');
const navigation = require('./navigation.cjs');
const researchFiling = require('./eureka/research-filing.cjs');
const { parseFrontmatter } = require('./opportunity-ops.cjs');

// D-02 filing byte bound (the adapter transport cap is 5MB; filing caps at
// 1.5MB so an accepted page never balloons the room).
const MAX_INGEST_BYTES = 1500000;

// The ledger side-channel (SENS dedup + crawl change-detection consumer;
// Plans 03/04 read it). Own path -- never .mindrian/eureka/ or another
// module's file (218 Pitfall 5 collision rule). LOCAL state, never egressed.
const LEDGER_RELPATH = path.join('.mindrian', 'url-ingest-ledger.json');

const CONTENT_SOURCES = new Set(['tavily-extract', 'webfetch', 'llm_manual']);
const OK_OUTCOMES = new Set(['filed', 'no_op', 'superseded']);

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function sha256Hex(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

// Inbound titles are attacker-controlled DATA: control chars (incl. newlines,
// the frontmatter-injection vector) flatten to spaces, whitespace collapses,
// length caps at 200. Never throws.
function sanitizeTitle(t) {
  // eslint-disable-next-line no-control-regex
  return String(t == null ? '' : t)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

// D-04: source_type derives from validated URL metadata, NEVER from the
// adapter name. v1 rule set: doi.org / arxiv.org / .edu -> academic;
// .gov -> government; everything else -> 'unknown'.
function deriveSourceType(parsedUrl) {
  const host = String(parsedUrl.hostname || '').toLowerCase();
  if (host === 'doi.org' || host.endsWith('.doi.org')
    || host === 'arxiv.org' || host.endsWith('.arxiv.org')
    || host.endsWith('.edu')) {
    return 'academic';
  }
  if (host.endsWith('.gov')) return 'government';
  return 'unknown';
}

// [a-z0-9-] whitelist, collapsed, trimmed, length-capped (60 base so the
// same-day collision suffix stays inside the 64 cap), empty-fallback
// 'web-ingest' -- path traversal impossible by construction (D-02).
function slugStem(parsedUrl, title) {
  const raw = (String(parsedUrl.hostname || '') + ' ' + String(title || '')).toLowerCase();
  const stem = raw.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60).replace(/-+$/g, '');
  return stem || 'web-ingest';
}

function buildSlug(parsedUrl, title, date) {
  return date + '-' + slugStem(parsedUrl, title);
}

// Atomic write-temp-rename (the research-cache/scaffold idiom): a concurrent
// reader sees old-or-complete, never a partial. Local copy so this module
// never couples to another module's _internal surface.
function atomicWrite(filePath, content) {
  const tmpPath = filePath + '.tmp.' + process.pid + '.' + crypto.randomBytes(6).toString('hex');
  fs.writeFileSync(tmpPath, content, 'utf8');
  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch (_e) { /* best-effort */ }
    throw err;
  }
}

function readLedger(roomDir) {
  try {
    const raw = fs.readFileSync(path.join(roomDir, LEDGER_RELPATH), 'utf8');
    const parsed = JSON.parse(raw);
    if (isPlainObject(parsed) && isPlainObject(parsed.entries)) return parsed;
  } catch (_e) { /* missing or unreadable -> fresh ledger (room.db is ground truth) */ }
  return { schema_version: 1, entries: {} };
}

function writeLedger(roomDir, ledger) {
  const abs = path.join(roomDir, LEDGER_RELPATH);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  atomicWrite(abs, JSON.stringify(ledger, null, 2) + '\n');
}

function updateLedger(roomDir, url, entry) {
  const ledger = readLedger(roomDir);
  ledger.schema_version = 1;
  ledger.entries[url] = entry;
  writeLedger(roomDir, ledger);
}

// D-04 prior-state resolution. Fast path: the ledger entry. Ground truth:
// room.db memory_artifact nodes under research/ whose FILED frontmatter
// original_url matches (read-only SELECT + file read; reads are not
// navigation-gated, writes are). The ledger is a rebuilt-on-the-way-through
// fast path, never the authority. Returns { node_id, relPath, sha } | null.
function resolvePriorArtifact(roomDir, url, dbOpt) {
  const scan = (db) => {
    let rows = [];
    try {
      rows = db.prepare("SELECT id, properties FROM nodes WHERE type = 'memory_artifact'").all();
    } catch (_e) {
      return null;
    }
    const candidates = [];
    for (const row of rows) {
      let props = {};
      try { props = JSON.parse(row.properties || '{}'); } catch (_e) { continue; }
      const rel = (props && typeof props.path === 'string') ? props.path.replace(/\\/g, '/') : '';
      if (!rel.startsWith('research/')) continue;
      let text = null;
      try { text = fs.readFileSync(path.join(roomDir, rel), 'utf8'); } catch (_e) { continue; }
      let fm = {};
      try { fm = parseFrontmatter(text); } catch (_e) { continue; }
      if (!fm || fm.original_url !== url) continue;
      candidates.push({
        node_id: row.id,
        relPath: rel,
        sha: typeof fm.content_sha256 === 'string' ? fm.content_sha256 : '',
        capturedAt: typeof fm.captured_at === 'string' ? fm.captured_at : '',
      });
    }
    if (candidates.length === 0) return null;
    // Newest first: captured_at ISO desc, tie-break path desc (the same-day
    // -N suffix sorts later lexically for N in 2..9 within one base slug).
    candidates.sort((a, b) => {
      if (a.capturedAt !== b.capturedAt) return a.capturedAt < b.capturedAt ? 1 : -1;
      return a.relPath < b.relPath ? 1 : -1;
    });
    return candidates[0];
  };
  if (dbOpt) return scan(dbOpt);
  const db = openRoomDb(roomDir);
  try {
    return scan(db);
  } finally {
    closeRoomDb(db);
  }
}

function makeProviders() {
  return {
    tavily_extract: { status: 'not_attempted', reason: null, counts: {} },
    webfetch: { status: 'not_attempted' },
    llm_manual: { status: 'not_used' },
  };
}

// Phase 221-04 (D-02 seam alignment): the ingest providers bag mapped onto
// the full typed stage-envelope contract. ADDITIVE second view of the same
// bag; the shipped providers shape is untouched. not_attempted / not_used
// entries emit nothing (no stage ran); a blocked outcome types the D-10
// fence as blocked/policy_blocked.
function ingestStageEnvelopes(providers, outcome) {
  let se;
  try {
    // eslint-disable-next-line global-require
    se = require('./recovery/stage-envelope.cjs');
  } catch (_e) {
    return [];
  }
  const out = [];
  const p = isPlainObject(providers) ? providers : {};
  const te = isPlainObject(p.tavily_extract) ? p.tavily_extract : {};
  if (te.status && te.status !== 'not_attempted') {
    let status = 'failed';
    let failureClass = 'unknown_error';
    if (te.status === 'ok') { status = 'ok'; failureClass = null; }
    else if (te.status === 'provider_unavailable') { status = 'blocked'; failureClass = 'missing_credential'; }
    else if (te.status === 'timeout') { failureClass = 'network_timeout'; }
    else if (te.status === 'size_exceeded') { failureClass = 'size_exceeded'; }
    out.push(se.makeStageEnvelope({
      stage: 'retrieval', engine: 'tavily-extract', status: status,
      failure_class: failureClass,
      error: status === 'ok' ? null : String(te.reason || te.status),
    }));
  }
  if (isPlainObject(p.webfetch) && p.webfetch.status === 'used') {
    out.push(se.makeStageEnvelope({
      stage: 'retrieval', engine: 'webfetch', status: 'ok', provenance: ['webfetch'],
    }));
  }
  if (isPlainObject(p.llm_manual) && p.llm_manual.status === 'used') {
    out.push(se.makeStageEnvelope({
      stage: 'retrieval', engine: 'llm_manual', status: 'ok', provenance: ['llm_manual_baseline'],
    }));
  }
  if (outcome === 'blocked') {
    // The D-10 fence: the manual rung is structurally unreachable from
    // cadence - a typed policy block, never a silent skip.
    out.push(se.makeStageEnvelope({
      stage: 'gate', engine: 'llm_manual', status: 'blocked',
      failure_class: 'policy_blocked', error: 'manual_rung_unreachable_from_cadence',
    }));
  }
  return out;
}

function makeEnvelope(outcome, mode, providers, artifact, reason) {
  const env = {
    ok: OK_OUTCOMES.has(outcome),
    outcome: outcome,
    research_mode: mode,
    providers: providers,
    artifact: artifact || { node_id: null, path: null, content_sha256: null, superseded_node_id: null },
  };
  if (typeof reason === 'string' && reason.length > 0) env.reason = reason;
  // Phase 221-04 (D-02, ADDITIVE): the full typed stage-envelope view + the
  // annex-6 disclosure ride alongside every landed 220-02 field (nothing
  // renamed, nothing removed). Lazy require + degrade-to-landed-shape.
  try {
    // eslint-disable-next-line global-require
    const rs = require('./recovery/result-semantics.cjs');
    env.stage_envelopes = ingestStageEnvelopes(providers, outcome);
    env.disclosure = rs.composeRecoveryResult({
      envelopes: env.stage_envelopes,
      dispatch: null,
      recovery: null,
      ctx: { requestedScope: ['url-ingest'], base_research_mode: mode },
    }).disclosure;
  } catch (_e) { /* additive only */ }
  return env;
}

/**
 * ingestUrl(roomDir, url, opts) -> the ingest envelope (interfaces contract;
 * Plans 03/04/05 consume verbatim). Never throws.
 *
 * opts = { content?, contentSource? ('tavily-extract'|'webfetch'|'llm_manual'),
 *          title?, sessionId?, origin? ('on_demand'|'cadence'),
 *          maxBytes?, _fetchCorpus? (test seam), db? }
 */
async function ingestUrl(roomDir, url, opts) {
  const o = isPlainObject(opts) ? opts : {};
  const providers = makeProviders();
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0) {
      return makeEnvelope('error', 'insufficient_evidence', providers, null, 'invalid_room_dir');
    }
    let parsedUrl;
    try {
      parsedUrl = new URL(String(url));
    } catch (_e) {
      return makeEnvelope('error', 'insufficient_evidence', providers, null, 'invalid_url');
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return makeEnvelope('error', 'insufficient_evidence', providers, null, 'scheme_not_allowed');
    }
    const urlKey = String(url);
    const origin = o.origin === 'cadence' ? 'cadence' : 'on_demand';
    const sessionId = (typeof o.sessionId === 'string' && o.sessionId.length > 0) ? o.sessionId : 'url-ingest';

    // ---- content acquisition ----
    let content;
    let title;
    let contentSource;
    let mode;
    if (typeof o.content === 'string') {
      contentSource = CONTENT_SOURCES.has(o.contentSource) ? o.contentSource : 'webfetch';
      // D-10 hard fence FIRST: the crawl loop NEVER uses the manual rung.
      if (origin === 'cadence' && contentSource === 'llm_manual') {
        return makeEnvelope('blocked', 'insufficient_evidence', providers, null, 'manual_rung_unreachable_from_cadence');
      }
      content = o.content;
      title = sanitizeTitle(o.title);
      if (contentSource === 'webfetch') {
        providers.webfetch.status = 'used';
        mode = 'web_degraded_local_fallback';
      } else if (contentSource === 'llm_manual') {
        providers.llm_manual.status = 'used';
        mode = 'web_degraded_local_fallback';
      } else {
        // Rung-1 bytes handed in directly (surface pre-fetched them).
        providers.tavily_extract = { status: 'ok', reason: 'content_supplied', counts: {} };
        mode = 'normal';
      }
    } else {
      // Rung 1: the audited Plan 01 chokepoint (or the injectable test seam,
      // the source-lens-driver _fetchCorpus precedent).
      const fetchFn = (typeof o._fetchCorpus === 'function') ? o._fetchCorpus : fetchCorpus;
      let legacy;
      try {
        legacy = await fetchFn({ source: 'tavily-extract', query: urlKey, opts: o });
      } catch (e) {
        providers.tavily_extract = {
          status: 'error',
          reason: 'fetch_threw:' + String(e && e.message || e).slice(0, 60),
          counts: {},
        };
        return makeEnvelope('error', 'insufficient_evidence', providers, null, 'fetch_threw');
      }
      const prov = (legacy && isPlainObject(legacy.provider)) ? legacy.provider : {};
      providers.tavily_extract = {
        status: typeof prov.status === 'string' ? prov.status : 'error',
        reason: (prov.reason === undefined) ? null : prov.reason,
        counts: isPlainObject(prov.counts) ? prov.counts : {},
      };
      const results = (legacy && Array.isArray(legacy.results)) ? legacy.results : [];
      if (!legacy || legacy.ok !== true || results.length === 0) {
        // D-19: a failed fetch is a TYPED outcome, never ok:true+empty.
        const outcome = providers.tavily_extract.status === 'size_exceeded'
          ? 'size_exceeded'
          : 'provider_unavailable';
        return makeEnvelope(outcome, 'insufficient_evidence', providers, null,
          typeof providers.tavily_extract.reason === 'string' ? providers.tavily_extract.reason : 'fetch_failed');
      }
      const first = results[0];
      content = String(first.markdown || '');
      title = sanitizeTitle((typeof o.title === 'string' && o.title.length > 0) ? o.title : first.title);
      contentSource = 'tavily-extract';
      mode = 'normal';
      if (content.length === 0) {
        return makeEnvelope('provider_unavailable', 'insufficient_evidence', providers, null, 'empty_content');
      }
    }

    // ---- D-02 filing byte bound ----
    const cap = (typeof o.maxBytes === 'number' && Number.isFinite(o.maxBytes) && o.maxBytes > 0)
      ? Math.min(o.maxBytes, MAX_INGEST_BYTES)
      : MAX_INGEST_BYTES;
    if (Buffer.byteLength(content, 'utf8') > cap) {
      providers.tavily_extract.counts = providers.tavily_extract.counts || {};
      return makeEnvelope('size_exceeded', 'insufficient_evidence', providers, null, 'filing_byte_bound');
    }

    // ---- content hash (the part8-egress-guard sha256 precedent) ----
    const contentSha = sha256Hex(content);

    // ---- D-04 idempotency / versioning resolution ----
    // Ground truth is room.db + the filed frontmatter (original_url +
    // content_sha256); the ledger is only a fast path and is rebuilt on the
    // way through, so a deleted ledger never causes a duplicate ingest.
    const prior = resolvePriorArtifact(roomDir, urlKey, o.db);
    if (prior && prior.sha === contentSha) {
      // Typed no_op: no re-file, no re-extract; the ledger timestamp refreshes.
      updateLedger(roomDir, urlKey, {
        content_sha256: contentSha,
        artifact_node_id: prior.node_id,
        artifact_path: prior.relPath,
        last_ingested_at: new Date().toISOString(),
        ingest_origin: origin,
      });
      return makeEnvelope('no_op', mode, providers, {
        node_id: prior.node_id,
        path: prior.relPath,
        content_sha256: contentSha,
        superseded_node_id: null,
      });
    }

    // ---- path-safe dated slug + same-day collision suffix ----
    const date = new Date().toISOString().slice(0, 10);
    const baseSlug = buildSlug(parsedUrl, title, date);
    const researchRoot = path.resolve(roomDir, 'research');
    let slug = null;
    for (let n = 1; n <= 50; n += 1) {
      const candidate = n === 1 ? baseSlug : baseSlug + '-' + n;
      const target = path.resolve(researchRoot, candidate);
      // Containment: by construction the whitelist slug cannot escape, but the
      // fence is asserted mechanically anyway (D-02).
      if (target !== researchRoot && !target.startsWith(researchRoot + path.sep)) {
        return makeEnvelope('error', mode, providers, null, 'path_containment_violation');
      }
      let st = null;
      try { st = fs.lstatSync(target); } catch (_e) { st = null; }
      if (st && st.isSymbolicLink()) {
        // A planted symlink is REFUSED, never written through (T-220-07).
        return makeEnvelope('error', mode, providers, null, 'symlink_refused');
      }
      if (!st) { slug = candidate; break; }
      // Existing real dir: same-day re-ingest -> -2, -3, ... suffix rule.
    }
    if (!slug) {
      return makeEnvelope('error', mode, providers, null, 'slug_exhausted');
    }

    // ---- D-03 sidecar filing THROUGH the existing filing op (D-11) ----
    const capturedAt = new Date().toISOString();
    const engineMode = contentSource === 'llm_manual' ? 'llm_manual_baseline' : 'engine';
    const hostHandle = slugStem(parsedUrl, '');
    const titleHandle = title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) : '';
    const topicHandles = [hostHandle];
    if (titleHandle) topicHandles.push(titleHandle);
    const frontmatterExtra = {
      artifact_id: slug,
      kind: 'research-source',
      title: title || slug,
      source_type: deriveSourceType(parsedUrl),
      original_url: urlKey,
      captured_at: capturedAt,
      content_sha256: contentSha,
      content_format: 'markdown',
      normalization_version: 1,
      access_basis: 'public_web',
      review_status: 'proposed',
      ingest_origin: origin,
      derived_from: slug + '.raw.md',
    };
    // source_published_at ONLY when the extract surfaces it (omitted in v1:
    // the Plan 01 envelope carries no publish date field).
    const filed = researchFiling.fileResearchArtifact(roomDir, {
      topicHandles: topicHandles,
      body: content,
      sources: [{ url: urlKey, accessed: date }],
      engineMode: engineMode,
      researchMode: mode !== 'normal' ? mode : undefined,
      date: date,
      db: o.db,
      slug: slug,
      frontmatterExtra: frontmatterExtra,
    });
    if (!filed || filed.ok !== true) {
      return makeEnvelope('error', mode, providers, null,
        'filing_failed:' + String(filed && filed.reason || 'unknown').slice(0, 60));
    }

    // ---- raw capture: verbatim bytes, immutable, INSIDE the artifact folder
    // (the ONE permitted direct write -- a derived attachment, Decision 16) ----
    atomicWrite(path.join(roomDir, 'research', slug, slug + '.raw.md'), content);

    // ---- SUPERSEDES versioning (D-04): new version -> prior artifact node ----
    let supersededNodeId = null;
    if (prior && prior.sha !== contentSha) {
      const writeSupersedes = (db) => navigation.writeEdge(db, {
        source_id: filed.node_id,
        target_id: prior.node_id,
        edge_type: 'SUPERSEDES',
        properties: { reason: 'content_change', prior_sha256: prior.sha, new_sha256: contentSha },
      });
      let edgeResult;
      if (o.db) {
        edgeResult = writeSupersedes(o.db);
      } else {
        const db = openRoomDb(roomDir);
        try { edgeResult = writeSupersedes(db); } finally { closeRoomDb(db); }
      }
      if (edgeResult && edgeResult.ok === true) supersededNodeId = prior.node_id;
    }

    // ---- scoped post-filing extraction (219 seam; degrade-never-throw) ----
    const extraction = await researchFiling.runPostFilingExtraction(roomDir, sessionId, [filed.relPath]);

    // ---- atomic ledger update (points at the NEWEST artifact node) ----
    updateLedger(roomDir, urlKey, {
      content_sha256: contentSha,
      artifact_node_id: filed.node_id,
      artifact_path: filed.relPath,
      last_ingested_at: capturedAt,
      ingest_origin: origin,
    });

    const env = makeEnvelope(supersededNodeId ? 'superseded' : 'filed', mode, providers, {
      node_id: filed.node_id,
      path: filed.relPath,
      content_sha256: contentSha,
      superseded_node_id: supersededNodeId,
    });
    // Additive visibility: the scoped-extraction counts ride alongside.
    env.extraction = (extraction && extraction.ok === true)
      ? {
        ok: true,
        entities_written: extraction.entitiesWritten,
        edges_written: extraction.edgesWritten,
        derived_from_written: extraction.derivedFromWritten,
      }
      : { ok: false, reason: String(extraction && extraction.reason || 'unknown').slice(0, 60) };
    return env;
  } catch (e) {
    // Typed honesty on the last rung too: never a crash out of the pipeline.
    return makeEnvelope('error', 'insufficient_evidence', providers, null,
      'ingest_threw:' + String(e && e.message || e).slice(0, 80));
  }
}

module.exports = {
  ingestUrl,
  MAX_INGEST_BYTES,
  LEDGER_RELPATH,
  // internal, exposed for the safety fixtures (slug prediction + ledger IO).
  _internal: { buildSlug, slugStem, deriveSourceType, sanitizeTitle, readLedger, resolvePriorArtifact },
};
