'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 363 Plan 02 Task 1 -- the two-section cohort fixture room every 363
 * acceptance and Part 8 sweep test builds on. Test infrastructure only.
 *
 * buildRoom363({ role, withTimingArtifact }) -> { roomDir, marker, gapTerm,
 *   zones: { twoSection, oneSection }, cleanup }
 *
 * - roomDir lives under os.tmpdir() via mkdtemp; cleanup() removes only that
 *   mkdtemp root (never a caller-supplied path).
 * - room.db is seeded ONLY through lib/core/navigation.cjs writers (claim
 *   nodes for the artifacts); this helper holds no raw SQL of its own.
 * - Sections problem-definition and market-analysis each hold two artifacts
 *   in the nested form (section/name/name.md) with a ROOM.md identity file.
 * - .mindrian/whitespace-results.json is frozen (the Python pipeline never
 *   runs in tests, 363-RESEARCH Pitfall 22). Its shape is the one
 *   scripts/whitespace-command.cjs and lib/core/ambient-run.cjs
 *   _whitespaceAdapter read: a `gaps` array; each gap carries
 *   brain_framework, density_score, knn_density, nearest_room_artifacts
 *   (objects with artifact_id "<section>/..." and title, the field
 *   scripts/write-whitespace-sections.cjs derives sections from), problem_type
 *   and a zone_id. A `zone_term` and a `sections` array are carried as
 *   additive fields so a 363 consumer needs no path parsing.
 * - The planted marker (MARKER_PREFIX_363 + random hex) sits in artifact
 *   prose in both sections and never occurs in any zone term.
 * - role 'researcher' writes USER.md with canonical_role researcher; role
 *   'founder' writes canonical_role founder. withTimingArtifact adds a
 *   market-analysis/timing/<name>/<name>.md artifact (the /mos:diffusion
 *   `produces` path, the D-19 room signal).
 *
 * Hyphens only, no em-dashes (CLAUDE.md HARD RULE).
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const { openRoomDb, closeRoomDb } = require('../../lib/core/room-db.cjs');
const navigation = require('../../lib/core/navigation.cjs');
const userMdOps = require('../../lib/core/user-md-ops.cjs');

const MARKER_PREFIX_363 = 'SECRET-363-';
// A generic scientific phrase: passes auditQueryString, appears in no artifact.
const GAP_TERM_363 = 'acoustic biofilm disruption';

const SECTION_A = 'problem-definition';
const SECTION_B = 'market-analysis';

function must(result, what) {
  if (!result || result.ok !== true) {
    throw new Error('fixture-room-363: ' + what + ' failed: ' + JSON.stringify(result));
  }
  return result;
}

function writeFileUnder(roomDir, rel, body) {
  const abs = path.join(roomDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, body, 'utf8');
  return abs;
}

