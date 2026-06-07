/**
 * MindrianOS Plugin -- Mullins Scaffold Loader (Phase 84-04)
 *
 * Loads the canonical Mullins 7-domain venture assessment scaffold from
 * skills/mullins-scaffold/scaffold.json and exposes a small read-only API for
 * callers that want to enumerate sections, fetch a single section, or test for
 * existence. The scaffold is a TEMPLATE, not a mandatory skeleton: rooms that
 * reference it gain structure, rooms that ignore it are structurally
 * unaffected. Materialization (writing sections into a room) is deferred to
 * v1.10.9; this module never touches disk and never mutates STATE.md.
 *
 * The scaffold JSON is loaded lazily and cached in module scope. Internal
 * failures (missing file, malformed JSON) degrade to safe fallbacks ([], null,
 * false) so early-hook callers cannot crash the plugin if the file is absent.
 *
 * Closes SCOPE-NB-01 and SCOPE-NB-02.
 *
 * Exports: loadScaffold, listSections, getSection, sectionExists,
 *          getDomainsForSection, listBrainFolders, getAckoffTraversal,
 *          buildBrainFolderQuery
 *
 * Phase 143.2-06 (MULL-01/02) adds three additive read-only accessors over the
 * scaffold's brain_folders[] and ackoff_traversal blocks. buildBrainFolderQuery
 * is the Part-8-clean query builder: its enum allow-list is the structural guard
 * that keeps user content out of any Brain query (Canon Part 8).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const SCAFFOLD_PATH = path.join(
  __dirname,
  '..',
  '..',
  'skills',
  'mullins-scaffold',
  'scaffold.json'
);

let cache = null;
let loadAttempted = false;

/**
 * Read and parse skills/mullins-scaffold/scaffold.json once and cache the
 * result in module scope. Subsequent calls return the cached value. On any
 * filesystem or JSON parse error, the cache is set to a safe empty document
 * and a debug line is written to stderr; callers always receive a usable
 * object shape.
 *
 * @returns {{version: number, generated_from: string, sections: Array<object>}}
 *   The parsed scaffold document, or an empty fallback document on error.
 */
function loadScaffold() {
  if (cache !== null) return cache;
  if (loadAttempted) return cache || { version: 0, generated_from: '', sections: [] };
  loadAttempted = true;
  try {
    const raw = fs.readFileSync(SCAFFOLD_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.sections)) {
      throw new Error('scaffold.json missing sections array');
    }
    cache = parsed;
    return cache;
  } catch (err) {
    if (process.env.MOS_DEBUG) {
      process.stderr.write(
        '[mullins-scaffold] loadScaffold failed: ' + (err && err.message) + '\n'
      );
    }
    cache = { version: 0, generated_from: '', sections: [] };
    return cache;
  }
}

/**
 * Return all scaffold sections as a shallow-cloned array. Callers may mutate
 * the returned array without affecting the module cache. Returns an empty
 * array if the scaffold could not be loaded.
 *
 * @returns {Array<{id: string, domain: string, title: string, prompt: string, required: boolean}>}
 */
function listSections() {
  try {
    const doc = loadScaffold();
    if (!doc || !Array.isArray(doc.sections)) return [];
    return doc.sections.map(function (s) {
      return Object.assign({}, s);
    });
  } catch (err) {
    if (process.env.MOS_DEBUG) {
      process.stderr.write(
        '[mullins-scaffold] listSections failed: ' + (err && err.message) + '\n'
      );
    }
    return [];
  }
}

/**
 * Return a single section by its kebab-case id, or null if no such section
 * exists. The returned object is a shallow clone so callers cannot mutate the
 * module cache.
 *
 * @param {string} id - The section id (e.g. 'market-size-now').
 * @returns {{id: string, domain: string, title: string, prompt: string, required: boolean}|null}
 */
function getSection(id) {
  try {
    if (typeof id !== 'string' || id.length === 0) return null;
    const doc = loadScaffold();
    if (!doc || !Array.isArray(doc.sections)) return null;
    const found = doc.sections.find(function (s) {
      return s && s.id === id;
    });
    return found ? Object.assign({}, found) : null;
  } catch (err) {
    if (process.env.MOS_DEBUG) {
      process.stderr.write(
        '[mullins-scaffold] getSection failed: ' + (err && err.message) + '\n'
      );
    }
    return null;
  }
}

/**
 * Test whether a section id exists in the scaffold.
 *
 * @param {string} id - The section id to test.
 * @returns {boolean} True if a section with this id exists, false otherwise.
 */
function sectionExists(id) {
  try {
    return getSection(id) !== null;
  } catch (err) {
    return false;
  }
}

