const fs=require('fs'), path=require('path');
const REPO='/home/jsagi/MindrianOS-Plugin';
const groups=JSON.parse(fs.readFileSync(path.join(REPO,'data/help-groups.json'),'utf8'));
// De Stijl truecolor palette (from lib/core/visual-ops.cjs)
const C={red:'\x1b[38;2;166;61;47m',blue:'\x1b[38;2;30;58;110m',yellow:'\x1b[38;2;200;164;60m',green:'\x1b[38;2;45;107;74m',amethyst:'\x1b[38;2;107;78;139m',teal:'\x1b[38;2;42;107;94m',cream:'\x1b[38;2;245;240;232m',muted:'\x1b[38;2;160;154;144m',R:'\x1b[0m',B:'\x1b[1m',D:'\x1b[2m'};
const LANE=[
  {id:'start',label:'Start + navigate',color:C.blue,glyph:'▶'},
  {id:'methodology',label:'Run a methodology',color:C.yellow,glyph:'□'},
  {id:'explore',label:'Explore + intelligence',color:C.green,glyph:'⚡'},
  {id:'view',label:'View + manage',color:C.red,glyph:'■'},
];
function jtbd(name){try{const t=fs.readFileSync(path.join(REPO,'commands',name+'.md'),'utf8');const m=t.match(/^help_jtbd:\s*"?(.+?)"?\s*$/m);return m?m[1]:'';}catch(e){return '';}}
const W=72;
function bar(color,label,glyph){
  const txt=' '+glyph+'  '+label+' ';
  const pad='─'.repeat(Math.max(0,W-txt.length-1));
  return color+C.B+'▀'.repeat(W)+C.R+'\n'+color+C.B+txt+C.R+C.muted+pad+'┐'+C.R;
}
const out=[];
out.push('');
out.push('  '+C.red+C.B+'█'+C.yellow+'█'+C.blue+'█'+C.R+'  '+C.B+'MindrianOS'+C.R+C.muted+'  command map'+C.R+'  '+C.D+'(pick a card; type the command to run)'+C.R);
out.push('');
for(const ln of LANE){
  const cmds=[];
  for(const g of groups.groups){ if(g.lane===ln.id){ for(const c of g.commands) cmds.push(c); } }
  out.push('  '+ln.color+C.B+ln.glyph+' '+ln.label+C.R+C.muted+'  '+'─'.repeat(Math.max(0,W-ln.label.length-6))+C.R+'  '+C.D+'('+cmds.length+')'+C.R);
  out.push('');
  for(const c of cmds){
    out.push('    '+ln.color+'█'+C.R+' '+ln.color+C.B+'/mos:'+c+C.R);
    const j=jtbd(c); if(j) out.push('    '+ln.color+'█'+C.R+' '+C.cream+j+C.R);
    out.push('');
  }
}
process.stdout.write(out.join('\n')+'\n');
