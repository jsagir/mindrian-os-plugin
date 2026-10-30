'use strict';
/**
 * loopback-guard.cjs -- shared guard for the local room previews.
 *
 * Quick 261030-et9. Findings T6-03 and T6-08.
 *
 * T6-03: a preview that calls listen(port) with no host listens on every network
 *        address, and a wildcard CORS header lets a web page of another site read it.
 *        The previews now listen on LOOPBACK_HOST and use corsHeaders().
 * T6-08: a DNS rebinding page reaches a loopback server under its own host name.
 *        refuseForeignHost() answers 403 when the Host header is not localhost,
 *        127.0.0.1 or [::1].
 *
 * Host check and the port (DV-1): hostHeaderAllowed() checks the host name only.
 * A port in the header must be 1 to 5 digits, but it is not compared with the
 * server port. The host name alone blocks DNS rebinding, because a rebinding page
 * always sends its own name. A port compare adds no protection and breaks an SSH
 * or editor port forward to a different local port.
 *
 * The ::1 limit: the previews bind 127.0.0.1 only. A client that tries only ::1 for
 * localhost and never falls back cannot connect. Node 22 and browsers fall back.
 *
 * Part 8: this module holds no room data and makes no network call. It reads only
 * the Host and Origin strings of a request.
 */

const LOOPBACK_HOST = '127.0.0.1';

const ALLOWED_NAMES = new Set(['localhost', '127.0.0.1', '[::1]']);
const BRACKET_RE = /^(\[[0-9a-f:.]+\])(?::(\d{1,5}))?$/;
const NAME_RE = /^([^:[\]@/\s]+)(?::(\d{1,5}))?$/;

/**
 * True when the Host header names this computer: localhost, 127.0.0.1 or [::1],
 * in any letter case, with or without a port.
 * @param {unknown} hostHeader
 * @returns {boolean}
 */
function hostHeaderAllowed(hostHeader) {
  if (typeof hostHeader !== 'string') return false;
  const value = hostHeader.trim().toLowerCase();
  if (value === '') return false;
  const m = BRACKET_RE.exec(value) || NAME_RE.exec(value);
  if (!m) return false;
  if (!ALLOWED_NAMES.has(m[1])) return false;
  if (m[2] !== undefined) {
    const port = Number(m[2]);
    if (!(port >= 1 && port <= 65535)) return false;
  }
  return true;
}

/**
 * CORS headers for a response. Only the own origin of the server is echoed.
 * Never returns '*'.
 * @param {unknown} reqOrigin - the Origin header of the request
 * @param {number} port - the port of the server (req.socket.localPort)
 * @returns {Object<string,string>}
 */
function corsHeaders(reqOrigin, port) {
  if (typeof reqOrigin !== 'string') return {};
  if (!Number.isInteger(port) || port <= 0) return {};
  if (reqOrigin === 'http://localhost:' + port || reqOrigin === 'http://127.0.0.1:' + port) {
    return { 'Access-Control-Allow-Origin': reqOrigin, 'Vary': 'Origin' };
  }
  return {};
}

/**
 * Answer 403 and return true when the Host header is not a loopback name.
 * The body does not echo the Host value.
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {boolean} true when the request was refused
 */
function refuseForeignHost(req, res) {
  if (hostHeaderAllowed(req && req.headers && req.headers.host)) return false;
  res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Forbidden');
  return true;
}

/**
 * Express middleware form of refuseForeignHost.
 */
function expressHostGuard(req, res, next) {
  if (!refuseForeignHost(req, res)) next();
}

module.exports = {
  LOOPBACK_HOST,
  hostHeaderAllowed,
  corsHeaders,
  refuseForeignHost,
  expressHostGuard,
};
