'use strict';
/*
 * Phase 400.4 plan 12 (QA-F11 part B base) -- the in-process run contract helpers for the six UserPromptSubmit scripts.
 *
 * Contract: run(input, opts) resolves {code, stdout, stderr}. run never calls process.exit, never reads fd 0, never
 * registers a process listener and never writes to process.stdout or process.stderr. Output goes through a sink from
 * makeSink(). An early exit inside the old code path becomes `throw new HookExit(code)`, caught at the top of run.
 * Phase 400.5 runs run() inside a long-lived server process, so a stray stream write or exit here would be a defect.
 *
 * Zero requires on purpose: this file loads inside every hook, so it must add no cold start cost and no cycle.
 * Hyphens only, no dash characters.
 */

// HookExit: thrown where the old code called process.exit(code). run catches it and resolves the sink with that code.
class HookExit extends Error {
  constructor(code) {
    super('HookExit ' + (Number.isInteger(code) ? code : 0));
    this.name = 'HookExit';
    this.code = Number.isInteger(code) ? code : 0;
  }
}

// makeSink: a pair of string collectors. take(code) returns the {code, stdout, stderr} result of the run.
function makeSink() {
  const outParts = [];
  const errParts = [];
  return {
    out(s) { if (s !== undefined && s !== null) outParts.push(String(s)); },
    err(s) { if (s !== undefined && s !== null) errParts.push(String(s)); },
    take(code) {
      return {
        code: Number.isInteger(code) ? code : 0,
        stdout: outParts.join(''),
        stderr: errParts.join(''),
      };
    },
  };
}

// finishCli: the CLI end of a script. Write stdout, then stderr, then exit with result.code once both have flushed.
function finishCli(result) {
  const r = result || {};
  const code = Number.isInteger(r.code) ? r.code : 0;
  const stdout = typeof r.stdout === 'string' ? r.stdout : '';
  const stderr = typeof r.stderr === 'string' ? r.stderr : '';
  function done() { process.exit(code); }
  function writeErr() {
    if (!stderr) return done();
    try { process.stderr.write(stderr, done); } catch (_e) { done(); }
  }
  if (!stdout) return writeErr();
  try { process.stdout.write(stdout, writeErr); } catch (_e) { writeErr(); }
}

module.exports = { HookExit, makeSink, finishCli };
