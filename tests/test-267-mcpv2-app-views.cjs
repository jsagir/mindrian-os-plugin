#!/usr/bin/env node
'use strict';

// Phase 267 Plan 10 (MCPV2-04) -- RCA 2 wire test:
// .planning/debug/app-views-schema-key-drops-input-schemas.md
//
// lib/mcp/app-views.cjs passed `schema:` instead of `inputSchema:` at the three
// registerAppTool configs, so room-dashboard, room-wiki and room-graph
// published EMPTY input schemas and their handlers never received room_path,
// section or layout. Fixing that turns room_path live, which is a new read
// surface (a model-chosen directory), so the fix ships with realpath
// containment: room_path is honored only when it is STRICTLY INSIDE the rooms
// home (an individual room folder). Outside paths, symlinks out of the home
// and the rooms home itself (plan-checker W2) are refused with isError.
//
// Drives the real local stdio server (hermetic env, desktop surface so MCP
// Apps register). Node built-ins + tests/helpers/mcp-wire-267.cjs only.
// No em-dashes. CJS only.

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { hermeticEnv, rpcOverStdio, LOCAL_SERVER } = require('./helpers/mcp-wire-267.cjs');

let passCount = 0;
let failCount = 0;

function check(cond, label, detail) {
  if (cond) {
    passCount += 1;
    console.log('PASS: ' + label);
  } else {
    failCount += 1;
    console.log('FAIL: ' + label + (detail ? ' -- ' + detail : ''));
  }
}

const SENTINEL = 'APPVIEW-OUTSIDE-SENTINEL';
const ROOMS_HOME_SENTINEL = 'APPVIEW-ROOMSHOME-SENTINEL';

function toolText(resp) {
  const c = resp && resp.result && resp.result.content;
  return Array.isArray(c) ? c.map((x) => x.text || '').join('') : '';
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch (_e) {
    return null;
  }
}

