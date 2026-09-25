'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * lib/core/navigation/room-delta-facts.cjs -- Phase 355.1 Plan 02, Task 2
 * (AMB-01). THE room-delta statement home: the one place that reads what
 * changed in a room since the ambient trigger's last look, across all five
 * delta classes, as closed, content-free facts.
 *
 * Why this file exists (research C6): three of the five delta classes had
 * no navigation reader before this plan. `node_created` memory events are a
 * ghost producer fleet-wide (lib/core/strategy/goal-cadence.cjs's own
 * header names the same gap for its `claims_since` field, which this module
 * deliberately NEVER reuses -- that field counts the ghost node_created
 * event, not a real claim-node read); CONTRADICTS edges carry no timestamp
 * column at all; nothing in navigation read STATE.md's venture_stage or the
 * room registry's parent field. This module reads all five classes fresh,
 * through the ONE navigation chokepoint, so "detected only through
 * navigation reads" is literally true and there is no second SQL door
 * (tests/test-3551-chokepoint.cjs enforces this with a planted negative
 * control).
 *
 * Copies graph-integrity-counts.cjs's own contract, verbatim in spirit:
 *   1. a CALLER-SUPPLIED open handle only; this file requires NOTHING from
 *      node:sqlite and opens NOTHING itself. The caller (the evaluator, a
 *      test) owns the handle and its lifecycle via
 *      navigation.openRoomDbReadOnlyForCaller / closeRoomDbForCaller.
 *   2. null never zero. A statement the schema cannot answer (no
 *      `created_at` column, a closed or unreadable handle, an unreadable
 *      STATE.md or registry) returns `null` for that class, NEVER `0` or an
 *      empty set for a count-shaped class. `0` would read as "measured,
 *      clean"; `null` reads honestly as "not measurable here."
 *   3. fixed SQL literals only, declared once as module-level constants,
 *      never inlined into a statement; every caller-supplied value is a
 *      bound `?` parameter, never concatenated.
 *   4. Part 8: the payload carries integers (counts, epoch-ms timestamps),
 *      a closed enum (`schema_variant`), and 12-character truncated sha256
 *      hex hashes only. No node text, no room slug, no filesystem path ever
 *      rides the returned object.
 *   5. Part 9: this file never opens or closes `room.db`. The caller opens
 *      through navigation's read-only door and owns close().
 *   6. never throws. Every SQL read is its own try/catch returning null on
 *      any fault (a legacy schema, a closed handle, a stub whose `prepare`
 *      throws); the two file reads (STATE.md, the room registry) are
 *      likewise wrapped so an unreadable or malformed file yields null
 *      rather than propagating an exception into the Stop-hook or the
 *      MCP close-out path that will eventually call this module (T-3551-07).
 *
 * The five classes, and how each is read:
 *   (a) claims added since a watermark -- SQL_CLAIMS_SINCE, a fixed literal
 *       over `nodes.created_at` (epoch ms). NEVER
 *       goal-cadence.cjs::computeStrategyCounts().claims_since (the ghost
 *       node_created event; see the header note above).
 *   (b) a CONTRADICTS edge surfaced -- CLAUDE'S DISCRETION, smallest
 *       chokepoint change (355.1-CONTEXT.md "Claude's Discretion"): edges
 *       carry no timestamp column, so rather than add one (a migration) or
 *       mint a new memory_event this module returns the sorted set of
 *       truncated sha256 keys of every CONTRADICTS (source, target) pair,
 *       and the ledger (a later plan) compares key SETS across runs. No
 *       edge column, no migration, no new memory_event.
 *   (c) a venture-stage change -- reads STATE.md's frontmatter
 *       `venture_stage` field directly (a file read, not SQL) and returns
 *       its truncated hash. An unreadable, empty, or frontmatter-less
 *       STATE.md returns null, which downstream means "no change"
 *       (research Pitfall 5: on-stop rewrites of STATE.md race in
 *       parallel, so a transient read fault must never read as a genuine
 *       stage change).
 *   (d) a sub-room created -- reads the room registry (the same
 *       registry.json shape lib/core/resolve-active-room.cjs's
 *       registryRoomPath reads) and returns the sorted truncated hashes of
 *       every entry whose `parent` field names this room's own slug.
 *   (e) a new artifact filed -- SQL_ARTIFACTS_SINCE, the same count/max
 *       shape as (a), over `nodes.type IN ('memory_artifact', 'Artifact')`
 *       (the same two-member vocabulary goal-cadence.cjs's own
 *       ARTIFACT_NODE_TYPES names, cited rather than duplicated below).
 *
 * Canon Part 8: pure LOCAL reads (a caller-owned SQLite handle plus two
 * local file reads). Zero network, zero Brain, zero telemetry.
 * Canon Part 9: this file never opens `room.db`; the caller opens through
 * navigation.openRoomDbReadOnlyForCaller and owns close().
 *
 * No em-dashes anywhere (CLAUDE.md HARD RULE). Hyphens only.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

