// Spike 007 evidence: a loopback shim in front of the MindrianOS MCP server (3847) on 3899.
// MCP SDK v2 clients (agent-native) open with a session-less server/discover; the v1
// per-connection server answers HTTP 400 and agent-native treats that as fatal.
// Answering JSON-RPC -32601 over HTTP 200 lets the v2 client fall back cleanly.
// Usage: node discover-shim.cjs [jsonrpc200|http404]
// Compat shim: answer a session-less server/discover with JSON-RPC -32601 (HTTP 200).
const http=require('http');const MODE=process.argv[2]||'jsonrpc200';
http.createServer((req,res)=>{let b='';req.on('data',d=>b+=d);req.on('end',()=>{
 let j=null;try{j=JSON.parse(b)}catch(_){}
 if(j&&j.method==='server/discover'&&!req.headers['mcp-session-id']){
   console.log('SHIM discover ->',MODE);
   if(MODE==='jsonrpc200'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({jsonrpc:'2.0',id:j.id,error:{code:-32601,message:'Method not found'}}));}
   if(MODE==='http404'){res.writeHead(404);return res.end();}
 }
 const p=http.request({host:'127.0.0.1',port:3847,path:req.url,method:req.method,headers:req.headers},r=>{console.log('REQ',j&&j.method,'->',r.statusCode);res.writeHead(r.statusCode,r.headers);r.pipe(res)});p.on('error',()=>{res.writeHead(502);res.end()});p.end(b)})}).listen(3899,'127.0.0.1');
