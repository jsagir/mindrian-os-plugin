'use strict';
/*
 * lib/core/command-registration-check.cjs -- the ONE static precondition sweep
 * for "would this command silently FAIL to register?"
 *
 * Quick task 260705-jeq (commands-registration investigation, 2026-07-05).
 *
 * Claude Code auto-discovers commands/*.md (there is NO `commands` field in
 * .claude-plugin/plugin.json -- the standard contract every surveyed marketplace
 * plugin uses). A handful of STATIC authoring mistakes make the host skip a file
 * SILENTLY -- no error, the command just never appears. This module catches those
 * mistakes BEFORE a release ships, so a genuine "valid install yet a command did
 * not register" is provably NOT one of them (it is the confirmed host-side core
 * bug the doctor's --report-registration-bug escalates).
 *
 * ONE implementation lives here in lib/core/ (this repo's pattern of reusable
 * checks that scripts/doctor.cjs sibling-flag dispatch imports, Canon Part 7).
 * The release gate (scripts/verify-release) and the pre-commit hook
 * (scripts/install-pre-commit.sh) both run this same sweep -- no second checker.
 *
 * Contract:
 *   sweepCommandRegistration(commandsDir) -> {
 *     pass:     boolean,                        // false if any FAIL
 *     failures: [{ file, rule, detail }],       // registration-blocking
 *     warnings: [{ file, rule, detail }],       // registers but renders badly
 *     scanned:  number,                         // *.md files inspected
 *   }
 *
 * FAIL class (causes a SILENT registration skip):
 *   unbalanced_fence   -- file does not open with a `---` line, or has no closing
 *                         `---` line (a malformed frontmatter block).
 *   tab_in_frontmatter -- a TAB character inside the frontmatter block (YAML
 *                         forbids tabs; the block fails to parse).
 *   illegal_name       -- the command name (basename minus .md) is not
 *                         /^[a-z0-9-]+$/ (uppercase / underscore / space / dot).
 *   name_collision     -- two files whose basenames collide case-insensitively
 *                         (one shadows the other on case-insensitive filesystems).
 *
 * WARN class (registers, but renders badly):
 *   missing_description -- no `description:` in the frontmatter.
 *   long_description    -- `description:` longer than 60 characters.
 *   subdirectory        -- a subdirectory under commands/ (auto-discovery scans
 *                         the top level; a nested file will not register). None
 *                         exist today; a found one is a WARN, not a FAIL.
 *
 * CLI mode (require.main === module): scans the repo's commands/ by default, or
 * an optional dir argument; exit 1 on any FAIL, exit 0 on warnings-only (warnings
 * printed to stderr).
 *
 * Pure, synchronous, Node built-ins only (fs, path). Zero network, zero Brain,
 * pure file reads (Canon Part 8).
 */

const fs = require('node:fs');
const path = require('node:path');

const NAME_RE = /^[a-z0-9-]+$/;
const MAX_DESCRIPTION = 60;

// Pull the frontmatter block from a command file's raw text.
// Returns { ok, block, reason }:
//   ok:false + reason 'no_open'   -- first non-empty line is not `---`.
//   ok:false + reason 'no_close'  -- opened with `---` but no closing `---`.
//   ok:true  + block (string)     -- the lines strictly between the two fences.
function extractFrontmatter(text) {
  const lines = text.split('\n');
  // The file must OPEN with a `---` line (line 0, tolerating trailing spaces).
  if (lines.length === 0 || lines[0].trim() !== '---') {
    return { ok: false, block: '', reason: 'no_open' };
  }
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === '---') {
      return { ok: true, block: lines.slice(1, i).join('\n'), reason: '' };
    }
  }
  return { ok: false, block: '', reason: 'no_close' };
}