// -- Named constants, declared once, never inlined into a statement -------

// Statement (a): claim nodes created after a bound epoch-ms watermark, plus
// the max created_at seen so a caller can advance its own watermark. Never
// reused for anything but `type = 'claim'`; the goal-cadence.cjs ghost
// event is never read here.
const SQL_CLAIMS_SINCE = "SELECT count(*) AS c, max(created_at) AS m FROM nodes "
  + "WHERE type = 'claim' AND created_at > ?";

// Statement (b): every CONTRADICTS edge's (source, target) pair, ordered so
// two calls against an unchanged graph return byte-identical rows before
// hashing. Edges carry no timestamp column (the Claude's Discretion
// decision above); the caller compares the returned key SET, not a
// since-bound count.
const SQL_CONTRADICTS_KEYS = "SELECT source, target FROM edges "
  + "WHERE type = 'CONTRADICTS' ORDER BY source, target";

// Statement (e): the same count/max shape as (a), over the artifact node
// type vocabulary. ARTIFACT_NODE_TYPES below is the SAME two-member
// vocabulary lib/core/strategy/goal-cadence.cjs's own ARTIFACT_NODE_TYPES
// names (memory_artifact plus the legacy Artifact alias); this module does
// not require goal-cadence.cjs (that module reads events, not nodes) but
// keeps the vocabulary identical on purpose.
const SQL_ARTIFACTS_SINCE = "SELECT count(*) AS c, max(created_at) AS m FROM nodes "
  + "WHERE type IN ('memory_artifact', 'Artifact') AND created_at > ?";

// The artifact node-type vocabulary, frozen. Matches
// lib/core/strategy/goal-cadence.cjs::ARTIFACT_NODE_TYPES member-for-member.
const ARTIFACT_NODE_TYPES = Object.freeze(['memory_artifact', 'Artifact']);

// The frontmatter field this module reads off STATE.md for class (c).
const STAGE_FRONTMATTER_KEY = 'venture_stage';

// keyHash(s) -> the first 12 hex characters of sha256(s). Every truncated
// hash this module returns (contradicts_keys, stage_hash, children) goes
// through this one function, so the truncation width lives in one place.
function keyHash(s) {
  const str = typeof s === 'string' ? s : String(s);
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex').slice(0, 12);
}

// probeTableInfo(db) -> the PRAGMA table_info(nodes) row array, or null on
// any fault (a closed handle, a stub whose prepare throws, a missing
// `nodes` table). Never throws.
function probeTableInfo(db) {
  if (!db || typeof db.prepare !== 'function') return null;
  try {
    const cols = db.prepare('PRAGMA table_info(nodes)').all();
    return Array.isArray(cols) ? cols : null;
  } catch (_e) {
    return null;
  }
}

// hasCreatedAt(db) -> true only when `nodes.created_at` is a real column on
// this handle's schema. False on any fault (never throws) -- the schema
// this handle answers for cannot support statements (a) or (e), so those
// classes return null rather than a misleading count of zero.
function hasCreatedAt(db) {
  const cols = probeTableInfo(db);
  if (!cols || cols.length === 0) return false;
  return cols.some(function (c) { return c && c.name === 'created_at'; });
}

