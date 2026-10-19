#!/usr/bin/env node
'use strict';
// Real MCP wire plus sandboxed MCP Apps bridge tests; synthetic rooms only.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { hermeticEnv, rpcOverStdio, LOCAL_SERVER } = require('./helpers/mcp-wire-267.cjs');
const root = path.resolve(__dirname, '..');
const { URI } = require('../lib/mcp/gate-app.cjs');
const fixtures = {};

async function wire() {
  const fixture = hermeticEnv();
  try {
    const options = [
      {id:'approve',label:'Approve - run the proposed work',description:'Synthetic approval',preview:'Review the result before filing.'},
      {id:'reject',label:'Reject'}, {id:'defer',label:'Defer'},
    ];
    const requests = [
      {method:'tools/list'},
      {method:'resources/read',params:{uri:URI}},
      {method:'tools/call',params:{name:'gate_render',arguments:{header:'Review the proposed work',options,approving:['approve']}}},
      {method:'tools/call',params:{name:'room-dashboard',arguments:{}}},
      {method:'resources/read',params:{uri:'ui://mindrian-os/room-dashboard'}},
    ];
    const {responses, initialize} = await rpcOverStdio(LOCAL_SERVER, requests, {env:fixture.env,timeoutMs:30000});
    assert(initialize?.result, 'actual server initializes');
    assert(!initialize.result.serverInfo.title.includes('Claude'), 'server title does not invent a model');
    const tools = responses.get(2)?.result?.tools;
    assert(Array.isArray(tools));
    for (const name of ['gate_render','gate_answer','chain_run']) {
      const tool=tools.find(tool=>tool.name===name);
      assert.equal(tool?._meta?.ui?.resourceUri, URI, name+' is associated with the actual component');
    }
    const html=responses.get(3)?.result?.contents?.[0];
    assert.equal(html?.mimeType,'text/html;profile=mcp-app');
    assert(html.text.includes('MindrianView.connect'));
    assert(!html.text.includes('Template not found'));
    assert.deepEqual(html._meta.ui.csp.connectDomains,[]);
    const result=responses.get(4)?.result;
    assert.equal(result?.structuredContent?.ok,true, JSON.stringify(result));
    assert.deepEqual(result.structuredContent.card.options.map(o=>o.id),['approve','reject','defer']);
    assert.equal(result.structuredContent.card.options[0].preview, options[0].preview);
    assert.deepEqual(result.structuredContent.approving,['approve']);
    assert.equal(result.structuredContent.card.gate_id,result.structuredContent.gate_id);
    assert(!JSON.stringify(result.structuredContent).includes('sessionKey'), 'no ledger/session internals leak');
    fixtures.gate={html:html.text,result,input:{}};
    fixtures.dashboard={html:responses.get(6).result.contents[0].text,result:responses.get(5).result,input:{}};
    console.log('PASS actual MCP registration, normalized card, resource, identity and room view');
  } finally { fixture.cleanup(); }

  const {detectGateCapabilities}=require('../lib/mcp/gate-render.cjs');
  const {isWritePathEnabled}=require('../lib/mcp/mcp-first-flag.cjs');
  for (const name of ['ChatGPT','codex','codex-mcp-client']) {
    const server={server:{getClientCapabilities:()=>({elicitation:{},extensions:{'io.modelcontextprotocol/ui':{}}}),getClientVersion:()=>({name})}};
    assert.deepEqual(detectGateCapabilities(server,{surface:'desktop'}),{elicitation:false,elicitation_declared:true,claudeCode:false});
    assert(isWritePathEnabled({surface:'test-gpt',clientVersion:{name}}));
    server.server.getClientCapabilities=()=>({elicitation:{}});
    assert.equal(detectGateCapabilities(server,{surface:'desktop'}).elicitation,true, 'native dialog fallback without Apps');
    server.server.getClientCapabilities=()=>({});
    assert.equal(detectGateCapabilities(server,{surface:'desktop'}).claudeCode,false, 'GPT is never given Claude AskUserQuestion');
  }
  console.log('PASS GPT App, elicitation and text fallbacks; existing governed write policy');
}

