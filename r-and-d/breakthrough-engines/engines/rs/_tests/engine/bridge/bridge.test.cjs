'use strict';
// Run: node --test rs/_tests/engine/bridge/bridge.test.cjs   (from package-2026/)
// Compares the original and 2026 rs-vector-bridge.cjs over the real CLI protocol
// using stub room-db / embedding-spine / vector-store modules.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { spawnSync } = require('node:child_process');
const pkg = path.resolve(__dirname, '..', '..', '..', '..');

function tree(which, withRoomDb) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rs-bridge-'));
  const w = (rel, body) => { const f = path.join(dir, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, body); };
  const src = which === 'orig' ? '_baseline/orig/rs/shared/scripts/rs-vector-bridge.cjs' : 'rs/shared/scripts/rs-vector-bridge.cjs';
  fs.mkdirSync(path.join(dir, 'scripts'), { recursive: true });
  fs.copyFileSync(path.join(pkg, src), path.join(dir, 'scripts/rs-vector-bridge.cjs'));
  if (withRoomDb) w('lib/core/room-db.cjs', "exports.openRoomDb=(r)=>{if(r==='/nonexistent')throw new Error('cannot open');return {room:r};};exports.closeRoomDb=()=>{};");
  w('lib/core/semantic-index/embedding-spine.cjs', "exports.embedTexts=async(t)=>({success:true,vectors:t.map(x=>[x.length,1,0])});exports.encoderProvenance=()=>({model:'stub'});exports.resolveDim=()=>3;");
  w('lib/core/semantic-index/vector-store.cjs', "exports.ensureStore=()=>({backend:'cjs-fallback',dim:3});exports.readMeta=()=>({n:0});exports.knnQuery=(db,q,k)=>[{node_id:'a',score:1}].slice(0,k);");
  return dir;
}
function call(dir, op, req) {
  const r = spawnSync(process.execPath, [path.join(dir, 'scripts/rs-vector-bridge.cjs'), op], { input: typeof req === 'string' ? req : JSON.stringify(req), encoding: 'utf8' });
  let out = null; try { out = JSON.parse(r.stdout); } catch (_e) { /* leave null */ }
  return { status: r.status, out, stderr: r.stderr };
}

for (const which of ['orig', 'new']) {
  test(which + ': embed, bad ops and bad stdin keep the envelope contract', () => {
    const d = tree(which, true);
    const ok = call(d, 'embed', { texts: ['ab', 'abc'] });
    assert.equal(ok.status, 0); assert.equal(ok.out.success, true); assert.equal(ok.out.dim, 3);
    assert.equal(call(d, 'nope', {}).out.error, 'bad_op');
    assert.equal(call(d, 'embed', 'not json').out.error, 'bad_stdin');
    assert.equal(call(d, 'embed', { texts: [] }).out.error, 'bad_texts');
    assert.equal(call(d, 'knn', { room: '/nonexistent', query: [1, 2, 3] }).out.error, 'room_open_failed');
    const k = call(d, 'knn', { room: '/r', query: [1, 2, 3], k: 5 });
    assert.equal(k.out.success, true); assert.equal(k.out.hits.length, 1);
    fs.rmSync(d, { recursive: true, force: true });
  });
}

test('new: embed works and exits 0 even when room-db cannot load (orig crashes)', () => {
  const dn = tree('new', false), dold = tree('orig', false);
  const n = call(dn, 'embed', { texts: ['x'] });
  assert.equal(n.status, 0); assert.equal(n.out.success, true);
  const o = call(dold, 'embed', { texts: ['x'] });
  assert.notEqual(o.status, 0, 'original: top-level require crashes the process');
  assert.equal(o.out, null);
  // and the db ops still return the structured tag, not a crash
  const kn = call(dn, 'knn', { room: '/r', query: [1, 2, 3] });
  assert.equal(kn.status, 0); assert.equal(kn.out.error, 'room_open_failed');
  fs.rmSync(dn, { recursive: true, force: true }); fs.rmSync(dold, { recursive: true, force: true });
});

test('new: validates texts entries and query dimension', () => {
  const d = tree('new', true);
  assert.equal(call(d, 'embed', { texts: ['ok', 5] }).out.error, 'bad_texts');
  const r = call(d, 'knn', { room: '/r', query: [1, 2] });
  assert.equal(r.out.error, 'bad_query'); assert.match(r.out.detail, /dimension 3/);
  fs.rmSync(d, { recursive: true, force: true });
});

test('new: no em dash', () => {
  assert.ok(!fs.readFileSync(path.join(pkg, 'rs/shared/scripts/rs-vector-bridge.cjs'), 'utf8').includes('\u2014'));
});
