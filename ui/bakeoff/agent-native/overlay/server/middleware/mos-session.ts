// Candidate B: set the browser session cookie on first load (HttpOnly,
// SameSite=Strict, loopback only). Actions and feed routes refuse any request
// without a cookie this process issued.
import { defineEventHandler, getCookie, setCookie } from "h3";
import { SESSION_COOKIE, isIssuedSession, issueSession } from "../lib/session";

export default defineEventHandler((event) => {
  const current = getCookie(event, SESSION_COOKIE);
  if (isIssuedSession(current)) return;
  setCookie(event, SESSION_COOKIE, issueSession(), {
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: false,
  });
});
