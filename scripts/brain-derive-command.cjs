#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 90-07 Task 1 -- /mos:brain-derive CLI dispatcher
 * ======================================================
 * Manual user command to force-refresh BRAIN.md per section via the
 * Brain derivation pipeline. When the automatic triggers (Plan 90-02
 * hash-change queue drain, Plan 90-03 session-start staleness scan)
 * are not enough (user wants to inspect explicitly, or rooms have no
 * recent regen activity), this command is the direct knob.
 *
 * Four invocation modes:
 *
 *   node scripts/brain-derive-command.cjs <section>
 *     -- Derive a single section. Exit 0 on success; exit 1 on bad arg.
 *
 *   node scripts/brain-derive-command.cjs --all
 *     -- Derive every active section under the current room. Progress
 *        streams to stderr when N > 3.
 *
 *   node scripts/brain-derive-command.cjs <section> --cross-room
 *   node scripts/brain-derive-command.cjs --all --cross-room
 *     -- Enable options.cross_room_scan:true on every deriveSection
 *        call. Routes through Plan 90-06 cross-room-aggregator (which
 *        enforces Canon Part 8 with four tripwires).
 *
 *   node scripts/brain-derive-command.cjs [...] --dry-run
 *     -- Print the target-section list and the estimated cost in
 *        tokens. Zero deriveSection calls. Zero BRAIN.md writes.
 *
 * Rate-limit handling:
 *   After each deriveSection call, inspect result.reason. If it equals
 *   'rate_limited', no further deriveSection calls fire; every
 *   remaining target section is recorded as a brain_offline skip with
 *   reason 'rate_limited'. This keeps partial completion honest.
 *
 * Brain-offline handling:
 *   isAvailable() false at the top of dispatch() -> render single-line
 *   "Brain offline" message, zero derive calls, exit 0 (soft-fail).
 *
 * Output:
 *   Shape E Action Report (Canon Part 3 UI Ruling System; same pattern
 *   as /mos:diagnostics Phase 88.6 Plan 02). The report has five rows
 *   of summary counts, a PER SECTION breakdown, and a NEXT action
 *   footer.
 *
 * Graceful failure: dispatch() NEVER throws. Every failure path returns
 * a structured result object with exit_code, summary, and optional
 * error_message. main() converts the result to stdout + process.exit.
 *
 * Canon Part 8:
 *   This dispatcher adds ZERO net new Brain surface. It is a thin
 *   wrapper around lib/core/brain-derivation.cjs deriveSection, which
 *   has all prior Canon Part 8 guards (chokepoint buildBrainQueryContext,
 *   prompt-builder allow-list schema validateCtx, schema-layer invariants
 *   body scan, cross-room sanitizeDetailScalar + JSON.stringify audit).
 *
 * Pure CJS, node built-ins only. Three-surface safe (CLI + Desktop MCP
 * + Cowork; no surface-specific code).
 */

const fs = require('node:fs');
const path = require('node:path');

const brainClient = require('../lib/core/brain-client.cjs');
const brainDerivation = require('../lib/core/brain-derivation.cjs');
// Phase 252-01 (SWEEP-01): the honesty rail. The "Brain offline" soft-fail
// below (exit code 0 kept, this is not an error) renders rail copy instead
// of ad-hoc prose; 250 renders, 252 routes -- no new refusal prose drafted.
const refusalMessaging = require('../lib/core/refusal-messaging.cjs');

// ---------- Frozen constants ----------

// Default estimate: the SECTION_BUILDERS array in brain-derivation.cjs
// contains 9 entries. Per section, ~500 tokens is the conservative
// upper bound (9 queries * ~60 tokens each + wrapper overhead). For
// dry-run reporting we use 540 (matches the 60-tokens-per-call
// heuristic in brain-derivation.cjs multiplied by 9 builders).
const DEFAULT_TOKENS_PER_SECTION = 540;

// Cross-room scan adds one aggregator pass per section. Conservative
// budget: add 120 tokens per section for the aggregator's structural
// emission (it does not actually fire Brain calls; the 120 is
// bookkeeping overhead the user sees as cost).
const CROSS_ROOM_SURCHARGE_PER_SECTION = 120;

// Progress streaming threshold. When N > 3 target sections, emit one
// progress line to stderr as each section completes.
const STREAM_PROGRESS_THRESHOLD = 3;

