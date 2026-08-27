#!/usr/bin/env node
'use strict';

// Phase 265-16 (T-265-72/73/74). THE FINDING THIS TEST PINS: the MCP tool's
// `generate-personas` action was serving deterministic template output as if
// it were the six-agent `/mos:persona --parallel` analysis, with zero signal
// to the caller that the two were not equivalent, and the two surfaces had
// zero cross-references in either direction. This test pins the routing
// default (writes nothing), the preview labelling (stamps every file twice),
// the mode-typo fallback (never silently selects the weaker path), and the
// cross-link between the two surfaces.
//
// Plain Node script, no node:test. process.exit(1) on any failure.
// Hyphens only (no em-dashes).

const fs = require('fs');
const path = require('path');
const os = require('os');

const ROOT = path.resolve(__dirname, '..');
const personaOps = require(path.join(ROOT, 'lib/core/persona-ops.cjs'));

let pass = 0;
let fail = 0;
const failedArms = [];

function ok(cond, msg, armLabel) {
  if (cond) {
    pass++;
    console.log('  ok   - ' + msg);
  } else {
    fail++;
    failedArms.push(armLabel + ': ' + msg);
    console.log('  FAIL - ' + msg);
  }
}

// ---------------------------------------------------------------------------
// Fixture room builder: a throwaway room under os.tmpdir() with STATE.md and
// N populated section directories carrying real-looking artifact text.
// ---------------------------------------------------------------------------
function buildFixtureRoom(sectionCount) {
  const roomDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-265-persona-'));
  fs.writeFileSync(
    path.join(roomDir, 'STATE.md'),
    '---\nventure: Test Venture\nstage: seed\n---\n\n# Test Venture\n\nA test venture for the persona routing test.\n'
  );
  const sectionNames = ['problem-definition', 'market-analysis', 'solution-design'];
  for (let i = 0; i < sectionCount; i++) {
    const sectionDir = path.join(roomDir, sectionNames[i]);
    fs.mkdirSync(sectionDir, { recursive: true });
    fs.writeFileSync(
      path.join(sectionDir, 'notes.md'),
      '# ' + sectionNames[i] + '\n\nThis is real-looking artifact text describing ' + sectionNames[i] + ' for the fixture room.\n'
    );
  }
  return roomDir;
}

