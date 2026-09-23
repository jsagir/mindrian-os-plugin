#!/usr/bin/env node
'use strict';
/*
 * tests/test-354-room-symlink-containment.cjs -- Phase 354-05 (SYS-01).
 *
 * Pins the P1 room-boundary seam named in 354-CONTEXT.md (CTX-SYMLINK):
 * lib/mcp/tool-router.cjs:145-151 checks section containment LEXICALLY
 * (path.resolve + startsWith), then lib/mcp/tools/views.cjs:206-207 writes
 * through the resolved filesystem path -- so an EXISTING room/research
 * symlink sends artifact_file's write outside the room even though the
 * lexical check passes (the symlink path itself is lexically inside the
 * room; only its realpath escapes). The same gap lets room://section/{name}
 * read outside (lib/mcp/resources.cjs), and reasoning-ops.cjs's read/write
 * sites take a caller-supplied section name with no containment check at
 * all. The two layers that disagree: the lexical string check versus the
 * realpath the read/write actually lands on.
 *
 * Seeded from docs/reviews/phase-354-probes/resources.cjs (McpServer +
 * Client over InMemoryTransport, registerResources, readResource for
 * several URIs) and docs/reviews/phase-354-probes/persistence.cjs's
 * artifact() probe (room/research symlink to an outside dir,
 * views._internal.fileArtifact). Read_first also covered lib/mcp/tool-
 * router.cjs:130-152 (SECTION_RE, safeResolveSection), lib/mcp/tools/
 * views.cjs:110-240/383-420, lib/mcp/resources.cjs:100-170/245-270,
 * lib/core/reasoning-ops.cjs:390-625, tests/helpers/fixture-room-354.cjs.
 *
 * Symlink policy (CTX-SYMLINK, decided in 354-05-PLAN.md): a directory
 * symlink inside a room is followed only when its realpath stays inside the
 * room's realpath; any section, destination or existing parent whose
 * realpath leaves the room is refused; the final file write never follows a
 * symlink leaf (atomic temp-file plus rename replaces the directory entry
 * instead of writing through it).
 *
 * Bounded, not re-opened (CTX-CORRECTED): percent-encoded traversal did not
 * escape through the SDK's own URI-template matcher (it does not decode
 * %2F before matching {sectionName} as a single opaque segment) -- case R4
 * pins this as a passing regression floor only, not a fix target.
 *
 * RED-PROOF (against the pre-fix code): W1 (write through an existing
 * symlinked section), R2 (SDK read of a symlinked room section), R3 (SDK
 * read of a symlinked reasoning section), O1 and O2 (reasoning-ops read and
 * write through a symlinked section) all fail. R1, R4, R5, W2's outside-
 * untouched half, and W3 are expected to already hold or degrade safely.
 *
 * Plain-Node harness (tests/test-354-chain-resume-identity.cjs shape):
 * assert, a local ok(label)/fail(label, error) counter pair, a leading log
 * of the test name, a trailing PASS/FAIL summary line, process.exitCode = 1
 * on any failure. No framework. Hyphens only, no em-dashes.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO = path.resolve(__dirname, '..');
const { makeScratchRoom } = require(path.join(__dirname, 'helpers', 'fixture-room-354.cjs'));
const { openRoomDb, closeRoomDb } = require(path.join(REPO, 'lib', 'core', 'room-db.cjs'));
const views = require(path.join(REPO, 'lib', 'mcp', 'tools', 'views.cjs'));
const reasoningOps = require(path.join(REPO, 'lib', 'core', 'reasoning-ops.cjs'));
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
const { registerResources } = require(path.join(REPO, 'lib', 'mcp', 'resources.cjs'));

console.log('test-354-room-symlink-containment');

let checks = 0;
let failed = 0;
function ok(label) {
  checks += 1;
  console.log('  ok - ' + label);
}
function fail(label, error) {
  failed += 1;
  console.log('  NOT OK - ' + label);
  console.log('    ' + (error && error.message ? error.message : String(error)));
}

const INSIDE_SYNTHETIC = 'INSIDE_SYNTHETIC';
const OUTSIDE_SYNTHETIC = 'OUTSIDE_SYNTHETIC';
const OUTSIDE_REASONING_SYNTHETIC = 'OUTSIDE_REASONING_SYNTHETIC';
const VICTIM_ORIGINAL = 'VICTIM_ORIGINAL';
const NEW_INSIDE = 'NEW_INSIDE';
const NOTES_LEGIT_SYNTHETIC = 'NOTES_LEGIT_SYNTHETIC';
const EVIL_SYNTHETIC = 'EVIL_SYNTHETIC';
const W3_CONTENT = 'W3_CONTENT';

/*
 * buildFixture() -- one shared scratch room per run, used by both the
 * write-side and read-side cases (R5 must observe the notes/victim.md
 * symlink BEFORE W2 replaces it, so every case below runs against the SAME
 * fixture instance in one fixed order rather than per-case fresh rooms).
 */