/**
 * Return the Mullins domain string for a given section id, or null if the
 * section is unknown. Useful for routing logic that wants to group artifacts
 * by domain without re-parsing the scaffold.
 *
 * @param {string} id - The section id.
 * @returns {string|null} The domain slug (e.g. 'market-attractiveness') or null.
 */
function getDomainsForSection(id) {
  try {
    const section = getSection(id);
    return section && section.domain ? section.domain : null;
  } catch (err) {
    return null;
  }
}

/**
 * Return the additive cross-framework folder proposals (Phase 143.2-06, MULL-01)
 * as shallow-cloned objects. Each folder carries id, framework (the generic
 * source-framework handle), domain, title, prompt, feeds_into_source, and
 * offered:true (the Decision-Gate flag -- the folders are OFFERED, never
 * auto-imposed, per Canon Part 3). Returns an empty array if the scaffold could
 * not be loaded or carries no brain_folders block. Mirrors the listSections
 * degradation.
 *
 * @returns {Array<{id: string, framework: string, domain: string, title: string, prompt: string, feeds_into_source: string, offered: boolean}>}
 */
function listBrainFolders() {
  try {
    const doc = loadScaffold();
    if (!doc || !Array.isArray(doc.brain_folders)) return [];
    return doc.brain_folders.map(function (f) {
      return Object.assign({}, f);
    });
  } catch (err) {
    if (process.env.MOS_DEBUG) {
      process.stderr.write(
        '[mullins-scaffold] listBrainFolders failed: ' + (err && err.message) + '\n'
      );
    }
    return [];
  }
}

/**
 * Return the Ackoff bidirectional traversal (Phase 143.2-06, MULL-02) as a
 * shallow clone. The traversal carries ascent[] (DIKW rungs filling toward
 * Validation-at-center), descent[] (the validation loop re-testing each domain's
 * data), brain_chain (the chained framework handles), and validation_center.
 * Returns null if the scaffold could not be loaded or carries no traversal.
 *
 * @returns {{validation_center: string, brain_chain: Array<string>, ascent: Array<object>, descent: Array<object>}|null}
 */
function getAckoffTraversal() {
  try {
    const doc = loadScaffold();
    if (!doc || !doc.ackoff_traversal || typeof doc.ackoff_traversal !== 'object') {
      return null;
    }
    const t = doc.ackoff_traversal;
    const clone = Object.assign({}, t);
    if (Array.isArray(t.ascent)) clone.ascent = t.ascent.slice();
    if (Array.isArray(t.descent)) clone.descent = t.descent.slice();
    if (Array.isArray(t.brain_chain)) clone.brain_chain = t.brain_chain.slice();
    return clone;
  } catch (err) {
    if (process.env.MOS_DEBUG) {
      process.stderr.write(
        '[mullins-scaffold] getAckoffTraversal failed: ' + (err && err.message) + '\n'
      );
    }
    return null;
  }
}

/**
 * Build the Part-8-clean brain_framework_chain query payload (Phase 143.2-06,
 * MULL-01). The payload carries ONLY the generic framework handle 'Mullins Seven
 * Domains' plus a problem-type enum -- never artifact text, room slugs, meeting
 * content, identifiers, or numbers (Canon Part 8). The enum allow-list IS the
 * structural guard: any caller string that is not one of the four allowed enums
 * defaults to 'Ill-Defined', so an arbitrary user string can never reach the
 * query body.
 *
 * @param {string} problemTypeEnum - One of Un-Defined / Ill-Defined /
 *   Well-Defined / Wicked. Anything else defaults to 'Ill-Defined'.
 * @returns {{tool: string, question: string, handles: {current_frameworks: Array<string>, problem_type: string}}}
 */
function buildBrainFolderQuery(problemTypeEnum) {
  const ALLOWED = ['Un-Defined', 'Ill-Defined', 'Well-Defined', 'Wicked'];
  const pt = ALLOWED.indexOf(problemTypeEnum) >= 0 ? problemTypeEnum : 'Ill-Defined';
  const question =
    'recommend a framework for a ' +
    pt +
    ' venture that has already applied "Mullins Seven Domains"';
  return {
    tool: 'mcp__mindrian-brain__brain_ask',
    question: question,
    handles: {
      current_frameworks: ['Mullins Seven Domains'],
      problem_type: pt,
    },
  };
}

module.exports = {
  loadScaffold: loadScaffold,
  listSections: listSections,
  getSection: getSection,
  sectionExists: sectionExists,
  getDomainsForSection: getDomainsForSection,
  listBrainFolders: listBrainFolders,
  getAckoffTraversal: getAckoffTraversal,
  buildBrainFolderQuery: buildBrainFolderQuery,
};
