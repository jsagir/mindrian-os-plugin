/**
 * MindrianOS Plugin -- Room Ops (legacy entry point, SYNC-compat shim)
 * =====================================================================
 * DEPRECATED: import from './room-ops-sync.cjs' (CLI / hook scripts) or
 * './room-ops-async.cjs' (MCP handlers) directly. This file exists only
 * as a thin re-export for backward compatibility with any out-of-tree
 * caller that copy-pasted older docs.
 *
 * Phase 87-04 sync/async split (CASCADE-06). Rationale: a single module
 * with env branching (process.env.MOS_ASYNC) is the R4 footgun -- one
 * forgotten guard ships blocking execSync into the MCP handler path.
 * Two distinct entry points chosen by the caller at require time make
 * the contract unambiguous.
 *
 * A one-time process.emitWarning() fires on require so accidental callers
 * are surfaced. The warning uses a stable `code` (MOS_DEP_ROOM_OPS_LEGACY)
 * so test environments can filter it via NODE_NO_WARNINGS / the process
 * warning event handler if needed. process.emitWarning dedups by
 * (name, code) per Node process automatically, so require'ing this file
 * from multiple places still emits the warning only once.
 *
 * License: BSL 1.1 (Business Source License 1.1) -- see LICENSE.
 */

'use strict';

process.emitWarning(
  "require('lib/core/room-ops.cjs') is deprecated; import './room-ops-sync.cjs' (CLI) or './room-ops-async.cjs' (MCP) directly (Phase 87-04).",
  { type: 'DeprecationWarning', code: 'MOS_DEP_ROOM_OPS_LEGACY' }
);

module.exports = require('./room-ops-sync.cjs');