function buildFixture() {
  const { root, room, cleanup } = makeScratchRoom('containment');
  const roomName = path.basename(room);

  const outside = path.join(root, 'outside');
  const evilDir = path.join(root, roomName + '-evil');

  fs.mkdirSync(outside, { recursive: true });
  fs.writeFileSync(path.join(outside, 'note.md'), OUTSIDE_SYNTHETIC);
  fs.writeFileSync(path.join(outside, 'REASONING.md'), OUTSIDE_REASONING_SYNTHETIC);
  fs.writeFileSync(path.join(outside, 'victim.md'), VICTIM_ORIGINAL);

  fs.mkdirSync(evilDir, { recursive: true });
  fs.writeFileSync(path.join(evilDir, 'marker.md'), EVIL_SYNTHETIC);

  fs.mkdirSync(path.join(room, 'normal'), { recursive: true });
  fs.writeFileSync(path.join(room, 'normal', 'note.md'), INSIDE_SYNTHETIC);

  // Directory symlink -- section escape (write and read both target this).
  fs.symlinkSync(outside, path.join(room, 'research'), 'dir');

  // Directory symlink -- reasoning-section escape.
  fs.mkdirSync(path.join(room, '.reasoning'), { recursive: true });
  fs.symlinkSync(outside, path.join(room, '.reasoning', 'linked'), 'dir');

  // Real section with one legit file plus one file symlink pointing outside.
  fs.mkdirSync(path.join(room, 'notes'), { recursive: true });
  fs.writeFileSync(path.join(room, 'notes', 'legit.md'), NOTES_LEGIT_SYNTHETIC);
  fs.symlinkSync(path.join(outside, 'victim.md'), path.join(room, 'notes', 'victim.md'), 'file');

  // Inside-pointing directory symlink -- must keep working (T-354-10b).
  fs.symlinkSync(path.join(room, 'normal'), path.join(room, 'alias'), 'dir');

  return { root, room, roomName, outside, evilDir, cleanup };
}

