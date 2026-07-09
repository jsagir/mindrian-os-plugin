'use strict';
// Phase 198-08 (SPEC-5, D-06) -- hook-adapter-audit: the measured
// "adapter-only" budget for MIGRATED hook scripts (enumerated from
// hooks/hooks.json's _mcpFirst198Migrated marker, Task 1). Two checks:
//   1. IMPORT AUDIT -- a migrated hook script's own require() calls (after
//      comment-stripping, so a header/doc comment naming lib/core does not
//      self-invalidate the gate) never reach into lib/core, lib/workflow, or
//      lib/memory (the business-module directories D-06 forbids from a hook
//      script's own text -- lib/mcp/* adapter plumbing, e.g. adapter-
//      client.cjs's own daemon-lifecycle.cjs require, is allowed; the audit
//      targets hook scripts, not lib/mcp/adapter-client.cjs itself).
//   2. LINE-COUNT BUDGET -- each migrated script stays under a measured
//      per-file ceiling (baseline + a small margin), so a future change
//      cannot silently re-fatten a thin adapter back into a business-logic
//      script without this test failing.
//
// Scope: ONLY the surfaces hooks.json's own migration marker names (D-05:
// statusline + SessionStart THIS plan; Stop-gate scripts are Plan 09's
// concern and are never enumerated here -- enumeration comes from the
// marker, not a hand-maintained list, so Plan 09 adding its own marker
// entries later does not require touching this file).
//
// No em-dashes. CJS only.

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const HOOKS_JSON_PATH = path.join(REPO_ROOT, 'hooks', 'hooks.json');

// Measured baseline + a small margin (D-06: "set the budget from the thin
// post-migration line counts with a small margin; record the exact numbers
// in the test and the SUMMARY"). This is the single source of truth for
// all three numbers; 198-08-SUMMARY.md and 198-09-SUMMARY.md cite these same
// figures.
//
// (measured via src.split('\n').length, the same measure lineCountBudget()
// uses below -- one more than a bare `wc -l` on a file with a trailing
// newline, since split() counts the trailing empty segment)
//
//   scripts/statusline-mos-dispatch:      128 measured lines -> 150 budget (+22 margin)
//   scripts/sessionstart-coordinator.cjs: 250 measured lines -> 280 budget (+30 margin;
//     the flag-OFF legacy runAll()/11-contributor dispatch table stays inline
//     BY DESIGN for byte-identical legacy behavior -- SPEC-7 -- so this
//     budget is intentionally larger than statusline's; the NEW flag-ON
//     runThinAdapter() path itself is under 40 lines)
//   scripts/on-stop:                      547 measured lines -> 570 budget (+23 margin;
//     Phase 198-09, D-05 final wave. The flag-OFF legacy body -- the full
//     Phase 84/88/88.1 close-out orchestration -- stays inline BY DESIGN for
//     byte-identical legacy behavior (SPEC-7); this generic whole-file line
//     count is therefore intentionally as large as the pre-198-09 file plus
//     the new flag-ON adapter branch alone (~80 lines). This budget is a
//     secondary signal for on-stop -- the REAL D-06 protection for this BASH
//     surface is tests/test-198-adapter-budget.test.cjs's own bespoke
//     flag-ON-branch text audit (a `require(...)`-shaped import audit does
//     not apply to bash; see that test file's own header comment).
const LINE_BUDGETS = {
  'scripts/statusline-mos-dispatch': 150,
  'scripts/sessionstart-coordinator.cjs': 280,
  'scripts/on-stop': 570,
};