// safeCountSince(db, sql, sinceMs) -> { count, max_created_at } | null.
// Every SQL read in this module is its own try/catch; a thrown prepare or
// a thrown get() both collapse to null here, never a partial or zeroed
// result.
function safeCountSince(db, sql, sinceMs) {
  try {
    const row = db.prepare(sql).get(sinceMs);
    if (!row) return { count: 0, max_created_at: null };
    const count = typeof row.c === 'number' ? row.c : 0;
    const maxCreatedAt = typeof row.m === 'number' ? row.m : null;
    return { count: count, max_created_at: maxCreatedAt };
  } catch (_e) {
    return null;
  }
}

// readContradictsKeys(db) -> string[] | null. Independent of the
// created_at gate above (edges carry no timestamp at all); still its own
// try/catch so a fully broken handle yields null rather than throwing.
function readContradictsKeys(db) {
  if (!db || typeof db.prepare !== 'function') return null;
  try {
    const rows = db.prepare(SQL_CONTRADICTS_KEYS).all();
    if (!Array.isArray(rows)) return null;
    const keys = rows.map(function (row) {
      const source = row && typeof row.source === 'string' ? row.source : '';
      const target = row && typeof row.target === 'string' ? row.target : '';
      return keyHash(source + '\u0000' + target);
    });
    keys.sort();
    return keys;
  } catch (_e) {
    return null;
  }
}

// readStageHash(roomDir) -> string | null. Reads ONLY the leading `---`
// frontmatter block of STATE.md, never the whole file's prose (Part 8: no
// room content leaves this function, only a truncated hash of one field's
// value). An unreadable file, an empty file, a file with no frontmatter
// block, or a frontmatter block with no venture_stage key all collapse to
// null (research Pitfall 5: a torn or mid-rewrite STATE.md must read as "no
// change," never as a fabricated stage transition).
function readStageHash(roomDir) {
  try {
    const stateMdPath = path.join(roomDir, 'STATE.md');
    const raw = fs.readFileSync(stateMdPath, 'utf8');
    if (typeof raw !== 'string' || raw.length === 0) return null;
    const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
    if (!fmMatch) return null;
    const frontmatter = fmMatch[1];
    const keyRe = new RegExp('^' + STAGE_FRONTMATTER_KEY + ':\\s*(.+)$', 'm');
    const stageMatch = frontmatter.match(keyRe);
    if (!stageMatch) return null;
    const value = stageMatch[1].trim();
    if (value.length === 0) return null;
    return keyHash(value);
  } catch (_e) {
    return null;
  }
}

// resolveRegistryHome(registryHomeOpt) -> the same precedence
// lib/core/resolve-active-room.cjs uses: an explicit opts.registryHome,
// else MINDRIAN_ROOMS_HOME, else <HOME>/MindrianRooms.
function resolveRegistryHome(registryHomeOpt) {
  if (typeof registryHomeOpt === 'string' && registryHomeOpt.length > 0) return registryHomeOpt;
  if (typeof process.env.MINDRIAN_ROOMS_HOME === 'string' && process.env.MINDRIAN_ROOMS_HOME.length > 0) {
    return process.env.MINDRIAN_ROOMS_HOME;
  }
  return path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms');
}

// readChildKeyHashes(roomDir, registryHome) -> string[] | null. Reads the
// room registry (the same registry.json shape registryRoomPath reads: a
// `rooms` object keyed by slug, each entry carrying `path` relative to the
// registry home and an optional `parent`), finds this room's own slug by
// matching the entry whose resolved path equals roomDir (falling back to
// path.basename(roomDir) when no entry resolves), then returns the sorted
// truncated hashes of every entry whose `parent` equals that slug. An
// unreadable or malformed registry file returns null (never an empty set,
// since "the registry could not be read" and "the registry was read and
// has zero children" are different facts). A readable registry with zero
// matching children legitimately returns an empty array.
function readChildKeyHashes(roomDir, registryHomeOpt) {
  try {
    const home = resolveRegistryHome(registryHomeOpt);
    const regPath = path.join(home, '.rooms', 'registry.json');
    const raw = fs.readFileSync(regPath, 'utf8');
    const reg = JSON.parse(raw);
    if (!reg || typeof reg !== 'object' || !reg.rooms || typeof reg.rooms !== 'object') return null;

    const resolvedRoomDir = path.resolve(roomDir);
    let mySlug = null;
    const slugs = Object.keys(reg.rooms);
    for (const slug of slugs) {
      const entry = reg.rooms[slug];
      if (!entry || typeof entry.path !== 'string' || entry.path.length === 0) continue;
      const absEntryPath = path.isAbsolute(entry.path) ? entry.path : path.resolve(home, entry.path);
      if (absEntryPath === resolvedRoomDir) {
        mySlug = slug;
        break;
      }
    }
    if (mySlug === null) mySlug = path.basename(roomDir);

    const hashes = [];
    for (const slug of slugs) {
      const entry = reg.rooms[slug];
      if (entry && entry.parent === mySlug) hashes.push(keyHash(slug));
    }
    hashes.sort();
    return hashes;
  } catch (_e) {
    return null;
  }
}

