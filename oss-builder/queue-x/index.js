/**
 * Queue-x - Zero-dependency queue implementations
 * @module queue-x
 */

/**
 * Basic Queue (FIFO) implementation
 */
class Queue {
  #items = new Array();
  #head = 0;
  #size = 0;

  constructor(iterable = []) {
    if (iterable) {
      for (const item of iterable) {
        this.enqueue(item);
      }
    }
  }

  /** Number of items in the queue */
  get size() {
    return this.#size;
  }

  /** Is the queue empty? */
  get isEmpty() {
    return this.#size === 0;
  }

  /** Peek at the front item without removing it */
  peek() {
    if (this.isEmpty) return undefined;
    return this.#items[this.#head];
  }

  /** Add item to the back */
  enqueue(item) {
    this.#items[this.#head + this.#size] = item;
    this.#size++;
    return this;
  }

  /** Remove and return the front item */
  dequeue() {
    if (this.isEmpty) return undefined;
    const item = this.#items[this.#head];
    this.#head++;
    this.#size--;
    
    // Optimize array if we've dequeued many items
    if (this.#head > 1024 && this.#size < this.#head) {
      this.#items.splice(0, this.#head);
      this.#head = 0;
    }
    
    return item;
  }

  /** Clear the queue */
  clear() {
    this.#items = new Array();
    this.#head = 0;
    this.#size = 0;
    return this;
  }

  /** Convert to array */
  toArray() {
    return this.#items.slice(this.#head, this.#head + this.#size);
  }

  /** Iterate over items */
  *[Symbol.iterator]() {
    for (let i = this.#head; i < this.#head + this.#size; i++) {
      yield this.#items[i];
    }
  }

  /** String representation */
  toString() {
    return `Queue(${this.toArray().join(', ')})`;
  }

  /** JSON serialization */
  toJSON() {
    return this.toArray();
  }

  /** Create from array */
  static from(iterable) {
    return new Queue(iterable);
  }
}

/**
 * Priority Queue implementation with custom comparators
 */
class PriorityQueue {
  #items = new Array();
  #comparator = (a, b) => a < b;

  constructor({ iterable = [], comparator } = {}) {
    this.#comparator = comparator || this.#comparator;
    if (iterable) {
      for (const item of iterable) {
        this.enqueue(item);
      }
    }
  }

  /** Number of items in the queue */
  get size() {
    return this.#items.length;
  }

  /** Is the queue empty? */
  get isEmpty() {
    return this.#items.length === 0;
  }

