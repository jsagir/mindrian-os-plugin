'use strict';
/*
 * lib/core/doctor/umbilical-module.cjs -- the FIRST registered accumulative-engine
 * doctor module (Phase 139 Plan 03, S3 "Umbilical first module").
 *
 * What it does (minimal per the scope_slice LOCKED decision -- marker read + edge
 * projection + an integrity check, nothing more):
 *
 *   - Reads `.umbilical` marker files (a non-room project declares its affiliation
 *     to one or more registered rooms). Fields (YAML-ish, line-oriented):
 *         room:     slug  (or `room: a, b` / a YAML-ish list -- one or many)
 *         relation: code|deck|research|deploy|doc|data  (closed set)
 *         born:     <ISO date>
 *         note:     <freeform>  -- stays LOCAL, NEVER lands on the edge (Part 8)
 *   - PROJECTS exactly ONE AFFILIATED_WITH edge per (marker, room) pair into the
 *     TARGET room's OWN room.db via lib/core/navigation/edges.cjs::writeEdge.
 *   - INTEGRITY check (read-only): orphan_cord (room: does not resolve to a real
 *     registered room), removed_marker (an AFFILIATED_WITH edge exists in a room.db
 *     but its originating marker is gone), unprojected_cord (a valid marker whose
 *     edge is not yet in the target room.db).
 *
 * Contract (the runner contract the Plan-02 selector `runAccumulativeEngine` calls):
 *   check(ctx) -> { status: 'ok'|'warn', findings: [...], detail }   // read-only
 *   fix(ctx)   -> { status, projected: N, suggested: [...], detail } // projects edges
 *
 * ctx (all optional -- the module degrades gracefully): {
 *   home,          // rooms-home root (default MINDRIAN_ROOMS_HOME ||
 *                  //   <HOME>/MindrianRooms) -- the registry lives at
 *                  //   <home>/.rooms/registry.json
 *   scanDirs,      // candidate project dirs to scan for `.umbilical` markers
 *                  //   (bounded; the skeleton does NOT walk the whole FS)
 *   dryRun,        // when true, fix() reports what WOULD be projected, writes nothing
 *   running,       // the running version (carried by the selector; unused here)
 * }
 *
 * Canon constraints honored:
 *   - umbilical_storage: cords authoritative at the REGISTRY layer; projected into
 *     each room.db as LOCAL AFFILIATED_WITH edges (Part 8: no raw cross-room edges).
 *   - marker_format: explicit declaration ONLY. `--fix` may SUGGEST orphan cords
 *     for human confirmation (suggested[]) but NEVER auto-creates a marker/cord.
 *   - Canon Part 8: the edge lands in the TARGET room's OWN room.db only; ENUM-only
 *     scalar properties (relation, born); `note:` NEVER on the edge; ZERO Brain
 *     egress, ZERO network surface (no fetch/http/brain client of any kind).
 *   - Part 7 reuse-before-build: reuses edges.cjs::writeEdge (UPSERT, idempotent --
 *     re-running yields the SAME single edge) WITHOUT forking it; opens the target
 *     room.db through the allow-listed navigation chokepoint
 *     (spine-events.cjs::openRoomDbForCaller) rather than requiring node:sqlite here.
 *   - soft-fail per marker: one bad marker never aborts the rest.
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

const { writeEdge } = require('../navigation/edges.cjs');
const { insertNode } = require('../node-insert.cjs');
const {
  openRoomDbForCaller,
  closeRoomDbForCaller,
} = require('../navigation/spine-events.cjs');

// Closed relation vocabulary (marker_format LOCKED decision). An unknown relation
// produces a finding and the marker is SKIPPED (never guessed).
const RELATIONS = Object.freeze(new Set(['code', 'deck', 'research', 'deploy', 'doc', 'data']));

// ---------------------------------------------------------------------------
// Marker parsing
// ---------------------------------------------------------------------------

// parseUmbilicalMarker(markerPath) -> {
//   rooms: string[],            // one or many declared room slugs
//   relation: string|null,      // raw relation value (may be invalid)
//   born: string|null,
//   note: string|null,          // freeform -- LOCAL only, never on the edge
//   relationValid: boolean,     // relation is in the closed RELATIONS set
//   ok: boolean,                // the marker parsed into at least one room slug
// }
// Tolerant: a marker we cannot read yields { ok:false, ... } (soft-fail, never throw).
function parseUmbilicalMarker(markerPath) {
  const out = {
    rooms: [],
    relation: null,
    born: null,
    note: null,
    relationValid: false,
    ok: false,
  };
  let raw;
  try {
    raw = fs.readFileSync(markerPath, 'utf8');
  } catch (_e) {
    return out;
  }
  const lines = String(raw).split(/\r?\n/);
  for (const line of lines) {
    let m;
    if ((m = /^\s*room\s*:\s*(.+?)\s*$/.exec(line))) {
      // scalar OR comma/space-separated list OR `[a, b]` -- collect ALL slugs.
      const val = m[1].replace(/^[\[\s'"]+|[\]\s'"]+$/g, '');
      for (const tok of val.split(/[,\s]+/).filter(Boolean)) {
        if (!out.rooms.includes(tok)) out.rooms.push(tok);
      }
    } else if ((m = /^\s*relation\s*:\s*(.+?)\s*$/.exec(line))) {
      out.relation = m[1].replace(/^['"]+|['"]+$/g, '').trim();
    } else if ((m = /^\s*born\s*:\s*(.+?)\s*$/.exec(line))) {
      out.born = m[1].replace(/^['"]+|['"]+$/g, '').trim();
    } else if ((m = /^\s*note\s*:\s*(.*)$/.exec(line))) {
      // note: freeform -- captured for LOCAL use ONLY; NEVER projected onto the edge.
      out.note = m[1];
    }
  }
  out.relationValid = !!out.relation && RELATIONS.has(out.relation);
  out.ok = out.rooms.length > 0;
  return out;
}

// ---------------------------------------------------------------------------
// Registry resolution (slug -> abs_path) -- mirrors resolve-umbilical-target's
// private resolveSlugAgainstRegistry (which is not exported). Reads ONLY the
// LOCAL registry file. Returns abs_path string or null. Honors sealed/archived.
// ---------------------------------------------------------------------------
function resolveSlugAgainstRegistry(slug, home) {
  if (!slug) return null;
  const regPath = path.join(home, '.rooms', 'registry.json');
  if (!fs.existsSync(regPath)) return null;
  let reg;
  try {
    reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
  } catch (_e) {
    return null;
  }
  if (!reg) return null;

  let entry = null;
  if (Array.isArray(reg.rooms)) {
    entry = reg.rooms.find((r) => r && (r.slug === slug || r.name === slug)) || null;
  } else if (reg.rooms && typeof reg.rooms === 'object') {
    entry = reg.rooms[slug] || null;
  }
  if (!entry) return null;

  if (entry.sealed === true) return null;
  if (entry.status === 'sealed' || entry.status === 'archived') return null;

  let absPath;
  if (typeof entry.abs_path === 'string' && entry.abs_path.length > 0) {
    absPath = entry.abs_path;
  } else if (typeof entry.path === 'string' && entry.path.length > 0) {
    absPath = path.isAbsolute(entry.path) ? entry.path : path.join(home, entry.path);
  } else {
    absPath = path.join(home, slug);
  }
  if (!fs.existsSync(absPath)) return null;
  return absPath;
}

// ---------------------------------------------------------------------------
// Marker discovery (bounded -- skeleton scope). We do NOT walk the whole FS:
// scan each ctx.scanDirs entry (and its immediate children) for a `.umbilical`.
// ---------------------------------------------------------------------------
function discoverMarkers(scanDirs) {
  const found = [];
  const seen = new Set();
  function consider(dir) {
    let markerPath;
    try {
      markerPath = path.join(dir, '.umbilical');
      if (fs.existsSync(markerPath) && fs.statSync(markerPath).isFile()) {
        const real = fs.realpathSync(markerPath);
        if (!seen.has(real)) {
          seen.add(real);
          found.push({ markerPath, projectDir: dir });
        }
      }
    } catch (_e) {
      /* soft-fail this dir */
    }
  }
  for (const base of scanDirs || []) {
    if (!base || typeof base !== 'string') continue;
    consider(base);
    // immediate children (one level) -- bounded, no recursion.
    let kids = [];
    try {
      kids = fs.readdirSync(base, { withFileTypes: true });
    } catch (_e) {
      kids = [];
    }
    for (const d of kids) {
      if (d.isDirectory()) consider(path.join(base, d.name));
    }
  }
  return found;
}

