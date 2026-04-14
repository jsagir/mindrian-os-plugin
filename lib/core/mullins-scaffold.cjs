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
 *          getDomainsForSection
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

module.exports = {
  loadScaffold: loadScaffold,
  listSections: listSections,
  getSection: getSection,
  sectionExists: sectionExists,
  getDomainsForSection: getDomainsForSection,
};
