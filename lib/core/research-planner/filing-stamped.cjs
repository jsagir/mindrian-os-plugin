'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 366 Plan 02 (D-04, EPV366-12) -- the ONE stamped opportunity filer,
 * owned by the research planner.
 *
 * What lives here:
 *   - fileStampedOpportunity(db, params): moved unchanged in behavior from
 *     scripts/eureka-portfolio-report.cjs (Phase 355.1-07 "one writer, two
 *     callers"). The runner and lib/core/ambient-run.cjs keep resolving it
 *     through the runner's re-export until plan 366-07 switches ambient over.
 *   - readPwsStage(roomDir), sourcedFromTarget(db, entityId): its two helpers,
 *     moved with it (formerly _readPwsStage and _sourcedFromTarget).
 *   - stampForPair(pair, ctx): the verification stamp a perspective pair files
 *     with. Synchronous, never calls a tool, never throws. An endpoint without
 *     a canon handle stamps unverified / not_called / handle_unresolved (355
 *     D-10, 366 D-15). A recorded Theo lane result in <run home>/theo-lane.json
 *     keyed by pairKey(a, b) is returned unchanged (the 366-15 seam).
 *
 * Canon Part 9: every node and edge lands proposed; only a human confirms.
 * writeOpportunityNode never takes a review_status, and the lifecycle-state
 * column never carries an explicit value (the mint default lands).
 * Canon Part 8: nothing in this file sends anything anywhere. Filing writes
 * local room files and room.db. No Brain, no Theo, no network.
 *
 * No em-dash or en-dash anywhere in this file. Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const navigation = require('../navigation.cjs');
const verificationStamp = require('../verification-stamp.cjs');

const THEO_LANE_FILE = 'theo-lane.json';
const THEO_LANE_SCHEMA = 'mos.theo-lane/1';

function isObj(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
function nonEmpty(v) { return typeof v === 'string' && v.trim().length > 0; }

// pairKey(a, b): order-free key, the same formula as eureka-recall.cjs pairKey.
function pairKey(a, b) { return a < b ? a + '\u0000' + b : b + '\u0000' + a; }

// sourcedFromTarget(db, entityId) -- D-38's "the two source artifact nodes":
// the entity's own DESCRIBES target (the SAME provenance link scripts/
// entity-extract.cjs writes), else the entity node id itself when no
// DESCRIBES edge exists. READ-only; never throws.
function sourcedFromTarget(db, entityId) {
  if (typeof entityId !== 'string' || entityId.length === 0 || !db) return entityId;
  try {
    const row = db.prepare("SELECT target FROM edges WHERE source = ? AND type = 'DESCRIBES' LIMIT 1").get(entityId);
    if (row && typeof row.target === 'string' && row.target.length > 0) return row.target;
  } catch (_e) {
    // fall through to the entity id itself
  }
  return entityId;
}

// readPwsStage(roomDir) -- D-40/D-37: the room root ROOM.md frontmatter's
// own `pws_stage:` value, read ONCE (a filesystem read, never inside the
// write transaction), restricted to the two D-40 values. Mirrors lib/core/
// cross-room-aggregator.cjs's isRoomOptedOut idiom (first 2KB only;
// frontmatter is always at the top). Absence, an unreadable file, or any
// other value all degrade to null (omitted from extraProps).
function readPwsStage(roomDir) {
  if (typeof roomDir !== 'string' || roomDir.length === 0) return null;
  try {
    const rp = path.join(roomDir, 'ROOM.md');
    const st = fs.statSync(rp);
    if (!st.isFile()) return null;
    const fd = fs.openSync(rp, 'r');
    try {
      const buf = Buffer.alloc(2048);
      const bytes = fs.readSync(fd, buf, 0, 2048, 0);
      const head = buf.slice(0, bytes).toString('utf8');
      const m = head.match(/^pws_stage\s*:\s*["']?(ill_defined|extend_opportunity)["']?\s*$/mi);
      return m ? m[1].toLowerCase() : null;
    } finally {
      try { fs.closeSync(fd); } catch (_e) { /* best effort */ }
    }
  } catch (_e) {
    return null;
  }
}

// fileStampedOpportunity(db, params) -- Phase 355.1-07 extraction: "one
// writer, two callers". params = { a, b, stamp, producer, roomDir, runMode,
// reason, name?, sessionId?, jtbd?, score?, section?, evidenceIds?,
// extraProps? }. a/b are { handle, text }. This is the SAME writeOpportunityNode
// call bankStatements' own stamped branch already made (extraProps merges
// verificationStamp.toNodeProps(stamp) plus pws_stage and engine_mode,
// formula_version 'stamp-v1'; the lifecycle-state column NEVER carries an
// explicit value -- the mint default lands, Part 9 role 5, no confirm path),
// plus the two SOURCED_FROM writeEdge calls (origin 'eureka-355') --
// extracted so the ambient composition and bankStatements share ONE writer
// instead of two. Never opens or closes its own write transaction (the
// caller owns the transaction boundary) and never throws: returns the
// minted node id on success, or null on ANY failure (invalid params, a
// writeOpportunityNode/writeEdge rejection). A
// caller with the pair's full statement context (bankStatements) supplies
// name/sessionId/jtbd/score/section/evidenceIds/extraProps explicitly so its
// own output stays byte-identical to before this extraction; a caller with
// only the bare pair (the ambient composition) gets sensible defaults: name
// is `${aText} x ${bText}`, sessionId defaults to 'ambient', section/jtbd/
// score are omitted, evidenceIds default to [a.handle, b.handle].
function fileStampedOpportunity(db, params) {
  try {
    if (!db || !params || typeof params !== 'object') return null;
    const { a, b, stamp } = params;
    if (!a || !b || typeof a.handle !== 'string' || !a.handle
      || typeof b.handle !== 'string' || !b.handle || !stamp) {
      return null;
    }
    const aText = (typeof a.text === 'string' && a.text) ? a.text : a.handle;
    const bText = (typeof b.text === 'string' && b.text) ? b.text : b.handle;
    const name = (typeof params.name === 'string' && params.name) ? params.name : (aText + ' x ' + bText);
    const sessionId = (typeof params.sessionId === 'string' && params.sessionId) ? params.sessionId : 'ambient';
    const roomDirResolved = (typeof params.roomDir === 'string' && params.roomDir) ? params.roomDir : '';
    const runModeResolved = (typeof params.runMode === 'string' && params.runMode) ? params.runMode : 'unknown';
    const reasonResolved = (typeof params.reason === 'string' && params.reason) ? params.reason : 'stamped finding';

    // D-40: a filesystem read, never a write-transaction read (the caller's
    // own transaction boundary, if any, is unaffected either way).
    const pwsStage = readPwsStage(roomDirResolved);

    const extraProps = Object.assign(
      {},
      (params.extraProps && typeof params.extraProps === 'object') ? params.extraProps : {}
    );
    Object.assign(extraProps, verificationStamp.toNodeProps(stamp));
    if (pwsStage) extraProps.pws_stage = pwsStage;
    extraProps.engine_mode = runModeResolved;

    const evidenceIds = Array.isArray(params.evidenceIds)
      ? params.evidenceIds.filter(function (x) { return typeof x === 'string' && x.length > 0; })
      : [a.handle, b.handle].filter(function (x) { return typeof x === 'string' && x.length > 0; });

    const w = navigation.writeOpportunityNode(db, {
      name: name,
      sessionId: sessionId,
      lifecycle: 'candidate',
      jtbd: (typeof params.jtbd === 'string' && params.jtbd) ? params.jtbd : undefined,
      score: (typeof params.score === 'number' && Number.isFinite(params.score)) ? params.score : undefined,
      section: (typeof params.section === 'string' && params.section) ? params.section : undefined,
      actor: 'system',
      reason: reasonResolved,
      evidence_ids: evidenceIds,
      formula_version: 'stamp-v1',
      extraProps: extraProps,
    });
    if (!w || w.ok !== true) return null;

    // D-38: SOURCED_FROM provenance to each end's source artifact node
    // (falling back to the entity node id itself), origin 'eureka-355'.
    const sourcedTargets = [a.handle, b.handle].map(function (id) { return sourcedFromTarget(db, id); });
    for (const targetId of sourcedTargets) {
      const r2 = navigation.writeEdge(db, {
        source_id: w.node_id,
        target_id: targetId,
        edge_type: 'SOURCED_FROM',
        properties: { relation: 'sourced_from', origin: 'eureka-355' },
      });
      if (!r2 || r2.ok !== true) return null;
    }

    return w.node_id;
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// stampForPair
// ---------------------------------------------------------------------------

// The one not-called stamp the 355 degradation matrix can build: the Stamp
// schema admits backend not_called only with reason handle_unresolved, and
// _theoOutcomeFor returns exactly that when a handle is missing. Built through
// Stamp.parse so it can never drift from the schema.
function notCalledStamp() {
  return verificationStamp.Stamp.parse({
    verification: 'unverified', backend: 'not_called', direction: 'none', judge: 'none', reason: 'handle_unresolved',
  });
}

// carriedOf(db, id): the D-48 carried fields of one thing (frontmatter-style
// framework:, methodology:, and the title), read from its room.db props.
// READ-only; a miss returns null.
function carriedOf(db, id) {
  if (!db || !nonEmpty(id)) return null;
  try {
    const row = db.prepare('SELECT properties FROM nodes WHERE id = ? LIMIT 1').get(id);
    if (!row) return null;
    let p = {};
    try { p = JSON.parse(String(row.properties || '{}')) || {}; } catch (_e) { p = {}; }
    const title = ['title', 'name', 'label'].map(function (k) { return typeof p[k] === 'string' ? p[k].trim() : ''; }).filter(Boolean)[0] || null;
    return {
      framework: typeof p.framework === 'string' ? p.framework.trim() : null,
      methodology: typeof p.methodology === 'string' ? p.methodology.trim() : null,
      title: title,
    };
  } catch (_e) {
    return null;
  }
}

function handleOf(side, ctx) {
  const given = isObj(ctx.carried) ? ctx.carried[side.key] : null;
  const carried = isObj(given) ? given : carriedOf(ctx.db, side.id);
  if (!carried) return null;
  try {
    const r = verificationStamp.resolveEndpoint(carried, isObj(ctx.resolver) ? ctx.resolver : undefined);
    return r && nonEmpty(r.name) ? r.name : null;
  } catch (_e) {
    return null;
  }
}

// readLaneStamp(roomDir, runHomes, key): the first run home whose
// theo-lane.json holds a valid stamp for the key. Each path is derived from a
// run home and must realpath inside the room; a missing, malformed or
// out-of-room file is skipped (T-366-08).
function readLaneStamp(roomDir, runHomes, key) {
  let rootReal = null;
  try { rootReal = fs.realpathSync(path.resolve(roomDir)); } catch (_e) { return null; }
  for (const home of runHomes) {
    if (!nonEmpty(home)) continue;
    try {
      const file = path.join(path.resolve(roomDir, home), THEO_LANE_FILE);
      if (!fs.existsSync(file)) continue;
      const real = fs.realpathSync(file);
      if (real.indexOf(rootReal + path.sep) !== 0) continue;
      const doc = JSON.parse(fs.readFileSync(real, 'utf8'));
      if (!isObj(doc) || doc.schema !== THEO_LANE_SCHEMA || !isObj(doc.stamps)) continue;
      if (!Object.prototype.hasOwnProperty.call(doc.stamps, key)) continue;
      return verificationStamp.Stamp.parse(doc.stamps[key]);
    } catch (_e) {
      // malformed: fall through to the next home, then to the degraded stamp
    }
  }
  return null;
}

/*
 * stampForPair(pair, ctx) -> Stamp. Synchronous, zero tool calls, never throws.
 *   pair: { a, b } node ids (the closed pyramid pair).
 *   ctx:  { db?, carried?: { a, b }, resolver?: { names, registry },
 *           roomDir?, runHomes?: [dir, ...] (absolute or room-relative) }
 * Order: an endpoint without a canon handle -> not_called / handle_unresolved;
 * else a recorded lane stamp for pairKey(a, b) -> that stamp unchanged; else the
 * matrix's not-called stamp (no Theo call happens at filing, ever).
 */
function stampForPair(pair, ctx) {
  try {
    const c = isObj(ctx) ? ctx : {};
    if (!isObj(pair) || !nonEmpty(pair.a) || !nonEmpty(pair.b)) return notCalledStamp();
    const ha = handleOf({ key: 'a', id: pair.a }, c);
    const hb = handleOf({ key: 'b', id: pair.b }, c);
    if (!ha || !hb) return notCalledStamp();
    if (nonEmpty(c.roomDir)) {
      const homes = Array.isArray(c.runHomes) ? c.runHomes : (nonEmpty(c.runHomes) ? [c.runHomes] : []);
      const lane = readLaneStamp(c.roomDir, homes, pairKey(pair.a, pair.b));
      if (lane) return lane;
    }
    return notCalledStamp();
  } catch (_e) {
    return notCalledStamp();
  }
}

module.exports = {
  THEO_LANE_FILE: THEO_LANE_FILE,
  THEO_LANE_SCHEMA: THEO_LANE_SCHEMA,
  pairKey: pairKey,
  fileStampedOpportunity: fileStampedOpportunity,
  readPwsStage: readPwsStage,
  sourcedFromTarget: sourcedFromTarget,
  stampForPair: stampForPair,
};
