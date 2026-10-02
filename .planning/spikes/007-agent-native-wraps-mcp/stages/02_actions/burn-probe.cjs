// Spike 007: does a REFUSED cross-session answer burn the owner's gate?
// Through the app's own decision-gate action (HTTP), two UI sessions.
// lib/mcp/gate-ledger.cjs consumeGate deletes the entry before the session check.
'use strict';
const APP = process.env.APP_URL || 'http://127.0.0.1:8090';
const post = (body) => fetch(APP + '/_agent-native/actions/decision-gate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
(async () => {
  const owner = 'ui-owner-' + Date.now(); const other = 'ui-other-' + Date.now();
  const out = {};
  for (const arm of ['control_owner_only', 'other_answers_first']) {
    const m = await post({ ui_session: owner, op: 'mint', source: 'render' });
    const gid = m.gate.gate_id;
    if (arm === 'other_answers_first') {
      const x = await post({ ui_session: other, op: 'answer', gate_id: gid, chosen: ['approve_standing'], verdict: 'approve' });
      out[arm + '.other'] = { answered: x.answered, refused: x.refused };
    }
    const o = await post({ ui_session: owner, op: 'answer', gate_id: gid, chosen: ['approve_standing'], verdict: 'approve' });
    out[arm + '.owner'] = { answered: o.answered, ratified: o.ratified, refused: o.refused };
  }
  console.log(JSON.stringify(out, null, 1));
})();
