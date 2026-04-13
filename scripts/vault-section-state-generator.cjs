#!/usr/bin/env node
/**
 * MindrianOS Plugin -- Vault Section STATE Generator
 *
 * Drops a STATE.md file into every section folder of a Data Room (top-level
 * sections plus every sub-room section, per SECTION-05 recursive rule). Each
 * STATE.md reports: artifact count, completeness %, last-updated date, gap
 * status, contributors, wikilinks to every artifact in the section, and a
 * navigation block linking back to the parent room and to the section's
 * sibling trifecta files (ROOM.md identity + MINTO.md reasoning).
 *
 * Trifecta contract (ARCH-02): every section folder must contain three MOC
 * anchors: ROOM.md (identity, Decision 15), STATE.md (status, this script),
 * MINTO.md (reasoning, companion script). Together these form a tier-1 MOC
 * hub so Obsidian users, /mos:status, and /mos:diagnose can land in any
 * section and understand it instantly.
 *
 * Pure CJS, zero npm dependencies.
 *
 *   node scripts/vault-section-state-generator.cjs <roomDir> [--dry-run] [--section <name>]
 *
 * Behaviour:
 *   - Default: walk room.sections + room.subRooms[].sections, write STATE.md
 *     into every section folder (even empty ones, per SECTION-07).
 *   - --section <name>: limit to one top-level section (debug path).
 *   - --dry-run: report intended writes + skips, do not touch disk.
 *
 * Idempotent (SECTION / WIKI-07): stable date formatting, sorted artifact and
 * contributor lists, atomic .tmp + rename write, byte-identical skip.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const {
  scanRoom,
  parseFrontmatter,
  slugToTitle,
} = require('../lib/vault/room-scanner.cjs');

// ---------- CLI ----------

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const sectionFlagIdx = argv.indexOf('--section');
const SECTION_FILTER =
  sectionFlagIdx !== -1 && argv[sectionFlagIdx + 1]
    ? argv[sectionFlagIdx + 1]
    : null;
const roomArg = argv.find(
  (a, i) => !a.startsWith('--') && argv[i - 1] !== '--section'
);

function usage() {
  process.stderr.write(
    'Usage: node scripts/vault-section-state-generator.cjs <roomDir> [--dry-run] [--section <name>]\n'
  );
}

// ---------- Helpers ----------

function today() {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatMtime(ms) {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function computeCompleteness(count) {
  if (count <= 0) return 0;
  if (count === 1) return 20;
  if (count === 2) return 40;
  if (count === 3) return 60;
  if (count === 4) return 80;
  return 100;
}

function findLastUpdated(files) {
  let max = 0;
  for (const f of files) {
    try {
      const st = fs.statSync(f.path);
      if (st.mtimeMs > max) max = st.mtimeMs;
    } catch (_) {
      /* ignore */
    }
  }
  if (max === 0) return 'unknown';
  return formatMtime(max);
}

function gapStatusFor(count) {
  if (count === 0) return 'critical';
  if (count < 3) return 'partial';
  return 'none';
}

function sectionStatusFor(count) {
  if (count === 0) return 'empty';
  return 'active';
}

/**
 * Extract contributors from artifact frontmatter `sources:` or body matches
 * against known team displayNames. Lightweight grep, no NLP.
 */
