const P=require('../_partialB-prelude.cjs');
const f=P.families;
const a=f.composeForLeaf({lens:'mu.verify',corpus:'openalex',slots:{term:'electrical cable',term2:'OTDRMARK optical fiber'}},{round:1});
console.log('mu.verify term+term2 ->',a.ok,a.reason||'');
if(a.ok){a.queries.forEach(q=>console.log('  ',q.template_id,JSON.stringify(q.q),'slot_terms',JSON.stringify(q.slot_terms)));
 console.log('term2 text present in any query:',JSON.stringify(a.queries).includes('OTDRMARK'));}
const b=f.composeForLeaf({lens:'mu.verify',corpus:'openalex',slots:{term:'OTDRMARK optical fiber'}},{round:1});
console.log('mu.verify term only ->',b.ok,b.queries&&b.queries.map(q=>q.q));
const c=f.composeFamily('concept-evidence/v1',{term:'A',term2:'OTDRMARK B'},{templateIds:['ce.exact','ce.counter']});
console.log('composeFamily explicit exact+counter ->',c.ok,c.reason||'',c.ok?JSON.stringify(c.queries.map(q=>q.q)):'');
console.log('any lens renders term2? lenses:',JSON.stringify(Object.keys(f.LENSES||{}).filter(k=>f.LENSES[k].family==='concept-evidence/v1')));
console.log('LENSES export',typeof f.LENSES, 'netguard',P.guard.attempts());
