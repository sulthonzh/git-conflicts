// Double-ended Queue (Deque) tests
import assert from 'node:assert';
import { Deque } from '../index.js';

// Test basic functionality
const deque = new Deque();
assert(deque.isEmpty, 'New deque should be empty');
assert(deque.size === 0, 'New deque size should be 0');
assert(deque.peekFront() === undefined, 'Peek front on empty should be undefined');
assert(deque.peekBack() === undefined, 'Peek back on empty should be undefined');

// Test push/pop (front operations)
deque.push(1);
assert(deque.size === 1, 'Size should be 1 after push');
assert(deque.peekFront() === 1, 'Peek front should return 1');
assert(deque.peekBack() === 1, 'Peek back should return 1');

deque.push(2);
assert(deque.size === 2, 'Size should be 2');
assert(deque.peekFront() === 2, 'Peek front should return 2 (newest at front)');
assert(deque.peekBack() === 1, 'Peek back should return 1 (oldest at back)');

assert(deque.pop() === 2, 'Pop should remove from front');
assert(deque.size === 1, 'Size should decrease');
assert(deque.peekFront() === 1, 'Peek front should return remaining item');
assert(deque.peekBack() === 1, 'Peek back should return remaining item');

// Test append/remove (back operations)
deque.append(3);
assert(deque.size === 2, 'Size should be 2 after append');
assert(deque.peekFront() === 1, 'Front should still be 1');
assert(deque.peekBack() === 3, 'Back should be 3');

deque.append(4);
assert(deque.size === 3, 'Size should be 3');
assert(deque.peekFront() === 1, 'Front should still be 1');
assert(deque.peekBack() === 4, 'Back should be 4');

assert(deque.remove() === 4, 'Remove should remove from back');
assert(deque.size === 2, 'Size should decrease');
assert(deque.peekBack() === 3, 'Back should be 3');

// Test mixed operations
deque.push(5); // Add to front: [5, 1, 3]
assert(deque.peekFront() === 5, 'Front should be 5');
assert(deque.peekBack() === 3, 'Back should be 3');

deque.append(6); // Add to back: [5, 1, 3, 6]
assert(deque.size === 4, 'Size should be 4');
assert(deque.peekFront() === 5, 'Front should still be 5');
assert(deque.peekBack() === 6, 'Back should be 6');

// Test interleaved pop and remove
deque.pop(); // Remove 5: [1, 3, 6]
deque.remove(); // Remove 6: [1, 3]
assert(deque.size === 2, 'Size should be 2');
assert(deque.peekFront() === 1, 'Front should be 1');
assert(deque.peekBack() === 3, 'Back should be 3');

// Test constructor with iterable
const deque2 = new Deque([1, 2, 3]);
assert(deque2.size === 3, 'Constructor should populate from iterable');
assert(deque2.peekFront() === 1, 'Front should be first item');
assert(deque2.peekBack() === 3, 'Back should be last item');

// Test clear
deque2.clear();
assert(deque2.isEmpty, 'Clear should make deque empty');
assert(deque2.size === 0, 'Clear should reset size');

// Test toString
const deque3 = new Deque(['a', 'b', 'c']);
assert(deque3.toString() === 'Deque(a, b, c)', 'ToString should format correctly');

// Test toJSON
assert(JSON.stringify(deque3) === '["a","b","c"]', 'ToJSON should serialize correctly');

// Test static from
const deque4 = Deque.from([4, 5, 6]);
assert(deque4.size === 3, 'From should create deque from array');
assert(deque4.peekFront() === 4, 'From should work correctly');

// Test iteration
const deque5 = new Deque([1, 2, 3]);
let items = [];
for (const item of deque5) {
  items.push(item);
}
assert(items.join(',') === '1,2,3', 'Iteration should be in order');

// Test edge cases
// Empty deque
const emptyDeque = new Deque();
assert(emptyDeque.peekFront() === undefined, 'Peek front on empty');
assert(emptyDeque.peekBack() === undefined, 'Peek back on empty');
assert(emptyDeque.pop() === undefined, 'Pop on empty');
assert(emptyDeque.remove() === undefined, 'Remove on empty');

// Single item
const singleDeque = new Deque([42]);
assert(singleDeque.peekFront() === 42, 'Single item front');
assert(singleDeque.peekBack() === 42, 'Single item back');
assert(singleDeque.pop() === 42, 'Pop single item');
assert(singleDeque.isEmpty, 'Should be empty');
assert(singleDeque.remove() === undefined, 'Remove on empty');

// Test large deque
const largeDeque = new Deque();
for (let i = 0; i < 1000; i++) {
  largeDeque.append(i);
}
assert(largeDeque.size === 1000, 'Should handle 1000 items');

// Test pop from large deque
for (let i = 0; i < 1000; i++) {
  assert(largeDeque.pop() === i, 'Should pop in forward order');
}
assert(largeDeque.isEmpty, 'Should be empty');

// Test with different data types
const mixedDeque = new Deque();
mixedDeque.push('string');
mixedDeque.append(42);
mixedDeque.push(true);
mixedDeque.append([1, 2, 3]);

assert(mixedDeque.size === 4, 'Should handle mixed types');
assert(mixedDeque.peekFront() === true, 'Front should be boolean');
assert.deepEqual(mixedDeque.peekBack(), [1, 2, 3], 'Back should be array');

// Test sequential operations that would cause memory optimization
const deque6 = new Deque();
// Add many items to trigger memory optimization
for (let i = 0; i < 2000; i++) {
  deque6.push(i);
}
for (let i = 0; i < 1000; i++) {
  deque6.pop();
}
assert(deque6.size === 1000, 'Should handle optimization scenario');
assert(deque6.peekFront() === 999, 'Should maintain order after optimization');

// Test front operations remain consistent
const deque7 = new Deque([1, 2, 3]);
deque7.push(0); // Add to front
assert(deque7.peekFront() === 0, 'Front should be new item');
assert(deque7.peekBack() === 3, 'Back should remain unchanged');

deque7.pop(); // Remove from front
assert(deque7.peekFront() === 1, 'Front should be next item');

// Test back operations remain consistent
deque7.append(4); // Add to back
assert(deque7.peekBack() === 4, 'Back should be new item');
assert(deque7.peekFront() === 1, 'Front should remain unchanged');

deque7.remove(); // Remove from back
assert(deque7.peekBack() === 3, 'Back should be previous item');

console.log('✅ All Deque tests passed!');