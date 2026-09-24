#!/usr/bin/env node
'use strict';
// scripts/fork359-permission-probe.cjs -- Phase 359-05 (FORK359-09, D-11, D-12,
// N-4, RESEARCH Finding 8, Pitfall 6).
//
// Dev-only permission host for the Phase 359 R9 forward-measurement harness
// (scripts/forward-fork-scenarios-359.cjs). Never imported by lib/ or
// hooks/, never runs in CI. Denies EVERY permission request (ASVS V4: fail
// closed -- no navigator can be reached inside a headless dev run). Zero
// network. Writes only to FORK359_PROBE_LOG, one JSON line per attempt,
// carrying the tool name and (for AskUserQuestion) the flat list of option
// LABELS only -- never the question text, never a reply, never any user or
// scenario prose (Part 8: counts and labels only, this file logs less than
// that).
//
// Wired via `--mcp-config <tmp>/probe.json --permission-prompt-tool
// mcp__fork359probe__permission` (RESEARCH Pattern 5). Built on the
// installed @modelcontextprotocol/sdk (1.29.0+, a declared dependency) and
// zod; no new package.
//
// Contract (community-documented, GitHub issue #1175; verified in the
// plan-10 smoke run per Finding 8): the host receives a tool_use call whose
// input is {tool_name, input, tool_use_id}; it returns one text content
// block whose text is JSON: {"behavior":"deny","message":"..."} (or
// {"behavior":"allow","updatedInput":...} -- 'allow' is never emitted by
// this file; it is deny-all, always).
//
// House rule: hyphens only, no em-dashes anywhere.

const path = require('path');
const fs = require('fs');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');

const DENY_MESSAGE = 'No one can answer in this run; continue.';

/**
 * extractAskUserQuestionOptions(toolName, input) -- for an AskUserQuestion
 * tool_use, returns the flat list of questions[].options[].label. For any
 * other tool name, returns undefined (the log row omits `options`). Never
 * throws; a malformed input shape degrades to an empty list.
 */
function extractAskUserQuestionOptions(toolName, input) {
  if (toolName !== 'AskUserQuestion') return undefined;
  try {
    const questions = (input && Array.isArray(input.questions)) ? input.questions : [];
    const labels = [];
    for (const q of questions) {
      const opts = (q && Array.isArray(q.options)) ? q.options : [];
      for (const o of opts) {
        if (o && typeof o.label === 'string') labels.push(o.label);
      }
    }
    return labels;
  } catch (_e) {
    return [];
  }
}

/**
 * logAttempt(toolName, input) -- best-effort append of one JSON line to
 * FORK359_PROBE_LOG. Never throws (a log-write failure must never surface
 * out of the deny handler, let alone abort the deny response itself).
 */
function logAttempt(toolName, input) {
  const logPath = process.env.FORK359_PROBE_LOG;
  if (!logPath) return;
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    const options = extractAskUserQuestionOptions(toolName, input);
    const row = { ts: Date.now(), tool_name: toolName };
    if (options !== undefined) row.options = options;
    fs.appendFileSync(logPath, JSON.stringify(row) + '\n');
  } catch (_e) {
    // swallow: logging is a diagnostic side channel, never load-bearing for
    // the deny response itself.
  }
}

/**
 * createServer() -- builds the 'fork359probe' McpServer with its one tool,
 * 'permission'. Exported (not just invoked from main) so the offline test
 * can construct and drive it in-process without a child process.
 */
function createServer() {
  const server = new McpServer(
    { name: 'fork359probe', version: '1.0.0' },
    {
      instructions:
        'Dev-only deny-all permission host for the Phase 359 R9 forward run. ' +
        'It exists only to make AskUserQuestion observable under claude -p; it ' +
        'never allows a tool call and is never used outside this harness.',
    }
  );

  server.tool(
    'permission',
    'Deny-all permission host for the Phase 359 R9 forward run (dev-only, never in ' +
      'production). Denies every permission request with a neutral message; logs ' +
      'AskUserQuestion option labels only, never reply text.',
    {
      tool_name: z.string().describe('The tool Claude Code is asking permission to call (e.g. AskUserQuestion).'),
      input: z.any().describe('The pending tool call input, passthrough. Only AskUserQuestion.questions[].options[].label is read or logged.'),
      tool_use_id: z.string().optional().describe('The tool_use id this permission request is for.'),
    },
    async (args) => {
      const toolName = args && args.tool_name;
      const input = args && args.input;
      try {
        logAttempt(toolName, input);
      } catch (_e) {
        // never let a logging failure change the response path below
      }
      return {
        content: [
          { type: 'text', text: JSON.stringify({ behavior: 'deny', message: DENY_MESSAGE }) },
        ],
      };
    }
  );

  return server;
}

async function main() {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (require.main === module) {
  main().catch(function (e) {
    try {
      process.stderr.write('[fork359-permission-probe] fatal: ' + (e && e.message ? e.message : String(e)) + '\n');
    } catch (_eWrite) {
      // swallow
    }
    process.exit(1);
  });
}

module.exports = {
  createServer: createServer,
  extractAskUserQuestionOptions: extractAskUserQuestionOptions,
  DENY_MESSAGE: DENY_MESSAGE,
};
