'use strict';
/*
 * Phase 144.1-07 -- RETRO-04: the filing sweep.
 *
 * The contract this test enforces: every connector that DECLARES
 * filing: fileEvidenceWithReadback actually ROUTES its artifact writes through
 * the readback chokepoint -- no bare Write that bypasses the cascade and the
 * memory_event. A connector that declares fileEvidenceWithReadback but whose
 * command body still does a bare Write breaks the moat (cascade never fires, no
 * artifact_filed memory_event, the engine never sees the write). This sweep is
 * the contract that the DECLARATION matches the BEHAVIOR.
 *
 * Registry-driven (not a hardcoded list): the test builds the connector registry
 * IN-MEMORY via require("../scripts/build-connector-registry.cjs").buildRegistry()
 * so it does not depend on the on-disk regen ordering vs Plan 08, and so it
 * AUTO-COVERS every current AND future fileEvidenceWithReadback connector. When a
 * new surface declares the readback filing in its connector: frontmatter, this
 * sweep picks it up with no edit here.
 *
 * What "routes through the readback path" means (the PASS condition):
 *   A surface PASSES when its owning source file EITHER
 *     (a) references the readback chokepoint directly (fileEvidenceWithReadback),
 *         or its sanctioned fallback (wireAccept), OR
 *     (b) delegates filing to the intelligence-orchestrator -- the orchestrator
 *         owns the filing for sensor-routed surfaces (ORCH-03) and calls
 *         fileEvidenceWithReadback on the surface's behalf, reading the filing
 *         field from the generated registry.
 *   AND the surface does NOT do a bare Write to a room/** path outside that
 *   idiom (the FAIL heuristic below).
 *
 * The bare-Write FAIL heuristic (precise): a literal Write tool call writing a
 * room/** path in the surface body that is NOT inside the readback / wireAccept /
 * orchestrator-filing idiom. A surface that declares fileEvidenceWithReadback and
 * bare-Writes a room path bypasses the cascade -- that is the exact repudiation
 * threat (T-144.1-19) this sweep FAILs.
 *
 * Cascade + memory_event: routing through fileEvidenceWithReadback is what makes
 * the cascade fire and the artifact_filed memory_event get emitted -- the
 * readback module wires the INFORMS cascade edge inside its one
 * BEGIN/COMMIT/ROLLBACK transaction and the orchestrator filing path emits the
 * memory_event (per skills/intelligence-orchestrator/SKILL.md ORCH-03). Proving
 * the surface routes through the chokepoint IS proving cascade + memory_event
 * fire for that surface.
 *
 * Pure: no Brain, no network, no sqlite. Reads only the in-memory registry and
 * the surface source files on disk.
 *
 * NO em-dashes anywhere in this file (CLAUDE.md HARD RULE). Hyphens only.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

const { buildRegistry } = require(
  path.join(REPO_ROOT, 'scripts', 'build-connector-registry.cjs')
);

// The filing value this sweep is scoped to. A connector declaring this MUST
// route its writes through the readback chokepoint.
const READBACK_FILING = 'fileEvidenceWithReadback';

// resolveOwningFile(connector) -- map a connector entry to its owning source
// file on disk, mirroring the surface-id construction in
// build-connector-registry.cjs::buildRegistry():
//   command -> commands/<base>.md          (surface "/mos:<base>")
//   agent   -> agents/<base>.md            (surface "agent:<base>")
//   skill   -> skills/<base>/SKILL.md      (surface "skill:<base>")
// Returns an absolute path, or null if the source kind is unknown.
function resolveOwningFile(c) {
  const surface = typeof c.surface === 'string' ? c.surface : '';
  if (c.source === 'command') {
    const base = surface.replace(/^\/mos:/, '');
    return path.join(REPO_ROOT, 'commands', base + '.md');
  }
  if (c.source === 'agent') {
    const base = surface.replace(/^agent:/, '');
    return path.join(REPO_ROOT, 'agents', base + '.md');
  }
  if (c.source === 'skill') {
    const base = surface.replace(/^skill:/, '');
    return path.join(REPO_ROOT, 'skills', base, 'SKILL.md');
  }
  return null;
}

// routesThroughReadback(src) -- the PASS predicate. True when the surface body
// references the readback chokepoint, its sanctioned fallback, or delegates to
// the intelligence-orchestrator filing path. Any one of the three is sufficient
// because the orchestrator owns filing for sensor-routed surfaces.
function routesThroughReadback(src) {
  const hasReadback = /fileEvidenceWithReadback/.test(src);
  const hasWireAccept = /wireAccept/.test(src);
  const hasOrchestrator = /intelligence-orchestrator|reach dispatcher|the orchestrator files/i.test(src);
  return hasReadback || hasWireAccept || hasOrchestrator;
}

// bareWriteToRoom(src) -- the FAIL heuristic. Returns the offending snippet when
// the body contains a literal Write tool reference within 240 characters of a
// room/ path AND that proximity window does NOT also mention the readback /
// wireAccept / orchestrator idiom (so a Write described as going THROUGH the
// chokepoint is not a bare Write). Returns null when no bare Write is found.
function bareWriteToRoom(src) {
  const re = /\bWrite\b[\s\S]{0,240}?room\//g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const window = m[0];
    const inIdiom =
      /fileEvidenceWithReadback|wireAccept|intelligence-orchestrator|orchestrator/i.test(window);
    if (!inIdiom) {
      return window.replace(/\s+/g, ' ').slice(0, 120);
    }
  }
  return null;
}

let passed = 0;
let failed = 0;
const failures = [];

function pass(surface, note) {
  passed += 1;
  process.stdout.write('  PASS ' + surface + (note ? '  (' + note + ')' : '') + '\n');
}
function fail(surface, reason) {
  failed += 1;
  failures.push(surface + ': ' + reason);
  process.stdout.write('  FAIL ' + surface + '  -- ' + reason + '\n');
}

// ---------------------------------------------------------------------------
// The sweep.
// ---------------------------------------------------------------------------
function runSweep() {
  const reg = buildRegistry();
  const connectors = Array.isArray(reg.connectors) ? reg.connectors : [];

  const readbackConnectors = connectors.filter(
    (c) => c && c.filing === READBACK_FILING
  );

  process.stdout.write(
    'connector filing sweep (RETRO-04): ' +
      readbackConnectors.length +
      ' of ' +
      connectors.length +
      ' connectors declare filing: ' +
      READBACK_FILING +
      '\n\n'
  );

  if (readbackConnectors.length === 0) {
    // A registry with zero readback connectors is itself a regression: the
    // evidence-producing families are supposed to declare this filing. Surface
    // it loudly rather than passing vacuously.
    process.stdout.write(
      'FAIL: no connector declares filing: ' +
        READBACK_FILING +
        ' -- the evidence-producing families should declare it. Registry regression?\n'
    );
    process.exit(1);
    return;
  }

  for (const c of readbackConnectors) {
    const surface = c.surface || JSON.stringify(c);
    const file = resolveOwningFile(c);

    if (!file) {
      fail(surface, 'unknown source kind "' + c.source + '" (cannot resolve owning file)');
      continue;
    }
    if (!fs.existsSync(file)) {
      fail(surface, 'owning file does not exist: ' + path.relative(REPO_ROOT, file));
      continue;
    }

    let src;
    try {
      src = fs.readFileSync(file, 'utf8');
    } catch (e) {
      fail(surface, 'could not read owning file: ' + (e && e.message ? e.message : String(e)));
      continue;
    }

    // FAIL FIRST on a bare Write to a room path: that is the repudiation threat
    // (cascade bypassed, no memory_event), independent of whether the body also
    // happens to mention the idiom elsewhere.
    const bareWrite = bareWriteToRoom(src);
    if (bareWrite) {
      fail(
        surface,
        'declares ' + READBACK_FILING + ' but contains a bare Write to a room/ path outside the readback idiom: "' + bareWrite + '"'
      );
      continue;
    }

    // PASS when the body routes filing through the readback path (directly, via
    // the wireAccept fallback, or by delegating to the orchestrator filing).
    if (routesThroughReadback(src)) {
      const note = /fileEvidenceWithReadback/.test(src)
        ? 'references fileEvidenceWithReadback'
        : /wireAccept/.test(src)
          ? 'references wireAccept fallback'
          : 'delegates to orchestrator filing';
      pass(surface, note);
      continue;
    }

    // A surface that declares the readback filing but neither references the
    // chokepoint NOR delegates to the orchestrator has an unrouted declaration:
    // the declaration claims a filing path the body never invokes.
    fail(
      surface,
      'declares ' + READBACK_FILING + ' but the body neither references the readback chokepoint / wireAccept nor delegates to the intelligence-orchestrator filing'
    );
  }

  process.stdout.write('\n');
  process.stdout.write(
    'filing sweep: ' + passed + ' passed, ' + failed + ' failed (' + readbackConnectors.length + ' readback connectors)\n'
  );
  if (failed > 0) {
    process.stdout.write('\nOffending surfaces:\n');
    for (const f of failures) process.stdout.write('  - ' + f + '\n');
  }
  process.exit(failed === 0 ? 0 : 1);
}

runSweep();
