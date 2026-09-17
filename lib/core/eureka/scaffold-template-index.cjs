'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Quick task 260917-ild (Codex finding F4) -- the shipped-scaffold template
 * index: a load-time-built, pure-local, zero-dependency lookup answering
 * "is this file's body IDENTICAL to its shipped scaffold template" and, when
 * not, "what authored text remains after stripping the template lines."
 *
 * Replaces the prior kind-plus-basename exclusion in
 * scripts/entity-extract.cjs collectArtifacts, which dropped EVERY scaffold
 * file wholesale (kind + basename match alone), including a MINTO.md whose
 * governing thought a human had actually authored, and skipped the
 * frontmatter metadata pass for that file too. Extraction now wins over
 * exclusion whenever a kind has no template to compare against, or a file's
 * body differs from its template at all: only a byte-for-byte
 * (post-normalization) template match is excluded.
 *
 * DERIVATION, NEVER A HAND-TYPED BODY OR LIST:
 *   - templates/room-skeleton/*.tmpl on disk, read via readdirSync at load
 *     time. A filename of the shape KIND.md[.variant].tmpl feeds kind KIND;
 *     ROOM.md.identity.tmpl and ROOM.md.section.tmpl both feed kind ROOM and
 *     merge into one matcher set. STATE.md.tmpl, MINTO.md.tmpl and
 *     USER.md.tmpl each feed their own kind.
 *   - BRAIN and FEYNMAN have NO template file on disk: their bodies are
 *     sourced from the modules that actually write them --
 *     lib/core/navigation/room-birth.cjs (BRAIN_STUB_TEMPLATE, additively
 *     exported alongside _writeBrainStub, which now renders from it) and
 *     lib/core/feynman/feynman-seed-writer.cjs (FEYNMAN_DEFAULT_SEED,
 *     additively exported alongside seedSection, which now reads from it).
 *     Each require is lazy and independently try/caught: if either module or
 *     export is missing, that kind simply has NO template and is therefore
 *     NEVER excluded -- losing authored content is the exact failure Codex
 *     F4 named, so a missing source degrades toward extraction, never toward
 *     silent exclusion.
 *   - The kind basename is kind + '.md' (the same shape every entry of
 *     lib/core/memory/reconcile-memory-runner.cjs's BASENAME_TO_KIND
 *     already has), derived here via kindBasename(), never copied as a
 *     second list.
 *
 * MATCHING, NORMALISED AND TOKEN-AWARE:
 *   - normalizeLines() drops a leading YAML frontmatter block (---...---),
 *     lowercases, trims each line, collapses internal whitespace runs to one
 *     space, and drops empty lines. Frontmatter carries the per-render
 *     scalars (dates, slugs, multi-line list blocks) that would otherwise
 *     defeat a naive line-for-line comparison; the BODY below it is where a
 *     human would actually author content, and every body-level {{TOKEN}}
 *     in the shipped templates substitutes to a SINGLE line (verified
 *     against every template in templates/room-skeleton/*.tmpl), so a
 *     line-for-line matcher is sound there.
 *   - Each normalised template line becomes an anchored RegExp: the literal
 *     text is escaped, and each {{token}} (lowercased by normalization) is
 *     replaced with a permissive `.*` wildcard, so a rendered section name
 *     or statement still matches its template line.
 *   - isTemplateIdentical(kind, body): true when the kind has at least one
 *     matcher and EVERY normalised line of body matches at least one
 *     matcher for that kind. A kind with zero matchers (no template found)
 *     always returns false -- extraction wins. An empty (post-frontmatter)
 *     body also returns false; the caller (collectArtifacts) treats an
 *     empty stripTemplate() remainder as the template-identical case
 *     instead, per its own branch.
 *   - stripTemplate(kind, body): the ORIGINAL lines (pre-normalization, so
 *     authored casing and spacing survive) whose normalised form matches no
 *     matcher for that kind, rejoined with newlines -- the authored
 *     remainder. Blank lines carry no authored signal either way and are
 *     dropped from the remainder.
 *
 * NO em-dashes anywhere (CLAUDE.md HARD RULE). Pure CJS, zero npm deps,
 * never throws.
 *
 * License: BSL 1.1.
 */

