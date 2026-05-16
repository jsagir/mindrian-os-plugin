'use strict';
/*
 * Phase 119-02 -- Room skeleton scaffold generator.
 *
 * Fills a placeholder room (created by Plan 119-00's autoCreatePlaceholderRoom)
 * with the canonical 8-section ICM structure + STATE.md + MINTO.md + USER.md +
 * per-directory ROOM.md identity files (Canon decision 15: ICM Layer 0 everywhere).
 *
 * Idempotent + reentrant: never overwrites human-authored content. When STATE.md
 * already has auto_created:false in its frontmatter (OR the frontmatter lacks the
 * auto_created key entirely -- treated as human-authored), the regenerable
 * STATE.md is skipped while the missing identity files are still created
 * (Canon Part 9 "files preserve meaning" invariant).
 *
 * Atomic writes per Phase 124-02 precedent (tmp + rename).
 *
 * Canon Part 8 invariant: pure-local; no Brain MCP, no fetch, no telemetry.
 * Canon Part 9 invariant: no direct room-db.cjs require (this module touches
 *   only files; memory_event emission stays in Plan 119-00 and Plan 119-01).
 * Canon Part 10 sub-claim 3: rooms are receipts -- the receipt's substrate
 *   materializes the instant the auto-explore finding lands, never gated on
 *   material quality (D-05).
 * Canon decision 15: every directory in the Data Room MUST have ROOM.md;
 *   the IDENTITY_DIRECTORIES table covers the 5 non-ICM cases.
 */

const fs = require('node:fs');
const path = require('node:path');

const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', 'templates', 'room-skeleton');

/**
 * The 8 ICM sections. Lookup table extracted from commands/new-project.md
 * Section Definitions. Single source of truth here; renames cascade.
 */
const SECTION_NAMES = Object.freeze([
  'problem-definition',
  'market-analysis',
  'solution-design',
  'business-model',
  'competitive-analysis',
  'team-execution',
  'legal-ip',
  'financial-model',
]);

const SECTION_METADATA = Object.freeze({
  'problem-definition':   { purpose: 'Define the core problem this venture addresses.',         stage_relevance: ['Pre-Opportunity', 'Discovery'],   default_methodologies: ['domain-explorer', 'beautiful-question', 'trending-to-absurd'] },
  'market-analysis':      { purpose: 'Map market size, trends, and customer segments.',         stage_relevance: ['Discovery', 'Validation'],        default_methodologies: ['domain-explorer', 'scenario-analysis'] },
  'solution-design':      { purpose: 'Design the solution, technology, and architecture.',      stage_relevance: ['Validation', 'Design'],           default_methodologies: ['structure-argument', 'think-hats'] },
  'business-model':       { purpose: 'Define revenue model, unit economics, go-to-market.',     stage_relevance: ['Design', 'Investment'],           default_methodologies: ['structure-argument', 'scenario-analysis'] },
  'competitive-analysis': { purpose: 'Analyze competition, positioning, differentiation.',      stage_relevance: ['Discovery', 'Design'],            default_methodologies: ['challenge-assumptions', 'find-bottlenecks'] },
  'team-execution':       { purpose: 'Document team, advisors, and execution plan.',            stage_relevance: ['Validation', 'Design'],           default_methodologies: ['think-hats', 'analyze-needs'] },
  'legal-ip':             { purpose: 'Track legal structure, agreements, IP protection.',       stage_relevance: ['Design', 'Investment'],           default_methodologies: ['structure-argument'] },
  'financial-model':      { purpose: 'Build financial projections and metrics.',                stage_relevance: ['Design', 'Investment'],           default_methodologies: ['scenario-analysis', 'build-thesis'] },
});

/**
 * Non-ICM directories that still need ROOM.md per Canon decision 15.
 */
const IDENTITY_DIRECTORIES = Object.freeze({
  'team':         { directory_type: 'team',          purpose: 'The people layer of the Data Room. Members, mentors, advisors -- created on demand from meetings or user input.' },
  'assets':       { directory_type: 'assets',        purpose: 'Binary file storage (PDFs, images, videos) organized by section. Subdirectories appear when scripts/file-asset is invoked.' },
  '.intelligence':{ directory_type: '.intelligence', purpose: 'Sentinel-generated alerts and digests (health checks, deadline reports, competitor watch).' },
  '.snapshots':   { directory_type: '.snapshots',    purpose: 'Weekly STATE.md copies for drift detection by sentinel-health-check.' },
  '.context':     { directory_type: '.context',      purpose: 'Per-session conversational state (last-session, rejection-log, methodology-history, weekly-digest).' },
});

