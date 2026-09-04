'use strict';
/*
 * Phase 119-02 -- Room skeleton scaffold generator.
 *
 * Fills a placeholder room (created by Plan 119-00's autoCreatePlaceholderRoom)
 * with the canonical 11-section ICM structure + STATE.md + MINTO.md + USER.md +
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

// Phase 275-02 (Task 2): the L2 per-section CONTEXT.md contract templates.
// Naming collision note: this per-section CONTEXT.md (ICM L2 contract) is
// unrelated to (i) the `.context/` identity directory in IDENTITY_DIRECTORIES,
// which holds per-session conversational state, and (ii) GSD's own
// `.planning/phases/*/NNN-CONTEXT.md` files. Three different things share
// the word "context"; naming all three here so a future reader does not
// conflate them.
const SECTION_CONTRACTS_DIR = path.join(TEMPLATES_DIR, 'section-contracts');

// Phase 275-02 (Task 3): the L3 references/ factory-layer template directory.
const REFERENCE_TEMPLATES_DIR = path.join(TEMPLATES_DIR, 'references');

// Explicit allowlist, NOT a directory glob (T-275-09): a glob would silently
// copy any stray file dropped into templates/room-skeleton/references/ into
// every room ever scaffolded, and would make room contents untestable
// against a fixed expectation. Frozen so a caller cannot mutate it at
// runtime and widen the copy surface.
const REFERENCE_DOCS = Object.freeze(['SECTION-SCHEMA.md', 'SUB-SCHEMAS.md']);

/**
 * The 11 ICM sections. Lookup table extracted from commands/new-project.md
 * Section Definitions. Single source of truth here; renames cascade.
 *
 * Phase 275 (D-01): grew SECTION_NAMES 8 -> 11 (opportunity-bank, funding, strategy).
 * See 275-CONTEXT.md. Phase 155-05 froze 8; Phase 179-04 moved EXPECTED_FAMILY_COUNT 8 -> 9;
 * the table is versioned, not immutable.
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
  'opportunity-bank',
  'funding',
  'strategy',
]);

const SECTION_METADATA = Object.freeze({
  'problem-definition':   { statement: 'This section holds the problem this venture is actually trying to solve, stated so a stranger can restate it.', purpose: 'Define the core problem this venture addresses.',         stage_relevance: ['Pre-Opportunity', 'Discovery'],   default_methodologies: ['explore-domains', 'beautiful-question', 'diagnose'] },
  'market-analysis':      { statement: 'This section holds who has this problem, how many of them there are, and what they do about it today.', purpose: 'Map market size, trends, and customer segments.',         stage_relevance: ['Discovery', 'Validation'],        default_methodologies: ['analyze-needs', 'user-needs'] },
  'solution-design':      { statement: 'This section holds the solution and the technical choices behind it, and why each choice was made.', purpose: 'Design the solution, technology, and architecture.',      stage_relevance: ['Validation', 'Design'],           default_methodologies: ['bono', 'structure-argument', 'think-hats'] },
  'business-model':       { statement: 'This section holds how this venture makes money, and the value proposition that claim rests on.', purpose: 'Define revenue model, unit economics, go-to-market.',     stage_relevance: ['Design', 'Investment'],           default_methodologies: ['lean-canvas', 'validate-proposition', 'structure-argument'] },
  'competitive-analysis': { statement: 'This section holds who else is solving this, and what would still be true if a competitor copied us.', purpose: 'Analyze competition, positioning, differentiation.',      stage_relevance: ['Discovery', 'Design'],            default_methodologies: ['compare-ventures', 'challenge-assumptions'] },
  'team-execution':       { statement: 'This section holds who does the work, who advises it, and what happens next.', purpose: 'Document team, advisors, and execution plan.',            stage_relevance: ['Validation', 'Design'],           default_methodologies: ['leadership', 'think-hats'] },
  'legal-ip':             { statement: 'This section holds the legal structure, the agreements, and what is actually protected.', purpose: 'Track legal structure, agreements, IP protection.',       stage_relevance: ['Design', 'Investment'],           default_methodologies: ['structure-argument', 'challenge-assumptions'] },
  'financial-model':      { statement: 'This section holds the numbers, the assumptions under them, and what breaks them.', purpose: 'Build financial projections and metrics.',                stage_relevance: ['Design', 'Investment'],           default_methodologies: ['build-thesis', 'grade'] },
  'opportunity-bank':     { statement: 'This section banks the opportunities found but not yet chosen, each with its Knight position and confidence.', purpose: 'Bank the opportunities discovered before any one is chosen.', stage_relevance: ['Pre-Opportunity', 'Discovery'], default_methodologies: ['trending-to-absurd', 'whitespace', 'futures'] },
  'funding':              { statement: 'This section tracks funding paths, dilutive and non-dilutive, from discovery through submission to outcome.', purpose: 'Track funding paths, dilutive and non-dilutive, from discovery to submission.', stage_relevance: ['Validation', 'Investment'], default_methodologies: ['mullins', 'grade'] },
  'strategy':             { statement: 'This section holds where this venture could go and what is holding it back: the scenarios and the reverse salients.', purpose: 'Work the futures and the bottlenecks: where this venture could go and what is holding it back.', stage_relevance: ['Discovery', 'Design'], default_methodologies: ['scenario-plan', 'find-bottlenecks'] },
});

/**
 * Non-ICM directories that still need ROOM.md per Canon decision 15.
 */
const IDENTITY_DIRECTORIES = Object.freeze({
  'team':         { directory_type: 'team',          purpose: 'The people layer of the Data Room. Members, mentors, advisors -- created on demand from meetings or user input.' },
  'references':   { directory_type: 'references',    purpose: 'ICM Layer 3, the factory layer: stable reference material that does not change per run. Holds the venture_stage axis schema, the section and family methodology schemas, and the per-section nested sub-schemas. Read every run, edited rarely, never a destination for work product.' },
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
// ---------------------------------------------------------------------------
// Blueprint-family registry loader (Phase 155-05).
//
// Loads data/room-blueprints.json once, lazily. Returns null on any I/O or
// parse error so callers can fall back to the frozen SECTION_NAMES table.
//
// T-155-05-01 mitigation: blueprintFamily is validated against the known
// family set via Object.prototype.hasOwnProperty before use as a JSON key.
// This prevents prototype-pollution attacks where a caller supplies a string
// like '__proto__' or 'constructor' as the family name.
// ---------------------------------------------------------------------------
let _blueprintsCache = null; // null = not yet loaded; false = load failed
function loadBlueprints() {
  if (_blueprintsCache !== null) return _blueprintsCache || null;
  try {
    const blueprintsPath = path.resolve(__dirname, '..', '..', 'data', 'room-blueprints.json');
    const raw = fs.readFileSync(blueprintsPath, 'utf8');
    _blueprintsCache = JSON.parse(raw);
  } catch (_e) {
    _blueprintsCache = false; // mark as permanently failed so we do not retry
  }
  return _blueprintsCache || null;
}

// Resolve the section list and default_methodologies for the given blueprintFamily.
// Returns { sectionList, defaultMethodologies } where sectionList is the array
// to use for ICM section directory creation, and defaultMethodologies is the
// array for ROOM.md default_methodologies frontmatter.
//
// Rules:
//   - If blueprintFamily is a non-empty string and matches a known family in the
//     blueprints JSON, use that family's sections + default_methodologies.
//   - If the family string is provided but NOT found, log a warning and fall
//     back to SECTION_NAMES + empty methodologies.
//   - If blueprintFamily is absent/falsy, use SECTION_NAMES (no change from
//     pre-Phase-155-05 behavior -- zero behavior change for existing callers).
//
// T-155-05-01: uses hasOwnProperty guard so the family name cannot inject a
// prototype property as a lookup key.
function resolveBlueprint(blueprintFamily) {
  const defaultResult = {
    sectionList: SECTION_NAMES,
    defaultMethodologies: [],
    familyActive: false,
  };

  if (!blueprintFamily || typeof blueprintFamily !== 'string') {
    return defaultResult;
  }

  const blueprints = loadBlueprints();
  if (!blueprints) {
    process.stderr.write(
      '[room-skeleton] blueprints JSON unavailable; falling back to frozen SECTION_NAMES\n'
    );
    return defaultResult;
  }

  // T-155-05-01: prototype-pollution guard.
  if (!Object.prototype.hasOwnProperty.call(blueprints, blueprintFamily)) {
    process.stderr.write(
      '[room-skeleton] unknown blueprintFamily "' + blueprintFamily +
        '"; falling back to frozen SECTION_NAMES\n'
    );
    return defaultResult;
  }

  const family = blueprints[blueprintFamily];
  if (!family || !Array.isArray(family.sections) || family.sections.length === 0) {
    process.stderr.write(
      '[room-skeleton] blueprintFamily "' + blueprintFamily +
        '" has no valid sections; falling back to frozen SECTION_NAMES\n'
    );
    return defaultResult;
  }

  // Filter out any section slugs that are NOT in the SECTION_NAMES frozen table
  // (e.g. "assumptions" is not a scaffold section; skip it silently).
  // Phase 275 (D-01): opportunity-bank joined SECTION_NAMES, so this filter no
  // longer drops it. The filter logic itself is unchanged; only the table grew.
  // Only create directories for sections the scaffold knows how to handle.
  const frozenSet = new Set(SECTION_NAMES);
  const validSections = family.sections.filter((s) => frozenSet.has(s));

  if (validSections.length === 0) {
    process.stderr.write(
      '[room-skeleton] blueprintFamily "' + blueprintFamily +
        '" has no scaffold-creatable sections; falling back to frozen SECTION_NAMES\n'
    );
    return defaultResult;
  }

  return {
    sectionList: validSections,
    defaultMethodologies: Array.isArray(family.default_methodologies)
      ? family.default_methodologies
      : [],
    familyActive: true,
  };
}

/**
 * writeSectionContracts(roomDir, sectionList, result) -- the L2 contract writer.
 *
 * For each slug in sectionList, writes <roomDir>/<slug>/CONTEXT.md from the
 * static template at SECTION_CONTRACTS_DIR/<slug>.md, verbatim, with NO
 * renderTemplate substitution pass (T-275-13: contracts are static
 * human-readable prose, not parameterised templates; running substitution
 * over them would let a stray '{{' in prose corrupt a room file).
 *
 * Contract-file naming convention (fixed here; plans 275-05 and 275-06
 * author against it): one file per section slug, named <slug>.md, living in
 * templates/room-skeleton/section-contracts/, copied verbatim to
 * <room>/<slug>/CONTEXT.md, with NO YAML frontmatter (frontmatter would
 * route it to the artifact-default schema; this is prose), and with the
 * section headings in this fixed order: an H1 naming the section and its
 * job, a **Statement:** line repeating the L1 sentence verbatim, a
 * "One job:" line, then ## Inputs, ## Process, ## Outputs, ## Human check,
 * ## Commands that write here.
 *
 * Never throws. A missing template pushes a named warning and continues
 * (the templates land in a later wave, 275-05/275-06); a write failure on an
 * EXISTING template is a real error (unlike a missing template).
 *
 * Idempotent: skips silently if <slug>/CONTEXT.md already exists (Canon
 * Part 9, never overwrite human-authored content) -- the same
 * existence-check-before-write invariant this file already applies at every
 * other write site.
 *
 * Exported so plan 275-08's migration script reuses this exact write rather
 * than re-implementing it.
 *
 * @param {string} roomDir
 * @param {string[]} sectionList  the same list the ICM section loop used, so
 *                                a blueprint-family room gets contracts for
 *                                exactly the sections it actually has
 *                                (T-275-10: slugs come only from a frozen or
 *                                filtered list, never a caller-supplied
 *                                arbitrary string)
 * @param {object} result         the scaffoldRoomSkeleton result object;
 *                                mutated in place
 */
function writeSectionContracts(roomDir, sectionList, result) {
  for (const slug of sectionList) {
    const targetPath = path.join(roomDir, slug, 'CONTEXT.md');
    if (fs.existsSync(targetPath)) continue; // Canon Part 9: never overwrite

    const sourcePath = path.join(SECTION_CONTRACTS_DIR, slug + '.md');
    if (!fs.existsSync(sourcePath)) {
      result.warnings.push('contract_template_missing:' + slug);
      continue;
    }

    let contractContent;
    try {
      contractContent = fs.readFileSync(sourcePath, 'utf8');
    } catch (_e) {
      result.errors.push('contract_write_failed:' + slug);
      continue;
    }

    if (atomicWrite(targetPath, contractContent)) {
      result.contracts_created.push(slug);
    } else {
      result.errors.push('contract_write_failed:' + slug);
    }
  }
}

/**
 * writeReferenceDocs(roomDir, result) -- the L3 reference-document writer.
 *
 * For each name in the frozen REFERENCE_DOCS allowlist, writes
 * <roomDir>/references/<name> from REFERENCE_TEMPLATES_DIR/<name>, verbatim,
 * with NO renderTemplate substitution pass (T-275-11: these are static
 * documents whose prose may legitimately contain brace characters, and the
 * lack of a substitution pass is the mechanical enforcement that no
 * room-specific value -- the room's own directory name, or its current
 * venture_stage VALUE -- can be interpolated in. Canon Part 8 and the
 * 2026-09-02 SEED-084 ruling: the venture_stage axis SCHEMA belongs at L3;
 * the room's own stage VALUE stays at L0 in STATE.md. Do NOT "helpfully"
 * interpolate the room's own stage into this factory layer).
 *
 * Never throws. A missing template pushes a named warning and continues
 * (275-07 authors these documents in a later wave); a write failure on an
 * EXISTING template is a real error.
 *
 * `atomicWrite` already mkdirSync's the parent recursively, so `references/`
 * itself is created by the first successful write here; no separate mkdir.
 *
 * Idempotent: skips silently if the target already exists (Canon Part 9).
 *
 * Exported so plan 275-08's migration script reuses this exact write.
 *
 * @param {string} roomDir
 * @param {object} result  the scaffoldRoomSkeleton result object; mutated
 */
function writeReferenceDocs(roomDir, result) {
  for (const name of REFERENCE_DOCS) {
    const targetPath = path.join(roomDir, 'references', name);
    if (fs.existsSync(targetPath)) continue; // Canon Part 9: never overwrite

    const sourcePath = path.join(REFERENCE_TEMPLATES_DIR, name);
    if (!fs.existsSync(sourcePath)) {
      result.warnings.push('reference_doc_missing:' + name);
      continue;
    }

    let docContent;
    try {
      docContent = fs.readFileSync(sourcePath, 'utf8');
    } catch (_e) {
      result.errors.push('reference_doc_write_failed:' + name);
      continue;
    }

    if (atomicWrite(targetPath, docContent)) {
      result.reference_docs_created.push(name);
    } else {
      result.errors.push('reference_doc_write_failed:' + name);
    }
  }
}

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
    blueprint_family: options.blueprintFamily || null,
    errors: [],
    // Phase 275-02 (Task 1): warnings is a separate, named channel from
    // errors, introduced here because Task 1's STATEMENT fallback already
    // needs somewhere to record a missing meta.statement. Task 2 grows this
    // channel further (contract_template_missing, contract_write_failed);
    // warnings never affect result.ok (still errors.length === 0).
    warnings: [],
    // Phase 275-02 (Task 2): slugs whose L2 CONTEXT.md contract was written
    // this run (existing files are skipped silently per Canon Part 9, and do
    // NOT appear here -- only a fresh write is recorded).
    contracts_created: [],
    // Phase 275-02 (Task 3): names of L3 references/ documents written this
    // run (same skip-if-exists / warn-if-missing discipline as contracts).
    reference_docs_created: [],
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

  // Phase 155-05: resolve section list and default_methodologies from blueprintFamily.
  // Falls back gracefully to SECTION_NAMES when family is absent or unknown.
  const { sectionList, defaultMethodologies, familyActive } = resolveBlueprint(
    options.blueprintFamily
  );

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

  // ICM sections with per-section ROOM.md.
  // Phase 155-05: uses sectionList (from blueprintFamily or frozen SECTION_NAMES).
  // FROZEN TABLE CONTRACT: SECTION_NAMES + SECTION_METADATA are never modified
  // SILENTLY or by a drive-by edit. A deliberate, versioned, phase-cited
  // extension is the established move -- Phase 179-04 (EXPECTED_FAMILY_COUNT
  // 8 -> 9) and Phase 275 (SECTION_NAMES 8 -> 11) are the two precedents.
  // sectionList is either SECTION_NAMES itself (no-family / unknown-family path)
  // or a validated subset of SECTION_NAMES from the blueprint family. Zero
  // behavior change for callers that do not pass blueprintFamily.
  const sectionTpl = readTemplate('ROOM.md.section.tmpl');
  if (sectionTpl) {
    for (const section of sectionList) {
      const sectionDir = path.join(roomDir, section);
      const sectionRoomMd = path.join(sectionDir, 'ROOM.md');
      if (!fs.existsSync(sectionRoomMd)) {
        const meta = SECTION_METADATA[section];
        const titleCase = section.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        // Phase 155-05: when a blueprintFamily is active, use the family's
        // default_methodologies for the ROOM.md frontmatter instead of the
        // per-section static table in SECTION_METADATA. This populates
        // ROOM.md default_methodologies from the chosen chain (BIRTH-FLOW-BRIEF
        // Section 2 state-seeding step 6). When no family is active, the
        // per-section static table from SECTION_METADATA is used (unchanged).
        const methodologiesList = familyActive && defaultMethodologies.length > 0
          ? defaultMethodologies.map(m => '  - ' + m).join('\n')
          : meta.default_methodologies.map(m => '  - ' + m).join('\n');

        // Phase 275-02 (D-10): statement is ICM L1, rendered in frontmatter
        // AND in the body blockquote. Guard for a missing value the way this
        // file guards elsewhere: fall back to meta.purpose rather than
        // rendering the literal token {{STATEMENT}} into a room file (a
        // visible-defect class this repo has paid for before), and push a
        // named warning so a silent empty string never ships unnoticed.
        if (!meta.statement) {
          result.warnings.push('statement_missing:' + section);
        }
        const sectionSubs = {
          STATEMENT: meta.statement || meta.purpose,
          SECTION_NAME: section,
          SECTION_NAME_TITLE_CASE: titleCase,
          SECTION_PURPOSE: meta.purpose,
          STAGE_RELEVANCE_LIST: meta.stage_relevance.map(s => '  - ' + s).join('\n'),
          DEFAULT_METHODOLOGIES_LIST: methodologiesList,
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

  // Phase 275-02 (Task 2): L2 per-section CONTEXT.md contracts. Runs
  // immediately after the ICM section loop, on the same sectionList, so a
  // blueprint-family room gets contracts for exactly the sections it
  // actually has.
  writeSectionContracts(roomDir, sectionList, result);

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

  // Phase 275-02 (Task 3): L3 references/ factory documents. Runs after the
  // identity-directory loop so references/ROOM.md already exists when the
  // schema documents land beside it.
  writeReferenceDocs(roomDir, result);

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
  writeSectionContracts: writeSectionContracts,
  writeReferenceDocs: writeReferenceDocs,
  REFERENCE_DOCS: REFERENCE_DOCS,
  renderTemplate: renderTemplate,
  isStateAuthored: isStateAuthored,
};
