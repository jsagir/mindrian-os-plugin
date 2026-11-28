#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { classifyCallResult } = require('../../lib/core/dominant-design/theo-structure.cjs');
const { _proveKnownToolShape } = require('../../lib/core/part8-egress-guard.cjs');

const FRAMEWORKS = Object.freeze(['Red Teaming', 'Root Cause Analysis']);
const PREDICATES = Object.freeze([
  Object.freeze({ id: 'RT1', framework: 'Red Teaming', test: (row, steps, controls) => {
    const ordered = controls.filter(c => c.kind === 'ordered-dependency' && c.positions.length === steps.length && steps.every(s => c.positions.includes(s.position)));
    return !controls.some(c => c.kind === 'any-order') && ordered.length > 0;
  }}),
  Object.freeze({ id: 'RT2', framework: 'Red Teaming', test: (row, steps) => {
    const last = steps.reduce((a, b) => b.position > a.position ? b : a, steps[0]);
    return !!last && /portfolio/i.test(last.label || '');
  }}),
  Object.freeze({ id: 'RC1', framework: 'Root Cause Analysis', test: (row, steps, controls) => {
    const testControl = controls.find(c => c.kind === 'repeat-return' && c.returnPosition > 1);
    if (!testControl) return false;
    const source = testControl.positions[0];
    const last = Math.max(...steps.map(s => s.position));
    return steps.some(s => s.position > source && s.position < last && /rank|vital few|pareto|priorit/i.test(s.label || ''));
  }}),
  Object.freeze({ id: 'RC2', framework: 'Root Cause Analysis', test: (row, steps, controls) =>
    !controls.some(c => c.kind === 'choice') && controls.some(c => c.kind === 'any-order' && c.positions.length >= 2) }),
  Object.freeze({ id: 'RC3', framework: 'Root Cause Analysis', test: (row, steps, controls) => {
    const last = Math.max(...steps.map(s => s.position));
    return controls.some(c => c.kind === 'repeat-return' && c.positions.includes(last) && c.returnPosition === 1);
  }}),
  Object.freeze({ id: 'RC4', framework: 'Root Cause Analysis', test: (row, steps, controls) => {
    const last = Math.max(...steps.map(s => s.position));
    return controls.some(c => c.kind === 'repeat-return' && c.positions.some(p => p !== last) && c.returnPosition > 1);
  }})
]);

