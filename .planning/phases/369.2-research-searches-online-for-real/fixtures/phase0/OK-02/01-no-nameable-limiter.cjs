const P=require('../_partialB-prelude.cjs');
const room=P.buildRoom363({role:'researcher'});
const qs=P.qs('scientific-roadmapping');
qs.perspective.limiters=[];
qs.leaves=qs.leaves.map(l=>({...l,limiter_id:undefined}));
const b=P.planner.buildPlan(room.roomDir,qs,{mode:'deep',now:new Date('2026-10-04T00:00:00Z')});
console.log('OK-02 SR deep plan with zero limiters: ok',b.ok,'status',b.status,'errors',JSON.stringify(b.errors),'perspective_errors',JSON.stringify(b.perspective_errors));
console.log('netguard',P.guard.attempts());room.cleanup();