async function gateRoundTrip() {
  const {Client}=require('@modelcontextprotocol/client');
  const {StdioClientTransport}=require('@modelcontextprotocol/client/stdio');
  const fixture=hermeticEnv();
  require('../lib/core/room-db.cjs').openRoomDb(fixture.dirs.roomDir).close();
  const transport=new StdioClientTransport({command:process.execPath,args:[LOCAL_SERVER],env:fixture.env,stderr:'pipe'});
  const client=new Client({name:'ChatGPT',version:'test'}, {capabilities:{extensions:{'io.modelcontextprotocol/ui':{}}}});
  const unwrap=result=>result.structuredContent || JSON.parse(result.content.find(c=>c.type==='text').text);
  try {
    await client.connect(transport);
    let result=await client.callTool({name:'room_bind',arguments:{room:'room-267'}});
    const binding=result;
    assert(!result.isError,JSON.stringify(binding));
    result=await client.callTool({name:'gate_render',arguments:{header:'Approve this synthetic decision?',options:[{id:'approve',label:'Approve'},{id:'reject',label:'Reject'},{id:'defer',label:'Defer'}],approving:['approve']}});
    const gate=unwrap(result);
    assert.equal(gate.renderer,'text','Apps uses structured card, not a fabricated Claude dialog');
    const input={gate_id:gate.gate_id,chosen:['approve'],verdict:'approve'};
    const invalid=unwrap(await client.callTool({name:'gate_answer',arguments:{...input,chosen:['invented']}}));
    assert.equal(invalid.ok,false,'server rejects choices outside the minted card');
    const answer=unwrap(await client.callTool({name:'gate_answer',arguments:input}));
    assert.equal(answer.ok,true,JSON.stringify(answer));
    assert.equal(answer.ratified,true);
    const replay=unwrap(await client.callTool({name:'gate_answer',arguments:input}));
    assert.equal(replay.ok,true,JSON.stringify(replay));
    assert.equal(replay.replayed,true,'retry reads durable receipt rather than writing again');
    console.log('PASS real GPT-client room binding, invalid choice refusal, durable approval and replay');
  } finally {await client.close();await transport.close();fixture.cleanup();}
}

