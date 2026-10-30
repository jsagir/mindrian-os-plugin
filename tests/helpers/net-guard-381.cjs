'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 381 Plan 01: network guard preload for every node child of a parity run
 * (Canon Part 8, threat T-381-04). Load it with NODE_OPTIONS=--require <this file>.
 *
 * It patches net.Socket.prototype.connect, net.connect, net.createConnection, tls.connect,
 * http.request, http.get, https.request, https.get, dns.lookup, dns.promises.lookup and
 * globalThis.fetch. Each patched function appends one line "<pid> <api>" to the file named by
 * NET_GUARD_381_LOG (when set) and throws an Error that names Part 8. The preload never throws
 * at load time. Unix-socket IPC is not used by the scripts, so it is not special-cased.
 *
 * Hyphens only.
 */
const fs = require('node:fs');

function record(api) {
  const file = process.env.NET_GUARD_381_LOG;
  if (!file) return;
  try {
    fs.appendFileSync(file, process.pid + ' ' + api + '\n');
  } catch (_e) { /* the guard must never fail on its own log */ }
}

function blocker(api) {
  return function blockedNetworkCall() {
    record(api);
    throw new Error('Canon Part 8: network access is blocked in a parity run (' + api + ')');
  };
}

function patch(target, name, api) {
  try {
    if (target && typeof target[name] === 'function') target[name] = blocker(api);
  } catch (_e) { /* a frozen target is left alone */ }
}

try {
  const net = require('node:net');
  patch(net.Socket && net.Socket.prototype, 'connect', 'net.Socket.prototype.connect');
  patch(net, 'connect', 'net.connect');
  patch(net, 'createConnection', 'net.createConnection');
} catch (_e) { /* optional module */ }

try { patch(require('node:tls'), 'connect', 'tls.connect'); } catch (_e) { /* optional module */ }

try {
  const http = require('node:http');
  patch(http, 'request', 'http.request');
  patch(http, 'get', 'http.get');
} catch (_e) { /* optional module */ }

try {
  const https = require('node:https');
  patch(https, 'request', 'https.request');
  patch(https, 'get', 'https.get');
} catch (_e) { /* optional module */ }

try {
  const dns = require('node:dns');
  patch(dns, 'lookup', 'dns.lookup');
  patch(dns.promises, 'lookup', 'dns.promises.lookup');
} catch (_e) { /* optional module */ }

try {
  if (typeof globalThis.fetch === 'function') globalThis.fetch = blocker('fetch');
} catch (_e) { /* optional global */ }
