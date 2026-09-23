'use strict';
const app=document.getElementById('app');
let graphState={nodes:[],edges:[]};
let loadedMarkdown='';
let revision='';
let roomInfo={mode:'fixture',name:'fixture',section:'workspace'};
let pollTimer=null;
const POLL_MS=2000;
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function markdownToHtml(md){return md.split(/\n\n+/).map(block=>{const lines=block.split('\n');if(/^# /.test(lines[0]))return `<h2>${esc(lines[0].slice(2))}</h2>`;if(/^## /.test(lines[0]))return `<h3>${esc(lines[0].slice(3))}</h3>`;return `<p>${lines.map(esc).join('<br>')}</p>`}).join('')}
function graphSvg(nodes,edges){const visible=nodes.slice(0,40),pos={};visible.forEach((n,i)=>{const a=(Math.PI*2*i/Math.max(visible.length,1))-.5;pos[n.id]=[50+38*Math.cos(a),50+38*Math.sin(a)]});const ids=new Set(visible.map(n=>n.id));return `<svg viewBox="0 0 100 100" preserveAspectRatio="none">${edges.filter(e=>ids.has(e.source)&&ids.has(e.target)).slice(0,80).map(e=>{const a=pos[e.source],b=pos[e.target];return `<line class="edge ${e.type==='CHALLENGES'?'warn':''}" x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"/>`}).join('')}${visible.map(n=>{const p=pos[n.id],c=n.type==='unknown'?'#d44831':n.type==='decision'?'#e5b52f':n.type==='evidence'?'#315e98':'#4c7a5b';return `<g class="node"><circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${c}"/><text x="${p[0]+4}" y="${p[1]-1}">${esc(String(n.title).slice(0,28))}<tspan class="small" x="${p[0]+4}" dy="4">${esc(n.type)}</tspan></text></g>`}).join('')}</svg>`}
function pocToken(){const m=document.querySelector('meta[name="mos-poc-token"]');return m?m.getAttribute('content'):''}
async function refreshGraph(){
  try{
    const gr=await fetch('/api/graph').then(r=>r.json());
    graphState=gr;
    const canvasEl=document.getElementById('graph-canvas');
    if(canvasEl)canvasEl.innerHTML=graphSvg(graphState.nodes,graphState.edges);
    const countsEl=document.getElementById('graph-counts');
    if(countsEl)countsEl.textContent=graphState.nodes.length+' nodes · '+graphState.edges.length+' edges';
  }catch(_e){/* graph refresh is best-effort; the save itself already succeeded */}
}
async function load(){
  const [doc,gr,room]=await Promise.all([
    fetch('/api/document').then(r=>r.json()),
    fetch('/api/graph').then(r=>r.json()),
    fetch('/api/room').then(r=>r.json()).catch(()=>({mode:'fixture',name:'fixture',section:'workspace'}))
  ]);
  graphState=gr;loadedMarkdown=doc.markdown;revision=doc.revision;roomInfo=room;
  const roomLabel=roomInfo.mode==='room'?roomInfo.name:'Fixture';
  const roomSub=roomInfo.mode==='room'?'Bound room · '+esc(roomInfo.section||'workspace'):'Fixture data, no room bound';
  app.innerHTML=`<div class="shell"><aside class="side"><div class="logo">MINDRIANOS<small>workspace POC</small></div><div class="room"><b>${esc(roomLabel)}</b><span>${roomSub}</span></div><nav class="nav"><button class="active" data-tab="work"><i>▣</i>Work</button><button data-tab="graph"><i>◎</i>Local graph</button><button data-tab="evidence"><i>◫</i>Evidence</button><button data-tab="decisions"><i>◆</i>Decisions</button></nav><div class="sidefoot"><b>LOCAL ONLY</b>Local graph and editable file. No remote model calls.</div></aside><main><header class="top"><div>ROOM <strong>${esc(roomLabel)}</strong></div><div class="status"><i class="dot"></i> Browser-owned POC</div></header><section class="main"><div class="eyebrow">MindrianOS workspace</div><h1 class="title">Test the demand assumption</h1><p class="sub">Edit the working file, inspect the local graph, and talk to the graph without leaving the task.</p><div class="tabs"><button class="tab active" data-tab="work">Work</button><button class="tab" data-tab="graph">Local graph</button><button class="tab" data-tab="evidence">Evidence</button><button class="tab" data-tab="decisions">Decisions</button></div><div id="work" class="view active"><div class="cols"><section class="card"><div class="head"><h2>Working file</h2><span class="meta">Editable blocks</span></div><div class="body editor-body"><textarea id="editor" class="editor-input" spellcheck="false">${esc(doc.markdown)}</textarea><div id="preview" class="editor-preview">${markdownToHtml(doc.markdown)}</div></div><div id="conflict-banner" class="conflict-banner" hidden></div><div class="savebar"><span id="save-state" class="saved">Saved from local room</span><button id="save" class="save">Save revision</button></div></section><div class="stack"><section class="card"><div class="head"><h2>Activity</h2><span class="meta">Local</span></div><div class="body activity"><div class="event"><i></i><div><b>Working file loaded</b><span>Editable revision opened</span></div><time>now</time></div><div class="event"><i></i><div><b>Graph projection ready</b><span id="graph-counts">${graphState.nodes.length} nodes · ${graphState.edges.length} edges</span></div><time>now</time></div><div class="event"><i></i><div><b>Next review</b><span>Confirm the budget-owner assumption</span></div><time>next</time></div></div></section><div class="decision"><h3>REVIEW NEEDED · 1 DECISION</h3><p>Does the local graph support running two budget-owner interviews next?</p></div></div></div></div><div id="graph" class="view"><div class="graphwrap"><section><div class="graphcanvas" id="graph-canvas">${graphSvg(graphState.nodes,graphState.edges)}</div><div class="legend"><span><i class="swatch swatch-claim"></i>claim</span><span><i class="swatch swatch-evidence"></i>evidence</span><span><i class="swatch swatch-unknown"></i>unknown / challenge</span><span><i class="swatch swatch-decision"></i>decision</span></div></section><section class="talk"><h2>Graph lookup (deterministic, no model)</h2><p>Ask about relationships, evidence, assumptions, or the next decision. Answers use only the local graph, never a model.</p><div id="answer" class="answer"><b>GRAPH ASSISTANT</b>Ask a question to inspect the room's relationships.</div><div id="hits" class="hits"></div><div id="references" class="refs"></div><div class="ask"><input id="question" placeholder="What challenges the urgency claim?"><button id="ask">Ask</button></div></section></div></div><div id="evidence" class="view"><section class="card"><div class="head"><h2>Evidence in scope</h2><span class="meta">Local files</span></div><div class="body"><p><strong>Interview synthesis</strong><br><span class="sub">Three excerpts support the handoff pain. Open the working file to edit the interpretation.</span></p><p><strong>Procurement notes</strong><br><span class="sub">No confirmed budget owner. This is the current unresolved edge.</span></p></div></section></div><div id="decisions" class="view"><section class="card"><div class="head"><h2>Decisions</h2><span class="meta">Human review</span></div><div class="body"><div class="decision"><h3>OPEN ASSUMPTION</h3><p>Run two budget-owner interviews before building. Review and confirm this decision after inspecting the graph.</p></div></div></section></div></section></main></div>`;wire()}
function wire(){
  document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('[data-tab]').forEach(x=>x.classList.toggle('active',x===b));document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===b.dataset.tab))});
  const editorEl=document.getElementById('editor');
  const previewEl=document.getElementById('preview');
  const stateEl=document.getElementById('save-state');
  const bannerEl=document.getElementById('conflict-banner');
  editorEl.addEventListener('input',()=>{previewEl.innerHTML=markdownToHtml(editorEl.value)});
  document.getElementById('save').onclick=async()=>{
    bannerEl.hidden=true;
    if(editorEl.value===loadedMarkdown){stateEl.textContent='No changes to save';return}
    try{
      const r=await fetch('/api/document',{method:'POST',headers:{'Content-Type':'application/json','X-Mindrian-Poc-Token':pocToken()},body:JSON.stringify({markdown:editorEl.value,base_revision:revision})});
      if(r.ok){
        const d=await r.json();
        loadedMarkdown=d.markdown;revision=d.revision;
        previewEl.innerHTML=markdownToHtml(loadedMarkdown);
        stateEl.textContent='Saved revision '+String(d.revision).slice(0,8);
        await refreshGraph();
      }else if(r.status===409){
        const d=await r.json().catch(()=>({}));
        if(d&&d.current_revision)revision=d.current_revision;
        const msg='This file changed on disk since you opened it. Your edits are still in the editor; reload to see the saved version.';
        stateEl.textContent=msg;
        bannerEl.hidden=false;bannerEl.textContent=msg;
      }else{
        stateEl.textContent='Save failed ('+r.status+')';
      }
    }catch(e){
      stateEl.textContent='Save failed (network error)';
    }
  };
  const ask=async()=>{
    const question=document.getElementById('question').value;
    const r=await fetch('/api/graph/ask',{method:'POST',headers:{'Content-Type':'application/json','X-Mindrian-Poc-Token':pocToken()},body:JSON.stringify({question})});
    const d=await r.json();
    document.getElementById('answer').innerHTML=`<b>GRAPH ASSISTANT</b>${esc(d.answer)}`;
    document.getElementById('hits').innerHTML=(d.nodes||[]).map(n=>`<span class="hit">${esc(n.title)}</span>`).join('');
    document.getElementById('references').innerHTML=(d.references||[]).map(r=>`<div class="ref-item">${esc(r.id)} - ${esc(r.source?r.source:'no source path')}</div>`).join('');
  };
  document.getElementById('ask').onclick=ask;
  document.getElementById('question').onkeydown=e=>{if(e.key==='Enter')ask()};

  // 354-11 (J6/J7): poll the document's revision every 2s. A clean editor
  // (no unsaved changes) silently reloads the newer bytes -- a dirty editor
  // never loses the user's unsaved text or the disk's own external edit; it
  // only shows the conflict banner and waits for an explicit save/reload.
  async function pollRevision(){
    try{
      const d=await fetch('/api/document/revision').then(r=>r.json());
      if(!d||typeof d.revision!=='string'||d.revision===revision)return;
      if(editorEl.value===loadedMarkdown){
        const doc=await fetch('/api/document').then(r=>r.json());
        loadedMarkdown=doc.markdown;revision=doc.revision;
        editorEl.value=doc.markdown;
        previewEl.innerHTML=markdownToHtml(doc.markdown);
        stateEl.textContent='Reloaded an external change';
        bannerEl.hidden=true;
        await refreshGraph();
      }else{
        bannerEl.hidden=false;
        bannerEl.textContent='This file changed on disk while you were editing. Your edits are still in the editor; save to see the conflict or reload to take the disk version.';
      }
    }catch(_e){/* a failed poll tick is silently retried on the next interval */}
  }
  function startPolling(){if(pollTimer)return;pollTimer=setInterval(pollRevision,POLL_MS)}
  function stopPolling(){if(pollTimer){clearInterval(pollTimer);pollTimer=null}}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stopPolling();else startPolling()});
  startPolling();
}
load().catch(e=>{app.innerHTML=`<p class="load-error">POC failed to load: ${esc(e.message)}</p>`});
