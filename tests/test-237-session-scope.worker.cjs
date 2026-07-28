#!/usr/bin/env node
/**
 * Worker process for test-237-session-scope.cjs (Phase 237-04, REACH-03).
 *
 * Written as a standalone file (not an inline template string) to avoid
 * Windows/Linux path-escape ambiguity in the parent test source -- the same
 * precedent lib/memory/write-lock-atomic.worker.cjs (Phase 87-02) documents
 * for itself.
 *
 * Forked by the parent test via child_process.fork to get TRUE OS-level
 * concurrency (two real processes), not mocked in-event-loop "parallelism".
 * Session A (this worker) seeds a session-stamped marker; session B (the
 * parent) reads it. That is the only way to prove a cross-session bleed --
 * or its absence -- for real.
 *
 * argv contract:
 *   argv[2] -- room directory (required)
 *   argv[3] -- session id to stamp into the marker (required)
 *   argv[4] -- marker kind: 'cascade' or 'auto-explore' (required)
 *
 * Exit codes:
 *   0 -- marker written successfully
 *   3 -- a required argv was missing, or the marker kind was unrecognized
 *   4 -- the write itself failed
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const roomDir = process.argv[2];
const sessionId = process.argv[3];
const kind = process.argv[4];

if (!roomDir || !sessionId || !kind) {
  process.stderr.write('test-237-session-scope.worker: missing required argv (roomDir, sessionId, kind)\n');
  process.exit(3);
}

if (kind !== 'cascade' && kind !== 'auto-explore') {
  process.stderr.write('test-237-session-scope.worker: unknown marker kind: ' + kind + '\n');
  process.exit(3);
}

try {
  const sideDir = path.join(roomDir, '.mindrian');
  fs.mkdirSync(sideDir, { recursive: true });

  let fileName;
  let payload;
  if (kind === 'cascade') {
    // Mirrors the REAL scripts/post-write payload shape (timestamp, file_path,
    // section, cascade_status, proactive_intelligence), plus the top-level
    // session_id key this plan adds (Plan 06 makes the real writer stamp it;
    // this worker seeds a payload that already looks like the post-fix shape
    // so the reader-side fix in this plan has a real fixture to prove itself
    // against).
    fileName = 'last-cascade.json';
    payload = {
      timestamp: new Date().toISOString(),
      file_path: 'tests/fixtures/237-04-session-scope-fence.md',
      section: 'fence',
      cascade_status: 'complete',
      classification: null,
      git_commit: null,
      graph_index: null,
      session_id: sessionId,
      proactive_intelligence: {
        newFindings: [{ type: 'CROSS_ROOM', target: '237-04-session-scope-fence' }],
      },
    };
  } else {
    // auto-explore-<material_id>.json (the Phase 117 fire-marker shape),
    // session-stamped the same way Plan 06 makes auto-explore-fire.cjs do it.
    fileName = 'auto-explore-237-04-session-scope-fence.json';
    payload = {
      timestamp: new Date().toISOString(),
      material_id: '237-04-session-scope-fence',
      session_id: sessionId,
    };
  }

  const destPath = path.join(sideDir, fileName);
  // Atomic same-directory mktemp-then-rename, mirroring the discipline the
  // real writers (scripts/post-write, scripts/auto-explore-fire.cjs) use.
  const tmpPath = path.join(sideDir, '.' + fileName + '.' + process.pid + '.tmp');
  fs.writeFileSync(tmpPath, JSON.stringify(payload));
  fs.renameSync(tmpPath, destPath);

  process.exit(0);
} catch (e) {
  process.stderr.write('test-237-session-scope.worker write failure: ' + (e && e.message || e) + '\n');
  process.exit(4);
}
