// Phase 388 plan 02: file system trace preload. Loaded with node --require (NODE_OPTIONS).
// It records, for every call that names a path inside MOS388_TRACE_ROOT, one JSON line in MOS388_TRACE_OUT:
//   {"p": <path relative to the root>, "f": <function name>, "ok": <true | false>, "a": <name of the running script>}
// ok is false when the call throws or returns false or returns undefined for a missing entry.
// It never changes a return value, never throws, and keeps its own writes out of the trace.
// This file lives outside the installed root, so the root does not contain it. Node built-ins only.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { fileURLToPath } = require('node:url');

(function install() {
  const rootEnv = process.env.MOS388_TRACE_ROOT;
  const outFile = process.env.MOS388_TRACE_OUT;
  if (!rootEnv || !outFile) return;
  if (global.__mos388TraceInstalled) return;
  global.__mos388TraceInstalled = true;
  const roots = [path.resolve(rootEnv)];
  try { const real = fs.realpathSync(rootEnv); if (!roots.includes(real)) roots.push(real); } catch (_) { /* root may not exist yet */ }
  const append = fs.appendFileSync;
  const seen = new Set();
  const proc = (process.argv[1] ? path.basename(String(process.argv[1])) : 'node').slice(0, 60);
  let busy = false;

  function rel(p) {
    let s = null;
    if (typeof p === 'string') s = p;
    else if (p instanceof URL) { try { s = fileURLToPath(p); } catch (_) { return null; } } else if (Buffer.isBuffer(p)) s = p.toString();
    if (s === null || s === '') return null;
    const abs = path.resolve(s);
    for (const r of roots) {
      if (abs === r) return '.';
      if (abs.startsWith(r + path.sep)) return abs.slice(r.length + 1).split(path.sep).join('/');
    }
    return null;
  }
  function record(p, fn, ok) {
    if (busy) return;
    const r = rel(p);
    if (r === null) return;
    const key = fn + '|' + r + '|' + ok;
    if (seen.has(key)) return;
    seen.add(key);
    busy = true;
    try { append(outFile, JSON.stringify({ p: r, f: fn, ok, a: proc }) + '\n'); } catch (_) { /* tracing must never break the program */ } finally { busy = false; }
  }
  function wrapSync(obj, name, okOf) {
    const orig = obj[name];
    if (typeof orig !== 'function') return;
    obj[name] = function traced(p) {
      let res;
      try {
        res = orig.apply(this, arguments);
      } catch (e) {
        record(p, name, false);
        throw e;
      }
      record(p, name, okOf ? okOf(res) : true);
      return res;
    };
  }
  function wrapCb(obj, name) {
    const orig = obj[name];
    if (typeof orig !== 'function') return;
    obj[name] = function traced(p) {
      const args = Array.prototype.slice.call(arguments);
      const last = args[args.length - 1];
      if (typeof last === 'function') {
        args[args.length - 1] = function (err) { record(p, name, !err); return last.apply(this, arguments); };
      } else {
        record(p, name, true);
      }
      return orig.apply(this, args);
    };
  }
  function wrapPromise(obj, name, label) {
    const orig = obj[name];
    if (typeof orig !== 'function') return;
    obj[name] = function traced(p) {
      const out = orig.apply(this, arguments);
      if (out && typeof out.then === 'function') {
        out.then(() => record(p, label, true), () => record(p, label, false));
      }
      return out;
    };
  }

  for (const n of ['readFileSync', 'openSync', 'accessSync', 'readdirSync', 'opendirSync', 'realpathSync', 'readlinkSync']) wrapSync(fs, n);
  wrapSync(fs, 'existsSync', (r) => r === true);
  wrapSync(fs, 'statSync', (r) => r !== undefined);
  wrapSync(fs, 'lstatSync', (r) => r !== undefined);
  wrapSync(fs, 'copyFileSync');
  wrapSync(fs, 'cpSync');
  wrapSync(fs, 'createReadStream');
  for (const n of ['readFile', 'stat', 'lstat', 'readdir', 'access', 'open', 'opendir']) wrapCb(fs, n);
  for (const n of ['readFile', 'stat', 'lstat', 'readdir', 'access', 'open', 'opendir']) wrapPromise(fs.promises, n, 'promises.' + n);

  // module resolution: the request path is recorded, ok = resolved
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function traced(request, parent) {
    let res;
    try {
      res = origResolve.apply(this, arguments);
    } catch (e) {
      try {
        const base = parent && parent.filename ? path.dirname(parent.filename) : process.cwd();
        if (typeof request === 'string' && (request.startsWith('.') || path.isAbsolute(request))) record(path.resolve(base, request), 'require', false);
      } catch (_) { /* ignore */ }
      throw e;
    }
    if (typeof res === 'string' && path.isAbsolute(res)) record(res, 'require', true);
    return res;
  };
})();
