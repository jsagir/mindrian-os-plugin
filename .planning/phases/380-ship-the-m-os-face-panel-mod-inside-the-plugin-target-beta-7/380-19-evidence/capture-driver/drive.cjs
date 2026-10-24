// Plan 380-10 scratch driver (not part of the product). Reuses the helpers of the capture harness (read only)
// to run one scripted session: scratch HOME and config, a throwaway room, a resumed synthetic transcript,
// slash commands only, never a prompt. Usage: node drive.cjs spec.json
'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const REL = '/home/jsagi/dev/MindrianOS-Plugin-release/ui/mos-face/scripts';
const P = require(REL + '/lib/ansi-page.cjs');
const T = require(REL + '/lib/tmux-session.cjs');

// commands this driver may type (all are panel commands; none is a model prompt)
const COMMANDS = new Set(['/mos-state', '/mos-tree', '/mos-advice', '/mos-job', '/mos-text', '/mos-refresh']);
for (const c of COMMANDS) if (!T.ALLOWED_SLASH.includes(c)) T.ALLOWED_SLASH.push(c); // this process only

const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const home = process.env.HOME;
const scrub = T.scrubWith(T.secretValues(process.env), home);

function sectionsFor(kind) {
  if (kind === 'many') {
    const names = ['market-analysis', 'problem-definition', 'legal-review', 'legal-contracts', 'customer-interviews', 'competitor-scan', 'pricing-tests', 'team-roster', 'funding-plan', 'risk-register', 'evidence-16', 'channel-tests', 'regulatory-notes', 'partner-list', 'product-brief', 'archive-2000', 'metrics-board', 'open-questions'];
    return names;
  }
  return ['market-analysis', 'problem-definition'];
}
function buildRoom(scratchHome, kind) {
  const roomsHome = path.join(scratchHome, 'MindrianRooms');
  const room = path.join(roomsHome, 'demo-room');
  fs.mkdirSync(path.join(roomsHome, '.rooms'), { recursive: true });
  const secs = sectionsFor(kind);
  const rows = [];
  for (const s of secs) {
    fs.mkdirSync(path.join(room, s), { recursive: true });
    let n = 3;
    if (s === 'evidence-16') n = 16; else if (s === 'archive-2000') n = 2000; else if (s.startsWith('legal')) n = 4; else if (kind !== 'many' && s === 'problem-definition') n = 0;
    for (let i = 1; i <= n; i += 1) fs.writeFileSync(path.join(room, s, 'entry-' + String(i).padStart(4, '0') + '.md'), '# Entry ' + i + '\n');
    rows.push('| ' + s + ' | ' + n + ' | ###..... | active | 2026-10-01 |');
  }
  const state = ['---', 'current_room: demo-room', 'venture_stage: Discovery', 'total_entries: 3', '---', '', '# Demo room', '', '## Sections', '', '| Section | Entries | Progress | Status | Updated |', '|---|---|---|---|---|'].concat(rows, ['']).join('\n');
  fs.writeFileSync(path.join(room, 'STATE.md'), state);
  fs.writeFileSync(path.join(room, 'ROOM.md'), '# Demo room\n\nA throwaway room for the screenshot plan.\n');
  return { roomsHome, room };
}