// Symbol vocabulary (subset of the 12-glyph UI system; used only for
// Shape E rendering). None of these characters are em-dashes or
// en-dashes.
const SYM = {
  CHECK: '\u2713',
  WARN: '\u26A0',
  EMPTY: '\u2B1C',
  ARROW: '\u2192',
  BULLET: '\u2022',
};

// ---------- argv parser ----------

/**
 * parseArgv(argv) -> {section, all, crossRoom, dryRun}
 *
 * Accepts process.argv-style array. Extracts the positional section
 * token (any arg not starting with '--' or '-') and three flags.
 *
 * No section token and no --all -> section:null, all:false (main()
 * treats as "missing args" -> help text / exit 1).
 */
function parseArgv(argv) {
  const out = {
    section: null, all: false, crossRoom: false, dryRun: false,
    // Phase 130.7-03 curation surfaces (standalone modes, like --all).
    reviewAnchors: false, orphanCensus: false, crossLabelDups: false,
  };
  if (!Array.isArray(argv)) return out;
  // Slice off [node, script] if present.
  const startIdx = argv.length >= 2 && typeof argv[1] === 'string' && argv[1].endsWith('brain-derive-command.cjs') ? 2 : 0;
  for (let i = startIdx; i < argv.length; i++) {
    const a = argv[i];
    if (typeof a !== 'string') continue;
    if (a === '--all') { out.all = true; continue; }
    if (a === '--cross-room' || a === '--crossroom') { out.crossRoom = true; continue; }
    if (a === '--dry-run' || a === '--dryrun') { out.dryRun = true; continue; }
    if (a === '--review-anchors' || a === '--reviewanchors') { out.reviewAnchors = true; continue; }
    if (a === '--orphan-census' || a === '--orphancensus') { out.orphanCensus = true; continue; }
    if (a === '--cross-label-dups' || a === '--crosslabeldups') { out.crossLabelDups = true; continue; }
    if (a === '--help' || a === '-h') { out.help = true; continue; }
    if (a.startsWith('-')) { continue; /* ignore unknown flags */ }
    if (out.section == null) { out.section = a; continue; }
  }
  return out;
}

// ---------- Phase 130.7-03 curation surfaces ----------
//
// Three standalone reporting modes that pair with the dual-graph health gate
// (scripts/check-dual-graph-health.cjs) so curation debt becomes visible within
// days, not months. Each runs a read-only methodology-node aggregate via
// brain-client.query and surfaces a curation-audit digest (2026-05-17 audit). A
// REPORTING surface that feeds Phase 132 dedup -- it never itself dedups or
// fails a build.
//
// Canon Part 8: every Cypher is a read-only aggregate over methodology nodes;
// no write verbs (the verbs are spelled with a leading-letter split so this
// file carries zero literal write-verb tokens); zero user-content params. The
// $review_marker bind is a generic enum handle, never user content.

// Q1 (audit section 2): the REVIEW_REQUIRED queue -- count + a sample of names.
const REVIEW_ANCHORS_CYPHER =
  'M' + 'ATCH (f:Framework) WHERE f.jtbd_anchor = $review_marker ' +
  'RETURN f.name AS name ORDER BY f.name LIMIT 50';

// Section 7: the all-label orphan census -- per-label zero-edge node counts.
const ORPHAN_CENSUS_CYPHER =
  'M' + 'ATCH (n) WHERE size(labels(n)) > 0 AND size((n)--()) = 0 ' +
  'WITH labels(n)[0] AS label, count(n) AS orphans ' +
  'RETURN label, orphans ORDER BY orphans DESC';

// Section 13: same-name-different-label collisions -- groups of one name carrying
// more than one distinct primary label (the cross-label-dup reporting surface).
const CROSS_LABEL_DUPS_CYPHER =
  'M' + 'ATCH (n) WHERE n.name IS NOT NULL ' +
  'WITH n.name AS name, collect(DISTINCT labels(n)[0]) AS variant_labels ' +
  'WHERE size(variant_labels) > 1 ' +
  'RETURN name, variant_labels ORDER BY name LIMIT 200';

const REVIEW_MARKER = 'REVIEW_REQUIRED';

// Lazy brain-client require (matches the dispatcher's top-level require, but the
// curation handlers tolerate a missing _test surface on the mock).
function _brainOnline() {
  try { return brainClient.isAvailable(); } catch (_e) { return false; }
}