function sha(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

/*
 * Artifact prose is generic room text. The marker rides in a sentence so a
 * sweep that greps argv, logs and files for it can find it in room content.
 */
function artifactBody(title, marker, extra) {
  return '# ' + title + '\n\n'
    + 'Room note on ' + title.toLowerCase() + '. ' + extra + '\n\n'
    + 'Internal reference ' + marker + ' (room-only; never sent out).\n';
}

function buildRoom363(opts) {
  const options = (opts && typeof opts === 'object') ? opts : {};
  const role = options.role === 'founder' ? 'founder' : 'researcher';
  const marker = MARKER_PREFIX_363 + crypto.randomBytes(6).toString('hex');

  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-363-room-'));
  const roomDir = path.join(root, 'room');
  fs.mkdirSync(roomDir, { recursive: true });

  writeFileUnder(roomDir, 'ROOM.md',
    '---\nventure_name: Fixture Room 363\n---\n# Fixture Room 363\n\nTwo-section cohort fixture (Phase 363 Plan 02).\n');
  writeFileUnder(roomDir, 'STATE.md', '---\nventure_stage: Discovery\n---\n# State\n');

  // Sections and artifacts (nested form: section/name/name.md).
  const artifacts = [
    { section: SECTION_A, name: 'pain-points', title: 'Pain Points',
      extra: 'Operators report recurring surface fouling in closed water loops.' },
    { section: SECTION_A, name: 'problem-statement', title: 'Problem Statement',
      extra: 'Fouling raises maintenance cost and shortens equipment life.' },
    { section: SECTION_B, name: 'competitors', title: 'Competitors',
      extra: 'Incumbent cleaning services rely on periodic chemical dosing.' },
    { section: SECTION_B, name: 'market-sizing', title: 'Market Sizing',
      extra: 'The addressable base is closed-loop water systems in mid-size plants.' },
  ];
  if (options.withTimingArtifact === true) {
    artifacts.push({
      section: SECTION_B + '/timing', name: 'adoption-window', title: 'Adoption Window',
      extra: 'Timing note on when plants could adopt a non-chemical method.',
    });
  }

  for (const sec of [SECTION_A, SECTION_B]) {
    writeFileUnder(roomDir, path.join(sec, 'ROOM.md'),
      '# ' + sec + '\n\nSection identity file (ICM Layer 0).\n');
  }
  if (options.withTimingArtifact === true) {
    writeFileUnder(roomDir, path.join(SECTION_B, 'timing', 'ROOM.md'),
      '# timing\n\nSection identity file (ICM Layer 0).\n');
  }

  const written = [];
  for (const a of artifacts) {
    const rel = path.join(a.section, a.name, a.name + '.md');
    const body = artifactBody(a.title, marker, a.extra);
    writeFileUnder(roomDir, rel, body);
    written.push({ section: a.section, name: a.name, title: a.title, rel: rel, hash: sha(body) });
  }

  // room.db: created and seeded through the navigation write door only.
  const initDb = openRoomDb(roomDir, { allowExtension: true });
  try {
    written.forEach(function (a, i) {
      must(navigation.writeClaimNode(initDb, {
        knowledge_type: 'fact',
        text: a.title + ' note recorded in ' + a.section + ' ' + marker,
        sessionId: 'fixture-363',
        sourceSegment: 'seg-363-' + i,
      }), 'claim ' + a.rel);
    });
  } finally {
    closeRoomDb(initDb);
  }

  // Frozen whitespace results (no Python pipeline in tests).
  const artRef = function (a) {
    return { artifact_id: a.section + '/' + a.name + '/' + a.name + '.md', title: a.title };
  };
  const byName = {};
  written.forEach(function (a) { byName[a.name] = a; });

  const twoSection = {
    zone_id: 'zone-363-two',
    brain_framework: 'Reverse Salient Analysis',
    density_score: -5.4,
    knn_density: 0.012,
    nearest_room_artifacts: [artRef(byName['pain-points']), artRef(byName['competitors'])],
    sections: [SECTION_A, SECTION_B],
    zone_term: GAP_TERM_363,
    hypothesis: 'The room has not explored ' + GAP_TERM_363 + '.',
    strategic_rank: 0.9,
    problem_type: 'IDP',
  };
  const oneSection = {
    zone_id: 'zone-363-one',
    brain_framework: 'Jobs-to-be-Done',
    density_score: -3.1,
    knn_density: 0.031,
    nearest_room_artifacts: [artRef(byName['problem-statement'])],
    sections: [SECTION_A],
    zone_term: 'passive surface coating durability',
    hypothesis: 'The room has thin coverage of coating durability.',
    strategic_rank: 0.5,
    problem_type: 'IDP',
  };
  writeFileUnder(roomDir, path.join('.mindrian', 'whitespace-results.json'), JSON.stringify({
    metadata: {
      timestamp: '2026-09-29T00:00:00Z',
      room_artifact_count: written.length,
      brain_baseline_count: 10,
      frozen_for: 'phase-363-tests',
    },
    gaps: [twoSection, oneSection],
  }, null, 2));

  // USER.md through the canonical writer.
  const blend = { founder: 0, researcher: 0, operator: 0, investor: 0, mentor: 0, domain_expert: 0, student: 0 };
  blend[role] = 0.8;
  userMdOps.writeUserMdAtomic(path.join(roomDir, 'USER.md'), {
    canonical_role: role,
    role_blend: blend,
    problem_type: 'IDP',
  });

  function cleanup() {
    try { fs.rmSync(root, { recursive: true, force: true }); } catch (_e) { /* best-effort */ }
  }

  return {
    roomDir: roomDir,
    marker: marker,
    gapTerm: GAP_TERM_363,
    zones: { twoSection: twoSection, oneSection: oneSection },
    cleanup: cleanup,
  };
}

module.exports = {
  buildRoom363: buildRoom363,
  MARKER_PREFIX_363: MARKER_PREFIX_363,
  GAP_TERM_363: GAP_TERM_363,
};