  /** Peek at the front item (highest priority) without removing it */
  peek() {
    if (this.isEmpty) return undefined;
    // For max priority, we need to find the actual highest priority item
    return this.#items.reduce((max, item) => {
      return this.#comparator(item, max) ? item : max;
    }, this.#items[0]);
  }

  /** Get the comparator function */
  get comparator() {
    return this.#comparator;
  }

  /** Set the comparator function */
  set comparator(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('Comparator must be a function');
    }
    this.#comparator = fn;
    // Re-sort items when comparator changes
    this.#items.sort(this.#comparator);
  }

  /** Add item with priority */
  enqueue(item) {
    let left = 0;
    let right = this.#items.length;

    // Binary search for insertion position (using comparator for priority)
    while (left < right) {
      const mid = (left + right) >> 1;
      if (this.#comparator(item, this.#items[mid])) {
        // Item has higher priority than mid, belongs before it
        right = mid;
      } else {
        // Item has lower or equal priority, belongs after mid
        left = mid + 1;
      }
    }

    this.#items.splice(left, 0, item);
    return this;
  }

  /** Remove and return the highest priority item */
  dequeue() {
    if (this.isEmpty) return undefined;
    // Find the highest priority item (which may not be at index 0)
    let maxIndex = 0;
    for (let i = 1; i < this.#items.length; i++) {
      if (this.#comparator(this.#items[i], this.#items[maxIndex])) {
        maxIndex = i;
      }
    }
    return this.#items.splice(maxIndex, 1)[0];
  }

  /** Get the priority of an item */
  getPriority(item) {
    const index = this.#items.indexOf(item);
    return index === -1 ? -1 : index;
  }

  /** Remove item at specific index */
  remove(index) {
    if (index < 0 || index >= this.#items.length) return undefined;
    return this.#items.splice(index, 1)[0];
  }

  /** Clear the queue */
  clear() {
    this.#items.length = 0;
    return this;
  }

  /** Convert to array */
  toArray() {
    return [...this.#items];
  }

  /** Iterate over items in priority order */
  *[Symbol.iterator]() {
    for (const item of this.#items) {
      yield item;
    }
  }

  /** String representation */
  toString() {
    return `PriorityQueue(${this.#items.join(', ')})`;
  }

  /** JSON serialization */
  toJSON() {
    return this.toArray();
  }

  /** Create from array */
  static from(iterable, options = {}) {
    return new PriorityQueue({ iterable, ...options });
  }
}

/**
 * Circular Queue implementation with fixed capacity
 */
class CircularQueue {
  #capacity;
  #items = new Array();
  #head = 0;
  #tail = 0;
  #size = 0;

  constructor(capacity, iterable = []) {
    if (capacity <= 0) throw new RangeError('Capacity must be positive');
    this.#capacity = capacity;
    
    if (iterable) {
      for (const item of iterable) {
        this.enqueue(item);
      }
    }
  }

  /** Maximum capacity */
  get capacity() {
    return this.#capacity;
  }

  /** Number of items in the queue */
  get size() {
    return this.#size;
  }

  /** Available space */
  get available() {
    return this.#capacity - this.#size;
  }

  /** Is the queue empty? */
  get isEmpty() {
    return this.#size === 0;
  }

  /** Is the queue full? */
  get isFull() {
    return this.#size === this.#capacity;
  }

  /** Peek at the front item without removing it */
  peek() {
    if (this.isEmpty) return undefined;
    return this.#items[this.#head];
  }

  /** Add item to the back (overwrites if full) */
  enqueue(item, overwrite = false) {
    if (this.isFull) {
      if (overwrite) {
        // Store the oldest item's position
        const oldestPos = this.#head;
        // Move head to point to the next oldest item
        this.#head = (this.#head + 1) % this.#capacity;
        // Replace the oldest item with the new item at the tail position
        this.#items[this.#tail] = item;
        // Set head to the tail position to make the new item the oldest
        this.#head = this.#tail;
        // Move tail forward
        this.#tail = (this.#tail + 1) % this.#capacity;
        return this;
      }
      throw new Error('Queue is full (use overwrite=true to overwrite oldest)');
    }

    this.#items[this.#tail] = item;
    this.#tail = (this.#tail + 1) % this.#capacity;
    this.#size++;
    return this;
  }

  /** Remove and return the front item */
  dequeue() {
    if (this.isEmpty) return undefined;
    
    const item = this.#items[this.#head];
    this.#items[this.#head] = undefined; // Help GC
    this.#head = (this.#head + 1) % this.#capacity;
    this.#size--;
    return item;
  }

  /** Clear the queue */
  clear() {
    this.#items = new Array(this.#capacity);
    this.#head = 0;
    this.#tail = 0;
    this.#size = 0;
    return this;
  }

  /** Convert to array */
  toArray() {
    const result = new Array(this.#size);
    for (let i = 0; i < this.#size; i++) {
      result[i] = this.#items[(this.#head + i) % this.#capacity];
    }
    return result;
  }

  /** Iterate over items */
  *[Symbol.iterator]() {
    for (let i = 0; i < this.#size; i++) {
      yield this.#items[(this.#head + i) % this.#capacity];
    }
  }

  /** String representation */
  toString() {
    return `CircularQueue(${this.toArray().join(', ')})`;
  }

  /** JSON serialization */
  toJSON() {
    return this.toArray();
  }

  /** Create from array */
  static from(iterable, capacity) {
    return new CircularQueue(capacity, iterable);
  }
}

/**
 * Double-ended Queue (Deque) implementation
 */
class Deque {
  #items = new Array();
  #head = 0;
  #size = 0;

  constructor(iterable = []) {
    if (iterable) {
      for (const item of iterable) {
        this.push(item);
      }
    }
  }

  /** Number of items in the deque */
  get size() {
    return this.#size;
  }

  /** Is the deque empty? */
  get isEmpty() {
    return this.#size === 0;
  }

  /** Peek at the front item */
  peekFront() {
    if (this.isEmpty) return undefined;
    return this.#items[this.#head];
  }

  /** Peek at the back item */
  peekBack() {
    if (this.isEmpty) return undefined;
    return this.#items[this.#head + this.#size - 1];
  }

  /** Add item to the front */
  push(item) {
    if (this.#head > 0) {
      this.#items[--this.#head] = item;
    } else {
      this.#items.unshift(item);
      this.#head = 0;
    }
    this.#size++;
    return this;
  }

  /** Remove and return the front item */
  pop() {
    if (this.isEmpty) return undefined;
    const item = this.#items[this.#head];
    this.#items[this.#head] = undefined;
    this.#head++;
    this.#size--;
    
    // Optimize array if we've popped many from front
    if (this.#head > 1024 && this.#size < this.#head) {
      this.#items.splice(0, this.#head);
      this.#head = 0;
    }
    
    return item;
  }

  /** Add item to the back */
  append(item) {
    this.#items[this.#head + this.#size] = item;
    this.#size++;
    return this;
  }

  /** Remove and return the back item */
  remove() {
    if (this.isEmpty) return undefined;
    const item = this.#items[this.#head + this.#size - 1];
    this.#items[this.#head + this.#size - 1] = undefined;
    this.#size--;
    return item;
  }

  /** Clear the deque */
  clear() {
    this.#items = new Array();
    this.#head = 0;
    this.#size = 0;
    return this;
  }

  /** Convert to array */
  toArray() {
    return this.#items.slice(this.#head, this.#head + this.#size);
  }

  /** Iterate over items */
  *[Symbol.iterator]() {
    for (let i = this.#head; i < this.#head + this.#size; i++) {
      yield this.#items[i];
    }
  }

  /** String representation */
  toString() {
    return `Deque(${this.toArray().join(', ')})`;
  }

  /** JSON serialization */
  toJSON() {
    return this.toArray();
  }

  /** Create from array */
  static from(iterable) {
    return new Deque(iterable);
  }
}

/**
 * Stack (LIFO) implementation
 */
class Stack {
  #items = new Array();

  constructor(iterable = []) {
    if (iterable) {
      for (const item of iterable) {
        this.push(item);
      }
    }
  }

  /** Number of items in the stack */
  get size() {
    return this.#items.length;
  }

  /** Is the stack empty? */
  get isEmpty() {
    return this.#items.length === 0;
  }

  /** Peek at the top item without removing it */
  peek() {
    return this.isEmpty ? undefined : this.#items[this.#items.length - 1];
  }

  /** Add item to the top */
  push(item) {
    this.#items.push(item);
    return this;
  }

  /** Remove and return the top item */
  pop() {
    return this.isEmpty ? undefined : this.#items.pop();
  }

  /** Clear the stack */
  clear() {
    this.#items.length = 0;
    return this;
  }

  /** Convert to array */
  toArray() {
    return [...this.#items];
  }

  /** Iterate over items (bottom to top) */
  *[Symbol.iterator]() {
    for (const item of this.#items) {
      yield item;
    }
  }

  /** String representation */
  toString() {
    return `Stack(${this.#items.join(', ')})`;
  }

  /** JSON serialization */
  toJSON() {
    return this.toArray();
  }

  /** Create from array */
  static from(iterable) {
    return new Stack(iterable);
  }
}

/**
 * Factory functions for common queue types
 */
const createQueue = (iterable) => new Queue(iterable);
const createPriorityQueue = (options) => new PriorityQueue(options);
const createCircularQueue = (capacity, iterable) => new CircularQueue(capacity, iterable);
const createDeque = (iterable) => new Deque(iterable);
const createStack = (iterable) => new Stack(iterable);

/** Queue utilities */
const utils = {
  /** Process items with a function until the queue is empty */
  async processQueue(queue, processFn, { concurrency = 1 } = {}) {
    if (concurrency === 1) {
      while (!queue.isEmpty) {
        await processFn(queue.dequeue());
      }
    } else {
      const workers = [];
      for (let i = 0; i < concurrency; i++) {
        workers.push((async () => {
          while (!queue.isEmpty) {
            await processFn(queue.dequeue());
          }
        })());
      }
      await Promise.all(workers);
    }
  },

  /** Batch process items */
  batchProcess(queue, processFn, batchSize = 10) {
    const batches = [];
    const items = queue.toArray();
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches.map(batch => processFn(batch));
  },

  /** Create a queue with debounced operations */
  debounceQueue(queue, delay) {
    const result = new Queue();
    const debounceMap = new Map();

    const processItem = (item) => {
      const key = typeof item === 'object' ? JSON.stringify(item) : item;
      if (debounceMap.has(key)) {
        clearTimeout(debounceMap.get(key));
      }
      
      const timeout = setTimeout(() => {
        result.enqueue(item);
        debounceMap.delete(key);
      }, delay);
      
      debounceMap.set(key, timeout);
    };

    for (const item of queue) {
      processItem(item);
    }

    return result;
  }
};

/** Main exports */
export {
  Queue,
  PriorityQueue,
  CircularQueue,
  Deque,
  Stack,
  createQueue,
  createPriorityQueue,
  createCircularQueue,
  createDeque,
  createStack,
  utils
};

/** Default export */
export default {
  Queue,
  PriorityQueue,
  CircularQueue,
  Deque,
  Stack,
  createQueue,
  createPriorityQueue,
  createCircularQueue,
  createDeque,
  createStack,
  utils
};