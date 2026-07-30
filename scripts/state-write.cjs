#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * scripts/state-write.cjs -- the bash-to-Node persistence bridge for the
 * per-room STATE.md.
 *
 * Usage: <rendered body on stdin> | node scripts/state-write.cjs <roomDir>
 *
 * Phase 240.1 Plan 03 (CTXL-01). Plan 240.1-02 built
 * lib/core/state-version.cjs::persistState, the preserve-or-notify write
 * authority, and wired it into ONE of six write sites
 * (lib/core/state-ops.cjs::computeState). Five bash-driven sites still
 * bypassed it (240.1-RESEARCH.md Finding 1C). This script is the bridge each
 * of those bash sites pipes its already-captured compute-state output
 * through, instead of writing STATE.md with a bare shell redirect.
 *
 * ADVISORY, NOT BLOCKING -- exactly like scripts/frontmatter-schema-validator.cjs.
 * A version-mismatch check that throws or exits nonzero inside on-stop,
 * on-task-complete, or on-agent-complete would break Larry's turn on all
 * three surfaces (Security Domain T-240.1-10). This script ALWAYS exits 0,
 * on every input: a missing argument, an unwritable room dir, empty stdin,
 * or a version-mismatch verdict.
 *
 * Output discipline:
 *   status === 'ok'               -> print nothing (hooks are quiet on the
 *                                     happy path).
 *   status === 'version-mismatch' -> persistState() itself already writes ONE
 *                                     stderr line naming the on-disk version,
 *                                     the module version, and the advice
 *                                     'run /mos:doctor --fix' (the same line
 *                                     lib/core/state-ops.cjs::computeState
 *                                     relies on for its own callers). This
 *                                     script does not duplicate that line; it
 *                                     only decides the exit code.
 *   status === 'error'            -> persistState()'s own catch block already
 *                                     writes ONE stderr line naming the
 *                                     message before returning the envelope.
 * Never silent on a non-ok verdict: the counter-lesson at
 * lib/core/navigation/room-birth.cjs:992-995 is that a bare swallow is how a
 * write site fails invisibly for months. The durable record survives even
 * where a caller discards stderr, because persistState() itself appends to
 * schema-violations.jsonl on a version-mismatch verdict.
 *
 * Argument handling: exactly one positional argument, the room dir. Missing
 * or empty argument prints one usage line to stderr and still exits 0
 * (advisory contract) -- no flags, this script has one job.
 *
 * Canon Part 8: LOCAL files only. Zero network calls. Zero Brain queries.
 * CJS, node built-ins only, plus lib/core/state-version.cjs. No new deps.
 */

const path = require('node:path');
const { persistState } = require(path.join(__dirname, '..', 'lib', 'core', 'state-version.cjs'));

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(data));
  });
}

async function main() {
  const roomDir = process.argv[2];
  if (!roomDir || typeof roomDir !== 'string' || roomDir.length === 0) {
    process.stderr.write(
      'Usage: <rendered body on stdin> | node scripts/state-write.cjs <roomDir>\n'
    );
    process.exit(0);
    return;
  }

  const rendered = await readStdin();

  try {
    // persistState() owns ALL advisory output (the single stderr line on
    // 'version-mismatch' or 'error', the schema-violations.jsonl append, and
    // the atomic write on 'ok'). This bridge adds no output of its own -- see
    // the Output discipline note in the header comment above.
    persistState(roomDir, rendered);
  } catch (e) {
    // persistState never throws by contract, but this script never
    // propagates regardless -- a second layer of the never-throw envelope.
    process.stderr.write(
      '[state-write] unexpected error: ' + (e && e.message ? e.message : String(e)) + '\n'
    );
  }

  process.exit(0);
}

main();
