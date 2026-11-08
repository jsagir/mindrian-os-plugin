'use strict';
// Shared helper for the Phase 370 tests (review contract for grade and deep-grade).
// Node built-ins only. No network. No Brain call (Canon Part 8).
// The helper never writes outside a temp directory.

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const EM = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);
const ZWSP = String.fromCharCode(0x200b);
const SHY = String.fromCharCode(0x00ad);
const MODULE_REL = 'lib/core/review-contract.cjs';
const CONTRACT_REL = 'data/review-contract.json';

function readFixture(name) {
  return fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', '370', name), 'utf8');
}

function realContract() {
  const p = path.join(ROOT, CONTRACT_REL);
  if (!fs.existsSync(p)) {
    throw new Error(CONTRACT_REL + ' does not exist yet (review-contract data file missing; plan 370-02 creates it)');
  }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// Deep clone of the real contract with a shallow top-level merge of patch.
function contractWith(patch) {
  const clone = JSON.parse(JSON.stringify(realContract()));
  return Object.assign(clone, patch || {});
}

// Temp directories are removed when the process exits.
const TMP_DIRS = [];
process.on('exit', () => {
  for (const d of TMP_DIRS) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (_) { /* best effort */ }
  }
});
function mkTmpDir(prefix) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix || 'rc370-'));
  TMP_DIRS.push(d);
  return d;
}

// spec: { agents: [name], commands: ['/mos:x'], tools: ['tool_id'] }
function mkTmpRepo(spec) {
  const s = spec || {};
  const root = mkTmpDir('rc370-repo-');
  fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  for (const name of (s.agents || [])) {
    fs.writeFileSync(
      path.join(root, 'agents', name + '.md'),
      '---\nname: ' + name + '\ndescription: temp agent for tests\n---\nThis is a temp agent file.\n'
    );
  }
  fs.writeFileSync(
    path.join(root, 'data', 'command-registry.json'),
    JSON.stringify({ commands: (s.commands || []).map((c) => ({ command: c })) }, null, 2)
  );
  fs.writeFileSync(
    path.join(root, 'data', 'mcp-tool-connectors.json'),
    JSON.stringify({ connectors: (s.tools || []).map((t) => ({ surface: 'mcp:' + t })) }, null, 2)
  );
  fs.copyFileSync(path.join(ROOT, CONTRACT_REL), path.join(root, 'data', 'review-contract.json'));
  return root;
}

// ---------------------------------------------------------------------------
// Review builders. A valid review has the frontmatter handles and the six
// sections in order, so a test plants only one fault.
// ---------------------------------------------------------------------------
const FM_LINES = [
  '---',
  'methodology: deep-grade',
  'review_contract: 1',
  'assessor: grading',
  'team: Team Cedar Wharf',
  '---',
];
const FM = FM_LINES.join('\n');

const DEFAULT_SECTIONS = {
  exec: [
    'The tide table service has one clear first user and one open question.',
    '',
    '- **Name the first buyer:** ferry crews check the table every day.',
    '- **Test the delay claim:** compare the printed times with real arrivals.',
    '- **Price one route:** start with a single ferry line.',
  ].join('\n'),
  reality: 'The ferry delay claim is assumed. The size of the harbor town is validated by the town census.',
  faculty: '- Who pays when the table is wrong?',
  expert: 'A ferry captain would say: show me one week of real times.',
  research: 'Leverage points show where a small change moves the system. Check the stocks and flows of waiting passengers.',
  strategic: [
    '**Big question:** who would stop using the paper table first?',
    '',
    '- What would you test this week?',
    '- What would change your mind?',
    '- Who else relies on the table?',
  ].join('\n'),
};

const SECTION_HEADINGS = [
  ['exec', 'Executive Summary'],
  ['reality', 'Reality Check'],
  ['faculty', 'Faculty Questions'],
  ['expert', 'Expert Conversations'],
  ['research', 'Research Validation + Reframe'],
  ['strategic', 'Strategic Challenge'],
];

// opts: { fm, title, pre, sections: {exec,...}, tail: 'text appended after the last section' }
function review(opts) {
  const o = opts || {};
  const sec = Object.assign({}, DEFAULT_SECTIONS, o.sections || {});
  const parts = [];
  parts.push(o.fm === undefined ? FM : o.fm);
  parts.push('# ' + (o.title || 'Review of the Cedar Wharf tide service'));
  if (o.pre) parts.push(o.pre);
  for (const [key, heading] of SECTION_HEADINGS) {
    parts.push('## ' + heading + '\n\n' + sec[key]);
  }
  if (o.tail) parts.push(o.tail);
  return parts.join('\n\n') + '\n';
}

// Add one snippet to a section (default: reality) of an otherwise valid review.
function wrap(snippet, section, opts) {
  const key = section || 'reality';
  const sections = {};
  sections[key] = DEFAULT_SECTIONS[key] + '\n\n' + snippet;
  return review(Object.assign({}, opts || {}, { sections }));
}

// Build a review from an explicit list of heading lines (strings such as '## Notes').
function rawReview(headingLines, bodyLine) {
  const parts = [FM, '# Review of the Cedar Wharf tide service'];
  for (const h of headingLines) parts.push(h + '\n\n' + (bodyLine || 'Plain text for this section.'));
  return parts.join('\n\n') + '\n';
}

const SIX_HEADINGS = SECTION_HEADINGS.map((p) => '## ' + p[1]);

// 1-based line number of the first line that contains needle.
function lineOf(text, needle) {
  const lines = String(text).split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].indexOf(needle) !== -1) return i + 1;
  }
  return -1;
}

function findV(result, rule, cls) {
  return (result.violations || []).filter((v) => v.rule === rule && (cls === undefined || v.class === cls));
}

// ---------------------------------------------------------------------------
// Reporter: pass and fail counters, FAIL lines on stderr, exit code 1 on any fail.
// ---------------------------------------------------------------------------
function reporter(name) {
  let pass = 0;
  let fail = 0;
  const api = {
    arm(id, fn) {
      try {
        fn();
        pass++;
        console.log('  ok   ' + id);
      } catch (e) {
        fail++;
        console.error('FAIL ' + id + ': ' + ((e && e.message) || e));
      }
    },
    ok(cond, msg) {
      if (!cond) throw new Error(msg || 'assertion failed');
    },
    eq(a, b, msg) {
      if (a !== b) throw new Error((msg || 'not equal') + ' (got ' + JSON.stringify(a) + ', want ' + JSON.stringify(b) + ')');
    },
    // One clear failure when the module under test (or its data file) cannot load.
    fatal(msg) {
      console.error('FAIL ' + name + ': ' + msg);
      console.log('PASS: ' + pass + ' FAIL: ' + (fail + 1));
      process.exit(1);
    },
    done() {
      console.log('PASS: ' + pass + ' FAIL: ' + fail);
      process.exit(fail > 0 ? 1 : 0);
    },
  };
  return api;
}

// Require the module under test, or stop once with a message that names it.
function requireModule(rep) {
  try {
    return require(path.join(ROOT, MODULE_REL));
  } catch (e) {
    rep.fatal('cannot load ' + MODULE_REL + ' (review-contract module missing; plan 370-02 creates it): ' + ((e && e.message) || e).split('\n')[0]);
    return null;
  }
}

module.exports = {
  ROOT, EM, EN, ZWSP, SHY, MODULE_REL, CONTRACT_REL,
  readFixture, realContract, contractWith, mkTmpDir, mkTmpRepo,
  FM, FM_LINES, DEFAULT_SECTIONS, SIX_HEADINGS,
  review, wrap, rawReview, lineOf, findV,
  reporter, requireModule,
};