function stepIdMatches(id) {
  return typeof id === 'string' && !!_proveKnownToolShape({ framework: 'Red Teaming', step_id: id }, 'framework_step');
}
function reasonResult(reason, outcome = reason, raw = null) { return { state: 'not_read', reason, outcome, raw }; }
async function readRow({ framework, client } = {}) {
  if (!FRAMEWORKS.includes(framework)) return reasonResult('unknown_framework');
  let result;
  try {
    const useClient = client || require('../../lib/core/brain-client.cjs');
    result = await useClient.callTool('framework_step', { framework });
  } catch (_) { return reasonResult('call_threw'); }
  if (result && typeof result === 'object' && !Array.isArray(result) && result.refusal && typeof result.refusal === 'object') {
    return reasonResult('theo_refusal', 'theo_refusal', result);
  }
  const outcome = classifyCallResult('framework_step', result);
  if (outcome !== 'served') return reasonResult(outcome, outcome, result);
  const row = result.rows[0];
  return { state: 'read', reason: null, outcome, raw: result, row };
}
function actionSegment(value) { return typeof value === 'string' ? value.split('::').pop() : ''; }
function unpack(row) {
  const source = row && Array.isArray(row.steps) ? row.steps : [];
  const steps = source.map((s, i) => ({ raw: s, position: Number.isFinite(s.presentationOrder) ? s.presentationOrder : i + 1, label: typeof s.label === 'string' ? s.label : '' }));
  const bySegment = new Map(steps.map(s => [actionSegment(s.raw.stepId), s.position]));
  const map = new Map();
  let dropped = 0;
  for (const s of source) {
    let list;
    try { list = typeof s.controlJson === 'string' ? JSON.parse(s.controlJson) : s.controlJson; } catch (_) { continue; }
    if (!Array.isArray(list)) continue;
    for (const c of list) {
      if (!c || typeof c.kind !== 'string' || !Array.isArray(c.action_ids)) continue;
      const positions = c.action_ids.map(id => bySegment.get(actionSegment(id))).filter(Number.isFinite);
      if (!positions.length) { dropped++; continue; }
      const key = JSON.stringify([c.kind, c.action_ids, c.condition || null, c.return_to || null]);
      if (!map.has(key)) map.set(key, { kind: c.kind, positions: [...new Set(positions)].sort((a,b)=>a-b), condition: typeof c.condition === 'string', returnPosition: bySegment.get(actionSegment(c.return_to)) || null });
    }
  }
  return { steps, controls: [...map.values()], dropped };
}
function vector(framework, row) {
  const { steps, controls } = unpack(row);
  return PREDICATES.filter(p => p.framework === framework).map(p => ({ id: p.id, value: !!p.test(row, steps, controls) }));
}
function coverageDefault() { return path.resolve(__dirname, '../../.planning/phases/404-theo-recipes/404-COVERAGE.md'); }
function saveVector(file, framework, values) {
  const lines = [`## ${framework}`, ...values.map(x => `- ${x.id}: ${x.value}`), ''];
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, lines.join('\n'), 'utf8');
}
function parseArgs(args) {
  const out = { _: [] };
  for (let i=0;i<args.length;i++) { const k=args[i]; if(k.startsWith('--')) { const nx=args[i+1]; if (nx===undefined || nx.startsWith('--')) out[k.slice(2)]=true; else out[k.slice(2)]=args[++i]; } else out._.push(k); }
  return out;
}
async function main(argv = process.argv.slice(2)) {
  const a = parseArgs(argv); const coverage = a.coverage || coverageDefault();
  switch (argv[0]) {
    case '--check-gpws': {
      const framework = argv[1];
      const rowFile = a['row-file'];
      if (rowFile) return checkGpws(framework, rowFile, coverage);
      if (!FRAMEWORKS.includes(framework)) return 2;
      const read = await readRow({ framework });
      if (read.state !== 'read') return 2;
      return checkRow(framework, read.row, coverage);
    }
    case '--route': {
      if (argv[1] !== 'guarded') return 2;
      let any = false;
      for (const framework of FRAMEWORKS) { const read = await readRow({framework}); writeBlock(coverage, 'guarded', framework, read); if(read.state==='read') any=true; }
      return any ? 0 : 2;
    }
    case '--record-row': {
      const framework=a.framework; let raw;
      try { raw=JSON.parse(fs.readFileSync(a['row-file'],'utf8')); } catch (_) { return 2; }
      if (!FRAMEWORKS.includes(framework) || a.route !== 'theo-context') return 2;
      const row=raw.rows && raw.rows[0] ? raw.rows[0] : raw;
      writeBlock(coverage,a.route,framework,{state:'read',reason:null,outcome:'served',raw,row}); return 0;
    }
    case '--check-coverage': return checkCoverage(coverage);
    default: process.stderr.write('invalid mode\n'); return 2;
  }
}
function checkGpws(framework, rowFile, coverage) {
  if (!FRAMEWORKS.includes(framework)) return 2;
  let result;
  try { result=JSON.parse(fs.readFileSync(rowFile,'utf8')); } catch (_) { return 2; }
  const row=result.rows && result.rows[0]; if(!row || !Array.isArray(row.steps)) return 2;
  return checkRow(framework,row,coverage);
}
function checkRow(framework,row,coverage) {
  if (!row || !Array.isArray(row.steps)) return 2;
  const values=vector(framework,row); for(const v of values) process.stdout.write(`${v.id} ${v.value}\n`);
  saveVector(coverage,framework,values);
  const bad=values.filter(v=>!v.value).map(v=>v.id);
  process.stdout.write(`failed: ${bad.join(',') || 'none'}\n`);
  return bad.length ? 1 : 0;
}
function writeBlock(file, route, framework, read) {
  const values=read.state==='read' ? vector(framework,read.row) : PREDICATES.filter(p=>p.framework===framework).map(p=>({id:p.id,value:false}));
  const text=[`## ${route} | ${framework}`, `state: ${read.state}`, `reason: ${read.reason || 'none'}`, `outcome: ${read.outcome || 'none'}`, ...values.map(v=>`${v.id}: ${v.value}`),''].join('\n');
  fs.mkdirSync(path.dirname(file),{recursive:true}); fs.appendFileSync(file,text,'utf8');
}
function checkCoverage(file) {
  try { const s=fs.readFileSync(file,'utf8'); const blocks=(s.match(/^## (guarded|theo-context) \| (Red Teaming|Root Cause Analysis)$/gm)||[]); return blocks.length===4 ? 0 : 1; } catch (_) { return 1; }
}

if (require.main === module) main().then(code => { process.exitCode=code; }).catch(() => { process.exitCode=2; });
module.exports = { PREDICATES, readRow, stepIdMatches, vector, unpack, main };
