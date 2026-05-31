#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * (Business Source License 1.1; SPDX BUSL-1.1; see LICENSE.)
 *
 * Phase 94.1-01 -- /mos:heal command orchestrator.
 *
 * Wraps the 10-step room wiring heal recipe dog-fooded on the mindrianOS
 * room on 2026-04-29. Source-of-truth recipe at:
 *   ~/MindrianRooms/mindrianOS/methodology/2026-04-29-v1-11-0-room-
 *   wiring-heal-process.md
 *
 * Canon traceability:
 *   Part 7 (Reuse Before Build): wraps existing scripts/migrate-lazygraph
 *   .cjs + scripts/vault-section-state-generator.cjs + scripts/vault-
 *   section-minto-generator.cjs + scripts/compute-state. Zero net-new
 *   methodology.
 *   Part 4 (Every Choice Is Graph Data): writes .mindrian/heal-log.json
 *   capturing every section touched + every transition + every result.
 *   Part 8 (Graph Boundary): heal is LOCAL-only. Reads STATE.md / ROOM.md
 *   / MINTO.md, runs local graph rebuild, writes local heal-log. Zero
 *   Brain queries; brain-derivation-queue is only enqueued (read-only),
 *   never drained inside heal (drain deferred to v1.12 candidate plan).
 *
 * USAGE
 *   node scripts/heal-command.cjs                 # heal cwd as room
 *   node scripts/heal-command.cjs <room-dir>      # heal specific room
 *   node scripts/heal-command.cjs --dry-run       # plan only, zero mutation
 *   node scripts/heal-command.cjs --skip-step <N> # skip step N for re-runs
 *   node scripts/heal-command.cjs --section <s>   # restrict to one section
 *
 * runHeal(roomDir, opts) -> heal-log envelope (per <interfaces> in PLAN).
 *
 * EXIT CODES
 *   0  any-step-success (one or more steps succeeded; default healthy run)
 *   2  no-step-success  (every step errored; rare hard failure)
 *
 * NEVER throws on per-section failure. Always completes all 10 steps with
 * status logged. Mega-section MINTO writes that fail FEYNMINTO-01 budget
 * are gracefully degraded: status='blocked_feynminto_01' + tier-0
 * fallback + heal continues.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SCHEMA_VERSION = '1.0';

const CANONICAL_SECTIONS = [
  'problem-definition',
  'market-analysis',
  'solution-design',
  'business-model',
  'competitive-analysis',
  'team-execution',
  'legal-ip',
  'financial-model',
];

const STEP_NAMES = [
  'step_01_backup',
  'step_02_scaffold_sections',
  'step_03_section_seed',
  'step_04_lazygraph_rebuild',
  'step_05_backfill_room_md',
  'step_06_section_state',
  'step_07_section_minto',
  'step_08_queue_check',
  'step_09_root_state',
  'step_10_invariant_scan',
  'step_11_hats_migration',
];

const REPO_ROOT = path.resolve(__dirname, '..');
const SCRIPT_MIGRATE = path.join(REPO_ROOT, 'scripts', 'migrate-lazygraph.cjs');
const SCRIPT_HATS = path.join(REPO_ROOT, 'scripts', 'migrate-hats-to-roomdb.cjs');
const SCRIPT_SECTION_STATE = path.join(REPO_ROOT, 'scripts', 'vault-section-state-generator.cjs');
const SCRIPT_SECTION_MINTO = path.join(REPO_ROOT, 'scripts', 'vault-section-minto-generator.cjs');
const SCRIPT_COMPUTE_STATE = path.join(REPO_ROOT, 'scripts', 'compute-state');

// ---------- Helpers ----------

function utcStamp() {
  // YYYYMMDD-HHMMSS UTC
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  const ss = String(d.getUTCSeconds()).padStart(2, '0');
  return y + m + day + '-' + hh + mm + ss;
}

function nowIso() {
  return new Date().toISOString();
}

function safeMkdir(p) {
  try { fs.mkdirSync(p, { recursive: true }); } catch (_e) { /* best effort */ }
}

function safeReadFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (_e) { return null; }
}

function safeWriteFile(p, body) {
  try {
    safeMkdir(path.dirname(p));
    fs.writeFileSync(p, body, 'utf8');
    return true;
  } catch (_e) {
    return false;
  }
}

function copyFileBestEffort(src, dst) {
  try {
    const body = fs.readFileSync(src);
    safeMkdir(path.dirname(dst));
    fs.writeFileSync(dst, body);
    return true;
  } catch (_e) {
    return false;
  }
}

function listSectionDirs(roomDir) {
  // Returns canonical section names that exist on disk under roomDir,
  // PLUS any extension section directories (excluding hidden/dot dirs
  // and .heal-backup).
  const out = new Set();
  try {
    for (const entry of fs.readdirSync(roomDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'node_modules') continue;
      out.add(entry.name);
    }
  } catch (_e) { /* best effort */ }
  return Array.from(out).sort();
}

function hasArtifacts(sectionDir) {
  try {
    const files = fs.readdirSync(sectionDir);
    for (const f of files) {
      if (f === 'ROOM.md' || f === 'STATE.md' || f === 'MINTO.md' || f === 'BRAIN.md') continue;
      if (f.endsWith('.md')) return true;
    }
  } catch (_e) { /* best effort */ }
  return false;
}

function nowMs() { return Date.now(); }

// ---------- Step implementations ----------

/**
 * Step 1: Backup current state.
 *   - Create .heal-backup/<TS>/ (UTC YYYYMMDD-HHMMSS).
 *   - Copy .mindrian/invariant-report.json + minto-stale.json +
 *     brain-derivation-queue.json (if present).
 *   - Copy root STATE.md + per-section ROOM.md / STATE.md / MINTO.md.
 *   - Idempotent: backup is timestamped so re-runs land in distinct dirs.
 *   - Best-effort: missing files skip silently.
 */
