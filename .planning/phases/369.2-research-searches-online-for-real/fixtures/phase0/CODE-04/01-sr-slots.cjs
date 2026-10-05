const P=require('../_partialB-prelude.cjs');
const room=P.buildRoom363({role:'researcher'});
const qs=P.qs('scientific-roadmapping');
const byId={};qs.leaves.forEach(l=>byId[l.id]=l);
byId.L1.slots={term:'ALPHAMARK_mu_verify_term'};            // non-limiter leaf, own lens mu.verify
byId.L6.slots={limiter:'cathode host capacity',term:'BETAMARK_ci_derivation_term'}; // limiter leaf with an extra slot
byId.L9.slots={limiter:'LIMMARK anode interface resistance'};  // a different limiter slot on LM2
const built=P.planner.buildPlan(room.roomDir,qs,{mode:'deep',now:new Date('2026-10-04T00:00:00Z')});
console.log('build ok',built.ok,built.reason||'',JSON.stringify(built.errors||'').slice(0,300));
const plan=built.plan;
console.log('leaf slots echoed in plan:',JSON.stringify(plan.leaves.filter(l=>['L1','L6','L9'].includes(l.id)).map(l=>({id:l.id,lens:l.lens,slots:l.slots,nq:(l.queries||[]).length}))));
const r1=P.deep.roundOneQueries(plan);
const all=[];r1.forEach(l=>l.queries.forEach(q=>all.push({lane:l.lane,tpl:q.template_id,q:q.q,leaf_ids:q.leaf_ids})));
console.log('round-one queries ('+all.length+'):');all.forEach(x=>console.log(' ',JSON.stringify(x)));
const txt=JSON.stringify(all);
['ALPHAMARK','BETAMARK','LIMMARK'].forEach(m=>console.log(m,'appears in dispatched queries:',txt.includes(m)));
console.log('plan.leaves with queries attached:',JSON.stringify(plan.leaves.filter(l=>(l.queries||[]).length).map(l=>({id:l.id,nq:l.queries.length}))));
console.log('lens of leaves in lanes:',JSON.stringify(r1.map(l=>({lane:l.lane,leaf_ids:l.leaf_ids}))));
console.log('netguard attempts',P.guard.attempts());
room.cleanup();