function main() {
  console.log('--- test-265-persona-route ---');

  // -------------------------------------------------------------------------
  // Arm 1: DEFAULT ROUTES. generatePersonas(roomDir) with one argument
  // returns routed:true and writes NOTHING. The directory-absence assertion
  // is load-bearing: it proves the default has zero side effect.
  // -------------------------------------------------------------------------
  let room1;
  try {
    room1 = buildFixtureRoom(2);
    const result = personaOps.generatePersonas(room1);
    ok(result && result.routed === true, 'default arm: routed === true', 'arm1');
    ok(result && result.route_to === '/mos:persona --parallel', 'default arm: route_to is /mos:persona --parallel', 'arm1');
    ok(fs.existsSync(path.join(room1, 'personas')) === false, 'default arm: no personas/ directory created (zero side effect)', 'arm1');
  } finally {
    if (room1) fs.rmSync(room1, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // Arm 2: PREVIEW STAMPS. generatePersonas(roomDir, {mode:'preview'}) writes
  // six files, every one stamped with preview_notice: in frontmatter AND
  // PREVIEW_NOTICE's exact text in the body. DISCLAIMER still present too.
  // -------------------------------------------------------------------------
  let room2;
  try {
    room2 = buildFixtureRoom(2);
    const result = personaOps.generatePersonas(room2, { mode: 'preview' });
    ok(result && result.preview === true, 'preview arm: preview === true', 'arm2');
    ok(result && result.notice === personaOps.PREVIEW_NOTICE, 'preview arm: notice === PREVIEW_NOTICE', 'arm2');
    ok(Array.isArray(result.generated) && result.generated.length === 6, 'preview arm: 6 files generated', 'arm2');
    const personasDir = path.join(room2, 'personas');
    for (const filename of result.generated || []) {
      const content = fs.readFileSync(path.join(personasDir, filename), 'utf-8');
      const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const frontmatter = fmMatch ? fmMatch[1] : '';
      // The body is everything AFTER the closing frontmatter fence. Checking
      // PREVIEW_NOTICE against the body slice (not the whole file) is
      // load-bearing: PREVIEW_NOTICE also appears inside the frontmatter's
      // quoted preview_notice: value, so a whole-file .includes() would pass
      // even if the body insertion were removed.
      const body = fmMatch ? content.slice(fmMatch[0].length) : content;
      ok(frontmatter.includes('preview_notice:'), filename + ': frontmatter contains preview_notice:', 'arm2');
      ok(body.includes(personaOps.PREVIEW_NOTICE), filename + ': body contains PREVIEW_NOTICE exact text', 'arm2');
      ok(content.includes('NOT professional advice'), filename + ': DISCLAIMER text still present (both notices coexist)', 'arm2');
    }
  } finally {
    if (room2) fs.rmSync(room2, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // Arm 3: PRECONDITION PARITY. Both modes fail identically: 1 populated
  // section returns the existing `sections` error and writes nothing; no
  // STATE.md returns the existing "No room STATE.md found" error.
  // -------------------------------------------------------------------------
  let room3a, room3b;
  try {
    room3a = buildFixtureRoom(1);
    const routeThin = personaOps.generatePersonas(room3a);
    const previewThin = personaOps.generatePersonas(room3a, { mode: 'preview' });
    ok(routeThin && routeThin.error && routeThin.sections === 1, 'thin room, route mode: existing sections error, sections===1', 'arm3');
    ok(previewThin && previewThin.error && previewThin.sections === 1, 'thin room, preview mode: existing sections error, sections===1', 'arm3');
    ok(fs.existsSync(path.join(room3a, 'personas')) === false, 'thin room: neither mode wrote a personas/ directory', 'arm3');

    room3b = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-265-persona-nostate-'));
    const routeNoState = personaOps.generatePersonas(room3b);
    const previewNoState = personaOps.generatePersonas(room3b, { mode: 'preview' });
    ok(routeNoState && routeNoState.error === 'No room STATE.md found', 'no STATE.md, route mode: existing error message', 'arm3');
    ok(previewNoState && previewNoState.error === 'No room STATE.md found', 'no STATE.md, preview mode: existing error message', 'arm3');
  } finally {
    if (room3a) fs.rmSync(room3a, { recursive: true, force: true });
    if (room3b) fs.rmSync(room3b, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // Arm 4: UNKNOWN MODE falls back to ROUTE. A mode typo must never silently
  // select the weaker (preview/write) path.
  // -------------------------------------------------------------------------
  let room4;
  try {
    room4 = buildFixtureRoom(2);
    const result = personaOps.generatePersonas(room4, { mode: 'nonsense' });
    ok(result && result.routed === true, 'unknown mode arm: falls back to routed === true', 'arm4');
    ok(fs.existsSync(path.join(room4, 'personas')) === false, 'unknown mode arm: no personas/ directory created', 'arm4');
  } finally {
    if (room4) fs.rmSync(room4, { recursive: true, force: true });
  }

  // -------------------------------------------------------------------------
  // Arm 5: CROSS-LINK. The two previously-disconnected surfaces now name
  // each other. Cheap text assertions, pins the finding that started this
  // plan.
  // -------------------------------------------------------------------------
  const routerSrc = fs.readFileSync(path.join(ROOT, 'lib/mcp/tool-router.cjs'), 'utf-8');
  const commandSrc = fs.readFileSync(path.join(ROOT, 'commands/persona.md'), 'utf-8');
  ok(routerSrc.includes('persona --parallel'), 'tool-router.cjs names persona --parallel', 'arm5');
  ok(commandSrc.includes('persona-ops'), 'commands/persona.md names persona-ops', 'arm5');

  console.log('');
  console.log('PASS=' + pass + ' FAIL=' + fail);
  if (fail > 0) {
    console.log('Failing arms: ' + failedArms.join('; '));
    process.exit(1);
  }
  process.exit(0);
}

main();
