'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 220-04 -- watched-sources: the room-level crawl registry (REQ-3, D-06).
 *
 * The registry lives at <roomDir>/.mindrian/watched-sources.json (own file,
 * zero collision with any existing .mindrian consumer, the 218 Pitfall 5
 * rule). It mirrors the data/research-sources.json header conventions
 * (schema_version + generated_note) plus the D-06 per-source crawl fields:
 *
 *   { id, url, kind, cadence, enabled,
 *     etag, last_modified, last_content_sha, last_run, note }
 *
 * Enums and defaults (documented normalization, applied on READ):
 *   kind:    rss | repo | paper-feed | page   (unknown -> 'page'; v1 treats
 *            every kind as a page-fetch of its URL - the enum exists so
 *            registrations are forward-stable)
 *   cadence: daily | weekly | monthly         (unknown/omitted -> 'weekly')
 *   enabled: defaults true unless explicitly false
 *   max_ingests_per_run: positive integer, default 2 (the D-06 regulator cap;
 *            registry-overridable)
 *
 * Cadence windows (a source is DUE when enabled AND (last_run is null OR
 * now - last_run >= window); an unparseable last_run counts as never-run):
 *   daily = 24h, weekly = 7d, monthly = 30d.
 *
 * Change detection is content-hash-primary (research A4: the extract path may
 * never surface HTTP cache validators). etag / last_modified are
 * reserved-and-honored-when-present pre-fetch skip optimizations: v1 stores
 * them only if a caller ever supplies them, and nothing depends on them.
 *
 * THIS MODULE NEVER FETCHES. Zero network requires, zero egress - fetching is
 * ingestUrl's job through the audited Plan 01 chokepoint (grep-gated in
 * tests/test-220-crawl-loop.cjs). It also never throws on bad input: a
 * missing or malformed registry reads as { sources: [] } so the cadence step
 * reports '0 sources due' instead of dying.
 *
 * Writes are atomic write-temp-rename (the url-ingest ledger idiom): a
 * concurrent reader sees old-or-complete, never a partial file.
 *
 * Naming rule (binding): this plan's vocabulary is watched-source /
 * url-ingest-crawl; 219 owns its own sensor vocabulary - no bare token from
 * it appears in this module.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const REGISTRY_RELPATH = path.join('.mindrian', 'watched-sources.json');

const KIND_ENUM = new Set(['rss', 'repo', 'paper-feed', 'page']);
const CADENCE_ENUM = new Set(['daily', 'weekly', 'monthly']);

const HOUR_MS = 3600 * 1000;
const DAY_MS = 24 * HOUR_MS;
// D-06 cadence windows: daily 24h, weekly 7d, monthly 30d.
const CADENCE_WINDOW_MS = {
  daily: DAY_MS,
  weekly: 7 * DAY_MS,
  monthly: 30 * DAY_MS,
};

// D-06 regulator cap default: max 2 ingests per cadence run.
const DEFAULT_MAX_INGESTS_PER_RUN = 2;

// The ONLY per-source fields updateSourceState may patch (crawl state, never
// identity: id/url/kind/cadence/enabled/note are registration-owned).
const PATCHABLE_KEYS = new Set(['etag', 'last_modified', 'last_content_sha', 'last_run']);

