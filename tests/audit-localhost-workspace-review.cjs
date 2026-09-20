'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const {chromium}=require('/home/jsagi/node_modules/playwright');
const root=path.resolve(__dirname,'..'), out=path.join(root,'.planning/quick/260920-bhx-localhost-review');
(async()=>{
 const room=fs.mkdtempSync(path.join(os.tmpdir(),'mos-ui-review-'));
 fs.mkdirSync(path.join(room,'problem-definition'));
 fs.writeFileSync(path.join(room,'ROOM.md'),'# Localhost review fixture\n');
 fs.writeFileSync(path.join(room,'MINTO.md'),'# Review fixture\n');
 fs.writeFileSync(path.join(room,'problem-definition','evidence.md'),'# FIXTURE evidence\n');
 const lg=require(path.join(root,'lib/core/lazygraph-ops.cjs'));
 const {db,conn}=await lg.openGraph(room);
 conn.prepare('INSERT INTO nodes (id,type,properties) VALUES (?,?,?)').run('review-claim','claim',JSON.stringify({title:'FIXTURE CLAIM',knowledge_type:'fact'}));
 await lg.closeGraph(db);
 const child=spawn(process.execPath,['scripts/serve-dashboard-live','--room',room,'--port','3193','--no-open'],{cwd:root,stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
 let browser;
 try {
  let ready=false;
  for(let i=0;i<200;i++){if(log.includes('MindrianOS dashboard (live):')){ready=true;break;}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,200));}
  if(!ready)throw Error('Server did not bind: '+log);
  const base='http://127.0.0.1:3193';
  const results={room,head:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),checkedAt:new Date().toISOString(),serverLog:log};
  for(const endpoint of ['/api/room/status','/api/room/graph']){const r=await fetch(base+endpoint);results[endpoint]={status:r.status,body:await r.json()};}
  const auth=await fetch(base+'/api/room/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'fixture probe, no model call authorized'})});results.unauthenticatedChat={status:auth.status,body:await auth.text()};
  const host=await fetch(base+'/api/room/status',{headers:{Host:'review.invalid'}});results.foreignHostGet={status:host.status};
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],requests=[],blocked=[];
  await page.route('**/*',route=>{if(!route.request().url().startsWith(base)){blocked.push(route.request().url());return route.abort();}return route.continue();});
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1200);
  results.browser={title:await page.title(),roomData:await page.evaluate(()=>window.ROOM_DATA),errors,blockedExternal:blocked,requests:[...new Set(requests)]};
  await page.screenshot({path:path.join(out,'baseline-desktop.png'),fullPage:true});
  const sse=await fetch(base+'/events');const reader=sse.body.getReader();await reader.read();
  fs.writeFileSync(path.join(room,'problem-definition','new-evidence.md'),'# NEW FIXTURE evidence\n');
  const event=await Promise.race([reader.read().then(r=>new TextDecoder().decode(r.value)),new Promise(r=>setTimeout(()=>r('TIMEOUT'),4000))]);results.fileChangeEvent=event;await reader.cancel();
  await page.waitForTimeout(1000);results.browser.requestsAfterChange=[...new Set(requests)];results.browser.roomDataAfterChange=await page.evaluate(()=>window.ROOM_DATA);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'baseline-mobile.png'),fullPage:true});results.browser.mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
 } finally {if(browser)await browser.close();child.kill('SIGTERM');}
})().catch(e=>{console.error(e);process.exitCode=1;});
