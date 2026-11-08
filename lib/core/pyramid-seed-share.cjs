/*
 * Copyright (c) 2026 Mindrian. BSL 1.1.
 *
 * Phase 389-12 -- pyramid-seed-share (owner decision D10 = APPROVE).
 *
 * The opt-in last step of the Seed: a person can share a Seed as a public page on Vercel.
 * Default off. Nothing is sent unless the person has seen the card and says yes.
 *
 *   buildSharePage(record)  the page: the receipt text of the record, HTML-escaped, inline styles
 *                           only, one footer line. Nothing from the machine.
 *   shareCardLines(record)  the exact public text (the same text renderReceipt gives).
 *   pageHash(html)          SHA-256 of the exact page, lower-case hex.
 *   prepareCard(record, o)  writes one pending file <home>/.mindrian/pyramid-seed/share-pending/
 *                           <page hash>.json (hash and time only, no text) and returns the card.
 *   send(record, confirm, o) refuses unless a fresh pending file exists whose hash equals both
 *                           the confirm value and the hash of the page built now. The pending file
 *                           is deleted before the first network call, so a confirmation is single
 *                           use. An edited record gives another page hash and needs a new card.
 *
 * Reuse (Canon Part 7): renderReceipt of pyramid-seed-record.cjs (the text), DECK_PALETTE of
 * mva-deck-builder.cjs (the colors), deployDeck of mva-vercel-deploy.cjs (the one uploader, loaded
 * lazily inside send). This is the only caller of deployDeck.
 *
 * Canon Part 8: the Brain is never involved. This module has no Brain client and no room database.
 * The page leaves the machine only behind the card, to Vercel, and Vercel is named on the card.
 * The deployment name uses the first 8 characters of the page hash, never the record id, because
 * the record id is the first 8 characters of the hash of the venture sentence.
 *
 * Tests replace the deploy with opts.deploy. Pure CJS, node built-ins plus the two local modules.
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');

const { renderReceipt, validateRecord } = require('./pyramid-seed-record.cjs');
const { DECK_PALETTE } = require('./mva-deck-builder.cjs');

const FOOTER_TEXT = 'Made with MindrianOS';
const THIRD_PARTY = 'Vercel';
const PENDING_TTL_MS = 60 * 60 * 1000;
const HASH_RE = /^[0-9a-f]{64}$/;

const CARD_NOTE =
  'Vercel would host this page, and anyone with the link can read it. ' +
  'The page holds exactly the text above plus the footer line, and nothing else. ' +
  'Nothing is sent until the person says yes. ' +
  'Run send with --confirm ' + '<page_sha256>' + ' after the person agrees.';

function _home(opts) {
  if (opts && typeof opts.home === 'string' && opts.home.length > 0) return opts.home;
  return process.env.HOME || process.env.USERPROFILE || os.homedir();
}

function _pendingDir(opts) {
  return path.join(_home(opts), '.mindrian', 'pyramid-seed', 'share-pending');
}

function _esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** shareCardLines(record) -> the exact public text of the page, without the footer line. */
function shareCardLines(record) {
  return renderReceipt(record);
}

/** pageHash(html) -> SHA-256 of the exact page text, 64 lower-case hex characters. */
function pageHash(html) {
  return crypto.createHash('sha256').update(String(html), 'utf8').digest('hex');
}

function _lineHtml(line, i) {
  const P = DECK_PALETTE;
  const text = line.trim();
  const base = 'font-family:Helvetica,Arial,sans-serif;color:' + P.black + ';';
  if (i === 0) {
    return '<h1 style="' + base + 'font-family:Impact,Helvetica,Arial,sans-serif;font-size:32px;' +
      'letter-spacing:1px;margin:0 0 24px 0;padding:0 0 12px 0;border-bottom:6px solid ' + P.black + ';">' +
      _esc(text) + '</h1>';
  }
  if (text === '') {
    return '<div style="height:16px;"></div>';
  }
  if (/^Answer: /.test(text)) {
    return '<div style="' + base + 'font-size:22px;line-height:1.4;margin:0 0 8px 0;padding:14px 18px;' +
      'background:#FFFFFF;border-left:12px solid ' + P.blue + ';">' + _esc(text) + '</div>';
  }
  if (/^Strongest objection: /.test(text)) {
    return '<div style="' + base + 'font-size:18px;line-height:1.4;margin:0 0 8px 0;padding:12px 18px;' +
      'background:#FFFFFF;border-left:12px solid ' + P.red + ';">' + _esc(text) + '</div>';
  }
  if (/^\d+\. /.test(text)) {
    return '<div style="' + base + 'font-size:18px;font-weight:bold;line-height:1.4;margin:8px 0 2px 0;' +
      'padding-left:18px;border-left:6px solid ' + P.yellow + ';">' + _esc(text) + '</div>';
  }
  if (/^- /.test(text) && /^\s+/.test(line)) {
    return '<div style="' + base + 'font-size:16px;line-height:1.4;margin:0 0 2px 0;padding-left:42px;">' +
      _esc(text) + '</div>';
  }
  return '<div style="' + base + 'font-size:16px;line-height:1.4;margin:0 0 4px 0;padding-left:18px;">' +
    _esc(text) + '</div>';
}

