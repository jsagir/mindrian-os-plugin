'use strict';
// Phase 192-03 Task 2 -- structural suite for commands/stance.md (the F.0-class cycle-and-confirm
// toggle). Proves the command surface is born correct:
//   (a) frontmatter declares hitl_shape: F.0 and a non-empty hitl_why (Phase 190 mandate)
//   (b) connector.excluded is true with a non-empty reason (born-wired gate stays green)
//   (c) the body cites the exact pickShape('F.0', ...) dispatcher call and NEVER hand-constructs a
//       bespoke AskUserQuestion JSON shape (no raw {"questions": literal)
//   (d) the body frames Approve/Reject/Defer against the proposed-next-stance language, never a
//       direct 4-way pick
//   (e) the body wires stance-state.cjs (readStance / nextStance / writeStance)
//
// House rule: hyphens only, no em-dashes. CJS, node built-ins only.

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const CMD_PATH = path.join(REPO_ROOT, 'commands', 'stance.md');

let failures = 0;
function check(cond, msg) {
  if (cond) {
    process.stdout.write('  ok   ' + msg + '\n');
  } else {
    failures++;
    process.stdout.write('  FAIL ' + msg + '\n');
  }
}

const src = fs.readFileSync(CMD_PATH, 'utf8');

// Split frontmatter from body on the second '---' fence.
const fmMatch = src.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
check(!!fmMatch, 'command has a YAML frontmatter block');
const frontmatter = fmMatch ? fmMatch[1] : '';
const body = fmMatch ? fmMatch[2] : src;

// (a) hitl_shape: F.0 + non-empty hitl_why.
check(/^hitl_shape:\s*["']?F\.0["']?\s*$/m.test(frontmatter), 'frontmatter declares hitl_shape: F.0');
const whyMatch = frontmatter.match(/^hitl_why:\s*["']?(.+?)["']?\s*$/m);
check(!!whyMatch && whyMatch[1].trim().length > 0, 'frontmatter declares a non-empty hitl_why');

// (b) connector.excluded: true + non-empty reason.
check(/excluded:\s*true/.test(frontmatter), 'frontmatter declares connector.excluded: true');
const reasonMatch = frontmatter.match(/reason:\s*["']?(.+?)["']?\s*$/m);
check(!!reasonMatch && reasonMatch[1].trim().length > 0, 'frontmatter declares a non-empty connector.reason');

// (c) cites the exact pickShape('F.0', ...) dispatcher call.
check(body.indexOf("pickShape('F.0'") !== -1, "body cites the exact pickShape('F.0', ...) dispatcher call");
// no bespoke AskUserQuestion JSON.
check(body.indexOf('{"questions":') === -1, 'body never hand-constructs a raw {"questions": ...} JSON shape');
check(!/\{\s*"questions"/.test(body), 'body never hand-constructs a whitespaced {"questions" JSON shape');

// (d) Approve/Reject/Defer framed against the proposed-next-stance, never a 4-way pick.
check(/Approve/.test(body) && /Reject/.test(body) && /Defer/.test(body), 'body names all three F.0 verbs (Approve/Reject/Defer)');
check(/next stance|proposed next stance|proposed|nextStance/.test(body), 'body frames a proposed-NEXT-stance (cycle-and-confirm), not a direct pick');
// Guard against a 4-way pick framing: the body must not offer all four stances as simultaneous
// selectable verbs through the gate. (It names the four poles descriptively, which is fine; it must
// not describe the GATE as offering a 4-way choice.) A cheap proxy: the closed-vocab note is present.
check(/closed-vocab|CLOSED-VOCAB|closed vocab/.test(body), 'body states the F.0 renderer is closed-vocab (Approve/Reject/Defer only)');

// (e) wires stance-state.cjs API.
check(/readStance/.test(body), 'body wires readStance()');
check(/nextStance/.test(body), 'body wires nextStance()');
check(/writeStance/.test(body), 'body wires writeStance() on Approve');
check(/stance-state/.test(body), 'body references lib/core/stance-state.cjs');

// Voice-color naming on Approve.
check(/RED|red/.test(body) && /BLUE|blue/.test(body), 'body names the redteam-red / tell-act-blue forced voice colors');

if (failures === 0) {
  process.stdout.write('PASS test-stance-toggle-f0-gate.cjs (stance command born F.0-declared, born-wired, dispatcher-cited)\n');
  process.exit(0);
} else {
  process.stdout.write('FAIL test-stance-toggle-f0-gate.cjs (' + failures + ' failing assertion(s))\n');
  process.exit(1);
}
