'use strict';
// Driver of the delegated live deep persona run (owner ruling OR-61). A dev tool; it ships to no user.
// It starts one long-lived headless host with the plugin of this worktree, on a scratch room under a temp folder.
// It forwards every decision card to a file and waits for an answer file. It answers no card by itself.
// Usage: node 400.2.1-live-run-driver.cjs <temp folder> <worktree root>
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const T = process.argv[2];
const WT = process.argv[3];
const SLUG = 'quokka-scratch';
const roomsHome = path.join(T, 'rooms');
const mosHome = path.join(T, 'mindrian-home');
const roomDir = path.join(roomsHome, SLUG);
const out = path.join(T, 'out');
const inbox = path.join(T, 'inbox');
for (const d of [roomsHome, mosHome, out, inbox, path.join(out, 'cards')]) fs.mkdirSync(d, { recursive: true });
const log = (f, s) => fs.appendFileSync(path.join(out, f), s + '\n');
const notify = (s) => log('notify.log', s);
const ev = (s) => log('events.log', new Date().toISOString().slice(11, 19) + ' ' + s);

process.env.MINDRIAN_ROOMS_HOME = roomsHome;
process.env.MINDRIAN_HOME = mosHome;
// The plugin builds its persona work folders under the system temp folder. Keep them inside this run's folder,
// so the write rule below (only under T) does not refuse them. Attempt 1 of the live run stopped on that refusal.
process.env.TMPDIR = path.join(T, 'tmp');
fs.mkdirSync(process.env.TMPDIR, { recursive: true });

if (!fs.existsSync(path.join(roomDir, '.mindrian', 'room.db'))) {
  fs.mkdirSync(roomDir, { recursive: true });
  const birth = require(path.join(WT, 'lib', 'core', 'navigation', 'room-birth.cjs')).birthRoom({
    slug: SLUG, roomDir, sessionId: 'live-40021', ventureText: 'a scratch room for one live deep persona run',
    jtbd: '', approvedBy: 'delegated-session-OR-61', canonicalRole: 'founder', vname: SLUG, vstage: 'Pre-Opportunity',
  });
  ev('BIRTH ' + JSON.stringify(birth).slice(0, 300));
  if (!birth || birth.ok !== true) { notify('EXIT birth_failed'); process.exit(3); }
}

const env = { ...process.env };
for (const k of Object.keys(env)) {
  if (/^(CLAUDECODE$|CLAUDE_CODE_|CLAUDE_PLUGIN|CLAUDE_PROJECT|CLAUDE_ACTIVE|MOS_)/.test(k)) delete env[k];
  if (/^MINDRIAN_/.test(k) && !['MINDRIAN_BRAIN_KEY', 'MINDRIAN_ROOMS_HOME', 'MINDRIAN_HOME'].includes(k)) delete env[k];
}
const sessionId = crypto.randomUUID();
const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
  '--permission-prompt-tool', 'stdio', '--plugin-dir', WT, '--setting-sources', 'project', '--model', 'opus', '--session-id', sessionId];
ev('HOST claude ' + args.join(' ') + ' cwd=' + roomDir);
const p = spawn('claude', args, { cwd: roomDir, env, stdio: ['pipe', 'pipe', 'pipe'] });
const send = (o) => p.stdin.write(JSON.stringify(o) + '\n');
const pending = new Map();

