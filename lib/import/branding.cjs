'use strict';

/**
 * Phase 80 Plan 80-06 Task 1 (IMPORT-10) -- Branding injection.
 *
 * Applied by Stage 04 enricher AFTER wikilink injection. For every routed
 * artifact this module:
 *
 *   1. normalizeFrontmatter -- rewrites frontmatter to the De Stijl canonical
 *      shape (title, section, status, imported_from, imported_at, import_id,
 *      source_wikilinks, tags). Non-canonical source fields are preserved
 *      under _source_frontmatter so nothing is lost.
 *   2. promoteCalloutFields -- promotes known source frontmatter fields
 *      (author, attendees, date, tags) into Obsidian-style callout blocks
 *      ([!author], [!attendees], [!date], [!tags]) at the top of the body.
 *      These render via the De Stijl .callout / .callout-blue / .callout-teal
 *      / .callout-red CSS classes shipped by scripts/generate-hub.cjs (v1.9.7).
 *   3. injectBrandedFooter -- appends a MindrianOS branded footer using the
 *      same FOOTER_MARKER string as scripts/vault-footer-injector.cjs (Phase
 *      76) so idempotency checks cover both paths.
 *
 * Phase 76 discovery (scripts/vault-footer-injector.cjs):
 *   - Exports buildFooter, hasExistingFooter, appendFooter, processFile.
 *   - FOOTER_MARKER = '> MindrianOS |', FOOTER_BRAND = '> [SQUARE] MindrianOS |'
 *     (the square glyph is intentionally preserved verbatim from that file).
 *   - Uses enrichFrontmatter from lib/vault/frontmatter-schema.cjs.
 *   - The Phase 76 module is CLI-first but exports are reusable; however the
 *     80-06 branding flow needs a per-file, per-import-context API that
 *     Phase 76 does not expose (it walks a whole room and computes its own
 *     import context from roomName). So this module reimplements the thin
 *     per-file footer pathway while reusing the SAME marker so the two
 *     paths are mutually idempotent.
 *
 * Idempotent: running applyBranding twice on the same file produces no
 * second-pass changes (footer not doubled, callouts not duplicated,
 * frontmatter already canonical).
 *
 * Zero em-dashes in this file and in branding.test.cjs (hyphens only).
 */

const fs = require('node:fs');
const path = require('node:path');
const matter = require('gray-matter');

// FOOTER_MARKER must match scripts/vault-footer-injector.cjs (Phase 76).
const FOOTER_MARKER = '> MindrianOS |';
// The branded prefix uses a bracketed token instead of a box glyph so the
// source file stays plain ASCII and is trivially greppable across platforms.
const FOOTER_BRAND = '> [MOS] MindrianOS |';

const CALLOUT_MARKER = '<!-- destijl-callout -->';
const CALLOUT_FIELDS = ['author', 'attendees', 'date', 'tags'];

const CANONICAL_KEYS = new Set([
  'title',
  'section',
  'status',
  'imported_from',
  'imported_at',
  'import_id',
  'source_wikilinks',
  'tags'
]);

// ---------------------------------------------------------------------------
// Footer injection
// ---------------------------------------------------------------------------

function hasExistingFooter(content) {
  return /^>\s*(?:\[MOS\]\s*)?MindrianOS\s*\|/m.test(content);
}

function injectBrandedFooter(artifactPath, importContext) {
  const content = fs.readFileSync(artifactPath, 'utf8');
  if (hasExistingFooter(content)) return false;

  const importedAt = (importContext && importContext.imported_at) || new Date().toISOString();
  const sourceVault = (importContext && importContext.source_vault) || 'unknown';
  const importId = (importContext && importContext.import_id) || 'unknown';

  const footer = [
    '',
    '---',
    '',
    FOOTER_BRAND + ' imported ' + importedAt + ' | from ' + sourceVault + ' | import_id: ' + importId,
    ''
  ].join('\n');

  const trimmed = content.replace(/\s+$/, '');
  // Avoid doubling an existing horizontal rule at the tail of the body.
  const endsWithHr = /(^|\n)---\s*$/.test(trimmed);
  const out = endsWithHr
    ? trimmed + '\n\n' + FOOTER_BRAND + ' imported ' + importedAt + ' | from ' + sourceVault + ' | import_id: ' + importId + '\n'
    : trimmed + footer;

  fs.writeFileSync(artifactPath, out);
  return true;
}

