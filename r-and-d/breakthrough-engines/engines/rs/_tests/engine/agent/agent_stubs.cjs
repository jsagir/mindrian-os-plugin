'use strict';
// Writes minimal stub modules for the modules reverse-salient-agent.cjs requires
// but that are not part of this slice. Test-only.
const fs = require('node:fs');
const path = require('node:path');
module.exports = function writeStubs(libDir) {
  const w = (rel, body) => {
    const f = path.join(libDir, rel);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, body);
  };
  w('core/navigation.cjs', `module.exports={getActiveFocus:()=>({focusNodeId:'n1'}),getNeighborhood:()=>[],findContradictions:()=>[],findUnsupportedClaims:()=>[],findStaleDecisions:()=>[],findRecentChanges:()=>[]};`);
  w('core/folder-memory.cjs', `module.exports={readQuadruple:()=>null,isQuadrupleFresh:()=>false};`);
  w('core/rs-backend-dispatch.cjs', `module.exports={resolveBackend:()=>process.env.TEST_BACKEND||'python'};`);
  w('core/rs-engine.cjs', `module.exports={runModeInternal:async()=>({})};`);
  w('core/verification-stamp.cjs', `
exports.extractCarried=(raw,title)=>({raw,title});
exports.resolveEndpoint=(c)=>({name:'h:'+String(c.title),via:'title',seenRaw:c.raw});
exports.stampFinding=async(f)=>({ok:true,f});
exports.stampFindings=async(l)=>l.map(f=>({ok:true,f}));
exports.toNodeProps=(s)=>({stamp:1});`);
  w('core/verification-stamp-format.cjs', `exports.formatStampLines=()=>['stamp line'];exports.assertNoScalar=(l)=>{for(const x of l){if(/\\d\\.\\d/.test(x))throw new Error('scalar in render: '+x);}return {lines:l};};`);
  w('core/floor-disclosure.cjs', `exports.disclosureLine=()=>'disclosure';`);
  w('core/reverse-salient-persona-suffix.cjs', `exports.CANONICAL_KEYS=['founder','researcher'];exports.suffixFor=()=>'lagging component';`);
  w('core/lazygraph-ops.cjs', `exports.calls=[];exports.upsertEdge=(db,e)=>{exports.calls.push(e);return {ok:true};};`);
};
