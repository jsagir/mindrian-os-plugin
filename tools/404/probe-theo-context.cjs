#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { Client, StreamableHTTPClientTransport } = require('@modelcontextprotocol/client');

const SENTENCE = 'zz probe not a framework name zz';
const INPUTS = [
  { framework: SENTENCE },
  { framework: SENTENCE, extra: 'probe' },
  { framework: 'x'.repeat(97) },
  { framework: 'x'.repeat(129) },
];
const REFUSAL = 'FRAMEWORK_NOT_CANONICAL';
const DEFAULT_OUT = path.resolve(__dirname, '../../data/theo-context-contract.json');
const USAGE = 'Usage: node tools/404/probe-theo-context.cjs [--url <url>] [--write] [--out <path>] (default write target: data/theo-context-contract.json)';

function parseArgs(args) {
  const options = { write: false, out: DEFAULT_OUT, url: null };
  for (let index = 0; index < args.length; index += 1) {
    switch (args[index]) {
      case '--url':
        if (!args[index + 1] || options.url !== null) throw new Error(USAGE);
        options.url = args[++index];
        break;
      case '--write':
        if (options.write) throw new Error(USAGE);
        options.write = true;
        break;
      case '--out':
        if (!args[index + 1] || options.out !== DEFAULT_OUT) throw new Error(USAGE);
        options.out = path.resolve(args[++index]);
        break;
      default:
        throw new Error(USAGE);
    }
  }
  if (!options.url) throw new Error(USAGE + '\nThe plugin has no theo-context entry on this base. Set --url.');
  let parsed;
  try { parsed = new URL(options.url); } catch (_error) { throw new Error(USAGE); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error(USAGE);
  return options;
}

function refusalFrom(error) {
  if (error && error.data && typeof error.data === 'object') {
    if (typeof error.data.text === 'string') {
      try {
        const body = JSON.parse(error.data.text);
        if (body && body.error && body.error.data && typeof body.error.data === 'object') return body.error.data;
      } catch (_error) { /* Keep the existing error data paths. */ }
    }
    return error.data;
  }
  if (error && error.cause && error.cause.data && typeof error.cause.data === 'object') return error.cause.data;
  return null;
}

function connectionFailure(error) {
  const networkCodes = new Set(['ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT']);
  let current = error;
  let hasHttpStatus = false;
  for (let depth = 0; current && depth < 5; depth += 1) {
    if (networkCodes.has(current.code)) return true;
    if (typeof current.status === 'number'
      || (current.data && typeof current.data.status === 'number')
      || (current.response && typeof current.response.status === 'number')) hasHttpStatus = true;
    current = current.cause;
  }
  return !hasHttpStatus;
}

function connectionError(error) {
  if (!connectionFailure(error)) return error;
  const wrapped = new Error(error && error.message ? error.message : 'Connection failed.', { cause: error });
  wrapped.connection = true;
  return wrapped;
}

function resultData(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.structuredContent && typeof result.structuredContent === 'object') return result.structuredContent;
  for (const item of result.content || []) {
    if (item && typeof item.text === 'string') {
      try { return JSON.parse(item.text); } catch (_error) { /* Continue to the next item. */ }
    }
  }
  return null;
}

async function probe(url) {
  const transport = new StreamableHTTPClientTransport(new URL(url));
  const client = new Client({ name: 'mindrian-theo-context-probe', version: '1.0.0' }, { capabilities: {} });
  try {
    try {
      await client.connect(transport);
    } catch (error) {
      throw connectionError(error);
    }
    const server = client.getServerVersion();
    if (!server || typeof server.version !== 'string' || !server.version) throw new Error('Server version is missing.');
    let snapshotDate;
    let allRefused = true;
    for (let index = 0; index < INPUTS.length; index += 1) {
      let data;
      try {
        const result = await client.callTool({ name: 'framework_steps', arguments: INPUTS[index] });
        data = result && result.isError === true ? resultData(result) : null;
      } catch (error) {
        const wrapped = connectionError(error);
        if (wrapped.connection === true) throw wrapped;
        data = refusalFrom(error);
      }
      if (!data || data.refusal !== REFUSAL || data.upstream_calls !== 0) {
        allRefused = false;
      }
      if (data && typeof data.canon_snapshot_date === 'string' && data.canon_snapshot_date) snapshotDate = data.canon_snapshot_date;
    }
    if (!allRefused) throw new Error('Probe input did not produce the required refusal.');
    return { server_version: server.version, server_snapshot_date: snapshotDate };
  } finally {
    try { await transport.terminateSession(); } catch (_error) { /* Best effort. */ }
    try { await client.close(); } catch (_error) { /* Best effort. */ }
  }
}

async function main(args) {
  let options;
  try { options = parseArgs(args); } catch (error) {
    process.stderr.write((error.message || USAGE) + '\n');
    return 2;
  }
  let evidence;
  try { evidence = await probe(options.url); } catch (error) {
    process.stderr.write('Probe failed: ' + (error.message || 'server unavailable') + '\n');
    return error.connection === true ? 2 : 1;
  }
  const record = {
    probe: 'refused',
    upstream_calls: 0,
    server_version: evidence.server_version,
    verified_at: new Date().toISOString(),
  };
  if (evidence.server_snapshot_date !== undefined) record.server_snapshot_date = evidence.server_snapshot_date;
  if (options.write) {
    try {
      fs.mkdirSync(path.dirname(options.out), { recursive: true });
      fs.writeFileSync(options.out, JSON.stringify({ strict_canonical_check: record }, null, 2) + '\n', { flag: 'wx' });
    } catch (error) {
      process.stderr.write('Contract write failed: ' + (error.message || 'write error') + '\n');
      return 1;
    }
  }
  process.stdout.write('PROBE_REFUSED: 4 inputs; upstream_calls=0; server_version=' + record.server_version + '\n');
  return 0;
}

if (require.main === module) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; }).catch(error => {
    process.stderr.write('Probe failed: ' + (error.message || 'unknown error') + '\n');
    process.exitCode = 1;
  });
}

module.exports = { main, parseArgs, probe };
