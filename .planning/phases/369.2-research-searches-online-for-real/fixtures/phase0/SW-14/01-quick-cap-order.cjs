const P=require('../_partialB-prelude.cjs');
const room=P.buildRoom363({role:'researcher'});
const qs=P.qs('map-unknowns-limiter');
qs.leaves.forEach((l,i)=>{l.slots={term:'TERM'+(i+1)+' topic '+(i+1)};});
qs.perspective.limiters[0].leaf_id='L6';   // the named limiter is tied to the LAST leaf in array order
const built=P.planner.buildPlan(room.roomDir,qs,{mode:'quick',now:new Date('2026-10-04T00:00:00Z')});
console.log('build ok',built.ok,built.reason||'',JSON.stringify(built.errors||'').slice(0,200));
const plan=built.plan;
console.log('cap (QUICK_MAX_QUERIES)',P.planMod.BUDGETS.QUICK_MAX_QUERIES,'leaves',plan.leaves.length,'budget',JSON.stringify(plan.budget));
console.log('limiters',JSON.stringify(plan.perspective&&plan.perspective.limiters&&plan.perspective.limiters.map(l=>({id:l.id,leaf_id:l.leaf_id}))));
plan.leaves.forEach(l=>console.log(' ',l.id,l.lens,'nq',(l.queries||[]).length,JSON.stringify((l.queries||[]).map(q=>q.template_id))));
console.log('limiter-tied leaf L6 queries:',(plan.leaves.find(l=>l.id==='L6').queries||[]).length);
console.log('trimmed info:',JSON.stringify(built.trimmed!==undefined?built.trimmed:Object.keys(built)));
console.log('netguard',P.guard.attempts());room.cleanup();
