const P=require('../_partialB-prelude.cjs');
const room=P.buildRoom363({role:'researcher'});
const qs=P.qs('scientific-roadmapping');
const built=P.planner.buildPlan(room.roomDir,qs,{mode:'deep',now:new Date('2026-10-04T00:00:00Z')});
const plan=JSON.parse(JSON.stringify(built.plan));
console.log('limiters',JSON.stringify(plan.perspective.limiters.map(l=>({id:l.id,statement:l.statement,leaf_id:l.leaf_id}))));
console.log('exports has limiterSlot:',typeof P.deep.limiterSlot);
// strip all bound limiter slots from every leaf and clear stored queries
plan.leaves.forEach(l=>{l.slots={};l.queries=[];});
const r1=P.deep.roundOneQueries(plan);
console.log('lanes with queries after unbinding slots:',r1.length);
r1.forEach(l=>l.queries.forEach(q=>console.log(' ',l.lane,q.template_id,JSON.stringify(q.q))));
const lim=plan.perspective.limiters[0];
console.log('limiter statement length',lim.statement.length,'quoted-whole-statement appears:',JSON.stringify(r1).includes(JSON.stringify(lim.statement).slice(1,-1).slice(0,40)));
// direct: composeFamily with the sentence
const c=P.families.composeFamily('constraint-interrogation/v1',{limiter:lim.statement},{round:1});
console.log('composeFamily(limiter=statement) ok',c.ok,c.reason||'',c.ok?JSON.stringify(c.queries.map(q=>q.q)):'');
console.log('netguard attempts',P.guard.attempts());
room.cleanup();
