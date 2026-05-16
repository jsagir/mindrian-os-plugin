#!/usr/bin/env node
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 121.5-08 (Sub-plan J) -- the reusable runner that every soft-alias
 * deprecation stub command delegates to.
 *
 * Contract (D-09 LOCKED):
 *   - Old command stays as a 1-line stub. The stub:
 *       (a) Prints a single-sentence deprecation note (Larry voice; no
 *           em-dash characters; cyan-colored "use /mos:<new>" line).
 *       (b) Invokes the new command transparently with the user's args.
 *   - Zero tester breakage during v1.13.x.
 *   - Removal scheduled v1.14.0.
 *   - CHANGELOG flags all renames.
 *
 * Two exports:
 *   softAliasRun({from, to, args, removalTarget?}) -> envelope object
 *     The LLM caller consumes this envelope. The deprecation_note is
 *     surfaced to the user (cyan single line per UI Ruling System voice).
 *     The redirect names the canonical /mos:<new> command and the args are
 *     passed through verbatim.
 *
 *   emitForLLM(opts) -> writes JSON.stringify(envelope) to stdout
 *     Used when the runner is spawned as a child process by a hook or
 *     command. The LLM consumes the stdout JSON. The CLI form parses
 *     --from / --to / --remaining-args flags and calls emitForLLM.
 *
 * Hermetic: pure-function softAliasRun has zero I/O. emitForLLM is the
 * only side-effect path (single stdout write). No network, no fs, no
 * spawn. Canon Part 7: ONE runner that the 5 (heal/query/organize/
 * hmi-status/visualize) soft-alias stubs share -- no per-stub logic.
 * Canon Part 8: no Brain query, no telemetry egress.
 */
'use strict';

/**
 * Build a soft-alias envelope. Pure function.
 *
 * @param {{
 *   from: string,                     // old command name (no /mos: prefix), e.g. 'heal'
 *   to: string,                       // new command + args (no /mos: prefix), e.g. 'doctor --heal-room'
 *   args?: string[],                  // user args to pass through to the new command
 *   removalTarget?: string,           // version when the soft-alias is removed (default 'v1.14.0')
 * }} opts
 * @returns {{
 *   redirect: string,                 // '/mos:' + to
 *   deprecation_note: string,         // Single-sentence Larry-voice note. No em-dash.
 *   args: string[],                   // Pass-through args (always an array; defaults to []).
 *   ok: boolean,                      // Always true for a valid call.
 * }}
 */
function softAliasRun(opts) {
  const { from, to } = opts || {};
  const args = (opts && Array.isArray(opts.args)) ? opts.args : [];
  const removal = (opts && opts.removalTarget) ? opts.removalTarget : 'v1.14.0';
  // Larry voice: terse, names the new command, scheduled removal explicit.
  // No em-dash characters anywhere (hard rule per feedback_no_emdashes).
  // The text is structured so a grep for "Deprecated. " hits at offset 0,
  // and the redirect target appears verbatim so callers can scan for it.
  const note = 'Deprecated. /mos:' + from
    + ' now redirects to /mos:' + to
    + '. Scheduled removal: ' + removal
    + '. Use /mos:' + to + ' going forward.';
  return {
    redirect: '/mos:' + to,
    deprecation_note: note,
    args: args,
    ok: true,
  };
}

/**
 * Emit the envelope to stdout as a single JSON line. Used when the runner
 * is spawned as a subprocess from a hook or a command. The consumer (LLM
 * or another script) parses the JSON and acts on it.
 *
 * @param {object} opts -- same shape as softAliasRun
 */
function emitForLLM(opts) {
  const r = softAliasRun(opts);
  process.stdout.write(JSON.stringify(r));
  process.stdout.write('\n');
  return r;
}

// CLI form: node scripts/soft-alias-runner.cjs --from <old> --to <new...> [--remaining-args ...]
//   --from <name>            REQUIRED: old command name (no /mos: prefix)
//   --to <name + args>       REQUIRED: new command name + args (no /mos: prefix)
//                            NOTE: multi-token --to values like "doctor --heal-room"
//                            must be passed as a single quoted arg by the shell caller.
//   --remaining-args ...     OPTIONAL: everything after this flag is the user args
//                            list, passed through to the new command verbatim.
//   --removal <vN.N.N>       OPTIONAL: removal target version (default v1.14.0)
//
// Exit code is always 0. Drift / fix flags are out of scope for a soft-alias
// runner; the runner only emits the envelope.
if (require.main === module) {
  const argv = process.argv.slice(2);
  function getFlag(name) {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : null;
  }
  const from = getFlag('--from');
  const to = getFlag('--to');
  const removalTarget = getFlag('--removal') || undefined;
  const remIdx = argv.indexOf('--remaining-args');
  const args = remIdx >= 0 ? argv.slice(remIdx + 1) : [];
  if (!from || !to) {
    process.stderr.write('soft-alias-runner.cjs: --from and --to are required\n');
    process.exit(2);
  }
  emitForLLM({ from: from, to: to, args: args, removalTarget: removalTarget });
  process.exit(0);
}

module.exports = { softAliasRun, emitForLLM };