function step01Backup(ctx) {
  const start = nowMs();
  if (ctx.dryRun) {
    return {
      status: 'skipped',
      duration_ms: nowMs() - start,
      details: { reason: 'dry-run', planned_backup_dir: ctx.backupDir },
    };
  }

  let copied = 0;
  safeMkdir(ctx.backupDir);

  const mindrianFiles = [
    'invariant-report.json',
    'minto-stale.json',
    'brain-derivation-queue.json',
  ];
  for (const f of mindrianFiles) {
    const src = path.join(ctx.roomDir, '.mindrian', f);
    if (fs.existsSync(src)) {
      const dst = path.join(ctx.backupDir, '.mindrian', f);
      if (copyFileBestEffort(src, dst)) copied++;
    }
  }

  // Root STATE.md
  const rootState = path.join(ctx.roomDir, 'STATE.md');
  if (fs.existsSync(rootState)) {
    if (copyFileBestEffort(rootState, path.join(ctx.backupDir, 'STATE.md'))) copied++;
  }

  // Per-section MOC files.
  const sections = listSectionDirs(ctx.roomDir);
  for (const s of sections) {
    for (const moc of ['ROOM.md', 'STATE.md', 'MINTO.md']) {
      const src = path.join(ctx.roomDir, s, moc);
      if (fs.existsSync(src)) {
        if (copyFileBestEffort(src, path.join(ctx.backupDir, s, moc))) copied++;
      }
    }
  }

  return {
    status: copied > 0 ? 'ok' : 'skipped',
    duration_ms: nowMs() - start,
    details: { backup_dir: ctx.backupDir, files_copied: copied },
  };
}

/**
 * Step 2: Create missing canonical sections.
 *   - Idempotent mkdir for each of 8 canonical sections.
 *   - Records which sections were newly created vs already present.
 */
function step02ScaffoldSections(ctx) {
  const start = nowMs();
  const created = [];
  const present = [];

  for (const s of CANONICAL_SECTIONS) {
    const sectionDir = path.join(ctx.roomDir, s);
    if (fs.existsSync(sectionDir)) {
      present.push(s);
      continue;
    }
    if (ctx.dryRun) {
      created.push(s);
      continue;
    }
    try {
      fs.mkdirSync(sectionDir, { recursive: true });
      created.push(s);
    } catch (_e) {
      // ignore; will surface via missing-section in later steps
    }
  }

  return {
    status: ctx.dryRun ? 'skipped' : (created.length > 0 ? 'ok' : 'skipped'),
    duration_ms: nowMs() - start,
    details: { created, already_present: present },
  };
}

/**
 * Step 3: Write a section seed in any newly-created section.
 *   - Filename: 01-section-seed.md
 *   - Contains: section purpose + what goes here + 2-3 open questions.
 *   - Skipped for sections that already have at least one artifact.
 */
function step03SectionSeed(ctx) {
  const start = nowMs();
  const seeded = [];
  const skipped = [];

  for (const s of CANONICAL_SECTIONS) {
    const sectionDir = path.join(ctx.roomDir, s);
    if (!fs.existsSync(sectionDir)) {
      skipped.push({ section: s, reason: 'directory_absent' });
      continue;
    }
    if (hasArtifacts(sectionDir)) {
      skipped.push({ section: s, reason: 'artifacts_present' });
      continue;
    }
    if (ctx.dryRun) {
      seeded.push(s);
      continue;
    }

    const seedPath = path.join(sectionDir, '01-section-seed.md');
    if (fs.existsSync(seedPath)) {
      skipped.push({ section: s, reason: 'seed_already_present' });
      continue;
    }

    const body =
      '---\n' +
      'title: ' + s + ' section seed\n' +
      'section: ' + s + '\n' +
      'date: ' + new Date().toISOString().slice(0, 10) + '\n' +
      'kind: section-seed\n' +
      '---\n\n' +
      '# ' + s + '\n\n' +
      '## Purpose\n\n' +
      'Capture artifacts, evidence, and open questions for the ' + s + '\n' +
      'subsystem of the venture.\n\n' +
      '## What goes here\n\n' +
      '- Claims with evidence tier (Academic / Operational / Practitioner / None)\n' +
      '- Cross-references to other sections via wikilinks\n' +
      '- Decision history and rejection reasons (Canon Part 4)\n\n' +
      '## Open questions\n\n' +
      '1. What is the strongest evidence currently available?\n' +
      '2. What assumptions are still untested?\n' +
      '3. Which other sections does this connect to?\n';

    if (safeWriteFile(seedPath, body)) {
      seeded.push(s);
    } else {
      skipped.push({ section: s, reason: 'write_failed' });
    }
  }

  return {
    status: ctx.dryRun ? 'skipped' : (seeded.length > 0 ? 'ok' : 'skipped'),
    duration_ms: nowMs() - start,
    details: { seeded, skipped },
  };
}

/**
 * Step 4: Refresh .mindrian/room.db.
 *   - Wraps scripts/migrate-lazygraph.cjs --force.
 *   - Captures stdout/stderr; exit code maps to status.
 */
function step04LazygraphRebuild(ctx) {
  const start = nowMs();
  if (ctx.dryRun) {
    return {
      status: 'skipped',
      duration_ms: nowMs() - start,
      details: { reason: 'dry-run', would_invoke: 'migrate-lazygraph.cjs --force' },
    };
  }

  const result = spawnSync(
    process.execPath,
    [SCRIPT_MIGRATE, ctx.roomDir, '--force'],
    { encoding: 'utf8', timeout: 120000 }
  );

  if (result.error) {
    return {
      status: 'error_spawn',
      duration_ms: nowMs() - start,
      details: { reason: String(result.error.message || result.error) },
    };
  }

  // Check that .mindrian/room.db was actually created.
  const dbPath = path.join(ctx.roomDir, '.mindrian', 'room.db');
  const dbExists = fs.existsSync(dbPath);

  return {
    status: result.status === 0 && dbExists ? 'ok' : 'error_rebuild',
    duration_ms: nowMs() - start,
    details: {
      exit_code: result.status,
      db_exists: dbExists,
      stdout_tail: tailLines(result.stdout, 5),
      stderr_tail: tailLines(result.stderr, 3),
    },
  };
}

