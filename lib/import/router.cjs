'use strict';

/**
 * Phase 80 Stage 03 -- Deterministic router.
 *
 * Moves classified files from the source vault into the destination room
 * following the Decision 16 nested layout: room/{section}/{slug}/{slug}.md
 *
 * IMPORT-09 (Blocker 3 Locked Fix): when classification.section === 'inbox'
 * the router branches on confidence:
 *   confidence >= 0.45 -> inbox/suggested/{slug}/{slug}.md
 *   confidence  < 0.45 -> inbox/unclassified/{slug}/{slug}.md
 *
 * Filename collisions never overwrite: a second artifact that would land in
 * an already-occupied destination folder gets a "-imported-{YYYY-MM-DD}"
 * suffix (and -2, -3, ... if that collides too). Every collision is recorded
 * via recordCollision on the manifest.
 *
 * The router refuses to run if destination_room/STATE.md does not exist. This
 * prevents accidental routing into non-room directories.
 *
 * Meetings detour: files whose id appears in manifest.meetings[] land in
 * imports/{import_id}/meetings-pending/ instead of a room section. The
 * 80-04 orchestrator then pipes them through /mos:file-meeting.
 *
 * MWP edge names used by downstream consumers of routed artifacts:
 *   INFORMS, CONVERGES (canonical per docs/MWP-SPECIFICATION.md)
 */

const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');
const { updateFile, recordCollision } = require('./manifest.cjs');

const MAX_SLUG_LEN = 60;
const INBOX_SUGGESTED_THRESHOLD = 0.45;

function slugifyTitle(stem) {
  if (!stem) return '';
  return String(stem)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, MAX_SLUG_LEN)
    .replace(/^-+|-+$/g, '');
}

function pickSlug(file) {
  const fmTitle = file.source_frontmatter && file.source_frontmatter.title;
  if (fmTitle) {
    const s = slugifyTitle(String(fmTitle));
    if (s) return s;
  }
  const base = path.basename(file.source_path || file.source_abs_path || 'untitled');
  const stem = base.replace(/\.[^.]+$/, '');
  return slugifyTitle(stem) || 'untitled';
}

// IMPORT-09 Locked Fix: inbox substructure branching.
function resolveSectionSubpath(classification, slug) {
  const section = classification.section;
  const confidence = Number(classification.confidence) || 0;
  if (section === 'inbox') {
    if (confidence >= INBOX_SUGGESTED_THRESHOLD) {
      return path.join('inbox', 'suggested', slug);
    }
    return path.join('inbox', 'unclassified', slug);
  }
  return path.join(section, slug);
}

function nextNonCollidingFolder(roomDir, baseFolder, dateSlug) {
  const abs = path.join(roomDir, baseFolder);
  if (!fs.existsSync(abs)) return { folder: baseFolder, collided: false };
  const parent = path.dirname(baseFolder);
  const leaf = path.basename(baseFolder);
  const dated = path.join(parent, leaf + '-imported-' + dateSlug);
  if (!fs.existsSync(path.join(roomDir, dated))) {
    return { folder: dated, collided: true };
  }
  let n = 2;
  while (
    fs.existsSync(
      path.join(roomDir, parent, leaf + '-imported-' + dateSlug + '-' + n)
    )
  ) {
    n++;
  }
  return {
    folder: path.join(parent, leaf + '-imported-' + dateSlug + '-' + n),
    collided: true
  };
}

function injectProvenance(content, file, manifest) {
  const parsed = matter(content || '');
  parsed.data._imported_from = {
    source_path: file.source_path,
    source_vault: manifest.source_vault,
    import_date: (manifest.import_id || '').slice(0, 10)
  };
  return matter.stringify(parsed.content, parsed.data);
}

