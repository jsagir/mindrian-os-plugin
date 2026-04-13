'use strict';

/**
 * MANIFEST.json module for Phase 80 vault import pipeline.
 *
 * Shape contract lives at lib/import/manifest.schema.json. writeManifest
 * performs a lightweight shape assertion (schema_version match) before
 * persisting. Every downstream import stage reads and writes through these
 * helpers so the Layer 4 manifest stays consistent across stage boundaries.
 */

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_VERSION = '1.0';

function createManifest(sourcePath, dateSlug) {
  return {
    schema_version: SCHEMA_VERSION,
    import_id: dateSlug,
    created_at: new Date().toISOString(),
    source_vault: sourcePath,
    destination_room: null,
    mode: 'copy',
    status: 'in_progress',
    main_topic: null,
    main_topic_source: null,
    stage_states: {
      ingest:   { status: 'pending', completed_at: null, files_scanned: 0 },
      classify: { status: 'pending', completed_at: null, human_edited: false, edits_count: 0 },
      route:    { status: 'pending', completed_at: null, files_moved: 0, collisions: 0 },
      enrich:   { status: 'pending', completed_at: null, wikilinks_added: 0, rooms_md_created: 0, minto_stubs_created: 0 }
    },
    files: [],
    people: [],
    meetings: [],
    collisions: [],
    warnings: [],
    undo: { is_undone: false, undone_at: null, undone_to_directory: null }
  };
}

function readManifest(manifestPath) {
  const raw = fs.readFileSync(manifestPath, 'utf8');
  return JSON.parse(raw);
}

function writeManifest(manifestPath, manifest) {
  if (!manifest || manifest.schema_version !== SCHEMA_VERSION) {
    throw new Error('manifest.schema_version must be ' + SCHEMA_VERSION);
  }
  const dir = path.dirname(manifestPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  const tmp = manifestPath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(manifest, null, 2), 'utf8');
  fs.renameSync(tmp, manifestPath);
}

function updateFile(manifest, fileId, patch) {
  const idx = manifest.files.findIndex(function (f) { return f.id === fileId; });
  if (idx === -1) {
    throw new Error('updateFile: file id not found: ' + fileId);
  }
  manifest.files[idx] = Object.assign({}, manifest.files[idx], patch);
  return manifest.files[idx];
}

function recordCollision(manifest, collision) {
  if (!collision || !collision.source_file_id) {
    throw new Error('recordCollision: source_file_id required');
  }
  manifest.collisions = manifest.collisions || [];
  manifest.collisions.push({
    source_file_id: collision.source_file_id,
    intended_target: collision.intended_target || null,
    actual_target: collision.actual_target || null,
    reason: collision.reason || 'unknown'
  });
  const match = manifest.files.find(function (f) { return f.id === collision.source_file_id; });
  if (match) {
    match.collision = true;
    match.collision_original_target = collision.intended_target || null;
  }
}

function reverseManifest(manifest) {
  const moves = [];
  const roomsMdToRemove = [];
  const mintoStubsToRemove = [];
  const undoneDir = manifest.undo && manifest.undo.undone_to_directory
    ? manifest.undo.undone_to_directory
    : 'imports/' + manifest.import_id + '/undone';

  // Reverse insertion order so undo mirrors route order.
  for (let i = manifest.files.length - 1; i >= 0; i--) {
    const f = manifest.files[i];
    if (f.destination_abs_path) {
      moves.push({
        from: f.destination_abs_path,
        to: path.join(undoneDir, f.destination_path || path.basename(f.destination_abs_path))
      });
    }
    if (f.enrichment && f.enrichment.rooms_md_written && f.destination_folder) {
      roomsMdToRemove.push(path.join(f.destination_folder, 'ROOM.md'));
    }
  }
  // MINTO stubs: one per section that received artifacts.
  const sectionsSeen = new Set();
  for (const f of manifest.files) {
    if (f.destination_section && !sectionsSeen.has(f.destination_section)) {
      sectionsSeen.add(f.destination_section);
      mintoStubsToRemove.push(path.join(f.destination_section, 'MINTO.md'));
    }
  }

  return { moves: moves, rooms_md_to_remove: roomsMdToRemove, minto_stubs_to_remove: mintoStubsToRemove };
}

module.exports = {
  SCHEMA_VERSION: SCHEMA_VERSION,
  createManifest: createManifest,
  readManifest: readManifest,
  writeManifest: writeManifest,
  updateFile: updateFile,
  recordCollision: recordCollision,
  reverseManifest: reverseManifest
};