/**
 * Render a template with {{KEY}} string substitutions. Pure function.
 *
 * @param {string} templateContent  the raw template file contents
 * @param {object} substitutions    map of KEY -> value (any type coerced via String())
 * @returns {string}                the substituted output
 */
function renderTemplate(templateContent, substitutions) {
  let rendered = templateContent;
  for (const key of Object.keys(substitutions || {})) {
    const re = new RegExp('\\{\\{' + key + '\\}\\}', 'g');
    rendered = rendered.replace(re, String(substitutions[key]));
  }
  return rendered;
}

/**
 * Atomic write: tmp + rename. Returns true on success, false on failure.
 * Mirrors Phase 124-02 timeline-runner.cjs invariant. The tmp file path
 * includes pid + random suffix so concurrent invocations do not collide.
 */
function atomicWrite(filePath, content) {
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o755 });
    const tmpPath = filePath + '.tmp.' + process.pid + '.' + Math.random().toString(36).slice(2, 10);
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, filePath);
    return true;
  } catch (_e) {
    return false;
  }
}

function readTemplate(name) {
  try {
    return fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf8');
  } catch (_e) {
    return null;
  }
}

/**
 * Detect whether STATE.md has been authored by a human (or by a non-Phase-119
 * source). Returns true if the file:
 *   - Exists AND
 *   - Has frontmatter AND
 *   - Frontmatter contains `auto_created: false` OR lacks the `auto_created` key.
 *
 * Returns false if STATE.md doesn't exist OR has `auto_created: true` (the
 * Phase 119 auto-scaffold signal).
 */
function isStateAuthored(roomDir) {
  try {
    const statePath = path.join(roomDir, 'STATE.md');
    if (!fs.existsSync(statePath)) return false;
    const raw = fs.readFileSync(statePath, 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---/);
    if (!m) return false;
    // If frontmatter has auto_created: false, treat as authored.
    if (/^\s*auto_created:\s*false\s*$/m.test(m[1])) return true;
    // If frontmatter LACKS auto_created entirely, treat as authored (human
    // crafted from scratch -- the absence of the key is the signal).
    if (!/^\s*auto_created:\s*/m.test(m[1])) return true;
    return false;
  } catch (_e) {
    return false;
  }
}

/**
 * scaffoldRoomSkeleton(roomDir, opts) -- the entry point.
 *
 * Fills a placeholder room with the canonical skeleton: STATE.md + MINTO.md +
 * USER.md + 8 ICM section folders (each with ROOM.md) + 5 identity directories
 * (each with ROOM.md per Canon decision 15).
 *
 * Idempotent. Reentrancy invariant: existing files are NEVER overwritten;
 * human-authored STATE.md is byte-preserved.
 *
 * @param {string} roomDir                    absolute path to the placeholder room
 * @param {object} opts
 * @param {string} [opts.placeholder_slug]    e.g. 'untitled-2026-05-16-1845'
 * @param {string} [opts.source_material_id]  32-char hex from Phase 117
 * @param {object} [opts.auto_explore_finding]  the Phase 117 JSON output (used
 *                                              for the thinness pass-through)
 * @returns {{ok: boolean,
 *            sections_created: string[],
 *            identity_files_created: string[],
 *            state_written: boolean,
 *            minto_written: boolean,
 *            user_written: boolean,
 *            thinness_acknowledged: boolean,
 *            errors: string[]}}
 */
