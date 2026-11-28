#!/usr/bin/env node
'use strict';
/*
 * 406-P4 live driver (planning file, not shipped). Driven headless runs that replace the
 * owner-driven interactive turns of plan 406-P4 Task 3 (orchestrator deviation).
 *
 * One host per session: claude -p with stream-json in and out, --permission-prompt-tool stdio,
 * --plugin-dir at the worktree, --setting-sources project, model opus. The host runs from an empty
 * temp folder, with a temp MINDRIAN_HOME and MINDRIAN_ROOMS_HOME and the Brain address at a closed
 * port; HOME stays real so the host finds its login. Cost limit: only the AskUserQuestion tool is on and no
 * MCP server loads (--tools AskUserQuestion --strict-mcp-config), so a gate_render card is covered by fixtures only. Every can_use_tool request is denied except
 * AskUserQuestion, which is allowed with the first option label of each question as its answer.
 *
 * After each session the driver reads the voice rows of the Stop hook ($MINDRIAN_HOME/voice-style.jsonl,
 * policy voice-turn-evaluated) and counts fields only. It writes no reply text and no user text to its
 * report. It deletes the session-scoped files the plugin hooks leave under the real HOME (next-move
 * cache, session-env); it keeps the host transcript.
 *
 * Usage: node 406-P4-live-driver.cjs <worktree> <out-dir> [--max-usd 8] [--sessions s1,s2] [--probe]
 */
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const SESSIONS = {
  forks: [
    "I run a small bakery and must choose between wholesale to cafes or a second shop. Put that choice to me as a card I can click.",
    "Thanks. Next fork: hire a baker or buy a better oven first? Give me the options in prose and end with your call line.",
    "Open on Sundays or close on Sundays? Let me pick from a card.",
    "Raise prices 10 percent or cut the menu by a third? Lay out the fork in prose and hand the call to me.",
    "Sell online gift boxes or join a farmers market? Ask me with a choice card.",
    "Keep the old name or rebrand with the second location? Prose options, then your call line."
  ],
  long1: [
    "I am building a scheduling tool for small physical therapy clinics. Talk me through what you see as the core problem here.",
    "I must choose who I sell to first: clinic owners or front desk staff. Put that choice to me as a card I can click.",
    "Thanks. What is the riskiest assumption under that choice?",
    "I think owners do not feel the pain. Push back on me if that is wrong.",
    "Two tests for next week: five owner calls, or a landing page with a waitlist. Give me the options in prose and end with your call line.",
    "Give me a reframe of the whole venture in two sentences.",
    "Pricing: per seat or per clinic? Let me pick from a card.",
    "What would a skeptical investor say about this market?",
    "I can launch in one city or online for the whole state. Lay out the fork in prose and hand the call to me.",
    "Just tell me the bottom line: is this worth a year of my life?",
    "Should my first hire be a salesperson or an engineer? Ask me with a choice card.",
    "Tell me a story from another industry that looks like this problem.",
    "Build on that analogy: what does it suggest I do in month one?",
    "Monthly or annual billing first? Give me the choices in prose with your call at the end.",
    "What is one thing I should stop doing right now?",
    "Do I name the product after the clinic workflow or after the patient outcome? Card, please.",
    "Challenge me: I believe front desk staff will champion the tool.",
    "Partner with an EHR vendor now or later? Prose options, then your call line.",
    "Summarize where we are in three sentences.",
    "Hand me a short checklist for tomorrow."
  ],
  long2: [
    "Our team of three is building a water-quality sensor. Tell me what you think the real problem is.",
    "We must pick one market: municipal utilities, fish farms, or home owners. Put the choice to me as a card.",
    "What is the one question that would kill that option fastest?",
    "Push back on our plan to build the hardware ourselves.",
    "Two investors want a call: a generalist seed fund or a slow climate specialist. Lay out the options in prose and end with your call line.",
    "Give me an analogy from another field for selling to utilities.",
    "Should the first pilot be paid or free? Let me choose from a card.",
    "What is the weakest part of our story so far?",
    "Grant first or customers first? Give the options in prose and hand the call to me.",
    "Just tell me the bottom line: real business or science project?",
    "Open source the firmware or keep it closed? Ask me with a choice card.",
    "Reframe our venture as a service instead of a product.",
    "Build on that: what would the first service contract look like?",
    "Hire a field technician now or after the pilot? Prose options, your call at the end.",
    "What should we measure in the first month?",
    "Do we brand it for scientists or for operators? Card, please.",
    "Challenge my belief that fish farms will pay the most.",
    "Sell direct or through a distributor? Lay out the fork in prose and hand me the call.",
    "Write the one-paragraph note I send to my cofounder about today.",
    "Hand me a short checklist for tomorrow."
  ],
};

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--probe') out.probe = true;
    else if (a.indexOf('--') === 0) { out[a.slice(2)] = argv[i + 1]; i += 1; }
    else out._.push(a);
  }
  return out;
}

