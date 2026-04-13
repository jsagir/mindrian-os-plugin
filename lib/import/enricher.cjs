'use strict';

/**
 * Phase 80 Stage 04 -- Enricher.
 *
 * After Stage 03 routes files into the Decision-16 nested layout, this module:
 *
 *   1. Writes ROOM.md scaffolds at every directory Stage 03 created
 *      (IMPORT-03 + Decision 15). Includes intermediate folders like
 *      inbox/suggested and inbox/unclassified.
 *   2. Writes per-section STATE.md files for every top-level section that
 *      received 1+ classified artifacts (IMPORT-04).
 *   3. Writes MINTO.md stubs into every populated top-level section with
 *      the literal WARNING line so /mos:reason can target them later
 *      (IMPORT-05).
 *   4. Runs Phase 79 lib/vault/wikilink-builder.cjs buildTeamLinks against
 *      every routed artifact (IMPORT-08 team wikilink injection).
 *   5. Rewrites source [[wikilinks]] preserved on manifest.files[].source_wikilinks
 *      into new room-relative targets; unresolved links are collected on
 *      stats.unresolved_wikilinks (IMPORT-08 source link rewrite).
 *
 * Out of scope for this module (moved to 80-06):
 *   - Footer injection, De Stijl frontmatter normalization, callout promotion
 *     (IMPORT-10 branding)
 *   - Post-import smoke test (IMPORT-11)
 *
 * MWP edge names (canonical per docs/MWP-SPECIFICATION.md section "Edge Types"):
 *   INFORMS, CONVERGES. These are the two edge types a ROOM.md folder scaffold
 *   participates in as a structural container of artifacts that reference one
 *   another (INFORMS) and converge around themes (CONVERGES). Other canonical
 *   MWP edges (CONTRADICTS, ENABLES, INVALIDATES, REASONING_INFORMS,
 *   HSI_CONNECTION, REVERSE_SALIENT, CO_OCCURS) are artifact-level, not
 *   folder-level, so they are not declared here. Do NOT invent new edge names.
 */

const fs = require('node:fs');
const path = require('node:path');
const wb = require('../vault/wikilink-builder.cjs');

const MINTO_STUB =
  '> WARNING: Empty scaffold. Run `/mos:reason {section}` to populate.\n\n' +
  'This file holds the Minto/MECE structured reasoning for {section}. It is intentionally empty until /mos:reason runs against the current artifact set.\n';

function buildRoomMdScaffold(folderRel, children, mwpEdges) {
  const lines = [];
  lines.push('---');
  lines.push('icm_layer: 0');
  lines.push('folder: ' + folderRel);
  lines.push('child_count: ' + children.length);
  lines.push('generated_by: phase-80-vault-import');
  lines.push('---');
  lines.push('');
  lines.push('<!-- mwp_edges: ' + mwpEdges.join(', ') + ' -->');
  lines.push('');
  lines.push('# ' + folderRel);
  lines.push('');
  lines.push('ICM Layer 0 identity for this folder.');
  lines.push('');
  lines.push('## Children (' + children.length + ')');
  for (const c of children) lines.push('- [[' + c + ']]');
  lines.push('');
  return lines.join('\n');
}

// IMPORT-04: per-section STATE.md.
function buildSectionStateMd(section, artifacts) {
  const lines = [];
  lines.push('---');
  lines.push('section: ' + section);
  lines.push('artifact_count: ' + artifacts.length);
  lines.push('generated_by: phase-80-vault-import');
  lines.push('---');
  lines.push('');
  lines.push('# ' + section + ' Section State');
  lines.push('');
  lines.push('Classified artifacts in this section:');
  lines.push('');
  for (const slug of artifacts) lines.push('- [[' + slug + ']]');
  lines.push('');
  return lines.join('\n');
}

function writeIfMissing(absPath, content) {
  if (fs.existsSync(absPath)) return false;
  fs.mkdirSync(path.dirname(absPath), { recursive: true });
  fs.writeFileSync(absPath, content);
  return true;
}

// Adapt manifest.people[] entries to the shape wikilink-builder expects.
// Phase 79 buildTeamLinks wants { name, displayName, path, category }.
function teamProfilesFromManifest(manifest) {
  const people = manifest.people || [];
  return people
    .filter(function (p) { return p && (p.slug || p.name); })
    .map(function (p) {
      const slug = p.slug || p.name;
      const displayName = p.displayName || p.name || slug;
      const category = p.role_bucket || p.category || 'unassigned';
      return {
        name: slug,
        displayName: displayName,
        path: p.profile_path || ('team/' + category + '/' + slug + '/' + slug + '.md'),
        category: category
      };
    });
}