function isPlainObject(v) {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function nullOrString(v) {
  return (v === null || typeof v === 'string') ? v : null;
}

// Normalize one raw source entry against the interfaces contract. Returns
// null when the entry is unusable (no string id or url) so a junk entry can
// never reach the crawl step.
function normalizeSource(raw) {
  if (!isPlainObject(raw)) return null;
  if (typeof raw.id !== 'string' || raw.id.length === 0) return null;
  if (typeof raw.url !== 'string' || raw.url.length === 0) return null;
  return {
    id: raw.id,
    url: raw.url,
    kind: KIND_ENUM.has(raw.kind) ? raw.kind : 'page',
    cadence: CADENCE_ENUM.has(raw.cadence) ? raw.cadence : 'weekly',
    enabled: raw.enabled !== false,
    etag: nullOrString(raw.etag),
    last_modified: nullOrString(raw.last_modified),
    last_content_sha: nullOrString(raw.last_content_sha),
    last_run: nullOrString(raw.last_run),
    note: typeof raw.note === 'string' ? raw.note : '',
  };
}

function emptyRegistry() {
  return {
    schema_version: 1,
    max_ingests_per_run: DEFAULT_MAX_INGESTS_PER_RUN,
    sources: [],
  };
}

/**
 * readWatchedSources(roomDir) -> normalized registry. Missing / malformed /
 * wrong-shape file -> { sources: [] } (never a throw): the crawl step reports
 * '0 sources due' instead of killing the cadence.
 */
function readWatchedSources(roomDir) {
  try {
    const raw = fs.readFileSync(path.join(roomDir, REGISTRY_RELPATH), 'utf8');
    const parsed = JSON.parse(raw);
    if (!isPlainObject(parsed) || !Array.isArray(parsed.sources)) return emptyRegistry();
    const cap = (typeof parsed.max_ingests_per_run === 'number'
      && Number.isFinite(parsed.max_ingests_per_run)
      && parsed.max_ingests_per_run > 0)
      ? Math.floor(parsed.max_ingests_per_run)
      : DEFAULT_MAX_INGESTS_PER_RUN;
    const sources = [];
    for (const raw_ of parsed.sources) {
      const s = normalizeSource(raw_);
      if (s) sources.push(s);
    }
    const out = {
      schema_version: 1,
      max_ingests_per_run: cap,
      sources: sources,
    };
    if (typeof parsed.generated_note === 'string') out.generated_note = parsed.generated_note;
    return out;
  } catch (_e) {
    return emptyRegistry();
  }
}

/**
 * selectDueSources(registry, now) -> the enabled sources whose cadence window
 * has elapsed, in registry order. PURE: no disk IO, no clock read when now is
 * supplied (Date or epoch ms), no mutation of the input.
 */
function selectDueSources(registry, now) {
  if (!isPlainObject(registry) || !Array.isArray(registry.sources)) return [];
  let nowMs;
  if (now instanceof Date) nowMs = now.getTime();
  else if (typeof now === 'number' && Number.isFinite(now)) nowMs = now;
  else nowMs = Date.now();
  const due = [];
  for (const raw of registry.sources) {
    const s = normalizeSource(raw);
    if (!s || s.enabled !== true) continue;
    if (s.last_run === null) { due.push(s); continue; }
    const lastMs = Date.parse(s.last_run);
    // Unparseable last_run counts as never-run (due) - a corrupt timestamp
    // must not silently park a source forever.
    if (!Number.isFinite(lastMs) || (nowMs - lastMs) >= CADENCE_WINDOW_MS[s.cadence]) {
      due.push(s);
    }
  }
  return due;
}

// Atomic write-temp-rename (the url-ingest ledger idiom, local copy so this
// module never couples to another module's _internal surface).
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

/**
 * updateSourceState(roomDir, id, patch) -> { ok, reason? }. Patches ONLY the
 * crawl-state fields (etag / last_modified / last_content_sha / last_run) on
 * the one matching source; identity fields and sibling sources are preserved
 * byte-identical (the raw parsed file is re-serialized, never re-normalized).
 * Atomic write-temp-rename; typed refusal, never a throw.
 */
function updateSourceState(roomDir, id, patch) {
  try {
    if (typeof roomDir !== 'string' || roomDir.length === 0) {
      return { ok: false, reason: 'invalid_room_dir' };
    }
    if (typeof id !== 'string' || id.length === 0) {
      return { ok: false, reason: 'invalid_id' };
    }
    const abs = path.join(roomDir, REGISTRY_RELPATH);
    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
    } catch (_e) {
      return { ok: false, reason: 'registry_unreadable' };
    }
    if (!isPlainObject(parsed) || !Array.isArray(parsed.sources)) {
      return { ok: false, reason: 'registry_malformed' };
    }
    const target = parsed.sources.find((s) => isPlainObject(s) && s.id === id);
    if (!target) {
      return { ok: false, reason: 'source_not_found' };
    }
    const p = isPlainObject(patch) ? patch : {};
    let applied = 0;
    for (const key of Object.keys(p)) {
      if (!PATCHABLE_KEYS.has(key)) continue; // identity fields are not patchable
      const v = p[key];
      if (v === null || typeof v === 'string') {
        target[key] = v;
        applied += 1;
      }
    }
    if (applied === 0) {
      return { ok: false, reason: 'no_patchable_keys' };
    }
    atomicWrite(abs, JSON.stringify(parsed, null, 2) + '\n');
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'update_threw:' + String(e && e.message || e).slice(0, 60) };
  }
}

module.exports = {
  readWatchedSources,
  selectDueSources,
  updateSourceState,
  REGISTRY_RELPATH,
  DEFAULT_MAX_INGESTS_PER_RUN,
};
