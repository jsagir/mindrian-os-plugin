/*
 * control.ts -- the launcher's channel to a running shell server (T-369-19-06).
 *
 * At server start a random control token is written to MOS_SHELL_CONTROL_TOKEN_FILE (mode 0600,
 * directory 0700, created exclusively; a symlink at the path stops the server). `POST /control/bootstrap`
 * with that token in the x-mos-control-token header arms EITHER { sha256 } for a fresh one-time link or
 * { start: true } for the secret-free /auth/start slot (CR-01). With sha256 the launcher mints the code
 * and sends only its hash, so the code never appears in a process argument list. The endpoint answers loopback requests with the
 * token only: it never reads a cookie, and it refuses any request that carries an Origin or
 * Sec-Fetch-Site header, because those come from a browser page and the launcher is not one.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, closeSync, existsSync, lstatSync, mkdirSync, openSync, unlinkSync, writeSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BootstrapStore } from './bootstrap.ts';
import { DEFAULT_BOOTSTRAP_TTL_MS, getBootstrapStore } from './bootstrap.ts';
import { getConfig } from './config.ts';
import { expectedHost } from './origin-guard.ts';
import type { HeaderBag } from './origin-guard.ts';

export const CONTROL_TOKEN_HEADER = 'x-mos-control-token';
const MAX_BODY_BYTES = 1024;

export type ControlState = { token: string; file: string };

// Quick 261004-av2 (CR-02 option 2): the control token's SECOND use, domain separated by the label below. Canon
// Part 9: how a gate answer reached the room is proven by the route, not asserted. approveDecision (the one
// caller, after nonces.reserve accepted the render nonce) mints a proof bound to the gate id and the nonce;
// the daemon (lib/mcp/answer-route.cjs, the same two literals) recomputes it from the 0600 token FILE and
// records answered_via browser_nonce only on a match. The raw nonce never leaves this function: only its
// SHA-256 tag does. Residual, owned by SEED-114: a same-user process that can read the 0600 token can mint it.
export const ANSWER_ROUTE_META_KEY = 'mindrian/answer_route';
export const ANSWER_ROUTE_KEY_LABEL = 'mindrian answer route v1';

export function answerRouteMeta(gateId: string, nonce: string): Record<string, unknown> | null {
  const control = getControl();
  if (!control || typeof gateId !== 'string' || gateId.length === 0 || typeof nonce !== 'string' || nonce.length === 0) return null;
  const routeKey = createHmac('sha256', control.token.trim()).update(ANSWER_ROUTE_KEY_LABEL).digest();
  const tag = createHash('sha256').update(nonce).digest('hex');
  const mac = createHmac('sha256', routeKey).update(gateId + '\n' + tag).digest('hex');
  return { [ANSWER_ROUTE_META_KEY]: { v: 1, tag, mac } };
}

// WR-14 (plan 369-37): the token file is created exclusively with mode 0600. A file that is already there is
// replaced, never written into (a planted file keeps its owner, mode and other hard links); a symbolic link at
// the path stops the server from starting; and a directory this call did not create is never chmodded.
export function writeControlToken(file: string): string {
  const token = randomBytes(32).toString('base64url');
  const dir = dirname(file);
  const createdDir = !existsSync(dir);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (createdDir) chmodSync(dir, 0o700); // only a directory we just made; the umask must not narrow it wrongly
  let existing: ReturnType<typeof lstatSync> | null = null;
  try {
    existing = lstatSync(file);
  } catch {
    existing = null;
  }
  if (existing) {
    if (existing.isSymbolicLink()) throw new Error('control token path is a symbolic link: ' + file);
    if (existing.isDirectory()) throw new Error('control token path is a directory: ' + file);
    unlinkSync(file);
  }
  // 'wx' is O_CREAT | O_EXCL: it fails if anything (a symlink planted after the check above) exists at the path.
  const fd = openSync(file, 'wx', 0o600);
  try {
    writeSync(fd, token + '\n');
  } finally {
    closeSync(fd);
  }
  return token;
}

const SLOT = Symbol.for('mos.shell.control');

export function startControl(file: string): ControlState {
  const g = globalThis as Record<symbol, unknown>;
  const state: ControlState = { token: writeControlToken(file), file };
  g[SLOT] = state;
  return state;
}

export function getControl(): ControlState | null {
  const g = globalThis as Record<symbol, unknown>;
  return (g[SLOT] as ControlState | undefined) ?? null;
}

export type ControlResult = { status: number; body: Record<string, unknown> };

export function handleControlBootstrap(
  req: { headers: HeaderBag; port: number; bodyText: string },
  deps: { token: string | null; bootstrap: BootstrapStore },
): ControlResult {
  if (req.headers.get('host') !== expectedHost(req.port)) return { status: 403, body: { ok: false, reason: 'bad_host' } };
  // A browser page is never the launcher.
  if (req.headers.get('origin') !== null || req.headers.get('sec-fetch-site') !== null) {
    return { status: 403, body: { ok: false, reason: 'browser_request' } };
  }
  const given = req.headers.get(CONTROL_TOKEN_HEADER);
  if (!deps.token || !given) return { status: 401, body: { ok: false, reason: 'token_required' } };
  const a = Buffer.from(given);
  const b = Buffer.from(deps.token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { status: 401, body: { ok: false, reason: 'token_required' } };

  if (Buffer.byteLength(req.bodyText) > MAX_BODY_BYTES) return { status: 413, body: { ok: false, reason: 'too_large' } };
  let parsed: unknown;
  try {
    parsed = JSON.parse(req.bodyText);
  } catch {
    return { status: 400, body: { ok: false, reason: 'bad_json' } };
  }
  const rec = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  const hasSha = 'sha256' in rec;
  const hasStart = 'start' in rec;
  // Exactly one of { sha256 } (arm a one-time code) or { start: true } (arm the secret-free start slot).
  if (hasSha && hasStart) return { status: 400, body: { ok: false, reason: 'one_of_sha256_or_start' } };
  if (hasStart) {
    if (rec['start'] !== true) return { status: 400, body: { ok: false, reason: 'bad_start' } };
    deps.bootstrap.armStart(DEFAULT_BOOTSTRAP_TTL_MS);
    return { status: 200, body: { ok: true, expires_in_ms: DEFAULT_BOOTSTRAP_TTL_MS } };
  }
  const sha = rec['sha256'];
  if (typeof sha !== 'string' || !/^[0-9a-f]{64}$/i.test(sha)) return { status: 400, body: { ok: false, reason: 'bad_sha256' } };
  deps.bootstrap.arm(sha, DEFAULT_BOOTSTRAP_TTL_MS);
  return { status: 200, body: { ok: true, expires_in_ms: DEFAULT_BOOTSTRAP_TTL_MS } };
}

// What the shell server does once, when it starts (called from instrumentation.ts): validate the
// environment (refusing any daemon host but 127.0.0.1), write the control token, and arm the sha256
// the launcher passed in the environment. A bad configuration ends the process: a shell that is
// listening but cannot answer is worse than none.
export function startShellServer(): void {
  try {
    const config = getConfig();
    startControl(config.controlTokenFile);
    if (config.bootstrapSha256) getBootstrapStore().arm(config.bootstrapSha256);
  } catch (err) {
    console.error('mos-ui-shell refused to start: ' + (err instanceof Error ? err.message : String(err)));
    process.exit(1);
  }
}
