// CircularQueue tests
import assert from 'node:assert';
import { CircularQueue } from '../index.js';

// Test basic functionality
const cq = new CircularQueue(3);
assert(cq.capacity === 3, 'Capacity should be set');
assert(cq.isEmpty, 'New queue should be empty');
assert(cq.size === 0, 'New queue size should be 0');
assert(cq.available === 3, 'Available space should be capacity');

// Test enqueue/dequeue
cq.enqueue(1);
assert(cq.size === 1, 'Size should be 1 after enqueue');
assert(cq.peek() === 1, 'Peek should return first item');

cq.enqueue(2);
cq.enqueue(3);
assert(cq.size === 3, 'Size should be at capacity');
assert(cq.isFull, 'Queue should be full');

// Test dequeue
assert(cq.dequeue() === 1, 'Dequeue should return items in order');
assert(cq.size === 2, 'Size should decrease');
assert(cq.available === 1, 'Available space should increase');
assert(!cq.isFull, 'Should not be full after dequeue');

assert(cq.dequeue() === 2, 'Second dequeue');
assert(cq.dequeue() === 3, 'Third dequeue');
assert(cq.isEmpty, 'Should be empty after dequeues');
assert(cq.available === 3, 'All space should be available');

// Test constructor with iterable
const cq2 = new CircularQueue(3, [1, 2]);
assert(cq2.size === 2, 'Constructor should populate from iterable');
assert(cq2.peek() === 1, 'Constructor should work correctly');

// Test wraparound behavior
cq2.enqueue(3);
assert(cq2.isFull, 'Should be full');
assert(cq2.toArray().join(',') === '1,2,3', 'Array should show all items');

const removed = cq2.dequeue();
assert(removed === 1, 'Dequeue should work with wraparound');
assert(cq2.toArray().join(',') === '2,3', 'Should maintain order');

// Test overwrite behavior
const cq3 = new CircularQueue(2, [1, 2]);
cq3.enqueue(3, true); // Should overwrite oldest
assert(cq3.size === 2, 'Size should remain capacity');
assert(cq3.toArray().join(',') === '3,2', 'Should overwrite oldest');

// Test overwrite when not full
const cq4 = new CircularQueue(3, [1, 2]);
cq4.enqueue(3); // Normal enqueue (no overwrite)
assert(cq4.toArray().join(',') === '1,2,3', 'Should add to back');
cq4.enqueue(4, true); // Now overwrite oldest
assert(cq4.toArray().join(',') === '4,2,3', 'Should overwrite 1');

// Test error when full without overwrite
const cq5 = new CircularQueue(1, [1]);
assert.throws(() => cq5.enqueue(2), /Queue is full/, 'Should throw when full and no overwrite');

// Test clear
cq5.clear();
assert(cq5.isEmpty, 'Clear should make queue empty');
assert(cq5.size === 0, 'Clear should reset size');
assert(cq5.available === 1, 'Clear should reset available space');

// Test toString
const cq6 = new CircularQueue(3, [1, 2, 3]);
assert(cq6.toString() === 'CircularQueue(1, 2, 3)', 'ToString should format correctly');

// Test toJSON
assert(JSON.stringify(cq6) === '[1,2,3]', 'ToJSON should serialize correctly');

// Test static from
const cq7 = CircularQueue.from([1, 2, 3], 3);
assert(cq7.size === 3, 'From should create circular queue');
assert(cq7.capacity === 3, 'From should set capacity');

// Test iteration
const cq8 = new CircularQueue(3, [1, 2, 3]);
let items = [];
for (const item of cq8) {
  items.push(item);
}
assert(items.join(',') === '1,2,3', 'Iteration should work');

// Test edge cases
// Single capacity queue
const singleCq = new CircularQueue(1);
singleCq.enqueue(1);
assert(singleCq.peek() === 1, 'Single item queue');
assert(singleCq.dequeue() === 1, 'Single item dequeue');
assert(singleCq.isEmpty, 'Should be empty');

// Large capacity
const largeCq = new CircularQueue(1000);
for (let i = 0; i < 500; i++) {
  largeCq.enqueue(i);
}
assert(largeCq.size === 500, 'Should handle large capacity');

for (let i = 0; i < 500; i++) {
  assert(largeCq.dequeue() === i, 'Should dequeue in order');
}
assert(largeCq.isEmpty, 'Should be empty after dequeues');

// Test with negative capacity
assert.throws(() => new CircularQueue(-1), /Capacity must be positive/, 'Should throw for negative capacity');

// Test with zero capacity
assert.throws(() => new CircularQueue(0), /Capacity must be positive/, 'Should throw for zero capacity');

// Test wraparound with multiple dequeues and enqueues
const cq9 = new CircularQueue(3);
cq9.enqueue(1);
cq9.enqueue(2);
cq9.enqueue(3);

cq9.dequeue(); // Remove 1
cq9.enqueue(4); // Should go at position 1
assert(cq9.toArray().join(',') === '2,3,4', 'Should wraparound correctly');

cq9.dequeue(); // Remove 2
cq9.enqueue(5); // Should go at position 2
assert(cq9.toArray().join(',') === '3,4,5', 'Should continue wraparound');

// Test peek with wraparound
assert(cq9.peek() === 3, 'Peek should work with wraparound');

// Test available space after partial operations
const cq10 = new CircularQueue(5);
cq10.enqueue(1);
assert(cq10.available === 4, 'Should calculate available space correctly');
cq10.enqueue(2);
cq10.enqueue(3);
assert(cq10.available === 2, 'Should track available space with partial fill');
cq10.dequeue();
assert(cq10.available === 3, 'Should increase available space after dequeue');

console.log('✅ All CircularQueue tests passed!');