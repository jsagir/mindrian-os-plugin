const P=require('../_partialB-prelude.cjs');const f=P.families;
const show=(n,r)=>console.log(n.padEnd(52),'ok',r.ok,'reason',r.reason||'');
show('composeForLeaf unknown slot q (handwritten string)',f.composeForLeaf({lens:'mu.verify',corpus:'openalex',slots:{q:'a handwritten query string'}}));
show('composeForLeaf slots.query handwritten',f.composeForLeaf({lens:'mu.verify',corpus:'openalex',slots:{term:'x',query:'raw OR raw'}}));
show('composeForLeaf slot with operator token AND',f.composeForLeaf({lens:'mu.verify',corpus:'openalex',slots:{term:'cats AND dogs'}}));
show('composeForLeaf unknown lens',f.composeForLeaf({lens:'raw.query',corpus:'openalex',slots:{term:'x'}}));
show('composeFamily with 201-char term',f.composeFamily('concept-evidence/v1',{term:'a'.repeat(201)}));
// handwritten query smuggled into a run plan: round-one hash check
(async()=>{
 const {deep,grants,planner,corpus,replay,BODIES}=P;
 const room=P.buildRoom363({role:'researcher'});
 const plan=planner.buildPlan(room.roomDir,P.qs('scientific-roadmapping'),{mode:'deep',now:new Date('2026-10-04T00:00:00Z')}).plan;
 const grant=grants.writeGrant(room.roomDir,grants.buildRunGrant(plan),{approved_via:P.VIA}).grant;
 const edited=JSON.parse(JSON.stringify(plan));
 const q=edited.leaves.filter(l=>l.queries.length>0)[0].queries[0];
 q.q='"handwritten" AND smuggled';q.q_hash=f.qHash(q.q);
 const rp=replay.makeReplayFetch({route:()=>'gap_primary_zero',bodies:BODIES});
 const init=deep.initDeepState(room.roomDir,edited,grant,{});
 const fr=await deep.fetchRound(room.roomDir,edited.run_id,{fetchEnvelopeFn:async a=>{const prev=globalThis.fetch;globalThis.fetch=rp;try{return await corpus.fetchCorpusEnvelope(a)}finally{globalThis.fetch=prev}}});
 console.log('handwritten hash in a run plan: init ok',init.ok,'fetchRound',JSON.stringify(fr),'replay calls',rp.calls.length);
 console.log('netguard',P.guard.attempts());room.cleanup();
})();
