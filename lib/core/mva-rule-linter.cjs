/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 118-06 Plan 06 -- mva-rule-linter.
 *
 * The reward-before-investment rule linter (per docs/reward-before-investment
 * -rule.md). Scans commands/*.md frontmatter, validates that every interactive
 * command declares an `interactive_first_reward` field, classifies into three
 * buckets:
 *
 *   compliant -> field present with an allowed REWARD_TYPES value
 *   missing   -> file has no frontmatter, OR no `interactive_first_reward` key
 *   invalid   -> field present but value not in REWARD_TYPES enum
 *
 * REWARD_TYPES is the v1.13.0 canonical closed vocabulary. Future additions
 * are canon amendments, not command-level inventions (per rule doc + Canon
 * Part 7 reuse-before-build).
 *
 * Per binding decision B5: this library is the enforcement mechanism the
 * universal rule needs. Per-command actual remediations are out-of-scope
 * follow-up phases. This file only validates the DECLARATION.
 *
 * Canon Part 8: zero network, zero Brain calls, zero user-content egress.
 * Reads only plugin-source command files (fs.readdirSync + fs.readFileSync).
 *
 * Pure CJS, node built-ins only.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

// ---------- The closed vocabulary (v1.13.0) ----------

// Per docs/reward-before-investment-rule.md + WARN-5 audit (plan-checker
// iteration 2):
//   reframe_question                -- Larry reframes the user's sentence
//                                      into a beautiful question (onboard).
//   instant_brief                   -- the 30-second MVA pipeline output
//                                      (new-project; this phase's deliverable).
//   schema_preview                  -- structural preview of what would be
//                                      extracted before the full ask.
//   calibration_distribution_preview-- anonymized score distribution from the
//                                      calibration set (grade).
//   paragraph_preview               -- partial extraction from the first
//                                      paragraph alone (file-meeting).
//   --none (scripting only)         -- explicit opt-out, per rule doc line 81
//                                      (scripting override).
const REWARD_TYPES = Object.freeze(new Set([
  'reframe_question',
  'instant_brief',
  'schema_preview',
  'calibration_distribution_preview',
  'paragraph_preview',
  '--none (scripting only)',
]));

// ---------- Frontmatter parser (mirrors scripts/build-command-registry.cjs) ----------

// Hand-rolled YAML-ish slice parser. Handles:
//   key: value
//   key: ["a","b"]    (JSON.parse)
//   key:              + indented `- item` dash list
//   strips surrounding quotes
//   key: null         -> null
//   key: true|false   -> boolean
//
// Returns:
//   - parsed frontmatter object on success
//   - null if no `---` block found (caller flags as "missing")
function parseFrontmatter(md) {
  if (typeof md !== 'string') return null;
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md);
  if (!m) return null;
  const out = {};
  let key = null;
  for (const rawLine of m[1].split(/\r?\n/)) {
    const line = rawLine.replace(/\s+$/, '');
    // Skip comments and blank lines
    if (line === '' || /^\s*#/.test(line)) {
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) {
      key = kv[1];
      const v = kv[2].trim();
      if (v === '') {
        out[key] = [];
      } else if (v === 'null' || v === '~') {
        out[key] = null;
      } else if (v === 'true' || v === 'false') {
        out[key] = v === 'true';
      } else if (v.startsWith('[')) {
        try {
          out[key] = JSON.parse(v);
        } catch (_e) {
          out[key] = v.replace(/^["']|["']$/g, '');
        }
      } else {
        // Strip trailing inline comment ("value  # comment") -- the linter
        // only cares about the scalar; the comment is metadata.
        const noComment = v.replace(/\s+#.*$/, '');
        out[key] = noComment.replace(/^["']|["']$/g, '');
      }
    } else if (key && /^\s*-\s+/.test(line)) {
      if (!Array.isArray(out[key])) out[key] = [];
      out[key].push(line.replace(/^\s*-\s+/, '').replace(/^["']|["']$/g, ''));
    }
  }
  return out;
}

// ---------- validateFrontmatter ----------

/**
 * validateFrontmatter(fm) -> { ok: boolean, reason?: string, value?: string }
 *
 *   - fm = null               -> { ok: false, reason: 'no_frontmatter' }
 *   - missing interactive_first_reward field -> { ok: false, reason: 'missing_field' }
 *   - value not in REWARD_TYPES               -> { ok: false, reason: 'invalid_value', value }
 *   - else                                    -> { ok: true, value }
 *
 * The `--none (scripting only)` literal is accepted verbatim per rule doc
 * line 81. Whitespace-trim before lookup so trailing-space typos don't
 * falsely fail.
 */
function validateFrontmatter(fm) {
  if (fm === null || typeof fm !== 'object') {
    return { ok: false, reason: 'no_frontmatter' };
  }
  if (!Object.prototype.hasOwnProperty.call(fm, 'interactive_first_reward')) {
    return { ok: false, reason: 'missing_field' };
  }
  const raw = fm.interactive_first_reward;
  if (typeof raw !== 'string') {
    return { ok: false, reason: 'invalid_value', value: String(raw) };
  }
  const value = raw.trim();
  if (!REWARD_TYPES.has(value)) {
    return { ok: false, reason: 'invalid_value', value };
  }
  return { ok: true, value };
}

// ---------- scanCommands ----------

/**
 * scanCommands(commandsDir) -> { ok, compliant[], missing[], invalid[] }
 *
 * Reads every *.md in commandsDir (non-recursive), parses frontmatter, runs
 * validateFrontmatter, classifies into one of three buckets. Each entry is
 * { path, reason?, value? }.
 *
 * ok === true iff missing.length === 0 AND invalid.length === 0.
 *
 * Graceful: a file without a frontmatter block is reported in `missing`
 * (does NOT throw). A file that fs.readFileSync cannot read is reported in
 * `missing` with reason='read_error'. The function never throws.
 */
function scanCommands(commandsDir) {
  const compliant = [];
  const missing = [];
  const invalid = [];

  let entries;
  try {
    entries = fs.readdirSync(commandsDir);
  } catch (e) {
    return {
      ok: false,
      compliant,
      missing: [{ path: commandsDir, reason: 'commands_dir_read_error', error: e.message }],
      invalid,
    };
  }

  const mdFiles = entries.filter((f) => f.endsWith('.md')).sort();

  for (const f of mdFiles) {
    const full = path.join(commandsDir, f);
    let raw;
    try {
      raw = fs.readFileSync(full, 'utf8');
    } catch (_e) {
      missing.push({ path: full, reason: 'read_error' });
      continue;
    }
    const fm = parseFrontmatter(raw);
    const v = validateFrontmatter(fm);
    if (v.ok) {
      compliant.push({ path: full, value: v.value });
    } else if (v.reason === 'invalid_value') {
      invalid.push({ path: full, reason: v.reason, value: v.value });
    } else {
      // no_frontmatter OR missing_field -- both count as "missing"
      missing.push({ path: full, reason: v.reason });
    }
  }

  return {
    ok: missing.length === 0 && invalid.length === 0,
    compliant,
    missing,
    invalid,
  };
}

module.exports = {
  scanCommands,
  validateFrontmatter,
  parseFrontmatter, // exposed for tests
  REWARD_TYPES,
};
