#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * lib/core/drift-baseline.cjs
 * ---------------------------
 * Phase 150.9 Plan-01 Task 2. The one genuinely net-new piece of Phase 150.9.
 *
 * A pure, hermetic, require-clean DRIFT.md writer that emits the FIX-13 audit
 * baseline at BOTH granularities (locked decision D-01):
 *   - a root rolled-up index   .planning/DRIFT.md           (the single
 *                              diff-target / whole-read surface)
 *   - per-phase detail files   .planning/phases/<NN>/DRIFT.md  (Fable's
 *                              tightest locality so the NEXT audit diffs in
 *                              place instead of rediscovering ~600k tokens)
 * plus the SUMMARY-stub helper the heal arm uses (stubMissingSummary).
 *
 * Purpose (FIX-13, v1.13.1 drift audit): give the next audit a baseline to
 * DIFF against. The diff-stability contract:
 *   - finding_id is a STABLE deterministic key, so a finding that persists
 *     across audits keeps its id and a git diff shows only status/last_seen
 *     deltas.
 *   - first_seen is set ONCE (read back from the prior file) and never
 *     rewritten; last_seen bumps each run UNLESS noTouch is true (true
 *     idempotence for tests / unchanged-repo re-runs).
 *   - closed findings keep their row plus a closed_date (history preservation,
 *     CLAUDE.md decision 14).
 *
 * Fable process note (carried into the root index process_note field): "Bound
 * per-agent scope, fan wider" -- two agents stalled at the 600s watchdog on
 * broad scopes; the next audit inherits the lesson.
 *
 * Canon Part 8 (Graph Boundary): LOCAL-only. Uses ONLY Node built-ins (fs,
 * path). Zero network surface -- no remote IO, no graph egress, no telemetry.
 * The acceptance grep for network tokens returns 0 over this source
 * (test-drift-baseline.cjs Test 6); this header deliberately avoids those
 * tokens so the source stays clean under the floor.
 *
 * Security V12 (File Resources): BEFORE every write the target path is resolved
 * and asserted to live under the passed planningDir (path.resolve +
 * startsWith(planningDir + sep)); a violation throws. The per-folder writer and
 * the SUMMARY-stub writer can never traverse outside .planning/.
 *
 * Require-clean: no top-level side effects, no process.exit. Plan 02 (the
 * doctor.cjs Class P/Q dispatch + --drift heal arm) consumes these functions
 * with a frozen signature.
 *
 * No emoji. No em-dashes. ASCII-clean source.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// --------------------------------------------------------------------------
// Containment guard (V12). Resolve `target` and assert it lives under `root`.
// Throws a clear error on violation. Returns the resolved absolute path.
// --------------------------------------------------------------------------
function assertInside(root, target) {
  const resolvedRoot = path.resolve(root);
  const resolvedTarget = path.resolve(resolvedRoot, target);
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  if (resolvedTarget !== resolvedRoot && !resolvedTarget.startsWith(rootWithSep)) {
    throw new Error('drift-baseline: refusing to write outside the containment root: ' + resolvedTarget + ' (root: ' + resolvedRoot + ')');
  }
  return resolvedTarget;
}

// A phase token is safe for a per-folder write only if it is a plain phase
// label (digits + dots, e.g. "103" or "150.9"), never a traversal segment.
function isSafePhaseToken(phase) {
  return typeof phase === 'string' && /^[0-9][0-9.]*$/.test(phase);
}

// --------------------------------------------------------------------------
// Frontmatter parse (read-back of first_seen). Minimal YAML-subset reader: we
// only need to recover the per-finding first_seen map from a prior per-folder
// file, which we persist as an HTML-comment ledger so the body table stays
// human-clean. We read that ledger here.
// --------------------------------------------------------------------------
// Ledger marker format (one per finding, inside an HTML comment block):
//   <!-- gsd:drift first_seen W007-999-test=2026-06-13 -->
const LEDGER_RE = /<!--\s*gsd:drift first_seen\s+([^=\s]+)=([0-9]{4}-[0-9]{2}-[0-9]{2})\s*-->/g;

function readFirstSeenLedger(filePath) {
  const map = {};
  let content;
  try {
    content = fs.readFileSync(filePath, 'utf8');
  } catch (_e) {
    return map; // no prior file -> empty ledger
  }
  LEDGER_RE.lastIndex = 0;
  let m;
  while ((m = LEDGER_RE.exec(content)) !== null) {
    map[m[1]] = m[2];
  }
  return map;
}

// --------------------------------------------------------------------------
// Pure renderers.
// --------------------------------------------------------------------------

