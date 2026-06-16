// Stack (LIFO) tests
import assert from 'node:assert';
import { Stack } from '../index.js';

// Test basic functionality
const stack = new Stack();
assert(stack.isEmpty, 'New stack should be empty');
assert(stack.size === 0, 'New stack size should be 0');
assert(stack.peek() === undefined, 'Peek on empty stack should return undefined');

// Test push/pop operations
stack.push(1);
assert(stack.size === 1, 'Size should be 1 after push');
assert(!stack.isEmpty, 'Stack should not be empty');
assert(stack.peek() === 1, 'Peek should return the top item');

stack.push(2);
stack.push(3);
assert(stack.size === 3, 'Size should be 3');
assert(stack.peek() === 3, 'Peek should return the most recently pushed item');

// Test pop (LIFO order)
assert(stack.pop() === 3, 'Pop should return most recently pushed item');
assert(stack.size === 2, 'Size should decrease');
assert(stack.peek() === 2, 'Peek should return new top item');

assert(stack.pop() === 2, 'Second pop');
assert(stack.pop() === 1, 'Third pop');
assert(stack.isEmpty, 'Stack should be empty after pops');
assert(stack.pop() === undefined, 'Pop on empty stack should return undefined');

// Test constructor with iterable
const stack2 = new Stack([1, 2, 3]);
assert(stack2.size === 3, 'Constructor should populate from iterable');
assert(stack2.peek() === 3, 'Peek should return last item from iterable');

// Test clear
stack2.clear();
assert(stack2.isEmpty, 'Clear should make stack empty');
assert(stack2.size === 0, 'Clear should reset size');

// Test toString
const stack3 = new Stack(['a', 'b', 'c']);
assert(stack3.toString() === 'Stack(a, b, c)', 'ToString should format correctly');

// Test toJSON
assert(JSON.stringify(stack3) === '["a","b","c"]', 'ToJSON should serialize correctly');

// Test static from
const stack4 = Stack.from([4, 5, 6]);
assert(stack4.size === 3, 'From should create stack from array');
assert(stack4.peek() === 6, 'From should respect LIFO order');

// Test iteration
const stack5 = new Stack([1, 2, 3]);
let items = [];
for (const item of stack5) {
  items.push(item);
}
assert(items.join(',') === '1,2,3', 'Iteration should be in push order (bottom to top)');

// Test edge cases
// Empty stack
const emptyStack = new Stack();
assert(emptyStack.peek() === undefined, 'Peek on empty');
assert(emptyStack.pop() === undefined, 'Pop on empty');

// Single item
const singleStack = new Stack([42]);
assert(singleStack.peek() === 42, 'Single item peek');
assert(singleStack.pop() === 42, 'Single item pop');
assert(singleStack.isEmpty, 'Should be empty');

// Test with different data types
const mixedStack = new Stack();
mixedStack.push('string');
mixedStack.push(42);
mixedStack.push(true);
mixedStack.push([1, 2, 3]);

assert(mixedStack.size === 4, 'Should handle mixed types');
assert.deepEqual(mixedStack.peek(), [1, 2, 3], 'Peek should return top item');

// Test pop order
assert.deepEqual(mixedStack.pop(), [1, 2, 3], 'First pop');
assert(mixedStack.pop() === true, 'Second pop');
assert(mixedStack.pop() === 42, 'Third pop');
assert(mixedStack.pop() === 'string', 'Fourth pop');
assert(mixedStack.isEmpty, 'Should be empty');

// Test large stack
const largeStack = new Stack();
for (let i = 0; i < 1000; i++) {
  largeStack.push(i);
}
assert(largeStack.size === 1000, 'Should handle 1000 items');

// Test pop from large stack
for (let i = 999; i >= 0; i--) {
  assert(largeStack.pop() === i, 'Should pop in reverse order');
}
assert(largeStack.isEmpty, 'Should be empty');

// Test chainable operations
const stack6 = new Stack();
stack6.push(1).push(2).push(3);
assert(stack6.size === 3, 'Chainable push should work');
assert(stack6.peek() === 3, 'Chainable push should maintain order');

stack6.pop();
stack6.pop();
assert(stack6.size === 1, 'Multiple pops should work');
assert(stack6.peek() === 1, 'Chainable pop should maintain order');

// Test sequential operations that might trigger memory optimization
const stack7 = new Stack();
// Push many items to potentially trigger optimization
for (let i = 0; i < 2000; i++) {
  stack7.push(i);
}
// Pop half of them
for (let i = 0; i < 1000; i++) {
  stack7.pop();
}
assert(stack7.size === 1000, 'Should handle optimization scenario');
assert(stack7.peek() === 999, 'Should maintain order');

// Test stack behavior with strings
const stringStack = new Stack();
stringStack.push('world');
stringStack.push('hello');
assert(stringStack.peek() === 'hello', 'String stack should work');
assert(stringStack.pop() === 'hello', 'String pop should work');
assert(stringStack.pop() === 'world', 'Second string pop');

// Test stack with objects
const objStack = new Stack();
const obj1 = { id: 1, name: 'first' };
const obj2 = { id: 2, name: 'second' };
objStack.push(obj1);
objStack.push(obj2);
assert(objStack.peek() === obj2, 'Object stack should work');
assert(objStack.pop() === obj2, 'Object pop should work');
assert(objStack.pop() === obj1, 'Second object pop');

console.log('✅ All Stack tests passed!');