function extractContributors(files, teamProfiles) {
  const out = new Map();
  const namePatterns = teamProfiles.map((p) => ({
    profile: p,
    re: new RegExp(
      '\\b' + p.displayName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b'
    ),
  }));
  for (const f of files) {
    let content = '';
    try {
      content = fs.readFileSync(f.path, 'utf-8');
    } catch (_) {
      continue;
    }
    const fm = parseFrontmatter(content);
    // sources: "[a, b]" or "a, b"
    if (fm.sources) {
      const raw = String(fm.sources).replace(/^\[|\]$/g, '');
      for (const token of raw.split(',')) {
        const t = token.trim().replace(/^['"]|['"]$/g, '');
        if (!t) continue;
        // Try to resolve to a team profile by slug or displayName
        const hit = teamProfiles.find(
          (p) => p.name === t || p.displayName === t
        );
        if (hit) out.set(hit.name, hit);
      }
    }
    for (const { profile, re } of namePatterns) {
      if (re.test(content)) out.set(profile.name, profile);
    }
  }
  return Array.from(out.values()).sort((a, b) =>
    a.displayName.localeCompare(b.displayName)
  );
}

function wikilinkForArtifact(file, sectionDir, roomDir) {
  // Section-relative path from the STATE.md sitting at sectionDir/STATE.md
  const rel = path
    .relative(sectionDir, file.path)
    .split(path.sep)
    .join('/');
  const base = path.basename(file.path, '.md');
  const display = slugToTitle(base);
  return `[[${rel}|${display}]]`;
}

function computeMetrics(sectionDir, contentFiles, teamProfiles) {
  const files = contentFiles
    .filter((f) => f.path.startsWith(sectionDir + path.sep))
    .filter((f) => !f.isFiledTo) // filed-to stubs are not artifacts
    .sort((a, b) => a.relPath.localeCompare(b.relPath));
  const count = files.length;
  return {
    files,
    count,
    completeness: computeCompleteness(count),
    lastUpdated: findLastUpdated(files),
    gapStatus: gapStatusFor(count),
    contributors: extractContributors(files, teamProfiles),
    status: sectionStatusFor(count),
  };
}

// ---------- Rendering ----------

function renderSectionState(section, room, opts) {
  const metrics = opts.metrics;
  const sectionTitle = slugToTitle(section.name);
  const date = today();
  const parentRel = path
    .relative(section.dir, path.join(section.parentRoomDir, 'STATE.md'))
    .split(path.sep)
    .join('/');
  const subRoomTag = section.isSubRoom ? ` (sub-room: ${section.subRoomName})` : '';

  const artifactLines =
    metrics.count === 0
      ? ['> [!warning] No artifacts filed yet.']
      : metrics.files.map(
          (f) => '- ' + wikilinkForArtifact(f, section.dir, room.roomDir)
        );

  const contributorLines =
    metrics.contributors.length === 0
      ? ['- *(no contributors detected yet)*']
      : metrics.contributors.map((p) => {
          const rel = path
            .relative(section.dir, p.path)
            .split(path.sep)
            .join('/');
          return `- [[${rel}|${p.displayName}]]`;
        });

  const gapLines =
    metrics.count === 0
      ? ['> [!warning] Open Gaps', '> - Section has zero artifacts -- filing blocked']
      : metrics.count < 3
      ? [
          '> [!warning] Open Gaps',
          `> - Only ${metrics.count} artifact${metrics.count === 1 ? '' : 's'} filed; minimum 3 recommended for MECE coverage`,
        ]
      : ['> [!note] No blocking gaps detected'];

  return [
    '---',
    'type: section-state',
    `section: ${section.name}`,
    `created: ${date}`,
    `last_updated: ${date}`,
    `room: ${room.roomName}`,
    'parent-moc: ROOM.md',
    `status: ${metrics.status}`,
    '---',
    '',
    `# ${sectionTitle} -- State${subRoomTag}`,
    '',
    '> [!abstract] Section Status',
    `> ${metrics.count} artifact${metrics.count === 1 ? '' : 's'} -- ${metrics.completeness}% complete -- last updated ${metrics.lastUpdated}`,
    '',
    '## Metrics',
    '',
    '| Metric | Value |',
    '|--------|-------|',
    `| Artifacts | ${metrics.count} |`,
    `| Completeness | ${metrics.completeness}% |`,
    `| Last Updated | ${metrics.lastUpdated} |`,
    `| Gap Status | ${metrics.gapStatus} |`,
    `| Contributors | ${metrics.contributors.length} |`,
    '',
    '## Artifacts',
    '',
    ...artifactLines,
    '',
    '## Contributors',
    '',
    ...contributorLines,
    '',
    '## Gaps',
    '',
    ...gapLines,
    '',
    '## Navigation',
    '',
    `- Parent room: [[${parentRel}|${room.roomName} STATE]]`,
    `- Section identity: [[ROOM.md|${section.name} ROOM]]`,
    `- Section reasoning: [[MINTO.md|${section.name} MINTO]]`,
    '',
    '---',
    `*Filed by MindrianOS -- Section STATE -- ${date} -- ${room.roomName}/${section.name}*`,
    '',
  ].join('\n');
}

// ---------- Walk ----------

function walkAllSections(room) {
  const out = [];
  for (const s of room.sections) {
    out.push({
      name: s.name,
      dir: s.path,
      parentRoomDir: room.roomDir,
      isSubRoom: false,
    });
  }
  for (const sr of room.subRooms) {
    for (const s of sr.sections) {
      out.push({
        name: s.name,
        dir: s.path,
        parentRoomDir: sr.path,
        isSubRoom: true,
        subRoomName: sr.name,
      });
    }
  }
  return out;
}

// ---------- Idempotent write ----------

function writeOrPrint(targetPath, content, dryRun) {
  let existing = null;
  try {
    existing = fs.readFileSync(targetPath, 'utf-8');
  } catch (_) {
    /* fresh */
  }
  if (existing === content) {
    if (dryRun) process.stdout.write(`skip (identical): ${targetPath}\n`);
    return 'skipped';
  }
  if (dryRun) {
    process.stdout.write(
      `would write STATE.md: ${targetPath} (${content.length} bytes)\n`
    );
    return 'planned';
  }
  const tmp = targetPath + '.tmp';
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, targetPath);
  process.stdout.write(`wrote STATE.md: ${targetPath}\n`);
  return 'written';
}

// ---------- Main ----------

function generateAllSectionStates(roomDir, opts = {}) {
  const dryRun = !!opts.dryRun;
  const sectionFilter = opts.sectionFilter || null;
  const room = scanRoom(roomDir);
  const sections = walkAllSections(room);
  const results = { planned: 0, written: 0, skipped: 0, total: 0 };

  for (const section of sections) {
    if (sectionFilter && section.name !== sectionFilter) continue;
    if (!fs.existsSync(section.dir)) continue;
    results.total += 1;

    const metrics = computeMetrics(section.dir, room.contentFiles, room.teamProfiles);
    const content = renderSectionState(section, room, { metrics });
    const target = path.join(section.dir, 'STATE.md');
    const outcome = writeOrPrint(target, content, dryRun);
    results[outcome] = (results[outcome] || 0) + 1;
  }

  process.stdout.write(
    `\nSection STATE generator summary for ${room.roomName}: ` +
      `${results.total} sections -- ` +
      `written=${results.written || 0} planned=${results.planned || 0} skipped=${results.skipped || 0}\n`
  );

  return results;
}

if (require.main === module) {
  if (!roomArg) {
    usage();
    process.exit(1);
  }
  const ROOM_DIR = path.resolve(roomArg);
  if (!fs.existsSync(ROOM_DIR)) {
    process.stderr.write('ERROR: room dir does not exist: ' + ROOM_DIR + '\n');
    process.exit(1);
  }
  try {
    generateAllSectionStates(ROOM_DIR, {
      dryRun: DRY_RUN,
      sectionFilter: SECTION_FILTER,
    });
  } catch (e) {
    process.stderr.write('ERROR: ' + e.message + '\n');
    process.exit(2);
  }
}

module.exports = {
  generateAllSectionStates,
  renderSectionState,
  walkAllSections,
  computeMetrics,
  computeCompleteness,
  findLastUpdated,
  extractContributors,
  writeOrPrint,
};
