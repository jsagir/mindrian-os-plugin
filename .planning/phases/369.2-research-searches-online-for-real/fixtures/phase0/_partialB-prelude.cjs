'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const TMP_HOME=fs.mkdtempSync(path.join(os.tmpdir(),'phase0-home-'));
process.env.HOME=TMP_HOME;process.env.USERPROFILE=TMP_HOME;
process.env.MINDRIAN_ROOMS_HOME=fs.mkdtempSync(path.join(os.tmpdir(),'phase0-rooms-'));
delete process.env.CLAUDE_ACTIVE_ROOM;delete process.env.CLAUDE_CODE_SESSION_ID;
delete process.env.OPENALEX_API_KEY;delete process.env.OPENALEX_EMAIL;
const ROOT='/home/jsagi/dev/MindrianOS-Plugin';
const hygiene=require(ROOT+'/tests/helpers/hygiene-355.cjs');hygiene.scrubVendorKey();
const guard=hygiene.installNetGuard();
const RP=ROOT+'/lib/core/research-planner/';
module.exports={ROOT,RP,TMP_HOME,guard,fs,path,
 buildRoom363:require(ROOT+'/tests/helpers/fixture-room-363.cjs').buildRoom363,
 replay:require(ROOT+'/tests/helpers/openalex-replay-363.cjs'),
 planner:require(RP+'planner.cjs'),deep:require(RP+'deep.cjs'),quick:require(RP+'quick.cjs'),
 families:require(RP+'families.cjs'),grants:require(RP+'grants.cjs'),planMod:require(RP+'plan.cjs'),
 pyramid:require(RP+'pyramid.cjs'),perspective:require(RP+'perspective.cjs'),
 corpus:require(ROOT+'/lib/core/research-corpus.cjs'),
 BODIES:JSON.parse(fs.readFileSync(ROOT+'/tests/fixtures/363-openalex/bodies.json','utf8')),
 qs:(n)=>JSON.parse(fs.readFileSync(ROOT+'/tests/fixtures/363-question-sets/'+n+'.json','utf8')),
 VIA:{surface:'cli',decision_node_id:'d-phase0'},
};
