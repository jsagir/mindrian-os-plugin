const P=require('../_partialB-prelude.cjs');
const room=P.buildRoom363({role:'researcher'});
const qs=P.qs('whitespace-quick');
// two leaves on one lens (ws.gap), both with distinct terms
qs.leaves=[{...qs.leaves[0],id:'L1',slots:{term:'thin-film sensors'}},{...qs.leaves[0],id:'L2',slots:{term:'dielectric probes'}},{...qs.leaves[1],id:'L3',lens:'ws.covered_elsewhere'}];
const built=P.planner.buildPlan(room.roomDir,qs,{mode:'deep',now:new Date('2026-10-04T00:00:00Z')});
console.log('build ok',built.ok,built.reason||'',JSON.stringify(built.errors||'').slice(0,300));
if(!built.ok) process.exit(0);
const plan=built.plan;
console.log('leaves',JSON.stringify(plan.leaves.map(l=>({id:l.id,lens:l.lens,corpus:l.corpus,researchable:l.researchable,nq:(l.queries||[]).length}))));
console.log('budget',JSON.stringify(plan.budget));
console.log('laneSpecs',JSON.stringify(P.deep.laneSpecs?P.deep.laneSpecs(plan):'n/a (not exported)'));
const r1=P.deep.roundOneQueries(plan);
console.log('roundOne',JSON.stringify(r1.map(l=>({lane:l.lane,leaf_ids:l.leaf_ids,nq:l.queries.length,queries:l.queries.map(q=>({lens_leaf:q.leaf_ids,tpl:q.template_id,q:q.q}))})),null,1));
const perLeaf={};r1.forEach(l=>l.queries.forEach(q=>{const k=q.leaf_ids[0];perLeaf[k]=(perLeaf[k]||0)+1}));
console.log('query count by first leaf id',JSON.stringify(perLeaf));
console.log('leaves with zero queries',JSON.stringify(plan.leaves.map(l=>l.id).filter(id=>!perLeaf[id])));
console.log('netguard attempts',P.guard.attempts());
room.cleanup();
