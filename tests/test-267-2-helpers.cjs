'use strict';
// Phase 267.2 -- shared fixture helpers for the W0/W1/W2 tests in this phase.
//
// This is a FIXTURE HELPER, not a test with its own assertions. It exports no
// npm dependency, node built-ins only (node:fs, node:path, node:os).
// node:child_process is not required directly by this module today (the
// isolated-HOME fixture hands callers an env object to pass to their own
// spawnSync/execFileSync call, rather than spawning anything itself), so it
// is intentionally not required here -- keeping the surface honest about what
// it actually touches.
//
// IMPORTANT: tests/run-all-267.2.sh discovers this module too, because its
// glob is `tests/test-267-2-*.cjs` with no further filtering, and this file's
// name matches that pattern (it must, so callers can `require` it by a
// predictable path from a sibling test file). Running `node
// tests/test-267-2-helpers.cjs` directly therefore MUST exit 0 and print a
// single line starting with `SKIP`, so the aggregator's `run_may_skip`
// classifies it as skipped rather than counting it as a spurious pass or,
// worse, a silent no-op that reads as PASSED for doing nothing.
//
// Pitfall 6 (267.2-RESEARCH.md): `os.homedir()` resolved at module load or
// resolved once and cached writes to the developer's REAL home directory even
// after a test overrides HOME, because os.homedir() reads /etc/passwd on
// POSIX and ignores process.env.HOME entirely. withIsolatedHome() below sets
// BOTH `HOME` and `USERPROFILE` in the env object it hands back -- HOME for
// POSIX, USERPROFILE for Windows -- so a caller that spawns a child process
// with that env (see tests/test-267-1-first-install-hooked-audit.cjs:127-141
// for the pattern this generalises) never touches the real home directory on
// either platform. Code under test must also resolve os.homedir() (or
// process.env.HOME) AT CALL TIME, not at module load -- see
// lib/mcp/tools/identity.cjs's USER_MD_PATH() for the documented precedent
// (threat T-270-13).

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/**
 * Runs `fn({ home, env })` with an isolated, empty home directory. `home` is
 * the absolute path to a freshly created temp directory; `env` is a copy of
 * `process.env` with both `HOME` and `USERPROFILE` overridden to `home`, fit
 * to hand straight to a child_process spawn call. The temp directory is
 * always removed afterward, in a `finally` block, so a thrown assertion
 * inside `fn` still cleans up.
 *
 * @param {(ctx: { home: string, env: NodeJS.ProcessEnv }) => void} fn
 * @returns {void}
 */
function withIsolatedHome(fn) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), '267-2-'));
  try {
    const env = Object.assign({}, process.env, { HOME: home, USERPROFILE: home });
    fn({ home, env });
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
  }
}

/**
 * Returns a shallow copy of `baseEnv` with ANTHROPIC_API_KEY, TAVILY_API_KEY
 * and MINDRIAN_BRAIN_KEY deleted, so a test can assert the fresh-install
 * no-key path (267.2-RESEARCH.md's Environment Availability section names
 * this as the default a first-install session actually runs under).
 *
 * @param {NodeJS.ProcessEnv} baseEnv
 * @returns {NodeJS.ProcessEnv}
 */
function keylessEnv(baseEnv) {
  const copy = Object.assign({}, baseEnv);
  delete copy.ANTHROPIC_API_KEY;
  delete copy.TAVILY_API_KEY;
  delete copy.MINDRIAN_BRAIN_KEY;
  return copy;
}

/**
 * Generalised form of tests/test-267-1-first-install-hooked-audit.cjs:25-29's
 * region() slicer. Reads `filePath`, finds `anchor` and returns the substring
 * from the anchor to the end of THAT physical line. Anchor on literals, never
 * line numbers -- the FIRST_INSTALL payload in scripts/session-start is one
 * roughly 3000-character line whose line number moves across edits.
 *
 * @param {string} filePath
 * @param {string} anchor
 * @returns {string}
 */
function readRegion(filePath, anchor) {
  const src = fs.readFileSync(filePath, 'utf8');
  const i = src.indexOf(anchor);
  if (i === -1) {
    throw new Error('readRegion: anchor missing in ' + filePath + ': ' + anchor);
  }
  const eol = src.indexOf('\n', i);
  return eol === -1 ? src.slice(i) : src.slice(i, eol);
}

/**
 * Reads `filePath` and throws if `forbiddenSubstring` appears anywhere in it.
 * Used by the telemetry and USER.md roundtrip tests to prove no raw user
 * sentence reached disk, per Canon Part 8 (Graph Boundary: user data never
 * egresses as raw bytes into a surface that was only meant to carry a
 * generic methodology handle).
 *
 * @param {string} filePath
 * @param {string} forbiddenSubstring
 * @returns {void}
 */
function assertNoRawText(filePath, forbiddenSubstring) {
  const src = fs.readFileSync(filePath, 'utf8');
  if (src.indexOf(forbiddenSubstring) !== -1) {
    throw new Error(
      'assertNoRawText: forbidden substring found in ' + filePath + ': ' + JSON.stringify(forbiddenSubstring)
    );
  }
}

module.exports = { withIsolatedHome, keylessEnv, readRegion, assertNoRawText };

if (require.main === module) {
  console.log('SKIP tests/test-267-2-helpers.cjs is a fixture helper module, not a test (no assertions of its own)');
  process.exit(0);
}