/**
 * readRoomDeltaFacts(db, roomDir, opts) -> the frozen five-class delta
 * facts bag for one caller-supplied open handle. Never opens or closes
 * `db`; never throws.
 *
 * @param {{prepare: Function}} db - a caller-owned, already-open read-only
 *   handle (navigation.openRoomDbReadOnlyForCaller)
 * @param {string} roomDir - the room's own directory (for STATE.md and the
 *   registry-slug lookup; never read as room content itself)
 * @param {object} [opts]
 * @param {{claims_created_at?: number, artifacts_created_at?: number}} [opts.since]
 *   epoch-ms watermarks; default 0 for either (reads everything)
 * @param {string} [opts.registryHome] - overrides the registry home used
 *   for class (d); falls back to MINDRIAN_ROOMS_HOME then <HOME>/MindrianRooms
 * @returns {Readonly<{
 *   schema_variant: 'migrated'|'legacy'|'unreadable',
 *   claims: {count:number, max_created_at:number|null}|null,
 *   contradicts_keys: string[]|null,
 *   stage_hash: string|null,
 *   children: string[]|null,
 *   artifacts: {count:number, max_created_at:number|null}|null,
 * }>}
 */
function readRoomDeltaFacts(db, roomDir, opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  const since = (options.since && typeof options.since === 'object') ? options.since : {};
  const claimsSinceMs = (typeof since.claims_created_at === 'number' && Number.isFinite(since.claims_created_at))
    ? since.claims_created_at : 0;
  const artifactsSinceMs = (typeof since.artifacts_created_at === 'number' && Number.isFinite(since.artifacts_created_at))
    ? since.artifacts_created_at : 0;

  const cols = probeTableInfo(db);
  const dbReadable = Array.isArray(cols) && cols.length > 0;
  const createdAtPresent = dbReadable && cols.some(function (c) { return c && c.name === 'created_at'; });
  const schemaVariant = !dbReadable ? 'unreadable' : (createdAtPresent ? 'migrated' : 'legacy');

  const claims = createdAtPresent ? safeCountSince(db, SQL_CLAIMS_SINCE, claimsSinceMs) : null;
  const artifacts = createdAtPresent ? safeCountSince(db, SQL_ARTIFACTS_SINCE, artifactsSinceMs) : null;
  const contradictsKeys = readContradictsKeys(db);
  const stageHash = readStageHash(roomDir);
  const children = readChildKeyHashes(roomDir, options.registryHome);

  return Object.freeze({
    schema_variant: schemaVariant,
    claims: claims,
    contradicts_keys: contradictsKeys,
    stage_hash: stageHash,
    children: children,
    artifacts: artifacts,
  });
}

module.exports = {
  readRoomDeltaFacts: readRoomDeltaFacts,
  SQL_CLAIMS_SINCE: SQL_CLAIMS_SINCE,
  SQL_CONTRADICTS_KEYS: SQL_CONTRADICTS_KEYS,
  SQL_ARTIFACTS_SINCE: SQL_ARTIFACTS_SINCE,
  ARTIFACT_NODE_TYPES: ARTIFACT_NODE_TYPES,
  keyHash: keyHash,
  hasCreatedAt: hasCreatedAt,
  readStageHash: readStageHash,
  readChildKeyHashes: readChildKeyHashes,
};