// Pull the value of a top-level frontmatter key (first match), YAML-scalar
// unquoted. Returns null when the key is absent.
function frontmatterValue(block, key) {
  const re = new RegExp('^' + key + ':\\s*(.+)$', 'm');
  const m = block.match(re);
  if (!m) return null;
  let v = m[1].trim();
  const qm = v.match(/^"([\s\S]*)"$/);
  if (qm) v = qm[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  return v;
}

/**
 * Static precondition sweep over a commands/ directory.
 *
 * @param {string} commandsDir - the directory of command *.md files to scan.
 * @returns {{pass: boolean, failures: object[], warnings: object[], scanned: number}}
 */
function sweepCommandRegistration(commandsDir) {
  const failures = [];
  const warnings = [];
  let scanned = 0;

  let entries;
  try {
    entries = fs.readdirSync(commandsDir, { withFileTypes: true });
  } catch (_e) {
    // A missing / unreadable dir is a single FAIL, not a throw.
    return {
      pass: false,
      failures: [{ file: commandsDir, rule: 'unreadable_dir', detail: 'cannot read commands directory' }],
      warnings: [],
      scanned: 0,
    };
  }

  // Case-insensitive collision tracking across the top-level *.md set.
  const lowerToFiles = new Map();

  for (const ent of entries) {
    if (ent.isDirectory()) {
      // Auto-discovery scans the top level only; a nested file will not
      // register. None exist today -- a found one is a WARN, not a FAIL.
      warnings.push({
        file: ent.name + '/',
        rule: 'subdirectory',
        detail: 'subdirectory under commands/ (auto-discovery scans the top level only)',
      });
      continue;
    }
    if (!ent.isFile() || !ent.name.endsWith('.md')) continue;

    scanned += 1;
    const file = ent.name;
    const name = file.replace(/\.md$/, '');

    // Rule: case-insensitive basename collision (recorded now, resolved below).
    const lower = name.toLowerCase();
    if (!lowerToFiles.has(lower)) lowerToFiles.set(lower, []);
    lowerToFiles.get(lower).push(file);

    // Rule: illegal command name.
    if (!NAME_RE.test(name)) {
      failures.push({
        file,
        rule: 'illegal_name',
        detail: 'command name "' + name + '" must match /^[a-z0-9-]+$/',
      });
    }

    let text = '';
    try {
      text = fs.readFileSync(path.join(commandsDir, file), 'utf8');
    } catch (_e) {
      failures.push({ file, rule: 'unreadable_file', detail: 'cannot read command file' });
      continue;
    }

    // Rule: balanced frontmatter fences.
    const fm = extractFrontmatter(text);
    if (!fm.ok) {
      failures.push({
        file,
        rule: 'unbalanced_fence',
        detail: fm.reason === 'no_open'
          ? 'file must open with a `---` frontmatter line'
          : 'frontmatter opened with `---` but has no closing `---` line',
      });
      // No parseable block -- skip the block-scoped checks for this file.
      continue;
    }

    // Rule: a tab character inside the frontmatter block.
    if (fm.block.indexOf('\t') !== -1) {
      failures.push({
        file,
        rule: 'tab_in_frontmatter',
        detail: 'a TAB character inside the frontmatter block (YAML forbids tabs)',
      });
    }

    // WARN: description missing or over-long.
    const description = frontmatterValue(fm.block, 'description');
    if (description === null) {
      warnings.push({ file, rule: 'missing_description', detail: 'no description: in frontmatter' });
    } else if (description.length > MAX_DESCRIPTION) {
      warnings.push({
        file,
        rule: 'long_description',
        detail: 'description is ' + description.length + ' chars (max ' + MAX_DESCRIPTION + ')',
      });
    }
  }

  // Resolve collisions: any lowercase key claimed by more than one file.
  for (const [lower, files] of lowerToFiles) {
    if (files.length > 1) {
      for (const f of files) {
        failures.push({
          file: f,
          rule: 'name_collision',
          detail: 'case-insensitive basename collision on "' + lower + '" (' + files.join(', ') + ')',
        });
      }
    }
  }

  return { pass: failures.length === 0, failures, warnings, scanned };
}

// ---------------------------------------------------------------------------
// CLI mode.
// ---------------------------------------------------------------------------
function main(argv) {
  const dirArg = argv[0];
  const commandsDir = dirArg
    ? path.resolve(dirArg)
    : path.join(path.resolve(__dirname, '..', '..'), 'commands');

  const result = sweepCommandRegistration(commandsDir);

  for (const w of result.warnings) {
    process.stderr.write('WARN  [' + w.rule + '] ' + w.file + ' -- ' + w.detail + '\n');
  }
  for (const f of result.failures) {
    process.stderr.write('FAIL  [' + f.rule + '] ' + f.file + ' -- ' + f.detail + '\n');
  }

  if (result.pass) {
    process.stdout.write(
      'command-registration sweep: PASS (' + result.scanned + ' scanned, ' +
        result.warnings.length + ' warning(s))\n'
    );
    process.exit(0);
  } else {
    process.stdout.write(
      'command-registration sweep: FAIL (' + result.failures.length + ' failure(s), ' +
        result.scanned + ' scanned)\n'
    );
    process.exit(1);
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { sweepCommandRegistration };