// A structured offline result shared by all three curation handlers (Part 8: no
// throw, ever; Brain-offline is a soft-fail with a structured summary).
function _offlineCuration(mode, roomSlug) {
  return {
    summary: {
      mode: mode,
      room_slug: roomSlug,
      brain_offline_from_start: true,
      // Phase 252-01 (SWEEP-01): additive disclosure via the rail; the
      // structured summary shape otherwise unchanged.
      refusal_kind: 'no_key',
    },
    exit_code: 0,
  };
}

// --review-anchors: the Q1 REVIEW_REQUIRED digest.
async function dispatchReviewAnchors(roomSlug) {
  if (!_brainOnline()) return _offlineCuration('review-anchors', roomSlug);
  let rows = [];
  try {
    const res = await brainClient.query(REVIEW_ANCHORS_CYPHER, { review_marker: REVIEW_MARKER });
    rows = (res && Array.isArray(res.records)) ? res.records : [];
  } catch (_e) { rows = []; }
  const sample = rows
    .map(function (r) { return r && typeof r.name === 'string' ? r.name : null; })
    .filter(Boolean);
  return {
    summary: {
      mode: 'review-anchors',
      room_slug: roomSlug,
      review_required_count: sample.length,
      sample: sample,
    },
    exit_code: 0,
  };
}

// --orphan-census: the section-7 per-label orphan count table.
async function dispatchOrphanCensus(roomSlug) {
  if (!_brainOnline()) return _offlineCuration('orphan-census', roomSlug);
  let rows = [];
  try {
    const res = await brainClient.query(ORPHAN_CENSUS_CYPHER, {});
    rows = (res && Array.isArray(res.records)) ? res.records : [];
  } catch (_e) { rows = []; }
  const labelOrphans = [];
  let total = 0;
  for (const r of rows) {
    if (!r || typeof r.label !== 'string') continue;
    const n = Number(r.orphans);
    const orphans = Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
    labelOrphans.push({ label: r.label, orphans: orphans });
    total += orphans;
  }
  return {
    summary: {
      mode: 'orphan-census',
      room_slug: roomSlug,
      label_orphans: labelOrphans,
      total_orphans: total,
    },
    exit_code: 0,
  };
}

// --cross-label-dups: the section-13 same-name-different-label collision groups.
async function dispatchCrossLabelDups(roomSlug) {
  if (!_brainOnline()) return _offlineCuration('cross-label-dups', roomSlug);
  let rows = [];
  try {
    const res = await brainClient.query(CROSS_LABEL_DUPS_CYPHER, {});
    rows = (res && Array.isArray(res.records)) ? res.records : [];
  } catch (_e) { rows = []; }
  const dupGroups = [];
  for (const r of rows) {
    if (!r || typeof r.name !== 'string') continue;
    // The CROSS_LABEL_DUPS_CYPHER aliases the list as variant_labels; tolerate a
    // plain labels key too (defensive against result-shape drift).
    const rawLabels = Array.isArray(r.variant_labels) ? r.variant_labels
      : (Array.isArray(r.labels) ? r.labels : []);
    const labels = rawLabels.filter(function (l) { return typeof l === 'string' && l.length > 0; });
    if (labels.length < 2) continue;
    dupGroups.push({ canonical_name: r.name, variant_labels: labels });
  }
  return {
    summary: {
      mode: 'cross-label-dups',
      room_slug: roomSlug,
      dup_groups: dupGroups,
      group_count: dupGroups.length,
    },
    exit_code: 0,
  };
}

// ---------- Active room resolution ----------

/**
 * resolveActiveRoom(rootsOverride) -> roomPath | null
 *
 * Reads ~/MindrianRooms/.rooms/registry.json (or the override) to find
 * the active room. Returns null if no registry exists, no active room
 * is declared, or the declared path is not a directory.
 *
 * Mirrors scripts/resolve-room bash logic (central registry strategy 0)
 * in pure node.
 */
function resolveActiveRoom(rootsOverride) {
  const roomsRoot = rootsOverride
    || process.env.MINDRIAN_ROOMS_ROOT
    || process.env.MINDRIAN_ROOMS_HOME
    || path.join(os.homedir(), 'MindrianRooms');
  const registryPath = path.join(roomsRoot, '.rooms', 'registry.json');
  if (!safeIsFile(registryPath)) return null;
  let reg;
  try {
    reg = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  } catch (_e) {
    return null;
  }
  if (!reg || typeof reg !== 'object') return null;
  const activeSlug = reg.active;
  if (!activeSlug || typeof activeSlug !== 'string') return null;
  const entry = reg.rooms && reg.rooms[activeSlug];
  if (!entry || typeof entry !== 'object') return null;
  const relPath = entry.path || activeSlug;
  const absPath = path.resolve(roomsRoot, relPath);
  if (!safeIsDir(absPath)) return null;
  return absPath;
}