function tailLines(s, n) {
  if (typeof s !== 'string' || !s) return '';
  const lines = s.trim().split('\n');
  return lines.slice(-n).join('\n');
}

/**
 * Step 5: Backfill missing ROOM.md per section.
 *   - For each canonical section directory: write ROOM.md if absent.
 *   - Frontmatter: section, purpose, methodology, parent, status.
 */
function step05BackfillRoomMd(ctx) {
  const start = nowMs();
  const written = [];
  const present = [];

  for (const s of CANONICAL_SECTIONS) {
    const sectionDir = path.join(ctx.roomDir, s);
    if (!fs.existsSync(sectionDir)) continue;

    const roomMd = path.join(sectionDir, 'ROOM.md');
    if (fs.existsSync(roomMd)) {
      present.push(s);
      continue;
    }
    if (ctx.dryRun) {
      written.push(s);
      continue;
    }

    const purpose = sectionPurpose(s);
    const methodology = sectionMethodology(s);
    const body =
      '---\n' +
      'section: ' + s + '\n' +
      'purpose: ' + purpose + '\n' +
      'methodology: ' + methodology + '\n' +
      'parent: ../STATE.md\n' +
      'status: active\n' +
      '---\n\n' +
      '# ' + s + '\n\n' +
      purpose + '\n';

    if (safeWriteFile(roomMd, body)) {
      written.push(s);
    }
  }

  return {
    status: ctx.dryRun ? 'skipped' : (written.length > 0 ? 'ok' : 'skipped'),
    duration_ms: nowMs() - start,
    details: { written, already_present: present },
  };
}

function sectionPurpose(s) {
  const map = {
    'problem-definition': 'Frame the wicked problem and capture root-cause hypotheses',
    'market-analysis': 'Size the opportunity, segment customers, evidence demand',
    'solution-design': 'Architect the response, capture feasibility, model trade-offs',
    'business-model': 'Capture revenue model, unit economics, pricing strategy',
    'competitive-analysis': 'Map direct + indirect competitors and the moat thesis',
    'team-execution': 'Document team, hiring plan, milestones, execution cadence',
    'legal-ip': 'Track entity structure, IP ownership, regulatory exposure',
    'financial-model': 'Project revenue, burn, runway, funding asks',
  };
  return map[s] || ('Working artifacts for the ' + s + ' subsystem');
}

function sectionMethodology(s) {
  const map = {
    'problem-definition': 'wicked-problem-framing',
    'market-analysis': 'jtbd-segmentation',
    'solution-design': 'system-architecture',
    'business-model': 'business-model-canvas',
    'competitive-analysis': 'porter-five-forces',
    'team-execution': 'first-who-then-what',
    'legal-ip': 'ip-strategy-mapping',
    'financial-model': 'unit-economics',
  };
  return map[s] || 'general';
}

/**
 * Step 6: Generate per-section STATE.md.
 *   - Wraps scripts/vault-section-state-generator.cjs.
 *   - Captures stdout/stderr; exit code maps to status.
 */
function step06SectionState(ctx) {
  const start = nowMs();
  if (ctx.dryRun) {
    return {
      status: 'skipped',
      duration_ms: nowMs() - start,
      details: { reason: 'dry-run', would_invoke: 'vault-section-state-generator.cjs' },
    };
  }

  const result = spawnSync(
    process.execPath,
    [SCRIPT_SECTION_STATE, ctx.roomDir],
    { encoding: 'utf8', timeout: 120000 }
  );

  if (result.error) {
    return {
      status: 'error_spawn',
      duration_ms: nowMs() - start,
      details: { reason: String(result.error.message || result.error) },
    };
  }

  // Count how many sections now have STATE.md.
  let stateMdCount = 0;
  for (const s of CANONICAL_SECTIONS) {
    if (fs.existsSync(path.join(ctx.roomDir, s, 'STATE.md'))) stateMdCount++;
  }

  return {
    status: result.status === 0 && stateMdCount > 0 ? 'ok' : 'error_state_gen',
    duration_ms: nowMs() - start,
    details: {
      exit_code: result.status,
      sections_with_state_md: stateMdCount,
      stdout_tail: tailLines(result.stdout, 5),
      stderr_tail: tailLines(result.stderr, 3),
    },
  };
}

/**
 * Step 7: Generate or refresh MINTO.md per section.
 *   - For each canonical section with at least one artifact: invoke
 *     vault-section-minto-generator.cjs --write --section <s> (no
 *     narrative -> tier-0 path; safe and deterministic).
 *   - On FEYNMINTO-01 budget rejection (regex 'budget exceeded' OR
 *     'FEYNMINTO-01' in stderr/stdout): record blocked_feynminto_01 +
 *     tier-0 fallback already happened by the writer's design (the
 *     tier-0 entry point is the no-narrative path itself, so the only
 *     way FEYNMINTO-01 fires here is the per-section invariant rejection
 *     of the tier-0 body which is byte-pinned and large for mega-sections).
 *   - NEVER throws. Always continues to the next section.
 *   - Per-section opt-in: if ctx.section is set, restrict to that one.
 */
