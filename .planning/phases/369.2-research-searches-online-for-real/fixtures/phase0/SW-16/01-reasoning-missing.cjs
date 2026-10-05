const P=require('../_partialB-prelude.cjs');
const ro=require(P.ROOT+'/lib/core/reasoning-ops.cjs');
const room=P.buildRoom363({role:'researcher'});
const fs=P.fs,path=P.path;
const rd=path.join(room.roomDir,'.reasoning');
console.log('fixture room .reasoning exists:',fs.existsSync(rd),fs.existsSync(rd)?JSON.stringify(fs.readdirSync(rd)):'');
console.log('market-analysis/REASONING.md exists:',fs.existsSync(path.join(rd,'market-analysis','REASONING.md')));
console.log('getReasoningFrontmatter(market-analysis):',JSON.stringify(ro.getReasoningFrontmatter(room.roomDir,'market-analysis')));
console.log('getReasoningFrontmatter(no-such-section):',JSON.stringify(ro.getReasoningFrontmatter(room.roomDir,'no-such-section')));
// remove and re-check to be sure it is the absence that triggers
fs.rmSync(path.join(rd,'market-analysis'),{recursive:true,force:true});
console.log('after rm, getReasoningFrontmatter:',JSON.stringify(ro.getReasoningFrontmatter(room.roomDir,'market-analysis')));
console.log('netguard',P.guard.attempts());room.cleanup();
