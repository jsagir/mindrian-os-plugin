'use strict';

/**
 * Phase 80 Plan 80-06 Task 2 (IMPORT-11) -- Post-import /mos: smoke test.
 *
 * After Stage 04 enrich completes, scripts/vault-import.cjs calls
 * runMosSmokeTest(roomPath) to verify the room is immediately usable with
 * /mos: commands. Deterministic: no AI, no network. Asserts at least one
 * populated canonical section in the imported room.
 *
 * Execution pathway:
 *   1. Try `node bin/mindrian-tools.cjs room state` (preferred)
 *   2. If that fails OR PRECONDITIONS.md flags the lazygraph-ops issue,
 *      fall back to `bash scripts/compute-state <roomPath>`
 *   3. Parse the markdown output for the `## Sections` table:
 *        | section | entries | ... |
 *      and extract sectionCounts
 *   4. If at least one canonical section has count > 0, passed = true
 *
 * Returns: { passed, sectionCounts, warnings, method }
 *
 * Hard rules:
 *   - Never throws. All failure paths produce a structured result.
 *   - Never mutates the room directory.
 *   - No em-dashes anywhere in this file.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const CANONICAL_SECTIONS = [
  'problem-definition',
  'solution-design',
  'business-model',
  'market-analysis',
  'competitive-analysis',
  'financial-model',
  'legal-ip',
  'team-execution'
];

function pluginRootFromHere() {
  return path.resolve(__dirname, '..', '..');
}

function readPreconditionsBroken(pluginRoot) {
  const pre = path.join(pluginRoot, 'lib/import/PRECONDITIONS.md');
  if (!fs.existsSync(pre)) return false;
  try {
    const txt = fs.readFileSync(pre, 'utf8');
    return txt.includes('lazygraph-ops') && txt.includes('still broken');
  } catch (e) {
    return false;
  }
}

// Parse compute-state markdown output. Looks for lines in the
// `## Sections` table like `| problem-definition | 3 | ... |`.
function parseSectionCounts(output) {
  const counts = {};
  if (!output) return counts;
  const lines = output.split(/\r?\n/);
  let inTable = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (/^##\s+Sections/.test(line)) { inTable = true; continue; }
    if (inTable && /^##\s+/.test(line)) break;
    if (!inTable) continue;
    if (!line.startsWith('|')) continue;
    if (/^\|\s*-+/.test(line)) continue;
    if (/^\|\s*Section\s*\|/i.test(line)) continue;
    const cells = line.split('|').map(function (c) { return c.trim(); }).filter(function (c) { return c.length > 0; });
    if (cells.length < 2) continue;
    const name = cells[0];
    const n = parseInt(cells[1], 10);
    if (name && !Number.isNaN(n)) counts[name] = n;
  }
  return counts;
}

function walkTeamCount(teamDir) {
  if (!fs.existsSync(teamDir)) return 0;
  let n = 0;
  const stack = [teamDir];
  while (stack.length) {
    const d = stack.pop();
    let entries;
    try { entries = fs.readdirSync(d, { withFileTypes: true }); }
    catch (e) { continue; }
    for (const e of entries) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) stack.push(p);
      else if (e.isFile() && e.name.endsWith('.md') && e.name !== 'ROOM.md' && e.name !== 'STATE.md') n++;
    }
  }
  return n;
}

function runMosSmokeTest(roomPath, importContext) {
  importContext = importContext || {};
  const result = { passed: false, sectionCounts: {}, warnings: [], method: null };

  if (!roomPath || !fs.existsSync(roomPath)) {
    result.warnings.push('room path does not exist: ' + String(roomPath));
    return result;
  }

  const pluginRoot = importContext.pluginRoot || pluginRootFromHere();
  const lazyBroken = readPreconditionsBroken(pluginRoot);
  const forceFallback = !!importContext.forceFallback;

  let output = '';

  // Attempt 1: bin/mindrian-tools.cjs room state
  if (!forceFallback && !lazyBroken) {
    const toolsPath = path.join(pluginRoot, 'bin/mindrian-tools.cjs');
    if (fs.existsSync(toolsPath)) {
      try {
        output = execFileSync('node', [toolsPath, 'room', 'state'], {
          cwd: roomPath,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe']
        });
        result.method = 'mindrian-tools';
      } catch (e) {
        const msg = ((e && e.message) || '').slice(0, 160);
        result.warnings.push('mindrian-tools room state failed: ' + msg);
      }
    }
  }

  // Attempt 2: scripts/compute-state fallback
  if (!output) {
    const computeState = path.join(pluginRoot, 'scripts/compute-state');
    if (fs.existsSync(computeState)) {
      try {
        output = execFileSync('bash', [computeState, roomPath], {
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe']
        });
        result.method = 'compute-state';
      } catch (e) {
        const msg = ((e && e.message) || '').slice(0, 160);
        result.warnings.push('compute-state failed: ' + msg);
      }
    } else {
      result.warnings.push('compute-state script not found at ' + computeState);
    }
  }

  // Parse whatever we got
  if (output) {
    const parsed = parseSectionCounts(output);
    Object.assign(result.sectionCounts, parsed);
  }

  // Team count via filesystem walk (always, regardless of output)
  const teamDir = path.join(roomPath, 'team');
  if (fs.existsSync(teamDir)) {
    const teamN = walkTeamCount(teamDir);
    if (teamN > 0) result.sectionCounts.team = teamN;
  }

  // Pass/fail: at least one canonical section has count > 0
  const populated = CANONICAL_SECTIONS.filter(function (s) { return (result.sectionCounts[s] || 0) > 0; });
  if (populated.length === 0 && !(result.sectionCounts.team > 0)) {
    result.warnings.push('no populated canonical sections');
    result.passed = false;
  } else {
    result.passed = populated.length > 0;
    if (!result.passed && result.sectionCounts.team > 0) {
      // Team-only rooms pass with a warning.
      result.passed = true;
      result.warnings.push('only team populated; no canonical content sections');
    }
  }

  return result;
}

function renderSmokeTestSection(result) {
  const lines = [];
  lines.push('## /mos: Usability Check');
  lines.push('');
  lines.push('- method: ' + (result.method || 'none'));
  lines.push('- passed: ' + (result.passed ? 'true' : 'false'));
  const populated = Object.entries(result.sectionCounts || {})
    .filter(function (e) { return e[1] > 0; }).length;
  lines.push('- populated sections: ' + populated);
  lines.push('');
  lines.push('### Section Counts');
  const keys = Object.keys(result.sectionCounts || {});
  if (keys.length === 0) {
    lines.push('(none)');
  } else {
    for (const k of keys) lines.push('- ' + k + ': ' + result.sectionCounts[k]);
  }
  if ((result.warnings || []).length > 0) {
    lines.push('');
    lines.push('### Warnings');
    for (const w of result.warnings) lines.push('- ' + w);
  }
  lines.push('');
  return lines.join('\n');
}

module.exports = {
  runMosSmokeTest: runMosSmokeTest,
  renderSmokeTestSection: renderSmokeTestSection,
  parseSectionCounts: parseSectionCounts,
  CANONICAL_SECTIONS: CANONICAL_SECTIONS
};
