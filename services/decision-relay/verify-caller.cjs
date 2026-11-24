'use strict';
// Phase 400 plan 12 (RL-02, O-09): the one pluggable caller check of the decision relay.
// Two caller kinds:
//   operator: `Authorization: Bearer <token>`; the sha256 of the token must be in cfg.operatorHashes.
//             The compare runs over every listed hash with crypto.timingSafeEqual on 32-byte buffers.
//             A wrong token is refused bad_token, even when a valid install id is also sent (no fallback).
//   install:  the existing install id header (lib/core/install-id.cjs), 32 lowercase hex. Refused
//             user_traffic_off until the owner sets RELAY_USER_TRAFFIC=on (F-09, O-10).
// The returned bucket is derived by sha256, never the raw id. This module reads no body.
// A later caller check (for example a per-user credential) replaces verifyCaller with the same return shape.
// CJS, node built-ins only. Hyphens only.

const crypto = require('node:crypto');
const { installIdHeaderName } = require('../../lib/core/install-id.cjs');

const INSTALL_ID_RE = /^[a-f0-9]{32}$/;
const BEARER_RE = /^Bearer ([\x21-\x7e]{1,512})$/i;

// Case-insensitive lookup. A repeated header (an array value) is returned as is, so callers refuse it.
function headerValue(headers, name) {
  if (!headers || typeof headers !== 'object') return undefined;
  const want = name.toLowerCase();
  for (const k of Object.keys(headers)) {
    if (k.toLowerCase() === want) return headers[k];
  }
  return undefined;
}

function refuse(status, reason) {
  return { ok: false, status, reason };
}

// True when sha256(token) equals one listed hash. Every listed hash is compared, so the time
// does not depend on which entry matches.
function tokenMatches(token, hashes) {
  const got = crypto.createHash('sha256').update(token, 'utf8').digest();
  let match = false;
  for (const hex of hashes) {
    const want = Buffer.from(hex, 'hex');
    if (want.length !== got.length) continue;
    if (crypto.timingSafeEqual(got, want)) match = true;
  }
  return match;
}

function installBucket(id) {
  return crypto.createHash('sha256').update('mos-decision-relay/install/' + id, 'utf8').digest('hex').slice(0, 32);
}

// verifyCaller(headers, cfg) -> { ok: true, kind, bucket } | { ok: false, status, reason }
function verifyCaller(headers, cfg) {
  const c = cfg || {};
  const auth = headerValue(headers, 'authorization');
  if (auth !== undefined) {
    if (typeof auth !== 'string') return refuse(401, 'bad_token');
    const m = BEARER_RE.exec(auth);
    const hashes = Array.isArray(c.operatorHashes) ? c.operatorHashes : [];
    if (!m || hashes.length === 0 || !tokenMatches(m[1], hashes)) return refuse(401, 'bad_token');
    return { ok: true, kind: 'operator', bucket: 'operator' };
  }
  const id = headerValue(headers, installIdHeaderName);
  if (id === undefined) return refuse(401, 'no_caller');
  if (typeof id !== 'string' || !INSTALL_ID_RE.test(id)) return refuse(401, 'bad_install_id');
  if (c.userTraffic !== true) return refuse(403, 'user_traffic_off');
  return { ok: true, kind: 'install', bucket: installBucket(id) };
}

module.exports = { verifyCaller, headerValue };