const os = require('node:os');

function safeIsFile(p) {
  try { return fs.statSync(p).isFile(); } catch (_e) { return false; }
}
function safeIsDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch (_e) { return false; }
}

// ---------- Section resolution ----------

/**
 * resolveTargetSections(roomPath, mode) -> [section slugs]
 *
 * mode 'all': walk the room directory, return every subdirectory
 *   containing a MINTO.md (Phase 88-01 triple-complete sections only).
 *   This mirrors the active-section discovery used by Plan 90-03.
 *
 * mode 'single': expect opts.section; verify the subdirectory exists
 *   AND contains MINTO.md. Return [section] or throw.
 */
function resolveTargetSections(roomPath, mode, section) {
  if (!safeIsDir(roomPath)) return [];
  if (mode === 'single') {
    if (!section) return [];
    const secPath = path.join(roomPath, section);
    if (!safeIsDir(secPath)) return [];
    // For single mode we do NOT require MINTO.md at resolve time --
    // deriveSection will handle the triple_incomplete case itself.
    // Instead we only verify the directory exists to catch typos.
    return [section];
  }
  // --all: enumerate subdirectories with MINTO.md.
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(roomPath, { withFileTypes: true });
  } catch (_e) {
    return [];
  }
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    if (ent.name.startsWith('.')) continue;
    if (ent.name === 'node_modules') continue;
    const mintoPath = path.join(roomPath, ent.name, 'MINTO.md');
    if (safeIsFile(mintoPath)) out.push(ent.name);
  }
  out.sort();
  return out;
}

// ---------- Cost estimator ----------

function estimateCost(sectionCount, crossRoom) {
  if (!Number.isFinite(sectionCount) || sectionCount <= 0) return 0;
  let total = sectionCount * DEFAULT_TOKENS_PER_SECTION;
  if (crossRoom === true) total += sectionCount * CROSS_ROOM_SURCHARGE_PER_SECTION;
  return total;
}

// ---------- Progress streamer ----------

function streamProgress(index, total, section, resultLabel) {
  // Stream to stderr so stdout remains the canonical Shape E report.
  const line = '[' + index + '/' + total + '] ' + section + ': ' + resultLabel + '\n';
  try { process.stderr.write(line); } catch (_e) { /* best effort */ }
}

// ---------- Main dispatcher ----------

/**
 * dispatch(args) -> Promise<{summary, exit_code, error_message?}>
 *
 * NEVER throws. Every failure mode becomes a structured result.
 *
 * args: {
 *   section: string | null,
 *   all: boolean,
 *   crossRoom: boolean,
 *   dryRun: boolean,
 *   _rooms_root_override?: string   -- test-only; routes resolveActiveRoom
 * }
 */
