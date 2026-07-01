#!/usr/bin/env node
'use strict';

/*
 * Phase 178-02 - the DETERMINISTIC, code-evaluated card-emission predicate (C-2)
 * + the --check fail-closed exit contract (C-3 begins here).
 *
 * This is the distinct render-plane GATE (D-178-01: the deliverable is the GATE,
 * not a contract test). It READS the SEPARATE render registry minted in 178-01
 * (data/render-coverage-registry.json -- a DIFFERENT keyspace from the connector
 * ledger, which this gate NEVER touches) and answers, for every entry declared
 * 'card-emission', a single binary question by PURE CODE:
 *
 *     "Does this card-emission entry point route through the SEED-020 single
 *      card-emission door?"
 *
 * C-2: the verdict is a PURE CODE PREDICATE over the registry + the dispatcher
 * card-emission wiring. The hard gate runs NO inference and consults NO agent (any
 * soft-quality adjudication is reserved for the soft tier, never the hard verdict).
 * The gate is therefore CI-stable and reproducible: same registry + same wiring ->
 * same verdict, no network, no agent in the loop.
 *
 * THE PINNED PREDICATE (MEDIUM-1). An entry classifies COVERED if ANY of:
 *   (a) its file contains a real `pickShape(` call site -- the dispatcher's
 *       isFShape host-append (selector-dispatcher.cjs:931-933) unconditionally
 *       appends the askuserquestion_marker to every result whose shape starts with
 *       'F', so any path that returns through pickShape for an F.* shape is
 *       host-appended and COVERED;
 *   (b) its file contains a real `appendAskUserQuestionTrailer(` call site -- the
 *       engine-arm direct-call pattern (scripts/intent-classifier.cjs:933 applies
 *       the trailer onto the dial render output, then reads askuserquestion_marker);
 *   (c) it is a renderDial-kind entry whose render carries shape 'F.7-dial' -- the
 *       dial shape starts with 'F', so it is host-appended (by the pickShape
 *       isFShape branch on the path that returns it, and by the 150.5 engine-arm
 *       seam that threads its askuserquestion_marker into the turn block). This
 *       credits the HOST-APPENDED marker as COVERED and does NOT demand an
 *       in-renderDialShape marker assignment (MEDIUM-1): the dial renderer
 *       (lib/hmi/dial-presenter.cjs renderDial / lib/hmi/dial-selector.cjs
 *       renderDialShape) deliberately does not assign the marker itself; the marker
 *       is host-appended downstream, which is exactly the SEED-020 single
 *       construction door this gate verifies. intent-classifier.cjs (also a
 *       renderDial entry) ALSO satisfies (b) directly.
 *
 * The (a)/(b) scan is string-only over the ENTRY POINT'S OWN FILE (no cross-file
 * inference, no AST, no LLM, no network); the (c) branch keys on the registry's own
 * deterministic kind=renderDial + shape=F.7-dial fields (the registry is derived by
 * the 178-01 exhaustive walk, so it is itself code-evaluated, not hand-listed).
 *
 * A render-only-excluded entry (declared in 178-01's registry WITH its required
 * reason) is conformant WITHOUT routing. Any card-emission entry that matches NONE
 * of (a)/(b)/(c) is a render GAP -- and --check exits NON-ZERO, naming the entry and
 * a recovery line (fail closed).
 *
 * The live registry baseline (178-01) is gap=0: every non-renderDial card-emission
 * entry calls pickShape (branch a), the engine-arm entry calls
 * appendAskUserQuestionTrailer (branch b), and the dial renderer entry is
 * host-appended by construction (branch c). A clean repo exits 0 immediately. The
 * GAP behavior is exercised on a SYNTHESIZED entry by the FLOOR/hard-fail test
 * (tests/test-render-coverage-gate-hardfail.cjs), never on a live entry.
 *
 * Canon Part 8 (The Graph Boundary): LOCAL-only. Reads the registry + source files;
 * makes ZERO Brain reads/writes and ZERO network calls; runs no inference and
 * consults no agent anywhere in --check. The gate opens no remote wire and loads no
 * Brain module.
 *
 * Additive only (D-178-04): no reach/posture/edge/node minted; Part 3 frozen
 * contracts (MAX_K=3, DIAL_REACH_K=6, the 0.70/0.15 gate, the 6-reach bank, the
 * glyphs) untouched; the connector ledger byte-stable; no Brain wire.
 *
 * Usage:
 *   node scripts/check-render-coverage.cjs
 *       print the render-coverage report (covered / excluded / gap counts)
 *   node scripts/check-render-coverage.cjs --check
 *       STALE byte-compare of data/render-coverage-registry.json (regenerate in
 *       memory, fail if drifted) AND the render GAP hard-fail loop ; exit 1 on any
 *       gap or stale registry with a self-naming error + recovery line ; on clean,
 *       print 'render-coverage: OK' exit 0
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(REPO_ROOT, 'data', 'render-coverage-registry.json');

// The 178-01 generator: reused for the STALE byte-compare (regenerate the registry
// in memory and compare to the on-disk file). Part 7 reuse; the gate never forks the
// walk. This require pulls in pure code only (the generator is Part-8 LOCAL-only).
const generator = require('./build-render-coverage.cjs');

// ---------------------------------------------------------------------------
// Phase 188-03 (SFS-10 code half) - the PER-SHAPE coverage predicate.
// ===========================================================================
// The per-entry-point loop above answers "does every card-emission ENTRY POINT
// route through the door?". This second predicate answers the ORTHOGONAL born-wired
// question (Canon Part 11): "does every canonical SHAPE have a renderer AND a
// dispatch branch?" -- so a bespoke shape can never ship without routing through the
// single door.
//
// The CLOSED CANONICAL TEN (Open Question 3): the vocabulary is F.0..F.9. F.7-dial is
// F.7's RENDER PATH, NOT a separate shape -- so it is NOT a member here (do not drive
// this set off the dispatcher's F_SUBSHAPES, which mixes the F.7-dial variant).
const CANONICAL_SHAPES = Object.freeze(['F.0', 'F.1', 'F.2', 'F.3', 'F.4', 'F.5', 'F.6', 'F.7', 'F.8', 'F.9']);

// WAVE-ORDER gate (Pitfall 6): the ASSERTION set. 188-03 asserted F.0-F.7 ONLY while
// the F.8 (188-06) and F.9 (188-07) renderers + dispatch branches were still unbuilt.
// Both have now landed, so 188-07 FLIPS this to the FULL closed ten F.0-F.9: every
// canonical shape now resolves a renderer module AND a `requestedShape === 'F.x'`
// dispatch branch, and the per-shape gate is fully GREEN over the complete set.
const SHAPES_UNDER_ASSERTION = Object.freeze(CANONICAL_SHAPES.slice());

// The shape -> renderer-module map. Each canonical shape resolves to the module the
// dispatcher safeRequires for it (selector-dispatcher.cjs:681-771). F.7 = the DIAL
// render path (dial-selector.cjs::renderDialShape) per Open Question 3; F.8/F.9 point
// at their not-yet-authored renderers (absent today, which is why they are gated OUT
// of SHAPES_UNDER_ASSERTION until 188-07).
const SHAPE_RENDERER_MODULE = Object.freeze({
  'F.0': 'lib/hmi/shape-f0-renderer.cjs',
  'F.1': 'lib/hmi/shape-f1-renderer.cjs',
  'F.2': 'lib/hmi/shape-f2-renderer.cjs',
  'F.3': 'lib/hmi/shape-f3-renderer.cjs',
  'F.4': 'lib/hmi/shape-f4-renderer.cjs',
  'F.5': 'lib/hmi/shape-f5-renderer.cjs',
  'F.6': 'lib/hmi/shape-f6-renderer.cjs',
  'F.7': 'lib/hmi/dial-selector.cjs',
  'F.8': 'lib/hmi/shape-f8-renderer.cjs',
  'F.9': 'lib/hmi/shape-f9-renderer.cjs',
});

// The single dispatcher the per-shape branch check reads (read-only; 188-01 owns it).
const DISPATCHER_REL = 'lib/hmi/selector-dispatcher.cjs';

// resolveRegistryPath() -- the registry the gate reads. Defaults to the tracked
// REGISTRY_PATH. The RENDER_COVERAGE_REGISTRY env var lets the FLOOR/hard-fail test
// (tests/test-render-coverage-gate-hardfail.cjs) point --check at a SYNTHESIZED
// fixture registry under tests/fixtures/ so the gap path is exercised end-to-end on
// a synthesized dark entry WITHOUT ever mutating the tracked registry. The override
// is a LOCAL file path only -- it opens no wire and is irrelevant to the live CI
// path (which never sets it). When the override is active the STALE byte-compare is
// skipped (a synthetic fixture registry is not the derived live tree), leaving the
// gap hard-fail loop as the sole, faithful gate behavior.
function resolveRegistryPath() {
  const ov = process.env.RENDER_COVERAGE_REGISTRY;
  if (typeof ov === 'string' && ov.trim().length > 0) {
    return path.isAbsolute(ov) ? ov : path.join(REPO_ROOT, ov);
  }
  return REGISTRY_PATH;
}

// ---------------------------------------------------------------------------
// loadRegistry() -- read the render registry (the override-resolved path). Pure
// read; no network.
// ---------------------------------------------------------------------------
function loadRegistry() {
  const raw = fs.readFileSync(resolveRegistryPath(), 'utf8');
  return JSON.parse(raw);
}

// ---------------------------------------------------------------------------
// hasCallSite(fileRel, token) -- reuse the 178-01 generator's comment-aware,
// regex-literal-aware call-site detector over the entry point's OWN file. TRUE when
// the file contains a real `<token>(` invocation on a non-comment line. This is the
// SAME detector that derived the registry, so the predicate and the registry agree
// by construction. Returns false (never throws) on a missing/unreadable file.
// ---------------------------------------------------------------------------
function hasCallSite(fileRel, token) {
  const abs = path.join(REPO_ROOT, fileRel.split('/').join(path.sep));
  let src;
  try {
    src = fs.readFileSync(abs, 'utf8');
  } catch (_e) {
    return false;
  }
  return generator.hasCallSite(src, token);
}

// ---------------------------------------------------------------------------
// routesThroughCardEmissionDoor(entry) -- THE PINNED card-emission predicate.
// Pure code, deterministic, no LLM, no network. Returns true when the entry routes
// through the SEED-020 card-emission door via branch (a), (b), or (c) above.
// ---------------------------------------------------------------------------
function routesThroughCardEmissionDoor(entry) {
  const file = String(entry.entry || '');

  // (a) pickShape host-append: the file calls pickShape( -> the dispatcher isFShape
  //     branch host-appends the askuserquestion_marker to its F.* return.
  if (hasCallSite(file, 'pickShape')) return true;

  // (b) engine-arm direct call: the file calls appendAskUserQuestionTrailer(
  //     directly (the intent-classifier.cjs:933 pattern).
  if (hasCallSite(file, 'appendAskUserQuestionTrailer')) return true;

  // (c) renderDial host-append by construction: a renderDial-kind entry whose render
  //     carries shape 'F.7-dial' (starts with 'F') is host-appended downstream (the
  //     pickShape isFShape branch / the 150.5 engine-arm seam append the marker). The
  //     predicate credits the host-appended marker as COVERED without demanding an
  //     in-renderDialShape marker assignment (MEDIUM-1). Keys on the registry's own
  //     deterministic kind/shape fields (the registry is itself derived, not hand-
  //     listed), so this stays pure code.
  if (entry.kind === 'renderDial' && String(entry.shape || '').charAt(0) === 'F') return true;

  return false;
}

// ---------------------------------------------------------------------------
// renderCoverageReport() -- classify every registry entry into exactly one of
// covered / excluded / gap (the XOR invariant). Mirrors the connector coverageReport
// shape: { entries:[{entry, render_coverage, routed}], counts:{covered, excluded,
// gap}, errors:[] }. Pure: reads the registry + entry-point source files only.
// ---------------------------------------------------------------------------
function renderCoverageReport() {
  const reg = loadRegistry();
  const registryEntries = Array.isArray(reg.entries) ? reg.entries : [];

  const entries = [];
  const errors = [];
  let covered = 0;
  let excluded = 0;
  let gap = 0;

  for (const e of registryEntries) {
    const out = {
      entry: e.entry,
      kind: e.kind,
      render_coverage: e.render_coverage,
    };
    if (e.shape) out.shape = e.shape;

    if (e.render_coverage === 'render-only-excluded') {
      // A render-only-excluded entry is conformant WITHOUT routing -- but only if it
      // carries its required reason (the 178-01 generator already fails closed on a
      // reasonless exclusion; this is the gate-side restatement of that contract).
      out.routed = false;
      if (typeof e.reason === 'string' && e.reason.trim().length > 0) {
        excluded += 1;
      } else {
        errors.push(
          'RENDER EXCLUSION ERROR: entry ' + e.entry + ' is render-only-excluded but ' +
            'carries no reason; add a reason or wire it through the card-emission door'
        );
        // An exclusion with no reason is not conformant; count it as a gap so the XOR
        // invariant holds and the gate fails closed.
        out.routed = false;
        gap += 1;
      }
      entries.push(out);
      continue;
    }

    // card-emission: evaluate the pinned predicate.
    const routed = routesThroughCardEmissionDoor(e);
    out.routed = routed;
    if (routed) {
      covered += 1;
    } else {
      gap += 1;
      errors.push(
        'RENDER GAP: entry ' + e.entry + ' is declared card-emission but does not ' +
          'route through the card-emission door; route it through ' +
          'pickShape/appendAskUserQuestionTrailer or declare it render-only-excluded ' +
          'with a reason'
      );
    }
    entries.push(out);
  }

  return {
    entries,
    counts: { covered, excluded, gap },
    errors,
  };
}

// ---------------------------------------------------------------------------
// hasDispatchBranch(dispatcherSrc, shape) -- comment-aware detector for a
// `requestedShape === 'F.x'` dispatch branch. Mirrors the generator's hasCallSite
// comment-awareness (skip `//` / `*` / `/*` lines, strip a trailing line comment)
// so a doc-mention of `requestedShape:'F.7'` in a comment never counts as a live
// branch. Pure string scan over the dispatcher source; zero I/O here. The literal
// closing quote after the shape token keeps `F.7` from matching `F.7-dial`.
// ---------------------------------------------------------------------------
function hasDispatchBranch(dispatcherSrc, shape) {
  const escaped = String(shape).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('requestedShape\\s*===\\s*[\'"]' + escaped + '[\'"]');
  for (const rawLine of String(dispatcherSrc).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) continue;
    const code = rawLine.replace(/\/\/.*$/, '');
    if (re.test(code)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// resolvePerShapeSet(opts) -- the shapes the per-shape predicate asserts over.
// Precedence: explicit opts.shapes > the PER_SHAPE_COVERAGE_SHAPES env override
// (comma list; the FLOOR/hard-fail test injects a synthetic missing shape this way
// WITHOUT mutating a tracked file, mirroring the RENDER_COVERAGE_REGISTRY idiom) >
// SHAPES_UNDER_ASSERTION (F.0-F.7 this plan; F.0-F.9 after 188-07).
// ---------------------------------------------------------------------------
function resolvePerShapeSet(opts) {
  if (opts && Array.isArray(opts.shapes) && opts.shapes.length > 0) {
    return opts.shapes.slice();
  }
  const env = process.env.PER_SHAPE_COVERAGE_SHAPES;
  if (typeof env === 'string' && env.trim().length > 0) {
    return env.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  }
  return SHAPES_UNDER_ASSERTION.slice();
}

// ---------------------------------------------------------------------------
// perShapeCoverageReport({ shapes?, dispatcherRel? }) -- the PER-SHAPE predicate
// (the 188-00 stub contract). For each shape in the resolved set, a shape is a GAP
// iff it lacks (1) a resolvable renderer module OR (2) a `requestedShape === 'F.x'`
// dispatch branch in selector-dispatcher.cjs. Returns { shapes, gaps:[{shape,
// reason}], ok }. Pure code: reads the dispatcher source + existsSync checks the
// mapped renderer module; ZERO Brain, ZERO network (Canon Part 8).
// ---------------------------------------------------------------------------
function perShapeCoverageReport(opts) {
  opts = opts || {};
  const shapes = resolvePerShapeSet(opts);
  const dispatcherRel =
    typeof opts.dispatcherRel === 'string' && opts.dispatcherRel.length > 0
      ? opts.dispatcherRel
      : DISPATCHER_REL;

  let dispatcherSrc = '';
  try {
    dispatcherSrc = fs.readFileSync(
      path.join(REPO_ROOT, dispatcherRel.split('/').join(path.sep)),
      'utf8'
    );
  } catch (_e) {
    dispatcherSrc = '';
  }

  const gaps = [];
  for (const shape of shapes) {
    const moduleRel = SHAPE_RENDERER_MODULE[shape] || null;
    const hasRenderer = moduleRel
      ? fs.existsSync(path.join(REPO_ROOT, moduleRel.split('/').join(path.sep)))
      : false;
    const hasBranch = hasDispatchBranch(dispatcherSrc, shape);

    if (!hasRenderer || !hasBranch) {
      const missing = [];
      if (!hasRenderer) {
        missing.push(
          moduleRel
            ? 'no resolvable renderer module (' + moduleRel + ')'
            : 'no renderer module mapped for shape ' + shape
        );
      }
      if (!hasBranch) {
        missing.push("no requestedShape === '" + shape + "' dispatch branch in " + dispatcherRel);
      }
      gaps.push({ shape, reason: missing.join('; ') });
    }
  }

  return { shapes, gaps, ok: gaps.length === 0 };
}

// ---------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------
function main() {
  const argv = process.argv.slice(2);

  // --check-shapes: the PER-SHAPE born-wired gate (SFS-10 code half). Exits 1 on any
  // shape gap (missing renderer OR missing dispatch branch) with a self-naming error
  // + a recovery line; on clean, prints the asserted set and exits 0. This is
  // ORTHOGONAL to --check (the per-entry-point registry gate) and does not read the
  // render registry at all.
  if (argv.includes('--check-shapes')) {
    const shapeReport = perShapeCoverageReport({});
    if (!shapeReport.ok) {
      for (const g of shapeReport.gaps) {
        console.error('SHAPE COVERAGE GAP: shape ' + g.shape + ' -- ' + g.reason);
      }
      console.error(
        'Recovery: add the shape renderer module + its `requestedShape === \'F.x\'` ' +
          'dispatch branch, or keep the shape out of SHAPES_UNDER_ASSERTION until its ' +
          'wave lands: node scripts/check-render-coverage.cjs --check-shapes'
      );
      process.exit(1);
    }
    console.log('render-coverage shapes: OK (' + shapeReport.shapes.join(', ') + ')');
    return;
  }

  const report = renderCoverageReport();

  if (argv.includes('--check')) {
    const errs = [];
    const usingOverride =
      typeof process.env.RENDER_COVERAGE_REGISTRY === 'string' &&
      process.env.RENDER_COVERAGE_REGISTRY.trim().length > 0;

    // The STALE byte-compare of data/render-coverage-registry.json: regenerate the
    // registry in memory via the 178-01 generator and fail if the on-disk file
    // drifted (a new render entry point appeared in code but is absent from the
    // registry, or the registry was hand-edited). Mirrors
    // build-connector-registry.cjs:813-818. Skipped under the test-only registry
    // override (a synthetic fixture registry is not the derived live tree, so a byte-
    // compare against it is meaningless; the gap hard-fail loop is the faithful gate).
    if (!usingOverride) {
      const reg = generator.buildRegistry();
      const next = generator.serializeRegistry(reg);
      const onDisk = fs.existsSync(REGISTRY_PATH) ? fs.readFileSync(REGISTRY_PATH, 'utf8') : '';
      if (onDisk !== next) {
        errs.push(
          'data/render-coverage-registry.json is STALE (a render entry point appeared ' +
            'in code but is absent from the registry, OR the registry drifted). ' +
            'Run: node scripts/build-render-coverage.cjs'
        );
      }
    }

    // The render GAP HARD-FAIL loop (Canon Part 11 render twin; C-3 begins). Each
    // gap entry already pushed a self-naming error into report.errors; fold them in.
    for (const e of report.errors) errs.push(e);

    if (errs.length) {
      console.error(errs.join('\n'));
      console.error('Recovery: regenerate the render registry or wire/exclude the surface: node scripts/build-render-coverage.cjs');
      process.exit(1);
    }

    console.log('render-coverage: OK');
    return;
  }

  // Default: print the report.
  console.log(
    'render-coverage report: ' +
      report.counts.covered + ' covered, ' +
      report.counts.excluded + ' excluded, ' +
      report.counts.gap + ' gap (' +
      report.entries.length + ' entries)'
  );
  if (report.errors.length) {
    for (const e of report.errors) console.error(e);
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main();
} else {
  module.exports = {
    resolveRegistryPath,
    loadRegistry,
    hasCallSite,
    routesThroughCardEmissionDoor,
    renderCoverageReport,
    // Phase 188-03 (SFS-10 code half): the per-shape predicate + its authoring seams.
    // 188-07 extends SHAPES_UNDER_ASSERTION to the full CANONICAL_SHAPES once the
    // F.8/F.9 renderers land.
    perShapeCoverageReport,
    hasDispatchBranch,
    CANONICAL_SHAPES,
    SHAPES_UNDER_ASSERTION,
    SHAPE_RENDERER_MODULE,
  };
}