// Tally findings by track/severity for the root counts block.
function tallyCounts(findings) {
  const prose = { high: 0, med: 0, low: 0 };
  const gsd = { w007: 0, i001: 0 };
  for (const f of findings) {
    if (f.track === 'prose_vs_code') {
      const sev = f.severity === 'high' ? 'high' : (f.severity === 'med' || f.severity === 'medium' ? 'med' : 'low');
      prose[sev] += 1;
    } else if (f.track === 'gsd_record') {
      const id = String(f.finding_id || '');
      if (id.indexOf('W007') === 0) gsd.w007 += 1;
      else if (id.indexOf('I001') === 0) gsd.i001 += 1;
    }
  }
  return { prose_vs_code: prose, gsd_record: gsd };
}

function perFolderPointer(f) {
  if (f.per_folder && isSafePhaseToken(f.phase)) {
    return '.planning/phases/' + f.phase + '/DRIFT.md';
  }
  return '(report-only)';
}

// renderRootIndex(meta, findings) -> string
// The root rolled-up index: queryable frontmatter scalars + one stable-id body
// row per finding with a per_folder pointer column.
function renderRootIndex(meta, findings) {
  const m = meta || {};
  const counts = tallyCounts(findings);
  const lines = [];
  lines.push('---');
  lines.push('kind: drift-baseline-index');
  lines.push('audit_date: ' + (m.audit_date || ''));
  lines.push('auditor: ' + (m.auditor || 'doctor --drift'));
  lines.push('milestone: ' + (m.milestone || ''));
  lines.push('status: ' + (m.status || 'unknown'));
  lines.push('counts:');
  lines.push('  prose_vs_code: { high: ' + counts.prose_vs_code.high + ', med: ' + counts.prose_vs_code.med + ', low: ' + counts.prose_vs_code.low + ' }');
  lines.push('  gsd_record: { w007: ' + counts.gsd_record.w007 + ', i001: ' + counts.gsd_record.i001 + ' }');
  if (m.process_note) {
    lines.push('process_note: "' + String(m.process_note).replace(/"/g, "'") + '"');
  }
  lines.push('---');
  lines.push('');
  lines.push('# Drift Baseline (root index)');
  lines.push('');
  lines.push('| finding_id | track | severity | status | source_class | detail | per_folder |');
  lines.push('|------------|-------|----------|--------|--------------|--------|------------|');
  for (const f of findings) {
    lines.push('| ' + [
      f.finding_id,
      f.track,
      f.severity,
      f.status,
      f.source_class,
      String(f.detail || '').replace(/\|/g, '/').replace(/\n/g, ' '),
      perFolderPointer(f),
    ].join(' | ') + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

// renderPerFolder(phase, meta, findings, firstSeenMap) -> string
// Per-folder detail: carries ONLY the findings for `phase`. The first_seen
// column is read back from firstSeenMap (set-once); last_seen is the current
// audit_date unless suppressed by the caller (noTouch). A closed finding keeps
// its row and carries a closed_date.
function renderPerFolder(phase, meta, findings, firstSeenMap) {
  const m = meta || {};
  const fsMap = firstSeenMap || {};
  const auditDate = m.audit_date || '';
  const localFindings = findings.filter((f) => f.per_folder && String(f.phase) === String(phase));
  const ids = localFindings.map((f) => f.finding_id);

  const lines = [];
  lines.push('---');
  lines.push('kind: drift-baseline');
  lines.push('phase: ' + phase);
  lines.push('audit_date: ' + auditDate);
  lines.push('status: open');
  lines.push('finding_ids: [' + ids.join(', ') + ']');
  lines.push('---');
  lines.push('');
  // first_seen ledger (HTML comments; the diff-stable persistence of set-once
  // first_seen across audits). One comment per finding.
  for (const f of localFindings) {
    const firstSeen = fsMap[f.finding_id] || auditDate;
    lines.push('<!-- gsd:drift first_seen ' + f.finding_id + '=' + firstSeen + ' -->');
  }
  lines.push('');
  lines.push('# Phase ' + phase + ' drift');
  lines.push('');
  lines.push('| finding_id | severity | status | detail | first_seen | last_seen | closed_date |');
  lines.push('|------------|----------|--------|--------|------------|-----------|-------------|');
  for (const f of localFindings) {
    const firstSeen = fsMap[f.finding_id] || auditDate;
    const lastSeen = auditDate;
    const closedDate = f.status === 'closed' ? auditDate : '';
    lines.push('| ' + [
      f.finding_id,
      f.severity,
      f.status,
      String(f.detail || '').replace(/\|/g, '/').replace(/\n/g, ' '),
      firstSeen,
      lastSeen,
      closedDate,
    ].join(' | ') + ' |');
  }
  lines.push('');
  return lines.join('\n');
}

// --------------------------------------------------------------------------
// Orchestrator.
// --------------------------------------------------------------------------

// writeDriftBaseline({ planningDir, findings, meta, noTouch })
//   -> { rootPath, folderPaths[], wrote[] }
//
// Writes the root index + per-folder detail under planningDir. Diff-stable:
//   - first_seen read back from the prior per-folder file (set once).
//   - last_seen = meta.audit_date, UNLESS noTouch is true, in which case the
//     prior per-folder file is left byte-identical (no write).
//   - closed findings retain their row + a closed_date.
// V12: every target is asserted inside planningDir before write; a finding
// whose phase is an unsafe token (traversal) is skipped (no write), never
// allowed to escape.
function writeDriftBaseline(opts) {
  const o = opts || {};
  const planningDir = o.planningDir;
  const findings = Array.isArray(o.findings) ? o.findings : [];
  const meta = o.meta || {};
  const noTouch = o.noTouch === true;

  if (!planningDir || typeof planningDir !== 'string') {
    throw new Error('drift-baseline: planningDir is required');
  }
  const resolvedPlanning = path.resolve(planningDir);

  const wrote = [];
  const folderPaths = [];

  // --- Per-folder files (D-01 detail granularity) ---
  // Group per_folder findings by phase, skipping unsafe (traversal) tokens.
  const byPhase = {};
  for (const f of findings) {
    if (!f.per_folder) continue;
    if (!isSafePhaseToken(f.phase)) {
      // V12: a traversal-shaped phase token is skipped -- never written.
      continue;
    }
    if (!byPhase[f.phase]) byPhase[f.phase] = [];
    byPhase[f.phase].push(f);
  }

  for (const phase of Object.keys(byPhase)) {
    // Build + assert the target path is inside planningDir.
    const rel = path.join('phases', phase, 'DRIFT.md');
    const target = assertInside(resolvedPlanning, rel);

    if (noTouch && fs.existsSync(target)) {
      // True idempotence: leave the prior file byte-identical.
      folderPaths.push(target);
      continue;
    }

    const firstSeenMap = readFirstSeenLedger(target);
    const body = renderPerFolder(phase, meta, findings, firstSeenMap);

    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, body, 'utf8');
    folderPaths.push(target);
    wrote.push(target);
  }

  // --- Root index (D-01 rolled-up granularity) ---
  const rootPath = assertInside(resolvedPlanning, 'DRIFT.md');
  if (!(noTouch && fs.existsSync(rootPath))) {
    const rootBody = renderRootIndex(meta, findings);
    fs.mkdirSync(path.dirname(rootPath), { recursive: true });
    fs.writeFileSync(rootPath, rootBody, 'utf8');
    wrote.push(rootPath);
  }

  return { rootPath, folderPaths, wrote };
}

// --------------------------------------------------------------------------
// SUMMARY-stub helper (heal arm; D-03 mechanical auto-heal).
// --------------------------------------------------------------------------

// stubMissingSummary({ phaseDir, planFile }) -> { path, created }
// Writes a minimal <plan>-SUMMARY.md stub for an I001 missing-SUMMARY finding.
// The stub lands ONLY at <phaseDir>/<plan>-SUMMARY.md, asserted inside phaseDir
// (V12). Idempotent: never clobbers an existing SUMMARY (created:false).
function stubMissingSummary(opts) {
  const o = opts || {};
  const phaseDir = o.phaseDir;
  const planFile = o.planFile;
  if (!phaseDir || typeof phaseDir !== 'string') {
    throw new Error('drift-baseline: phaseDir is required');
  }
  if (!planFile || typeof planFile !== 'string') {
    throw new Error('drift-baseline: planFile is required');
  }
  // Derive <plan>-SUMMARY.md from <plan>-PLAN.md (basename only; no path parts).
  const base = path.basename(planFile);
  if (base !== planFile) {
    // planFile must be a bare basename, never a path -- refuse traversal.
    throw new Error('drift-baseline: planFile must be a bare filename, got a path: ' + planFile);
  }
  const summaryName = base.replace(/-PLAN\.md$/i, '-SUMMARY.md');
  if (summaryName === base) {
    throw new Error('drift-baseline: planFile does not look like a <plan>-PLAN.md: ' + planFile);
  }

  const resolvedPhaseDir = path.resolve(phaseDir);
  const target = assertInside(resolvedPhaseDir, summaryName);

  if (fs.existsSync(target)) {
    return { path: target, created: false };
  }

  const planLabel = base.replace(/-PLAN\.md$/i, '');
  const stub = [
    '---',
    'kind: summary-stub',
    'plan: ' + planLabel,
    'generated_by: doctor --drift --fix (I001 auto-stub)',
    'status: stub',
    '---',
    '',
    '# ' + planLabel + ' Summary (auto-stub)',
    '',
    'This is a placeholder SUMMARY generated to close an I001 missing-SUMMARY',
    'drift finding. The plan executed but no SUMMARY was recorded. Replace this',
    'stub with the real execution record (tasks, commits, deviations).',
    '',
  ].join('\n');

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, stub, 'utf8');
  return { path: target, created: true };
}

module.exports = {
  writeDriftBaseline,
  stubMissingSummary,
  renderRootIndex,
  renderPerFolder,
  // exposed for tests / Plan 02 reuse
  assertInside,
  isSafePhaseToken,
  tallyCounts,
};