// Stable source-id for a project tree (the cord's local endpoint). Uses the
// project dir basename as a readable handle; the edge's identity is
// (source, target, type) so this is deterministic + idempotent under UPSERT.
function projectHandle(projectDir) {
  return 'project:' + path.basename(path.resolve(projectDir));
}

function roomTargetId(slug) {
  return 'room:' + slug;
}

// Does an AFFILIATED_WITH edge already exist in this room.db for (source, room)?
function edgeExists(db, sourceId, slug) {
  try {
    const row = db
      .prepare('SELECT 1 FROM edges WHERE source = ? AND target = ? AND type = ? LIMIT 1')
      .get(sourceId, roomTargetId(slug), 'AFFILIATED_WITH');
    return !!row;
  } catch (_e) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// ctx normalization
// ---------------------------------------------------------------------------
function normCtx(ctx) {
  const c = ctx || {};
  const home =
    c.home ||
    process.env.MINDRIAN_ROOMS_HOME ||
    path.join(process.env.HOME || process.env.USERPROFILE || os.homedir(), 'MindrianRooms');
  const scanDirs = Array.isArray(c.scanDirs) && c.scanDirs.length > 0 ? c.scanDirs : [process.cwd()];
  return { home, scanDirs, dryRun: !!c.dryRun };
}

// ---------------------------------------------------------------------------
// check(ctx) -- read-only integrity check. NEVER mutates.
// ---------------------------------------------------------------------------
function check(ctx) {
  const { home, scanDirs } = normCtx(ctx);
  const findings = [];
  let markers = [];
  try {
    markers = discoverMarkers(scanDirs);
  } catch (_e) {
    markers = [];
  }

  for (const { markerPath, projectDir } of markers) {
    let parsed;
    try {
      parsed = parseUmbilicalMarker(markerPath);
    } catch (_e) {
      continue; // soft-fail this marker
    }
    if (!parsed.ok) {
      findings.push({ kind: 'unparseable_marker', marker: markerPath });
      continue;
    }
    if (parsed.relation && !parsed.relationValid) {
      findings.push({ kind: 'invalid_relation', marker: markerPath, relation: parsed.relation });
      // continue -- still inspect rooms for orphan detection, but a projection
      // would be skipped in fix() for an invalid relation.
    }
    const sourceId = projectHandle(projectDir);
    for (const slug of parsed.rooms) {
      const absPath = resolveSlugAgainstRegistry(slug, home);
      if (!absPath) {
        // orphan: cord points at a room that does not resolve (T-139-12).
        findings.push({ kind: 'orphan_cord', marker: markerPath, room: slug });
        continue;
      }
      let db = null;
      try {
        db = openRoomDbForCaller(absPath);
        if (!db) {
          // target room has no room.db yet -> its cord is unprojected.
          findings.push({ kind: 'unprojected_cord', marker: markerPath, room: slug, target: absPath });
          continue;
        }
        if (edgeExists(db, sourceId, slug)) {
          // already projected -- healthy.
        } else {
          findings.push({ kind: 'unprojected_cord', marker: markerPath, room: slug, target: absPath });
        }
      } catch (_e) {
        // soft-fail this (marker, room) pair.
      } finally {
        closeRoomDbForCaller(db);
      }
    }
  }

  // removed_marker detection: an AFFILIATED_WITH edge present in a registered
  // room.db whose originating `.umbilical` marker is GONE (cord<->marker
  // bidirectionality broken). We check every project handle that DID have a
  // marker against every room.db; for rooms reachable via the registry, any
  // AFFILIATED_WITH edge whose source has no live marker is a removed_marker.
  try {
    const liveSources = new Set(markers.map((m) => projectHandle(m.projectDir)));
    const roomDirs = collectRegistryRoomDirs(home);
    for (const roomDir of roomDirs) {
      let db = null;
      try {
        db = openRoomDbForCaller(roomDir);
        if (!db) continue;
        let rows = [];
        try {
          rows = db
            .prepare("SELECT source, target FROM edges WHERE type = 'AFFILIATED_WITH'")
            .all();
        } catch (_e) {
          rows = [];
        }
        for (const r of rows) {
          if (!liveSources.has(r.source)) {
            findings.push({ kind: 'removed_marker', room: roomDir, source: r.source, target: r.target });
          }
        }
      } catch (_e) {
        /* soft-fail this room */
      } finally {
        closeRoomDbForCaller(db);
      }
    }
  } catch (_e) {
    /* removed-marker sweep is best-effort */
  }

  const status = findings.length > 0 ? 'warn' : 'ok';
  return {
    status,
    findings,
    detail: `umbilical: scanned ${markers.length} marker(s); ${findings.length} finding(s)`,
  };
}

// Collect abs_paths of all registered, non-sealed rooms (for the removed_marker
// sweep). Best-effort; returns [] on any error.
function collectRegistryRoomDirs(home) {
  const out = [];
  try {
    const regPath = path.join(home, '.rooms', 'registry.json');
    if (!fs.existsSync(regPath)) return out;
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    if (!reg) return out;
    let entries = [];
    if (Array.isArray(reg.rooms)) {
      entries = reg.rooms.map((r) => (r && (r.slug || r.name)) || null).filter(Boolean);
    } else if (reg.rooms && typeof reg.rooms === 'object') {
      entries = Object.keys(reg.rooms);
    }
    for (const slug of entries) {
      const abs = resolveSlugAgainstRegistry(slug, home);
      if (abs && !out.includes(abs)) out.push(abs);
    }
  } catch (_e) {
    return out;
  }
  return out;
}

// ---------------------------------------------------------------------------
// fix(ctx) -- projects edges for valid unprojected cords; SUGGESTS orphan cords
// (never auto-creates). Honors dryRun. Soft-fail per marker.
// ---------------------------------------------------------------------------
function fix(ctx) {
  const { home, scanDirs, dryRun } = normCtx(ctx);
  let projected = 0;
  const suggested = [];
  const errors = [];
  let markers = [];
  try {
    markers = discoverMarkers(scanDirs);
  } catch (_e) {
    markers = [];
  }

  for (const { markerPath, projectDir } of markers) {
    let parsed;
    try {
      parsed = parseUmbilicalMarker(markerPath);
    } catch (_e) {
      continue; // soft-fail
    }
    if (!parsed.ok) continue;
    // Unknown relation -> skip projection (never guess). The check() surfaces it.
    if (parsed.relation && !parsed.relationValid) continue;

    const sourceId = projectHandle(projectDir);
    for (const slug of parsed.rooms) {
      const absPath = resolveSlugAgainstRegistry(slug, home);
      if (!absPath) {
        // orphan -> SUGGEST for human confirmation; do NOT create a cord/marker
        // and do NOT write an edge (marker_format LOCKED + T-139-10 / T-139-12).
        suggested.push({ marker: markerPath, room: slug, reason: 'orphan_cord' });
        continue;
      }
      if (dryRun) {
        // report-only: would project, write nothing.
        projected += 1;
        continue;
      }
      let db = null;
      try {
        db = openRoomDbForCaller(absPath);
        if (!db) {
          // room.db absent -> cannot project yet; skip (the next run, once the
          // room.db exists, will project). Soft-fail, not an error.
          continue;
        }
        // FK targets: the edges table FK-references nodes(id) and openRoomDb sets
        // foreign_keys = ON, so ensure both endpoint nodes exist before the edge.
        ensureNode(db, sourceId, 'Project');
        ensureNode(db, roomTargetId(slug), 'Room');
        // Project EXACTLY ONE AFFILIATED_WITH edge into the TARGET room's OWN
        // room.db. ENUM/scalar properties ONLY -- relation + born; the marker's
        // `note:` is NEVER included (Canon Part 8). UPSERT => idempotent.
        const props = {};
        if (parsed.relationValid) props.relation = parsed.relation;
        if (parsed.born) props.born = parsed.born;
        const res = writeEdge(db, {
          source_id: sourceId,
          target_id: roomTargetId(slug),
          edge_type: 'AFFILIATED_WITH',
          properties: props,
        });
        if (res && res.ok) {
          projected += 1;
        } else {
          errors.push({ marker: markerPath, room: slug, reason: (res && res.reason) || 'write_failed' });
        }
      } catch (e) {
        errors.push({ marker: markerPath, room: slug, reason: String((e && e.message) || e).slice(0, 80) });
      } finally {
        closeRoomDbForCaller(db);
      }
    }
  }

  const status = errors.length > 0 ? 'warn' : 'ok';
  return {
    status,
    projected,
    suggested,
    errors,
    detail: `umbilical: projected ${projected} edge(s); ${suggested.length} suggested; ${errors.length} error(s)${dryRun ? ' (dry-run)' : ''}`,
  };
}

// Ensure a node row exists (FK target for the edge). INSERT ... DO NOTHING --
// never overwrites an existing node. The Phase 109 nodes schema carries NOT NULL
// provenance columns (source_path, created_by enum, created_at, last_seen_at) and
// a review_status enum, so all are supplied. These endpoint nodes (Project / Room)
// are SYSTEM-BOOKKEEPING navigation handles, NOT truth-claim nodes -- per the
// Canon Part 9 audit-node carve-out they legitimately carry created_by='system';
// review_status stays the schema default 'proposed' (no human-confirmed truth is
// asserted by a cord projection). Mirrors the lazygraph node-upsert idiom; does
// NOT fork writeEdge. Best-effort (soft-fail).
function ensureNode(db, id, type) {
  try {
    // on_conflict:'nothing' is MANDATORY: this function's documented contract
    // is "never overwrites an existing node," and insertNode's default DO
    // UPDATE would clobber a real Project or Room node's properties with '{}'.
    //
    // Soft spot (T-R17-04, carried into the SUMMARY): this try/catch silently
    // swallows ALL errors by design (best-effort FK target). Once Task 5 makes
    // epistemic_type required at the chokepoint, a missing/invalid value here
    // fails silently instead of loudly -- the only consequence is a missing FK
    // target, which surfaces immediately as a downstream edge-write error.
    insertNode(db, id, type, '{}', {
      source_path: 'umbilical-cord',
      created_by: 'system',
      on_conflict: 'nothing',
      // R17-02 (Task 4 Decision 4): 'observation' -- system bookkeeping
      // (the umbilical Project/Room handles).
      epistemic_type: 'observation',
    });
  } catch (_e) {
    /* best-effort; if it fails the FK insert will surface a write error */
  }
}

module.exports = {
  check,
  fix,
  // exported for hermetic unit tests:
  parseUmbilicalMarker,
  RELATIONS,
};
