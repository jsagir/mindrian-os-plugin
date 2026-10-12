'use strict';
// Build records.jsonl from the room's markdown (read-only on the room).
const fs=require('node:fs'),path=require('node:path');
const ROOM=process.env.ROOM||path.join(process.env.HOME,'MindrianRooms/rethinking-mindrianos');
const out=[];
(function walk(d){for(const e of fs.readdirSync(d,{withFileTypes:true}).sort((a,b)=>a.name<b.name?-1:1)){
  if(e.name.startsWith('.')||e.isSymbolicLink())continue;const f=path.join(d,e.name);
  if(e.isDirectory()){walk(f);continue;} if(!/\.md$/i.test(e.name))continue;
  const raw=fs.readFileSync(f,'utf8');const rel=path.relative(ROOM,f);
  const m=raw.match(/^title:\s*"?(.+?)"?\s*$/m)||raw.match(/^#\s+(.+)$/m);
  out.push({id:rel,title:m?m[1].slice(0,160):path.basename(f),section:rel.split(path.sep)[0],text:raw});
}})(ROOM);
fs.writeFileSync(path.join(__dirname,'records.jsonl'),out.map(r=>JSON.stringify(r)).join('\n')+'\n');
console.log('records',out.length,'bytes',fs.statSync(path.join(__dirname,'records.jsonl')).size);
