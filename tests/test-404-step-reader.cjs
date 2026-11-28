'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), '404-step-'));
process.env.HOME = path.join(temp, 'home');
process.env.USERPROFILE = path.join(temp, 'profile');
process.env.MINDRIAN_HOME = path.join(temp, 'mindrian');
process.env.MINDRIAN_ROOMS_HOME = path.join(temp, 'rooms');
process.env.MINDRIAN_BRAIN_URL = 'http://127.0.0.1:9';
const { readSteps, readOwnText, uniqueStepTitles, isProcessStepId, OWN_TEXT_LABEL, OWN_TEXT_REASONS, NOT_AUTHORED_CODES, STEP_READ_LIMIT_MS, artifactSourceLine, reasonForRefusal, refusalResult, CAP_TITLE, OPEN_ITEMS_HEADING, WALK_STOP_LINE, WALK_RESTART_LINE } = require('../lib/core/framework-recipe/steps.cjs');
const fixtures = path.join(__dirname, 'fixtures/404');
const row = name => JSON.parse(fs.readFileSync(path.join(fixtures, name), 'utf8'));
const cases = [];
function test(name, fn) { cases.push([name, fn]); }
function served() { return row('red-teaming.theo-2026-11-27.json'); }

test('R1 maps safe fields and nested authored fields', async () => {
  const r = await readSteps({ framework: 'Red Teaming', fetchRow: async () => served(), play: 'theo_first' });
  assert.equal(r.source, 'theo'); assert.deepEqual(Object.keys(r.steps[0]).sort(), ['body','done_when','ends_with','id','n','title']);
  assert.equal(r.steps[0].ends_with, 'Synthetic end 1'); assert.equal(r.steps[0].done_when, 'Synthetic done 1'); const fallback=await readSteps({framework:'Red Teaming',fetchRow:async()=>({rows:[{steps:[{stepId:'x',presentationOrder:1,label:'Top',runIt:'Body',expectedOutput:'Top end',transitionCriteria:'Top done'}]}]}),play:'theo_first'}); assert.equal(fallback.steps[0].ends_with,'Top end'); assert.equal(fallback.steps[0].done_when,'Top done');
});
test('R2 applies title and body caps', async () => {
  const item = { stepId: 'a', presentationOrder: 1, label: 'x'.repeat(200), runIt: 'y'.repeat(5000), authoredContent:{expectedOutput:'z'.repeat(2200),transitionCriteria:'q'.repeat(2200)} };
  const r = await readSteps({ framework: 'Red Teaming', fetchRow: async () => ({ rows: [{ steps: [item] }] }), play: 'theo_first' });
  assert.equal(r.steps[0].title.length, 120); assert.equal(r.steps[0].body.length, 4000); assert.equal(r.steps[0].ends_with.length, 2000); assert.equal(r.steps[0].done_when.length, 2000); assert.equal(CAP_TITLE, 120);
});
test('R3 drops bulk result fields', async () => {
  const r = await readSteps({ framework: 'Red Teaming', fetchRow: async () => served(), play: 'theo_first' });
  const s = JSON.stringify(r); for (const k of ['sourceRefsJson','controlJson','rawContent','authoredContent']) assert.equal(s.includes(k), false);
});
test('R4 deduplicates controls and drops unknown actions', async () => {
  const r = await readSteps({ framework: 'Red Teaming', fetchRow: async () => served(), play: 'theo_first' });
  assert.equal(r.flow.controls.length, 1); assert.equal(r.flow.controls[0].kind, 'any-order'); const bad=await readSteps({framework:'Red Teaming',fetchRow:async()=>({rows:[{steps:[{stepId:'abc::def::s01',presentationOrder:1,label:'A',runIt:'A',controlJson:[{kind:'choice',action_ids:['unknown']}] }]}]}),play:'theo_first'}); assert.ok(bad.reason_detail.includes('unknown control action'));
});
test('R5 uses guard proof for process ids', async () => {
  const r = await readSteps({ framework: 'Red Teaming', fetchRow: async () => served(), play: 'theo_first' });
  assert.equal(isProcessStepId(r.steps[0].id), true); assert.equal(isProcessStepId('sentence'), false);
});
test('R6 own text makes no call and labels the source', async () => {
  let calls = 0; const r = await readSteps({ framework: 'Red Teaming', play: 'own_text', playReason: 'pws_differs', ownText: '## Phases\n### Phase 1: A\nA\n### Phase 2: B\nB', fetchRow: async () => { calls++; } });
  assert.equal(calls, 0); assert.equal(r.source, 'plugin_reference'); assert.equal(r.reason, 'pws_differs'); assert.equal(r.notices[0], OWN_TEXT_LABEL);
});
test('R7 falls back on thrown calls and refusal', async () => {
  const a = await readSteps({ framework: 'Red Teaming', play: 'theo_first', ownText: '## Phases\n### Phase 1: A\nA\n### Phase 2: B\nB', fetchRow: async () => { throw Error('x'); } });
  const b = await readSteps({ framework: 'Red Teaming', play: 'theo_first', ownText: '## Phases\n### Phase 1: A\nA\n### Phase 2: B\nB', fetchRow: async () => row('refusal.json') });
  assert.equal(a.reason, 'call_threw'); assert.equal(b.reason, 'theo_refusal'); assert.equal('refusal' in a, false);
});
test('R8 skips definition rows and caps input count', async () => {
  const steps = [{ stepKind: 'DEFINITION' }, {stepKind:'ASIDE'}, ...Array.from({length: 55}, (_,i) => ({ stepId: 's'+i, presentationOrder:i+1, label:'S'+i, runIt:'B' }))];
  const r = await readSteps({ framework: 'Red Teaming', fetchRow: async () => ({rows:[{steps}]}), play:'theo_first' }); assert.equal(r.steps.length, 48);
});
test('R9 reads phase records and optional lines', () => {
  const text=fs.readFileSync(path.join(fixtures,'own-text-straight.md'),'utf8'); const r=readOwnText(text);
  assert.equal(r.steps.length,3); assert.equal(r.steps[0].title,'First'); assert.equal(r.steps[1].ends_with,'synthetic result.'); assert.equal(r.steps[1].done_when,'synthetic check.');
});
test('R10 scans only the Phases section', () => {
  const text=fs.readFileSync(path.join(fixtures,'own-text-flow.md'),'utf8'); const r=readOwnText(text); assert.equal(r.steps.length,4);
});
test('R11 refuses fewer than 2 phases', () => { assert.deepEqual(readOwnText('## Phases\n### Phase 1: A\nText'), {refusal:'own_text_missing'}); });
test('R12 pins the fixed label', () => { assert.equal(Buffer.from(OWN_TEXT_LABEL).toString('hex'), '546865736520737465707320636f6d652066726f6d20746865204d696e647269616e4f53206d6574686f6420746578742c206e6f742066726f6d205468656f20746869732074696d652e'); });
test('R13 pins 14 reason records', () => { assert.equal(Object.isFrozen(OWN_TEXT_REASONS),true); assert.equal(OWN_TEXT_REASONS.length,14); assert.equal(JSON.stringify(OWN_TEXT_REASONS).includes('local_session_required'),false); assert.deepEqual(NOT_AUTHORED_CODES,[]); });
test('R14 source line follows route', () => { assert.equal(artifactSourceLine('plugin_reference','terminal'),OWN_TEXT_LABEL); assert.equal(artifactSourceLine('plugin_reference','chat'),OWN_TEXT_LABEL); assert.match(artifactSourceLine('theo','terminal'),/Theo/); });
test('R15 source has no forbidden runtime dependency', () => { const s=fs.readFileSync(require.resolve('../lib/core/framework-recipe/steps.cjs'),'utf8'); for (const n of ['navigation-engine','chain-executor','command-resolver','brain-client']) assert.equal(s.includes(n),false); });
test('R16 exports preserve old reader API', () => { const s=require('../lib/core/research-planner/sr-steps.cjs'); for (const n of ['HANDLE','REFUSAL_TEXT','NON_RUNNABLE','STEP_FIELDS','COVERAGE_PROBLEM_TYPE','readSrSteps','readCoverage','renderStatus','capField','pickFields','MAX_ROWS','CAP_LABEL','CAP_RUNIT','CAP_OTHER']) assert.ok(n in s); });
test('R17 makes repeated titles unique', () => { assert.deepEqual(uniqueStepTitles([{n:1,title:'A'},{n:2,title:'a'}]).map(x=>x.title),['A','a (step 2)']); });
test('R18 maps refusal codes through the supplied list', async () => { const ownText='## Phases\n### Phase 1: A\nA\n### Phase 2: B\nB'; const r=await readSteps({framework:'Red Teaming',play:'theo_first',ownText,fetchRow:async()=>row('refusal.json')}); assert.equal(r.reason,'theo_refusal'); assert.equal(reasonForRefusal('NOT_AUTHORED',[]),'theo_refusal'); const custom=refusalResult({framework:'Red Teaming',ownText},'NOT_AUTHORED',['NOT_AUTHORED']); assert.equal(custom.reason,'no_steps_in_canon'); assert.equal(custom.enqueue_needed.length,1); });
test('R19 sets the default timeout and times out a pending call', async () => { assert.equal(STEP_READ_LIMIT_MS,2000); const r=await readSteps({framework:'Red Teaming',play:'theo_first',limitMs:20,ownText:'## Phases\n### Phase 1: A\nA\n### Phase 2: B\nB',fetchRow:()=>new Promise(()=>{})}); assert.equal(r.reason,'theo_timeout'); });
test('R20 pins the fixed rule S strings', () => { assert.equal(Buffer.from(OPEN_ITEMS_HEADING).toString('hex'),'4f70656e206974656d73'); assert.equal(Buffer.from(WALK_STOP_LINE).toString('hex'),'4e6f7468696e672069732066696c656420756e74696c20746865206d6574686f6420656e64732e20596f757220616e737765727320736f206661722061726520696e207468697320636f6e766572736174696f6e206f6e6c792e'); assert.equal(Buffer.from(WALK_RESTART_LINE).toString('hex'),'54686174206d6574686f642077616c6b20636c6f736564206265666f72652069747320656e642c20736f206e6f7468696e672066726f6d20697420697320696e20796f757220726f6f6d2e20576520737461727420616761696e2066726f6d207374657020312e'); });
test('R21 accepts only ids proven by the shared guard', () => { assert.equal(isProcessStepId('abc::def::s01'),true); const edge='phase42::framework::'+'a'.repeat(64)+'-'+'a'.repeat(4)+'::'+'b'.repeat(64)+'-'+'b'.repeat(4); assert.equal(edge.length,160); assert.equal(isProcessStepId(edge),true); assert.equal(isProcessStepId(edge+'a'),false); assert.equal(isProcessStepId('x'.repeat(161)),false); });
(async () => { let pass=0, fail=0; for (let i=0;i<cases.length;i++) { try { await cases[i][1](); pass++; console.log(`ok R${i+1} ${cases[i][0]}`); } catch(e) { fail++; console.log(`FAIL R${i+1} ${cases[i][0]}: ${e.message}`); } } console.log(`404 step reader: ${pass} passed, ${fail} failed`); fs.rmSync(temp,{recursive:true,force:true}); if(fail) process.exitCode=1; })();
