const P=require('../_partialB-prelude.cjs');
const ev=require(P.RP+'evidence-rows.cjs');
const rec={id:'https://openalex.org/Wtest1',title:'Gap sizing note',abstract_inverted_index:null,abstract:'Detection range is poor when contrast ratio R &lt; 0.3 at 40 m and signal &amp; noise overlap.'};
const recs=[rec];
const idx=ev.recordsIndex(recs);
console.log('indexed abstract text:',JSON.stringify(idx[Object.keys(idx)[0]]&&idx[Object.keys(idx)[0]].text_abstract||idx));
const mk=(quote)=>({leaf_id:'L1',record_id:rec.id,claim:'c',quote,label:'supports'});
const cases={literal_lt:'contrast ratio R < 0.3 at 40 m',encoded_lt:'contrast ratio R &lt; 0.3 at 40 m',literal_amp:'signal & noise overlap',encoded_amp:'signal &amp; noise overlap'};
for(const k in cases){const v=ev.validateRows([mk(cases[k])],idx,{leafIds:['L1'],lane:'T',retrievedAt:'2026-10-05T00:00:00Z'});console.log(k.padEnd(12),'kept',v.rows.length,'dropped.unverified_quote',v.dropped.unverified_quote);}
console.log('netguard',P.guard.attempts());
