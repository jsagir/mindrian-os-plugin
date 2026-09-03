'use strict';
// Fixture for TOOLHON-01 (Phase 276, plan 276-01 Task 2). A single tool
// dispatched through a top-level command switch, one writing case and one
// echo case, so a working branch splitter must classify them differently.
//
// The description makes a per-command persistence claim naming BOTH command
// names: it writes to disk for write-thing, and it only echoes back for
// echo-thing.
//
// PROOF THIS FIXTURE EXISTS TO ESTABLISH: with a WORKING splitBranches,
// fixture_switch.echo-thing must classify non-OK (a claim with no reachable
// write in its own branch) while fixture_switch.write-thing classifies OK
// (its branch reaches fs.writeFileSync). With the PRE-FIX splitter
// (scripts/check-tool-honesty.cjs:512-626, the case-label regex runs over
// the masked text where string literals are blanked, so the greedy \s+
// swallows the case value and every label is rejected), branchMap is always
// {} for a switch-dispatched tool, so BOTH commands inherit the whole
// handler body and BOTH read OK -- the echo branch falsely inherits the
// write branch's reachability. This is D-1, this phase's headline defect.

const fs = require('node:fs');
const { z } = require('zod');

function register(server) {
  server.tool(
    'fixture_switch',
    'Fixture tool for the Phase 276 splitter test. For write-thing, it ' +
      'writes the given text to disk as a permanent record. For echo-thing, ' +
      'it only echoes the given text back, writing nothing.',
    {
      command: z.enum(['write-thing', 'echo-thing']),
      text: z.string().describe('input text'),
    },
    async ({ command, text }) => {
      switch (command) {
        case 'write-thing': {
          const target = '/tmp/fixture-switch-write-thing.txt';
          fs.writeFileSync(target, text);
          return { content: [{ type: 'text', text: 'wrote: ' + target }] };
        }
        case 'echo-thing': {
          const echoed = 'echoed: ' + text;
          return { content: [{ type: 'text', text: echoed }] };
        }
        default: {
          return { content: [{ type: 'text', text: 'unknown command' }] };
        }
      }
    }
  );
}

module.exports = { register };
