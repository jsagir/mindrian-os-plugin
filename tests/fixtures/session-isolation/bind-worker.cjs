'use strict';
// Phase 128.1 Plan 02 -- lost-write concurrency test worker.
//
// Forked by lib/core/session-binding.test.cjs. Each worker calls
// bindSessionRoom(sessionId, roomSlug) against the same hermetic registry.
// Two workers race the same registry.json; the mkdirSync directory lockfile
// in session-binding.cjs is what guarantees BOTH sessions[id] entries survive
// (no rename-clobber lost write).
//
// argv[2] = sessionId, argv[3] = roomSlug.
// MINDRIAN_ROOMS_HOME + MINDRIAN_HOME are inherited from the parent env.

const path = require('node:path');

const sessionId = process.argv[2];
const roomSlug = process.argv[3];

const sessionBinding = require(path.join(__dirname, '..', '..', '..', 'lib', 'core', 'session-binding.cjs'));

try {
  sessionBinding.bindSessionRoom(sessionId, roomSlug);
  process.exit(0);
} catch (err) {
  process.stderr.write('bind-worker error: ' + (err && err.message) + '\n');
  process.exit(1);
}
