/**
 * MindrianOS Plugin -- Bounded LRU Cache
 * ======================================
 * Phase 87-07 (CASCADE-06). Hand-rolled doubly-linked list + Map so get, set,
 * has, and delete stay O(1) even when we need LRU promotion semantics. Exposes
 * Map-parity iteration (entries / keys / values / forEach / clear /
 * [Symbol.iterator]) so it is a drop-in replacement for `new Map()` at any
 * cache call site that iterates -- no conditional fork required.
 *
 * Zero runtime dependencies. ~90 lines. Reused across the 3 intelligence-cascade
 * caches (lastHsiByRoom, batchQueues, analyzeRoomCache) and available to future
 * plans that need a bounded cache in a long-running MCP process.
 *
 * Iteration walks MRU -> LRU and does NOT promote entries: reading via iterator
 * is not a "use" per LRU semantics, otherwise dashboards/debug-dumps would
 * scramble the eviction order.
 *
 * License: BSL 1.1 (Business Source License 1.1) -- see LICENSE.
 *
 * @module lru-cache
 */

'use strict';

class LRU {
  /**
   * @param {number} capacity Positive integer; max entries before LRU eviction.
   */
  constructor(capacity) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new Error('LRU capacity must be a positive integer');
    }
    this.capacity = capacity;
    this.map = new Map();
    this.head = null; // most recently used
    this.tail = null; // least recently used
  }

  _detach(node) {
    if (node.prev) node.prev.next = node.next; else this.head = node.next;
    if (node.next) node.next.prev = node.prev; else this.tail = node.prev;
    node.prev = node.next = null;
  }

  _attachHead(node) {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  get(key) {
    const node = this.map.get(key);
    if (!node) return undefined;
    this._detach(node);
    this._attachHead(node);
    return node.value;
  }

  has(key) { return this.map.has(key); }

  set(key, value) {
    let node = this.map.get(key);
    if (node) {
      node.value = value;
      this._detach(node);
      this._attachHead(node);
      return;
    }
    node = { key, value, prev: null, next: null };
    this._attachHead(node);
    this.map.set(key, node);
    if (this.map.size > this.capacity) {
      const evict = this.tail;
      this._detach(evict);
      this.map.delete(evict.key);
    }
  }

  delete(key) {
    const node = this.map.get(key);
    if (!node) return false;
    this._detach(node);
    this.map.delete(key);
    return true;
  }

  get size() { return this.map.size; }

  // --- Map-parity iteration (MRU-to-LRU order; does NOT promote) ---

  clear() {
    this.map.clear();
    this.head = null;
    this.tail = null;
  }

  *entries() {
    let n = this.head;
    while (n) {
      yield [n.key, n.value];
      n = n.next;
    }
  }

  *keys() {
    let n = this.head;
    while (n) {
      yield n.key;
      n = n.next;
    }
  }

  *values() {
    let n = this.head;
    while (n) {
      yield n.value;
      n = n.next;
    }
  }

  forEach(callback, thisArg) {
    if (typeof callback !== 'function') {
      throw new TypeError('forEach callback must be a function');
    }
    let n = this.head;
    while (n) {
      callback.call(thisArg, n.value, n.key, this);
      n = n.next;
    }
  }

  [Symbol.iterator]() {
    return this.entries();
  }
}

module.exports = { LRU };
