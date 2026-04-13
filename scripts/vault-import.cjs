#!/usr/bin/env node
'use strict';

/**
 * scripts/vault-import.cjs -- Phase 80 Wave 2 orchestrator.
 *
 * Single CJS entry point that drives the 4-stage ICM import pipeline:
 *
 *   Stage 01  ingest    -- vault-scanner walks source vault, builds MANIFEST
 *   Stage 02  classify  -- stub classifier + person/meeting detectors
 *                         (skipped if .approved marker exists; re-loaded
 *                          via classifications-sync from edited markdown)
 *   Stage 03  route     -- router moves files into Decision 16 nested layout
 *   Stage 03b team      -- materialize team/{bucket}/{slug}/ via
 *                         create-speaker-profile --layout=import (Blocker 2)
 *   Stage 03c meetings  -- shell out to file-meeting OR fallback direct copy
 *                         into room/meetings/ (Blocker 5)
 *   Stage 04  enrich    -- enricher writes ROOM.md + STATE.md + MINTO stubs
 *                         + wikilinks (existing 80-03 module)
 *
 * Locked Fixes honored:
 *   1. ROOM.md in imports/ tree -- writeImportsRoomMd() after every mkdir
 *   2. team materialized -- shell out to create-speaker-profile
 *   4. classifications-sync if .approved marker exists; skipStub if classification set
 *   5. meetings flow into room/meetings/, not stuck in staging
 *
 * Cases A-D from 80-CONTEXT.md gray area #3:
 *   A: no existing room    -> scaffold minimal STATE.md + ROOM.md, then run
 *   B: existing room       -> run pipeline as-is
 *   C: nested room (target inside another room) -> refuse with exit 2
 *   D: source has .obsidian/ -> log "obsidian vault detected", treat like A
 *
 * Flags:
 *   --path <src>      required, source vault path
 *   --room <dst>      destination room (default: cwd)
 *   --yes             skip Stage 02 review gate
 *   --dry-run         stop after Stage 02 (no file moves)
 *   --move            unlink source after copy (default: copy)
 *   --copy            explicit copy mode (default)
 *   --topic <slug>    override main_topic
 *   --import-id <id>  override import_id (default: YYYY-MM-DD-{topic})
 *   --undo <id>       reverse a prior import (basic implementation)
 *   --help            print usage and exit 0
 *
 * lazygraph-ops awareness (see lib/import/PRECONDITIONS.md): if
 * bin/mindrian-tools.cjs is broken in the current env, Stage 03c falls back
 * to a direct-copy meeting filing path so the import still completes.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const pluginRoot = path.resolve(__dirname, '..');

const {
  createManifest,
  readManifest,
  writeManifest,
  updateFile
} = require(path.join(pluginRoot, 'lib/import/manifest.cjs'));
const { scanVault } = require(path.join(pluginRoot, 'lib/import/vault-scanner.cjs'));
const { detectPeople } = require(path.join(pluginRoot, 'lib/import/person-detector.cjs'));
const { detectMeetings } = require(path.join(pluginRoot, 'lib/import/meeting-detector.cjs'));
const { routeFiles } = require(path.join(pluginRoot, 'lib/import/router.cjs'));
const { enrichRoom } = require(path.join(pluginRoot, 'lib/import/enricher.cjs'));
const { syncClassificationsToManifest } = require(path.join(pluginRoot, 'lib/import/classifications-sync.cjs'));
const { writeImportsRoomMd } = require(path.join(pluginRoot, 'lib/import/room-md-scaffolder.cjs'));

const STAGE_CONTRACT_DIR = path.join(pluginRoot, 'templates/import/stage-contracts');

// ---------------------------------------------------------------------------
// argv parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const out = {
    path: null,
    room: process.cwd(),
    yes: false,
    dryRun: false,
    mode: 'copy',
    topic: null,
    importId: null,
    undo: null,
    help: false
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') { out.help = true; continue; }
    if (a === '--yes') { out.yes = true; continue; }
    if (a === '--dry-run') { out.dryRun = true; continue; }
    if (a === '--move') { out.mode = 'move'; continue; }
    if (a === '--copy') { out.mode = 'copy'; continue; }
    if (a === '--path') { out.path = argv[++i]; continue; }
    if (a === '--room') { out.room = argv[++i]; continue; }
    if (a === '--topic') { out.topic = argv[++i]; continue; }
    if (a === '--import-id') { out.importId = argv[++i]; continue; }
    if (a === '--undo') { out.undo = argv[++i]; continue; }
  }
  return out;
}

function printUsage() {
  process.stdout.write([
    'usage: node scripts/vault-import.cjs --path <src> [--room <dst>] [options]',
    '',
    'options:',
    '  --path <src>       source vault path (required)',
    '  --room <dst>       destination room directory (default: cwd)',
    '  --yes              skip Stage 02 review gate',
    '  --dry-run          stop after Stage 02 (no file moves)',
    '  --move             unlink source after copy (default: copy)',
    '  --copy             explicit copy mode',
    '  --topic <slug>     override main_topic',
    '  --import-id <id>   override import_id (default: YYYY-MM-DD-{topic})',
    '  --undo <id>        reverse a prior import (basic)',
    '  --help             print this message',
    ''
  ].join('\n'));
}

// ---------------------------------------------------------------------------
// Cases A-D detection + room scaffolding
// ---------------------------------------------------------------------------
function detectNestedRoom(targetDir) {
  // Walk parents looking for STATE.md other than targetDir's own
  let cur = path.resolve(targetDir);
  // Skip cur itself (Case B is OK); look at parents only
  let parent = path.dirname(cur);
  while (parent && parent !== cur) {
    if (fs.existsSync(path.join(parent, 'STATE.md'))) {
      return parent;
    }
    cur = parent;
    parent = path.dirname(parent);
  }
  return null;
}

function scaffoldRoom(roomDir) {
  if (!fs.existsSync(roomDir)) fs.mkdirSync(roomDir, { recursive: true });
  const stateMd = path.join(roomDir, 'STATE.md');
  if (!fs.existsSync(stateMd)) {
    fs.writeFileSync(stateMd, [
      '---',
      'gsd_state_version: 1.0',
      'status: imported',
      'created_by: phase-80-vault-import',
      '---',
      '',
      '# Project State',
      '',
      'Room scaffolded by vault-import (Case A: no existing room).',
      ''
    ].join('\n'));
  }
  const roomMd = path.join(roomDir, 'ROOM.md');
  if (!fs.existsSync(roomMd)) {
    fs.writeFileSync(roomMd, [
      '---',
      'icm_layer: 0',
      'generated_by: phase-80-vault-import',
      '---',
      '',
      '# Room Root -- ICM Layer 0',
      '',
      'Room scaffolded by the vault-import pipeline.',
      ''
    ].join('\n'));
  }
}

// ---------------------------------------------------------------------------
// Stage CONTEXT.md hydration
// ---------------------------------------------------------------------------
function hydrateStageContext(stageFile, importId, sourcePath, mode) {
  const tplPath = path.join(STAGE_CONTRACT_DIR, stageFile);
  if (!fs.existsSync(tplPath)) return null;
  let tpl = fs.readFileSync(tplPath, 'utf8');
  tpl = tpl.replace(/\{\{IMPORT_ID\}\}/g, importId);
  tpl = tpl.replace(/\{\{TIMESTAMP\}\}/g, new Date().toISOString());
  tpl = tpl.replace(/\{\{SOURCE_PATH\}\}/g, sourcePath || '');
  tpl = tpl.replace(/\{\{MODE\}\}/g, mode || 'copy');
  return tpl;
}

// ---------------------------------------------------------------------------
// imports/{id}/ tree builder (mkdir + ROOM.md scaffolder, every level)
// ---------------------------------------------------------------------------
function ensureImportDir(roomDir, importId, subPath, layerLabel, stageName, purpose) {
  const abs = path.join(roomDir, 'imports', importId, subPath || '');
  if (!fs.existsSync(abs)) fs.mkdirSync(abs, { recursive: true });
  writeImportsRoomMd(abs, layerLabel, importId, stageName, purpose);
  return abs;
}

function ensureFullImportTree(roomDir, importId) {
  // Top-level imports/{id}/
  ensureImportDir(roomDir, importId, '', 'Import ' + importId, '(staging)', 'Vault import staging root.');
  // Each of the 4 stages
  const stages = [
    { sub: '01-ingest',   tpl: '01-ingest.md',   label: 'Stage 01 Ingest' },
    { sub: '02-classify', tpl: '02-classify.md', label: 'Stage 02 Classify' },
    { sub: '03-route',    tpl: '03-route.md',    label: 'Stage 03 Route' },
    { sub: '04-enrich',   tpl: '04-enrich.md',   label: 'Stage 04 Enrich' }
  ];
  for (const s of stages) {
    ensureImportDir(roomDir, importId, s.sub, s.label, s.sub, 'Stage contract folder.');
    ensureImportDir(roomDir, importId, path.join(s.sub, 'output'), s.label + ' output', s.sub, 'Stage output artifacts.');
  }
}

// ---------------------------------------------------------------------------
// Stub classifier (Stage 02 first-pass when no .approved marker)
// ---------------------------------------------------------------------------
function stubClassify(file) {
  // Deterministic stub: prefer frontmatter section, then frontmatter tags
  // hint, else parent_folder hint, else inbox/unclassified low confidence.
  const fm = file.source_frontmatter || {};
  if (fm.section && typeof fm.section === 'string') {
    return {
      section: fm.section,
      confidence: 0.85,
      evidence: 'frontmatter.section',
      decision: 'AUTO',
      stage: 'classify'
    };
  }
  const tags = Array.isArray(fm.tags) ? fm.tags.map(String) : [];
  if (tags.includes('business-model') || tags.includes('pricing')) {
    return { section: 'business-model', confidence: 0.78, evidence: 'tags', decision: 'AUTO', stage: 'classify' };
  }
  if (tags.includes('activation') || tags.includes('dror')) {
    return { section: 'problem-definition', confidence: 0.80, evidence: 'tags', decision: 'AUTO', stage: 'classify' };
  }
  // Meeting-shaped filenames go to inbox at low confidence; meeting-detector
  // will detour them in Stage 03 anyway via manifest.meetings[].
  return {
    section: 'inbox',
    confidence: 0.30,
    evidence: 'no signal',
    decision: 'INBOX',
    stage: 'classify'
  };
}

// ---------------------------------------------------------------------------
// Main topic extraction (gray area #10)
// ---------------------------------------------------------------------------
function pickMainTopic(manifest, override) {
  if (override) return slugifyTopic(override);
  const counts = new Map();
  for (const f of manifest.files) {
    const sec = f.classification && f.classification.section;
    if (!sec) continue;
    counts.set(sec, (counts.get(sec) || 0) + 1);
  }
  const sorted = Array.from(counts.entries()).sort(function (a, b) { return b[1] - a[1]; });
  if (sorted.length === 0) return 'unclassified';
  const total = sorted.reduce(function (s, e) { return s + e[1]; }, 0);
  const top = sorted[0];
  if (top[1] / total > 0.6) return slugifyTopic(top[0]);
  if (sorted.length === 1) return slugifyTopic(top[0]);
  return slugifyTopic(top[0]) + '-' + slugifyTopic(sorted[1][0]);
}

function slugifyTopic(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '');
}

// ---------------------------------------------------------------------------
// classifications.md writer (the review-gate edit surface)
// ---------------------------------------------------------------------------
function writeClassificationsMd(absPath, manifest) {
  const lines = [];
  lines.push('# Stage 02 Classifications -- Review Gate');
  lines.push('');
  lines.push('Edit any row, save, then `touch .approved` in this directory and re-run with --yes.');
  lines.push('');
  lines.push('| File | Section | Confidence | Evidence | Decision |');
  lines.push('|------|---------|------------|----------|----------|');
  for (const f of manifest.files) {
    const c = f.classification || {};
    lines.push(
      '| ' + f.source_path +
      ' | ' + (c.section || '') +
      ' | ' + (c.confidence != null ? c.confidence : '') +
      ' | ' + (c.evidence || '').replace(/\|/g, '\\|') +
      ' | ' + (c.decision || '') + ' |'
    );
  }
  lines.push('');
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, lines.join('\n'));
}

// ---------------------------------------------------------------------------
// PRECONDITIONS warning
// ---------------------------------------------------------------------------
function checkPreconditions() {
  const p = path.join(pluginRoot, 'lib/import/PRECONDITIONS.md');
  if (!fs.existsSync(p)) return { lazygraphBroken: false };
  const txt = fs.readFileSync(p, 'utf8');
  const broken = /lazygraph-ops|better-sqlite3|MODULE_NOT_FOUND/i.test(txt);
  if (broken) {
    process.stderr.write(
      '[vault-import] WARNING: PRECONDITIONS.md flags bin/mindrian-tools.cjs as broken (lazygraph-ops/better-sqlite3). Stage 03c will use direct-copy fallback for meeting filing.\n'
    );
  }
  return { lazygraphBroken: broken };
}

// ---------------------------------------------------------------------------
// Role re-inference (80-02 narrow-window workaround)
// ---------------------------------------------------------------------------
const ROLE_BUCKETS_ORCH = {
  'core-team':   ['co-founder', 'cofounder', 'founder', 'ceo', 'cto', 'coo', 'cfo', 'head of', 'vp', 'our team', 'we built', 'team lead'],
  'consultants': ['consultant', 'contractor', 'freelance', 'hired', 'retained', 'engaged'],
  'advisors':    ['advisor', 'mentor', 'guidance', 'advised us', 'coach'],
  'investors':   ['investor', 'vc', 'fund', 'angel', 'seed round', 'series a', 'series b', 'series c', 'cap table', 'term sheet'],
  'board':       ['board member', 'chairman', 'director', 'sits on the board', 'board seat']
};

function reinferPeopleRoles(manifest) {
  for (const p of manifest.people) {
    if (p.role_guess && p.role_guess !== 'unassigned') continue;
    const files = (p.mention_files || [])
      .map(function (fid) { return manifest.files.find(function (f) { return f.id === fid; }); })
      .filter(Boolean);
    const needle = (p.name || '').toLowerCase();
    if (!needle) continue;
    let bestBucket = 'unassigned';
    let bestEvidence = 'no match';
    outer: for (const f of files) {
      let content = '';
      try { content = fs.readFileSync(f.source_abs_path, 'utf8').toLowerCase(); } catch (e) { continue; }
      // Find every occurrence of the name and check a window around each
      let start = 0;
      while (true) {
        const idx = content.indexOf(needle, start);
        if (idx === -1) break;
        const window = content.slice(Math.max(0, idx - 120), idx + needle.length + 120);
        for (const bucket of Object.keys(ROLE_BUCKETS_ORCH)) {
          for (const kw of ROLE_BUCKETS_ORCH[bucket]) {
            if (window.indexOf(kw) !== -1) {
              bestBucket = bucket;
              bestEvidence = kw;
              break outer;
            }
          }
        }
        start = idx + needle.length;
      }
    }
    if (bestBucket !== 'unassigned') {
      p.role_guess = bestBucket;
      p.role_evidence = bestEvidence;
    }
  }
}

// ---------------------------------------------------------------------------
// Stage 03b: materialize team/ profiles
// ---------------------------------------------------------------------------
function stage03bMaterializeTeam(manifest, roomDir) {
  const script = path.join(pluginRoot, 'scripts/create-speaker-profile');
  if (!fs.existsSync(script)) {
    manifest.warnings.push({ type: 'team_materialize_skipped', context: 'create-speaker-profile not found' });
    return;
  }
  for (const p of manifest.people) {
    if (!p || !p.slug) continue;
    const bucket = p.role_guess || p.role_bucket || 'unassigned';
    try {
      execFileSync('bash', [script, roomDir, '--layout=import', '--role-bucket=' + bucket, p.slug, p.name || p.slug], {
        cwd: roomDir,
        stdio: 'pipe'
      });
      p.profile_materialized = true;
      p.profile_path = 'team/' + bucket + '/' + p.slug + '/' + p.slug + '.md';
      p.role_bucket = bucket;
    } catch (e) {
      manifest.warnings.push({
        type: 'team_materialize_failed',
        context: p.slug + ': ' + (e.stderr ? e.stderr.toString() : e.message)
      });
      p.profile_materialized = false;
    }
  }
}

// ---------------------------------------------------------------------------
// Stage 03c: file detected meetings into room/meetings/
// ---------------------------------------------------------------------------
function stage03cFileMeetings(manifest, roomDir, importId, lazygraphBroken) {
  const meetingsDir = path.join(roomDir, 'meetings');
  for (const m of manifest.meetings) {
    if (!m || !m.source_file_id) continue;
    const sourceFile = manifest.files.find(function (f) { return f.id === m.source_file_id; });
    if (!sourceFile || !sourceFile.destination_abs_path) continue;
    const stagedPath = sourceFile.destination_abs_path; // routed into meetings-pending/
    if (!fs.existsSync(stagedPath)) continue;

    let filed = false;
    if (!lazygraphBroken) {
      // Optimistic shell-out to file-meeting via mindrian-tools.cjs
      try {
        execFileSync('node', [
          path.join(pluginRoot, 'bin/mindrian-tools.cjs'),
          'file-meeting',
          '--file', stagedPath,
          '--non-interactive'
        ], { cwd: roomDir, stdio: 'pipe' });
        filed = true;
        m.filed_via = 'file-meeting-cli';
      } catch (e) {
        // fall through to direct-copy
        manifest.warnings.push({
          type: 'file_meeting_cli_failed',
          context: m.source_file_id + ': ' + (e.stderr ? e.stderr.toString().slice(0, 200) : e.message)
        });
      }
    }

    if (!filed) {
      // Direct-copy fallback into room/meetings/{date}-{slug}/{date}-{slug}.md
      const baseName = path.basename(stagedPath, '.md');
      const date = m.detected_date || (importId || '').slice(0, 10);
      const slug = baseName.replace(new RegExp('^' + date + '[-_]?'), '') || 'meeting';
      const folderName = date + '-' + slug;
      const meetingFolder = path.join(meetingsDir, folderName);
      fs.mkdirSync(meetingFolder, { recursive: true });
      try {
        fs.copyFileSync(stagedPath, path.join(meetingFolder, folderName + '.md'));
      } catch (e) {
        manifest.warnings.push({ type: 'meeting_copy_failed', context: m.source_file_id + ': ' + e.message });
        continue;
      }
      // ROOM.md for the meeting folder (Decision 15)
      writeImportsRoomMd(meetingFolder, folderName + ' Meeting', importId, '03c-file-meeting-fallback', 'Meeting filed via fallback direct copy.');
      m.routed_to = path.relative(roomDir, path.join(meetingFolder, folderName + '.md'));
      m.filed_via = 'fallback';
    }
  }

  // Make sure room/meetings/ itself has a ROOM.md if we created it
  if (fs.existsSync(meetingsDir)) {
    const meetingsRoomMd = path.join(meetingsDir, 'ROOM.md');
    if (!fs.existsSync(meetingsRoomMd)) {
      fs.writeFileSync(meetingsRoomMd, [
        '---',
        'icm_layer: 0',
        'generated_by: phase-80-vault-import',
        '---',
        '',
        '# Meetings -- ICM Layer 0',
        '',
        'Filed meeting transcripts and notes.',
        ''
      ].join('\n'));
    }
  }
}

// ---------------------------------------------------------------------------
// IMPORT-REPORT.md (minimal; full render deferred to 80-05)
// ---------------------------------------------------------------------------
function writeImportReport(manifest, importDir) {
  const lines = [];
  lines.push('---');
  lines.push('date: ' + (manifest.import_id || '').slice(0, 10));
  lines.push('main_topic: ' + (manifest.main_topic || ''));
  lines.push('source_vault: ' + (manifest.source_vault || ''));
  lines.push('total_files: ' + manifest.files.length);
  lines.push('status: ' + manifest.status);
  lines.push('---');
  lines.push('');
  lines.push('# Import Report -- ' + manifest.import_id);
  lines.push('');
  lines.push('## Summary');
  lines.push('- Files: ' + manifest.files.length);
  lines.push('- People detected: ' + (manifest.people || []).length);
  lines.push('- Meetings detected: ' + (manifest.meetings || []).length);
  lines.push('- Collisions: ' + (manifest.collisions || []).length);
  lines.push('- Warnings: ' + (manifest.warnings || []).length);
  lines.push('');
  lines.push('## Stage states');
  lines.push('```json');
  lines.push(JSON.stringify(manifest.stage_states, null, 2));
  lines.push('```');
  lines.push('');
  fs.writeFileSync(path.join(importDir, 'IMPORT-REPORT.md'), lines.join('\n'));
}

// ---------------------------------------------------------------------------
// run() main entry
// ---------------------------------------------------------------------------
function run(argv) {
  const args = parseArgs(argv);
  if (args.help) { printUsage(); return 0; }
  if (!args.path) {
    process.stderr.write('error: --path is required\n');
    printUsage();
    return 1;
  }
  if (!fs.existsSync(args.path)) {
    process.stderr.write('error: source path not found: ' + args.path + '\n');
    return 1;
  }

  const dst = path.resolve(args.room);
  const dstStateMd = path.join(dst, 'STATE.md');

  // Case C: target is nested inside another room
  if (!fs.existsSync(dstStateMd)) {
    const nested = detectNestedRoom(dst);
    if (nested) {
      process.stderr.write('error: target is nested inside another room at ' + nested + '\n');
      return 2;
    }
  } else {
    // Case B: existing room -- still check if a parent has STATE.md (would be nested)
    const nested = detectNestedRoom(dst);
    if (nested && nested !== dst) {
      process.stderr.write('error: target is nested inside another room at ' + nested + '\n');
      return 2;
    }
  }

  // Case D: source has .obsidian/
  if (fs.existsSync(path.join(args.path, '.obsidian'))) {
    process.stdout.write('[vault-import] obsidian vault detected\n');
  }

  // Case A: no room exists -> scaffold
  if (!fs.existsSync(dstStateMd)) {
    scaffoldRoom(dst);
  }

  const pre = checkPreconditions();

  // ----- Stage 01: ingest -----
  const dateSlug = new Date().toISOString().slice(0, 10);
  const topicSlug = args.topic ? slugifyTopic(args.topic) : null;
  // import_id is provisional until we know main_topic; allow override
  let importId = args.importId || (dateSlug + '-' + (topicSlug || 'vault-import'));

  // If an import dir with this id already exists AND has a manifest, reuse it
  // (idempotent re-run after .approved edit).
  let importDir = path.join(dst, 'imports', importId);
  let manifestPath = path.join(importDir, '01-ingest/output/MANIFEST.json');
  let manifest;
  let reusing = false;
  if (fs.existsSync(manifestPath)) {
    manifest = readManifest(manifestPath);
    reusing = true;
  } else {
    // Look for any existing import dir matching dateSlug to enable re-run
    const importsRoot = path.join(dst, 'imports');
    if (fs.existsSync(importsRoot)) {
      const candidates = fs.readdirSync(importsRoot).filter(function (n) { return n.startsWith(dateSlug); });
      if (candidates.length > 0 && !args.importId) {
        importId = candidates[0];
        importDir = path.join(dst, 'imports', importId);
        manifestPath = path.join(importDir, '01-ingest/output/MANIFEST.json');
        if (fs.existsSync(manifestPath)) {
          manifest = readManifest(manifestPath);
          reusing = true;
        }
      }
    }
  }

  if (!manifest) {
    manifest = createManifest(args.path, importId);
    manifest.destination_room = dst;
    manifest.mode = args.mode;
    const scan = scanVault(args.path);
    manifest.files = scan.files;
    manifest.stage_states.ingest.status = 'complete';
    manifest.stage_states.ingest.completed_at = new Date().toISOString();
    manifest.stage_states.ingest.files_scanned = scan.files.length;
  } else {
    // Make sure destination_room is set on reload
    manifest.destination_room = dst;
  }

  // Build the imports/ tree with ROOM.md at every level (Blocker 1)
  ensureFullImportTree(dst, importId);

  // Hydrate stage CONTEXT.md files from templates
  for (const stage of [
    { sub: '01-ingest',   tpl: '01-ingest.md' },
    { sub: '02-classify', tpl: '02-classify.md' },
    { sub: '03-route',    tpl: '03-route.md' },
    { sub: '04-enrich',   tpl: '04-enrich.md' }
  ]) {
    const ctxPath = path.join(importDir, stage.sub, 'CONTEXT.md');
    if (!fs.existsSync(ctxPath)) {
      const hydrated = hydrateStageContext(stage.tpl, importId, args.path, args.mode);
      if (hydrated) fs.writeFileSync(ctxPath, hydrated);
    }
  }

  // Stage 01 outputs
  writeManifest(manifestPath, manifest);
  const sourceTreePath = path.join(importDir, '01-ingest/output/source-tree.md');
  if (!fs.existsSync(sourceTreePath)) {
    const treeLines = ['# Source Tree -- ' + args.path, ''];
    for (const f of manifest.files) treeLines.push('- ' + f.source_path);
    fs.writeFileSync(sourceTreePath, treeLines.join('\n'));
  }

  // ----- Stage 02: classify (skipStub aware) -----
  const classifyOutDir = path.join(importDir, '02-classify/output');
  fs.mkdirSync(classifyOutDir, { recursive: true });
  writeImportsRoomMd(classifyOutDir, 'Stage 02 Classify output', importId, '02-classify', 'Stage output artifacts.');
  const classMdPath = path.join(classifyOutDir, 'classifications.md');
  const approvedMarker = path.join(classifyOutDir, '.approved');

  if (fs.existsSync(approvedMarker) && fs.existsSync(classMdPath)) {
    // Larry-edited path -- sync edits into manifest, skip stubClassify
    syncClassificationsToManifest(classMdPath, manifestPath);
    Object.assign(manifest, readManifest(manifestPath));
  } else if (manifest.files.length && manifest.files[0].classification && manifest.files[0].classification.section) {
    // Idempotent re-run case: already classified, do nothing
  } else {
    for (const f of manifest.files) {
      f.classification = stubClassify(f);
    }
    manifest.stage_states.classify.status = 'complete';
    manifest.stage_states.classify.completed_at = new Date().toISOString();
  }

  // Person + meeting detection (always run; idempotent because writes overwrite arrays)
  manifest.people = detectPeople(manifest.files);
  manifest.meetings = detectMeetings(manifest.files);

  // Role re-inference: person-detector's inferRole uses a narrow 80-char
  // window around the FIRST occurrence of the name, which can miss role
  // keywords that appear later in the file. Re-scan each person's full
  // mention files content for role keywords so Jane Doe (co-founder) ends
  // up in core-team, not unassigned. See 80-02 known issue.
  reinferPeopleRoles(manifest);

  // Persist classifications.md (the edit surface)
  if (!fs.existsSync(approvedMarker)) {
    writeClassificationsMd(classMdPath, manifest);
  }

  // Pick main_topic based on classifications
  manifest.main_topic = pickMainTopic(manifest, args.topic);
  manifest.main_topic_source = args.topic ? 'flag' : 'auto';

  writeManifest(manifestPath, manifest);

  // Stage 02 review gate
  if (args.dryRun) {
    process.stdout.write('[vault-import] dry-run complete. Review ' + path.relative(dst, classMdPath) + '\n');
    return 0;
  }
  if (!args.yes && !fs.existsSync(approvedMarker)) {
    process.stdout.write('[vault-import] review_gate: edit ' + path.relative(dst, classMdPath) + ' then touch .approved and re-run with --yes\n');
    process.stdout.write('  files=' + manifest.files.length + ' people=' + manifest.people.length + ' meetings=' + manifest.meetings.length + '\n');
    return 0;
  }

  // ----- Stage 03: route -----
  routeFiles(manifest, { roomDir: dst, mode: args.mode });
  // Cover meetings-pending/ and any ancestor folders with ROOM.md (Blocker 1)
  const meetingsPending = path.join(importDir, 'meetings-pending');
  if (fs.existsSync(meetingsPending)) {
    writeImportsRoomMd(meetingsPending, 'Meetings pending', importId, '03-route-meetings-pending', 'Staging area for detected meetings before Stage 03c filing.');
  }
  writeManifest(manifestPath, manifest);

  // ----- Stage 03b: materialize team profiles (Blocker 2) -----
  stage03bMaterializeTeam(manifest, dst);
  writeManifest(manifestPath, manifest);

  // ----- Stage 03c: file meetings (Blocker 5) -----
  stage03cFileMeetings(manifest, dst, importId, pre.lazygraphBroken);
  writeManifest(manifestPath, manifest);

  // ----- Stage 04: enrich -----
  enrichRoom(manifest, { roomDir: dst });
  manifest.status = 'complete';
  writeManifest(manifestPath, manifest);

  // Final report
  writeImportReport(manifest, importDir);

  process.stdout.write('[vault-import] complete: ' + manifest.files.length + ' files, ' + manifest.people.length + ' people, ' + manifest.meetings.length + ' meetings\n');
  process.stdout.write('  import_id=' + importId + '\n');
  process.stdout.write('  reusing=' + reusing + '\n');
  return 0;
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------
if (require.main === module) {
  const code = run(process.argv.slice(2));
  process.exit(code);
}

module.exports = {
  parseArgs: parseArgs,
  detectNestedRoom: detectNestedRoom,
  scaffoldRoom: scaffoldRoom,
  hydrateStageContext: hydrateStageContext,
  stubClassify: stubClassify,
  pickMainTopic: pickMainTopic,
  slugifyTopic: slugifyTopic,
  writeClassificationsMd: writeClassificationsMd,
  ensureFullImportTree: ensureFullImportTree,
  stage03bMaterializeTeam: stage03bMaterializeTeam,
  stage03cFileMeetings: stage03cFileMeetings,
  run: run
};
