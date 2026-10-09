'use strict';
// Builds a throwaway tree so the (otherwise unrunnable) discovery tests can run:
//   <tree>/scripts/rs-discovery-engine.cjs  (the 2026 file under test)
//   <tree>/lib/memory/rs-discovery-engine.test.cjs  (the 2026 test file, UNMODIFIED copy)
//   <tree>/lib/core/*.cjs  STUBS for every module the engine requires
// The stubs are test doubles. rs-sqlite-mirror's stub writes real rows with node:sqlite.
const fs = require('node:fs');
const path = require('node:path');

module.exports = function buildTree(treeDir, pkgRoot, opts) {
  opts = opts || {};
  const w = (rel, body) => { const f = path.join(treeDir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };
  const cp = (srcRel, dstRel) => { const d = path.join(treeDir, dstRel); fs.mkdirSync(path.dirname(d), { recursive: true }); fs.copyFileSync(path.join(pkgRoot, srcRel), d); };
  cp(opts.engine || 'rs/shared/scripts/rs-discovery-engine.cjs', 'scripts/rs-discovery-engine.cjs');
  cp(opts.test || 'rs/shared/lib/memory/rs-discovery-engine.test.cjs', 'lib/memory/rs-discovery-engine.test.cjs');
  w('lib/core/rs-egress-violations.cjs', `class ExternalEgressViolation extends Error { constructor(m){super(m);this.name='ExternalEgressViolation';} }\nmodule.exports={ExternalEgressViolation};`);
  w('lib/core/rs-egress-prompts.cjs', `const {ExternalEgressViolation}=require('./rs-egress-violations.cjs');\nmodule.exports={auditQueryObject:(o)=>{if(JSON.stringify(o).includes('FORBIDDEN_TEST_PATTERN'))throw new ExternalEgressViolation('blocked');return true;}};`);
  const trivial = {
    'rs-domain-analyzer': `analyzeDomain:async(t)=>({primary_domain:String(t),primary_domains:[String(t)]})`,
    'rs-query-matrix': `generateQueryMatrix:()=>({a_intersect_b:['q1'],a_leads_to_b:[],b_leads_to_a:[],adjacent:[]})`,
    'rs-fetcher-academic': `fetchAcademic:async()=>({papers:[]}),_test:{dedupe:(a)=>a.slice()}`,
    'research-corpus': `fetchCorpus:async()=>{if(process.env.STUB_FETCH_OK)return [];throw new Error('stub fetchCorpus must be mocked (network)');}`,
    'research-cache': `getCached:()=>null,putCached:()=>undefined`,
    'rs-fetcher-patents': `fetchPatents:async()=>({patents:[]})`,
    'rs-fetcher-industry': `fetchIndustry:async()=>({signals:[]})`,
    'rs-fetcher-experts': `mapExperts:()=>[]`,
    'rs-preprocessor': `preprocess:(d)=>d.map(x=>x)`,
    'rs-differential-scorer': `score:async()=>({novelty_score:0.5})`,
    'rs-innovation-classifier': `classify:(s)=>({query_concept:s.query_concept,doc_concept:s.doc_concept,classification:'structural_transfer',bridge_concept:'b'})`,
    'rs-breakthrough-scorer': `scoreBreakthrough:(c)=>Object.assign({},c,{breakthrough:{score:0.5,dominant_dimension:'x'}})`,
    'rs-thesis-generator': `generateThesis:(c)=>'thesis for '+c.query_concept+' / '+c.doc_concept`,
    'rs-commercial-assessor': `assess:()=>({score:0.5})`,
    'rs-neo4j-writer': `writeDiscovery:async()=>{throw new Error('neo4j stub');},AuraUnreachableError:class AuraUnreachableError extends Error{}`,
    'rs-mind-map': `renderMindMap:async()=>({nodes:[],edges:[]})`,
    'rs-expert-mapper': `mapAuthorsToAura:async()=>[]`,
    'rs-chain-feeder': `lookupUpstream:async()=>({state:'ready'}),emitChainMetadata:(t,s)=>({rs_type:t,score:s})`,
  };
  for (const [name, body] of Object.entries(trivial)) w(`lib/core/${name}.cjs`, `module.exports={${body}};`);
  w('lib/core/rs-sqlite-mirror.cjs', `
const fs=require('node:fs');const path=require('node:path');const {DatabaseSync}=require('node:sqlite');
const REQ=['query_concept','doc_concept','classification','thesis'];
module.exports={writeDiscovery:async(p,o)=>{
  for(const k of REQ){if(typeof p[k]!=='string'||p[k].length===0)throw new TypeError('missing required '+k);}
  const dir=path.join(o.roomDir,'.mindrian');fs.mkdirSync(dir,{recursive:true});
  const db=new DatabaseSync(path.join(dir,'room.db'));
  db.exec('CREATE TABLE IF NOT EXISTS nodes(id TEXT PRIMARY KEY,type TEXT,properties TEXT)');
  const st=db.prepare('INSERT OR REPLACE INTO nodes(id,type,properties) VALUES(?,?,?)');
  st.run('q:'+p.query_concept,'Concept','{}');st.run('d:'+p.doc_concept,'Concept','{}');st.run('disc:'+p.query_concept+'|'+p.doc_concept,'Discovery',JSON.stringify({thesis:p.thesis}));
  db.close();return {wrote_node_count:3,wrote_edge_count:0};}};`);
  return treeDir;
};
