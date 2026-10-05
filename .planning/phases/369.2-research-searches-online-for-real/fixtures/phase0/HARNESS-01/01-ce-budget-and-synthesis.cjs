const P=require('../_partialB-prelude.cjs');
const {deep,grants,planner,planMod,corpus,replay,BODIES,fs,path}=P;
const B=planMod.BUDGETS;
function srRoute(q){const s=String(q||'');if(/fundamental limit/.test(s))return 'derivation_hit';if(/overcome/.test(s))return 'retest_hit';if(/saturation/.test(s))return /host volume swing/.test(s)?'scurve_headroom':'scurve_ceiling';if(/\(review OR survey\)/.test(s))return 'prior_review_two';return 'gap_primary_zero';}
const rec=(k,i)=>BODIES[k].results[i];
const rowOf=(k,i,leaf,label)=>({leaf_id:leaf,record_id:rec(k,i).id,claim:'c '+leaf,quote:rec(k,i).title,label});
function analyst(p,round){const rows=[];
 if(round===1&&p.lane==='LM1')rows.push(rowOf('derivation_hit',0,'L8','derivation'));
 if(round===1&&p.lane==='LM2')rows.push(rowOf('retest_hit',0,'L9','retest'));
 if(round===2&&p.lane==='LM2')rows.push(rowOf('scurve_ceiling',0,'L9','scurve_ceiling'));
 return rows;}
async function runScenario(name,budgetOver){
 const room=P.buildRoom363({role:'researcher'});
 const plan=planner.buildPlan(room.roomDir,P.qs('scientific-roadmapping'),{mode:'deep',now:new Date('2026-10-04T00:00:00Z')}).plan;
 Object.assign(plan.budget,budgetOver||{});plan.plan_hash=planMod.planHash(plan);
 const grant=grants.writeGrant(room.roomDir,grants.buildRunGrant(plan),{approved_via:P.VIA});
 if(!grant.ok){console.log(name,'grant refused',JSON.stringify(grant));return;}
 const rp=replay.makeReplayFetch({route:srRoute,bodies:BODIES});
 const seam=async a=>{const prev=globalThis.fetch;globalThis.fetch=rp;try{return await corpus.fetchCorpusEnvelope(a)}finally{globalThis.fetch=prev}};
 const init=deep.initDeepState(room.roomDir,plan,grant.grant,{});if(!init.ok){console.log(name,'init',JSON.stringify(init));return;}
 const id=plan.run_id;const env={fetchEnvelopeFn:seam};const steps=[];let ceRes=null,result=null;
 for(let g=0;g<60;g++){const n=deep.nextDeepStep(room.roomDir,id);if(!n.ok){console.log('err',JSON.stringify(n));break;}steps.push(n.step);
  if(n.step==='fetch_round'){const fr=await deep.fetchRound(room.roomDir,id,env);if(!fr.ok){console.log('fetch err',JSON.stringify(fr));break;}}
  else if(n.step==='dispatch_lanes'){n.payload.lanes.forEach(p=>{const recs=JSON.parse(fs.readFileSync(path.join(room.roomDir,p.records_path),'utf8')).records;deep.recordLaneRows(room.roomDir,id,p.lane,analyst(p,n.round));});}
  else if(n.step==='reflect'){deep.proposeFollowups(room.roomDir,id,[]);}
  else if(n.step==='extend_card'){deep.applyExtendDecision(room.roomDir,id,'stop',{approved_via:P.VIA});}
  else if(n.step==='counterevidence'){console.log(name,'CE planned queries',n.payload.queries.length);ceRes=await deep.runCounterevidence(room.roomDir,id,env);
     if(ceRes.lane_payload){deep.recordLaneRows(room.roomDir,id,'CE',[]);} }
  else if(n.step==='synthesize'){result=deep.synthesize(room.roomDir,id);break;}
  else if(n.step==='done')break;}
 const st=deep.loadState(room.roomDir,id).state;
 console.log('===',name,'budget',JSON.stringify(plan.budget));
 console.log('steps',steps.join('>'));
 console.log('searches_used',st.searches_used,'cap',st.max_searches_base,'stop_reason',st.stop_reason);
 console.log('runCounterevidence result',JSON.stringify(ceRes&&{ok:ceRes.ok,executed:ceRes.executed,stop_reason:ceRes.stop_reason}));
 console.log('state.ce',JSON.stringify({planned:st.ce.queries.length,run:st.ce.run,partial:st.ce.partial,gaps:st.ce.gaps}));
 if(result){const r=result.run;console.log('synthesize ok',result.ok,'run keys',Object.keys(r).join(','));
  console.log('run.counterevidence',JSON.stringify(r.counterevidence));
  console.log('run.unresolved_branches',JSON.stringify(r.unresolved_branches));
  console.log('run.verdict',JSON.stringify(r.verdict),'run.status',r.status,'run.stop_reason',r.stop_reason);}
 room.cleanup();
}
(async()=>{
 await runScenario('A default budget',{});
 await runScenario('B max_searches=8 (round one only)',{max_searches:8});
 console.log('netguard',P.guard.attempts());
})();