function step07SectionMinto(ctx) {
  const start = nowMs();
  if (ctx.dryRun) {
    return {
      status: 'skipped',
      duration_ms: nowMs() - start,
      details: {
        reason: 'dry-run',
        would_invoke: 'vault-section-minto-generator.cjs --write per section',
      },
    };
  }

  const sectionsToProcess = ctx.section
    ? [ctx.section]
    : CANONICAL_SECTIONS.filter(function (s) {
        return fs.existsSync(path.join(ctx.roomDir, s)) && hasArtifacts(path.join(ctx.roomDir, s));
      });

  const perSection = [];
  let okCount = 0;
  let blockedCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  for (const s of sectionsToProcess) {
    const sStart = nowMs();
    const result = spawnSync(
      process.execPath,
      [SCRIPT_SECTION_MINTO, ctx.roomDir, '--write', '--section', s],
      { encoding: 'utf8', timeout: 60000 }
    );

    let status;
    let detail = {};
    detail.duration_ms = nowMs() - sStart;
    detail.exit_code = result.status;
    detail.stderr_tail = tailLines(result.stderr, 3);
    detail.stdout_tail = tailLines(result.stdout, 3);

    if (result.error) {
      status = 'error_spawn';
      detail.reason = String(result.error.message || result.error);
      errorCount++;
    } else {
      const combined = (result.stdout || '') + '\n' + (result.stderr || '');
      const budgetExceeded =
        /Narrative body token budget exceeded/i.test(combined) ||
        /FEYNMINTO-01/i.test(combined) ||
        /budget exceeded/i.test(combined);

      const mintoPath = path.join(ctx.roomDir, s, 'MINTO.md');
      const wroteMinto = fs.existsSync(mintoPath);

      if (budgetExceeded) {
        // Even if the tier-0 path was rejected by the invariants gate,
        // we record graceful degradation. v1.12 will fix the budget;
        // v1.11.1 respects the limit.
        status = 'blocked_feynminto_01';
        detail.reason = 'FEYNMINTO-01 budget exceeded; tier-0 fallback attempted';
        detail.minto_written = wroteMinto;
        blockedCount++;
      } else if (result.status === 0 && wroteMinto) {
        status = 'ok';
        detail.minto_written = true;
        okCount++;
      } else if (result.status === 0) {
        status = 'skipped';
        detail.reason = 'generator exit 0 but no MINTO.md present (likely empty section)';
        skippedCount++;
      } else {
        status = 'error_minto_gen';
        detail.minto_written = wroteMinto;
        errorCount++;
      }
    }

    perSection.push({ section: s, status: status, detail: detail });
  }

  // Roll-up status. If at least one section blocked but the heal kept
  // going for the rest, we report ok (any-section-success) and leave
  // per-section blocked records in details. If ALL sections blocked or
  // errored, we report error_all_blocked or error_all_errored.
  let rollUp;
  if (sectionsToProcess.length === 0) {
    rollUp = 'skipped';
  } else if (okCount > 0) {
    rollUp = blockedCount > 0 ? 'ok_with_blocked' : 'ok';
  } else if (blockedCount > 0 && errorCount === 0) {
    rollUp = 'blocked_feynminto_01';
  } else if (errorCount > 0 && blockedCount === 0) {
    rollUp = 'error_minto_gen';
  } else if (blockedCount > 0 || errorCount > 0) {
    rollUp = 'blocked_feynminto_01';
  } else {
    rollUp = 'skipped';
  }

  return {
    status: rollUp,
    duration_ms: nowMs() - start,
    details: {
      sections_processed: sectionsToProcess.length,
      ok_count: okCount,
      blocked_count: blockedCount,
      error_count: errorCount,
      skipped_count: skippedCount,
      per_section: perSection,
    },
  };
}

/**
 * Step 8: brain-derivation-queue read-only check.
 *   - Read .mindrian/brain-derivation-queue.json (if present).
 *   - Report queue depth + age of oldest entry.
 *   - Does NOT drain. Drain hook deferred to v1.12 candidate plan.
 *   - Canon Part 8 boundary preserved: queue is LOCAL data; heal never
 *     contacts Brain; queue stays untouched until the v1.12 drain hook.
 */