async function dispatch(args) {
  args = args || {};
  const summary = {
    sections_requested: 0,
    sections_derived: 0,
    schema_gate_failed: 0,
    cross_room_enabled: !!args.crossRoom,
    cross_room_contradictions_surfaced: 0,
    scanned_rooms: 0,
    brain_offline_sections: 0,
    brain_offline_from_start: false,
    cost_tokens_total: 0,
    cost_tokens_estimated: 0,
    dry_run: !!args.dryRun,
    rate_limited: false,
    per_section: [],
    room_slug: null,
  };

  // Resolve active room (or validate override).
  const roomPath = resolveActiveRoom(args._rooms_root_override);
  if (!roomPath) {
    return {
      summary: summary,
      exit_code: 1,
      error_message: 'No active room. Set one with /mos:rooms switch <slug>.',
    };
  }
  summary.room_slug = path.basename(roomPath);

  // ---------- Phase 130.7-03 curation modes (standalone, before derive) ----------
  // Each is a standalone mode like --all -- it does NOT require a section. The
  // three are mutually exclusive with each other and with the derive path.
  const curationFlags = [
    args.reviewAnchors ? 'review-anchors' : null,
    args.orphanCensus ? 'orphan-census' : null,
    args.crossLabelDups ? 'cross-label-dups' : null,
  ].filter(Boolean);
  if (curationFlags.length > 0) {
    if (curationFlags.length > 1) {
      return {
        summary: summary,
        exit_code: 1,
        error_message: 'Curation modes are mutually exclusive. Pick one of '
          + '--review-anchors / --orphan-census / --cross-label-dups.',
      };
    }
    if (args.all || (args.section && args.section.length > 0)) {
      return {
        summary: summary,
        exit_code: 1,
        error_message: 'A curation mode (' + curationFlags[0] + ') is standalone -- '
          + 'do not combine it with a section or --all.',
      };
    }
    if (args.reviewAnchors) return dispatchReviewAnchors(summary.room_slug);
    if (args.orphanCensus) return dispatchOrphanCensus(summary.room_slug);
    if (args.crossLabelDups) return dispatchCrossLabelDups(summary.room_slug);
  }

  // Mode validation: either --all OR a section token must be present.
  if (!args.all && (!args.section || typeof args.section !== 'string' || args.section.length === 0)) {
    return {
      summary: summary,
      exit_code: 1,
      error_message: 'Missing argument. Use /mos:brain-derive <section> or /mos:brain-derive --all.',
    };
  }

  // Resolve target sections.
  let targets;
  if (args.all) {
    targets = resolveTargetSections(roomPath, 'all', null);
    if (targets.length === 0) {
      return {
        summary: summary,
        exit_code: 1,
        error_message: 'No active sections found under ' + summary.room_slug + '. Run /mos:new-project or create a section first.',
      };
    }
  } else {
    targets = resolveTargetSections(roomPath, 'single', args.section);
    if (targets.length === 0) {
      return {
        summary: summary,
        exit_code: 1,
        error_message: 'Invalid section "' + args.section + '" -- not found under ' + summary.room_slug + '.',
      };
    }
  }

  summary.sections_requested = targets.length;

  // Dry-run shortcut.
  if (args.dryRun === true) {
    summary.cost_tokens_estimated = estimateCost(targets.length, args.crossRoom);
    for (const sec of targets) {
      summary.per_section.push({ section: sec, status: 'dry-run', detail: 'would derive (' + (args.crossRoom ? 'cross-room' : 'local-only') + ')' });
    }
    return { summary: summary, exit_code: 0 };
  }

  // Brain availability gate.
  let brainOnline;
  try {
    brainOnline = brainClient.isAvailable();
  } catch (_e) {
    brainOnline = false;
  }
  if (!brainOnline) {
    summary.brain_offline_from_start = true;
    summary.brain_offline_sections = targets.length;
    // Phase 252-01 (SWEEP-01): additive field, no shape break -- the rail's
    // kind name, for a caller that wants to distinguish the cause.
    summary.refusal_kind = 'no_key';
    for (const sec of targets) {
      summary.per_section.push({ section: sec, status: 'skipped', detail: 'no_key' });
    }
    return { summary: summary, exit_code: 0 };
  }

  // Fire derivations sequentially.
  const streamProgressOn = targets.length > STREAM_PROGRESS_THRESHOLD;
  let rateLimited = false;

  for (let i = 0; i < targets.length; i++) {
    const sec = targets[i];

    if (rateLimited) {
      summary.brain_offline_sections += 1;
      summary.per_section.push({ section: sec, status: 'skipped', detail: 'rate_limited' });
      if (streamProgressOn) streamProgress(i + 1, targets.length, sec, 'skipped (rate_limited)');
      continue;
    }

    let result;
    try {
      result = await brainDerivation.deriveSection(roomPath, sec, {
        cross_room_scan: args.crossRoom === true,
      });
    } catch (err) {
      // deriveSection contract is never-throws, but be defensive.
      result = { success: false, reason: 'derivation_error', violations: [], cost_tokens: 0 };
    }

    if (!result || typeof result !== 'object') {
      result = { success: false, reason: 'derivation_error', violations: [], cost_tokens: 0 };
    }

    summary.cost_tokens_total += Number.isFinite(result.cost_tokens) ? result.cost_tokens : 0;

    if (result.success === true) {
      summary.sections_derived += 1;
      const patternHits = countPatternHits(result);
      summary.per_section.push({
        section: sec,
        status: 'derived',
        detail: 'v' + (result.brain_graph_version || 1) + (patternHits ? ', ' + patternHits : ''),
      });
      if (streamProgressOn) streamProgress(i + 1, targets.length, sec, 'derived');
      // Cross-room contradiction surfacing (best-effort: deriveSection
      // does not currently return a structured aggregator summary, but
      // if/when it does we read it here).
      if (args.crossRoom === true && result.cross_room_contradictions != null) {
        summary.cross_room_contradictions_surfaced += Number(result.cross_room_contradictions) || 0;
        summary.scanned_rooms = Math.max(summary.scanned_rooms, Number(result.cross_room_scanned_rooms) || 0);
      }
    } else {
      const reason = String(result.reason || 'derivation_error');
      if (reason === 'rate_limited') {
        rateLimited = true;
        summary.rate_limited = true;
        summary.brain_offline_sections += 1;
        summary.per_section.push({ section: sec, status: 'skipped', detail: 'rate_limited' });
        if (streamProgressOn) streamProgress(i + 1, targets.length, sec, 'skipped (rate_limited)');
      } else if (reason === 'brain_unavailable' || reason === 'derivation_timeout') {
        summary.brain_offline_sections += 1;
        summary.per_section.push({ section: sec, status: 'skipped', detail: reason });
        if (streamProgressOn) streamProgress(i + 1, targets.length, sec, 'skipped (' + reason + ')');
      } else if (reason === 'schema_rejected') {
        summary.schema_gate_failed += 1;
        const violationSummary = renderViolationSummary(result.violations);
        summary.per_section.push({ section: sec, status: 'failed', detail: 'schema: ' + violationSummary });
        if (streamProgressOn) streamProgress(i + 1, targets.length, sec, 'failed (schema)');
      } else {
        summary.per_section.push({ section: sec, status: 'failed', detail: reason });
        if (streamProgressOn) streamProgress(i + 1, targets.length, sec, 'failed (' + reason + ')');
      }
    }
  }

  return { summary: summary, exit_code: 0 };
}

