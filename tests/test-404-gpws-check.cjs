#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'gpws-'));
process.env.HOME = path.join(temp, 'home');
process.env.USERPROFILE = path.join(temp, 'profile');
process.env.MINDRIAN_HOME = path.join(temp, 'mindrian');
process.env.MINDRIAN_ROOMS_HOME = path.join(temp, 'rooms');
for (const p of [process.env.HOME, process.env.USERPROFILE, process.env.MINDRIAN_HOME, process.env.MINDRIAN_ROOMS_HOME]) fs.mkdirSync(p, { recursive: true });
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';

const tool = path.join(root, 'tools/404/read-pilot-rows.cjs');
let passed = 0;
let failed = 0;
const pending = [];
function check(id, name, fn) {
  try {
    const value = fn();
    if (value && typeof value.then === 'function') {
      pending.push(value.then(() => { passed++; process.stdout.write(`  ok ${id} ${name}\n`); }, e => { failed++; process.stdout.write(`  FAIL ${id} ${name}: ${e.message}\n`); }));
    } else { passed++; process.stdout.write(`  ok ${id} ${name}\n`); }
  } catch (e) { failed++; process.stdout.write(`  FAIL ${id} ${name}: ${e.message}\n`); }
}
function run(args) {
  return spawnSync(process.execPath, [tool, ...args], { cwd: root, env: process.env, encoding: 'utf8' });
}
function step(n, title, kind = 'ordered-dependency', controls = []) {
  return { stepId: `method::red-teaming::action::s${n}`, label: title, runIt: `RUN_CANARY_${n}`, stepKind: 'STEP', flowKind: kind,
    presentationOrder: n, controlJson: JSON.stringify(controls), authoredContent: { expectedOutput: `OUT_CANARY_${n}`, transitionCriteria: `TRANS_CANARY_${n}` } };
}
function control(kind, action_ids, extra = {}) { return { kind, action_ids, ...extra }; }
function rtRow(last = 'Build a portfolio') {
  const ss = [1,2,3,4,5].map(n => step(n, n === 5 ? last : `Red item ${n}`));
  ss.forEach(s => { s.controlJson = JSON.stringify([control('ordered-dependency', ss.map(x => `method::red-teaming::action::s${x.presentationOrder}`))]); });
  return { rows: [{ name: 'Red Teaming', orchestrationStatus: 'draft', steps: ss }] };
}
function rcRow(overrides = {}) {
  const ss = [1,2,3,4,5].map(n => step(n, n === 3 ? 'Prioritization and vital few' : `Root step ${n}`));
  ss[0].label = 'Observed effect';
  ss[1].label = 'Test the cause';
  ss[4].label = 'Final statement';
  ss.forEach((s, i) => {
    const cs = [control('any-order', ['method::root-cause-analysis::action::s1', 'method::root-cause-analysis::action::s2'])];
    cs.push(control('repeat-return', ['method::root-cause-analysis::action::s2'], { return_to: 'method::root-cause-analysis::action::s3' }));
    cs.push(control('repeat-return', ['method::root-cause-analysis::action::s5'], { return_to: 'method::root-cause-analysis::action::s1' }));
    cs.push(control('repeat-return', ['method::root-cause-analysis::action::s4'], { return_to: 'method::root-cause-analysis::action::s3' }));
    s.controlJson = JSON.stringify(cs);
    s.stepId = `method::root-cause-analysis::action::s${i+1}`;
  });
  if (overrides.rc1) ss[2].label = 'Root step 3';
  if (overrides.rc2) ss.forEach(s => { s.controlJson = JSON.stringify([control('repeat-return', ['method::root-cause-analysis::action::s2'], { return_to: 'method::root-cause-analysis::action::s3' }), control('repeat-return', ['method::root-cause-analysis::action::s5'], { return_to: 'method::root-cause-analysis::action::s1' }), control('repeat-return', ['method::root-cause-analysis::action::s4'], { return_to: 'method::root-cause-analysis::action::s3' })]); });
  if (overrides.rc3) ss.forEach(s => { s.controlJson = JSON.stringify([control('any-order', ['method::root-cause-analysis::action::s1', 'method::root-cause-analysis::action::s2']), control('repeat-return', ['method::root-cause-analysis::action::s2'], { return_to: 'method::root-cause-analysis::action::s3' }), control('repeat-return', ['method::root-cause-analysis::action::s5'], { return_to: 'method::root-cause-analysis::action::s2' }), control('repeat-return', ['method::root-cause-analysis::action::s4'], { return_to: 'method::root-cause-analysis::action::s3' })]); });
  // RC4 fails when no repeat-return with a return above position 1 leaves a step other than the last. RC1 reads the same
  // control to find the test step, so a row without it fails RC1 too (the dependency is in 404-DESIGN.md, RC1 and RC4).
  if (overrides.rc4) ss.forEach(s => { s.controlJson = JSON.stringify([control('any-order', ['method::root-cause-analysis::action::s1', 'method::root-cause-analysis::action::s2']), control('repeat-return', ['method::root-cause-analysis::action::s5'], { return_to: 'method::root-cause-analysis::action::s1' })]); });
  return { rows: [{ name: 'Root Cause Analysis', orchestrationStatus: 'draft', steps: ss }] };
}
function servedRcRow() {
  const ids = [1,2,3,4,5,6].map(n => `method::root-cause-analysis::action::s${n}`);
  const all = [
    control('ordered-dependency',[ids[0],ids[1],ids[2],ids[4],ids[5]]),
    control('ordered-dependency',[ids[1],ids[3],ids[4]]),
    control('choice',[ids[2],ids[3]],{condition:'COND_CANARY'}),
    control('repeat-return',[ids[4]],{return_to:ids[2],condition:'COND_CANARY'})
  ];
  const ss = ids.map((id,i) => ({...step(i+1,`RC_CANARY_${i+1}`),stepId:id,flowKind:['ordered-dependency','ordered-dependency','choice','choice','repeat-return','ordered-dependency'][i]}));
  ss.forEach(s => { s.controlJson=JSON.stringify(all); });
  return {rows:[{name:'Root Cause Analysis',orchestrationStatus:'draft',steps:ss}]};
}
function fileRow(row, suffix) {
  const f = path.join(temp, `${suffix}.json`); fs.writeFileSync(f, JSON.stringify(row)); return f;
}
function cli(framework, row, name) {
  const coverage = path.join(temp, `${name}.md`);
  const f = fileRow(row, name);
  const result = run(['--check-gpws', framework, '--row-file', f, '--coverage', coverage]);
  return { result, coverage: fs.existsSync(coverage) ? fs.readFileSync(coverage, 'utf8') : '' };
}

