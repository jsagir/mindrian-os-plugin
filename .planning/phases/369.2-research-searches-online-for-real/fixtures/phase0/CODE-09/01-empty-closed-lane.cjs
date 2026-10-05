const P=require('../_partialB-prelude.cjs');
const {deep,grants,planner,planMod,corpus,BODIES,replay}=P;
(async()=>{
const room=P.buildRoom363({role:'researcher'});
const built=planner.buildPlan(room.roomDir,P.qs('scientific-roadmapping'),{mode:'deep',now:new Date('2026-10-04T00:00:00Z')});
const plan=built.plan;
const grant=grants.writeGrant(room.roomDir,grants.buildRunGrant(plan),{approved_via:P.VIA}).grant;
// LM2 (anode) returns zero records; every other lane returns a hit
const route=q=>{const s=String(q||'');if(/anode/.test(s))return 'gap_primary_zero';if(/fundamental limit/.test(s))return 'derivation_hit';if(/overcome/.test(s))return 'retest_hit';return 'gap_primary_zero';};
const rp=replay.makeReplayFetch({route,bodies:BODIES});
const seam=async a=>{const prev=globalThis.fetch;globalThis.fetch=rp;try{return await corpus.fetchCorpusEnvelope(a)}finally{globalThis.fetch=prev}};
const init=deep.initDeepState(room.roomDir,plan,grant,{});console.log('init ok',init.ok);
const id=plan.run_id;
// premature: record before fetch_round
const pre=deep.recordLaneRows(room.roomDir,id,'LM1',[]);
console.log('PREMATURE record (step fetch_round):',JSON.stringify(pre));
const fr=await deep.fetchRound(room.roomDir,id,{fetchEnvelopeFn:seam});
console.log('fetchRound',JSON.stringify(fr));
const st=deep.loadState(room.roomDir,id).state;
console.log('state.step',st.step,'expected',JSON.stringify(st.expected),'recorded',JSON.stringify(st.recorded));
const lr=st.lane_results.filter(x=>x.searched_not_found);console.log('empty-closed lane_results',JSON.stringify(lr));
const emptyLane=lr[0]&&lr[0].lane;
const rec=deep.recordLaneRows(room.roomDir,id,emptyLane,[]);
console.log('RECORD against empty-closed lane '+emptyLane+':',JSON.stringify(rec));
// also a lane that is expected and recorded twice
const exp=st.expected[0];
const r1=deep.recordLaneRows(room.roomDir,id,exp,[]);console.log('record expected lane '+exp+':',JSON.stringify(r1));
const r2=deep.recordLaneRows(room.roomDir,id,exp,[]);console.log('record same lane again:',JSON.stringify(r2));
console.log('grep lane_already_closed in lib+scripts handled separately; netguard',P.guard.attempts(),'replay calls',rp.calls.length);
room.cleanup();})();
