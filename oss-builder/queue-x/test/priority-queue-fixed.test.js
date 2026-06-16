import assert from 'node:assert';
import { PriorityQueue } from '../index.js';

// Test basic functionality
const pq = new PriorityQueue();
assert(pq.isEmpty, 'Priority queue should start empty');

// Test enqueue/dequeue with default comparator (min priority)
pq.enqueue(5);
pq.enqueue(1);
pq.enqueue(3);
pq.enqueue(2);
pq.enqueue(4);

assert(pq.size === 5, 'Priority queue size should be 5');

// Items should be dequeued in priority order (1, 2, 3, 4, 5)
assert(pq.dequeue() === 1, 'Dequeue should return highest priority (lowest number)');
assert(pq.dequeue() === 2, 'Second dequeue');
assert(pq.dequeue() === 3, 'Third dequeue');
assert(pq.dequeue() === 4, 'Fourth dequeue');
assert(pq.dequeue() === 5, 'Fifth dequeue');

assert(pq.isEmpty, 'Priority queue should be empty after dequeues');

// Test peek
const pq2 = new PriorityQueue({ iterable: [5, 1, 3] });
assert(pq2.peek() === 1, 'Peek should return highest priority item');

// Test custom comparator (max priority)
const maxPq = new PriorityQueue({
  comparator: (a, b) => a > b  // Changed to > for max priority
});

maxPq.enqueue(5);
maxPq.enqueue(1);
maxPq.enqueue(3);
maxPq.enqueue(2);
maxPq.enqueue(4);

assert(maxPq.size === 5, 'Max priority queue size should be 5');

// Items should be dequeued in max priority order (5, 4, 3, 2, 1)
assert(maxPq.dequeue() === 5, 'Max priority dequeue should return highest number');
assert(maxPq.dequeue() === 4, 'Second max dequeue');
assert(maxPq.dequeue() === 3, 'Third max dequeue');
assert(maxPq.dequeue() === 2, 'Fourth max dequeue');
assert(maxPq.dequeue() === 1, 'Fifth max dequeue');

// Test string comparison
const stringPq = new PriorityQueue({
  comparator: (a, b) => a.localeCompare(b) > 0  // Changed to return boolean
});

stringPq.enqueue('banana');
stringPq.enqueue('apple');
stringPq.enqueue('cherry');

assert(stringPq.dequeue() === 'apple', 'String comparison should work');
assert(stringPq.dequeue() === 'banana', 'Second string');
assert(stringPq.dequeue() === 'cherry', 'Third string');

// Test reverse comparator
const reversePq = new PriorityQueue({
  comparator: (a, b) => b.localeCompare(a) > 0  // Changed to return boolean
});

reversePq.enqueue('banana');
reversePq.enqueue('apple');
reversePq.enqueue('cherry');

assert(reversePq.dequeue() === 'cherry', 'Reverse string comparison should work');
assert(reversePq.dequeue() === 'banana', 'Second reverse string');
assert(reversePq.dequeue() === 'apple', 'Third reverse string');

console.log('✅ All priority queue tests passed!');