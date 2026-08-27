#!/usr/bin/env node
/**
 * Phase 265 Plan 04 tripwire -- dispatch shape must be explicit, and every
 * named subagent_type must resolve to a real agents/*.md file.
 *
 * Arm (a): commands/trending-to-absurd.md and commands/explore-opportunity.md
 *   each state a dispatch shape -- at least one of the literal tokens
 *   `in parallel` or `in order` appears together with a reason marker (the
 *   word `because` or `why`) in the same section heading block.
 *
 * Arm (b): for every occurrence of `subagent_type` in any commands/*.md file,
 *   extract the named type and assert `agents/<type>.md` exists on disk. This
 *   is the load-bearing arm: it turns the 2.1.235 unresolvable-subagent_type
 *   hard-error class into a build-time check across the whole command
 *   surface, not just the two files this plan edited.
 *
 * Pure Node.js built-ins only (zero npm deps). NO em-dashes (CLAUDE.md HARD RULE).
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');
const AGENTS_DIR = path.join(REPO_ROOT, 'agents');

let failures = 0;

// ---- Arm (a): dispatch-shape statement present ----

const DISPATCH_SHAPE_FILES = [
  path.join(COMMANDS_DIR, 'trending-to-absurd.md'),
  path.join(COMMANDS_DIR, 'explore-opportunity.md'),
];

function hasDispatchShapeStatement(text) {
  // Split into heading-delimited blocks (## or ### headings). A "section
  // heading block" is the heading line plus everything up to the next
  // heading of the same or higher level.
  const lines = text.split('\n');
  const blocks = [];
  let current = [];
  for (const line of lines) {
    if (/^#{2,3}\s/.test(line) && current.length > 0) {
      blocks.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) blocks.push(current.join('\n'));

  const shapeTokenRe = /(in parallel|in order)/i;
  const reasonMarkerRe = /(because|why)/i;

  return blocks.some((block) => shapeTokenRe.test(block) && reasonMarkerRe.test(block));
}

for (const filePath of DISPATCH_SHAPE_FILES) {
  const rel = path.relative(REPO_ROOT, filePath);
  if (!fs.existsSync(filePath)) {
    console.error(`FAIL: ${rel} does not exist`);
    failures++;
    continue;
  }
  const text = fs.readFileSync(filePath, 'utf8');
  if (!hasDispatchShapeStatement(text)) {
    console.error(
      `FAIL: ${rel} has no dispatch-shape statement (expected "in parallel" or "in order" ` +
        `plus "because"/"why" within the same section heading block)`
    );
    failures++;
  }
}

// ---- Arm (b): every named subagent_type resolves to a real agent file ----

const commandFiles = fs
  .readdirSync(COMMANDS_DIR)
  .filter((f) => f.endsWith('.md'))
  .map((f) => path.join(COMMANDS_DIR, f));

// Matches an explicit assignment form only: `subagent_type: name` or
// `subagent_type=name` (optionally quoted/backticked). Deliberately requires
// a `:` or `=` separator so prose like "subagent_type` is a hard error" or
// "cannot resolve a subagent_type" is never mistaken for an assignment.
const SUBAGENT_TYPE_RE = /subagent_type\s*[:=]\s*["'`]*([A-Za-z0-9_-]+)/g;

for (const filePath of commandFiles) {
  const rel = path.relative(REPO_ROOT, filePath);
  const text = fs.readFileSync(filePath, 'utf8');
  const lines = text.split('\n');

  lines.forEach((line, idx) => {
    if (!line.includes('subagent_type')) return;
    SUBAGENT_TYPE_RE.lastIndex = 0;
    let match;
    while ((match = SUBAGENT_TYPE_RE.exec(line)) !== null) {
      const typeName = match[1];
      const agentPath = path.join(AGENTS_DIR, `${typeName}.md`);
      if (!fs.existsSync(agentPath)) {
        console.error(
          `FAIL: ${rel}:${idx + 1} names subagent_type "${typeName}" but agents/${typeName}.md does not exist`
        );
        failures++;
      }
    }
  });
}

if (failures > 0) {
  console.error(`\n${failures} failure(s) found.`);
  process.exit(1);
}

console.log('PASS: dispatch shape explicit and every subagent_type resolves to a real agent file.');
process.exit(0);
