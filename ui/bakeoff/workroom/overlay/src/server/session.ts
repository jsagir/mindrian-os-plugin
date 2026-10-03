/*
 * session.ts -- the bake-off browser session (candidate A).
 *
 * Plan 19 owns the real sign-in (a one-time bootstrap code exchanged for an
 * HttpOnly cookie, 369-SESSION-CONTRACT.md section 3). The bake-off needs a
 * browser session so the daemon can key room binding and gate ownership on it,
 * and uses a per-process random cookie: the first page load is issued an
 * opaque id signed with a secret that exists only in this server process, so a
 * cookie value from anywhere else is refused. This is recorded as a bake-off
 * stand-in, not the shipped sign-in.
 *
 * The secret lives on process.env because the proxy, the route handlers and
 * the pages are separate bundles that share one Node process: module state is
 * not shared between them, process.env is.
 *
 * Canon Part 8: nothing here touches a network. The request guard accepts only
 * a Host of 127.0.0.1 and refuses a cross-site request before any action runs.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'mos_sid';

function secret(): string {
  if (!process.env.MOS_BAKEOFF_SESSION_SECRET) {
    process.env.MOS_BAKEOFF_SESSION_SECRET = randomBytes(32).toString('hex');
  }
  return process.env.MOS_BAKEOFF_SESSION_SECRET;
}

function sign(id: string): string {
  return createHmac('sha256', secret()).update(id).digest('base64url');
}

export function mintSessionCookie(): string {
  const id = randomBytes(24).toString('base64url');
  return id + '.' + sign(id);
}

// Returns the session key (the opaque id) for a valid cookie, else null.
export function verifySessionCookie(value: string | undefined | null): string | null {
  if (!value || typeof value !== 'string') return null;
  const dot = value.indexOf('.');
  if (dot < 1) return null;
  const id = value.slice(0, dot);
  const given = Buffer.from(value.slice(dot + 1));
  const want = Buffer.from(sign(id));
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;
  return id;
}

export type GuardResult = { ok: true; sessionKey: string } | { ok: false; status: number; reason: string };

type HeaderBag = { get(name: string): string | null };

// The same-origin rules the session contract states for the exchange, applied
// to every action and feed request: Host must be loopback (DNS rebinding), an
// Origin must equal our own origin, a cross-site fetch is refused, and the
// cookie must verify.
export function guardRequest(headers: HeaderBag, cookieValue: string | undefined): GuardResult {
  const host = headers.get('host') || '';
  if (!/^127\.0\.0\.1(:\d+)?$/.test(host)) return { ok: false, status: 403, reason: 'bad_host' };
  const origin = headers.get('origin');
  if (origin && origin !== 'http://' + host) return { ok: false, status: 403, reason: 'bad_origin' };
  const site = headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return { ok: false, status: 403, reason: 'cross_site' };
  const sessionKey = verifySessionCookie(cookieValue);
  if (!sessionKey) return { ok: false, status: 401, reason: 'not_signed_in' };
  return { ok: true, sessionKey };
}
