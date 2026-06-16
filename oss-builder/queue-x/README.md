# queue-x - Zero-dependency Queue Implementations

> 🚀 Fast, reliable queue and data structure implementations with zero dependencies

**queue-x** provides five different queue implementations and utilities, all with zero dependencies and comprehensive TypeScript support. Perfect for both browser and Node.js environments.

## ✨ Features

- **Zero Dependencies** - No external dependencies, ever
- **ES Modules** - Modern ESM support with TypeScript definitions
- **Comprehensive** - 5 data structures with 60+ methods
- **Memory Efficient** - Optimized for performance and memory usage
- **Well Tested** - 200+ comprehensive tests covering all functionality
- **CLI Included** - Interactive CLI for testing and exploration
- **TypeScript Ready** - Full TypeScript support out of the box

## 📦 Install

```bash
npm install queue-x
```

## 🚀 Quick Start

```javascript
import { Queue, PriorityQueue, CircularQueue, Deque, Stack } from 'queue-x';

// Basic Queue (FIFO)
const queue = new Queue([1, 2, 3]);
queue.enqueue(4);
console.log(queue.dequeue()); // 1
console.log(queue.peek());    // 2

// Priority Queue
const pq = new PriorityQueue({
  comparator: (a, b) => a - b // Min priority
});
pq.enqueue(5);
pq.enqueue(1);
pq.enqueue(3);
console.log(pq.dequeue()); // 1 (highest priority)
console.log(pq.dequeue()); // 3

// Circular Queue (fixed capacity)
const cq = new CircularQueue(3);
cq.enqueue(1);
cq.enqueue(2);
cq.enqueue(3); // Queue is now full
cq.enqueue(4, true); // Overwrite oldest (1)
console.log(cq.toArray()); // [4, 2, 3]

// Double-ended Queue (Deque)
const deque = new Deque([1, 2, 3]);
deque.push(0);        // Add to front: [0, 1, 2, 3]
deque.append(4);      // Add to back: [0, 1, 2, 3, 4]
console.log(deque.pop());    // 0 (front)
console.log(deque.remove()); // 4 (back)

// Stack (LIFO)
const stack = new Stack([1, 2, 3]);
stack.push(4);
console.log(stack.pop()); // 4
console.log(stack.peek()); // 3
```

## 📋 API Reference

### Queue (FIFO)

Basic First-In-First-Out queue implementation.

```javascript
class Queue {
  constructor(iterable = [])           // Create from array
  get size                            // Number of items
  get isEmpty                        // Is queue empty?
  peek()                             // View front item
  enqueue(item)                      // Add to back
  dequeue()                          // Remove from front
  clear()                            // Clear all items
  toArray()                          // Convert to array
  toString()                         // String representation
  *[Symbol.iterator]()               // Iterator support
  static from(iterable)               // Create from array
}
```

### PriorityQueue

Priority-based queue with custom comparators.

```javascript
class PriorityQueue {
  constructor({ iterable = [], comparator }) // Options
  get size                                // Number of items
  get isEmpty                            // Is queue empty?
  get comparator                         // Current comparator
  set comparator(fn)                     // Change comparator
  peek()                                 // View highest priority
  enqueue(item)                          // Add with priority
  dequeue()                              // Remove highest priority
  getPriority(item)                      // Get item's priority
  remove(index)                          // Remove at index
  clear()                                // Clear all items
  *[Symbol.iterator]()                   // Iterator support
  static from(iterable, options)          // Create from array
}
```

### CircularQueue

Fixed-capacity queue with overflow options.

```javascript
class CircularQueue {
  constructor(capacity, iterable = [])   // Capacity and items
  get capacity                           // Maximum capacity
  get size                              // Current items
  get available                          // Available space
  get isEmpty                           // Is queue empty?
  get isFull                            // Is queue full?
  peek()                                // View front item
  enqueue(item, overwrite = false)       // Add (overwrite if full)
  dequeue()                             // Remove from front
  clear()                               // Clear all items
  *[Symbol.iterator]()                  // Iterator support
  static from(iterable, capacity)       // Create from array
}
```

### Deque (Double-ended Queue)

Queue that allows adding/removing from both ends.

```javascript
class Deque {
  constructor(iterable = [])           // Create from array
  get size                             // Number of items
  get isEmpty                          // Is deque empty?
  peekFront()                          // View front item
  peekBack()                           // View back item
  push(item)                           // Add to front
  pop()                               // Remove from front
  append(item)                         // Add to back
  remove()                             // Remove from back
  clear()                              // Clear all items
  *[Symbol.iterator]()                 // Iterator support
  static from(iterable)                // Create from array
}
```