function cleanEnv(base) {
  const env = Object.assign({}, base);
  Object.keys(env).forEach(function (k) {
    if (/^(CLAUDECODE|CLAUDE_CODE_|MOS_|MINDRIAN_|CLAUDE_PLUGIN|CLAUDE_PROJECT|CLAUDE_ACTIVE|CODEX_)/.test(k)) delete env[k];
  });
  return env;
}

function runSession(o) {
  return new Promise(function (resolve) {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'p4-live-cwd-'));
    const env = cleanEnv(process.env);
    env.MINDRIAN_HOME = o.mindrianHome;
    env.MINDRIAN_ROOMS_HOME = o.roomsHome;
    env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
    const args = ['-p', '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose',
      '--permission-prompt-tool', 'stdio', '--tools', 'AskUserQuestion', '--strict-mcp-config', '--plugin-dir', o.worktree, '--setting-sources', 'project', '--model', 'opus'];
    const p = spawn('claude', args, { cwd: cwd, env: env, stdio: ['pipe', 'pipe', 'pipe'] });
    const events = { session_id: null, turns: 0, cost: 0, cards_allowed: 0, tools_denied: {}, plugins: null, results: [] };
    let buf = '';
    let idx = 0;
    const send = function (obj) { p.stdin.write(JSON.stringify(obj) + '\n'); };
    const next = function () {
      if (idx >= o.messages.length || events.cost >= o.maxUsd) { p.stdin.end(); return; }
      const text = o.messages[idx]; idx += 1; events.turns += 1;
      send({ type: 'user', message: { role: 'user', content: [{ type: 'text', text: text }] } });
    };
    p.stderr.on('data', function () { /* stderr is not kept */ });
    p.stdout.on('data', function (d) {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        let j; try { j = JSON.parse(line); } catch (_e) { continue; }
        if (j.type === 'system' && j.subtype === 'init') {
          events.session_id = j.session_id;
          events.plugins = (j.plugins || []).map(function (x) { return x.name; });
          events.output_style = j.output_style;
        } else if (j.type === 'control_request' && j.request && j.request.subtype === 'can_use_tool') {
          const r = j.request; const inp = r.input || {};
          if (r.tool_name === 'AskUserQuestion') {
            const answers = {};
            (inp.questions || []).forEach(function (q) { answers[q.question] = q.options && q.options[0] ? q.options[0].label : 'yes'; });
            events.cards_allowed += 1;
            send({ type: 'control_response', response: { subtype: 'success', request_id: j.request_id, response: { behavior: 'allow', updatedInput: Object.assign({}, inp, { answers: answers }) } } });
          } else {
            events.tools_denied[r.tool_name] = (events.tools_denied[r.tool_name] || 0) + 1;
            send({ type: 'control_response', response: { subtype: 'success', request_id: j.request_id, response: { behavior: 'deny', message: 'Tool use is not available in this run.' } } });
          }
        } else if (j.type === 'result') {
          events.cost = typeof j.total_cost_usd === 'number' ? j.total_cost_usd : events.cost;
          events.results.push({ subtype: j.subtype, is_error: !!j.is_error, num_turns: j.num_turns });
          next();
        }
      }
    });
    const timer = setTimeout(function () { events.timeout = true; p.kill(); }, o.timeoutMs || 1500000);
    p.on('exit', function (code) { clearTimeout(timer); events.exit = code; events.cwd_left = fs.readdirSync(cwd); resolve(events); });
    next();
  });
}

function readRows(mindrianHome, sessionId) {
  const f = path.join(mindrianHome, 'voice-style.jsonl');
  if (!fs.existsSync(f)) return [];
  return fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(function (l) { try { return JSON.parse(l); } catch (_e) { return null; } })
    .filter(function (r) { return r && r.policy_id === 'voice-turn-evaluated' && (!sessionId || r.session_id === sessionId); });
}

