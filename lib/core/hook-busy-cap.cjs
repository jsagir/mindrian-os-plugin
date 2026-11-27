'use strict';
// Phase 400.4 plan 10 (QA-F11): process-scoped busy cap for hook processes.
//
// A UserPromptSubmit hook has a host budget of 3 s, but room.db opens with a 5 s busy wait.
// Under contention the host kills the hook in the middle of the wait. A hook process calls
// setHookBusyCap(HOOK_BUSY_MS) once; every later room.db open in the same process then waits
// at most that long, and after the first busy result it does not wait again (the cap drops to 0,
// so a later open is a no-wait re-probe).
//
// The cap is MODULE STATE, never an environment variable, so a spawned child process keeps the
// default wait (threat T-400.4-32). A second setHookBusyCap call does not clear a tripped cap,
// so several checks that share one process (the plan 13 dispatcher) share the trip.
// Zero requires on purpose: this file is reached from room-db.cjs and from the hook path.

const HOOK_BUSY_MS = 750;
// Plan 400.3-06c: the default busy wait of a room.db open outside a hook. It lives here so that a script can read it
// without requiring room-db.cjs, which scripts/check-substrate.cjs bans from a script.
const DEFAULT_BUSY_MS = 5000;

let _cap = null;      // null = no cap set
let _tripped = false; // true after noteBusy() while a cap is set

function setHookBusyCap(ms) {
  const n = Number(ms);
  if (!Number.isFinite(n) || n < 0) return;
  const next = Math.floor(n);
  // Keep the smaller cap when one is already set; never clear a trip.
  _cap = _cap === null ? next : Math.min(_cap, next);
}

function capBusyMs(requested) {
  const r = Number.isFinite(Number(requested)) ? Math.max(0, Math.floor(Number(requested))) : 0;
  if (_cap === null) return r;
  if (_tripped) return 0;
  return Math.min(r, _cap);
}

function noteBusy() {
  if (_cap !== null) _tripped = true;
}

// Wave 2 Goldfish W2-CD-03 (Canon Part 7): the one SQLite busy test of the plugin. True for a primary result code
// (errcode & 255) of 5 (SQLITE_BUSY) or 6 (SQLITE_LOCKED), so the extended codes such as 517 (SQLITE_BUSY_SNAPSHOT)
// count too, and for the message forms 'database is locked', 'database table is locked', 'SQLITE_BUSY' and
// 'SQLITE_LOCKED' (in message or in the node:sqlite errstr). Only an object is an error; anything else is false.
const BUSY_TEXT = /database (table )?is locked|SQLITE_BUSY|SQLITE_LOCKED/i;
function isBusyError(err) {
  if (!err || typeof err !== 'object') return false;
  if (typeof err.errcode === 'number') {
    const rc = err.errcode & 255;
    if (rc === 5 || rc === 6) return true;
  }
  const msg = (typeof err.message === 'string' ? err.message : '') + ' ' + (typeof err.errstr === 'string' ? err.errstr : '');
  return BUSY_TEXT.test(msg);
}

module.exports = { HOOK_BUSY_MS, DEFAULT_BUSY_MS, setHookBusyCap, capBusyMs, noteBusy, isBusyError };
