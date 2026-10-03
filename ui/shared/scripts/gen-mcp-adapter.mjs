#!/usr/bin/env node
/*
 * gen-mcp-adapter.mjs -- generate the internal 1:1 MCP adapter (Phase 369-08, D-15).
 *
 * Reads the recorded tools/list wire snapshot (tests/fixtures/267/wire-snapshot-zod4.json,
 * local.tools) and writes ui/shared/src/generated/mcp-adapter.ts: the tool name
 * list, one args type per tool derived from its inputSchema, and one call
 * wrapper per tool. The server's zod schemas are the single source of truth:
 * this adds call wrappers and types, never a second schema and never
 * validation. The adapter is INTERNAL: it is exposed to neither humans nor
 * agents and can never be registered as a shell action (see actions.ts).
 *
 *   node ui/shared/scripts/gen-mcp-adapter.mjs           write the file
 *   node ui/shared/scripts/gen-mcp-adapter.mjs --check   exit 1 with the first
 *                                                        differing line on drift
 *
 * Node built-ins only. ESM.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..');
const SNAPSHOT_REL = 'tests/fixtures/267/wire-snapshot-zod4.json';
const OUT = path.join(HERE, '..', 'src', 'generated', 'mcp-adapter.ts');

// Escape anything outside printable ASCII so the generated file never carries
// a literal long dash or other stray character.
function lit(value) {
  return JSON.stringify(value).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

function pascal(name) {
  return name
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join('');
}

// A tool named like a reserved word (the `export` tool) gets a Tool suffix so
// the wrapper is a legal function name.
const RESERVED = new Set([
  'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else',
  'enum', 'export', 'extends', 'false', 'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof',
  'new', 'null', 'return', 'super', 'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void',
  'while', 'with', 'yield', 'let', 'static', 'await', 'async', 'interface', 'package', 'private',
  'protected', 'public', 'implements',
]);

function camel(name) {
  const p = pascal(name);
  const c = p[0].toLowerCase() + p.slice(1);
  return RESERVED.has(c) ? c + 'Tool' : c;
}

function tsType(schema) {
  if (!schema || typeof schema !== 'object') return 'unknown';
  if (Array.isArray(schema.enum) && schema.enum.every((v) => typeof v === 'string')) {
    return schema.enum.map(lit).join(' | ') || 'unknown';
  }
  if (Array.isArray(schema.anyOf) || Array.isArray(schema.oneOf)) {
    const parts = (schema.anyOf || schema.oneOf).map(tsType);
    return Array.from(new Set(parts)).join(' | ') || 'unknown';
  }
  const t = schema.type;
  if (Array.isArray(t)) {
    return Array.from(new Set(t.map((x) => tsType(Object.assign({}, schema, { type: x }))))).join(' | ');
  }
  if (t === 'string') return 'string';
  if (t === 'number' || t === 'integer') return 'number';
  if (t === 'boolean') return 'boolean';
  if (t === 'null') return 'null';
  if (t === 'array') {
    const item = tsType(schema.items);
    return (item.includes(' | ') ? '(' + item + ')' : item) + '[]';
  }
  return 'unknown';
}

function argsType(tool) {
  const schema = tool.inputSchema || {};
  const props = schema.properties || {};
  const required = new Set(Array.isArray(schema.required) ? schema.required : []);
  const names = Object.keys(props).sort();
  if (names.length === 0) return 'Record<string, never>';
  const lines = names.map((n) => '  ' + lit(n) + (required.has(n) ? '' : '?') + ': ' + tsType(props[n]) + ';');
  return '{\n' + lines.join('\n') + '\n}';
}

export function generate() {
  const snap = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, SNAPSHOT_REL), 'utf8'));
  const tools = snap.local.tools.slice().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  // Two tools can camel-case to the same identifier (room-graph, the MCP App
  // view, and room_graph). The hyphenated one takes a Hyphenated suffix.
  const counts = new Map();
  for (const t of tools) counts.set(camel(t.name), (counts.get(camel(t.name)) || 0) + 1);
  const ident = (t) => {
    const clash = counts.get(camel(t.name)) > 1 && t.name.includes('-');
    return { fn: camel(t.name) + (clash ? 'Hyphenated' : ''), type: pascal(t.name) + (clash ? 'Hyphenated' : '') + 'Args' };
  };
  const out = [];
  out.push('/*');
  out.push(' * GENERATED FILE. DO NOT EDIT.');
  out.push(' * Source: ' + SNAPSHOT_REL + ' (local.tools, ' + tools.length + ' tools).');
  out.push(' * Regenerate: node ui/shared/scripts/gen-mcp-adapter.mjs');
  out.push(' * Verify:     node ui/shared/scripts/gen-mcp-adapter.mjs --check');
  out.push(' *');
  out.push(' * The internal 1:1 adapter over the MindrianOS MCP tools. Call wrappers and');
  out.push(' * argument types only: no validation and no schema of its own, because the');
  out.push(" * server's schemas are the single source. Exposed to neither humans nor agents.");
  out.push(' */');
  out.push('');
  out.push('export type CallTool = (tool: string, args: Record<string, unknown>) => Promise<unknown>;');
  out.push('');
  out.push('export const MCP_TOOL_NAMES = [');
  for (const t of tools) out.push('  ' + lit(t.name) + ',');
  out.push('] as const;');
  out.push('');
  out.push('export type McpToolName = (typeof MCP_TOOL_NAMES)[number];');
  for (const t of tools) {
    const { fn, type: T } = ident(t);
    out.push('');
    out.push('export type ' + T + ' = ' + argsType(t) + ';');
    out.push('');
    out.push('export function ' + fn + '(call: CallTool, args: ' + T + '): Promise<unknown> {');
    out.push('  return call(' + lit(t.name) + ', args as Record<string, unknown>);');
    out.push('}');
  }
  out.push('');
  return out.join('\n');
}

function main() {
  const next = generate();
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = fs.readFileSync(OUT, 'utf8');
    } catch (_e) {
      console.error('gen-mcp-adapter: ' + path.relative(REPO_ROOT, OUT) + ' is missing; run the generator');
      process.exit(1);
    }
    if (current === next) {
      console.log('gen-mcp-adapter: up to date (' + path.relative(REPO_ROOT, OUT) + ')');
      return;
    }
    const a = current.split('\n');
    const b = next.split('\n');
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
    console.error('gen-mcp-adapter: DRIFT at line ' + (i + 1));
    console.error('  committed: ' + (a[i] === undefined ? '(end of file)' : a[i]));
    console.error('  generated: ' + (b[i] === undefined ? '(end of file)' : b[i]));
    process.exit(1);
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, next);
  console.log('gen-mcp-adapter: wrote ' + path.relative(REPO_ROOT, OUT));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