function cleanupRealHome(sessionId) {
  if (!sessionId) return [];
  const home = os.homedir();
  const removed = [];
  [path.join(home, '.mindrian', 'next-move', sessionId + '.json'), path.join(home, '.claude', 'session-env', sessionId)].forEach(function (p) {
    if (fs.existsSync(p)) { fs.rmSync(p, { recursive: true, force: true }); removed.push(p.replace(home, '~')); }
  });
  return removed;
}

function count(rows) {
  const c = { rows: rows.length, gate: 0, gate_black: 0, gate_correct: 0, gate_by_source: {}, nongate: 0, nongate_black: 0, nongate_correct: 0, missing_glyph: 0, invalid_glyph: 0, post_answer: 0, post_answer_black: 0, colors: {} };
  rows.forEach(function (r) {
    c.colors[r.glyph_color] = (c.colors[r.glyph_color] || 0) + 1;
    if (r.glyph_color === 'none') c.missing_glyph += 1;
    if (r.glyph_color === 'invalid') c.invalid_glyph += 1;
    if (r.post_glyph_color) { c.post_answer += 1; if (r.post_glyph_color === 'black') c.post_answer_black += 1; }
    if (r.gate_turn === true) {
      c.gate += 1; c.gate_by_source[r.gate_source] = (c.gate_by_source[r.gate_source] || 0) + 1;
      if (r.glyph_color === 'black') c.gate_black += 1;
      if (r.glyph_correct === true) c.gate_correct += 1;
    } else {
      c.nongate += 1;
      if (r.glyph_color === 'black') c.nongate_black += 1;
      if (r.glyph_correct === true) c.nongate_correct += 1;
    }
  });
  return c;
}

async function main() {
  const a = parseArgs(process.argv.slice(2));
  const worktree = path.resolve(a._[0] || '.');
  const outDir = path.resolve(a._[1] || fs.mkdtempSync(path.join(os.tmpdir(), 'p4-live-out-')));
  fs.mkdirSync(outDir, { recursive: true });
  const maxUsd = Number(a['max-usd'] || 8);
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'p4-live-home-'));
  const mindrianHome = path.join(base, 'm');
  const roomsHome = path.join(base, 'r');
  fs.mkdirSync(mindrianHome, { recursive: true }); fs.mkdirSync(roomsHome, { recursive: true });
  const names = a.probe ? ['probe'] : String(a.sessions || 'long1,long2').split(',');
  const report = { started: new Date().toISOString(), worktree_head: null, sessions: [], total_cost_usd: 0 };
  try { report.worktree_head = require('node:child_process').execFileSync('git', ['-C', worktree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch (_e) { /* optional */ }
  for (const name of names) {
    const messages = name === 'probe' ? ['Hello. In two sentences, what can you help me with?'] : SESSIONS[name];
    if (!messages) throw new Error('unknown session ' + name);
    const left = maxUsd - report.total_cost_usd;
    if (left <= 0.5) { report.stopped = 'cost_limit'; break; }
    const ev = await runSession({ worktree: worktree, mindrianHome: mindrianHome, roomsHome: roomsHome, messages: messages, maxUsd: left });
    report.total_cost_usd += ev.cost;
    const rows = readRows(mindrianHome, ev.session_id);
    const s = { name: name, session_id: ev.session_id, plugins: ev.plugins, output_style: ev.output_style, turns_sent: ev.turns, exit: ev.exit, timeout: !!ev.timeout,
      cost_usd: ev.cost, cards_allowed: ev.cards_allowed, tools_denied: ev.tools_denied, results: ev.results, cwd_left: ev.cwd_left,
      rows: rows.map(function (r) { return { turn_id: r.turn_id, glyph_color: r.glyph_color, post_glyph_color: r.post_glyph_color, gate_turn: r.gate_turn, gate_source: r.gate_source, glyph_correct: r.glyph_correct }; }),
      counts: count(rows), removed_from_real_home: cleanupRealHome(ev.session_id) };
    report.sessions.push(s);
    fs.writeFileSync(path.join(outDir, 'driver-report.json'), JSON.stringify(report, null, 2) + '\n');
  }
  report.totals = count([].concat.apply([], report.sessions.map(function (s) { return s.rows; })));
  report.finished = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, 'driver-report.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ out: outDir, total_cost_usd: report.total_cost_usd, totals: report.totals }) + '\n');
}

main().catch(function (e) { process.stderr.write('driver failed: ' + e.message + '\n'); process.exit(1); });
