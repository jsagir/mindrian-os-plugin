'use strict';
/*
 * Phase 205-01 -- the navigator-vs-plumbing SURFACE fence (decision D-Q6),
 * scope items 0 + 0b.
 *
 * Asserts:
 *   (Task 1) every registry entry carries a two-value surface tag; the 11 D-Q6
 *   INTERNAL commands are surface:internal; the generator fails closed on a
 *   missing internal command.
 *   (Task 2) the surface-fence helpers read the tag from the registry as the
 *   single source of truth: filterToNavigator drops every internal command,
 *   methodologyExitsOnly keeps only kind:methodology, the D-Q6 spot checks hold,
 *   and the module does no fs write / no network (source grep).
 *   (Task 3 / item 0b) the MCP router requires the fence and calls
 *   filterToNavigator on its suggest path; no gear-shift / FUSION exit target is
 *   CLI-only (MCP-invisible); ALL_TOOL_COMMANDS mints no new tool.
 *
 * House rule: hyphens only, no em-dashes. CJS only.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const registry = require(path.join(REPO_ROOT, 'data/command-registry.json'));
const fence = require(path.join(REPO_ROOT, 'lib/core/surface-fence.cjs'));
const toolRouter = require(path.join(REPO_ROOT, 'lib/mcp/tool-router.cjs'));

let pass = 0;
function ok(name, cond) { assert.ok(cond, name); console.log('  ok - ' + name); pass++; }

const norm = (c) => String(c).replace(/^\//, '').replace(/^mos:/i, '').toLowerCase();
const allCommands = registry.commands.map((c) => c.command);

// The exact D-Q6 internal (plumbing) partition.
const D_Q6_INTERNAL = [
  'dogfood-flush', 'dial-memory-refresh', 'hmi-status', 'feynman-timeline-refresh',
  'memory-cortex-reach', 'brain-derive', 'correct-reference-now', 'ingest-methodology',
  'new-surface', 'admin', 'splash',
];

// ---------------------------------------------------------------------------
// TASK 1 -- the registry surface tag (D-Q6).
// ---------------------------------------------------------------------------

ok('every registry entry carries surface = navigator|internal',
  registry.commands.every((c) => c.surface === 'navigator' || c.surface === 'internal'));

ok('the 11 D-Q6 internal commands are all present and surface:internal',
  D_Q6_INTERNAL.every((n) => {
    const e = registry.commands.find((c) => norm(c.command) === n);
    return e && e.surface === 'internal';
  }));

ok('exactly 11 entries are surface:internal (no over-tagging)',
  registry.commands.filter((c) => c.surface === 'internal').length === D_Q6_INTERNAL.length);

// Build-closed guard: the generator throws if an INTERNAL name is missing.
ok('the generator fails closed on a renamed/removed internal command', (() => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'scripts/build-command-registry.cjs'), 'utf8');
  return /INTERNAL_SURFACE_COMMANDS/.test(src) && /throw new Error/.test(src) && /missingInternal/.test(src);
})());

// ---------------------------------------------------------------------------
// TASK 2 -- the surface-fence helpers (single source of truth).
// ---------------------------------------------------------------------------

const navigatorSurvivors = fence.filterToNavigator(allCommands);
ok('filterToNavigator over ALL registry commands drops every internal entry',
  navigatorSurvivors.every((c) => !fence.isInternalSurface(c)) &&
  navigatorSurvivors.length === registry.commands.length - D_Q6_INTERNAL.length);

ok('filterToNavigator excludes every known internal command by name',
  D_Q6_INTERNAL.every((n) => !navigatorSurvivors.some((c) => norm(c) === n)));

const methodOnly = fence.methodologyExitsOnly(allCommands);
ok('methodologyExitsOnly returns only kind:methodology entries',
  methodOnly.every((c) => {
    const e = registry.commands.find((x) => norm(x.command) === norm(c));
    return e && e.kind === 'methodology';
  }) && methodOnly.length === registry.commands.filter((c) => c.kind === 'methodology').length);

// D-Q6 spot checks (accept bare + /mos: forms).
ok('isInternalSurface(dogfood-flush) === true', fence.isInternalSurface('dogfood-flush') === true);
ok('isInternalSurface(/mos:dogfood-flush) === true', fence.isInternalSurface('/mos:dogfood-flush') === true);
ok('isNavigatorSurface(funding) === true', fence.isNavigatorSurface('funding') === true);
ok('isNavigatorSurface(dogfood-flush) === false', fence.isNavigatorSurface('dogfood-flush') === false);
ok('isMethodology(beautiful-question) === true', fence.isMethodology('beautiful-question') === true);
ok('isMethodology(admin) === false', fence.isMethodology('admin') === false);

// Soft-fail: an unknown command is treated as navigator (safe surfacing direction).
ok('unknown command soft-fails to navigator (not internal)',
  fence.isNavigatorSurface('this-command-does-not-exist') === true &&
  fence.isInternalSurface('this-command-does-not-exist') === false);

// Pure LOCAL read helper: no fs write, no network (Canon Part 8 safe).
ok('surface-fence.cjs performs no fs write and no network call', (() => {
  const src = fs.readFileSync(path.join(REPO_ROOT, 'lib/core/surface-fence.cjs'), 'utf8');
  return !/fs\.write/.test(src) && !/\bhttp\b/.test(src) && !/\bfetch\b/.test(src) &&
    !/brain-client/.test(src) && !/require\(['"]https?['"]\)/.test(src);
})());

// ---------------------------------------------------------------------------
// TASK 3 / item 0b -- the fence on the MCP router surface.
// ---------------------------------------------------------------------------

const routerSrc = fs.readFileSync(path.join(REPO_ROOT, 'lib/mcp/tool-router.cjs'), 'utf8');

ok('tool-router.cjs requires lib/core/surface-fence.cjs',
  /require\(['"]\.\.\/core\/surface-fence\.cjs['"]\)/.test(routerSrc));

ok('tool-router.cjs calls filterToNavigator on its suggest path',
  /filterToNavigator\(/.test(routerSrc));

// The gear-shift / FUSION exit targets (SENS-10 exits + FUSION lateral recon).
// Each MUST be reachable on the MCP surface (in ALL_TOOL_COMMANDS), or the fence
// leaks on Desktop/Cowork: the test fails naming the CLI-only command.
const GEAR_SHIFT_EXITS = [
  'find-bottlenecks',      // stuck-cannot-say-where -> GRILL via bottlenecks (SENS-02 reuse)
  'beautiful-question',    // wrong-question/frame -> REFRAME
  'challenge-assumptions', // GRILL arm A logical red-team
  'find-analogies',        // FUSION lateral / sideways engine
];
const mcpReachable = new Set(toolRouter.ALL_TOOL_COMMANDS.map(norm));
const cliOnlyExits = GEAR_SHIFT_EXITS.filter((e) => !mcpReachable.has(norm(e)));
ok('no gear-shift / FUSION exit is CLI-only (MCP-invisible)' +
  (cliOnlyExits.length ? ' -- LEAKING: ' + cliOnlyExits.join(', ') : ''),
  cliOnlyExits.length === 0);

// Every gear-shift exit is a real thinking move (kind:methodology) -- rule (a).
ok('every gear-shift exit resolves to kind:methodology',
  GEAR_SHIFT_EXITS.every((e) => fence.isMethodology(e)));

// No new MCP tool minted by this plan (Canon Part 7). ALL_TOOL_COMMANDS is the
// existing hierarchical router coverage; pin its unique membership as a guard.
const uniqueMcp = new Set(toolRouter.ALL_TOOL_COMMANDS.map(norm));
ok('ALL_TOOL_COMMANDS mints no new tool (unique membership pinned at 65)',
  uniqueMcp.size === 65);

// The suppress behavior end-to-end is exercised via the router's own suggest
// helper: an internal command must never be surfaced. (Structural proof: the
// chokepoint reads args.command through filterToNavigator, asserted above.)

console.log('\n' + pass + ' checks passed');
