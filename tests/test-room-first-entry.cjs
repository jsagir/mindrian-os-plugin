#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {Client}=require('@modelcontextprotocol/client');
const {StdioClientTransport}=require('@modelcontextprotocol/client/stdio');
const {hermeticEnv,LOCAL_SERVER}=require('./helpers/mcp-wire-267.cjs');
const {URI}=require('../lib/mcp/room-app.cjs');
const fixtures={};
const unpack=result=>result.structuredContent||JSON.parse(result.content.find(item=>item.type==='text').text);

async function realSessions(){
  const fixture=hermeticEnv();
  const roomB=path.join(fixture.dirs.roomsHome,'room-b');
  fs.mkdirSync(path.join(roomB,'problem-definition'),{recursive:true});
  fs.writeFileSync(path.join(roomB,'STATE.md'),'---\nname: Selected Room B\n---\n# Selected room\n');
  fs.writeFileSync(path.join(roomB,'ROOM.md'),'# Room B\n');
  fs.writeFileSync(path.join(roomB,'problem-definition','saved.md'),'# SAVED-ROOM-B\n\nSynthetic B evidence.\n');
  fs.mkdirSync(path.join(fixture.dirs.roomDir,'problem-definition'));
  fs.writeFileSync(path.join(fixture.dirs.roomDir,'problem-definition','boot.md'),'# BOOT-ROOM-A\n\nSynthetic A evidence.\n');
  for(const dir of [fixture.dirs.roomDir,roomB])require('../lib/core/room-db.cjs').openRoomDb(dir).close();
  let client=null,transport=null;
  async function connect(){
    transport=new StdioClientTransport({command:process.execPath,args:[LOCAL_SERVER],env:fixture.env,stderr:'pipe'});
    client=new Client({name:'ChatGPT',version:'room-entry-test'},{capabilities:{extensions:{'io.modelcontextprotocol/ui':{}}}});
    await client.connect(transport);
  }
  async function call(name,args={}){
    const result=await client.callTool({name,arguments:args});
    assert(!result.isError,JSON.stringify(result));return {result,data:unpack(result)};
  }
  try{
    await connect();
    const list=await call('room_list');
    assert.deepEqual(list.data.rooms,['room-267','room-b']);
    assert(!JSON.stringify(list.data).includes('SAVED-ROOM-B'),'listing reads names, not private room material');
    const tools=await client.listTools();
    assert.equal(tools.tools.find(tool=>tool.name==='room_list')._meta.ui.resourceUri,URI);
    const resource=await client.readResource({uri:URI});
    assert.equal(resource.contents[0].mimeType,'text/html;profile=mcp-app');
    assert(!resource.contents[0].text.includes('Template not found'));
    fixtures.list=list.result;fixtures.html=resource.contents[0].text;
    const bound=await call('room_bind',{room:'room-b'});
    assert.equal(bound.data.effective,true);assert.equal(bound.data.carries_to_later_calls,true);
    assert.equal(bound.data.primary,'room-b');
    fixtures.binding=bound.result;
    const gate=await call('gate_render',{header:'Remember the B-room decision',options:[{id:'approve',label:'Approve saved B decision'},{id:'reject',label:'Reject'}],approving:['approve']});
    const answer=await call('gate_answer',{gate_id:gate.data.gate_id,chosen:['approve'],verdict:'approve'});
    assert.equal(answer.data.ok,true);
    const decisionId=answer.data.reasoning_node.node_id;assert(decisionId);
    const memory=await call('context_assemble');
    assert.equal(memory.data.room_dir,roomB);
    assert(memory.data.summary.confirmedFacts.some(fact=>fact.id===decisionId),'room context includes saved decision');
    fixtures.memory=memory.result;
    fixtures.startup=(await call('room_startup')).result;
    for(const name of ['room-dashboard','room-wiki','room-graph']){
      const view=await call(name);
      assert.equal(view.data.room_binding.bound,true);
      assert.equal(view.data.room_binding.slug,'room-b');
      assert(JSON.stringify(view.data).includes('SAVED-ROOM-B'));
      assert(!JSON.stringify(view.data).includes('BOOT-ROOM-A'),'bound view must not use the boot room');
      if(name==='room-dashboard')fixtures.dashboard=view.result;
    }
    const explicit=await call('room-dashboard',{room_path:fixture.dirs.roomDir});
    assert.equal(explicit.data.room_binding.source,'explicit_view');
    assert.equal(explicit.data.room_binding.bound,false,'explicit read is not represented as a rebind');
    assert(JSON.stringify(explicit.data).includes('BOOT-ROOM-A'));
    await client.close();await transport.close();client=null;transport=null;
    await connect();
    await call('room_bind',{room:'room-b'});
    const restored=await call('context_assemble');
    assert.equal(restored.data.room_dir,roomB);
    assert(restored.data.summary.confirmedFacts.some(fact=>fact.id===decisionId),'a new server/client session recovers the old room decision');
    console.log('PASS real room picker metadata; effective binding; selected-room memory and all three views; fresh-session memory recovery');
  }finally{if(client)await client.close();if(transport)await transport.close();fixture.cleanup();}
}