const fs = require('node:fs');
const path = require('node:path');

const TEMPLATES_DIR = path.resolve(__dirname, '..', '..', '..', 'templates', 'room-skeleton');
const TEMPLATE_FILENAME_RE = /^([A-Za-z0-9]+)\.md(?:\.([A-Za-z0-9_-]+))?\.tmpl$/;
const TOKEN_RE = /\{\{[a-z0-9_]+\}\}/g;

function escapeRegexLiteral(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Strip a leading YAML frontmatter block (--- ... ---). A file with no
// frontmatter marker, or an unterminated one, is left exactly as-is --
// defensive, never throws.
function stripLeadingFrontmatter(text) {
  const s = String(text == null ? '' : text);
  const lines = s.split(/\r?\n/);
  if (lines.length === 0 || lines[0].trim() !== '---') return s;
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      return lines.slice(i + 1).join('\n');
    }
  }
  return s;
}

// normalizeLines(text) -> [{ norm, raw }], frontmatter-stripped, lowercased,
// trimmed, whitespace-collapsed, empty lines dropped. `raw` preserves the
// original (pre-normalization) line so stripTemplate can return authored
// casing and spacing.
function normalizeLines(text) {
  const body = stripLeadingFrontmatter(text);
  const rawLines = body.split(/\r?\n/);
  const out = [];
  for (const raw of rawLines) {
    const norm = raw.toLowerCase().trim().replace(/\s+/g, ' ');
    if (norm.length === 0) continue;
    out.push({ norm: norm, raw: raw });
  }
  return out;
}

// A normalised template line (already lowercased/trimmed/collapsed, may
// still carry {{token}} placeholders, themselves lowercased by
// normalization) -> an anchored RegExp matching any single-line rendered
// substitution of that line. Never throws; an unconstructible pattern is
// simply dropped (that template line contributes no matcher).
function lineToMatcher(normLine) {
  let pattern = '';
  let lastIndex = 0;
  TOKEN_RE.lastIndex = 0;
  let m;
  while ((m = TOKEN_RE.exec(normLine)) !== null) {
    pattern += escapeRegexLiteral(normLine.slice(lastIndex, m.index));
    pattern += '.*';
    lastIndex = TOKEN_RE.lastIndex;
  }
  pattern += escapeRegexLiteral(normLine.slice(lastIndex));
  try {
    return new RegExp('^' + pattern + '$');
  } catch (_e) {
    return null;
  }
}

// kindMatchers: kind -> array of compiled RegExp (the merged matcher set;
// multiple template files for one kind, e.g. ROOM.md.identity.tmpl +
// ROOM.md.section.tmpl, union into the same bucket).
const kindMatchers = new Map();

function addTemplateBody(kind, body) {
  if (typeof kind !== 'string' || kind.length === 0) return;
  if (typeof body !== 'string' || body.length === 0) return;
  const lines = normalizeLines(body);
  if (!kindMatchers.has(kind)) kindMatchers.set(kind, []);
  const bucket = kindMatchers.get(kind);
  for (const entry of lines) {
    const re = lineToMatcher(entry.norm);
    if (re) bucket.push(re);
  }
}

// --- (1) templates/room-skeleton/*.tmpl on disk -------------------------
(function loadDiskTemplates() {
  let entries = [];
  try {
    entries = fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true });
  } catch (_e) {
    entries = [];
  }
  for (const entry of entries) {
    if (!entry || typeof entry.isFile !== 'function' || !entry.isFile()) continue;
    const m = TEMPLATE_FILENAME_RE.exec(entry.name);
    if (!m) continue;
    const kind = m[1].toUpperCase();
    let content = null;
    try {
      content = fs.readFileSync(path.join(TEMPLATES_DIR, entry.name), 'utf8');
    } catch (_e) {
      content = null;
    }
    if (content) addTemplateBody(kind, content);
  }
})();

