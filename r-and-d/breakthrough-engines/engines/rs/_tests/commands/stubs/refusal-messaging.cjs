'use strict';
// HAND-MADE TEST STUB for the missing refusal-messaging rail.
function refusalResponse(kind, ctx) {
  return { status: 'BRAIN_UNREACHABLE', reason: 'stub reason for ' + kind + ' (' + (ctx && ctx.tool) + ')', next_moves: ['retry', 'continue_without'] };
}
function renderRefusal(kind, ctx) { return 'STUB-REFUSAL ' + kind + ' ' + (ctx && ctx.tool) + '\n'; }
module.exports = { refusalResponse, renderRefusal, REFUSAL_KINDS: ['unreachable'] };