async function browser() {
  const {chromium}=require('playwright');
  const sdk=fs.readFileSync(require.resolve('@modelcontextprotocol/ext-apps/app-with-deps'),'utf8');
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:900,height:900}});
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  try {
    await page.route('**/*',route=> {
      const url=route.request().url();
      if(url.includes('@modelcontextprotocol/ext-apps@2.0.3/')) return route.fulfill({contentType:'text/javascript',body:sdk});
      if(url==='http://mos-host.test/') return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});
      if(url.startsWith('https://fonts.googleapis.com/')) return route.fulfill({contentType:'text/css',body:''});
      return route.abort();
    });
    async function open(record) {
      await page.goto('http://mos-host.test/');
      await page.evaluate(record=>{
        window.calls=[];window.messages=[];window.pending=[];
        const iframe=document.createElement('iframe');iframe.style='width:100%;height:850px;border:0';iframe.sandbox='allow-scripts';
        const send=value=>iframe.contentWindow.postMessage({jsonrpc:'2.0',...value},'*');
        window.deliver=result=>send({method:'ui/notifications/tool-result',params:result});
        window.reply=result=>{const message=window.pending.shift();if(!message)throw Error('No pending call');send({id:message.id,result});};
        window.addEventListener('message',event=>{
          if(event.source!==iframe.contentWindow)return;
          const m=event.data;
          if(m.method==='ui/initialize'){
            send({method:'ui/notifications/tool-input',params:{arguments:record.input}});
            window.deliver(record.result);
            send({id:m.id,result:{protocolVersion:m.params.protocolVersion,hostInfo:{name:'ChatGPT-test',version:'1'},hostCapabilities:{serverTools:{},serverMessages:{},updateModelContext:{text:{}}},hostContext:{theme:'light',displayMode:'inline'}}});
          }else if(m.method==='tools/call'){window.calls.push(m);window.pending.push(m);}
          else if(m.id!==undefined && m.method){window.messages.push(m);send({id:m.id,result:{}});}
        });
        iframe.srcdoc=record.html;document.body.append(iframe);
      },record);
      const frame=page.frames().find(frame=>frame!==page.mainFrame());
      assert(frame);
      await frame.locator('#mindrian-status').filter({hasText:/connected|ready/}).waitFor();
      return frame;
    }
    let frame=await open(fixtures.gate);
    assert.equal(await frame.locator('.option').count(),3);
    if (process.env.MINDRIAN_UI_SCREENSHOT) await frame.locator('body').screenshot({path:process.env.MINDRIAN_UI_SCREENSHOT});
    assert.equal(await page.evaluate(()=>window.calls.length),0,'rendering never submits');
    await frame.locator('#confirm').click();
    assert.match(await frame.locator('#feedback').innerText(),/Choose at least one/);
    await frame.locator('input[value=approve]').check();
    await frame.locator('#confirm').click();
    await page.waitForFunction(()=>window.calls.length===1);
    const call=await page.evaluate(()=>window.calls[0]);
    assert.equal(call.params.name,'gate_answer');
    assert.deepEqual(call.params.arguments,{gate_id:fixtures.gate.result.structuredContent.gate_id,chosen:['approve'],verdict:'approve'});
    assert(await frame.locator('#confirm').isDisabled(),'double submit is locked');
    await page.evaluate(()=>window.reply({isError:true,structuredContent:{ok:false,reason:'persistence_failed',message:'Nothing was saved. Try again.'}}));
    await frame.locator('#confirm').waitFor({state:'visible'});
    await page.waitForFunction(()=>window.pending.length===0);
    await frame.waitForFunction(()=>!document.getElementById('confirm').disabled);
    assert.match(await frame.locator('#feedback').innerText(),/Nothing was saved/);
    await frame.locator('#confirm').click();
    await page.waitForFunction(()=>window.calls.length===2);
    const next=JSON.parse(JSON.stringify(fixtures.gate.result.structuredContent));
    next.gate_id='next-gate';next.card.gate_id='next-gate';next.card.header='Second ordered decision';
    await page.evaluate(next=>window.reply({structuredContent:{ok:true,resumed:true,chain_result:{ok:true,halted:true,gate:next}}}),next);
    await frame.locator('#title').filter({hasText:'Second ordered decision'}).waitFor();
    assert.equal(await frame.locator('input:checked').count(),0,'no choice is inherited from the previous step');
    await frame.locator('input[value=reject]').check();
    await frame.locator('#confirm').click();
    await page.waitForFunction(()=>window.calls.length===3);
    assert.equal(await page.evaluate(()=>window.calls[2].params.arguments.verdict),'reject');
    await page.evaluate(()=>window.reply({structuredContent:{ok:true,verdict:'reject',replayed:true}}));
    await frame.locator('#feedback').filter({hasText:'already recorded'}).waitFor();
    assert(await frame.locator('#confirm').isDisabled());
    console.log('PASS browser single selection, explicit submit, retry, ordered next gate, reject and replay');

    const dialog=JSON.parse(JSON.stringify(fixtures.gate));
    dialog.result.structuredContent.answer={chosen:['approve'],verdict:'approve'};
    frame=await open(dialog);
    assert(await frame.locator('#decision').isHidden(),'a completed host dialog cannot be answered again');
    assert.equal(await page.evaluate(()=>window.calls.length),0);
    console.log('PASS completed native dialog is read-only in the component');

    const basket=JSON.parse(JSON.stringify(fixtures.gate));
    basket.result.structuredContent.approving=null;
    basket.result.structuredContent.card.selectMode='multi';
    basket.result.structuredContent.card.options=[{id:'a',label:'Action A',recommended:true},{id:'b',label:'Action B',recommended:true},{id:'c',label:'Action C'}];
    frame=await open(basket);
    assert.equal(await frame.locator('input:checked').count(),2);
    assert.equal(await page.evaluate(()=>window.calls.length),0,'preselection never executes');
    await frame.locator('input[value=c]').check();
    await frame.locator('#confirm').click();
    await page.waitForFunction(()=>window.calls.length===1);
    assert.deepEqual(await page.evaluate(()=>window.calls[0].params.arguments.chosen),['a','b','c']);
    await page.evaluate(()=>window.reply({isError:true,structuredContent:{ok:false,reason:'stale_subject'}}));
    await frame.locator('#feedback').filter({hasText:'stale_subject'}).waitFor();
    assert(await frame.locator('#confirm').isDisabled(),'stale approvals cannot be resubmitted');
    console.log('PASS browser multi-select, explicit confirmation and stale refusal');

    frame=await open(fixtures.dashboard);
    await frame.locator('#work-intent').fill('Challenge our assumptions');
    await frame.locator('#propose-command').click();
    await frame.locator('#request-status').filter({hasText:'Requested in the conversation'}).waitFor();
    await frame.locator('#propose-theo').click();
    await page.waitForFunction(()=>window.messages.filter(m=>m.method==='ui/message').length===2);
    const messages=await page.evaluate(()=>window.messages.filter(m=>m.method==='ui/message'));
    assert(messages[0].params.content[0].text.includes('chain_resolve'));
    assert(messages[1].params.content[0].text.includes('Undefined'));
    assert(!messages[1].params.content[0].text.includes('Challenge our assumptions'),'Theo request carries only the fixed generic selection');
    assert.equal(await page.evaluate(()=>window.calls.length),0,'proposal buttons do not claim execution');
    await page.setViewportSize({width:390,height:850});
    assert.equal(await frame.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'narrow host has no horizontal overflow');
    assert.deepEqual(errors,[]);
    console.log('PASS browser command/Theo proposal messages, room-content separation and narrow layout');
  } finally { await browser.close(); }
}

(async()=>{await wire();await gateRoundTrip();if(process.argv.includes('--browser'))await browser();})().catch(error=>{console.error(error);process.exitCode=1;});
