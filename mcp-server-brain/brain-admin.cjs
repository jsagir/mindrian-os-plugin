#!/usr/bin/env node
'use strict';

/**
 * Brain Admin CLI — API key lifecycle management for MindrianOS Brain.
 *
 * Standalone tool for Jonathan to manage Brain API keys from terminal.
 * Zero npm dependencies — uses Node 20 native fetch + crypto.
 *
 * Commands: create, revoke, extend, list, usage, requests, help
 *
 * Usage: node brain-admin.cjs <command> [--flags]
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── .env loader (manual, no dotenv) ─────────────────────────────────

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 0) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnv();

// ── ANSI colors ─────────────────────────────────────────────────────

const C = {
  green:  '\x1b[32m',
  red:    '\x1b[31m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  dim:    '\x1b[2m',
  bold:   '\x1b[1m',
  reset:  '\x1b[0m',
};

// ── Output helpers ──────────────────────────────────────────────────

function header(title) {
  console.log(`\n${C.cyan}--- Brain Admin ---${C.reset}`);
  if (title) console.log(`${C.dim}  ${title}${C.reset}`);
  console.log();
}

function field(label, value, color = '') {
  const colorCode = color ? C[color] || '' : '';
  console.log(`  ${C.cyan}${label.padEnd(14)}${C.reset}${colorCode}${value}${color ? C.reset : ''}`);
}

function footer() {
  console.log(`\n${C.cyan}---${C.reset}\n`);
}

function error(msg) {
  console.error(`\n${C.red}Error:${C.reset} ${msg}\n`);
  process.exit(1);
}

// ── Supabase REST helper ────────────────────────────────────────────

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

function requireSupabase() {
  if (!SUPABASE_URL) error('SUPABASE_URL not set. Check .env or environment.');
  if (!SERVICE_KEY) error('SUPABASE_SERVICE_KEY not set. Check .env or environment.');
}

async function supa(method, pathAndQuery, body) {
  requireSupabase();
  const url = `${SUPABASE_URL}/rest/v1/${pathAndQuery}`;
  const opts = {
    method,
    headers: {
      'apikey': SERVICE_KEY,
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
    },
  };
  if (body && method !== 'GET') opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  if (!res.ok) {
    const msg = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
    error(`Supabase ${method} ${pathAndQuery} failed (${res.status}):\n${msg}`);
  }
  return data;
}

// ── Arg parsing ─────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0] || 'help';
  const flags = {};
  for (let i = 1; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    }
  }
  return { command, flags };
}

function requireFlag(flags, name, example) {
  if (!flags[name]) {
    error(`Missing required flag --${name}. Example: node brain-admin.cjs ${example}`);
  }
  return flags[name];
}

// ── Date helpers ────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return `${C.dim}permanent${C.reset}`;
  const d = new Date(iso);
  const now = new Date();
  const daysLeft = Math.ceil((d - now) / 86400000);
  const dateStr = d.toISOString().slice(0, 10);
  if (daysLeft < 0) return `${C.red}${dateStr} (expired)${C.reset}`;
  if (daysLeft <= 7) return `${C.yellow}${dateStr} (${daysLeft}d left)${C.reset}`;
  return `${C.green}${dateStr} (${daysLeft}d left)${C.reset}`;
}

function formatLastUsed(iso) {
  if (!iso) return `${C.dim}never${C.reset}`;
  return new Date(iso).toISOString().slice(0, 16).replace('T', ' ');
}

// ── Commands ────────────────────────────────────────────────────────

async function cmdCreate(flags) {
  header('Create Brain API Key');
  console.log(`  ${C.dim}Generates a new UUID API key and stores it in the brain_api_keys table.${C.reset}`);
  console.log(`  ${C.dim}The key is shown once — save it immediately.${C.reset}\n`);

  const email = requireFlag(flags, 'email', 'create --email user@example.com --name "User Name"');
  const name = flags.name || '';
  const plan = flags.plan || 'free';
  const days = parseInt(flags.days || '30', 10);

  if (!['free', 'pro', 'admin'].includes(plan)) {
    error(`Invalid plan "${plan}". Must be: free, pro, or admin.`);
  }

  const apiKey = crypto.randomUUID();
  const expiresAt = flags.days === undefined && !flags.days
    ? new Date(Date.now() + 30 * 86400000).toISOString()  // default 30 days
    : new Date(Date.now() + days * 86400000).toISOString();

  const row = {
    api_key: apiKey,
    email,
    name,
    plan,
    is_active: true,
    expires_at: expiresAt,
    created_by: 'jonathan',
  };

  const result = await supa('POST', 'brain_api_keys', row);

  field('Command', 'create');
  field('Email', email);
  field('Name', name || '(none)');
  field('Plan', plan);
  field('Expires', formatDate(expiresAt));
  console.log();
  console.log(`  ${C.bold}${C.green}API Key:${C.reset}     ${C.bold}${apiKey}${C.reset}`);
  console.log(`  ${C.yellow}(Save this key - it will not be shown again)${C.reset}`);

  footer();
}

async function cmdRevoke(flags) {
  header('Revoke Brain API Key');
  console.log(`  ${C.dim}Deactivates all active keys for the given email address.${C.reset}\n`);

  const email = requireFlag(flags, 'email', 'revoke --email user@example.com');

  const result = await supa('PATCH', `brain_api_keys?email=eq.${encodeURIComponent(email)}&is_active=eq.true`, {
    is_active: false,
  });

  const count = Array.isArray(result) ? result.length : 0;

  field('Command', 'revoke');
  field('Email', email);
  field('Keys revoked', count > 0 ? `${C.green}${count}${C.reset}` : `${C.yellow}0 (none were active)${C.reset}`);

  footer();
}

async function cmdExtend(flags) {
  header('Extend Brain API Key Expiry');
  console.log(`  ${C.dim}Adds days to the expiry of the active key for the given email.${C.reset}`);
  console.log(`  ${C.dim}If the key is already expired, extends from now instead.${C.reset}\n`);

  const email = requireFlag(flags, 'email', 'extend --email user@example.com --days 30');
  const days = parseInt(requireFlag(flags, 'days', 'extend --email user@example.com --days 30'), 10);

  // Get current key
  const keys = await supa('GET', `brain_api_keys?email=eq.${encodeURIComponent(email)}&is_active=eq.true&order=created_at.desc&limit=1`);

  if (!Array.isArray(keys) || keys.length === 0) {
    error(`No active key found for ${email}`);
  }

  const current = keys[0];
  const currentExpiry = current.expires_at ? new Date(current.expires_at) : null;
  const now = new Date();
  const base = (currentExpiry && currentExpiry > now) ? currentExpiry : now;
  const newExpiry = new Date(base.getTime() + days * 86400000).toISOString();

  await supa('PATCH', `brain_api_keys?id=eq.${current.id}`, {
    expires_at: newExpiry,
  });

  field('Command', 'extend');
  field('Email', email);
  field('Previous', currentExpiry ? formatDate(current.expires_at) : 'permanent');
  field('Extended by', `${days} days`);
  field('New expiry', formatDate(newExpiry));

  footer();
}

async function cmdList() {
  header('Brain API Keys');
  console.log(`  ${C.dim}Lists all API keys with status, plan, and usage info.${C.reset}\n`);

  const keys = await supa('GET', 'brain_api_keys?select=email,name,plan,is_active,expires_at,last_used_at,request_count&order=created_at.desc');

  if (!Array.isArray(keys) || keys.length === 0) {
    console.log(`  ${C.dim}No keys found.${C.reset}`);
    footer();
    return;
  }

  // Table header
  const hdr = `  ${'Email'.padEnd(30)} ${'Name'.padEnd(16)} ${'Plan'.padEnd(8)} ${'Status'.padEnd(10)} ${'Expires'.padEnd(28)} ${'Requests'.padEnd(10)}`;
  console.log(`${C.cyan}${hdr}${C.reset}`);
  console.log(`  ${''.padEnd(102, '-')}`);

  for (const k of keys) {
    const status = k.is_active ? `${C.green}active${C.reset}` : `${C.red}revoked${C.reset}`;
    const statusPad = k.is_active ? 'active' : 'revoked';
    const email = k.email.length > 28 ? k.email.slice(0, 26) + '..' : k.email;
    const name = (k.name || '').length > 14 ? k.name.slice(0, 12) + '..' : (k.name || '-');
    console.log(`  ${email.padEnd(30)} ${name.padEnd(16)} ${k.plan.padEnd(8)} ${status}${' '.repeat(10 - statusPad.length)} ${formatDate(k.expires_at).padEnd(28)} ${String(k.request_count).padEnd(10)}`);
  }

  console.log(`\n  ${C.dim}Total: ${keys.length} key(s)${C.reset}`);
  footer();
}

async function cmdUsage(flags) {
  header('Brain API Key Usage');
  console.log(`  ${C.dim}Shows request counts and last-used timestamps.${C.reset}\n`);

  let query = 'brain_api_keys?select=email,name,plan,request_count,last_used_at,is_active&order=request_count.desc';
  if (flags.email) {
    query += `&email=eq.${encodeURIComponent(flags.email)}`;
  }

  const keys = await supa('GET', query);

  if (!Array.isArray(keys) || keys.length === 0) {
    console.log(`  ${C.dim}No keys found.${C.reset}`);
    footer();
    return;
  }

  for (const k of keys) {
    const status = k.is_active ? `${C.green}active${C.reset}` : `${C.red}revoked${C.reset}`;
    field('Email', k.email);
    field('Name', k.name || '-');
    field('Plan', k.plan);
    field('Status', status);
    field('Requests', String(k.request_count));
    field('Last used', formatLastUsed(k.last_used_at));
    console.log();
  }

  footer();
}

async function cmdRequests() {
  header('Pending Access Requests');
  console.log(`  ${C.dim}Lists unreviewed Brain access requests from the website form.${C.reset}`);
  console.log(`  ${C.dim}Review these and use 'create' to grant keys.${C.reset}\n`);

  const reqs = await supa('GET', 'brain_access_requests?reviewed=eq.false&order=created_at.desc');

  if (!Array.isArray(reqs) || reqs.length === 0) {
    console.log(`  ${C.green}No pending requests.${C.reset}`);
    footer();
    return;
  }

  for (let i = 0; i < reqs.length; i++) {
    const r = reqs[i];
    console.log(`  ${C.bold}#${i + 1}${C.reset}`);
    field('Email', r.email);
    field('Name', r.name || '-');
    field('Message', r.message || `${C.dim}(none)${C.reset}`);
    field('Submitted', formatLastUsed(r.created_at));
    console.log();
  }

  console.log(`  ${C.yellow}${reqs.length} pending request(s)${C.reset}`);
  footer();
}

function cmdHelp() {
  header('Brain API Key Management CLI');
  console.log(`  ${C.bold}Usage:${C.reset} node brain-admin.cjs <command> [--flags]\n`);
  console.log(`  ${C.bold}Commands:${C.reset}\n`);

  const cmds = [
    ['create', '--email X --name "Name" [--days N] [--plan free|pro|admin]', 'Generate a new API key (default: 30 days, free plan)'],
    ['revoke', '--email X', 'Deactivate all keys for an email'],
    ['extend', '--email X --days N', 'Add days to key expiry'],
    ['list', '', 'Show all API keys with status'],
    ['usage', '[--email X]', 'Show request counts and last-used times'],
    ['requests', '', 'List pending access requests (unreviewed)'],
    ['help', '', 'Show this help message'],
  ];

  for (const [name, args, desc] of cmds) {
    console.log(`    ${C.green}${name.padEnd(12)}${C.reset}${C.dim}${args}${C.reset}`);
    console.log(`    ${' '.repeat(12)}${desc}\n`);
  }

  console.log(`  ${C.bold}Examples:${C.reset}\n`);
  console.log(`    ${C.dim}node brain-admin.cjs create --email user@example.com --name "Alice" --days 30${C.reset}`);
  console.log(`    ${C.dim}node brain-admin.cjs list${C.reset}`);
  console.log(`    ${C.dim}node brain-admin.cjs revoke --email user@example.com${C.reset}`);
  console.log(`    ${C.dim}node brain-admin.cjs requests${C.reset}`);

  footer();
}

// ── Main dispatch ───────────────────────────────────────────────────

async function main() {
  const { command, flags } = parseArgs();

  const commands = {
    create: () => cmdCreate(flags),
    revoke: () => cmdRevoke(flags),
    extend: () => cmdExtend(flags),
    list: () => cmdList(),
    usage: () => cmdUsage(flags),
    requests: () => cmdRequests(),
    help: () => cmdHelp(),
  };

  if (!commands[command]) {
    console.error(`\n${C.red}Unknown command:${C.reset} ${command}`);
    cmdHelp();
    process.exit(1);
  }

  await commands[command]();
}

main().catch(err => {
  console.error(`\n${C.red}Fatal:${C.reset} ${err.message}`);
  process.exit(1);
});
