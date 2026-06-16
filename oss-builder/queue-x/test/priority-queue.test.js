// PriorityQueue tests
import assert from 'node:assert';
import { PriorityQueue } from '../index.js';

// Test default behavior (min priority)
const pq = new PriorityQueue();
assert(pq.isEmpty, 'New priority queue should be empty');
assert(pq.size === 0, 'New priority queue size should be 0');

// Test enqueue/dequeue with default comparator
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
  comparator: (a, b) => b - a
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
  comparator: (a, b) => a.localeCompare(b)
});

stringPq.enqueue('banana');
stringPq.enqueue('apple');
stringPq.enqueue('cherry');

assert(stringPq.dequeue() === 'apple', 'String comparison should work');
assert(stringPq.dequeue() === 'banana', 'Second string');
assert(stringPq.dequeue() === 'cherry', 'Third string');

// Test reverse comparator
const reversePq = new PriorityQueue({
  comparator: (a, b) => b.localeCompare(a)
});

reversePq.enqueue('banana');
reversePq.enqueue('apple');
reversePq.enqueue('cherry');

assert(reversePq.dequeue() === 'cherry', 'Reverse string comparison');
assert(reversePq.dequeue() === 'banana', 'Second reverse string');
assert(reversePq.dequeue() === 'apple', 'Third reverse string');

// Test comparator setter
const pq3 = new PriorityQueue();
pq3.enqueue(5);
pq3.enqueue(1);
pq3.enqueue(3);

assert(pq3.dequeue() === 1, 'Default should be min priority');

// Change to max priority
pq3.comparator = (a, b) => b - a;
pq3.enqueue(2);
pq3.enqueue(4);

assert(pq3.dequeue() === 4, 'After changing comparator to max');
assert(pq3.dequeue() === 5, 'Second after max change');
assert(pq3.dequeue() === 3, 'Third after max change');
assert(pq3.dequeue() === 2, 'Fourth after max change');

// Test getPriority
const pq4 = new PriorityQueue([3, 1, 2]);
assert(pq4.getPriority(1) === 0, 'Priority 1 should be at index 0');
assert(pq4.getPriority(2) === 1, 'Priority 2 should be at index 1');
assert(pq4.getPriority(3) === 2, 'Priority 3 should be at index 2');
assert(pq4.getPriority(4) === -1, 'Non-existent item should return -1');

// Test remove
const pq5 = new PriorityQueue([5, 1, 3, 2, 4]);
const removed = pq5.remove(1); // Remove item with value 1
assert(removed === 1, 'Remove should return removed item');
assert(pq5.size === 4, 'Size should decrease after remove');
assert(pq5.peek() === 2, 'New front should be 2');

// Test clear
pq5.clear();
assert(pq5.isEmpty, 'Clear should make queue empty');

// Test toString
const pq6 = new PriorityQueue([3, 1, 2]);
assert(pq6.toString() === 'PriorityQueue(1, 2, 3)', 'toString should show priority order');

// Test toJSON
assert(JSON.stringify(pq6) === '[1,2,3]', 'toJSON should serialize in priority order');

// Test static from
const pq7 = PriorityQueue.from([5, 1, 3]);
assert(pq7.size === 3, 'from should work with priority queue');
assert(pq7.peek() === 1, 'from should respect priority order');

// Test with custom comparator in from
const pq8 = PriorityQueue.from([5, 1, 3], {
  comparator: (a, b) => b - a
});
assert(pq8.peek() === 5, 'from should accept custom comparator');

// Test iteration
const pq9 = new PriorityQueue({ iterable: [3, 1, 2] });
let items = [];
for (const item of pq9) {
  items.push(item);
}
assert(items.join(',') === '1,2,3', 'Iteration should be in priority order');

// Test edge cases
// Empty queue edge case
const emptyPq = new PriorityQueue();
assert(emptyPq.peek() === undefined, 'Peek on empty should be undefined');
assert(emptyPq.dequeue() === undefined, 'Dequeue on empty should be undefined');

// Single item
const singlePq = new PriorityQueue([42]);
assert(singlePq.peek() === 42, 'Single item peek');
assert(singlePq.dequeue() === 42, 'Single item dequeue');
assert(singlePq.isEmpty, 'Should be empty after dequeue');

// Duplicate items
const duplicatePq = new PriorityQueue([1, 1, 2, 2]);
assert(duplicatePq.size === 4, 'Should handle duplicates');
assert(duplicatePq.dequeue() === 1, 'First dequeue');
assert(duplicatePq.dequeue() === 1, 'Second dequeue (duplicate)');
assert(duplicatePq.dequeue() === 2, 'Third dequeue');
assert(duplicatePq.dequeue() === 2, 'Fourth dequeue (duplicate)');

console.log('✅ All PriorityQueue tests passed!');