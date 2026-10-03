#!/usr/bin/env node
'use strict';

/**
 * Phase 369-14 (SHELL369-02) -- the Claude adapter, room-proposal path (D-14).
 *
 * Navigator ruling 2026-10-03 on A1 (369-ADAPTER-RULING.md): the shell does
 * not spawn the person's Claude Code. A proposal arrives through the room.
 * This test proves the adapter's boundaries without any model, key or login.
 *
 *   1. static: the module names no write tool, spawns nothing, holds no cookie
 *      or nonce, has no long dash, and loads under Node type stripping.
 *   2. copyReference: one line, carries the node id and the question, and no
 *      cookie or nonce field.
 *   3. fake pool (every call recorded): the adapter only ever calls the
 *      read vocabulary; the newest proposed claim naming the node wins; a
 *      claim about another node, the node's own claim, and a non-proposed
 *      claim are skipped; no claim yields no_proposal; a bad request, a failed
 *      bind and an invalid proposal each answer their own reason.
 *   4. live (hermetic flag-ON daemon, seeded room): a seeded proposed claim
 *      naming the node maps to a ProposalSchema-valid proposal whose evidence
 *      holds the node and the claim's source, recommended approve; another
 *      node answers no_proposal; the room's claim counts are unchanged after
 *      the adapter ran (it wrote nothing); the adapter used its own MCP
 *      session, distinct from a human session.
 *
 * Hermetic: temp HOME, USERPROFILE and MINDRIAN_ROOMS_HOME; CLAUDE_ACTIVE_ROOM
 * and CLAUDE_CODE_SESSION_ID unset. Exit 77 only when the daemon cannot start
 * here (environment gap). No spawn of claude exists on this path, so there is
 * no live-Claude arm and no fake binary. No literal em-dash or en-dash in this
 * file (the guard builds the characters at run time). CJS.
 */

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..');
const ADAPTER = path.join(REPO_ROOT, 'ui', 'shared', 'src', 'claude-adapter.ts');

const TEMP_HOME = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-369-14-'));
process.env.HOME = TEMP_HOME;
process.env.USERPROFILE = TEMP_HOME;
process.env.MINDRIAN_ROOMS_HOME = path.join(TEMP_HOME, 'MindrianRooms');
delete process.env.CLAUDE_ACTIVE_ROOM;
delete process.env.CLAUDE_CODE_SESSION_ID;

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log('  ok ' + name);
  } catch (err) {
    failed += 1;
    console.log('  FAIL ' + name);
    console.log('    ' + (err && err.message ? err.message : String(err)));
  }
}

function load(file) {
  return import(pathToFileURL(file).href);
}

// A fake pool: scripted answers per tool, every call recorded.
function fakePool(script) {
  const calls = [];
  return {
    calls,
    async adapterCall(tool, args) {
      calls.push({ tool, args });
      const r = script(tool, args || {});
      const isError = r && r.isError === true;
      return { ok: !isError, isError, data: r ? r.data : null, text: '' };
    },
  };
}

function claimsScript(opts) {
  return (tool, args) => {
    if (tool === 'room_bind') return { data: { effective: opts.bind !== false } };
    if (tool === 'claim_read' && args.query) return { data: { claims: opts.list } };
    if (tool === 'claim_read' && args.claim_id) {
      const c = opts.byId[args.claim_id];
      return c ? { data: { claim: c } } : { isError: true, data: { ok: false } };
    }
    if (tool === 'graph_query') return { data: { results: opts.hood || [] } };
    return { isError: true, data: null };
  };
}

function hash31(s) {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h.toString(16);
}

