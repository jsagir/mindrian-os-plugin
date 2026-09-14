#!/usr/bin/env node
'use strict';

/*
 * scripts/check-layer-declaration.cjs
 *
 * Phase 344 Plan 02 (LAYER-04, LAYER-05): the layer-declaration gate.
 *
 * THE ONE QUESTION THIS GATE ANSWERS: does every invocable surface declare an
 * in-vocabulary engineering layer, drawing only from the closed vocabulary
 * shipped in data/layer-declaration-schema.json?
 *
 * Canon Part 7 (Reuse Before Build): this gate IMPORTS collectSurfaces() and
 * parseFrontmatter() from scripts/check-shape-declaration.cjs rather than
 * re-walking the four invocable surface classes (commands, agents, pipeline
 * CHAIN.md files, qualifying skill SKILL.md files) or re-implementing the
 * repo's own frontmatter reader. It also imports
 * listMcpToolConnectorDescriptors() from scripts/build-connector-registry.cjs,
 * the same MCP-tool discovery scripts/check-shape-declaration.cjs itself
 * mirrors at its own lines 741-767.
 *
 * EXIT CONTRACT -- a deliberate deviation from check-shape-declaration.cjs's
 * own advisory-by-default posture. That gate has been WARN-and-exit-0 since
 * Phase 210, and carries 53 open advisory WARN-level conflicts today (see
 * CLAUDE.md's Canon Part 11 entry). A brand-new signal folded into that
 * stream would be born unread. This gate is FAIL CLOSED, with no --strict
 * opt-out: an undeclared surface, a surface declaring a value outside the
 * closed vocabulary, or a `none` declaration with no `layer_why`, all exit 1
 * unconditionally. A missing or unreadable schema file is also a hard
 * failure, never a silent pass (the schema's own default_on_miss contract).
 *
 * Test seam (CHECK_LAYER_DECLARATION_ROOT): points the markdown-surface walk
 * at a synthetic tree. collectSurfaces() (imported from
 * check-shape-declaration.cjs) reads its OWN env var,
 * CHECK_SHAPE_DECLARATION_ROOT, not this one. resolveScanRoot() below
 * resolves CHECK_LAYER_DECLARATION_ROOT, then collectDeclaringSurfaces()
 * temporarily sets process.env.CHECK_SHAPE_DECLARATION_ROOT to that same
 * resolved value before calling collectSurfaces(), restoring the previous
 * value immediately afterward in a finally block. This hand-off is the one
 * place the two gates share mutable state.
 *
 * MCP tool descriptors are discovered from the REAL repository only, never
 * from a synthetic root: scripts/build-connector-registry.cjs's own MCP
 * discovery has no root-override seam (it reads lib/mcp/tools/ directly), and
 * a synthetic test tree has no MCP tool modules to discover in the first
 * place. So when CHECK_LAYER_DECLARATION_ROOT is set, this gate scopes its
 * denominator to the four markdown classes only; when it is unset (the
 * default, real-repo run), the denominator adds the MCP connector
 * descriptors on top, matching this file's own declaration_homes contract in
 * data/layer-declaration-schema.json.
 *
 * A second, narrower test seam, LAYER_DECLARATION_SCHEMA_PATH, overrides
 * where the closed vocabulary is read from, so the missing-schema failure
 * mode is testable without touching the real repo's own schema file.
 *
 * Canon Part 8 (The Graph Boundary): LOCAL-only. node:fs + node:path only.
 * Zero network, zero Brain reach, zero room access, zero database open.
 *
 * House rule: hyphens only, no em-dashes, no emoji. CJS, process.argv
 * routing only (no Commander, no yargs).
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_SCHEMA_PATH = path.join(REPO_ROOT, 'data', 'layer-declaration-schema.json');

const { collectSurfaces, parseFrontmatter } = require('./check-shape-declaration.cjs');

// ---------------------------------------------------------------------------
// loadMcpToolDescriptors() -- mirrors the silent-skip-on-load-failure
// discipline scripts/check-shape-declaration.cjs already applies to the same
// discovery call.
// ---------------------------------------------------------------------------
function loadMcpToolDescriptors() {
  try {
    const gen = require('./build-connector-registry.cjs');
    return typeof gen.listMcpToolConnectorDescriptors === 'function'
      ? gen.listMcpToolConnectorDescriptors()
      : [];
  } catch (_e) {
    return [];
  }
}

// ---------------------------------------------------------------------------
// resolveScanRoot() -- mirrors check-shape-declaration.cjs's own
// resolveScanRoot(), under this gate's own env var name.
// ---------------------------------------------------------------------------
function resolveScanRoot() {
  const env = process.env.CHECK_LAYER_DECLARATION_ROOT;
  if (typeof env === 'string' && env.trim() !== '') return path.resolve(env.trim());
  return REPO_ROOT;
}

function usingTestRoot() {
  const env = process.env.CHECK_LAYER_DECLARATION_ROOT;
  return typeof env === 'string' && env.trim() !== '';
}

function resolveSchemaPath() {
  const env = process.env.LAYER_DECLARATION_SCHEMA_PATH;
  if (typeof env === 'string' && env.trim() !== '') return path.resolve(env.trim());
  return DEFAULT_SCHEMA_PATH;
}

// ---------------------------------------------------------------------------
// loadLayerSchema() -- reads the closed vocabulary. A missing file, or a file
// that is not valid JSON, or a file with no _doc.layer_vocabulary array, is a
// fatal -- never a silent pass.
// ---------------------------------------------------------------------------
function loadLayerSchema() {
  const schemaPath = resolveSchemaPath();
  const relPath = path.relative(REPO_ROOT, schemaPath) || schemaPath;

  if (!fs.existsSync(schemaPath)) {
    return { fatal: relPath + ' is missing -- cannot validate any surface without the closed layer vocabulary' };
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  } catch (e) {
    return { fatal: relPath + ' is not valid JSON: ' + (e && e.message ? e.message : String(e)) };
  }

  const doc = parsed && parsed._doc;
  const vocab = doc && Array.isArray(doc.layer_vocabulary) ? doc.layer_vocabulary : null;
  if (!vocab || vocab.length === 0) {
    return { fatal: relPath + ' carries no _doc.layer_vocabulary array' };
  }

  return { vocabulary: vocab };
}

// ---------------------------------------------------------------------------
// collectDeclaringSurfaces() -- the denominator. The four markdown classes
// via collectSurfaces() (handed off through the CHECK_SHAPE_DECLARATION_ROOT
// seam above), plus MCP tool connector descriptors when scanning the real
// repo. Returns [{ surface, klass, fm }], klass one of
// command|agent|pipeline|skill|mcp-tool.
// ---------------------------------------------------------------------------
function collectDeclaringSurfaces() {
  const root = resolveScanRoot();
  const prevShapeRoot = process.env.CHECK_SHAPE_DECLARATION_ROOT;
  let markdownSurfaces;
  try {
    if (usingTestRoot()) {
      process.env.CHECK_SHAPE_DECLARATION_ROOT = root;
    }
    markdownSurfaces = collectSurfaces();
  } finally {
    if (prevShapeRoot === undefined) delete process.env.CHECK_SHAPE_DECLARATION_ROOT;
    else process.env.CHECK_SHAPE_DECLARATION_ROOT = prevShapeRoot;
  }

  const out = [];
  for (const s of markdownSurfaces) {
    let text = '';
    try {
      text = fs.readFileSync(s.file, 'utf8');
    } catch (_e) {
      text = '';
    }
    out.push({ surface: s.surface, klass: s.klass, fm: parseFrontmatter(text) });
  }

  if (!usingTestRoot()) {
    const mcpDescriptors = loadMcpToolDescriptors();
    for (const c of mcpDescriptors) {
      const tool =
        typeof c.tool === 'string' && c.tool
          ? c.tool
          : typeof c.surface === 'string' && c.surface
            ? c.surface
            : 'unknown';
      out.push({
        surface: 'mcp:' + tool,
        klass: 'mcp-tool',
        fm: {
          layer: typeof c.layer === 'string' ? c.layer : undefined,
          layer_why: typeof c.layer_why === 'string' ? c.layer_why : undefined,
          connector: c.connector,
        },
      });
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// checkSurface(entry, vocabulary) -- the per-surface predicate.
//
// The skill exemption rule (docs/LAYER-DECLARATION-CONTRACT.md, mirroring
// R16's own exemption rule verbatim): a skill whose frontmatter carries
// connector.excluded: true with a non-empty reason is exempt, counted in its
// own bucket, never in undeclared.
// ---------------------------------------------------------------------------
function checkSurface(entry, vocabulary) {
  const fm = entry.fm || {};

  if (entry.klass === 'skill') {
    const conn = fm.connector;
    if (
      conn &&
      typeof conn === 'object' &&
      !Array.isArray(conn) &&
      conn.excluded === true &&
      typeof conn.reason === 'string' &&
      conn.reason.trim() !== ''
    ) {
      return { surface: entry.surface, klass: entry.klass, status: 'exempt', layer: null };
    }
  }

  const layer = typeof fm.layer === 'string' && fm.layer.trim() !== '' ? fm.layer.trim() : null;

  if (layer === null) {
    return {
      surface: entry.surface,
      klass: entry.klass,
      status: 'undeclared',
      layer: null,
      message: entry.surface + ' (' + entry.klass + '): no layer declared',
    };
  }

  if (!vocabulary.includes(layer)) {
    return {
      surface: entry.surface,
      klass: entry.klass,
      status: 'invalid',
      layer,
      message: entry.surface + ' (' + entry.klass + '): layer "' + layer + '" is outside the closed vocabulary',
    };
  }

  if (layer === 'none') {
    const why = typeof fm.layer_why === 'string' ? fm.layer_why.trim() : '';
    if (why === '') {
      return {
        surface: entry.surface,
        klass: entry.klass,
        status: 'missing_why',
        layer,
        message: entry.surface + ' (' + entry.klass + '): layer "none" requires a non-empty layer_why, which is missing',
      };
    }
  }

  return { surface: entry.surface, klass: entry.klass, status: 'declared', layer };
}

// ---------------------------------------------------------------------------
// checkTree() -- the whole-tree sweep. Counts are always computed from the
// enumeration above; no count is ever a literal in this file.
// ---------------------------------------------------------------------------
function checkTree() {
  const schema = loadLayerSchema();
  if (schema.fatal) {
    return {
      ok: false,
      fatal: schema.fatal,
      total: 0,
      declared: 0,
      undeclared: 0,
      exempt: 0,
      byLayer: {},
      byClass: {},
      violations: [],
    };
  }

  const surfaces = collectDeclaringSurfaces();
  const results = surfaces.map((s) => checkSurface(s, schema.vocabulary));

  const byLayer = {};
  for (const v of schema.vocabulary) byLayer[v] = 0;
  const byClass = {};

  let declared = 0;
  let undeclared = 0;
  let exempt = 0;
  const violations = [];

  for (const r of results) {
    byClass[r.klass] = (byClass[r.klass] || 0) + 1;

    if (r.status === 'exempt') {
      exempt += 1;
      continue;
    }
    if (r.status === 'declared') {
      declared += 1;
      if (Object.prototype.hasOwnProperty.call(byLayer, r.layer)) byLayer[r.layer] += 1;
      continue;
    }
    undeclared += 1;
    violations.push(r.message);
  }

  return {
    ok: violations.length === 0,
    fatal: null,
    total: results.length,
    declared,
    undeclared,
    exempt,
    byLayer,
    byClass,
    violations,
  };
}

function printJson(report) {
  process.stdout.write(
    JSON.stringify({
      total: report.total,
      declared: report.declared,
      undeclared: report.undeclared,
      exempt: report.exempt,
      by_layer: report.byLayer,
      by_class: report.byClass,
    }) + '\n'
  );
}

function printClassSummary(byClass) {
  return Object.keys(byClass)
    .sort()
    .map((k) => k + '=' + byClass[k])
    .join(', ');
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('--help')) {
    console.log('usage: node scripts/check-layer-declaration.cjs [--json | --help]');
    console.log('');
    console.log('Answers one question: does every invocable surface declare an in-vocabulary engineering layer?');
    console.log('Fail closed: exits 1 on any undeclared surface, out-of-vocabulary value, or a "none" declaration missing layer_why.');
    console.log('The denominator is enumerated from disk at check time, never a frozen literal.');
    return;
  }

  const report = checkTree();

  if (report.fatal) {
    console.error(report.fatal);
    process.exit(1);
    return;
  }

  if (argv.includes('--json')) {
    printJson(report);
    process.exit(report.ok ? 0 : 1);
    return;
  }

  if (report.ok) {
    console.log(
      'OK: ' +
        report.total +
        ' surfaces enumerated, ' +
        report.declared +
        ' declared, ' +
        report.exempt +
        ' exempt (by class: ' +
        printClassSummary(report.byClass) +
        ')'
    );
    process.exit(0);
    return;
  }

  for (const line of report.violations) {
    console.log(line);
  }
  process.exit(1);
}

if (require.main === module) {
  main();
}

module.exports = {
  resolveScanRoot,
  loadLayerSchema,
  collectDeclaringSurfaces,
  checkSurface,
  checkTree,
  main,
};