/**
 * buildSharePage(record) -> string (a full HTML document).
 * The visible text is the receipt text of the record, one block per line, plus one footer line.
 * Every character of the text is escaped. Inline styles only. No script. No path, no environment
 * value, no record id, no hash.
 */
function buildSharePage(record) {
  const lines = renderReceipt(record).split('\n');
  const title = lines[0].trim();
  const body = lines.map(_lineHtml).join('\n');
  const P = DECK_PALETTE;
  return '<!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + _esc(title) + '</title>\n' +
    '</head>\n' +
    '<body style="margin:0;padding:0;background:' + P.cream + ';">\n' +
    '<div style="max-width:720px;margin:0 auto;padding:32px 20px 48px 20px;">\n' +
    body + '\n' +
    '<div style="font-family:Helvetica,Arial,sans-serif;font-size:13px;color:' + P.muted +
    ';margin:32px 0 0 0;padding-top:12px;border-top:2px solid ' + P.black + ';">' + _esc(FOOTER_TEXT) + '</div>\n' +
    '</div>\n' +
    '</body>\n' +
    '</html>\n';
}

function _checked(record) {
  const v = validateRecord(record);
  if (!v.ok) {
    const e = new Error('invalid_record: ' + v.code + ' at ' + v.field);
    e.code = 'invalid_record';
    throw e;
  }
}

/**
 * prepareCard(record, opts) -> { card_id, page_sha256, third_party, text, footer, note }
 * Throws an error with code invalid_record when the record fails validation.
 * Writes the pending file (hash and time only). Sends nothing.
 */
function prepareCard(record, opts) {
  _checked(record);
  const html = buildSharePage(record);
  const sha = pageHash(html);
  const dir = _pendingDir(opts);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  const tmp = path.join(dir, '.tmp-' + process.pid + '-' + crypto.randomBytes(4).toString('hex'));
  fs.writeFileSync(tmp, JSON.stringify({ page_sha256: sha, created_at: new Date().toISOString() }), { mode: 0o600 });
  fs.renameSync(tmp, path.join(dir, sha + '.json'));
  return {
    card_id: sha.slice(0, 12),
    page_sha256: sha,
    third_party: THIRD_PARTY,
    text: shareCardLines(record),
    footer: FOOTER_TEXT,
    note: CARD_NOTE.replace('<page_sha256>', sha),
  };
}

function _pendingValid(sha, opts) {
  try {
    const rec = JSON.parse(fs.readFileSync(path.join(_pendingDir(opts), sha + '.json'), 'utf8'));
    if (!rec || rec.page_sha256 !== sha) return false;
    const age = Date.now() - Date.parse(rec.created_at);
    return Number.isFinite(age) && age >= 0 && age <= PENDING_TTL_MS;
  } catch (_e) {
    return false;
  }
}

function _refused() {
  return {
    ok: false,
    error: 'card_required',
    hint: 'Run the card command, show the card to the person, then run send with the page hash of that card.',
  };
}

/**
 * send(record, confirm, opts) -> Promise<{ ok:true, result } | { ok:false, error:'card_required' }>
 * opts.home, opts.deploy (a stand-in for deployDeck, used by tests).
 */
async function send(record, confirm, opts) {
  if (typeof confirm !== 'string' || !HASH_RE.test(confirm)) return _refused();
  if (!validateRecord(record).ok) return _refused();
  const html = buildSharePage(record);
  const sha = pageHash(html);
  if (confirm !== sha) return _refused();
  if (!_pendingValid(sha, opts)) return _refused();
  // A confirmation is single use: delete it before the first network call.
  try {
    fs.unlinkSync(path.join(_pendingDir(opts), sha + '.json'));
  } catch (_e) {
    return _refused();
  }
  const deploy = (opts && typeof opts.deploy === 'function')
    ? opts.deploy
    : require('./mva-vercel-deploy.cjs').deployDeck;
  const result = await deploy(html, sha.slice(0, 8));
  return { ok: true, result };
}

module.exports = {
  FOOTER_TEXT,
  buildSharePage,
  shareCardLines,
  pageHash,
  prepareCard,
  send,
};
