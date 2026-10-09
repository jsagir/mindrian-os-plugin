#!/usr/bin/env node
'use strict';
// Usage: node scripts/graph-doctor.cjs <room-dir> [--out <dir>]
// Read-only over room.db (via the navigation chokepoint). Writes a proposal queue only.
const { runGraphDoctor } = require('../lib/core/graph-doctor/index.cjs');
(async () => {
  const args = process.argv.slice(2);
  const room = args[0];
  if (!room) { console.error('usage: node scripts/graph-doctor.cjs <room-dir> [--out <dir>]'); process.exit(2); }
  const oi = args.indexOf('--out');
  const out = oi >= 0 ? args[oi + 1] : undefined;
  const r = await runGraphDoctor(room, out ? { outDir: out } : {});
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.status === 'skip' ? 1 : 0);
})();