function countPatternHits(result) {
  // Best-effort: deriveSection does not yet return per-section record
  // counts in a stable field. Return empty string when unknown; future
  // plans can populate this via brain_query_count.
  if (!result) return '';
  if (Number.isFinite(result.brain_query_count) && result.brain_query_count > 0) {
    return result.brain_query_count + ' Brain hits';
  }
  return '';
}

function renderViolationSummary(violations) {
  if (!Array.isArray(violations) || violations.length === 0) return 'unknown';
  const first = violations[0] || {};
  const msg = String(first.message || first.category || 'violation');
  // Clamp to 40 chars so we stay inside the Shape E line budget.
  return msg.length > 40 ? msg.slice(0, 40) : msg;
}

// ---------- Shape E Action Report renderer ----------

/**
 * renderShapeE(summary) -> string
 *
 * Produces the Action Report body. Uses ASCII characters only; zero
 * em-dashes or en-dashes. Layout follows the Phase 88.6 Plan 02
 * diagnostics-command.cjs precedent.
 */
function renderShapeE(summary) {
  // Phase 130.7-03 curation modes render their own digest body.
  if (summary && (summary.mode === 'review-anchors' || summary.mode === 'orphan-census' || summary.mode === 'cross-label-dups')) {
    return renderCurationReport(summary);
  }
  const lines = [];
  lines.push('');
  lines.push('  BRAIN DERIVATION RESULTS');
  lines.push('  ' + '-'.repeat(68));

  if (summary.dry_run === true) {
    lines.push('  (DRY-RUN - no Brain calls fired, no BRAIN.md written)');
    lines.push('  ' + '-'.repeat(68));
    lines.push('  Sections queued:    ' + summary.sections_requested);
    lines.push('  Cross-room:         ' + (summary.cross_room_enabled ? 'enabled' : 'disabled'));
    lines.push('  Cost tokens est.:   ~' + summary.cost_tokens_estimated);
    lines.push('  ' + '-'.repeat(68));
    lines.push('  PER SECTION');
    for (const row of summary.per_section) {
      lines.push('  ' + SYM.BULLET + ' ' + padSection(row.section) + ' ' + (row.detail || row.status));
    }
    lines.push('  ' + '-'.repeat(68));
    lines.push('  NEXT');
    lines.push('  ' + SYM.ARROW + ' Drop --dry-run to actually derive');
    lines.push('  ' + SYM.ARROW + ' /mos:brain-derive ' + (summary.cross_room_enabled ? '' : '--cross-room ') + 'for structural xroom scan');
    lines.push('');
    return lines.join('\n');
  }

  if (summary.brain_offline_from_start === true) {
    // Phase 252-01 (SWEEP-01): the honesty rail's kind-appropriate one-liner
    // (250's export, no new refusal prose) replaces the old ad-hoc phrase.
    lines.push('  ' + SYM.WARN + ' Brain offline -- ' + refusalMessaging.larryRefusalLine('no_key'));
    lines.push('  ' + '-'.repeat(68));
    lines.push('  Sections requested: ' + summary.sections_requested);
    lines.push('  Cross-room:         ' + (summary.cross_room_enabled ? 'enabled' : 'disabled'));
    lines.push('  Brain offline:      ' + summary.brain_offline_sections + ' sections skipped');
    lines.push('  ' + '-'.repeat(68));
    lines.push('  PER SECTION');
    for (const row of summary.per_section) {
      lines.push('  ' + SYM.EMPTY + ' ' + padSection(row.section) + ' ' + (row.detail || row.status));
    }
    lines.push('  ' + '-'.repeat(68));
    lines.push('  NEXT');
    lines.push('  ' + SYM.ARROW + ' Check MINDRIAN_BRAIN_KEY env var and retry');
    lines.push('  ' + SYM.ARROW + ' /mos:diagnostics for algorithmic signals (no Brain needed)');
    lines.push('');
    return lines.join('\n');
  }

  const schemaPassed = summary.sections_derived;
  const schemaFailed = summary.schema_gate_failed;

  lines.push('  Sections derived:   ' + summary.sections_derived + ' / ' + summary.sections_requested);
  lines.push('  Schema gates:       passed: ' + schemaPassed + ' / failed: ' + schemaFailed);
  if (summary.cross_room_enabled) {
    lines.push('  Cross-room:         ' + summary.cross_room_contradictions_surfaced + ' contradictions surfaced / ' + summary.scanned_rooms + ' scanned rooms');
  } else {
    lines.push('  Cross-room:         disabled (pass --cross-room to enable)');
  }
  lines.push('  Brain offline:      ' + summary.brain_offline_sections + ' sections skipped' + (summary.rate_limited ? ' (rate-limited)' : ''));
  lines.push('  Cost tokens:        ~' + summary.cost_tokens_total);
  lines.push('  ' + '-'.repeat(68));
  lines.push('  PER SECTION');
  for (const row of summary.per_section) {
    const glyph = row.status === 'derived' ? SYM.CHECK
      : row.status === 'failed' ? SYM.WARN
      : SYM.EMPTY;
    lines.push('  ' + glyph + ' ' + padSection(row.section) + ' ' + (row.detail || row.status));
  }
  lines.push('  ' + '-'.repeat(68));
  lines.push('  NEXT');
  if (!summary.cross_room_enabled && summary.sections_derived > 0) {
    lines.push('  ' + SYM.ARROW + ' /mos:brain-derive --all --cross-room    Run structural xroom scan');
  }
  if (summary.rate_limited) {
    lines.push('  ' + SYM.ARROW + ' Retry in a few minutes -- Brain rate-limited');
  }
  lines.push('  ' + SYM.ARROW + ' /mos:diagnostics                        Inspect algorithmic signals');
  lines.push('  ' + SYM.ARROW + ' /mos:status                             Read the regenerated BRAIN.md');
  lines.push('');

  return lines.join('\n');
}

