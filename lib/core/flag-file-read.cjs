'use strict';

/*
 * Quick 261127-bnd follow-up: the one read rule of a file flag (--name-file,
 * --text-file, --topic-file, --header-file, --file and the others). An
 * instruction line gives a person's text to a script as a file path, so the
 * reader is the only part that touches the bytes. The rule:
 *
 *   (a) The path must name a regular file. A symlink to a regular file stays
 *       allowed (the behaviour of the first cut: it used statSync, which follows
 *       a link). A FIFO, a directory or a device is refused, and the open uses
 *       O_NONBLOCK so a FIFO swapped in after the check cannot make the read hang.
 *       The open file is checked again with fstat.
 *   (b) The reader reads at most maxBytes + 1 bytes from the open file and
 *       refuses more than maxBytes. It never trusts the stat size: a pseudo-file
 *       such as /proc/kallsyms has a stat size of 0 and holds megabytes.
 *   (c) So the time of a read does not grow with the file size beyond the cap.
 *   (d) A NUL byte is refused.
 *   (e) The caller prints the refusal in the existing form of its script, before
 *       any write. This module writes nothing and prints nothing.
 *
 * readFlagFileBytes(p, maxBytes) -> { ok: true, bytes } | { ok: false, reason }
 *   reason: 'unreadable' | 'not_regular_file' | 'too_large' | 'nul_byte'
 * readFlagFileText(p, maxBytes) -> { ok: true, text } | { ok: false, reason }
 *   The text is UTF-8 with one byte order mark removed. 'empty' is not a
 *   reason here: each caller keeps its own rule for an empty text.
 *
 * Node built-in modules only. No em dash, no en dash.
 */

const fs = require('fs');

const FLAG_FILE_MAX_BYTES = 65536;

function refuse(reason) { return { ok: false, reason }; }

function readFlagFileBytes(p, maxBytes) {
  const max = Number.isInteger(maxBytes) && maxBytes > 0 ? maxBytes : FLAG_FILE_MAX_BYTES;
  if (typeof p !== 'string' || p === '' || p.indexOf('\u0000') !== -1) return refuse('unreadable');
  let st;
  try { st = fs.statSync(p); } catch (_e) { return refuse('unreadable'); }
  if (!st.isFile()) return refuse('not_regular_file');
  const c = fs.constants || {};
  const flags = (c.O_RDONLY || 0) | (c.O_NONBLOCK || 0) | (c.O_NOCTTY || 0);
  let fd;
  try { fd = fs.openSync(p, flags); } catch (_e) { return refuse('unreadable'); }
  try {
    if (!fs.fstatSync(fd).isFile()) return refuse('not_regular_file');
    const buf = Buffer.alloc(max + 1);
    let got = 0;
    while (got < buf.length) {
      const n = fs.readSync(fd, buf, got, buf.length - got, null);
      if (n === 0) break;
      got += n;
    }
    if (got > max) return refuse('too_large');
    const bytes = buf.subarray(0, got);
    if (bytes.indexOf(0) !== -1) return refuse('nul_byte');
    return { ok: true, bytes };
  } catch (_e) {
    return refuse('unreadable');
  } finally {
    try { fs.closeSync(fd); } catch (_e) { /* the read result stands */ }
  }
}

function readFlagFileText(p, maxBytes) {
  const r = readFlagFileBytes(p, maxBytes);
  if (!r.ok) return r;
  let text = r.bytes.toString('utf8');
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  return { ok: true, text };
}

module.exports = { FLAG_FILE_MAX_BYTES, readFlagFileBytes, readFlagFileText };