async function main() {
  const { env, dirs, cleanup } = hermeticEnv();
  const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-views-267-outside-'));
  try {
    // Fixture: a section with one .md inside room-267.
    const sectionDir = path.join(dirs.roomDir, 'problem-definition');
    fs.mkdirSync(sectionDir, { recursive: true });
    fs.writeFileSync(path.join(sectionDir, 'entry-one.md'), '# Entry One\n\nSynthetic fixture body.\n');

    // Outside dir: a STATE.md carrying the sentinel, plus a section dir with a sentinel .md.
    fs.writeFileSync(path.join(outsideDir, 'STATE.md'), '---\nname: ' + SENTINEL + '\n---\n# ' + SENTINEL + '\n');
    fs.mkdirSync(path.join(outsideDir, 'secret-section'), { recursive: true });
    fs.writeFileSync(path.join(outsideDir, 'secret-section', 'leak.md'), '# APPVIEW-OUTSIDE-SENTINEL\n\n' + SENTINEL + '\n');

    // Symlink INSIDE the rooms home pointing at the outside dir.
    const linkPath = path.join(dirs.roomsHome, 'link-out');
    fs.symlinkSync(outsideDir, linkPath, 'dir');

    // Rooms home itself carries a top-level STATE.md with its own sentinel (so a
    // rooms-home read would be visible in the response).
    fs.writeFileSync(path.join(dirs.roomsHome, 'STATE.md'), '---\nname: ' + ROOMS_HOME_SENTINEL + '\n---\n# ' + ROOMS_HOME_SENTINEL + '\n');

    const realHome = fs.realpathSync(dirs.roomsHome);

    const requests = [
      { method: 'tools/list' }, // 2
      { method: 'tools/call', params: { name: 'room-wiki', arguments: { room_path: dirs.roomDir, section: 'problem-definition' } } }, // 3
      { method: 'tools/call', params: { name: 'room-graph', arguments: { room_path: dirs.roomDir, layout: 'circle' } } }, // 4
      { method: 'tools/call', params: { name: 'room-dashboard', arguments: { room_path: outsideDir } } }, // 5 outside
      { method: 'tools/call', params: { name: 'room-dashboard', arguments: { room_path: linkPath } } }, // 6 symlink out
      { method: 'tools/call', params: { name: 'room-dashboard', arguments: { room_path: dirs.roomsHome } } }, // 7 rooms home itself
      { method: 'tools/call', params: { name: 'room-dashboard', arguments: {} } }, // 8 boot room fallback
      { method: 'tools/call', params: { name: 'room-wiki', arguments: { room_path: outsideDir } } }, // 9 outside via wiki
      { method: 'tools/call', params: { name: 'room-graph', arguments: { room_path: dirs.roomsHome } } }, // 10 home via graph
      { method: 'tools/call', params: { name: 'room-dashboard', arguments: { room_path: path.join(dirs.roomsHome, 'room-267', '..') } } }, // 11 dotdot to home
      { method: 'tools/call', params: { name: 'room-dashboard', arguments: { room_path: dirs.roomDir } } }, // 12 happy path
    ];
    const { responses } = await rpcOverStdio(LOCAL_SERVER, requests, { env, timeoutMs: 30000 });

    // ---- Schema arm ----
    const listResp = responses.get(2);
    const tools = (listResp && listResp.result && listResp.result.tools) || [];
    const byName = (n) => tools.find((t) => t.name === n);
    const props = (n) => (byName(n) && byName(n).inputSchema && byName(n).inputSchema.properties) || {};

    check(
      Object.prototype.hasOwnProperty.call(props('room-dashboard'), 'room_path'),
      'schema: room-dashboard publishes room_path',
      JSON.stringify(props('room-dashboard'))
    );
    check(
      Object.prototype.hasOwnProperty.call(props('room-wiki'), 'room_path') &&
        Object.prototype.hasOwnProperty.call(props('room-wiki'), 'section'),
      'schema: room-wiki publishes room_path and section',
      JSON.stringify(props('room-wiki'))
    );
    const layoutEnum = props('room-graph').layout && props('room-graph').layout.enum;
    check(
      Object.prototype.hasOwnProperty.call(props('room-graph'), 'room_path') &&
        Array.isArray(layoutEnum) &&
        JSON.stringify(layoutEnum.slice().sort()) === JSON.stringify(['breadthfirst', 'circle', 'cose', 'grid']),
      'schema: room-graph publishes room_path and layout enum [cose, circle, grid, breadthfirst]',
      JSON.stringify(props('room-graph'))
    );

    // ---- Argument delivery arm ----
    const wikiData = parseJson(toolText(responses.get(3)));
    check(
      !!wikiData && wikiData._activeSection === 'problem-definition',
      'args: room-wiki receives section (_activeSection is problem-definition)',
      toolText(responses.get(3)).slice(0, 200)
    );
    check(
      !!wikiData && wikiData.name === 'room-267',
      'args: room-wiki receives room_path (name is room-267)',
      toolText(responses.get(3)).slice(0, 200)
    );
    const graphData = parseJson(toolText(responses.get(4)));
    check(
      !!graphData && graphData._layout === 'circle',
      'args: room-graph receives layout (_layout is circle)',
      toolText(responses.get(4)).slice(0, 200)
    );

    // ---- Containment arm (outside, symlink, rooms-home-itself) ----
    function refused(id, label, sentinels) {
      const r = responses.get(id);
      const text = toolText(r);
      check(!!r && r.result && r.result.isError === true, label + ': isError true', JSON.stringify(r).slice(0, 300));
      for (const s of sentinels) {
        check(!JSON.stringify(r || {}).includes(s), label + ': ' + s + ' absent from response');
      }
      return text;
    }

    refused(5, 'containment: room-dashboard room_path OUTSIDE rooms home', [SENTINEL]);
    refused(6, 'containment: room-dashboard room_path symlink inside home pointing outside', [SENTINEL]);
    const homeText = refused(7, 'containment: room-dashboard room_path = rooms home itself (W2)', [ROOMS_HOME_SENTINEL, 'room-267']);
    check(
      /rooms home|not the rooms home|inside a room/i.test(homeText),
      'containment: rooms-home-itself refusal carries its own distinct reason (not the outside-path reason)',
      homeText
    );
    refused(9, 'containment: room-wiki room_path OUTSIDE rooms home', [SENTINEL]);
    refused(10, 'containment: room-graph room_path = rooms home itself (W2)', [ROOMS_HOME_SENTINEL]);
    refused(11, 'containment: room-dashboard room_path = home via ..', [ROOMS_HOME_SENTINEL]);

    // ---- Fallback arm ----
    const fallback = parseJson(toolText(responses.get(8)));
    check(
      !!fallback && fallback.name === 'room-267' && !(responses.get(8).result && responses.get(8).result.isError),
      'fallback: room-dashboard with no room_path returns the boot room (room-267)',
      toolText(responses.get(8)).slice(0, 200)
    );

    // ---- Happy path: an in-home room_path is honored ----
    const happy = parseJson(toolText(responses.get(12)));
    check(
      !!happy && happy.name === 'room-267' && Array.isArray(happy.sections) && happy.sections.some((s) => s.id === 'problem-definition'),
      'containment: room_path strictly inside the rooms home is honored',
      toolText(responses.get(12)).slice(0, 200)
    );

    void realHome;
  } finally {
    cleanup();
    try {
      fs.rmSync(outsideDir, { recursive: true, force: true });
    } catch (_e) {
      /* best effort */
    }
  }

  console.log('\nPASS=' + passCount + ' FAIL=' + failCount);
  process.exit(failCount === 0 ? 0 : 1);
}

main().catch((e) => {
  console.log('FAIL: test threw -- ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