function step08QueueCheck(ctx) {
  const start = nowMs();
  const queuePath = path.join(ctx.roomDir, '.mindrian', 'brain-derivation-queue.json');

  if (!fs.existsSync(queuePath)) {
    return {
      status: 'skipped',
      duration_ms: nowMs() - start,
      details: { reason: 'no_queue_file', queue_path: queuePath },
    };
  }

  const raw = safeReadFile(queuePath);
  if (!raw) {
    return {
      status: 'skipped',
      duration_ms: nowMs() - start,
      details: { reason: 'queue_file_unreadable' },
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_e) {
    return {
      status: 'error_queue_parse',
      duration_ms: nowMs() - start,
      details: { reason: 'queue_file_malformed_json' },
    };
  }

  const entries = Array.isArray(parsed) ? parsed : (parsed.queue || []);
  let oldestIso = null;
  for (const e of entries) {
    if (e && typeof e.enqueued_at === 'string') {
      if (oldestIso === null || e.enqueued_at < oldestIso) {
        oldestIso = e.enqueued_at;
      }
    }
  }

  let oldestAgeDays = null;
  if (oldestIso) {
    const t = Date.parse(oldestIso);
    if (!Number.isNaN(t)) {
      oldestAgeDays = Math.floor((Date.now() - t) / (24 * 60 * 60 * 1000));
    }
  }

  return {
    status: 'ok',
    duration_ms: nowMs() - start,
    details: {
      queue_depth: entries.length,
      oldest_enqueued_at: oldestIso,
      oldest_age_days: oldestAgeDays,
      drain_status: 'not_drained_by_design_v1.11.1',
      v1_12_candidate: 'brain-derivation-queue auto-drain hook',
    },
  };
}

/**
 * Step 9: Recompute root STATE.md.
 *   - Wraps scripts/compute-state via bash; stdout redirects to STATE.md.
 *   - Atomic: write to STATE.md.tmp then rename.
 */
function step09RootState(ctx) {
  const start = nowMs();
  if (ctx.dryRun) {
    return {
      status: 'skipped',
      duration_ms: nowMs() - start,
      details: { reason: 'dry-run', would_invoke: 'bash scripts/compute-state' },
    };
  }

  const result = spawnSync(
    'bash',
    [SCRIPT_COMPUTE_STATE, ctx.roomDir],
    { encoding: 'utf8', timeout: 60000 }
  );

  if (result.error) {
    return {
      status: 'error_spawn',
      duration_ms: nowMs() - start,
      details: { reason: String(result.error.message || result.error) },
    };
  }

  if (result.status !== 0) {
    return {
      status: 'error_compute_state',
      duration_ms: nowMs() - start,
      details: {
        exit_code: result.status,
        stderr_tail: tailLines(result.stderr, 3),
      },
    };
  }

  const body = result.stdout || '';
  const target = path.join(ctx.roomDir, 'STATE.md');
  const tmp = target + '.heal.tmp';
  try {
    fs.writeFileSync(tmp, body, 'utf8');
    fs.renameSync(tmp, target);
  } catch (e) {
    return {
      status: 'error_state_write',
      duration_ms: nowMs() - start,
      details: { reason: String(e.message || e) },
    };
  }

  return {
    status: 'ok',
    duration_ms: nowMs() - start,
    details: {
      bytes_written: Buffer.byteLength(body, 'utf8'),
      state_md: target,
    },
  };
}

/**
 * Step 10: On-stop invariant scan (passive).
 *   - Reads .mindrian/invariant-report.json if present.
 *   - The report is written by the on-stop hook on the next /mos:*
 *     command, NOT by heal itself. This step records the current
 *     state of the report file for the heal-log so the user knows
 *     what severity to expect.
 */
function step10InvariantScan(ctx) {
  const start = nowMs();
  const reportPath = path.join(ctx.roomDir, '.mindrian', 'invariant-report.json');

  if (!fs.existsSync(reportPath)) {
    return {
      status: 'skipped',
      duration_ms: nowMs() - start,
      details: {
        reason: 'no_report_yet',
        note: 'Report writes on next /mos:* command via on-stop hook',
      },
    };
  }

  const raw = safeReadFile(reportPath);
  if (!raw) {
    return {
      status: 'skipped',
      duration_ms: nowMs() - start,
      details: { reason: 'report_unreadable' },
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_e) {
    return {
      status: 'error_report_parse',
      duration_ms: nowMs() - start,
      details: { reason: 'invariant_report_malformed_json' },
    };
  }

  let highestSeverity = 'info';
  let violationCount = 0;
  if (Array.isArray(parsed.violations)) {
    violationCount = parsed.violations.length;
    for (const v of parsed.violations) {
      if (v && v.severity === 'error') highestSeverity = 'error';
      else if (v && v.severity === 'warning' && highestSeverity !== 'error') highestSeverity = 'warning';
    }
  }

  return {
    status: 'ok',
    duration_ms: nowMs() - start,
    details: {
      violation_count: violationCount,
      highest_severity: highestSeverity,
      report_path: reportPath,
    },
  };
}

/**
 * Step 11: Run pending room.db migrations (Phase 130 hats -> room.db).
 *   - Wraps scripts/migrate-hats-to-roomdb.cjs (idempotent: writes a sentinel
 *     memory_event and skips on re-run, so safe to run every heal).
 *   - Runs AFTER step04 (lazygraph rebuild) so room.db is guaranteed to exist;
 *     the migration refuses with reason "no_room_db" otherwise.
 *   - This is what makes `doctor --heal-room` the single per-room "wire it"
 *     command -- no more orphaned migration scripts a human must know to run.
 */
function step11HatsMigration(ctx) {
  const start = nowMs();
  if (ctx.dryRun) {
    return {
      status: 'skipped',
      duration_ms: nowMs() - start,
      details: { reason: 'dry-run', would_invoke: 'migrate-hats-to-roomdb.cjs' },
    };
  }

  const result = spawnSync(
    process.execPath,
    [SCRIPT_HATS, ctx.roomDir],
    { encoding: 'utf8', timeout: 120000 }
  );

  if (result.error) {
    return {
      status: 'error_spawn',
      duration_ms: nowMs() - start,
      details: { reason: String(result.error.message || result.error) },
    };
  }

  // The migration prints a JSON envelope: { ok, migrated, skipped, reason }.
  let parsed = null;
  try { parsed = JSON.parse(result.stdout || '{}'); } catch (_e) { parsed = null; }

  // Idempotent skip (already migrated) is a success, not a failure.
  const ok = parsed && (parsed.ok === true || parsed.skipped === true);
  return {
    status: ok ? 'ok' : 'error_migration',
    duration_ms: nowMs() - start,
    details: {
      exit_code: result.status,
      migrated: parsed && Array.isArray(parsed.migrated) ? parsed.migrated.length : 0,
      skipped: !!(parsed && parsed.skipped),
      reason: parsed && parsed.reason ? parsed.reason : null,
      stderr_tail: tailLines(result.stderr, 3),
    },
  };
}

// ---------- Room validation ----------

/**
 * assertIsRoom(dir) -> { ok: bool, reason: string }
 *
 * A directory is a legitimate room when it carries at least one of:
 *   .room-root   (sentinel written by /mos:new-project and sentinel-health-check)
 *   STATE.md     (root room state file, written on first heal or new-project)
 *   ROOM.md      (ICM Layer 0 identity file, present in every room)
 *
 * Absence of all three is a strong signal the directory was never set up as a
 * room. Requiring all three would be too strict -- brand-new rooms may only
 * have .room-root before their first heal.
 */
function assertIsRoom(dir) {
  const sentinels = ['.room-root', 'STATE.md', 'ROOM.md'];
  for (const s of sentinels) {
    if (fs.existsSync(path.join(dir, s))) {
      return { ok: true, reason: 'found sentinel: ' + s };
    }
  }
  return {
    ok: false,
    reason:
      'directory does not appear to be a room -- none of ' +
      sentinels.join(', ') + ' found in: ' + dir,
  };
}

/**
 * isContainerDir(dir) -> { container: bool, childRooms: string[] }
 *
 * A directory is a sub-rooms CONTAINER (not a room itself) when 2 or more of
 * its direct child directories each carry a .room-root sentinel. This is the
 * exact pattern of a sub-rooms/ folder: each sub-room has .room-root, but
 * the container itself is just a grouping directory.
 *
 * Threshold is 2 (not 1) so that a room that happens to have one sub-room
 * inside it is not misidentified as a container.
 */
function isContainerDir(dir) {
  const childRooms = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      if (entry.name.startsWith('.')) continue;
      const sentinel = path.join(dir, entry.name, '.room-root');
      if (fs.existsSync(sentinel)) {
        childRooms.push(entry.name);
      }
    }
  } catch (_e) { /* best effort */ }
  return { container: childRooms.length >= 2, childRooms };
}