function shot(htmlPath, pngPath, size) {
  const r = spawnSync('playwright', ['screenshot', '--viewport-size', size.width + ',' + size.height, '--wait-for-selector', '#screen', '--wait-for-timeout', '400', pathToFileURL(htmlPath).href, pngPath], { encoding: 'utf8', timeout: 90000 });
  if (r.status !== 0) throw new Error('playwright failed: ' + String(r.stderr || r.stdout).trim().slice(-300));
}

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-face-shots-'));
  const workDir = path.join(root, 'work'); fs.mkdirSync(workDir);
  const scratchHome = path.join(root, 'home');
  const { roomsHome, room } = buildRoom(scratchHome, spec.roomKind || 'basic');
  const configDir = T.buildScratchConfig({ root, workDir }).configDir;
  if (spec.statusLine) fs.writeFileSync(path.join(configDir, 'settings.json'), JSON.stringify({ statusLine: { type: 'command', command: spec.statusLine } }, null, 2) + '\n');
  if (spec.sessionHome !== false) T.writeStatusFiles({ homeDir: scratchHome, roomDir: room, over: spec.over });
  const sessionId = crypto.randomUUID();
  const ver = (T.run('claude', ['--version']).stdout || '').trim().split(/\s+/)[0];
  T.buildTranscript({ configDir, workDir: fs.realpathSync(workDir), sessionId, userText: spec.userText, replyText: spec.replyText, version: ver });
  // bind this session in the registry (the panel reads it from disk)
  fs.writeFileSync(path.join(roomsHome, '.rooms', 'registry.json'), JSON.stringify({ active: 'demo-room', active_session: sessionId, sessions: { [sessionId]: { room: 'demo-room' } }, root: roomsHome, rooms: { 'demo-room': { path: room, name: 'demo-room' } } }, null, 2) + '\n');
  const childEnv = T.buildChildEnv({ base: process.env, scenarioEnv: spec.env || [], configDir, roomsHome, homeDir: scratchHome });
  let inner = 'claude --plugin-dir ' + T.shq(spec.plugin);
  if (spec.stub) {
    const server = spec.stub === 'denied' ? 'theo' : 'plugin_mos_mindrian-brain';
    const cfgPath = path.join(root, 'mcp.json');
    fs.writeFileSync(cfgPath, JSON.stringify({ mcpServers: { [server]: { command: 'node', args: [spec.stubScript] } } }));
    inner += ' --mcp-config ' + T.shq(cfgPath) + ' --strict-mcp-config --permission-mode dontAsk';
    if (spec.stub === 'answered') inner += ' --allowedTools mcp__plugin_mos_mindrian-brain__brain_ask';
  }
  inner += ' --resume ' + sessionId;
  const command = T.envPrefix(childEnv) + ' ' + inner + '; echo "CLAUDE_EXIT=$?"; sleep ' + T.LINGER_SEC;
  const sock = 'mos-face-drv-' + process.pid;
  const session = T.startSession({ sock, cols: spec.cols, rows: spec.rows, cwd: workDir, command, env: process.env });
  const log = []; const out = path.resolve(spec.out); fs.mkdirSync(out, { recursive: true });
  const entries = [];
  const note = (s) => { log.push(s); process.stdout.write(s + '\n'); };
  try {
    // wait for the screen
    const deadline = Date.now() + 60000; let ready = false;
    while (Date.now() < deadline) {
      const screen = session.cap();
      const step = await T.answerTrust(session, screen, log);
      if (step === 'answered' || step === 'gone') { await T.sleep(1500); continue; }
      if (screen.includes('/m:os') || screen.includes('mos')) { if (screen.includes('face loaded') || screen.includes('/m:os')) { ready = true; break; } }
      await T.sleep(400);
    }
    note('ready=' + ready);
    if (!ready) throw new Error('panel text not seen');
    await T.sleep(spec.settleMs || 2500);
    for (const st of spec.steps) {
      if (st.slash) {
        const r = await T.submitSlashSafely(session, st.slash);
        note('slash ' + st.slash + ' -> ' + (r.ok ? 'sent' : 'UNSAFE ' + r.reason) + ' | ' + r.notes.join(' ; '));
        if (!r.ok) throw new Error('slash refused');
        await T.sleep(st.wait || spec.settleMs || 2500);
      } else if (st.cmd) {
        // a command with arguments: type it, read the prompt line, press Enter only on an exact match of an allowed first word
        const first = st.cmd.split(' ')[0];
        if (!COMMANDS.has(first) || /[\n\r]/.test(st.cmd)) throw new Error('refused command ' + st.cmd);
        session.tmux(['send-keys', '-t', session.name, '-l', st.cmd]);
        await T.sleep(1200);
        const rs = T_read(session);
        if (rs.promptText !== st.cmd) { session.keyName('C-u'); throw new Error('prompt line does not show the typed text: ' + JSON.stringify(rs.promptText)); }
        session.keyName('Enter');
        note('cmd ' + st.cmd + ' -> Enter pressed (prompt line matched exactly)');
        await T.sleep(st.wait || spec.settleMs || 2500);
      } else if (st.wait) {
        await T.sleep(st.wait);
      } else if (st.cap) {
        const ansi = scrub(session.capAnsi()); const plain = scrub(session.cap());
        const grid = P.parseAnsi(ansi, spec.cols, spec.rows);
        fs.writeFileSync(path.join(out, st.cap + '.ansi'), ansi);
        fs.writeFileSync(path.join(out, st.cap + '.txt'), plain);
        fs.writeFileSync(path.join(out, st.cap + '.html'), P.toHtml(grid, { title: st.cap + ' ' + spec.cols + 'x' + spec.rows }));
        shot(path.join(out, st.cap + '.html'), path.join(out, st.cap + '.png'), P.pageSize(grid));
        entries.push({ name: st.cap, columns: spec.cols, rows: spec.rows, truecolor: /38;2;|48;2;/.test(ansi), env: spec.env || [], stub: spec.stub || null, capturedAt: new Date().toISOString() });
        note('captured ' + st.cap);
      }
    }
  } finally {
    session.kill();
    await T.sleep(1500);
    try { fs.rmSync(root, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 }); } catch (e) { /* best effort */ }
  }
  fs.writeFileSync(path.join(out, spec.name + '.index.json'), JSON.stringify({ name: spec.name, spec: Object.assign({}, spec, { plugin: '[subject]', stubScript: spec.stubScript ? '[stub]' : undefined, out: undefined }), claude: ver, entries, log: log.map(scrub) }, null, 2) + '\n');
}
function T_read(session) { return T.readSlashState(session.capAnsi(), session.cols, session.rows); }
main().then(() => process.exit(0), (e) => { process.stderr.write('drive: ' + (e.stack || e) + '\n'); process.exit(1); });