function enrichRoom(manifest, opts) {
  opts = opts || {};
  const roomDir = opts.roomDir || manifest.destination_room;
  if (!roomDir) throw new Error('enrichRoom: destination_room not set on manifest');
  const mwpEdges = opts.mwpEdges || ['INFORMS', 'CONVERGES'];
  const stats = {
    rooms_md_created: 0,
    state_md_created: 0,
    minto_stubs_created: 0,
    wikilinks_added: 0,
    unresolved_wikilinks: []
  };

  // ----- 1. Collect folder + section bookkeeping from manifest.files -----
  const folderChildren = new Map(); // leaf folder -> [slug.md, ...]
  const sectionArtifacts = new Map(); // top-level section -> [leaf-slug, ...]
  const touched = new Set(); // every ancestor folder we need ROOM.md for

  for (const f of manifest.files) {
    if (!f.destination_folder) continue;
    // Skip meetings-pending staging (those get processed by 80-04 Stage 03c).
    if (f.destination_section === 'meetings-pending') continue;

    const folderRel = f.destination_folder;
    const arr = folderChildren.get(folderRel) || [];
    arr.push(path.basename(f.destination_path));
    folderChildren.set(folderRel, arr);

    const segments = folderRel.split(path.sep);
    for (let i = segments.length; i >= 1; i--) {
      touched.add(segments.slice(0, i).join(path.sep));
    }

    const topSection = segments[0];
    const leaf = path.basename(folderRel);
    const list = sectionArtifacts.get(topSection) || [];
    list.push(leaf);
    sectionArtifacts.set(topSection, list);
  }

  // ----- 2. ROOM.md scaffolds at every touched folder (leaf + intermediates) -----
  for (const folderRel of touched) {
    const abs = path.join(roomDir, folderRel, 'ROOM.md');
    let children = folderChildren.get(folderRel) || [];
    if (children.length === 0) {
      // Intermediate folder: its children are the direct sub-folders we also touched.
      children = Array.from(touched)
        .filter(function (p) { return path.dirname(p) === folderRel; })
        .map(function (p) { return path.basename(p); });
    }
    if (writeIfMissing(abs, buildRoomMdScaffold(folderRel, children, mwpEdges))) {
      stats.rooms_md_created++;
    }
  }

  // ----- 3. Per-section STATE.md (IMPORT-04) -----
  for (const [section, artifacts] of sectionArtifacts.entries()) {
    const abs = path.join(roomDir, section, 'STATE.md');
    if (writeIfMissing(abs, buildSectionStateMd(section, artifacts))) {
      stats.state_md_created++;
    }
  }

  // ----- 4. MINTO.md stubs (IMPORT-05) -----
  for (const section of sectionArtifacts.keys()) {
    const mintoAbs = path.join(roomDir, section, 'MINTO.md');
    if (!fs.existsSync(mintoAbs)) {
      fs.mkdirSync(path.dirname(mintoAbs), { recursive: true });
      fs.writeFileSync(mintoAbs, MINTO_STUB.replace(/\{section\}/g, section));
      stats.minto_stubs_created++;
    }
  }

  // ----- 5. Wikilink injection via Phase 79 buildTeamLinks -----
  const teamProfiles = teamProfilesFromManifest(manifest);
  for (const f of manifest.files) {
    if (!f.destination_abs_path) continue;
    let content;
    try {
      content = fs.readFileSync(f.destination_abs_path, 'utf8');
    } catch (e) {
      stats.unresolved_wikilinks.push({ file_id: f.id, error: 'read_failed: ' + e.message });
      continue;
    }
    const linked = wb.buildTeamLinks(content, teamProfiles, {
      ownProfilePath: f.destination_path
    });
    if (linked !== content) {
      try {
        fs.writeFileSync(f.destination_abs_path, linked);
        stats.wikilinks_added++;
      } catch (e) {
        stats.unresolved_wikilinks.push({ file_id: f.id, error: 'write_failed: ' + e.message });
      }
    }
  }

  // ----- 6. Source [[wikilink]] rewrite (IMPORT-08) -----
  for (const f of manifest.files) {
    if (!f.source_wikilinks || !f.source_wikilinks.length) continue;
    if (!f.destination_abs_path) continue;
    for (const link of f.source_wikilinks) {
      const targetFile = manifest.files.find(function (other) {
        return (
          other.destination_folder &&
          path.basename(other.destination_folder) === link
        );
      });
      const targetPerson = (manifest.people || []).find(function (p) {
        return p.slug === link || p.name === link;
      });
      let resolved = null;
      if (targetFile) {
        resolved = targetFile.destination_path;
      } else if (targetPerson) {
        resolved =
          targetPerson.profile_path ||
          ('team/' +
            (targetPerson.role_bucket || 'unassigned') +
            '/' +
            targetPerson.slug +
            '/' +
            targetPerson.slug +
            '.md');
      }
      if (resolved) {
        let cur;
        try {
          cur = fs.readFileSync(f.destination_abs_path, 'utf8');
        } catch (e) {
          stats.unresolved_wikilinks.push({ file_id: f.id, link: link, error: 'read_failed' });
          continue;
        }
        const marker = '\nRelated: [[' + resolved + ']]\n';
        if (!cur.includes(marker)) {
          fs.writeFileSync(f.destination_abs_path, cur + marker);
        }
      } else {
        stats.unresolved_wikilinks.push({ file_id: f.id, link: link });
      }
    }
  }

  manifest.stage_states.enrich.status = 'complete';
  manifest.stage_states.enrich.completed_at = new Date().toISOString();
  manifest.stage_states.enrich.wikilinks_added = stats.wikilinks_added;
  manifest.stage_states.enrich.rooms_md_created = stats.rooms_md_created;
  manifest.stage_states.enrich.minto_stubs_created = stats.minto_stubs_created;
  return stats;
}

module.exports = {
  enrichRoom: enrichRoom,
  buildRoomMdScaffold: buildRoomMdScaffold,
  buildSectionStateMd: buildSectionStateMd,
  teamProfilesFromManifest: teamProfilesFromManifest,
  MINTO_STUB: MINTO_STUB
};