/** Build a structured error envelope (mirrors the room-not-found pattern). */
function buildErrorEnvelope(resolved, errorStatus, reason) {
  return {
    schema_version: SCHEMA_VERSION,
    started_at: nowIso(),
    ended_at: nowIso(),
    room_dir: resolved,
    backup_dir: '.heal-backup/' + utcStamp(),
    steps: STEP_NAMES.map(function (name) {
      return {
        step: name,
        status: errorStatus,
        duration_ms: 0,
        details: { reason: reason },
      };
    }),
    summary: { ok_count: 0, skipped_count: 0, blocked_count: 0, error_count: 10, exit_code: 2 },
  };
}

// ---------- Orchestrator ----------

/**
 * runHeal(roomDir, opts) -> heal-log envelope.
 *
 * @param {string} roomDir - absolute or relative path to the room
 * @param {object} [opts]
 * @param {boolean} [opts.dryRun]   - plan-only, zero mutation
 * @param {Array<number>} [opts.skipSteps] - 1-indexed step numbers to skip
 * @param {string}  [opts.section]  - restrict step 7 to one section
 * @param {boolean} [opts.silent]   - suppress console output
 * @param {boolean} [opts.skipRoomCheck] - bypass room validation (internal use only)
 * @returns {Promise<object>} heal-log envelope
 */
async function runHeal(roomDir, opts) {
  opts = opts || {};
  const dryRun = !!opts.dryRun;
  const skipSteps = Array.isArray(opts.skipSteps) ? opts.skipSteps : [];
  const section = opts.section || null;
  const silent = !!opts.silent;
  const skipRoomCheck = !!opts.skipRoomCheck;

  const resolved = path.resolve(roomDir);
  if (!fs.existsSync(resolved)) {
    // Build a minimal envelope reporting the room-not-found error.
    return buildErrorEnvelope(
      resolved,
      'error_room_not_found',
      'room_dir does not exist: ' + resolved
    );
  }

  // Guard: detect sub-rooms container before the room-sentinel check so the
  // error message names the specific child rooms that gave it away.
  if (!skipRoomCheck) {
    const containerCheck = isContainerDir(resolved);
    if (containerCheck.container) {
      const msg =
        '[heal] Refusing to heal: "' + resolved + '" looks like a sub-rooms ' +
        'CONTAINER, not a room. It contains ' + containerCheck.childRooms.length +
        ' child directories that each carry a .room-root sentinel (' +
        containerCheck.childRooms.slice(0, 5).join(', ') +
        (containerCheck.childRooms.length > 5 ? ', ...' : '') +
        '). Pass the parent room directory explicitly, e.g.:\n' +
        '  node scripts/heal-command.cjs ' + path.dirname(resolved);
      if (!silent) process.stderr.write(msg + '\n');
      return buildErrorEnvelope(resolved, 'error_container_dir', msg);
    }

    const roomCheck = assertIsRoom(resolved);
    if (!roomCheck.ok) {
      const msg =
        '[heal] Refusing to heal: "' + resolved + '" does not appear to be a ' +
        'room (' + roomCheck.reason + '). ' +
        'Pass the room directory explicitly or run /mos:new-project to create one.';
      if (!silent) process.stderr.write(msg + '\n');
      return buildErrorEnvelope(resolved, 'error_not_a_room', msg);
    }
  }

  const ts = utcStamp();
  const backupDir = path.join(resolved, '.heal-backup', ts);
  const ctx = {
    roomDir: resolved,
    backupDir: backupDir,
    dryRun: dryRun,
    section: section,
  };

  const env = {
    schema_version: SCHEMA_VERSION,
    started_at: nowIso(),
    ended_at: null,
    room_dir: resolved,
    backup_dir: dryRun ? '(dry-run; would be ' + path.relative(resolved, backupDir) + ')' : backupDir,
    steps: [],
    summary: null,
  };

  const stepFns = [
    step01Backup,
    step02ScaffoldSections,
    step03SectionSeed,
    step04LazygraphRebuild,
    step05BackfillRoomMd,
    step06SectionState,
    step07SectionMinto,
    step08QueueCheck,
    step09RootState,
    step10InvariantScan,
    step11HatsMigration,
  ];

  for (let i = 0; i < stepFns.length; i++) {
    const stepNum = i + 1;
    const stepName = STEP_NAMES[i];

    if (skipSteps.indexOf(stepNum) !== -1) {
      env.steps.push({
        step: stepName,
        status: 'skipped',
        duration_ms: 0,
        details: { reason: 'skipped_by_flag --skip-step ' + stepNum },
      });
      if (!silent) console.log('[heal] step ' + stepNum + ' ' + stepName + ': skipped (flag)');
      continue;
    }

    let stepResult;
    try {
      stepResult = stepFns[i](ctx);
    } catch (e) {
      stepResult = {
        status: 'error_uncaught',
        duration_ms: 0,
        details: { reason: String(e.message || e) },
      };
    }

    // Defensive shape: ensure all keys present.
    if (!stepResult) stepResult = { status: 'error_no_result', duration_ms: 0, details: {} };
    if (typeof stepResult.status !== 'string') stepResult.status = 'error_bad_status';
    if (typeof stepResult.duration_ms !== 'number') stepResult.duration_ms = 0;
    if (!stepResult.details || typeof stepResult.details !== 'object') stepResult.details = {};

    env.steps.push({
      step: stepName,
      status: stepResult.status,
      duration_ms: stepResult.duration_ms,
      details: stepResult.details,
    });

    if (!silent) {
      console.log(
        '[heal] step ' + stepNum + ' ' + stepName + ': ' +
        stepResult.status + ' (' + stepResult.duration_ms + 'ms)'
      );
    }
  }

  // Summary.
  let okCount = 0, skippedCount = 0, blockedCount = 0, errorCount = 0;
  for (const s of env.steps) {
    if (s.status === 'ok' || s.status === 'ok_with_blocked') okCount++;
    else if (s.status === 'skipped') skippedCount++;
    else if (typeof s.status === 'string' && s.status.startsWith('blocked_')) blockedCount++;
    else if (typeof s.status === 'string' && s.status.startsWith('error_')) errorCount++;
    else skippedCount++; // unknown -> skipped bucket
  }
  // Exit 0 if any step succeeded or any step blocked-but-graceful.
  // Exit 2 only when zero useful work happened (no ok, no blocked).
  const exitCode = (okCount > 0 || blockedCount > 0 || skippedCount === env.steps.length) ? 0 : 2;
  env.summary = {
    ok_count: okCount,
    skipped_count: skippedCount,
    blocked_count: blockedCount,
    error_count: errorCount,
    exit_code: exitCode,
  };

  env.ended_at = nowIso();

  // Write heal-log.json (skip in dry-run; mutating .mindrian/ in dry-run
  // would violate T1's no-mutation contract).
  if (!dryRun) {
    const mindrianDir = path.join(resolved, '.mindrian');
    safeMkdir(mindrianDir);
    const logPath = path.join(mindrianDir, 'heal-log.json');
    try {
      fs.writeFileSync(logPath, JSON.stringify(env, null, 2) + '\n', 'utf8');
    } catch (_e) { /* best effort; envelope still returned */ }
  }

  return env;
}

