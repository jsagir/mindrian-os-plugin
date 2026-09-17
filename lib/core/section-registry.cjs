/**
 * MindrianOS Plugin - Section Registry
 * Metadata for DD-aligned sections + dynamic discovery.
 * Pure Node.js built-ins only.
 */

'use strict';

const fs = require('fs');
const path = require('path');

/**
 * 11 DD-aligned core sections with label and De Stijl color.
 * Sourced from build-graph SECTION_COLORS/SECTION_LABELS.
 * Phase 275 (D-01): promoted opportunity-bank + funding from EXTENDED_SECTION_META; minted strategy.
 */
const CORE_SECTIONS = {
  'problem-definition':    { label: 'PROBLEM DEFINITION',    color: '#A63D2F' },
  'market-analysis':       { label: 'MARKET ANALYSIS',       color: '#C8A43C' },
  'solution-design':       { label: 'SOLUTION DESIGN',       color: '#5C5A56' },
  'business-model':        { label: 'BUSINESS MODEL',        color: '#2D6B4A' },
  'competitive-analysis':  { label: 'COMPETITIVE ANALYSIS',  color: '#B5602A' },
  'team-execution':        { label: 'TEAM & EXECUTION',      color: '#1E3A6E' },
  'legal-ip':              { label: 'LEGAL & IP',            color: '#6B4E8B' },
  'financial-model':       { label: 'FINANCIAL MODEL',       color: '#2A6B5E' },
  'opportunity-bank':      { label: 'OPPORTUNITY BANK',      color: '#8B6914' },
  'funding':               { label: 'FUNDING',               color: '#1A5276' },
  'strategy':              { label: 'STRATEGY',              color: '#8B2942' },
};

/**
 * Pre-assigned metadata for known extension sections.
 */
const EXTENDED_SECTION_META = {
  'personas':         { label: 'PERSONAS',         color: '#6C3483' },
};

/**
 * Directories that are structural (not sections). `references` (Phase 275,
 * D-01) is the new ICM L3 factory directory: stable factory recipe material,
 * not a destination that accumulates methodology content -- the same
 * distinction that already keeps `meetings` structural.
 */
const STRUCTURAL_DIRS = ['meetings', 'team', 'references'];

// Phase 169 GDH-03/04 (D-169-07): the single source of truth for the
// artifact-extension filter. Accepts .md/.docx/.html/.htm while excluding the
// identity files STATE.md / ROOM.md (and any dot-prefixed file). Lives here in
// section-registry (zero deps) so both the section-qualification pass below and
// lazygraph-ops.cjs (which already requires this module) share ONE predicate
// with no drift. Semantics are byte-equivalent to the former local
// _isIndexableArtifactFile in lazygraph-ops.cjs.
function isIndexableArtifactFile(name) {
  if (typeof name !== 'string' || name.length === 0) return false;
  // CONTEXT.md (Phase 275) is an ICM L2 contract file, a sibling of the L0
  // ROOM.md identity file, not an L4 artifact -- excluded from indexing here.
  if (name === 'STATE.md' || name === 'ROOM.md' || name === 'CONTEXT.md') return false;
  if (name.startsWith('.')) return false;
  return /\.(md|docx|html|htm)$/i.test(name);
}

/**
 * Discover sections in a room directory.
 * A directory qualifies as a section if it contains at least one .md file
 * or has a STATE.md. Excludes hidden dirs and structural dirs.
 *
 * @param {string} roomDir - Absolute or relative path to room directory
 * @returns {{ core: string[], extended: string[], all: string[], getMeta: function }}
 */
