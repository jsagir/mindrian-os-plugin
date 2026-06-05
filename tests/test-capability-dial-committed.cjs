'use strict';
// LARRY-01 / LARRY-02 + DRSCH-01..04 (Phase 141) -- the capability dial doctrine
// is COMMITTED (in HEAD, not just the working tree) and version-locked.
//
// RED now: HEAD:skills/larry-personality/SKILL.md does not contain the dial
// (the dial lives only as an uncommitted working-tree edit). This suite asserts,
// against the COMMITTED tree (git show HEAD:...), that the implementation plan
// landed the doctrine + the 5-place version lockstep:
//   - committed SKILL.md contains "Capability Dial"
//   - committed SKILL.md frontmatter declares canon_parts: [Part 2, Part 3, Part 8, Part 9]
//   - committed SKILL.md carries the deep-research 5th reach row + Reach rule 6
//   - CHANGELOG top entry names the Capability Dial and version 1.13.1-beta.7
//   - plugin.json and package.json both read 1.13.1-beta.7
//
// House rule: hyphens only, no em-dashes.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..');
const VERSION = '1.13.1-beta.7';

function gitShowHead(relPath) {
  try {
    return execFileSync('git', ['show', 'HEAD:' + relPath], { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch (e) {
    return '';
  }
}

// ---- Committed SKILL.md doctrine (LARRY-01, DRSCH) ----
const skillCommitted = gitShowHead('skills/larry-personality/SKILL.md');

assert.ok(
  skillCommitted.indexOf('Capability Dial') !== -1,
  'LARRY-01: HEAD:skills/larry-personality/SKILL.md must contain "Capability Dial" (RED until the doctrine is committed)'
);

// Frontmatter canon_parts declaration (D-04c). Match the four parts in order.
assert.match(
  skillCommitted,
  /canon_parts:\s*\[\s*Part 2\s*,\s*Part 3\s*,\s*Part 8\s*,\s*Part 9\s*\]/,
  'LARRY-01: committed SKILL.md frontmatter must declare canon_parts: [Part 2, Part 3, Part 8, Part 9]'
);

// DRSCH doctrine: the deep-research 5th reach row + Reach rule 6 are present.
assert.ok(
  /deep research/i.test(skillCommitted),
  'DRSCH: committed SKILL.md must carry the deep-research reach row'
);
assert.match(
  skillCommitted,
  /^6\.\s/m,
  'DRSCH: committed SKILL.md Reach rules must include rule 6 (deep research is plan-gated)'
);

// ---- Version lockstep (LARRY-02) ----
const changelog = fs.readFileSync(path.join(REPO_ROOT, 'CHANGELOG.md'), 'utf8');
const topEntry = changelog.split('\n## ')[0]; // header through first section break

assert.ok(
  topEntry.indexOf(VERSION) !== -1,
  'LARRY-02: CHANGELOG top entry must name version ' + VERSION
);
assert.ok(
  /Capability Dial/i.test(topEntry),
  'LARRY-02: CHANGELOG top entry must name the Capability Dial'
);

const pluginJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, '.claude-plugin', 'plugin.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));

assert.equal(pluginJson.version, VERSION, 'LARRY-02: plugin.json version must be ' + VERSION);
assert.equal(packageJson.version, VERSION, 'LARRY-02: package.json version must be ' + VERSION);

process.stdout.write('PASS test-capability-dial-committed.cjs (LARRY-01/02 + DRSCH doctrine + version lockstep)\n');
process.exit(0);