// ---------- CLI ----------

function parseCliArgs(argv) {
  const out = {
    roomDir: null,
    dryRun: false,
    skipSteps: [],
    section: null,
    recursive: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') {
      out.dryRun = true;
    } else if (a === '--skip-step') {
      const n = parseInt(argv[i + 1], 10);
      if (!Number.isNaN(n) && n >= 1 && n <= 11) {
        out.skipSteps.push(n);
        i++;
      }
    } else if (a === '--recursive') {
      out.recursive = true;
    } else if (a === '--section') {
      out.section = argv[i + 1] || null;
      i++;
    } else if (a === '--help' || a === '-h') {
      printUsage();
      process.exit(0);
    } else if (!a.startsWith('--') && !out.roomDir) {
      out.roomDir = a;
    }
  }
  if (!out.roomDir) {
    // Prefer the registry's active room over the raw shell CWD. The CWD is
    // unreliable: any prior `cd` in the same session (e.g. sentineling
    // sub-rooms) leaves the shell pointing at a non-room directory, and heal
    // would silently scaffold spurious sections there.
    //
    // Resolution order:
    //   1. Explicit positional arg (already handled above).
    //   2. room-registry get-active (trusts the user's registered active room).
    //   3. CWD fallback (kept for bare-install / no-registry scenarios, but
    //      runHeal's room validation guard will catch misfires here).
    const registryActiveRoom = resolveActiveRoomFromRegistry();
    out.roomDir = registryActiveRoom || process.cwd();
  }
  return out;
}

/**
 * resolveActiveRoomFromRegistry() -> string|null
 *
 * Queries `scripts/room-registry get-active` synchronously. Returns the
 * absolute path of the active room, or null if the registry is unavailable,
 * the active room is unset, or the resolved path does not exist on disk.
 *
 * Intentionally swallows all errors -- this is a best-effort enhancement, not
 * a hard dependency. If the registry is absent or broken, we fall back to CWD
 * and let the room validation guard in runHeal() catch any misfire.
 */
function resolveActiveRoomFromRegistry() {
  try {
    const registryScript = path.join(REPO_ROOT, 'scripts', 'room-registry');
    if (!fs.existsSync(registryScript)) return null;

    const result = spawnSync('bash', [registryScript, 'get-active'], {
      encoding: 'utf8',
      timeout: 3000,
    });
    if (result.status !== 0) return null;

    const activeName = (result.stdout || '').trim();
    if (!activeName) return null;

    // The registry stores room names, not paths. Fetch the path via `read`.
    const readResult = spawnSync('bash', [registryScript, 'read', activeName], {
      encoding: 'utf8',
      timeout: 3000,
    });
    if (readResult.status !== 0) return null;

    let roomData;
    try { roomData = JSON.parse(readResult.stdout || '{}'); } catch (_e) { return null; }

    const roomPath = roomData.path || '';
    if (!roomPath) return null;

    // The path field may be relative (to ROOMS_HOME) or absolute.
    const roomsHome = process.env.MINDRIAN_ROOMS_HOME ||
      path.join(require('os').homedir(), 'MindrianRooms');
    const resolved = path.isAbsolute(roomPath)
      ? roomPath
      : path.join(roomsHome, roomPath);

    return fs.existsSync(resolved) ? resolved : null;
  } catch (_e) {
    return null;
  }
}