function discoverSections(roomDir) {
  const resolved = path.resolve(roomDir);
  const core = [];
  const extended = [];

  let entries;
  try {
    entries = fs.readdirSync(resolved, { withFileTypes: true });
  } catch (e) {
    return { core, extended, all: [], getMeta: () => null };
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const name = entry.name;

    // Skip hidden directories
    if (name.startsWith('.')) continue;

    // Skip structural directories
    if (STRUCTURAL_DIRS.includes(name)) continue;

    const dirPath = path.join(resolved, name);

    // Check if directory qualifies as a section
    const hasStateMd = fs.existsSync(path.join(dirPath, 'STATE.md'));
    let hasMdFiles = false;
    if (!hasStateMd) {
      try {
        const files = fs.readdirSync(dirPath);
        hasMdFiles = files.some(f => f.endsWith('.md'));
      } catch (e) {
        // skip unreadable dirs
        continue;
      }
    }

    // Nested-artifact qualification (CLAUDE.md decision #16, v1.9.7): under the
    // Obsidian-nested convention every artifact sits in its own subfolder
    // (section/name/name.md), so a section can have ZERO direct .md files yet
    // still hold real artifacts one level down. If the flat check above found
    // nothing, descend ONE level: any immediate child directory (not
    // dot-prefixed, and NOT a sub-room carrying a .room-root sentinel) that
    // holds an indexable artifact qualifies the section. First hit wins.
    let hasNestedArtifacts = false;
    if (!hasStateMd && !hasMdFiles) {
      let children;
      try {
        children = fs.readdirSync(dirPath, { withFileTypes: true });
      } catch (e) {
        continue; // skip unreadable dirs
      }
      for (const child of children) {
        if (!child.isDirectory()) continue;
        if (child.name.startsWith('.')) continue;
        const childPath = path.join(dirPath, child.name);
        // A sub-room (own .room-root sentinel) must NOT qualify its parent as a
        // section; the sub-room owns its own room.db and rebuild pass.
        if (fs.existsSync(path.join(childPath, '.room-root'))) continue;
        try {
          const childFiles = fs.readdirSync(childPath);
          if (childFiles.some(isIndexableArtifactFile)) {
            hasNestedArtifacts = true;
            break;
          }
        } catch (e) {
          // skip unreadable child dirs
          continue;
        }
      }
    }

    if (!hasStateMd && !hasMdFiles && !hasNestedArtifacts) continue;

    if (CORE_SECTIONS[name]) {
      core.push(name);
    } else {
      extended.push(name);
    }
  }

  const all = [...core, ...extended];

  function getMeta(name) {
    if (CORE_SECTIONS[name]) return { ...CORE_SECTIONS[name], type: 'core' };
    if (EXTENDED_SECTION_META[name]) return { ...EXTENDED_SECTION_META[name], type: 'extended' };
    // Unknown extension - generate label from name
    return {
      label: name.replace(/-/g, ' ').toUpperCase(),
      color: '#555555',
      type: 'extended',
    };
  }

  return { core, extended, all, getMeta };
}

/*
 * Phase 353 Plan 01 Task 6 (D-353-5): the job vocabulary a sub-room's F.8
 * birth card may declare `job_id` from.
 *
 * Lands HERE, not in room-map.cjs, for two reasons stated once: (1)
 * room-map.cjs already requires this file (section-registry.cjs), so a
 * reverse require would close a require cycle; (2) Plan 02 Task 1 extends
 * this SAME file with getSectionJob, so the section vocabulary and the job
 * vocabulary end up sharing one home. This file is required by walkers on
 * hot paths, so JOB_VOCABULARY is exposed through a memoized accessor (a
 * getter over a module-level cache) and is NEVER read at module load --
 * built lazily, once per process, the same idiom lib/core/surface-fence.cjs's
 * `_load` already uses for its own registry read.
 *
 * Authority sentence: this vocabulary is what a `job_id` MAY be. Plan 02's
 * canon (data/section-job-canon.json) is what a SECTION's job IS. Two
 * different facts, two different homes -- Plan 02 Task 1 asserts its own
 * canon header's `vocabulary_extension_jobs` equals VOCABULARY_EXTENSION_JOBS
 * below rather than re-declaring the four members.
 */

// OQ-353-1 (planner default, ratified 2026-09-17): the Jev probe found four
// core sections with no member of the 16 command-derived serves_jtbd values
// fitting their job ("model the business", "hold the numbers", "protect
// what is ours", "design the solution"). Rather than force a wrong job onto
// a folder's identity, or leave those four sections permanently undeclared,
// the closed vocabulary gains exactly these four members. Declared ONCE
// here in wave 1 because the birth card needs them before Plan 02's canon
// file exists; Plan 02 Task 1 ratifies them rather than re-declaring them.
const VOCABULARY_EXTENSION_JOBS = Object.freeze([
  'model-business',
  'model-finances',
  'protect-assets',
  'design-solution',
]);

let _jobVocabularyCache = null;

