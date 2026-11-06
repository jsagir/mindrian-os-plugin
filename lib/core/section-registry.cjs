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
 * Plan 386-44 (B17): a section name is a folder name, never a path. A name with a
 * backslash, a slash or a drive prefix (C:) comes from a Windows path string read as a
 * relative name on POSIX. Such a folder is never a section.
 * @param {string} name
 * @returns {boolean}
 */
function isPathLikeSectionName(name) {
  return typeof name === 'string' && (/[\\/\0]/.test(name) || /^[A-Za-z]:/.test(name));
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

    // Plan 386-44 (B17): a path-like folder name is not a section.
    if (isPathLikeSectionName(name)) continue;

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

/*
 * Quick 261028-gmg: room-level section-job declarations.
 *
 * Authority: the shipped canon is the only source for standard sections. A
 * room may declare jobs only for its own custom sections, in
 * <roomDir>/.mindrian/section-jobs.json, with a job id from the closed
 * vocabulary (isDeclaredJob), ratified by the navigator. A canon row always
 * wins. The file is read fresh on every call (the room-constraints.cjs
 * precedent), with Node built-ins only, and nothing here writes it.
 */
const ROOM_SECTION_JOBS_REL = '.mindrian/section-jobs.json';
const ROOM_SECTION_JOBS_SCHEMA = 'mos.room-section-jobs/1';
const ROOM_SECTION_JOBS_VALUE_CAP = 64;
const ROOM_SECTION_JOBS_MAX_BYTES = 262144;
const ROOM_SLUG_MAX_LENGTH = 128;
const ROOM_RATIFIED_BY_MAX_LENGTH = 64;

function _isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function _cut(value) {
  if (typeof value !== 'string') return null;
  return value.length > ROOM_SECTION_JOBS_VALUE_CAP ? value.slice(0, ROOM_SECTION_JOBS_VALUE_CAP) : value;
}

function _isValidRoomSlug(slug) {
  if (typeof slug !== 'string' || slug.length === 0) return false;
  if (slug.length > ROOM_SLUG_MAX_LENGTH) return false;
  if (slug.indexOf('/') !== -1 || slug.indexOf('\\') !== -1 || slug.indexOf('\0') !== -1) return false;
  if (slug.charAt(0) === '.') return false;
  if (slug === 'prototype') return false;
  // The canon lookup finds inherited properties (canon['toString'] is a
  // function), so every Object.prototype name is rejected visibly here.
  if (slug in Object.prototype) return false;
  return true;
}

function _sortRejected(list) {
  return list.sort((a, b) => {
    if (a.slug === null && b.slug !== null) return -1;
    if (a.slug !== null && b.slug === null) return 1;
    if (a.slug === b.slug) return 0;
    return a.slug < b.slug ? -1 : 1;
  });
}

/**
 * readRoomSectionJobs(roomDir): read and validate the room's section-job
 * declaration file. Never throws. Reads fresh on every call.
 * @param {string} roomDir
 * @returns {{ present: boolean, path: string|null, declarations: object, rejected: Array<{slug: string|null, job_id: string|null, reason: string}> }}
 */
function readRoomSectionJobs(roomDir) {
  const result = { present: false, path: null, declarations: Object.create(null), rejected: [] };
  if (typeof roomDir !== 'string' || roomDir.length === 0) return result;
  try {
    const dirPath = path.join(roomDir, '.mindrian');
    const filePath = path.join(roomDir, ROOM_SECTION_JOBS_REL);
    const fileLevel = (reason) => {
      result.present = true;
      result.path = filePath;
      result.rejected.push({ slug: null, job_id: null, reason: reason });
      return result;
    };

    // lstat, never stat or exists: both follow symlinks, so a link to a file
    // outside the room would be read.
    let dirStat;
    try {
      dirStat = fs.lstatSync(dirPath);
    } catch (e) {
      if (e && e.code === 'ENOENT') return result;
      return fileLevel('file_unreadable');
    }
    if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) return fileLevel('file_symlink');

    let fileStat;
    try {
      fileStat = fs.lstatSync(filePath);
    } catch (e) {
      if (e && e.code === 'ENOENT') return result;
      return fileLevel('file_unreadable');
    }
    if (fileStat.isSymbolicLink() || !fileStat.isFile()) return fileLevel('file_symlink');
    if (fileStat.size > ROOM_SECTION_JOBS_MAX_BYTES) return fileLevel('file_too_large');

    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_e) {
      return fileLevel('file_unreadable');
    }
    if (!_isPlainObject(parsed) || parsed.schema !== ROOM_SECTION_JOBS_SCHEMA || !_isPlainObject(parsed.sections)) {
      return fileLevel('file_malformed');
    }

    result.present = true;
    result.path = filePath;
    const canon = _loadSectionJobCanon();
    for (const slug of Object.keys(parsed.sections)) {
      const entry = parsed.sections[slug];
      const reject = (reason) => {
        result.rejected.push({
          slug: _cut(slug),
          job_id: _isPlainObject(entry) ? _cut(entry.job_id) : null,
          reason: reason,
        });
      };
      if (!_isValidRoomSlug(slug)) { reject('invalid_slug'); continue; }
      if (!_isPlainObject(entry)) { reject('malformed_entry'); continue; }
      if (Object.prototype.hasOwnProperty.call(canon, slug)) { reject('canon_section'); continue; }
      if (!isDeclaredJob(entry.job_id)) { reject('unknown_job_id'); continue; }
      const sec = entry.secondary_job_id;
      if (sec !== undefined && sec !== null && (!isDeclaredJob(sec) || sec === entry.job_id)) {
        reject('invalid_secondary_job_id');
        continue;
      }
      if (typeof entry.ratified_by !== 'string' || entry.ratified_by.length === 0
        || entry.ratified_by.length > ROOM_RATIFIED_BY_MAX_LENGTH
        || typeof entry.ratified_at !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(entry.ratified_at)) {
        reject('unratified');
        continue;
      }
      result.declarations[slug] = {
        job_id: entry.job_id,
        secondary_job_id: (sec === undefined) ? null : sec,
        vocabulary_extension: VOCABULARY_EXTENSION_JOBS.indexOf(entry.job_id) !== -1,
        source: 'room-declaration',
        probe_confidence: null,
        ratified_by: entry.ratified_by,
        ratified_at: entry.ratified_at,
      };
    }
    _sortRejected(result.rejected);
    return result;
  } catch (_e) {
    return { present: false, path: null, declarations: Object.create(null), rejected: [] };
  }
}

