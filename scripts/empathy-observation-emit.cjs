#!/usr/bin/env node
'use strict';

/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 121-03 Task 1 -- empathy_observation CLI emitter (D-09 surface 1 of 3).
 *
 * Manually-triggered harness from the empathy audit ritual. Five flags map
 * one-to-one with ALLOWED_FIELDS.empathy_observation in schema.cjs:
 *
 *   --engaged-past-15m=<bool>       Did the tester engage with the room in the past 15 minutes?
 *   --handed-back-material=<bool>   Did the tester hand back material (printed / drafted)?
 *   --returned-within-48h=<bool>    Did the tester return within 48 hours?
 *   --ttr-seconds=<int>             Time-to-response in seconds (non-negative integer).
 *   --tester-id-hash=<hex64>        sha256 of the tester's stable ID. NEVER the raw ID
 *                                   (Canon Part 8 forbidden: real identifiers).
 *
 * Routes through the unified writer.emit() chokepoint (Canon Part 9). The
 * writer's emit-time validator (Canon Part 8 constitutional gate) rejects any
 * payload that smuggles a forbidden pattern (email / phone / Brain URL /
 * absolute path / Cypher / free-text prose).
 *
 * Boolean parse rule: 'true' / 'yes' / '1' accepted as Boolean true;
 *                     'false' / 'no' / '0' accepted as Boolean false;
 *                     case-insensitive; anything else throws.
 *
 * Exit codes:
 *   0  success (one row appended to ~/.mindrian/telemetry/v1.13/events-YYYY-WNN.jsonl)
 *   1  any error (missing flag / bad type / validator rejection)
 *
 * Pure CJS, node built-ins + lib/core/telemetry/writer.cjs. Zero new runtime deps.
 */

const path = require('node:path');
const REPO = path.resolve(__dirname, '..');
const telemetry = require(path.join(REPO, 'lib/core/telemetry/writer.cjs'));

function parseFlag(args, name) {
  const prefix = '--' + name + '=';
  const m = args.find(function (a) { return a.startsWith(prefix); });
  if (!m) return undefined;
  return m.slice(prefix.length);
}

function parseBool(v, field) {
  if (v === undefined) {
    throw new Error('missing flag: --' + field);
  }
  const lower = String(v).toLowerCase();
  if (lower === 'true' || lower === 'yes' || lower === '1') return true;
  if (lower === 'false' || lower === 'no' || lower === '0') return false;
  throw new Error('invalid boolean for --' + field + ': ' + v);
}

function main(argv) {
  try {
    const engagedPast15m = parseBool(parseFlag(argv, 'engaged-past-15m'), 'engaged-past-15m');
    const handedBackMaterial = parseBool(parseFlag(argv, 'handed-back-material'), 'handed-back-material');
    const returnedWithin48h = parseBool(parseFlag(argv, 'returned-within-48h'), 'returned-within-48h');

    const ttrRaw = parseFlag(argv, 'ttr-seconds');
    if (ttrRaw === undefined) {
      throw new Error('missing flag: --ttr-seconds');
    }
    const ttrSeconds = parseInt(ttrRaw, 10);
    if (!Number.isFinite(ttrSeconds) || ttrSeconds < 0 || String(ttrSeconds) !== String(ttrRaw).replace(/^0+(?=\d)/, '')) {
      // Reject NaN, negative, and non-pure-integer inputs. The replace strips
      // leading zeros so '00060' parses to 60 cleanly; pure integer rule
      // catches 'not-a-number' (parseInt returns NaN) and '1.5' (parseInt
      // returns 1 but String(1) !== '1.5').
      if (!Number.isFinite(ttrSeconds) || ttrSeconds < 0) {
        throw new Error('invalid --ttr-seconds: must be a non-negative integer; got ' + ttrRaw);
      }
      // For non-integer suffixes (e.g. '60abc'): parseInt yields a number but the
      // original string carries trailing junk. Be strict.
      if (!/^\d+$/.test(String(ttrRaw))) {
        throw new Error('invalid --ttr-seconds: must be a non-negative integer; got ' + ttrRaw);
      }
    }

    const testerIdHash = parseFlag(argv, 'tester-id-hash');
    if (!testerIdHash) {
      throw new Error('missing flag: --tester-id-hash');
    }
    if (!/^[0-9a-f]{64}$/.test(testerIdHash)) {
      throw new Error('invalid --tester-id-hash: must be a 64-char lowercase hex sha256');
    }

    telemetry.emit('empathy_observation', {
      engaged_past_15m: engagedPast15m,
      handed_back_material: handedBackMaterial,
      returned_within_48h: returnedWithin48h,
      ttr_seconds: ttrSeconds,
      tester_id_hash: testerIdHash,
    });
    process.exit(0);
  } catch (e) {
    process.stderr.write('empathy-observation-emit: ' + (e && e.message ? e.message : String(e)) + '\n');
    process.exit(1);
  }
}

if (require.main === module) {
  main(process.argv.slice(2));
}

module.exports = { main };