// ---------------------------------------------------------------------------
// Frontmatter normalization
// ---------------------------------------------------------------------------

function normalizeFrontmatter(artifactPath, classification, importContext) {
  const raw = fs.readFileSync(artifactPath, 'utf8');
  const parsed = matter(raw);
  const src = parsed.data || {};

  const importedAt = (importContext && importContext.imported_at) || new Date().toISOString();

  // Preserve any previously-seeded _source_frontmatter so re-runs do not
  // nest it recursively on every invocation.
  const previouslyPreserved = (src._source_frontmatter && typeof src._source_frontmatter === 'object')
    ? src._source_frontmatter
    : {};

  const canonical = {};
  canonical.title = src.title || path.basename(artifactPath, '.md');
  canonical.section = (classification && classification.section) || src.section || '';
  canonical.status = 'imported';
  canonical.imported_from = (importContext && importContext.source_path) || src.imported_from || '';
  canonical.imported_at = src.imported_at || importedAt;
  canonical.import_id = (importContext && importContext.import_id) || src.import_id || '';

  if (Array.isArray(src.source_wikilinks)) {
    canonical.source_wikilinks = src.source_wikilinks;
  } else if (importContext && Array.isArray(importContext.source_wikilinks)) {
    canonical.source_wikilinks = importContext.source_wikilinks;
  } else {
    canonical.source_wikilinks = [];
  }

  if (Array.isArray(src.tags)) canonical.tags = src.tags;
  else if (src.tags) canonical.tags = [src.tags];
  else canonical.tags = [];

  // Everything else goes under _source_frontmatter so it round-trips.
  const preserved = Object.assign({}, previouslyPreserved);
  for (const [k, v] of Object.entries(src)) {
    if (CANONICAL_KEYS.has(k)) continue;
    if (k === '_source_frontmatter') continue;
    preserved[k] = v;
  }
  if (Object.keys(preserved).length > 0) canonical._source_frontmatter = preserved;

  const out = matter.stringify(parsed.content, canonical);
  fs.writeFileSync(artifactPath, out);
  return canonical;
}

// ---------------------------------------------------------------------------
// Callout promotion
// ---------------------------------------------------------------------------

function formatCalloutValue(v) {
  if (Array.isArray(v)) return v.map(formatCalloutValue).join(', ');
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v);
}

function promoteCalloutFields(artifactPath) {
  const raw = fs.readFileSync(artifactPath, 'utf8');
  if (raw.includes(CALLOUT_MARKER)) return false; // idempotent

  const parsed = matter(raw);
  const fm = parsed.data || {};
  const src = (fm._source_frontmatter && typeof fm._source_frontmatter === 'object') ? fm._source_frontmatter : {};

  const callouts = [];
  for (const key of CALLOUT_FIELDS) {
    let v = src[key];
    if (v == null || v === '') v = fm[key];
    if (v == null || v === '') continue;
    if (Array.isArray(v) && v.length === 0) continue;
    callouts.push('> [!' + key + '] ' + formatCalloutValue(v));
  }
  if (callouts.length === 0) return false;

  // Block uses De Stijl callout rendering (scripts/generate-hub.cjs .callout
  // classes). The marker comment makes the block detectable on re-runs and
  // also acts as a hint for the hub renderer to wrap with callout-blue.
  const block = [CALLOUT_MARKER, ...callouts, ''].join('\n');
  const newBody = block + '\n' + parsed.content.replace(/^\s+/, '');
  const out = matter.stringify(newBody, fm);
  fs.writeFileSync(artifactPath, out);
  return true;
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

function applyBranding(artifactPath, classification, importContext) {
  normalizeFrontmatter(artifactPath, classification, importContext);
  promoteCalloutFields(artifactPath);
  injectBrandedFooter(artifactPath, importContext);
}

module.exports = {
  injectBrandedFooter: injectBrandedFooter,
  normalizeFrontmatter: normalizeFrontmatter,
  promoteCalloutFields: promoteCalloutFields,
  applyBranding: applyBranding,
  hasExistingFooter: hasExistingFooter,
  FOOTER_MARKER: FOOTER_MARKER,
  FOOTER_BRAND: FOOTER_BRAND,
  CALLOUT_MARKER: CALLOUT_MARKER,
  CALLOUT_FIELDS: CALLOUT_FIELDS,
  CANONICAL_KEYS: CANONICAL_KEYS
};
