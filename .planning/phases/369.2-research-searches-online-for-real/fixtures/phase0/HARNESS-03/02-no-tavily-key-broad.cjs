const P=require('../_partialB-prelude.cjs');
delete process.env.TAVILY_API_KEY;
const driver=require(P.ROOT+'/lib/lens-engine/source-lens-driver.cjs');
const corpus=P.corpus;
(async()=>{
 const room=P.buildRoom363({role:'researcher'});
 const asked=[];
 const stub=async(args)=>{asked.push(args.source);
   if(args.source==='tavily'){const r=await corpus.fetchCorpusEnvelope(args);return r;}
   return {status:'ok',results:[],meta:{count:0}};};
 const lensSet=[{lens:'scholarly',weight:1},{lens:'industry',weight:1},{lens:'patent',weight:1}];
 const r=await driver.runSourceLens({roomDir:room.roomDir,topic:'fiber optic sensing of thin wires',lensSet,preflight:{evidence_gaps:[],prior_research:[],section:'market-analysis'},stage:'explore',db:null,_fetchCorpusEnvelope:stub});
 console.log('TAVILY_API_KEY set?',!!process.env.TAVILY_API_KEY);
 console.log('runSourceLens ok',r.ok,'reason',r.reason||'');
 console.log('lens_set returned (the plan still advertises):',JSON.stringify(r.lens_set));
 console.log('sources actually asked:',JSON.stringify(asked));
 const keys=Object.keys(r);console.log('result keys',keys.join(','));
 console.log('provider status fields:',JSON.stringify(r.provider_status||r.providers||r.research_mode||null).slice(0,600));
 console.log('findings',(r.findings||[]).length);
 try{const t=await corpus.fetchCorpusEnvelope({source:'tavily',query:'x'});console.log('direct tavily envelope no key:',JSON.stringify(t).slice(0,400));}catch(e){console.log('direct tavily threw',e.message)}
 console.log('netguard attempts',P.guard.attempts());room.cleanup();
})();