check('G1', 'valid first method row passes', () => { const r=cli('Red Teaming', rtRow(), 'g1').result; if (r.status !== 0) throw Error(`status ${r.status}; ${r.stdout}`); });
check('G2', 'free order fails first method flow rule', () => { const row=rtRow(); row.rows[0].steps.forEach(s => { s.controlJson=JSON.stringify([control('any-order',row.rows[0].steps.map(x=>x.stepId))]); }); const r=cli('Red Teaming',row,'g2').result; if(r.status!==1||!r.stdout.includes('RT1')) throw Error(`${r.status}: ${r.stdout} ${r.stderr} ${r.error && r.error.message}`); });
check('G3', 'missing final keyword fails second method rule', () => { const r=cli('Red Teaming',rtRow('Final item'),'g3').result; if(r.status!==1||!r.stdout.includes('RT2')) throw Error(`${r.status}: ${r.stdout} ${r.stderr}`); });
check('G4', 'valid second method row passes', () => { const r=cli('Root Cause Analysis',rcRow(),'g4').result; if(r.status!==0) throw Error(`status ${r.status}; ${r.stdout}`); });
for (const [id, key] of [['G5','rc1'],['G6','rc2'],['G7','rc3'],['G8','rc4']]) check(id, `${key} failure is isolated`, () => { const r=cli('Root Cause Analysis',rcRow({[key]:true}),id).result; const failedIds=[...r.stdout.matchAll(/^(RC[1-4]) false$/gm)].map(m=>m[1]); const expected=key==='rc4'?'RC1,RC4':key.toUpperCase(); if(r.status!==1||failedIds.join(',')!==expected) throw Error(r.stdout); });
check('G9', 'served shapes fail the expected predicates', () => {
  const a=cli('Red Teaming',rtRow('Bias review'),'g9a').result;
  const b=cli('Root Cause Analysis',servedRcRow(),'g9b').result;
  if(a.status!==1||!a.stdout.includes('RT1')||!a.stdout.includes('RT2')||b.status!==1||!b.stdout.includes('RC1')||!b.stdout.includes('RC2')||!b.stdout.includes('RC3')) throw Error(`${a.stdout}\n${b.stdout}`);
});
check('G10', 'missing row and unknown framework return no row', () => { const a=run(['--check-gpws','Red Teaming','--row-file',path.join(temp,'absent.json')]); const b=run(['--check-gpws','Unknown','--row-file',path.join(temp,'absent.json')]); if(a.status!==2||b.status!==2) throw Error(`${a.status}, ${b.status}`); });
check('G11', 'repeated controls do not change the vector', () => { const row=rcRow(); const r=cli('Root Cause Analysis',row,'g11').result; if(r.status!==0) throw Error(r.stdout); });
check('G12', 'coverage has booleans and no canary text', () => { const r=cli('Red Teaming',rtRow(),'g12'); if(!/RT1:\s+true/.test(r.coverage)||/CANARY|Build a portfolio/.test(r.coverage)) throw Error(r.coverage); });
check('G13', 'fake guarded read uses one canon key and classifies outcomes', () => {
  const api=require(tool); const calls=[]; const client={callTool:async (name,args)=>{calls.push([name,args]);return {rows:[{name:'Red Teaming',orchestrationStatus:'draft',steps:[step(1,'X')]}]};}};
  return api.readRow({framework:'Red Teaming',client}).then(x=>{if(calls.length!==1||calls[0][0]!=='framework_step'||JSON.stringify(calls[0][1])!==JSON.stringify({framework:'Red Teaming'}))throw Error('bad call'); if(x.state!=='read')throw Error(x.state);}).then(async()=>{
    const thrown=await api.readRow({framework:'Red Teaming',client:{callTool:async()=>{throw Error('x');}}}); if(thrown.reason!=='call_threw')throw Error(thrown.reason);
    const refusal=await api.readRow({framework:'Red Teaming',client:{callTool:async()=>({refusal:{code:'X'}})}}); if(refusal.reason!=='theo_refusal')throw Error(refusal.reason);
    const refused=await api.readRow({framework:'Red Teaming',client:{callTool:async()=>({refusals:[]})}}); if(refused.reason!=='refused')throw Error(refused.reason);
  });
});
check('G14', 'step identifiers use the shared shape guard', () => { const api=require(tool); const exact='phase42::framework::'+('a'.repeat(64)+'-'+ 'a'.repeat(64))+'::'+ 'b'.repeat(7); for(const id of ['abc::def::s01','phase42::framework::red-teaming::step-one',exact]) if(!api.stepIdMatches(id)) throw Error('expected match'); for(const id of ['a sentence','a'.repeat(161)]) if(api.stepIdMatches(id)) throw Error('unexpected match'); });
check('G15', 'guarded child with closed endpoint exits without a crash', () => { const r=run(['--route','guarded','--coverage',path.join(temp,'g15.md')]); if(r.status!==2) throw Error(`status ${r.status}: ${r.stderr}`); });
check('G17', 'record-row after a flag without a value writes a theo-context block', () => { const row=path.join(temp,'g17.json'); fs.writeFileSync(row, JSON.stringify(rtRow('Item'))); const cov=path.join(temp,'g17.md'); const r=run(['--record-row','--route','theo-context','--framework','Red Teaming','--row-file',row,'--coverage',cov]); if(r.status!==0) throw Error(`status ${r.status}: ${r.stderr}`); const text=fs.readFileSync(cov,'utf8'); if(!/## theo-context \| Red Teaming/.test(text)||/RUN_CANARY|OUT_CANARY/.test(text)) throw Error(text); });
check('G16', 'frozen table has six required identifiers', () => { const api=require(tool); if(JSON.stringify(api.PREDICATES.map(x=>x.id))!==JSON.stringify(['RT1','RT2','RC1','RC2','RC3','RC4'])) throw Error('predicate ids differ'); });

Promise.resolve().then(async()=>{
  await Promise.all(pending);
  fs.rmSync(temp,{recursive:true,force:true});
  process.stdout.write(`404 gpws: ${passed} passed, ${failed} failed\n`);
  process.exitCode=failed?1:0;
}).catch(e=>{process.stderr.write(`${e.message}\n`);fs.rmSync(temp,{recursive:true,force:true});process.exitCode=1;});
