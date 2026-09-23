'use strict';
// Independent research probe. Uses only synthetic files under an OS temp dir.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../../..');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-354-resources-'));
process.env.MINDRIAN_ROOMS_HOME = path.join(scratch, 'home');
const room = path.join(scratch, 'room');
const outside = path.join(scratch, 'outside');
fs.mkdirSync(path.join(room, 'normal'), { recursive: true });
fs.mkdirSync(outside);
fs.writeFileSync(path.join(room, 'normal', 'note.md'), 'INSIDE_SYNTHETIC');
fs.writeFileSync(path.join(outside, 'note.md'), 'OUTSIDE_SYNTHETIC');
fs.writeFileSync(path.join(outside, 'REASONING.md'), 'OUTSIDE_REASONING_SYNTHETIC');
fs.symlinkSync(outside, path.join(room, 'linked'), 'dir');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
const { registerResources } = require(path.join(root, 'lib/mcp/resources.cjs'));
(async () => {
  const server = new McpServer({ name: 'research-fixture', version: '1' });
  registerResources(server, { fallbackRoomDir: room });
  const client = new Client({ name: 'research-reader', version: '1' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  await client.connect(b);
  for (const uri of ['room://section/normal', 'room://section/..%2Foutside', 'room://section/linked', 'reasoning://section/..%2F..%2Foutside']) {
    try {
      const result = await client.readResource({ uri });
      const text = result.contents.map(c => c.text || '').join('\n');
      console.log(JSON.stringify({ uri, inside: text.includes('INSIDE_SYNTHETIC'), outside: text.includes('OUTSIDE_SYNTHETIC'), outsideReasoning: text.includes('OUTSIDE_REASONING_SYNTHETIC') }));
    } catch (e) { console.log(JSON.stringify({ uri, error: e.message })); }
  }
  await client.close();
  await server.close();
})().catch(e => { console.error(e); process.exitCode = 1; });
