/*
 * csp.ts -- the UI-SPEC Content-Security-Policy (Egress, Privacy and Offline).
 *
 * The contract policy (UI-SPEC) allows only the shell's own origin for every fetch class and
 * forbids frames and objects. The bake-off (369-18) measured that applied verbatim it stops the
 * chassis's inline hydration scripts and BlockNote's inline style elements, so
 * 369-BAKEOFF-DECISION.md rules the nonce variant:
 * a per-response nonce on script-src and style-src, tightened only (base-uri, form-action,
 * frame-ancestors added). 'unsafe-inline' is never allowed without a navigator ruling.
 * A nonce does not cover a style ATTRIBUTE; the shell's own code therefore sets none.
 */
import { randomBytes } from 'node:crypto';

export function newNonce(): string {
  return randomBytes(16).toString('base64');
}

export function buildCsp(nonce: string): string {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(nonce)) throw new Error('csp: nonce must be base64');
  return [
    "default-src 'self'",
    "script-src 'self' 'nonce-" + nonce + "'",
    "connect-src 'self'",
    "font-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'nonce-" + nonce + "'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function securityHeaders(nonce: string): Record<string, string> {
  return {
    'Content-Security-Policy': buildCsp(nonce),
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
}
