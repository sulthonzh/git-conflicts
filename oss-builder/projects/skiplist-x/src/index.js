'use strict';

/**
 * skiplist-x — Zero-dep probabilistic skip list.
 *
 * O(log n) average-case search, insert, delete.
 * Each node gets a random height via geometric distribution (p=0.5).
 * Max height caps at 32 (enough for ~4 billion elements).
 *
 * @module skiplist-x
 */

// ─── Constants ──────────────────────────────────────────────
const MAX_LEVEL = 32;
const P = 0.5;

// ─── Node ───────────────────────────────────────────────────
class SkipNode {
  constructor(key, value, height) {
    this.key = key;
    this.value = value;
    /** @type {(SkipNode|null)[]} forward pointers per level */
    this.forward = new Array(height + 1).fill(null);
  }

  get level() {
    return this.forward.length - 1;
  }
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Default comparator for numbers.
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function defaultCompare(a, b) {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/**
 * Generate a random level using geometric distribution.
 * Mirrors Redis / William Pugh's reference implementation.
 * @returns {number} 0..MAX_LEVEL
 */
function randomLevel() {
  let level = 0;
  // Use a simple LCG seeded by Math.random for each call
  while (Math.random() < P && level < MAX_LEVEL) {
    level++;
  }
  return level;
}

// ─── SkipList ───────────────────────────────────────────────

/**
 * Probabilistic skip list supporting O(log n) operations.
 *
 * @example
 * const { SkipList } = require('skiplist-x');
 * const sl = new SkipList();
 * sl.insert(5, 'five');
 * sl.insert(1, 'one');
 * sl.search(5); // → 'five'
 * for (const [k, v] of sl) console.log(k, v); // 1 one / 5 five
 */
class SkipList {
  /**
   * @param {object} [opts]
   * @param {(a:*,b:*)=>number} [opts.compare] — comparator fn (default: numeric)
   * @param {number} [opts.maxLevel=32] — maximum node height
   * @param {number} [opts.p=0.5] — promotion probability
   */
  constructor(opts = {}) {
    this._compare = opts.compare || defaultCompare;
    this._maxLevel = opts.maxLevel || MAX_LEVEL;
    this._p = opts.p || P;
    this._head = new SkipNode(undefined, undefined, this._maxLevel);
    this._level = 0; // current highest node level in the list
    this._size = 0;
  }

  /**
   * Current number of elements.
   * @returns {number}
   */
  get size() {
    return this._size;
  }

  /**
   * True when the list holds zero elements.
   * @returns {boolean}
   */
  isEmpty() {
    return this._size === 0;
  }

  /**
   * Insert (or update) a key→value pair.
   * If the key already exists, its value is replaced.
   *
   * @param {*} key
   * @param {*} [value=true]
   * @returns {SkipList} this — chainable
   */
  insert(key, value = true) {
    const update = new Array(this._maxLevel + 1);
    let node = this._head;

    for (let i = this._level; i >= 0; i--) {
      while (node.forward[i] && this._compare(node.forward[i].key, key) < 0) {
        node = node.forward[i];
      }
      update[i] = node;
    }

    node = node.forward[0];

    // Update existing key
    if (node && this._compare(node.key, key) === 0) {
      node.value = value;
      return this;
    }

    // New node
    const lvl = this._randomLevel();
    if (lvl > this._level) {
      for (let i = this._level + 1; i <= lvl; i++) {
        update[i] = this._head;
      }
      this._level = lvl;
    }

    const newNode = new SkipNode(key, value, lvl);
    for (let i = 0; i <= lvl; i++) {
      newNode.forward[i] = update[i].forward[i];
      update[i].forward[i] = newNode;
    }

    this._size++;
    return this;
  }

  /**
   * Convenience alias for insert.
   * @param {*} key
   * @param {*} [value]
   * @returns {SkipList} this
   */
  set(key, value) {
    return this.insert(key, value);
  }

  /**
   * Look up the value associated with `key`.
   * @param {*} key
   * @returns {*} the stored value, or `undefined` when not found
   */
  search(key) {
    let node = this._head;
    for (let i = this._level; i >= 0; i--) {
      while (node.forward[i] && this._compare(node.forward[i].key, key) < 0) {
        node = node.forward[i];
      }
    }
    node = node.forward[0];
    if (node && this._compare(node.key, key) === 0) return node.value;
    return undefined;
  }

  /**
   * Convenience alias for search.
   * @param {*} key
   * @returns {*}
   */
  get(key) {
    return this.search(key);
  }

  /**
   * Check whether `key` exists in the list.
   * @param {*} key
   * @returns {boolean}
   */
  has(key) {
    return this.search(key) !== undefined;
  }

  /**
   * Remove the node with the given key.
   * @param {*} key
   * @returns {boolean} true when a node was removed, false when key not found
   */
  delete(key) {
    const update = new Array(this._maxLevel + 1);
    let node = this._head;

    for (let i = this._level; i >= 0; i--) {
      while (node.forward[i] && this._compare(node.forward[i].key, key) < 0) {
        node = node.forward[i];
      }
      update[i] = node;
    }

    node = node.forward[0];

    if (!node || this._compare(node.key, key) !== 0) return false;

    // Unlink at every level the node participates in
    for (let i = 0; i <= this._level; i++) {
      if (update[i].forward[i] !== node) break;
      update[i].forward[i] = node.forward[i];
    }

    // Lower the list's level if head now points to null
    while (this._level > 0 && !this._head.forward[this._level]) {
      this._level--;
    }

    this._size--;
    return true;
  }

  /**
   * Remove and return the value for `key`, or `undefined`.
   * @param {*} key
   * @returns {*}
   */
  pop(key) {
    const val = this.search(key);
    if (val === undefined) return undefined;
    this.delete(key);
    return val;
  }

  /**
   * Get the minimum (first) key in the list.
   * @returns {*|undefined}
   */
  minKey() {
    const node = this._head.forward[0];
    return node ? node.key : undefined;
  }

  /**
   * Get the maximum (last) key in the list.
   * Walk to the end of the top level then drop to level 0.
   * @returns {*|undefined}
   */
  maxKey() {
    let node = this._head;
    for (let i = this._level; i >= 0; i--) {
      while (node.forward[i]) node = node.forward[i];
    }
    // node is now the last real node or head when empty
    if (node === this._head) return undefined;
    return node.key;
  }

  /**
   * Return the [key, value] pair at logical index `idx` (0-based).
   * O(n) — useful but not the structure's strength.
   * @param {number} idx
   * @returns {[*, *]|undefined}
   */
  atIndex(idx) {
    if (idx < 0 || idx >= this._size) return undefined;
    let node = this._head.forward[0];
    for (let i = 0; i < idx && node; i++) node = node.forward[0];
    return node ? [node.key, node.value] : undefined;
  }

  /**
   * Collect all entries in the half-open range [low, high).
   * When `high` is omitted, collects [low, +∞).
   *
   * @example
   * sl.insertRange(5, 10); // entries with 5 ≤ key < 10
   *
   * @param {*} low
   * @param {*} [high]
   * @returns {Array<[*, *]>}
   */
  range(low, high) {
    const result = [];
    let node = this._head;

    // Search to the position of `low`
    for (let i = this._level; i >= 0; i--) {
      while (node.forward[i] && this._compare(node.forward[i].key, low) < 0) {
        node = node.forward[i];
      }
    }
    node = node.forward[0];

    while (node) {
      if (high !== undefined && this._compare(node.key, high) >= 0) break;
      result.push([node.key, node.value]);
      node = node.forward[0];
    }

    return result;
  }

  /**
   * Return all entries whose keys satisfy `predicate(key, value)`.
   * @param {(key:*, value:*)=>boolean} predicate
   * @returns {Array<[*, *]>}
   */
  filter(predicate) {
    const result = [];
    let node = this._head.forward[0];
    while (node) {
      if (predicate(node.key, node.value)) result.push([node.key, node.value]);
      node = node.forward[0];
    }
    return result;
  }

  /**
   * Visit every entry in ascending key order.
   * @param {(key:*, value:*)=>void} visitor — return `false` to stop
   */
  forEach(visitor) {
    let node = this._head.forward[0];
    while (node) {
      if (visitor(node.key, node.value) === false) break;
      node = node.forward[0];
    }
    return this;
  }

  /**
   * Map every entry to a new array.
   * @param {(key:*, value:*)=>*} mapper
   * @returns {Array}
   */
  map(mapper) {
    const result = [];
    let node = this._head.forward[0];
    while (node) {
      result.push(mapper(node.key, node.value));
      node = node.forward[0];
    }
    return result;
  }

  /**
   * Reduce entries to a single accumulated value.
   * @param {(acc:*, key:*, value:*)=>*} reducer
   * @param {*} initial
   * @returns {*}
   */
  reduce(reducer, initial) {
    let acc = initial;
    let node = this._head.forward[0];
    while (node) {
      acc = reducer(acc, node.key, node.value);
      node = node.forward[0];
    }
    return acc;
  }

  /**
   * Find the first entry where `predicate(key, value)` returns true.
   * @param {(key:*, value:*)=>boolean} predicate
   * @returns {[*, *]|undefined}
   */
  find(predicate) {
    let node = this._head.forward[0];
    while (node) {
      if (predicate(node.key, node.value)) return [node.key, node.value];
      node = node.forward[0];
    }
    return undefined;
  }

  /**
   * Return all entries as an array of [key, value] pairs.
   * @returns {Array<[*, *]>}
   */
  toArray() {
    const arr = [];
    let node = this._head.forward[0];
    while (node) {
      arr.push([node.key, node.value]);
      node = node.forward[0];
    }
    return arr;
  }

  /**
   * Return all keys in ascending order.
   * @returns {Array}
   */
  keys() {
    return this.map((k) => k);
  }

  /**
   * Return all values in key-ascending order.
   * @returns {Array}
   */
  values() {
    return this.map((_k, v) => v);
  }

  /**
   * Remove all entries.
   * @returns {SkipList} this
   */
  clear() {
    this._head = new SkipNode(undefined, undefined, this._maxLevel);
    this._level = 0;
    this._size = 0;
    return this;
  }

  // ─── Iterator ───────────────────────────────────────────

  /**
   * ES6 iterator — yields [key, value] pairs in ascending order.
   */
  *[Symbol.iterator]() {
    let node = this._head.forward[0];
    while (node) {
      yield [node.key, node.value];
      node = node.forward[0];
    }
  }

  /**
   * Iterator over entries (same as default iterator, for parity with Map).
   */
  *entries() {
    yield* this[Symbol.iterator]();
  }

  // ─── Serialization ──────────────────────────────────────

  /**
   * Serialize to a plain JSON-compatible object.
   * @returns {{ entries: Array<[*, *]>, maxLevel: number, p: number }}
   */
  toJSON() {
    return {
      entries: this.toArray(),
      maxLevel: this._maxLevel,
      p: this._p,
    };
  }

  /**
   * Reconstruct a SkipList from a toJSON() snapshot.
   * @param {{ entries: Array<[*, *]>, maxLevel?: number, p?: number }} json
   * @param {object} [opts] — overrides
   * @param {(a:*,b:*)=>number} [opts.compare]
   * @returns {SkipList}
   */
  static fromJSON(json, opts = {}) {
    const sl = new SkipList({
      maxLevel: json.maxLevel,
      p: json.p,
      compare: opts.compare,
    });
    for (const [k, v] of json.entries) sl.insert(k, v);
    return sl;
  }

  /**
   * Build a SkipList from any iterable of [key, value] pairs (or bare keys).
   * @param {Iterable<[*, *]|*>} iterable
   * @param {object} [opts]
   * @returns {SkipList}
   */
  static from(iterable, opts = {}) {
    const sl = new SkipList(opts);
    for (const item of iterable) {
      if (Array.isArray(item)) sl.insert(item[0], item[1]);
      else sl.insert(item);
    }
    return sl;
  }

  // ─── Introspection ──────────────────────────────────────

  /**
   * Current maximum level in use (≠ maxLevel cap).
   * @returns {number}
   */
  get currentLevel() {
    return this._level;
  }

  /**
   * Return a debug snapshot of node heights (level-0 walk).
   * Useful for verifying distribution health.
   * @returns {Array<{ key:*, level:number }>}
   */
  debugHeights() {
    const result = [];
    let node = this._head.forward[0];
    while (node) {
      result.push({ key: node.key, level: node.level });
      node = node.forward[0];
    }
    return result;
  }

  /**
   * Validate structural integrity — ensures keys are sorted at every level.
   * @returns {boolean}
   */
  isValid() {
    for (let i = this._level; i >= 0; i--) {
      let node = this._head.forward[i];
      if (!node) continue;
      let prev = node;
      node = node.forward[i];
      while (node) {
        if (this._compare(prev.key, node.key) >= 0) return false;
        prev = node;
        node = node.forward[i];
      }
    }
    return true;
  }

  // ─── Internal ───────────────────────────────────────────

  /**
   * @private
   */
  _randomLevel() {
    let lvl = 0;
    while (Math.random() < this._p && lvl < this._maxLevel) lvl++;
    return lvl;
  }
}

// ─── Default Export ────────────────────────────────────────

module.exports = { SkipList, defaultCompare, randomLevel };
module.exports.SkipList = SkipList;
module.exports.defaultCompare = defaultCompare;
module.exports.randomLevel = randomLevel;
