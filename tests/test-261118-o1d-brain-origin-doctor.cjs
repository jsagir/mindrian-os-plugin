#!/usr/bin/env node
'use strict';

/*
 * Quick 261118-o1d (O1D-03): the brain-origin doctor module warns, read-only, when
 * ~/.claude.json holds an MCP entry at a retired Theo host, or MINDRIAN_BRAIN_URL names a
 * host other than the default.
 *
 *   D1  no override, no retired entry: ok, and the detail names the default host.
 *   D2  top-level entry pws-brain-mcp at the retired host: warn, line has "claude mcp remove pws-brain-mcp -s user".
 *   D3  the same entry under projects[projectDir].mcpServers: the line has "-s local".
 *   D4  MINDRIAN_BRAIN_URL = https://example.test: warn, the line names example.test and the default host.
 *   D5  MINDRIAN_BRAIN_URL equal to CANON_BRAIN_URL: ok.
 *   D6  MINDRIAN_BRAIN_URL = "not a url": warn with the "not a web address" line.
 *   D7  the config file bytes and mtime do not change after check() (read-only).
 *   D8  secret hygiene: no header value, no query value, no password reaches any string.
 *   D9  a missing config path never throws.
 *   D10 the module exports check and not fix; the registry row is declared as required.
 *   D11 the module source holds no em dash, no en dash and no onrender.com literal.
 *
 * Node built-ins only. Every fake .claude.json lives in a new mkdtemp folder, and ctx passes
 * env, claudeConfigPath and projectDir, so the real ~/.claude.json and the real env are never read.
 *
 * No em dashes or en dashes.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const MODULE = path.join(ROOT, 'lib', 'core', 'doctor', 'brain-origin-module.cjs');

let failed = 0;
const tmpDirs = [];
function mkTmp() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-o1d-origin-'));
  tmpDirs.push(d);
  return d;
}
function check(name, cond, note) {
  if (cond) {
    process.stdout.write('ok ' + name + (note ? ' (' + note + ')' : '') + '\n');
  } else {
    failed += 1;
    process.stdout.write('FAIL ' + name + (note ? ' (' + note + ')' : '') + '\n');
  }
}

function main() {
  if (!fs.existsSync(MODULE)) {
    check('D0 module exists', false, 'lib/core/doctor/brain-origin-module.cjs');
    return;
  }
  const mod = require(MODULE);
  const smoke = require(path.join(ROOT, 'lib', 'core', 'doctor', 'class-m-brain-smoke.cjs'));
  const RETIRED = smoke.RETIRED_BRAIN_HOSTS[0];
  const DEFAULT_HOST = new URL(smoke.CANON_BRAIN_URL).host;
  const PROJECT = '/work/demo-project';

  const writeConfig = (obj) => {
    const dir = mkTmp();
    const p = path.join(dir, '.claude.json');
    fs.writeFileSync(p, JSON.stringify(obj), 'utf8');
    return p;
  };
  const run = (config, env) => mod.check({ env: env || {}, claudeConfigPath: config, projectDir: PROJECT });
  const lines = (r) => (Array.isArray(r.action_lines) ? r.action_lines : []);
  const all = (r) => [r.detail].concat(lines(r)).join('\n');

  // D1
  {
    const cfg = writeConfig({ mcpServers: { other: { type: 'http', url: 'https://theo.example.test/mcp' } } });
    const r = run(cfg);
    check('D1 ok with no override and no retired entry', r.status === 'ok', r.status);
    check('D1 detail names the default host', String(r.detail).includes(DEFAULT_HOST));
  }
  // D2
  {
    const cfg = writeConfig({ mcpServers: { 'pws-brain-mcp': { type: 'http', url: 'https://' + RETIRED + '/mcp' } } });
    const r = run(cfg);
    check('D2 warn on the retired entry', r.status === 'warn', r.status);
    check('D2 one line has the user-scope remove command', lines(r).some((l) => l.includes('claude mcp remove pws-brain-mcp -s user')));
  }
  // D3
  {
    const cfg = writeConfig({ projects: { [PROJECT]: { mcpServers: { 'pws-brain-mcp': { type: 'http', url: 'https://' + RETIRED + '/mcp' } } } } });
    const r = run(cfg);
    check('D3 warn on the local-scope entry', r.status === 'warn', r.status);
    check('D3 line has -s local', lines(r).some((l) => l.includes('claude mcp remove pws-brain-mcp -s local')));
  }
  // D4
  {
    const cfg = writeConfig({});
    const r = run(cfg, { MINDRIAN_BRAIN_URL: 'https://example.test' });
    check('D4 warn on a non-default host', r.status === 'warn', r.status);
    check('D4 line names the override host and the default host', lines(r).some((l) => l.includes('example.test') && l.includes(DEFAULT_HOST)));
  }
  // D5
  {
    const cfg = writeConfig({});
    const r = run(cfg, { MINDRIAN_BRAIN_URL: smoke.CANON_BRAIN_URL });
    check('D5 ok when MINDRIAN_BRAIN_URL equals the default', r.status === 'ok', r.status);
  }
  // D6
  {
    const cfg = writeConfig({});
    const r = run(cfg, { MINDRIAN_BRAIN_URL: 'not a url' });
    check('D6 warn on a value that is not a web address', r.status === 'warn', r.status);
    check('D6 line says not a web address', lines(r).some((l) => l.includes('not a web address')));
  }
  // D7
  {
    const cfg = writeConfig({ mcpServers: { 'pws-brain-mcp': { type: 'http', url: 'https://' + RETIRED + '/mcp' } } });
    const before = fs.readFileSync(cfg);
    const mtimeBefore = fs.statSync(cfg).mtimeMs;
    run(cfg, { MINDRIAN_BRAIN_URL: 'https://example.test' });
    const after = fs.readFileSync(cfg);
    check('D7 config bytes unchanged', Buffer.compare(before, after) === 0);
    check('D7 config mtime unchanged', fs.statSync(cfg).mtimeMs === mtimeBefore);
  }
  // D8
  {
    const cfg = writeConfig({
      mcpServers: {
        'pws-brain-mcp': {
          type: 'http',
          url: 'https://' + RETIRED + '/mcp?token=canary-q',
          headers: { Authorization: 'Bearer canary-secret-1' },
          env: { KEY: 'canary-env' },
        },
      },
    });
    const r = run(cfg, { MINDRIAN_BRAIN_URL: 'https://u:canary-pass@example.test/mcp?token=canary-q' });
    check('D8 still warns', r.status === 'warn', r.status);
    check('D8 no canary in any detail or action line', !/canary/.test(all(r)), all(r).slice(0, 200));
  }
  // D9
  {
    let threw = false;
    let r = null;
    try { r = run(path.join(mkTmp(), 'does-not-exist.json')); } catch (_e) { threw = true; }
    check('D9 missing config does not throw', !threw);
    check('D9 missing config gives ok or warn', !!r && (r.status === 'ok' || r.status === 'warn'), r && r.status);
  }
  // D10
  {
    check('D10 exports check', typeof mod.check === 'function');
    check('D10 does not export fix', !('fix' in mod));
    const reg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'doctor-modules.json'), 'utf8'));
    const row = reg.modules.find((m) => m.id === 'brain-origin');
    check('D10 registry row exists', !!row);
    check('D10 registry row fields', !!row && row.runner === 'lib/core/doctor/brain-origin-module.cjs'
      && row.cadence === 'always' && row.flag === null && row.fix_supported === false);
  }
  // D11
  {
    const src = fs.readFileSync(MODULE, 'utf8');
    check('D11 no em dash or en dash', !new RegExp('[' + String.fromCharCode(0x2013) + String.fromCharCode(0x2014) + ']').test(src));
    check('D11 no onrender.com literal', !/onrender\.com/.test(src));
  }
}

try {
  main();
} catch (e) {
  failed += 1;
  process.stdout.write('ERROR ' + (e && e.stack ? e.stack : e) + '\n');
}
for (const d of tmpDirs) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (_e) { /* ignore */ } }
process.stdout.write(failed === 0 ? 'ALL PASS\n' : 'FAILED: ' + failed + '\n');
process.exit(failed === 0 ? 0 : 1);
