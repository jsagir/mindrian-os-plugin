/*
 * control.ts -- the launcher's channel to a running shell server (T-369-19-06).
 *
 * At server start a random control token is written to MOS_SHELL_CONTROL_TOKEN_FILE (mode 0600,
 * directory 0700). `POST /control/bootstrap` with that token in the x-mos-control-token header arms
 * a new sha256 for a fresh one-time link (the launcher mints the code, sends only its hash, so the
 * code never appears in a process argument list). The endpoint answers loopback requests with the
 * token only: it never reads a cookie, and it refuses any request that carries an Origin or
 * Sec-Fetch-Site header, because those come from a browser page and the launcher is not one.
 */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { BootstrapStore } from './bootstrap.ts';
import { DEFAULT_BOOTSTRAP_TTL_MS, getBootstrapStore } from './bootstrap.ts';
import { getConfig } from './config.ts';
import { expectedHost } from './origin-guard.ts';
import type { HeaderBag } from './origin-guard.ts';

export const CONTROL_TOKEN_HEADER = 'x-mos-control-token';
const MAX_BODY_BYTES = 1024;

export type ControlState = { token: string; file: string };

export function writeControlToken(file: string): string {
  const token = randomBytes(32).toString('base64url');
  const dir = dirname(file);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  chmodSync(dir, 0o700);
  writeFileSync(file, token + '\n', { mode: 0o600 });
  chmodSync(file, 0o600); // the umask or a pre-existing file must not widen it
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
  const sha = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>)['sha256'] : undefined;
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
