'use strict';
/*
 * lib/core/doctor/brain-origin-module.cjs -- doctor module for the Theo address.
 * Quick 261118-o1d (O1D-03). Warns, with a plain fix line, when:
 *   - ~/.claude.json (Claude Code) holds an MCP entry whose url host is a retired Theo host, or
 *   - MINDRIAN_BRAIN_URL names a host other than the default.
 * Either one makes Claude report Theo as off even though Theo is up.
 *
 * Reuse before build (Canon Part 7, PD-03): Class M layer L0 (class-m-brain-smoke.cjs) already reads
 * ~/.claude.json, but it runs only under --brain-smoke or --all and makes a live Theo call. This
 * signal must show on a bare run with no network. So this module reuses the same reader
 * (readScopedMcpServers) and the same canon constant (CANON_BRAIN_URL, RETIRED_BRAIN_HOSTS). It adds
 * no second ~/.claude.json reader and no second origin literal.
 *
 * Contract: check(ctx) -> { status:'ok'|'warn'|'error', detail, action_lines? }.
 * fix_supported:false. NO fix export. Never writes (the fix line is for the person to run).
 * LOCAL facts only: no Brain call, no network (Canon Part 8). Every string carries a host or an
 * entry name only: never a full URL, a path, a query, a user name, a password, a header or an env value.
 * Optional ctx keys for tests: env, claudeConfigPath, projectDir.
 * No em dashes.
 */
const { CANON_BRAIN_URL, RETIRED_BRAIN_HOSTS } = require('./class-m-brain-smoke.cjs');
const { readScopedMcpServers } = require('../integration-registry.cjs');

function check(ctx) {
  try {
    ctx = ctx || {};
    const env = ctx.env || process.env;
    const defaultHost = new URL(CANON_BRAIN_URL).host;
    const lines = [];

    const raw = env.MINDRIAN_BRAIN_URL;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      let host = null;
      try {
        host = new URL(raw.trim()).host;
      } catch (_e) {
        host = null;
      }
      if (host === null || host === '') {
        lines.push('MINDRIAN_BRAIN_URL is set but is not a web address, so Theo cannot be reached. ' +
          'Delete it from your shell profile or settings env and restart Claude Code.');
      } else if (host !== defaultHost) {
        let line = 'MINDRIAN_BRAIN_URL sends Theo calls to ' + host + ', not the default ' + defaultHost + '.';
        if (RETIRED_BRAIN_HOSTS.includes(host)) line += ' That old address is switched off.';
        line += ' If you did not set it on purpose, delete MINDRIAN_BRAIN_URL from your shell profile ' +
          'or settings env and restart Claude Code.';
        lines.push(line);
      }
    }

    let servers = readScopedMcpServers({ configPath: ctx.claudeConfigPath, projectDir: ctx.projectDir });
    if (!Array.isArray(servers)) servers = [];
    for (const s of servers) {
      if (s && RETIRED_BRAIN_HOSTS.includes(s.url_host)) {
        lines.push('Theo moved to a new address. Claude Code still lists "' + s.name + '" (' + s.scope +
          ' scope) at ' + s.url_host + ', an old address that is switched off, so Claude reports Theo as off. ' +
          'Remove it: claude mcp remove ' + s.name + ' -s ' + s.scope);
      }
    }

    if (lines.length === 0) {
      return {
        status: 'ok',
        detail: 'Theo address is the default (' + defaultHost + '); no Claude Code MCP entry in ~/.claude.json points at a retired Theo address.',
      };
    }
    return {
      status: 'warn',
      detail: lines.length + ' Theo address problem' + (lines.length === 1 ? '' : 's') + ' found; Claude can report Theo as off while Theo is up.',
      action_lines: lines,
    };
  } catch (err) {
    return { status: 'error', detail: 'brain-origin check failed: ' + String((err && err.message) || err).slice(0, 160) };
  }
}

module.exports = { check };