function printUsage() {
  process.stdout.write(
    'Usage: node scripts/heal-command.cjs [room-dir] [--dry-run]\n' +
    '       [--skip-step <N>] [--section <name>] [--recursive]\n\n' +
    '  --recursive   heal EVERY registered room (the "wire all rooms" sweep)\n' +
    '/mos:heal -- 10-step room wiring heal orchestrator.\n' +
    'Wraps the recipe at ~/MindrianRooms/mindrianOS/methodology/\n' +
    '2026-04-29-v1-11-0-room-wiring-heal-process.md.\n\n' +
    'When room-dir is omitted, resolution order is:\n' +
    '  1. room-registry get-active (preferred -- immune to shell CWD drift)\n' +
    '  2. Current working directory (fallback; validated as a real room)\n\n' +
    'heal refuses to operate on directories that are not rooms:\n' +
    '  - No .room-root, STATE.md, or ROOM.md found  -> error_not_a_room\n' +
    '  - 2+ child dirs each have .room-root         -> error_container_dir\n'
  );
}

// Read ~/MindrianRooms/.rooms/registry.json (honoring MINDRIAN_ROOMS_HOME) and
// return an array of { name, path } for every registered room with a resolvable
// path. Returns [] when no registry exists. The single "wire all rooms" source
// of truth -- same registry doctor.cjs class B/C reads.
function readRegistryRooms() {
  const home = process.env.MINDRIAN_ROOMS_HOME ||
    path.join(require('os').homedir(), 'MindrianRooms');
  const registryPath = path.join(home, '.rooms', 'registry.json');
  if (!fs.existsSync(registryPath)) return [];
  let reg;
  try { reg = JSON.parse(fs.readFileSync(registryPath, 'utf8')); } catch (_e) { return []; }
  const rooms = (reg.registry && reg.registry.rooms) || reg.rooms || {};
  const out = [];
  for (const name of Object.keys(rooms)) {
    const entry = rooms[name] || {};
    // Skip archived/sealed rooms -- they are intentionally out of the active set.
    if (entry.status === 'archived' || entry.sealed === true) continue;
    const p = entry.path || '';
    if (!p) continue;
    const resolved = path.isAbsolute(p) ? p : path.join(home, p);
    if (fs.existsSync(resolved)) out.push({ name: name, path: resolved });
  }
  return out;
}

// Recursive sweep: heal every registered room. This is the single
// "wire all rooms" command -- each room runs the full 11-step heal
// (room.db creation at step 4, then the hats->room.db migration at step 11),
// idempotent, so re-running is safe. Per-room failures never abort the sweep.
async function runHealRecursive(opts) {
  const rooms = readRegistryRooms();
  if (rooms.length === 0) {
    console.log('[heal --recursive] no registry at ~/MindrianRooms/.rooms/registry.json -- nothing to sweep.');
    return 0;
  }
  console.log('[heal --recursive] sweeping ' + rooms.length + ' registered room(s)' +
    (opts.dryRun ? ' (dry-run)' : '') + '...\n');
  let okRooms = 0, errRooms = 0;
  for (const room of rooms) {
    let env;
    try {
      env = await runHeal(room.path, {
        dryRun: opts.dryRun,
        skipSteps: opts.skipSteps,
        section: opts.section,
        silent: true,
      });
    } catch (e) {
      errRooms++;
      console.log('  error  ' + room.name + ' -- ' + String(e && e.message || e));
      continue;
    }
    const s = env.summary || {};
    const bad = (s.error_count || 0) > 0;
    if (bad) errRooms++; else okRooms++;
    console.log(
      '  ' + (bad ? 'warn ' : 'ok   ') + ' ' + room.name +
      ' (ok=' + (s.ok_count || 0) + ' err=' + (s.error_count || 0) +
      ' skip=' + (s.skipped_count || 0) + ')'
    );
  }
  console.log('\n[heal --recursive] done: ' + okRooms + ' healed, ' + errRooms + ' with errors.');
  // Exit 0 as long as the sweep ran; per-room errors are reported, not fatal.
  return 0;
}

async function main() {
  const opts = parseCliArgs(process.argv.slice(2));

  // --recursive: sweep every registered room (the "wire all rooms" command).
  if (opts.recursive) {
    const code = await runHealRecursive(opts);
    process.exit(code);
  }

  const env = await runHeal(opts.roomDir, {
    dryRun: opts.dryRun,
    skipSteps: opts.skipSteps,
    section: opts.section,
  });

  // Render brief summary to stdout.
  console.log('');
  console.log('heal-log.json: ' + path.join(env.room_dir, '.mindrian', 'heal-log.json'));
  console.log(
    'summary: ' +
    'ok=' + env.summary.ok_count + ' ' +
    'blocked=' + env.summary.blocked_count + ' ' +
    'skipped=' + env.summary.skipped_count + ' ' +
    'error=' + env.summary.error_count + ' ' +
    'exit_code=' + env.summary.exit_code
  );

  process.exit(env.summary.exit_code);
}

if (require.main === module) {
  main().catch(function (e) {
    console.error('heal-command crashed: ' + (e && e.message));
    if (e && e.stack) console.error(e.stack);
    process.exit(2);
  });
}

module.exports = {
  runHeal,
  assertIsRoom,
  isContainerDir,
  resolveActiveRoomFromRegistry,
  STEP_NAMES,
  CANONICAL_SECTIONS,
  SCHEMA_VERSION,
};