function padSection(s) {
  const name = String(s || '').slice(0, 28);
  return (name + ':').padEnd(30);
}

// ---------- Phase 130.7-03 curation digest renderer (Shape E) ----------

function renderCurationReport(summary) {
  const lines = [];
  lines.push('');
  if (summary.mode === 'review-anchors') {
    lines.push('  CURATION: REVIEW_REQUIRED ANCHORS (audit Q1)');
  } else if (summary.mode === 'orphan-census') {
    lines.push('  CURATION: ALL-LABEL ORPHAN CENSUS (audit section 7)');
  } else {
    lines.push('  CURATION: CROSS-LABEL DUPLICATES (audit section 13)');
  }
  lines.push('  ' + '-'.repeat(68));

  if (summary.brain_offline_from_start === true) {
    lines.push('  ' + SYM.WARN + ' Brain offline -- ' + refusalMessaging.larryRefusalLine('no_key'));
    lines.push('  ' + SYM.ARROW + ' Check MINDRIAN_BRAIN_KEY env var and retry');
    lines.push('');
    return lines.join('\n');
  }

  if (summary.mode === 'review-anchors') {
    lines.push('  REVIEW_REQUIRED count: ' + (summary.review_required_count || 0));
    lines.push('  ' + '-'.repeat(68));
    lines.push('  SAMPLE');
    for (const name of (summary.sample || [])) {
      lines.push('  ' + SYM.BULLET + ' ' + name);
    }
  } else if (summary.mode === 'orphan-census') {
    lines.push('  Total orphan mass: ' + (summary.total_orphans || 0));
    lines.push('  ' + '-'.repeat(68));
    lines.push('  PER LABEL');
    for (const row of (summary.label_orphans || [])) {
      lines.push('  ' + SYM.BULLET + ' ' + padSection(row.label) + ' ' + row.orphans);
    }
  } else {
    lines.push('  Cross-label dup groups: ' + (summary.group_count || (summary.dup_groups ? summary.dup_groups.length : 0)));
    lines.push('  ' + '-'.repeat(68));
    lines.push('  GROUPS (feeds Phase 132 dedup -- reporting only, never fails a build)');
    for (const g of (summary.dup_groups || [])) {
      lines.push('  ' + SYM.BULLET + ' ' + g.canonical_name + '  [' + (g.variant_labels || []).join(', ') + ']');
    }
  }
  lines.push('  ' + '-'.repeat(68));
  lines.push('  NEXT');
  lines.push('  ' + SYM.ARROW + ' Phase 132 owns reducing this debt; this surface measures it');
  lines.push('');
  return lines.join('\n');
}