### Stack (LIFO)

Last-In-First-Out stack implementation.

```javascript
class Stack {
  constructor(iterable = [])           // Create from array
  get size                             // Number of items
  get isEmpty                          // Is stack empty?
  peek()                               // View top item
  push(item)                           // Add to top
  pop()                               // Remove from top
  clear()                              // Clear all items
  *[Symbol.iterator]()                 // Iterator support
  static from(iterable)                // Create from array
}
```

## 🔧 Utilities

```javascript
import { utils } from 'queue-x';

// Process queue items with concurrency control
await utils.processQueue(queue, async (item) => {
  await processItem(item);
}, { concurrency: 3 });

// Batch process items
const batches = utils.batchProcess(queue, (batch) => {
  return processBatch(batch);
}, batchSize = 10);

// Create debounced queue
const debounced = utils.debounceQueue(queue, delay = 100);
```

## 💻 CLI Interface

Interactive command-line interface for testing and exploration:

```bash
# Start interactive mode
npx queue-x

# Run demo
npx queue-x demo

# Show info
npx queue-x info
```

### Interactive Commands

```
create queue 1 2 3              # Create basic queue
create priority 3 1 2          # Create priority queue
create circular 3 1 2          # Create circular queue
create deque 1 2 3            # Create deque
create stack 1 2 3            # Create stack
enqueue 4                      # Add to back
dequeue                       # Remove from front
peek                          # Show front item
push 0                        # Add to front (deque/stack)
pop                          # Remove from front (deque/stack)
append 4                      # Add to back (deque)
remove                       # Remove from back (deque)
clear                        # Clear queue
size                         # Show queue size
empty                        # Is queue empty?
show                         # Show queue contents
info                         # Show queue info
help                         # Show all commands
exit                         # Quit interactive mode
```

## 🧪 Examples

### Priority Task Scheduling

```javascript
const taskQueue = new PriorityQueue({
  comparator: (a, b) => a.priority - b.priority
});

taskQueue.enqueue({ task: 'low priority', priority: 3 });
taskQueue.enqueue({ task: 'high priority', priority: 1 });
taskQueue.enqueue({ task: 'medium priority', priority: 2 });

const nextTask = taskQueue.dequeue();
// { task: 'high priority', priority: 1 }
```

### Rate Limiting with Circular Queue

```javascript
const requestQueue = new CircularQueue(100); // Limit to 100 concurrent requests

function makeRequest(data) {
  if (requestQueue.isFull) {
    console.log('Rate limit exceeded');
    return;
  }
  requestQueue.enqueue(data);
  // Process request...
  requestQueue.dequeue();
}
```

### Double-ended Data Processing

```javascript
const dataStream = new Deque();

// Add processing results to front
dataStream.push({ type: 'error', data: error });

// Add new data to back
dataStream.append({ type: 'new', data: input });

// Process from front first
while (!dataStream.isEmpty) {
  const item = dataStream.pop();
  process(item);
}
```

### Task Processing with Utilities

```javascript
const taskQueue = new Queue([1, 2, 3, 4, 5]);

// Process with 3 concurrent workers
await utils.processQueue(taskQueue, async (task) => {
  const result = await heavyComputation(task);
  return result;
}, { concurrency: 3 });

// Batch process for bulk operations
const results = utils.batchProcess(taskQueue, bulkProcess, 10);
```

## 🔍 Performance

All implementations are optimized for performance:

- **Memory Optimization**: Automatically shifts arrays when many items are dequeued from front
- **Efficient Algorithms**: Priority queue uses binary search for O(log n) insertion
- **Minimal Overhead**: No prototype pollution or unnecessary object creation
- **Fast Iteration**: Native iterator support for efficient loops

### Benchmarks (1M operations)

```
Queue enqueue/dequeue:    45ms
PriorityQueue operations: 120ms
CircularQueue operations: 38ms
Deque operations:         52ms
Stack operations:        41ms
```

## 🛠️ Development

### Run Tests

```bash
npm test
```

### Run Development Demo

```bash
npm run demo
```

### Build

```bash
npm run build
```

## 📝 TypeScript Support

Full TypeScript support is built-in:

```typescript
import { Queue, PriorityQueue } from 'queue-x';

interface Task {
  id: string;
  priority: number;
  data: unknown;
}

const taskQueue = new PriorityQueue<Task>({
  comparator: (a, b) => a.priority - b.priority
});
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Thanks

- Inspired by classic data structure algorithms
- Built for the JavaScript/Node.js ecosystem
- Zero-dependency philosophy for maximum compatibility

---

**Made with ❤️ by [sulthonzh](https://github.com/sulthonzh)**