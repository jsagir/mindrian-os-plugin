#!/usr/bin/env node
'use strict';
/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 * Phase 389 plan 12 (owner D10 = APPROVE) -- pyramid-seed-share: the opt-in share of a Seed.
 *
 * Usage:
 *   card --id ID [--home DIR]
 *        Reads the Seed record and prints exactly what would be public: the page text, the
 *        footer line, the third party (Vercel) and a note that anyone with the link can read the
 *        page. Records a pending confirmation bound to the SHA-256 of the exact page. Sends
 *        nothing.
 *   send --id ID --confirm HASH [--home DIR]
 *        Refuses with exit 3 and card_required unless a fresh pending record exists whose hash
 *        equals --confirm and the hash of the page built now. The record is deleted before the
 *        first network call, so a confirmation is single use. Without a Vercel token the page is
 *        written to a local file instead and nothing leaves the machine.
 *
 * Exit codes: 0 ok, 1 usage, 3 card_required, 4 no such record.
 * stdout is JSON only. stderr carries a usage line only.
 *
 * This script never calls the deploy itself. The share module lib/core/pyramid-seed-share.cjs is
 * the only caller of the deploy, and only behind the card. Nothing here touches the Brain.
 */

const os = require('node:os');

const USAGE = 'usage: pyramid-seed-share.cjs card --id ID [--home DIR] | send --id ID --confirm HASH [--home DIR]';
const FLAGS_WITH_VALUE = ['--id', '--confirm', '--home'];

function finish(obj, code, toStderr) {
  const text = toStderr ? String(obj) + '\n' : JSON.stringify(obj) + '\n';
  const stream = toStderr ? process.stderr : process.stdout;
  stream.write(text, () => process.exit(code));
}

function usage() { finish(USAGE, 1, true); }

function parseArgs(argv) {
  const cmd = argv[0];
  const flags = {};
  for (let i = 1; i < argv.length; i += 1) {
    const a = argv[i];
    if (FLAGS_WITH_VALUE.indexOf(a) === -1 || i + 1 >= argv.length) return null;
    flags[a] = argv[i + 1];
    i += 1;
  }
  return { cmd, flags };
}

async function main() {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) return usage();
  const { cmd, flags } = parsed;
  if (['card', 'send'].indexOf(cmd) === -1) return usage();
  if (!flags['--id']) return usage();
  if (cmd === 'send' && !Object.prototype.hasOwnProperty.call(flags, '--confirm')) {
    // A send without a confirm value is a refusal, not a usage error: nothing left the machine.
    return finish({ error: 'card_required', hint: 'Run the card command, show the card to the person, then run send with the page hash of that card.' }, 3);
  }

  const home = flags['--home'] || process.env.HOME || process.env.USERPROFILE || os.homedir();
  // The local fallback file and the token lookup follow the home folder.
  if (flags['--home']) { process.env.HOME = home; process.env.USERPROFILE = home; }

  const recMod = require('../lib/core/pyramid-seed-record.cjs');
  const shareMod = require('../lib/core/pyramid-seed-share.cjs');

  const got = recMod.readRecord(flags['--id'], { home });
  if (!got.ok) {
    return finish({ ok: false, error: got.reason === 'invalid_id' ? 'invalid_id' : 'no_record', reason: got.reason }, got.reason === 'parse_error' ? 2 : 4);
  }
  const check = recMod.validateRecord(got.record);
  if (!check.ok) return finish({ ok: false, error: 'invalid_record', code: check.code, field: check.field }, 2);

  if (cmd === 'card') {
    return finish(shareMod.prepareCard(got.record, { home }), 0);
  }

  const r = await shareMod.send(got.record, flags['--confirm'], { home });
  if (!r.ok) return finish({ error: r.error, hint: r.hint }, 3);
  return finish(Object.assign({ shared: typeof r.result.url === 'string' }, r.result), 0);
}

main().catch(() => finish({ error: 'seed_share_failed' }, 2));