async function browser(){
  const {chromium}=require('playwright');
  const sdk=fs.readFileSync(require.resolve('@modelcontextprotocol/ext-apps/app-with-deps'),'utf8');
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:900,height:900}});
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  try{
    await page.route('**/*',route=>{
      const url=route.request().url();
      if(url.includes('@modelcontextprotocol/ext-apps@2.0.3/'))return route.fulfill({contentType:'text/javascript',body:sdk});
      if(url==='http://mos-room-host.test/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});
      return route.abort();
    });
    async function open(initial,mode='ok'){
      await page.goto('http://mos-room-host.test/');
      await page.evaluate(({initial,mode,html,binding,memory,dashboard,startup})=>{
        window.calls=[];window.messages=[];
        const iframe=document.createElement('iframe');iframe.style='width:100%;height:850px;border:0';iframe.sandbox='allow-scripts';
        const send=value=>iframe.contentWindow.postMessage({jsonrpc:'2.0',...value},'*');
        window.addEventListener('message',event=>{
          if(event.source!==iframe.contentWindow)return;const message=event.data;
          if(message.method==='ui/initialize'){
            send({method:'ui/notifications/tool-input',params:{arguments:{}}});
            send({method:'ui/notifications/tool-result',params:initial});
            send({id:message.id,result:{protocolVersion:message.params.protocolVersion,hostInfo:{name:'ChatGPT-test',version:'1'},hostCapabilities:{serverTools:{},serverMessages:{},updateModelContext:{text:{}}},hostContext:{theme:'light',displayMode:'inline'}}});
          }else if(message.method==='tools/call'){
            window.calls.push(message);
            const name=message.params.name;let result;
            if(name==='room_bind')result=mode==='bind-fails'?{structuredContent:{ok:true,bound:true,effective:false,carries_to_later_calls:true,primary:'room-b',reason:'binding_not_effective'}}:binding;
            else if(name==='context_assemble')result=mode==='memory-fails'?{structuredContent:{ok:false,reason:'no_room_db'}}:memory;
            else if(name==='room_startup')result=startup;
            else if(name==='room-dashboard')result=dashboard;
            else if(name==='room_list')result=initial;
            else throw Error('Unexpected tool '+name);
            send({id:message.id,result});
          }else if(message.id!==undefined&&message.method){window.messages.push(message);send({id:message.id,result:{}});}
        });iframe.srcdoc=html;document.body.append(iframe);
      },{initial,mode,html:fixtures.html,binding:fixtures.binding,memory:fixtures.memory,dashboard:fixtures.dashboard,startup:fixtures.startup});
      const frame=page.frames().find(frame=>frame!==page.mainFrame());assert(frame);
      await frame.locator('#mindrian-status').filter({hasText:/connected/}).waitFor();return frame;
    }
    let frame=await open(fixtures.list);
    assert.equal(await frame.locator('.room-option').count(),2);
    assert(await frame.locator('#open').isDisabled());
    assert.equal(await page.evaluate(()=>window.calls.length),0,'invocation never silently selects or binds a room');
    if(process.env.MINDRIAN_ROOMS_SCREENSHOT)await frame.locator('body').screenshot({path:process.env.MINDRIAN_ROOMS_SCREENSHOT});
    await frame.locator('input[value="room-b"]').check();await frame.locator('#open').click();
    await frame.locator('#opened').waitFor({state:'visible'});
    assert.deepEqual(await page.evaluate(()=>window.calls.map(call=>call.params.name)),['room_bind','context_assemble','room_startup','room-dashboard']);
    assert.deepEqual(await page.evaluate(()=>window.calls[0].params.arguments),{room:'room-b'});
    assert.equal(await frame.locator('#title').innerText(),'Selected Room B');
    await page.waitForFunction(()=>window.messages.some(message=>message.method==='ui/message'));
    const context=await page.evaluate(()=>window.messages.find(message=>message.method==='ui/update-model-context'&&message.params.content[0].text.includes('MindrianOS room opening')));
    assert(context.params.content[0].text.includes('MindrianOS room opening'));
    assert((await frame.locator('#status').innerText()).includes('Saved context loaded'));
    console.log('PASS browser explicit selection -> effective bind -> saved context -> correct room -> host continuation');

    frame=await open(fixtures.list,'bind-fails');
    await frame.locator('input[value="room-b"]').check();await frame.locator('#open').click();
    await frame.locator('#status').filter({hasText:'could not be bound'}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.calls.map(call=>call.params.name)),['room_bind']);
    assert.equal(await page.evaluate(()=>window.messages.filter(message=>message.method==='ui/message').length),0);
    assert(await frame.locator('#opened').isHidden());
    console.log('PASS refused/ineffective binding prevents memory reads and room opening');

    frame=await open(fixtures.list,'memory-fails');
    await frame.locator('input[value="room-b"]').check();await frame.locator('#open').click();
    await frame.locator('#opened').waitFor({state:'visible'});
    assert.match(await frame.locator('#brief').innerText(),/Saved context could not be loaded/);
    assert.match(await frame.locator('#status').innerText(),/unavailable/);
    const empty={structuredContent:{home:'/synthetic/rooms',rooms:[]}};
    frame=await open(empty);
    assert.equal(await frame.locator('.room-option').count(),0);
    assert(await frame.locator('#open').isDisabled());
    assert.match(await frame.locator('#status').innerText(),/No rooms/);
    await page.setViewportSize({width:390,height:850});
    assert(await frame.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
    assert.deepEqual(errors,[]);
    console.log('PASS missing memory is honest; empty-room and narrow-host states');
  }finally{await browser.close();}
}

(async()=>{await realSessions();if(process.argv.includes('--browser'))await browser();})().catch(error=>{console.error(error);process.exitCode=1;});