// Non-card tool requests: allow, with three refusals (a real rooms path, a write outside the temp folder, a git or publish command).
function policy(tool, input) {
  const s = JSON.stringify(input || {});
  if (/\/home\/[^/"]+\/MindrianRooms|~\/MindrianRooms/.test(s)) return 'a real rooms path is not allowed in this run';
  if (['Write', 'Edit', 'MultiEdit', 'NotebookEdit'].includes(tool)) {
    const fp = String((input && (input.file_path || input.notebook_path)) || '');
    if (!path.resolve(fp).startsWith(T + path.sep)) return 'this run writes only under its temp folder';
  }
  if (tool === 'Bash' && /git\s+(push|commit|merge|reset|checkout)|npm\s+publish/.test(String(input.command || ''))) return 'this command is not allowed in this run';
  return null;
}

let buf = '';
p.stderr.on('data', (d) => ev('STDERR ' + String(d).slice(0, 500).replace(/\n/g, ' | ')));
p.stdout.on('data', (d) => {
  buf += d; let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    if (!line.trim()) continue;
    log('raw.jsonl', line);
    let j; try { j = JSON.parse(line); } catch (e) { continue; }
    if (j.type === 'control_request') {
      const r = j.request || {};
      if (r.subtype !== 'can_use_tool') { ev('CTRL other ' + r.subtype); continue; }
      if (r.tool_name === 'AskUserQuestion') {
        pending.set(j.request_id, r.input);
        fs.writeFileSync(path.join(out, 'cards', j.request_id + '.json'), JSON.stringify(r.input, null, 1));
        const heads = (r.input.questions || []).map((q) => q.header || '').join(' | ');
        log('reply.md', '\n### CARD ' + j.request_id + '\n```json\n' + JSON.stringify(r.input, null, 1) + '\n```\n');
        notify('CARD ' + j.request_id + ' questions=' + (r.input.questions || []).length + ' headers=' + heads);
        ev('CARD ' + j.request_id);
      } else {
        const why = policy(r.tool_name, r.input || {});
        const brief = JSON.stringify(r.input || {}).slice(0, 400);
        if (why) {
          ev('DENY ' + r.tool_name + ' ' + brief); notify('DENY ' + r.tool_name + ' ' + brief.slice(0, 200));
          send({ type: 'control_response', response: { subtype: 'success', request_id: j.request_id, response: { behavior: 'deny', message: why } } });
        } else {
          ev('ALLOW ' + r.tool_name + ' ' + brief);
          send({ type: 'control_response', response: { subtype: 'success', request_id: j.request_id, response: { behavior: 'allow', updatedInput: r.input || {} } } });
        }
      }
    } else if (j.type === 'assistant') {
      const sub = j.parent_tool_use_id ? ' (subagent)' : '';
      for (const c of (j.message && j.message.content) || []) {
        if (c.type === 'text' && c.text) { if (!sub) log('reply.md', '\n' + c.text + '\n'); ev('TEXT' + sub + ' ' + c.text.slice(0, 160).replace(/\n/g, ' ')); }
        if (c.type === 'tool_use') ev('TOOL' + sub + ' ' + c.name + ' ' + JSON.stringify(c.input || {}).slice(0, 300));
      }
    } else if (j.type === 'user') {
      const cs = (j.message && j.message.content) || [];
      for (const c of Array.isArray(cs) ? cs : []) {
        if (c.type === 'tool_result') {
          const t = typeof c.content === 'string' ? c.content : JSON.stringify(c.content);
          ev('RESULT_OF_TOOL ' + (c.is_error ? 'ERROR ' : '') + String(t).slice(0, 300).replace(/\n/g, ' '));
        }
      }
    } else if (j.type === 'result') {
      ev('TURN_END ' + j.subtype + ' turns=' + j.num_turns + ' cost=' + j.total_cost_usd);
      notify('TURN_END ' + j.subtype + ' is_error=' + j.is_error + ' turns=' + j.num_turns);
      log('reply.md', '\n---- turn end ----\n');
    } else if (j.type === 'system' && j.subtype === 'init') {
      ev('INIT plugins=' + JSON.stringify((j.plugins || []).map((x) => x.name + '@' + x.path)) + ' model=' + j.model + ' mcp=' + JSON.stringify((j.mcp_servers || []).map((m) => m.name + ':' + m.status)));
      notify('INIT ok');
    }
  }
});
p.on('exit', (c) => { ev('EXIT ' + c); notify('EXIT ' + c); process.exit(0); });

// Inbox: <n>.msg = one navigator message; <n>.ans = {"request_id": "...", "answers": {"<question text>": "<label or typed text>"}}; <n>.end = close the host.
setInterval(() => {
  let files; try { files = fs.readdirSync(inbox).filter((f) => /\.(msg|ans|end)$/.test(f)).sort(); } catch (e) { return; }
  for (const f of files) {
    const fp = path.join(inbox, f); const body = fs.readFileSync(fp, 'utf8');
    if (f.endsWith('.msg')) {
      log('reply.md', '\n## NAVIGATOR MESSAGE\n' + body + '\n'); ev('SEND ' + body.slice(0, 120));
      send({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: body }] } });
    } else if (f.endsWith('.ans')) {
      const a = JSON.parse(body); const input = pending.get(a.request_id);
      if (!input) { ev('ANS unknown ' + a.request_id); notify('ANS_UNKNOWN ' + a.request_id); }
      else {
        pending.delete(a.request_id);
        log('reply.md', '\n### CARD ANSWER ' + a.request_id + '\n```json\n' + JSON.stringify(a.answers, null, 1) + '\n```\n'); ev('ANSWER ' + JSON.stringify(a.answers).slice(0, 300));
        send({ type: 'control_response', response: { subtype: 'success', request_id: a.request_id, response: { behavior: 'allow', updatedInput: { ...input, answers: a.answers } } } });
      }
    } else { ev('END requested'); p.stdin.end(); }
    fs.renameSync(fp, fp + '.done');
  }
}, 500);
