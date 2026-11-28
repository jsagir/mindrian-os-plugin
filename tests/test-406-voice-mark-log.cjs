'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { readGateTurn, readTurnText } = require('../lib/hmi/turn-text.cjs');
const { detectVoiceMark } = require('../lib/hmi/voice-color-mark.cjs');
const { voiceMarkVerdict, scanTurn } = require('../scripts/check-voice-style.cjs');
const { appendVoiceStyleRow, readVoiceStyleRows } = require('../lib/hmi/voice-style-log.cjs');
const root = path.join(__dirname, 'fixtures/406/voice-mark-turns');
const cases = [
 ['a-opener-card',true,'ask_user_question','black',null,true],
 ['b-answer-no-post',true,'ask_user_question','black',null,true],
 ['c-answer-post-blue',true,'ask_user_question','black','blue',true],
 ['d-answer-post-black',true,'ask_user_question','black','black',false],
 ['e-gate-render-post-green',true,'gate_render','black','blue',true],
 ['f-your-call',true,'your_call','black',null,true],
 ['g-blue',false,'none','blue',null,true],
 ['h-black',false,'none','black',null,false],
 ['i-no-glyph',false,'none','none',null,null],
 ['j-invalid',false,'none','invalid',null,null],
 ['k-blue-card',true,'ask_user_question','blue','blue',false],
 ['l-prior-tool-result',true,'ask_user_question','black','blue',true],
 ['m-api-request-blob',true,'ask_user_question','black','blue',true],
];
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(),'voice406-'));
process.env.MINDRIAN_HOME=tmp;
for (const [file,gate,source,color,postColor,correct] of cases) {
 const fp=path.join(root,file+'.jsonl'); const turn=readGateTurn(fp,'session');
 assert.strictEqual(turn.gate_turn,gate,file); assert.strictEqual(turn.gate_source,source,file);
 if (file === 'l-prior-tool-result') assert.strictEqual(turn.post_text,'🟦 text after card answer',file);
 const detected=turn.gate_turn ? detectVoiceMark(turn.opener_text) : detectVoiceMark(turn.final_text);
 const postDetected=turn.post_text ? detectVoiceMark(turn.post_text) : null;
 assert.strictEqual(detected.color || (detected.valid?'none':'invalid'),color,file);
 assert.strictEqual(postDetected ? (postDetected.color || (postDetected.valid?'none':'invalid')) : null,postColor,file);
 assert.strictEqual(voiceMarkVerdict(turn.gate_source, detected, postDetected),correct,file);
 const rows=[]; scanTurn(turn.final_text,'session',r=>rows.push(r));
 const den=rows.find(r=>r.policy_id==='voice-turn-evaluated');
 Object.assign(den,{turn_id:turn.turn_id,glyph_color:color,post_glyph_color:postColor,gate_turn:gate,gate_source:source,glyph_correct:correct});
 appendVoiceStyleRow(den);
 const row=readVoiceStyleRows().slice(-1)[0];
 assert.strictEqual(row.turn_id,turn.turn_id); assert.strictEqual(row.glyph_color,color); assert.strictEqual(row.post_glyph_color,postColor);
 assert.strictEqual(row.gate_turn,gate); assert.strictEqual(row.gate_source,source); assert.strictEqual(row.glyph_correct,correct);
 const raw=JSON.stringify(row); for(const line of fs.readFileSync(fp,'utf8').trim().split('\n')) { const o=JSON.parse(line); const c=o.message.content; const texts=typeof c==='string'?[c]:Array.isArray(c)?c.filter(x=>x&&x.type==='text').map(x=>x.text):[]; for(const t of texts) if(t.length>2) assert(!raw.includes(t),file+' leaked fixture text'); }
}
const old=readTurnText(path.join(root,'b-answer-no-post.jsonl'));
assert.strictEqual(old.assistant_contents.some(c=>Array.isArray(c)&&c.some(b=>b&&b.type==='tool_use')),false);
console.log('406 voice mark log: passed');