// ---------------------------------------------------------------------------
// Read-side cases (R1-R5): a real SDK Client over InMemoryTransport.
// One connected client is shared across R1-R5 (each case independently
// try/caught by the caller below so one failing case never hides another).
// ---------------------------------------------------------------------------
async function setupReadClient(fx) {
  const server = new McpServer({ name: 'test-354-room-symlink-containment', version: '1' });
  registerResources(server, { fallbackRoomDir: fx.room });
  const client = new Client({ name: 'test-354-reader', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  return {
    client,
    server,
    async readText(uri) {
      try {
        const result = await client.readResource({ uri });
        return result.contents.map((c) => c.text || '').join('\n');
      } catch (e) {
        return '';
      }
    },
    async teardown() {
      await client.close();
      await server.close();
    },
  };
}

// R1: a normal discovered section still returns its content.
async function testR1(rc) {
  const normalText = await rc.readText('room://section/normal');
  assert.ok(normalText.includes(INSIDE_SYNTHETIC), 'room://section/normal must include INSIDE_SYNTHETIC');
  ok('R1: room://section/normal returns INSIDE_SYNTHETIC');
}

// R2: a symlinked section never leaks outside bytes (write-tool symlink,
// reused here for the read path).
async function testR2(rc) {
  const researchText = await rc.readText('room://section/research');
  assert.ok(!researchText.includes(OUTSIDE_SYNTHETIC), 'room://section/research must not include OUTSIDE_SYNTHETIC');
  assert.ok(!researchText.includes(OUTSIDE_REASONING_SYNTHETIC), 'room://section/research must not include OUTSIDE_REASONING_SYNTHETIC');
  ok('R2: room://section/research (symlinked) leaks no outside bytes');
}

// R3: reasoning://section/{name} refuses a symlinked reasoning section.
async function testR3(rc) {
  const linkedReasoningText = await rc.readText('reasoning://section/linked');
  assert.ok(!linkedReasoningText.includes(OUTSIDE_REASONING_SYNTHETIC), 'reasoning://section/linked must not include OUTSIDE_REASONING_SYNTHETIC');
  ok('R3: reasoning://section/linked leaks no outside bytes');
}

// R4: percent-encoded traversal and sibling-prefix names stay refused
// (CTX-CORRECTED floor, expected to already pass pre-fix).
async function testR4(rc, fx) {
  const encodedOutsideText = await rc.readText('room://section/..%2Foutside');
  assert.ok(!encodedOutsideText.includes(OUTSIDE_SYNTHETIC), 'percent-encoded ../outside must not leak OUTSIDE_SYNTHETIC');
  const encodedEvilText = await rc.readText('room://section/..%2F' + fx.roomName + '-evil');
  assert.ok(!encodedEvilText.includes(EVIL_SYNTHETIC), 'percent-encoded sibling-prefix -evil dir must not leak EVIL_SYNTHETIC');
  ok('R4: percent-encoded traversal and sibling-prefix names stay refused (floor)');
}

// R5: a file symlink inside a real, otherwise-legit section is omitted,
// never read -- must run BEFORE W2 replaces notes/victim.md.
async function testR5(rc) {
  const notesText = await rc.readText('room://section/notes');
  assert.ok(notesText.includes(NOTES_LEGIT_SYNTHETIC), 'room://section/notes must still include the legit file');
  assert.ok(!notesText.includes(VICTIM_ORIGINAL), 'room://section/notes must not include the outside-pointing symlink content');
  ok('R5: room://section/notes includes the legit file, omits the symlinked one');
}

// ---------------------------------------------------------------------------
// reasoning-ops cases (O1-O2): direct module calls, no MCP layer.
// ---------------------------------------------------------------------------

// O1: getReasoning refuses a symlinked section instead of reading through it.
function testO1(fx) {
  const got = reasoningOps.getReasoning(fx.room, 'linked');
  assert.ok(got && typeof got.error === 'string', 'getReasoning(room, "linked") must return an error object');
  assert.ok(!(got.content && got.content.includes(OUTSIDE_REASONING_SYNTHETIC)), 'getReasoning must never return outside content');
  ok('O1: getReasoning(room, "linked") returns an error, not outside content');
}

// O2: setReasoningFrontmatter never mutates the outside file.
function testO2(fx) {
  const outsideReasoningPath = path.join(fx.outside, 'REASONING.md');
  const before = fs.readFileSync(outsideReasoningPath, 'utf8');
  reasoningOps.setReasoningFrontmatter(fx.room, 'linked', 'x', 'y');
  const after = fs.readFileSync(outsideReasoningPath, 'utf8');
  assert.strictEqual(after, before, 'outside/REASONING.md must be byte-identical before and after setReasoningFrontmatter');
  ok('O2: setReasoningFrontmatter(room, "linked", ...) does not modify outside/REASONING.md');
}

// ---------------------------------------------------------------------------
// Write-side cases (W1-W3): lib/mcp/tools/views.cjs _internal.fileArtifact.
// Share one open db handle; each case independently try/caught by the
// caller below so one failing case never hides another.
// ---------------------------------------------------------------------------

// W1: a symlinked destination section is refused before any byte writes.
function testW1(db, fx) {
  const outsideProbePath = path.join(fx.outside, 'probe.md');
  const w1 = views._internal.fileArtifact(db, fx.room, {
    section: 'research', filename: 'probe.md', content: '# Synthetic outside write\n',
  });
  assert.strictEqual(w1.ok, false, 'W1: fileArtifact into a symlinked section must return ok:false');
  assert.strictEqual(w1.reason, 'path_escape', 'W1: fileArtifact into a symlinked section must return reason:path_escape');
  assert.ok(!fs.existsSync(outsideProbePath), 'W1: outside/probe.md must never be created');
  ok('W1: write through a symlinked section refused (ok:false, reason:path_escape), no outside byte written');
}

// W2: an existing in-room symlink LEAF is replaced atomically, never
// written through. Depends on R5 having already observed the pre-write
// symlink state above.
function testW2(db, fx) {
  const outsideVictimPath = path.join(fx.outside, 'victim.md');
  const victimBefore = fs.readFileSync(outsideVictimPath, 'utf8');
  const w2 = views._internal.fileArtifact(db, fx.room, {
    section: 'notes', filename: 'victim.md', content: NEW_INSIDE,
  });
  assert.strictEqual(w2.ok, true, 'W2: fileArtifact into an existing in-room symlink leaf must succeed');
  const victimAfter = fs.readFileSync(outsideVictimPath, 'utf8');
  assert.strictEqual(victimAfter, victimBefore, 'W2: outside/victim.md must remain byte-identical (never written through)');
  const insideVictimPath = path.join(fx.room, 'notes', 'victim.md');
  assert.strictEqual(fs.lstatSync(insideVictimPath).isSymbolicLink(), false, 'W2: room/notes/victim.md must become a regular file, not remain a symlink');
  assert.strictEqual(fs.readFileSync(insideVictimPath, 'utf8'), NEW_INSIDE, 'W2: room/notes/victim.md must contain the new inside content');
  ok('W2: existing in-room symlink leaf replaced atomically, outside file untouched');
}

// W3: a legitimate inside-pointing directory symlink keeps working
// (T-354-10b -- the policy follows directory symlinks whose realpath stays
// inside the room).
function testW3(db, fx) {
  const w3 = views._internal.fileArtifact(db, fx.room, {
    section: 'alias', filename: 'w3.md', content: W3_CONTENT,
  });
  assert.strictEqual(w3.ok, true, 'W3: fileArtifact into an inside-pointing symlinked section must succeed');
  const landedPath = path.join(fx.room, 'normal', 'w3.md');
  assert.ok(fs.existsSync(landedPath), 'W3: the file must land under room/normal (the alias symlink target)');
  assert.strictEqual(fs.readFileSync(landedPath, 'utf8'), W3_CONTENT, 'W3: the landed file must contain the written content');
  ok('W3: inside-pointing directory symlink still followed, file lands at its real target');
}

(async () => {
  const fx = buildFixture();
  try {
    const rc = await setupReadClient(fx);
    try {
      try { await testR1(rc); } catch (e) { fail('R1: room://section/normal', e); }
      try { await testR2(rc); } catch (e) { fail('R2: room://section/research (symlinked)', e); }
      try { await testR3(rc); } catch (e) { fail('R3: reasoning://section/linked', e); }
      try { await testR4(rc, fx); } catch (e) { fail('R4: percent-encoded traversal / sibling-prefix floor', e); }
      try { await testR5(rc); } catch (e) { fail('R5: room://section/notes (symlinked leaf)', e); }
    } finally {
      await rc.teardown();
    }

    try { testO1(fx); } catch (e) { fail('O1: getReasoning(room, "linked")', e); }
    try { testO2(fx); } catch (e) { fail('O2: setReasoningFrontmatter(room, "linked", ...)', e); }

    const db = openRoomDb(fx.room);
    try {
      try { testW1(db, fx); } catch (e) { fail('W1: fileArtifact into a symlinked section', e); }
      try { testW2(db, fx); } catch (e) { fail('W2: fileArtifact replaces an existing in-room symlink leaf', e); }
      try { testW3(db, fx); } catch (e) { fail('W3: fileArtifact into an inside-pointing symlinked section', e); }
    } finally {
      closeRoomDb(db);
    }
  } finally {
    fx.cleanup();
  }

  console.log('');
  if (failed > 0) {
    console.log('FAIL - ' + failed + ' of ' + (checks + failed) + ' checks failed (checks that ran: ' + checks + ')');
    process.exitCode = 1;
  } else {
    console.log('PASS - ' + checks + ' checks');
  }
})();