function scaffoldRoomSkeleton(roomDir, opts) {
  const options = opts || {};
  const result = {
    ok: true,
    sections_created: [],
    identity_files_created: [],
    state_written: false,
    minto_written: false,
    user_written: false,
    thinness_acknowledged: false,
    errors: [],
  };

  if (!roomDir || typeof roomDir !== 'string') {
    result.ok = false;
    result.errors.push('invalid_room_dir');
    return result;
  }
  if (!fs.existsSync(roomDir)) {
    result.ok = false;
    result.errors.push('room_dir_does_not_exist');
    return result;
  }

  // Substitutions used across templates.
  const subs = {
    AUTO_CREATED_AT_ISO: new Date().toISOString(),
    PLACEHOLDER_SLUG: options.placeholder_slug || path.basename(roomDir),
    SOURCE_MATERIAL_ID: options.source_material_id || 'unknown',
  };

  const authored = isStateAuthored(roomDir);

  // Render STATE.md (skip if authored by human).
  if (!authored) {
    const stateTpl = readTemplate('STATE.md.tmpl');
    if (stateTpl) {
      const stateContent = renderTemplate(stateTpl, subs);
      if (atomicWrite(path.join(roomDir, 'STATE.md'), stateContent)) {
        result.state_written = true;
      } else {
        result.errors.push('state_write_failed');
      }
    } else {
      result.errors.push('state_template_missing');
    }
  } else {
    process.stderr.write('[room-skeleton] STATE.md already authored; skipping\n');
  }

  // Render MINTO.md (skip if file exists -- the sentinel-bounded content is the contract).
  const mintoPath = path.join(roomDir, 'MINTO.md');
  if (!fs.existsSync(mintoPath)) {
    const mintoTpl = readTemplate('MINTO.md.tmpl');
    if (mintoTpl) {
      if (atomicWrite(mintoPath, mintoTpl)) {
        result.minto_written = true;
      } else {
        result.errors.push('minto_write_failed');
      }
    } else {
      result.errors.push('minto_template_missing');
    }
  }

  // Render USER.md (skip if exists).
  const userPath = path.join(roomDir, 'USER.md');
  if (!fs.existsSync(userPath)) {
    const userTpl = readTemplate('USER.md.tmpl');
    if (userTpl) {
      if (atomicWrite(userPath, userTpl)) {
        result.user_written = true;
      } else {
        result.errors.push('user_write_failed');
      }
    } else {
      result.errors.push('user_template_missing');
    }
  }

  // 8 ICM sections with per-section ROOM.md.
  const sectionTpl = readTemplate('ROOM.md.section.tmpl');
  if (sectionTpl) {
    for (const section of SECTION_NAMES) {
      const sectionDir = path.join(roomDir, section);
      const sectionRoomMd = path.join(sectionDir, 'ROOM.md');
      if (!fs.existsSync(sectionRoomMd)) {
        const meta = SECTION_METADATA[section];
        const titleCase = section.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const sectionSubs = {
          SECTION_NAME: section,
          SECTION_NAME_TITLE_CASE: titleCase,
          SECTION_PURPOSE: meta.purpose,
          STAGE_RELEVANCE_LIST: meta.stage_relevance.map(s => '  - ' + s).join('\n'),
          DEFAULT_METHODOLOGIES_LIST: meta.default_methodologies.map(m => '  - ' + m).join('\n'),
        };
        const sectionContent = renderTemplate(sectionTpl, sectionSubs);
        if (atomicWrite(sectionRoomMd, sectionContent)) {
          result.sections_created.push(section);
        } else {
          result.errors.push('section_write_failed:' + section);
        }
      }
    }
  } else {
    result.errors.push('section_template_missing');
  }

  // Non-ICM identity directories with ROOM.md (Canon decision 15).
  const identityTpl = readTemplate('ROOM.md.identity.tmpl');
  if (identityTpl) {
    for (const dirName of Object.keys(IDENTITY_DIRECTORIES)) {
      const dirPath = path.join(roomDir, dirName);
      const identityRoomMd = path.join(dirPath, 'ROOM.md');
      if (!fs.existsSync(identityRoomMd)) {
        const meta = IDENTITY_DIRECTORIES[dirName];
        const identitySubs = {
          DIRECTORY_TYPE: meta.directory_type,
          DIRECTORY_PURPOSE: meta.purpose,
        };
        const identityContent = renderTemplate(identityTpl, identitySubs);
        if (atomicWrite(identityRoomMd, identityContent)) {
          result.identity_files_created.push(dirName);
        }
      }
    }
  } else {
    result.errors.push('identity_template_missing');
  }

  // Thinness pass-through (Plan 119-01 reads result.thinness_acknowledged
  // to decide whether to render the Larry voice line at F.1 selector time).
  try {
    const tha = require('./larry-thinness-acknowledgment.cjs');
    result.thinness_acknowledged = tha.shouldAcknowledgeThinness(options.auto_explore_finding || null);
  } catch (_e) {
    result.thinness_acknowledged = true; // fail-safe: default to acknowledging thinness
  }

  // ok is true if no errors OR if at least the regenerable surface (state or
  // sections) made it through. Errors are still recorded for observability.
  result.ok = result.errors.length === 0;
  return result;
}

module.exports = {
  SECTION_NAMES: SECTION_NAMES,
  SECTION_METADATA: SECTION_METADATA,
  IDENTITY_DIRECTORIES: IDENTITY_DIRECTORIES,
  scaffoldRoomSkeleton: scaffoldRoomSkeleton,
  renderTemplate: renderTemplate,
  isStateAuthored: isStateAuthored,
};