// The SAME pattern shape Task 1's own acceptance criteria grep used
// (`require(.*lib/core|require(.*lib/workflow|require(.*lib/memory`), so the
// audit module and the plan's own literal acceptance check agree on what
// counts as a forbidden business import -- including a require() reached via
// path.join(...) rather than only a directly-quoted relative path.
const FORBIDDEN_IMPORT_PATTERN = /require\(.*lib\/core|require\(.*lib\/workflow|require\(.*lib\/memory/;

/**
 * migratedSurfaces() -- read hooks.json's _mcpFirst198Migrated.surfaces
 * marker (Task 1) and return the list of migrated script paths (repo-root
 * relative). Never throws; a missing/malformed marker returns [].
 *
 * @returns {string[]}
 */
function migratedSurfaces() {
  try {
    const raw = fs.readFileSync(HOOKS_JSON_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    const marker = parsed && parsed._mcpFirst198Migrated;
    const surfaces = marker && Array.isArray(marker.surfaces) ? marker.surfaces : [];
    return surfaces
      .map((s) => s && s.script)
      .filter((s) => typeof s === 'string' && s.length > 0);
  } catch (_e) {
    return [];
  }
}

/**
 * stripComments(src) -- drop any line whose first non-whitespace characters
 * are `#` (bash) or `//` (js), so a header/doc comment naming lib/core does
 * not self-invalidate the import-audit gate. Does not attempt to strip
 * inline trailing comments or block comments -- the migrated scripts in
 * scope never wrap a require() call inside one, so a line-anchored strip is
 * sufficient and avoids needing a full parser.
 *
 * @param {string} src
 * @returns {string}
 */
function stripComments(src) {
  return src
    .split('\n')
    .filter((line) => {
      const trimmed = line.trim();
      return !(trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('*'));
    })
    .join('\n');
}

/**
 * auditHookScripts(opts) -- run the import audit over every migrated
 * surface. Returns a per-file result plus an overall pass boolean. Never
 * throws.
 *
 * @param {{surfaces?: string[], root?: string}} [opts] - override the
 *   enumerated surfaces and/or the root dir scripts resolve against (test
 *   seam -- lets a test point at a hermetic fixture copy without touching
 *   the real tracked file)
 * @returns {{pass: boolean, files: Array<{script: string, pass: boolean, violation: string|null}>}}
 */
function auditHookScripts(opts) {
  const options = opts || {};
  const root = options.root || REPO_ROOT;
  const surfaces = options.surfaces || migratedSurfaces();
  const files = surfaces.map((script) => {
    const abs = path.isAbsolute(script) ? script : path.join(root, script);
    let src;
    try {
      src = fs.readFileSync(abs, 'utf8');
    } catch (e) {
      return { script, pass: false, violation: 'file not readable: ' + (e && e.message) };
    }
    const stripped = stripComments(src);
    const match = stripped.match(FORBIDDEN_IMPORT_PATTERN);
    if (match) {
      return { script, pass: false, violation: 'forbidden business import: ' + match[0] };
    }
    return { script, pass: true, violation: null };
  });
  return { pass: files.every((f) => f.pass), files };
}

/**
 * lineCountBudget(opts) -- run the line-count budget check over every
 * migrated surface, against the measured LINE_BUDGETS ceiling. A surface
 * with no recorded budget fails closed (never silently unbudgeted).
 *
 * @param {{surfaces?: string[], root?: string}} [opts]
 * @returns {{pass: boolean, files: Array<{script: string, lines: number, budget: number|null, pass: boolean}>}}
 */
function lineCountBudget(opts) {
  const options = opts || {};
  const root = options.root || REPO_ROOT;
  const surfaces = options.surfaces || migratedSurfaces();
  const files = surfaces.map((script) => {
    const abs = path.isAbsolute(script) ? script : path.join(root, script);
    let lines;
    try {
      const src = fs.readFileSync(abs, 'utf8');
      lines = src.split('\n').length;
    } catch (_e) {
      lines = Infinity;
    }
    const budget = Object.prototype.hasOwnProperty.call(LINE_BUDGETS, script)
      ? LINE_BUDGETS[script]
      : null;
    const pass = typeof budget === 'number' && lines <= budget;
    return { script, lines, budget, pass };
  });
  return { pass: files.every((f) => f.pass), files };
}

/**
 * checkAdapterBudget(opts) -- the combined D-06 gate: import audit AND
 * line-count budget must both pass for every migrated surface.
 *
 * @param {{surfaces?: string[]}} [opts]
 * @returns {{pass: boolean, importAudit: object, lineBudget: object}}
 */
function checkAdapterBudget(opts) {
  const importAudit = auditHookScripts(opts);
  const lineBudget = lineCountBudget(opts);
  return {
    pass: importAudit.pass && lineBudget.pass,
    importAudit,
    lineBudget,
  };
}

module.exports = {
  migratedSurfaces,
  auditHookScripts,
  lineCountBudget,
  checkAdapterBudget,
  LINE_BUDGETS,
  FORBIDDEN_IMPORT_PATTERN,
};
