'use strict';
// Spike 010: room_search vs flexsearch (wiki-search) vs Leviathan on one real room. Read-only on room + plugin.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const REPO=path.resolve(__dirname,'../../..');
const ROOM=path.join(process.env.HOME,'MindrianRooms/rethinking-mindrianos');
const LEV=path.join(__dirname,'bin/leviathan-v0.2.0-aarch64-unknown-linux-gnu/leviathan');
const cases=require('./cases.json');
const events=[];const ev=(label,o)=>events.push({ts:new Date().toISOString(),label,...o});
const tok=s=>Math.ceil(s.length/4);               // same chars/4 proxy for every engine
const med=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
const rank=(files,t)=>{const i=files.indexOf(t);return i<0?null:i+1;};
const uniq=a=>[...new Set(a)];

const {_internal}=require(path.join(REPO,'lib/mcp/tools/room.cjs'));
const wiki=require(path.join(REPO,'lib/wiki/wiki-search.cjs'));
const {scanRoom}=require(path.join(REPO,'lib/wiki/page-renderer.cjs'));
let t0=process.hrtime.bigint();const {pages}=scanRoom(ROOM);wiki.buildSearchIndex(pages);
const flexBuildMs=Number(process.hrtime.bigint()-t0)/1e6;
const pageKeys=[...pages.keys()];
ev('flex-build',{ms:flexBuildMs,pages:pages.size,sampleKey:pageKeys[0]});

function timed(fn,n=3){let out,ms=[];for(let i=0;i<n;i++){const s=process.hrtime.bigint();out=fn();ms.push(Number(process.hrtime.bigint()-s)/1e6);}return {out,ms:med(ms)};}
const engines={
  room_search:q=>{const {out,ms}=timed(()=>_internal.searchRoom(ROOM,q));const files=uniq(out.map(r=>r.file));
    const payload=JSON.stringify(out.slice(0,50),null,2);return {files:files.slice(0,5),all:files.length,tokens:tok(payload),ms};},
  flexsearch:q=>{const {out,ms}=timed(()=>wiki.search(q,5));
    const files=out.map(r=>{const p=pages.get(r.id);return p&&p.path?path.relative(ROOM,p.path):r.id;});
    return {files,all:out.length,tokens:tok(JSON.stringify(out,null,2)),ms,_raw0:out[0]&&Object.keys(out[0])};},
  leviathan:q=>{let raw;const {ms}=timed(()=>{raw=execFileSync(LEV,['search','--index',path.join(__dirname,'idx.db'),'--json','-n','5',q],{encoding:'utf8'});});
    const j=JSON.parse(raw);return {files:j.results.map(r=>r.id),all:j.total_matches,tokens:tok(raw),ms};},
};
const rows=[];
for(const c of cases)for(const form of ['nl','kw']){
  const q=c[form];const row={case:c.id,form,q};
  for(const [name,fn] of Object.entries(engines)){
    let r;try{r=fn(q);}catch(e){r={err:String(e.message).slice(0,160),files:[],tokens:0,ms:0,all:0};}
    row[name]={rank:rank(r.files,c.target),n:r.all,tokens:r.tokens,ms:+r.ms.toFixed(1),top:r.files.slice(0,5),err:r.err};
    ev('query',{case:c.id,form,engine:name,rank:row[name].rank,tokens:r.tokens,ms:row[name].ms,err:r.err});
  }
  rows.push(row);
}
const summ={};
for(const form of ['nl','kw'])for(const name of Object.keys(engines)){
  const rs=rows.filter(r=>r.form===form).map(r=>r[name]);
  summ[`${form}/${name}`]={top1:rs.filter(r=>r.rank===1).length,top5:rs.filter(r=>r.rank!=null&&r.rank<=5).length,zeroHit:rs.filter(r=>r.n===0).length,medTokens:med(rs.map(r=>r.tokens)),medMs:med(rs.map(r=>r.ms)),of:rs.length};
}
fs.writeFileSync(path.join(__dirname,'results.json'),JSON.stringify({ran:new Date().toISOString(),room:'rethinking-mindrianos (424 md)',summary:summ,rows,events},null,1));
console.table(summ);
