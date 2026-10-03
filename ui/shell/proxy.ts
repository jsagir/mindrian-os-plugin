import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getConfig } from './server/config.ts';
import { newNonce, securityHeaders } from './server/csp.ts';
import { checkRequest } from './server/origin-guard.ts';

// Every request, page or asset or route, passes the Host and Origin allow-list first (403 otherwise),
// then gets a per-response nonce in the Content-Security-Policy. The nonce is also placed on the
// request's own CSP header so the chassis stamps it on its inline hydration scripts.
export function proxy(request: NextRequest) {
  const guard = checkRequest(request.headers, getConfig().port);
  if (!guard.ok) {
    return new NextResponse('Forbidden', { status: 403, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
  }
  const nonce = newNonce();
  const sec = securityHeaders(nonce);
  const forwarded = new Headers(request.headers);
  forwarded.set('x-nonce', nonce);
  forwarded.set('Content-Security-Policy', sec['Content-Security-Policy']!);
  const response = NextResponse.next({ request: { headers: forwarded } });
  for (const [k, v] of Object.entries(sec)) response.headers.set(k, v);
  return response;
}

export const config = { matcher: ['/:path*'] };