function routeFiles(manifest, opts) {
  opts = opts || {};
  const roomDir = opts.roomDir || manifest.destination_room;
  if (!roomDir) {
    throw new Error('routeFiles: destination_room not set on manifest');
  }
  if (!fs.existsSync(path.join(roomDir, 'STATE.md'))) {
    throw new Error(
      'routeFiles: refusing to route, destination room missing STATE.md at ' +
        roomDir
    );
  }

  const meetingFileIds = new Set(
    (manifest.meetings || []).map(function (m) {
      return m.source_file_id;
    })
  );
  const importStaging = path.join(roomDir, 'imports', manifest.import_id);
  const dateSlug = (manifest.import_id || '').slice(0, 10);
  const mode = opts.mode || manifest.mode || 'copy';

  for (const file of manifest.files) {
    if (!file.classification || !file.classification.section) continue;

    // Meeting detour (Blocker 5 fix).
    if (meetingFileIds.has(file.id)) {
      const meetingsPending = path.join(importStaging, 'meetings-pending');
      fs.mkdirSync(meetingsPending, { recursive: true });
      const target = path.join(
        meetingsPending,
        path.basename(file.source_path)
      );
      const content = fs.readFileSync(file.source_abs_path, 'utf8');
      fs.writeFileSync(target, content);
      updateFile(manifest, file.id, {
        destination_section: 'meetings-pending',
        destination_folder: path.relative(roomDir, path.dirname(target)),
        destination_path: path.relative(roomDir, target),
        destination_abs_path: target
      });
      if (mode === 'move') {
        try {
          fs.unlinkSync(file.source_abs_path);
        } catch (e) {
          /* soft-fail */
        }
      }
      continue;
    }

    const slug = pickSlug(file);
    const baseFolder = resolveSectionSubpath(file.classification, slug);
    const { folder, collided } = nextNonCollidingFolder(
      roomDir,
      baseFolder,
      dateSlug
    );
    const folderAbs = path.join(roomDir, folder);
    const targetSlug = path.basename(folder);
    const targetAbs = path.join(folderAbs, targetSlug + '.md');

    fs.mkdirSync(folderAbs, { recursive: true });
    const sourceContent = fs.readFileSync(file.source_abs_path, 'utf8');
    const enriched = injectProvenance(sourceContent, file, manifest);
    fs.writeFileSync(targetAbs, enriched);

    if (collided) {
      recordCollision(manifest, {
        source_file_id: file.id,
        intended_target: path.join(baseFolder, slug + '.md'),
        actual_target: path.relative(roomDir, targetAbs),
        reason: 'destination_folder_exists'
      });
    }

    // destination_section records the TOP-LEVEL section (inbox, problem-definition, ...)
    // not the sub-branch (inbox/suggested). This preserves backward compatibility
    // with manifest.files[].destination_section consumers while the full path lives
    // in destination_folder.
    const topSection = folder.split(path.sep)[0];
    updateFile(manifest, file.id, {
      destination_section: topSection,
      destination_folder: folder,
      destination_path: path.relative(roomDir, targetAbs),
      destination_abs_path: targetAbs,
      collision: !!collided
    });

    if (mode === 'move') {
      try {
        fs.unlinkSync(file.source_abs_path);
      } catch (e) {
        /* soft-fail */
      }
    }
  }

  manifest.stage_states.route.status = 'complete';
  manifest.stage_states.route.completed_at = new Date().toISOString();
  manifest.stage_states.route.files_moved = manifest.files.filter(function (f) {
    return f.destination_path;
  }).length;
  manifest.stage_states.route.collisions = (manifest.collisions || []).length;
  return manifest;
}

module.exports = {
  routeFiles: routeFiles,
  pickSlug: pickSlug,
  slugifyTitle: slugifyTitle,
  nextNonCollidingFolder: nextNonCollidingFolder,
  resolveSectionSubpath: resolveSectionSubpath,
  INBOX_SUGGESTED_THRESHOLD: INBOX_SUGGESTED_THRESHOLD,
  MAX_SLUG_LEN: MAX_SLUG_LEN
};
