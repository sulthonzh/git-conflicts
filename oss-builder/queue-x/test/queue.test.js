// Basic Queue (FIFO) tests
import assert from 'node:assert';
import { Queue } from '../index.js';

// Test basic functionality
assert(typeof Queue === 'function', 'Queue should be a class');

const queue = new Queue();
assert(queue.isEmpty, 'New queue should be empty');
assert(queue.size === 0, 'New queue size should be 0');
assert(queue.peek() === undefined, 'Peek on empty queue should return undefined');

// Test enqueue/dequeue
queue.enqueue(1);
assert(queue.size === 1, 'Queue size should be 1 after enqueue');
assert(!queue.isEmpty, 'Queue should not be empty after enqueue');
assert(queue.peek() === 1, 'Peek should return the first item');

queue.enqueue(2);
queue.enqueue(3);
assert(queue.size === 3, 'Queue size should be 3');

assert(queue.dequeue() === 1, 'Dequeue should return items in FIFO order');
assert(queue.size === 2, 'Queue size should decrease after dequeue');
assert(queue.peek() === 2, 'Peek should return the new front item');

assert(queue.dequeue() === 2, 'Second dequeue');
assert(queue.dequeue() === 3, 'Third dequeue');
assert(queue.isEmpty, 'Queue should be empty after all dequeues');
assert(queue.dequeue() === undefined, 'Dequeue on empty queue should return undefined');

// Test constructor with iterable
const queue2 = new Queue([1, 2, 3]);
assert(queue2.size === 3, 'Queue should accept iterable constructor');
assert(queue2.toArray().join(',') === '1,2,3', 'Constructor should populate queue');
assert(queue2.peek() === 1, 'Peek should work on constructor');

// Test clear
queue2.clear();
assert(queue2.isEmpty, 'Clear should make queue empty');
assert(queue2.size === 0, 'Clear should reset size');

// Test toString
const queue3 = new Queue(['a', 'b', 'c']);
assert(queue3.toString() === 'Queue(a, b, c)', 'toString should format correctly');

// Test toJSON
assert(JSON.stringify(queue3) === '["a","b","c"]', 'toJSON should serialize correctly');

// Test static from
const queue4 = Queue.from([4, 5, 6]);
assert(queue4.size === 3, 'from should create queue from array');
assert(queue4.peek() === 4, 'from should work correctly');

// Test iteration
let items = [];
for (const item of queue2) {
  items.push(item);
}
assert(items.length === 0, 'Iteration on empty queue should produce nothing');

items = [];
for (const item of queue3) {
  items.push(item);
}
assert(items.join(',') === 'a,b,c', 'Iteration should work correctly');

// Test edge cases
const largeQueue = new Queue();
for (let i = 0; i < 1000; i++) {
  largeQueue.enqueue(i);
}
assert(largeQueue.size === 1000, 'Large queue should handle 1000 items');

for (let i = 0; i < 1000; i++) {
  assert(largeQueue.dequeue() === i, 'Large queue should dequeue in order');
}
assert(largeQueue.isEmpty, 'Large queue should be empty after dequeues');

console.log('✅ All Queue tests passed!');