// --- (2) BRAIN, sourced from the module that writes it -------------------
(function loadBrainTemplate() {
  try {
    const roomBirth = require('../navigation/room-birth.cjs');
    if (typeof roomBirth.BRAIN_STUB_TEMPLATE === 'string' && roomBirth.BRAIN_STUB_TEMPLATE.length > 0) {
      addTemplateBody('BRAIN', roomBirth.BRAIN_STUB_TEMPLATE);
    }
  } catch (_e) {
    // No source -> no BRAIN template -> BRAIN is never excluded (extraction wins).
  }
})();

// --- (3) FEYNMAN, sourced from the module that writes it -----------------
(function loadFeynmanTemplate() {
  try {
    const feynmanSeedWriter = require('../feynman/feynman-seed-writer.cjs');
    if (typeof feynmanSeedWriter.FEYNMAN_DEFAULT_SEED === 'string' && feynmanSeedWriter.FEYNMAN_DEFAULT_SEED.length > 0) {
      // The real writer composes '# <sectionSlug>\n\n' + seed + '\n'; the H1
      // line carries a per-section slug (a rendered token), so model it as a
      // wildcard line ahead of the fixed seed sentence, the same {{TOKEN}}
      // convention the disk templates use.
      addTemplateBody('FEYNMAN', '# {{SECTION_SLUG}}\n\n' + feynmanSeedWriter.FEYNMAN_DEFAULT_SEED);
    }
  } catch (_e) {
    // No source -> no FEYNMAN template -> FEYNMAN is never excluded.
  }
})();

const SCAFFOLD_KINDS = Object.freeze(new Set(kindMatchers.keys()));

// kindBasename(kind) -- derived accessor, never a copied list (the same
// shape every entry of reconcile-memory-runner.cjs's BASENAME_TO_KIND has).
function kindBasename(kind) {
  return (typeof kind === 'string' && kind.length > 0) ? (kind + '.md') : null;
}

// isTemplateIdentical(kind, body) -- true when EVERY normalised line of body
// matches at least one matcher for kind. See module docblock for the empty-
// body and no-matcher edge cases.
function isTemplateIdentical(kind, body) {
  const matchers = kindMatchers.get(kind);
  if (!matchers || matchers.length === 0) return false;
  const lines = normalizeLines(body);
  if (lines.length === 0) return false;
  for (const entry of lines) {
    let matched = false;
    for (const re of matchers) {
      if (re.test(entry.norm)) { matched = true; break; }
    }
    if (!matched) return false;
  }
  return true;
}

// stripTemplate(kind, body) -- the ORIGINAL lines whose normalised form
// matches no matcher for kind, rejoined -- the authored remainder.
function stripTemplate(kind, body) {
  const rawBody = stripLeadingFrontmatter(body);
  const matchers = kindMatchers.get(kind);
  if (!matchers || matchers.length === 0) return rawBody;
  const rawLines = rawBody.split(/\r?\n/);
  const kept = [];
  for (const raw of rawLines) {
    const norm = raw.toLowerCase().trim().replace(/\s+/g, ' ');
    if (norm.length === 0) continue; // blank lines carry no authored signal
    let matched = false;
    for (const re of matchers) {
      if (re.test(norm)) { matched = true; break; }
    }
    if (!matched) kept.push(raw);
  }
  return kept.join('\n');
}

module.exports = {
  SCAFFOLD_KINDS: SCAFFOLD_KINDS,
  kindBasename: kindBasename,
  isTemplateIdentical: isTemplateIdentical,
  stripTemplate: stripTemplate,
};
