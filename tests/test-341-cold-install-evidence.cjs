#!/usr/bin/env node
'use strict';

/*
 * Phase 341 Plan 06 -- gate over docs/install/COLD-INSTALL-PROOF-341.md.
 *
 * WAIVER VARIANT. Plan 341-06 Task 2 (the three-platform cold install) was
 * WAIVED by the navigator on 2026-10-28 and was NOT observed. So this gate
 * does not check for three envelopes. It checks that the record is HONEST:
 *   - it exists and states the status "WAIVED by the navigator, not observed";
 *   - it quotes the navigator ruling verbatim;
 *   - it never says PROVEN (nothing was proven);
 *   - it carries no win32 or darwin envelope and no invented result;
 *   - it lists what was not observed;
 *   - it carries the Windows-on-ARM gap and the Tri-Polar DEFERRED line;
 *   - it has no placeholder and no em-dash or en-dash.
 * If real envelopes are ever recorded, replace the record and tighten this
 * gate back to the plan's nine-arm form (three envelopes, npm source,
 * completion record, two MCP servers loading).
 *
 * Optional argv[2]: path to a doc to check instead of the real one (used to
 * demonstrate that the gate fails on a doctored record).
 * Zero network.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const DOC = process.argv[2] || path.join(REPO_ROOT, 'docs', 'install', 'COLD-INSTALL-PROOF-341.md');
const RULING = 'i pprove imagisn that we did theis and it a go !';

let pass = 0;
let fail = 0;
function arm(name, ok, detail) {
  if (ok) { pass++; console.log('  PASS: ' + name); }
  else { fail++; console.log('  FAIL: ' + name + (detail ? ' -- ' + detail : '')); }
}

console.log('=== 341-06 cold-install record gate (waiver variant) ===');

let text = '';
const exists = fs.existsSync(DOC);
arm('record file exists', exists, DOC);
if (exists) text = fs.readFileSync(DOC, 'utf8');

function section(heading) {
  const re = new RegExp('^#{1,6}\\s+' + heading + '\\s*$', 'im');
  const m = re.exec(text);
  if (!m) return null;
  const rest = text.slice(m.index + m[0].length);
  const next = /^#{1,6}\s+/m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}

arm('states "WAIVED by the navigator, not observed"',
  /\*\*Status:\*\*\s*WAIVED by the navigator, not observed/.test(text));
arm('quotes the navigator ruling verbatim', text.includes('"' + RULING + '"'));
arm('never says PROVEN (nothing was observed)', !/PROVEN/.test(text));
arm('carries no win32 or darwin platform envelope',
  !/"platform"\s*:\s*"(win32|darwin)"/.test(text));
arm('carries no fenced JSON block (no envelope is claimed)', !/```json/i.test(text));

const notObs = section('Not observed') || '';
arm('has a "Not observed" section', notObs.length > 0);
arm('Not observed lists the Windows run', /windows/i.test(notObs) && /NOT OBSERVED/.test(notObs));
arm('Not observed lists the macOS run', /macos/i.test(notObs));
arm('Not observed lists first_install_seconds', /first_install_seconds/.test(notObs));
arm('Not observed lists the eureka enable smoke', /eureka enable/.test(notObs));

const tri = section('Tri-Polar posture') || '';
arm('Tri-Polar posture section says DEFERRED', /DEFERRED/.test(tri));
arm('Windows-on-ARM gap recorded', /sqlite-vec-windows-arm64/.test(text) && /Windows on ARM/.test(text));
arm('has a "What the collector measured on Linux" section',
  (section('What the collector measured on Linux') || '').length > 0);

arm('no placeholder (TBD, TODO, FIXME, xxx)', !/\b(TBD|TODO|FIXME)\b|xxx/i.test(text));
arm('no em-dash', !text.includes(String.fromCharCode(0x2014)));
arm('no en-dash', !text.includes(String.fromCharCode(0x2013)));

console.log('');
console.log('PASS=' + pass + ' FAIL=' + fail);
process.exit(fail === 0 ? 0 : 1);