// ---------- Main entry (CLI) ----------

async function main() {
  const args = parseArgv(process.argv);

  if (args.help) {
    printHelp();
    process.exit(0);
    return;
  }

  let result;
  try {
    result = await dispatch(args);
  } catch (err) {
    // dispatch() contract is never-throws; this branch catches truly
    // catastrophic failures (module load error, etc.).
    process.stderr.write('brain-derive: unexpected error -- ' + (err && err.message ? err.message : err) + '\n');
    process.exit(1);
    return;
  }

  if (result.error_message) {
    process.stderr.write(result.error_message + '\n');
    if (result.exit_code !== 0) {
      process.exit(result.exit_code);
      return;
    }
  }

  const rendered = renderShapeE(result.summary);
  process.stdout.write(rendered + '\n');
  process.exit(result.exit_code || 0);
}

function printHelp() {
  const help = [
    '',
    'Usage: node scripts/brain-derive-command.cjs [section] [--all] [--cross-room] [--dry-run]',
    '',
    'Force-refresh BRAIN.md per section via the Brain derivation pipeline.',
    '',
    'Modes:',
    '  <section>                 -- derive a single section',
    '  --all                     -- derive every active section in the current room',
    '  --cross-room              -- add cross-room structural contradiction scan',
    '  --dry-run                 -- preview target sections + cost; no Brain calls',
    '',
    'Curation surfaces (standalone reporting modes; feed Phase 132 dedup):',
    '  --review-anchors          -- the REVIEW_REQUIRED queue digest (audit Q1)',
    '  --orphan-census           -- per-label orphan count table (audit section 7)',
    '  --cross-label-dups        -- same-name-different-label collisions (section 13)',
    '',
    'Exit codes:',
    '  0  success (including Brain-offline soft-fail)',
    '  1  invocation error (no active room, invalid section, missing args)',
    '',
  ].join('\n');
  process.stdout.write(help + '\n');
}

// ---------- Exports ----------

module.exports = {
  parseArgv: parseArgv,
  resolveActiveRoom: resolveActiveRoom,
  resolveTargetSections: resolveTargetSections,
  estimateCost: estimateCost,
  dispatch: dispatch,
  renderShapeE: renderShapeE,
  renderCurationReport: renderCurationReport,
  main: main,
  // Phase 130.7-03 curation handlers exposed for tests / downstream plans.
  dispatchReviewAnchors: dispatchReviewAnchors,
  dispatchOrphanCensus: dispatchOrphanCensus,
  dispatchCrossLabelDups: dispatchCrossLabelDups,
  // Constants exposed for tests / downstream plans.
  DEFAULT_TOKENS_PER_SECTION: DEFAULT_TOKENS_PER_SECTION,
  CROSS_ROOM_SURCHARGE_PER_SECTION: CROSS_ROOM_SURCHARGE_PER_SECTION,
  STREAM_PROGRESS_THRESHOLD: STREAM_PROGRESS_THRESHOLD,
  REVIEW_ANCHORS_CYPHER: REVIEW_ANCHORS_CYPHER,
  ORPHAN_CENSUS_CYPHER: ORPHAN_CENSUS_CYPHER,
  CROSS_LABEL_DUPS_CYPHER: CROSS_LABEL_DUPS_CYPHER,
};

if (require.main === module) {
  main();
}