function _computeJobVocabulary() {
  const set = new Set(VOCABULARY_EXTENSION_JOBS);
  try {
    const registryPath = path.join(__dirname, '..', '..', 'data', 'command-registry.json');
    // eslint-disable-next-line global-require
    const registry = require(registryPath);
    const commands = (registry && Array.isArray(registry.commands)) ? registry.commands : [];
    for (const cmd of commands) {
      const list = Array.isArray(cmd.serves_jtbd) ? cmd.serves_jtbd : [];
      for (const job of list) {
        if (typeof job === 'string' && job.length > 0) set.add(job);
      }
    }
  } catch (_e) {
    // A missing or unparsable registry degrades to just the four extension
    // members and never throws: the fail-safe direction is "more sub-rooms
    // born undeclared", never "a wrong job written into a folder's identity".
  }
  return Object.freeze(Array.from(set).sort());
}

// isDeclaredJob(value): true only for an exact, case-sensitive member.
// 'custom' is deliberately NOT a member (it is the birth card's escape
// hatch, and its whole meaning is "leave job_id absent").
function isDeclaredJob(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (_jobVocabularyCache === null) _jobVocabularyCache = _computeJobVocabulary();
  return _jobVocabularyCache.indexOf(value) !== -1;
}

/*
 * Phase 353 Plan 02 Task 1 (OQ-353-1, R-353-C): the section JTBD canon is
 * the one home for "what job does this section exist to do" -- read from
 * data/section-job-canon.json ONCE at module load into a module-level
 * constant, never per call, because this file is required by walkers on
 * hot paths. The canon file, not this table, owns the fact; getSectionJob
 * is a read-only accessor over it. Do NOT copy job_id values into
 * CORE_SECTIONS or EXTENDED_SECTION_META (icm-architect invariant 8): the
 * registry tables above keep owning label and color, and
 * room-skeleton-scaffold.cjs's SECTION_METADATA keeps owning statement and
 * purpose.
 */
let _sectionJobCanon = null;
function _loadSectionJobCanon() {
  if (_sectionJobCanon !== null) return _sectionJobCanon;
  try {
    const canonPath = path.join(__dirname, '..', '..', 'data', 'section-job-canon.json');
    // eslint-disable-next-line global-require
    const canon = require(canonPath);
    _sectionJobCanon = (canon && canon.sections) ? canon.sections : {};
  } catch (_e) {
    // A missing or unparsable canon degrades to "every section undeclared",
    // never a throw: the doctor reports it as drift instead of the process
    // crashing on a hot require path.
    _sectionJobCanon = {};
  }
  return _sectionJobCanon;
}

/**
 * getSectionJob(slug): the section-canon row for a known slug, or an
 * honest 'undeclared' shape for an unknown one, so the doctor can report
 * "undeclared" rather than guess.
 * @param {string} slug
 * @returns {{ job_id: string|null, secondary_job_id: string|null, vocabulary_extension: boolean, source: string|null, probe_confidence: number|null, reason?: string }}
 */
function getSectionJob(slug) {
  const canon = _loadSectionJobCanon();
  const row = (typeof slug === 'string') ? canon[slug] : null;
  if (!row) {
    return {
      job_id: null,
      secondary_job_id: null,
      vocabulary_extension: false,
      source: null,
      probe_confidence: null,
      reason: 'undeclared',
    };
  }
  return {
    job_id: row.job_id,
    secondary_job_id: row.secondary_job_id !== undefined ? row.secondary_job_id : null,
    vocabulary_extension: row.vocabulary_extension === true,
    source: row.source || null,
    probe_confidence: (typeof row.probe_confidence === 'number') ? row.probe_confidence : null,
  };
}

module.exports = {
  CORE_SECTIONS,
  EXTENDED_SECTION_META,
  STRUCTURAL_DIRS,
  discoverSections,
  isIndexableArtifactFile,
  VOCABULARY_EXTENSION_JOBS,
  isDeclaredJob,
  getSectionJob,
};

Object.defineProperty(module.exports, 'JOB_VOCABULARY', {
  enumerable: true,
  get: function getJobVocabulary() {
    if (_jobVocabularyCache === null) _jobVocabularyCache = _computeJobVocabulary();
    return _jobVocabularyCache;
  },
});
