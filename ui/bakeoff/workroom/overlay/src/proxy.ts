import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { SESSION_COOKIE, mintSessionCookie, verifySessionCookie } from './server/session';

// Issues the per-process browser session cookie on the first page load
// (HttpOnly, SameSite=Strict). Only pages are matched: the action and feed
// routes refuse a request that has no valid cookie rather than minting one.
export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  if (!verifySessionCookie(request.cookies.get(SESSION_COOKIE)?.value)) {
    response.cookies.set(SESSION_COOKIE, mintSessionCookie(), {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
    });
  }
  return response;
}

export const config = {
  matcher: ['/((?!api/|_next/|favicon.ico|icon.svg).*)'],
};
