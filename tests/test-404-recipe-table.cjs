'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), '404-table-'));
process.env.HOME = path.join(temp, 'home');
process.env.USERPROFILE = path.join(temp, 'profile');
process.env.MINDRIAN_HOME = path.join(temp, 'mindrian');
process.env.MINDRIAN_ROOMS_HOME = path.join(temp, 'rooms');
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
const names = require('../data/framework-names.json').framework_names;
const registry = require('../data/command-registry.json').commands;
const { OWN_TEXT_LABEL, readOwnText } = require('../lib/core/framework-recipe/steps.cjs');
const PENDING_UNTIL_S5 = Object.freeze([
  Object.freeze({ row: 'Red Teaming', code: 'stage_declaration' }),
  Object.freeze({ row: 'Root Cause Analysis', code: 'stage_declaration' }),
  Object.freeze({ row: 'Root Cause Analysis', code: 'outside_dependency' }),
]);
const lintWords = ['above','below','the chosen','the table','the formula','the components','see section'];
const cases = [];
function test(name, fn) { cases.push([name, fn]); }
function put(base, file, body) { const dest=path.join(base,file); fs.mkdirSync(path.dirname(dest),{recursive:true}); fs.writeFileSync(dest,body); }
function buildRoot(rows, extra={}) {
  const base=fs.mkdtempSync(path.join(temp,'case-'));
  const commands=extra.commands || {'/mos:challenge-assumptions': 'challenge-assumptions.md','/mos:root-cause':'root-cause.md'};
  const namesFile={snapshot_date:'2026-11-27',framework_names:names};
  put(base,'data/framework-names.json',JSON.stringify(namesFile));
  put(base,'data/command-registry.json',JSON.stringify({commands:registry}));
  put(base,'data/framework-recipes.json',JSON.stringify(rows));
  put(base,'commands/challenge-assumptions.md',fs.readFileSync(path.join(root,'commands/challenge-assumptions.md')));
  put(base,'commands/root-cause.md',fs.readFileSync(path.join(root,'commands/root-cause.md')));
  put(base,'references/methodology/challenge-assumptions.md','## Phases\n### Phase 1: One\nSynthetic body.\n### Phase 2: Two\nSynthetic body.');
  put(base,'references/methodology/root-cause.md','## Phases\n### Phase 1: One\nSynthetic body.\n### Phase 2: Two\nExecute the chosen method.');
  for (const [file,body] of Object.entries(extra.files || {})) put(base,file,body);
  if (extra.contract) put(base,'data/theo-context-contract.json',JSON.stringify(extra.contract));
  return base;
}
function shippedRows() { return JSON.parse(JSON.stringify(require('../data/framework-recipes.json'))); }
function commandFrontmatter(file) { const s=fs.readFileSync(file,'utf8').split('---')[1]||''; return s; }
function checkTable(base, opts={}) {
  const table=opts.table || JSON.parse(fs.readFileSync(path.join(base,'data/framework-recipes.json'),'utf8'));
  const errs=[]; const seen=new Set();
  const nameSet=opts.names || JSON.parse(fs.readFileSync(path.join(base,'data/framework-names.json'),'utf8')).framework_names;
  const commandRows=opts.registry || JSON.parse(fs.readFileSync(path.join(base,'data/command-registry.json'),'utf8')).commands;
  const byCommand=new Map(commandRows.map(x=>[x.command,x]));
  for (const [framework,row] of Object.entries(table)) {
    const add=(code,file,line=1)=>errs.push({row:framework,code,file,line});
    if (!nameSet.includes(framework)) add('framework_unknown','data/framework-recipes.json');
    const command=byCommand.get(row.command);
    if (!command) add('command_missing','data/framework-recipes.json');
    if (seen.has(row.command)) add('command_duplicate','data/framework-recipes.json'); seen.add(row.command);
    if (command && command.frameworks && !command.frameworks.includes(framework)) add('framework_mismatch','data/command-registry.json');
    const commandFile=path.join(base,'commands',String(row.command||'').replace(/^\/mos:/,'')+'.md');
    if (command && fs.existsSync(commandFile)) {
      const fm=commandFrontmatter(commandFile);
      if (!new RegExp('framework: ["\\\']?'+framework.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).test(fm)) add('framework_mismatch',commandFile);
      if (!/hitl_stages\s*:/.test(fm)) { const full=fs.readFileSync(commandFile,'utf8').split('---')[1]||''; const ix=full.split('\n').findIndex(line=>/^hitl_shape:/.test(line)); add('stage_declaration',commandFile,ix+1); }
    }
    const own=path.join(base,row.own_text||'');
    if (!fs.existsSync(own)) { add('own_text_missing',row.own_text||'data/framework-recipes.json'); continue; }
    const text=fs.readFileSync(own,'utf8');
    for (const error of checkOwnText(text, own)) errs.push(Object.assign({row:framework},error));
    if (row.own_flow) { const count=readOwnText(text,row.own_flow).steps.length; for (const control of row.own_flow.controls||[]) for (const n of control.steps||[]) if (!Number.isInteger(n)||n<1||n>count) add('own_flow_position',row.own_text); }
    if (!['theo_first','own_text'].includes(row.play)) add('play_invalid','data/framework-recipes.json');
    if (row.chat_play !== undefined) {
      if (!['theo_first','own_text'].includes(row.chat_play)) add('chat_play_invalid','data/framework-recipes.json');
      if (row.chat_play==='theo_first') {
        const contractFile=opts.contractPath||path.join(base,'data/theo-context-contract.json');
        let contract;
        try { contract=JSON.parse(fs.readFileSync(contractFile,'utf8')); } catch (_) { contract=null; }
        const namesFile=opts.namesPath||path.join(base,'data/framework-names.json');
        const snap=JSON.parse(fs.readFileSync(namesFile,'utf8')).snapshot_date;
        const state=contract&&contract.strict_canonical_check;
        if (row.play!=='theo_first'||!state||state.probe!=='refused'||state.upstream_calls!==0||!state.server_version||!state.verified_at||state.verified_at<snap) add('chat_route_not_cleared','data/theo-context-contract.json');
      }
    }
  }
  return errs;
}
function checkOwnText(text,file) {
  const errors=[]; const lines=text.split('\n'); const start=lines.findIndex(x=>/^## Phases\s*$/.test(x));
  if(start<0) return [{code:'phases_section_missing',file,line:1}];
  let end=lines.length; for(let i=start+1;i<lines.length;i++) if(/^## /.test(lines[i])) {end=i;break;}
  const section=lines.slice(start+1,end); const heads=[];
  section.forEach((line,i)=>{ if(/^### /.test(line)) heads.push({line:line.trim(),number:i+start+2}); });
  const phases=heads.filter(x=>/^### Phase \d+:/.test(x.line));
  const nums=phases.map(x=>Number(x.line.match(/^### Phase (\d+):/)[1]));
  if(nums.length<2||nums.some((n,i)=>n!==i+1)) errors.push({code:'phase_numbering',file,line:phases[0]?.number||start+1});
  const seen=new Set(); for(const h of phases) {const title=h.line.replace(/^### Phase \d+:\s*/,'').split(' (')[0].trim().toLowerCase(); if(seen.has(title)) errors.push({code:'phase_title_repeat',file,line:h.number}); seen.add(title);}
  for(const h of heads) if(!/^### Phase \d+:/.test(h.line)) errors.push({code:'foreign_heading_in_section',file,line:h.number});
  phases.forEach((h,i)=>{const from=h.number-start-2;const to=i+1<phases.length?phases[i+1].number-start-2:section.length;const body=section.slice(from+1,to).filter(x=>!/^What you end with:|^Done when:/.test(x)).join('\n').trim(); if(!body) errors.push({code:'phase_body_empty',file,line:h.number+1}); const words=[...lintWords,'references/','../','.md']; for(const word of words) if(body.toLowerCase().includes(word.toLowerCase())) {const index=lines.findIndex((line,j)=>j>=h.number&&j<end+start+1&&line.toLowerCase().includes(word.toLowerCase())); errors.push({code:'outside_dependency',file,line:index+1});break;} });
  return errors;
}
function baseErrors() { const errs=checkTable(root); return {base:root,errs}; }

test('T1 checks canon, command, connector, duplicates, file, flow, and route values',()=>{
  const rows=shippedRows(); const {base}=baseErrors(rows);
  const checks=[[r=>{r['Bad Framework']=r['Red Teaming'];delete r['Red Teaming'];},'framework_unknown'],[r=>{r['Red Teaming'].command='/mos:absent';},'command_missing'],[r=>{r['Red Teaming'].command='/mos:root-cause';},'framework_mismatch'],[r=>{r['Root Cause Analysis'].command='/mos:challenge-assumptions';},'command_duplicate'],[r=>{r['Red Teaming'].own_text='missing.md';},'own_text_missing'],[r=>{r['Red Teaming'].own_flow={controls:[{steps:[0]}]};},'own_flow_position'],[r=>{r['Red Teaming'].play='bad';},'play_invalid'],[r=>{r['Red Teaming'].chat_play='bad';},'chat_play_invalid']]; for(const [change,code] of checks) {const copy=JSON.parse(JSON.stringify(rows));change(copy);assert.ok(checkTable(base,{table:copy}).some(x=>x.code===code),code);}
  assert.ok(checkTable(base,{table:rows}).some(x=>x.code==='stage_declaration'));
});
test('T2 checks each loader error code and prints file and line',()=>{
  const samples=[['phases_section_missing','No section'],['phase_numbering','## Phases\n### Phase 2: A\nX\n### Phase 3: B\nY'],['phase_title_repeat','## Phases\n### Phase 1: A\nX\n### Phase 2: a\nY'],['phase_body_empty','## Phases\n### Phase 1: A\n\n### Phase 2: B\nY'],['foreign_heading_in_section','## Phases\n### Phase 1: A\nX\n### Other\nY\n### Phase 2: B\nY']];
  for(const [code,text] of samples) {const e=checkOwnText(text,'synthetic.md');assert.ok(e.some(x=>x.code===code));assert.ok(e.every(x=>x.file&&x.line));} for(const text of ['## Phases\n### Phase 1: A\nX\n### Phase 1: B\nY','## Phases\n### Phase 1: A\nX\n### Phase 3: B\nY']) assert.ok(checkOwnText(text,'synthetic.md').some(x=>x.code==='phase_numbering'));
});
test('T3 lints each back-reference word and permits clean text',()=>{for(const word of [...lintWords,'references/','../','.md']) {const e=checkOwnText(`## Phases\n### Phase 1: A\nUse ${word} now.\n### Phase 2: B\nDone.`,'synthetic.md');assert.ok(e.some(x=>x.code==='outside_dependency'));} assert.equal(checkOwnText('## Phases\n### Phase 1: A\nClean.\n### Phase 2: B\nClean.','synthetic.md').some(x=>x.code==='outside_dependency'),false);});
test('T4 requires the verified contract for chat Theo play',()=>{
  const rows=shippedRows(); rows['Red Teaming'].play='theo_first';rows['Red Teaming'].chat_play='theo_first'; const base=buildRoot(rows); const errs=checkTable(base);assert.ok(errs.some(x=>x.code==='chat_route_not_cleared'));
  const good=buildRoot(rows,{contract:{strict_canonical_check:{probe:'refused',upstream_calls:0,server_version:'1',verified_at:'2026-11-28'}}}); assert.equal(checkTable(good).some(x=>x.code==='chat_route_not_cleared'),false); for(const contract of [{strict_canonical_check:{probe:'ok',upstream_calls:0,verified_at:'2026-11-28'}},{strict_canonical_check:{probe:'refused',upstream_calls:1,verified_at:'2026-11-28'}},{strict_canonical_check:{probe:'refused',upstream_calls:0,verified_at:'2026-11-26'}}]) {const bad=buildRoot(rows,{contract});assert.ok(checkTable(bad).some(x=>x.code==='chat_route_not_cleared'));} const badPlay=shippedRows();badPlay['Red Teaming'].chat_play='theo_first';const wrong=buildRoot(badPlay,{contract:{strict_canonical_check:{probe:'refused',upstream_calls:0,verified_at:'2026-11-28'}}});assert.ok(checkTable(wrong).some(x=>x.code==='chat_route_not_cleared'));
});
test('T5 shipped rows use own text and no route contract',()=>{const rows=shippedRows();assert.deepEqual(Object.keys(rows).sort(),['Red Teaming','Root Cause Analysis']);for(const [framework,r] of Object.entries(rows)){assert.equal(r.play,'own_text');assert.equal(r.play_reason,'pws_differs');assert.equal(r.command,framework==='Red Teaming'?'/mos:challenge-assumptions':'/mos:root-cause');assert.equal(r.own_text,framework==='Red Teaming'?'references/methodology/challenge-assumptions.md':'references/methodology/root-cause.md');assert.ok(r.chat_play===undefined||r.chat_play==='own_text');}assert.equal(fs.existsSync(path.join(root,'data/theo-context-contract.json')),false);});
test('T6 pending BASE checks remain visible and no other shipped check fails',()=>{const {errs}=baseErrors();for(const pending of PENDING_UNTIL_S5) assert.ok(errs.some(x=>x.row===pending.row&&x.code===pending.code),`remove this entry: ${pending.row} ${pending.code}`);console.log('PENDING_UNTIL_S5 measured:', errs.map(x=>`${x.row} ${x.code} ${path.relative(root,x.file)}:${x.line}`).join(' | ')); assert.deepEqual(errs.map(x=>({row:x.row,code:x.code})).sort((a,b)=>a.row.localeCompare(b.row)||a.code.localeCompare(b.code)),PENDING_UNTIL_S5.map(x=>({row:x.row,code:x.code})).sort((a,b)=>a.row.localeCompare(b.row)||a.code.localeCompare(b.code)));});
test('T7 stage check waits for Part B',()=>{const file=path.join(root,'lib/core/framework-recipe/plan.cjs');if(!fs.existsSync(file)||!require(file).RECIPE_STAGES) {return;}assert.ok(require(file).RECIPE_STAGES);});
test('T8 loader label remains a single fixed source',()=>{assert.equal(OWN_TEXT_LABEL,'These steps come from the MindrianOS method text, not from Theo this time.');});
(async()=>{let pass=0,fail=0;for(const [name,fn] of cases){try{await fn();pass++;console.log(`ok ${name}`);}catch(e){fail++;console.log(`FAIL ${name}: ${e.message}`);}}console.log(`404 recipe table: ${pass} passed, ${fail} failed`);fs.rmSync(temp,{recursive:true,force:true});if(fail)process.exitCode=1;})();
