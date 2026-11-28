'use strict';

// Phase 401 slice 1; dev tool; not shipped because package.json files excludes tools.
// Follow the measure first rule of the design.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const LITERALS = ['mcp__mindrian-brain__', 'mcp-server-brain', 'pws-brain-mcp'];
const TOOLING = (p) => p.startsWith('tools/401/') || p.startsWith('tests/test-401-') ||
  ['tests/run-all-401.sh', 'scripts/check-frontmatter-split.cjs', 'scripts/check-tool-grants.cjs', 'data/tool-grants.json'].includes(p);

function walk(root, dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === '.git' || ent.name === 'node_modules') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(root, full, out);
    else if (ent.isFile()) out.push(path.relative(root, full).split(path.sep).join('/'));
  }
}
function fileList(root) {
  try { return cp.execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8' })
    .split('\0').filter(Boolean).filter((p) => !p.startsWith('.planning/')); }
  catch (_) { /* Git is unavailable for this non-worktree folder. */ }
  const out = []; walk(root, root, out); return out.filter((p) => !p.startsWith('.planning/')).sort();
}
function read(root, rel) { try { return fs.readFileSync(path.join(root, rel), 'utf8'); } catch (_) { return null; } }
function literalStats(root, files, literal) {
  const holding = [], bySegment = {};
  let occurrences = 0;
  for (const rel of files) {
    const body = read(root, rel); if (body === null) continue;
    const n = body.split(literal).length - 1;
    if (n) { holding.push(rel); occurrences += n; const seg = rel.split('/')[0]; bySegment[seg] = (bySegment[seg] || 0) + 1; }
  }
  return { files: holding.length, occurrences, by_first_segment: bySegment, paths: holding };
}
// Copy of descriptionOf from tests/test-400-description-budget.cjs, lines 19 to 36.
// Plan 401-07 replaces this copy with require('tests/helpers/surface-description.cjs').
function descriptionOf(md) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(md); if (!m) return '';
  const lines = m[1].split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const d = /^description:(.*)$/.exec(lines[i]); if (!d) continue;
    const parts = [d[1]];
    for (let k = i + 1; k < lines.length; k += 1) { const line = lines[k]; if (line.trim() === '' || /^\s/.test(line)) parts.push(line); else break; }
    while (parts.length > 1 && parts[parts.length - 1].trim() === '') parts.pop();
    return parts.join('\n');
  }
  return '';
}
function matches(rel, re) { return re.test(rel); }
function surface(rel) { return /^commands\/[^/]+\.md$/.test(rel) || /^skills\/[^/]+\/SKILL\.md$/.test(rel) || /^agents\/[^/]+\.md$/.test(rel); }
async function runMeasure(root, noTools) {
  root = path.resolve(root); const files = fileList(root);
  const scope = (p) => /^(commands|skills|agents|references)\//.test(p);
  const included = files;
  const names = literalStats(root, included, LITERALS[0]);
  const legacy = literalStats(root, included, LITERALS[1]);
  const retired = literalStats(root, included, LITERALS[2]);
  const legacyInside = files.filter((p) => p.startsWith('mcp-server-brain/')).length;
  const legacyOutsideHolding = legacy.paths.filter((p) => !p.startsWith('mcp-server-brain/')).length;
  const section1 = { ...names, in_scope: literalStats(root, included.filter(scope), LITERALS[0]).files,
    pipelines: literalStats(root, included.filter((p) => p.startsWith('pipelines/')), LITERALS[0]).files };
  const section2 = { ...legacy, tracked_inside_folder: legacyInside, files_outside_holding: legacyOutsideHolding };
  const dead = {};
  for (const lit of ['read_neo4j_cypher', 'get_neo4j_schema', 'mcp__neo4j-brain__', 'mcp__pinecone-brain__'])
    dead[lit] = literalStats(root, files.filter(scope), lit);
  const firing = { versions: {}, total_files: 0, block_bytes: null, distinct_blocks: 0 };
  const blockRe = /<!-- mos:firing-block v(\d+) -->[\s\S]*?<!-- \/mos:firing-block -->/g;
  const distinct = new Set(); let firstBlock = null;
  for (const rel of files.filter((p) => /^commands\/[^/]+\.md$/.test(p) || /^skills\/[^/]+\/SKILL\.md$/.test(p))) {
    const body = read(root, rel); if (body === null) continue;
    for (const m of body.matchAll(blockRe)) { const ver = m[1]; firing.versions[ver] = (firing.versions[ver] || 0) + 1; firing.total_files += 1; distinct.add(m[0]); if (firstBlock === null) firstBlock = m[0]; }
  }
  firing.block_bytes = firstBlock === null ? 0 : Buffer.byteLength(firstBlock, 'utf8'); firing.distinct_blocks = distinct.size;
  const expired = {};
  for (const name of ['hmi-status', 'organize', 'heal', 'visualize', 'mva-report', 'mva-brief'])
    expired[name] = { command: fs.existsSync(path.join(root, 'commands', name + '.md')), skill: fs.existsSync(path.join(root, 'skills', name)) };
  const surfaces = files.filter(surface), large = []; let descriptionBytes = 0;
  for (const rel of surfaces) { const body = read(root, rel); const n = Buffer.byteLength(descriptionOf(body || ''), 'utf8'); descriptionBytes += n; if (n > 300) large.push({ path: rel, bytes: n }); }
  const descriptions = { total_bytes: descriptionBytes, files_over_300_bytes: large };
  const toolGroupFiles = files.filter(TOOLING).filter((p) => LITERALS.some((lit) => (read(root, p) || '').includes(lit)));
  const groupStats = {}; const outsideStats = {};
  for (const lit of LITERALS) { groupStats[lit] = literalStats(root, included, lit); outsideStats[lit] = literalStats(root, included.filter((p) => !TOOLING(p)), lit); }
  let toolList = null;
  if (!noTools) {
    try {
      const helper = require(path.join(root, 'tests/helpers/mcp-wire-267.cjs'));
      const entries = ['scripts/mindrian-mcp-server.cjs', 'scripts/mindrian-brain-mcp-client.cjs'];
      toolList = {};
      for (const rel of entries) {
        const h = helper.hermeticEnv({});
        try {
          const result = await helper.rpcOverStdio(path.join(root, rel), [{ method: 'tools/list' }], { env: h.env, timeoutMs: 30000 });
          if (!result.initialize || !result.responses.has(2) || (result.responses.get(2) || {}).error) throw new Error('tools/list unavailable');
          const tools = (((result.responses.get(2) || {}).result || {}).tools) || [];
          const descriptionsList = tools.map((t) => ({ name: t.name, bytes: Buffer.byteLength(t.description || '', 'utf8') }));
          const largest = descriptionsList.slice().sort((a,b) => b.bytes-a.bytes)[0] || null;
          let schemaBytes = 0, schemaKeyBytes = 0, outputKeyBytes = 0;
          for (const t of tools) { schemaBytes += Buffer.byteLength(JSON.stringify(t.inputSchema || {}), 'utf8'); schemaKeyBytes += t.inputSchema && Object.prototype.hasOwnProperty.call(t.inputSchema, '$schema') ? Buffer.byteLength('$schema', 'utf8') : 0; outputKeyBytes += t.outputSchema && Object.prototype.hasOwnProperty.call(t.outputSchema, '$schema') ? Buffer.byteLength('$schema', 'utf8') : 0; }
          toolList[rel] = { tool_count: tools.length, description_bytes: descriptionsList.reduce((a,x)=>a+x.bytes,0), input_schema_bytes: schemaBytes,
            input_schema_dollar_schema_bytes: schemaKeyBytes, output_schema_dollar_schema_bytes: outputKeyBytes, largest_description: largest };
        } finally { h.cleanup(); }
      }
    } catch (e) { toolList = 'NOT MEASURED (' + (e.code || e.message) + ')'; }
  } else toolList = null;
  return { 'unscoped-name': section1, 'legacy-folder': section2, 'retired-server': retired,
    'dead-tool-names': dead, 'firing-block': firing, 'expired-commands': expired, descriptions,
    'tool-list': toolList, 'phase-401-tooling': { files: toolGroupFiles, with_group: groupStats, without_group: outsideStats } };
}
function textOutput(data) {
  const out = [];
  for (const key of Object.keys(data)) out.push(key + ': ' + (key === 'tool-list' && data[key] === null ? 'NOT MEASURED (--no-tools or unavailable package)' : JSON.stringify(data[key])));
  return out.join('\n');
}
async function main(argv) {
  let root = ROOT, json = false, noTools = false;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--json') json = true;
    else if (argv[i] === '--no-tools') noTools = true;
    else if (argv[i] === '--root' && argv[i + 1]) root = argv[++i];
    else { process.stderr.write('Usage: node tools/401/measure.cjs [--json] [--no-tools] [--root <dir>]\n'); process.exitCode = 2; return; }
  }
  const result = await runMeasure(root, noTools);
  process.stdout.write(json ? JSON.stringify(result, null, 2) + '\n' : textOutput(result) + '\n');
}
if (require.main === module) main(process.argv.slice(2)).catch((e) => { process.stderr.write(String(e.stack || e) + '\n'); process.exitCode = 1; });
module.exports = { fileList, literalStats, descriptionOf, runMeasure };