/**
 * getSectionJob(slug, roomDir): the section-canon row for a known slug, else
 * the room's ratified declaration for a custom slug (when roomDir is given),
 * else an honest 'undeclared' shape, so the doctor can report "undeclared"
 * rather than guess. A canon row always wins; with no roomDir the result is
 * exactly what the canon alone gives.
 * @param {string} slug
 * @param {string} [roomDir]
 * @returns {{ job_id: string|null, secondary_job_id: string|null, vocabulary_extension: boolean, source: string|null, probe_confidence: number|null, reason?: string, ratified_by?: string, ratified_at?: string }}
 */
function getSectionJob(slug, roomDir) {
  const canon = _loadSectionJobCanon();
  const row = (typeof slug === 'string') ? canon[slug] : null;
  if (!row) {
    if (typeof roomDir === 'string' && roomDir.length > 0 && typeof slug === 'string') {
      const declared = readRoomSectionJobs(roomDir).declarations;
      if (Object.prototype.hasOwnProperty.call(declared, slug)) {
        return Object.assign({}, declared[slug]);
      }
    }
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
  isPathLikeSectionName,
  isIndexableArtifactFile,
  VOCABULARY_EXTENSION_JOBS,
  isDeclaredJob,
  getSectionJob,
  readRoomSectionJobs,
  ROOM_SECTION_JOBS_REL,
  ROOM_SECTION_JOBS_SCHEMA,
  ROOM_SECTION_JOBS_VALUE_CAP,
};

Object.defineProperty(module.exports, 'JOB_VOCABULARY', {
  enumerable: true,
  get: function getJobVocabulary() {
    if (_jobVocabularyCache === null) _jobVocabularyCache = _computeJobVocabulary();
    return _jobVocabularyCache;
  },
});
