const R=require('/home/jsagi/dev/MindrianOS-Plugin/lib/core/rs-egress-prompts.cjs');
for(const s of ['wireless sensing in Tel Aviv','distributed acoustic sensing fiber']){try{R.auditQueryString(s,'research_planner');console.log('pass',s)}catch(e){console.log('THROW',s,e.message)}}