async function main() {
  const { ProposalSchema } = await load(path.join(REPO_ROOT, 'ui', 'shared', 'src', 'proposal.ts'));
  const mod = await load(ADAPTER);
  const { roomProposalSource, copyReference, ADAPTER_READ_TOOLS } = mod;

  console.log('static arms');

  await test('1. module loads, names no write tool, spawns nothing, holds no cookie or nonce, has no long dash', async () => {
    assert.equal(typeof roomProposalSource, 'function');
    assert.equal(typeof copyReference, 'function');
    const src = fs.readFileSync(ADAPTER, 'utf8');
    assert.equal(
      /claim_write|graph_write|artifact_file|gate_answer|gate_render|memory_event|identity_write/.test(src),
      false,
      'a write tool name appears in the module'
    );
    assert.equal(/child_process|spawn\(|exec\(|execFile|fork\(/.test(src), false, 'the adapter must spawn nothing');
    assert.equal(/cookie|nonce/i.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')), false, 'no cookie or nonce handling in code');
    for (const d of [String.fromCharCode(0x2014), String.fromCharCode(0x2013)]) {
      assert.equal(src.includes(d), false, 'long dash in module');
    }
    assert.deepEqual([...ADAPTER_READ_TOOLS].sort(), ['claim_read', 'graph_query', 'room_bind']);
  });

  await test('2. copyReference is one line with the node id and the question and nothing secret', async () => {
    const line = copyReference('claim:abc:1f', 'Is demand\nrising?');
    assert.equal(line.includes('\n'), false);
    assert.ok(line.includes('claim:abc:1f'));
    assert.ok(line.includes('Is demand rising?'));
    assert.equal(/cookie|nonce|session/i.test(line), false);
    assert.equal(line.includes(String.fromCharCode(0x2014)), false);
  });

  console.log('fake pool arms');

  const SEL = 'node-sel-1';
  const base = { roomSlug: 'r1', selectedNodeId: SEL, question: 'Should we keep this?' };

  await test('3a. newest proposed claim naming the node wins; only read tools are called; evidence holds node and sources', async () => {
    const pool = fakePool(
      claimsScript({
        list: [
          { claim_id: 'claim:s:new', review_status: 'proposed' },
          { claim_id: 'claim:s:old', review_status: 'proposed' },
        ],
        byId: {
          'claim:s:new': { text: 'New: ' + SEL + ' looks right', standing: 'source_edge', confirmation: { review_status: 'proposed' } },
          'claim:s:old': { text: 'Old: ' + SEL + ' maybe', standing: 'none', confirmation: { review_status: 'proposed' } },
        },
        hood: [
          { id: 'Src:1', edgeTypeIn: 'SOURCED_FROM' },
          { id: 'other:2', edgeTypeIn: 'INFORMS' },
        ],
      })
    );
    const ans = await roomProposalSource({ pool }).proposeResult(base);
    assert.equal(ans.ok, true, JSON.stringify(ans));
    assert.equal(ProposalSchema.safeParse(ans.proposal).success, true);
    assert.equal(ans.proposal.subject_node_id, 'claim:s:new');
    assert.equal(ans.proposal.recommended_id, 'approve');
    assert.deepEqual(ans.proposal.evidence_node_ids, [SEL, 'Src:1']);
    assert.deepEqual(ans.proposal.verdict_options.map((o) => o.id), ['approve', 'hold', 'reject']);
    for (const c of pool.calls) assert.ok(ADAPTER_READ_TOOLS.includes(c.tool), 'non-read tool called: ' + c.tool);
    assert.equal(pool.calls[0].tool, 'room_bind');
    assert.deepEqual(pool.calls[0].args, { room: 'r1' });
  });

  await test('3b. a claim with no source recommends hold; propose() resolves the same proposal', async () => {
    const pool = fakePool(
      claimsScript({
        list: [{ claim_id: 'claim:s:1', review_status: 'proposed' }],
        byId: { 'claim:s:1': { text: SEL + ' is fine', standing: 'none', confirmation: { review_status: 'proposed' } } },
      })
    );
    const src = roomProposalSource({ pool });
    const p = await src.propose(base);
    assert.equal(p.recommended_id, 'hold');
    assert.deepEqual(p.evidence_node_ids, [SEL]);
  });

  await test('3c. skipped: another node, the node itself, a non-proposed claim; then no_proposal and propose() rejects', async () => {
    const pool = fakePool(
      claimsScript({
        list: [
          { claim_id: SEL, review_status: 'proposed' },
          { claim_id: 'claim:s:conf', review_status: 'confirmed' },
          { claim_id: 'claim:s:other', review_status: 'proposed' },
        ],
        byId: {
          'claim:s:other': { text: 'something about another node', standing: 'none', confirmation: { review_status: 'proposed' } },
        },
      })
    );
    const src = roomProposalSource({ pool });
    assert.deepEqual(await src.proposeResult(base), { ok: false, reason: 'no_proposal' });
    await assert.rejects(() => src.propose(base), /no_proposal/);
    const readIds = pool.calls.filter((c) => c.tool === 'claim_read' && c.args.claim_id).map((c) => c.args.claim_id);
    assert.deepEqual(readIds, ['claim:s:other'].concat(['claim:s:other']), 'only the proposed other-node claim is read, once per call');
  });

  await test('3d. invalid_request, room_unavailable and proposal_invalid each answer their own reason', async () => {
    const empty = fakePool(() => null);
    const s0 = roomProposalSource({ pool: empty });
    assert.deepEqual(await s0.proposeResult({ roomSlug: '', selectedNodeId: SEL, question: 'q' }), { ok: false, reason: 'invalid_request' });
    assert.deepEqual(await s0.proposeResult({ roomSlug: 'r', selectedNodeId: 'x'.repeat(201), question: 'q' }), { ok: false, reason: 'invalid_request' });
    assert.equal(empty.calls.length, 0, 'an invalid request makes no call');

    const noBind = fakePool(claimsScript({ bind: false, list: [], byId: {} }));
    const a = await roomProposalSource({ pool: noBind }).proposeResult(base);
    assert.equal(a.ok, false);
    assert.equal(a.reason, 'room_unavailable');

    const longId = 'claim:' + 'z'.repeat(220);
    const badPool = fakePool(
      claimsScript({
        list: [{ claim_id: longId, review_status: 'proposed' }],
        byId: {},
      })
    );
    const orig = badPool.adapterCall;
    badPool.adapterCall = async (tool, args) => {
      if (tool === 'claim_read' && args.claim_id === longId) {
        badPool.calls.push({ tool, args });
        return { ok: true, isError: false, data: { claim: { text: SEL, standing: 'none', confirmation: { review_status: 'proposed' } } }, text: '' };
      }
      return orig(tool, args);
    };
    const b = await roomProposalSource({ pool: badPool }).proposeResult(base);
    assert.equal(b.ok, false);
    assert.equal(b.reason, 'proposal_invalid');
  });

  console.log('live room-proposal arm against the hermetic flag-ON daemon');
  const { startDaemon, stopDaemon } = require('./helpers/mcp-daemon-369.cjs');
  const { CLAIM_NODE_ID } = require(path.join(REPO_ROOT, 'lib', 'core', 'navigation', 'typed-claim.cjs'));

  const SLUG = 'room-p';
  const LIVE_SEL = 'node-live-sel-369';
  const URL_ = 'https://example.org/369-source';
  const textA = 'Older note about ' + LIVE_SEL + ': demand looks flat.';
  const textB = 'Newer note about ' + LIVE_SEL + ': demand is rising.';
  const textC = 'A later note about a different node entirely.';
  const sidB = 'fixture-369-' + SLUG + '-b';
  const claimB = CLAIM_NODE_ID(sidB, textB);
  const sourceId = 'EvidenceClaim:fixture-369-' + SLUG + '-src-s1:' + hash31(URL_);

  let handle = null;
  let pool = null;
  try {
    try {
      handle = await startDaemon({
        rooms: [
          {
            slug: SLUG,
            variant: 'wide',
            migrate: true,
            seed: [
              { kind: 'claim', text: textA, variant: 'a' },
              { kind: 'claim', text: textB, variant: 'b' },
              { kind: 'source', url: URL_, retrieved_at: '2026-10-01T00:00:00Z', variant: 's1' },
              { kind: 'edge', source_id: claimB, target_id: sourceId, edge_type: 'SOURCED_FROM' },
              { kind: 'claim', text: textC, variant: 'c' },
            ],
          },
        ],
      });
    } catch (err) {
      const msg = String(err && err.message ? err.message : err);
      if (/EPERM|EACCES|EADDRINUSE|bind|did not report its port|exited early/i.test(msg)) {
        console.log('SKIPPED (ENV GAP): the daemon could not start here: ' + msg.slice(0, 200));
        process.exit(77);
      }
      throw err;
    }
    const { createSessionPool } = await load(path.join(REPO_ROOT, 'ui', 'shared', 'src', 'mcp-session-pool.ts'));
    pool = createSessionPool({ daemonUrl: () => 'http://127.0.0.1:' + handle.port, idleMs: 60000 });

    await test('4a. a seeded proposed claim naming the node maps to a valid proposal; read-only; own session', async () => {
      const human = await pool.get('human-1');
      const bound = await pool.bind('human-1', SLUG);
      assert.equal(bound.ok, true, bound.text.slice(0, 200));
      const before = await pool.call('human-1', 'claim_read', {});
      assert.equal(before.ok, true, before.text.slice(0, 200));
      const total0 = before.data.portrait.claims_total;
      assert.equal(total0, 3);

      const ans = await roomProposalSource({ pool }).proposeResult({ roomSlug: SLUG, selectedNodeId: LIVE_SEL, question: 'Keep it?' });
      assert.equal(ans.ok, true, JSON.stringify(ans));
      assert.equal(ProposalSchema.safeParse(ans.proposal).success, true);
      assert.equal(ans.proposal.subject_node_id, claimB, 'the newest claim naming the node, not the older one or the later unrelated one');
      assert.equal(ans.proposal.recommended_id, 'approve', 'a claim with a source edge recommends approve');
      assert.ok(ans.proposal.evidence_node_ids.includes(LIVE_SEL));
      assert.ok(ans.proposal.evidence_node_ids.includes(sourceId), 'the claim\'s source is evidence: ' + JSON.stringify(ans.proposal.evidence_node_ids));
      assert.ok(ans.proposal.rationale.includes(LIVE_SEL));

      const adapter = await pool.adapterSession();
      assert.ok(adapter.mcpSessionId && adapter.mcpSessionId !== human.mcpSessionId, 'the adapter rides its own MCP session');

      const after = await pool.call('human-1', 'claim_read', {});
      assert.equal(after.data.portrait.claims_total, total0, 'the adapter wrote nothing');
      const confirmed = after.data.claims.filter((c) => c.review_status !== 'proposed');
      assert.equal(confirmed.length, 0, 'nothing was confirmed by the adapter');
    });

    await test('4b. a node no claim names answers no_proposal', async () => {
      const ans = await roomProposalSource({ pool }).proposeResult({ roomSlug: SLUG, selectedNodeId: 'node-nobody-mentions', question: 'q' });
      assert.deepEqual(ans, { ok: false, reason: 'no_proposal' });
    });

    await test('4c. an unknown room answers room_unavailable', async () => {
      const ans = await roomProposalSource({ pool }).proposeResult({ roomSlug: 'no-such-room', selectedNodeId: LIVE_SEL, question: 'q' });
      assert.equal(ans.ok, false);
      assert.equal(ans.reason, 'room_unavailable');
    });
  } catch (err) {
    failed += 1;
    console.log('  FAIL harness: ' + (err && err.message ? err.message : String(err)));
  } finally {
    if (pool) await pool.closeAll();
    if (handle) await stopDaemon(handle);
  }

  console.log('');
  console.log('live Claude arm: not applicable (room-proposal ruling, nothing is spawned)');
  console.log('RESULT: PASS=' + passed + ' FAIL=' + failed);
  try { fs.rmSync(TEMP_HOME, { recursive: true, force: true }); } catch (_e) { /* best effort */ }
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
