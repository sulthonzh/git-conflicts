#!/usr/bin/env node

/**
 * Queue-x CLI - Command line interface for queue operations
 */

import {
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
} from './index.js';
import { spawn } from 'child_process';

const commands = {
  demo: async () => {
    console.log('🚀 Queue-x Demo');
    console.log('='.repeat(50));

    // Basic Queue
    console.log('\n📋 Basic Queue (FIFO):');
    const queue = createQueue([1, 2, 3]);
    console.log('Created:', queue.toString());
    console.log('Enqueue 4:', queue.enqueue(4).toString());
    console.log('Dequeue:', queue.dequeue(), '→', queue.toString());
    console.log('Peek:', queue.peek());

    // Priority Queue
    console.log('\n🏆 Priority Queue (numbers, min priority):');
    const pq = createPriorityQueue({
      comparator: (a, b) => a - b
    });
    [5, 2, 8, 1, 3].forEach(n => pq.enqueue(n));
    console.log('Added 5,2,8,1,3:', pq.toString());
    while (!pq.isEmpty) {
      console.log('Dequeue:', pq.dequeue(), '→', pq.toString());
    }

    // Custom Priority Queue (strings by length)
    console.log('\n📝 Priority Queue (strings by length):');
    const stringPQ = createPriorityQueue({
      comparator: (a, b) => a.length - b.length
    });
    ['apple', 'banana', 'kiwi', 'strawberry'].forEach(s => stringPQ.enqueue(s));
    console.log('Added fruits:', stringPQ.toString());
    while (!stringPQ.isEmpty) {
      console.log('Dequeue:', stringPQ.dequeue(), '→', stringPQ.toString());
    }

    // Circular Queue
    console.log('\n⭕ Circular Queue (capacity=3):');
    const cq = createCircularQueue(3, [1, 2]);
    console.log('Created (capacity=3):', cq.toString());
    console.log('Enqueue 3:', cq.enqueue(3).toString());
    console.log('Enqueue 4 (overwrite):', cq.enqueue(4, true).toString());
    console.log('Enqueue 5:', cq.enqueue(5, true).toString());
    console.log('Available space:', cq.available);

    // Deque
    console.log('\n🔀 Double-ended Queue (Deque):');
    const deque = createDeque([1, 2, 3]);
    console.log('Created:', deque.toString());
    console.log('Push 0 (front):', deque.push(0).toString());
    console.log('Append 4 (back):', deque.append(4).toString());
    console.log('Pop (front):', deque.pop(), '→', deque.toString());
    console.log('Remove (back):', deque.remove(), '→', deque.toString());

    // Stack
    console.log('\n📦 Stack (LIFO):');
    const stack = createStack([1, 2, 3]);
    console.log('Created:', stack.toString());
    console.log('Push 4:', stack.push(4).toString());
    console.log('Pop:', stack.pop(), '→', stack.toString());
    console.log('Peek:', stack.peek());

    // Utils Demo
    console.log('\n🔧 Utils Demo:');
    const demoQueue = createQueue([1, 2, 3, 4, 5]);
    console.log('Original queue:', demoQueue.toArray());

    const batches = utils.batchProcess(demoQueue, (batch) => {
      console.log('Processing batch:', batch);
      return batch.map(n => n * 2);
    }, 2);
    console.log('Batch results:', batches);

    console.log('\n✅ Demo complete!');
  },

  info: () => {
    console.log('📊 Queue-x Information');
    console.log('='.repeat(50));
    console.log('Name: queue-x');
    console.log('Description: Zero-dependency queue implementations');
    console.log('Version: 1.0.0');
    console.log('Size: ~4KB minified');
    console.log('Dependencies: 0');
    console.log('Node.js: >=18.0.0');
    console.log('');
    console.log('Available Classes:');
    console.log('  Queue - FIFO queue');
    console.log('  PriorityQueue - Priority-based queue');
    console.log('  CircularQueue - Fixed-capacity queue');
    console.log('  Deque - Double-ended queue');
    console.log('  Stack - LIFO stack');
    console.log('');
    console.log('Features:');
    console.log('  • Zero dependencies');
    console.log('  • TypeScript support');
    console.log('  • ES modules');
    console.log('  • Comprehensive test suite');
    console.log('  • CLI interface');
    console.log('  • JSON serialization');
    console.log('  • Custom comparators');
    console.log('  • Memory optimization');
    console.log('');
    console.log('Use "node cli.js demo" for interactive demo');
  },

  // Interactive mode
  interactive: async () => {
    console.log('🎯 Queue-x Interactive Mode');
    console.log('Type "help" for commands, "exit" to quit');
    
    let currentQueue = createQueue();

    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const processCommand = async (command) => {
      const parts = command.trim().split(' ');
      const cmd = parts[0];
      const args = parts.slice(1);

      try {
        switch (cmd) {
          case 'help':
            console.log(`
Commands:
  help - Show this help
  create [type] [args] - Create new queue
    types: queue, priority, circular capacity, deque, stack
    examples: create queue 1 2 3
             create priority --reverse
             create circular 3 1 2
  enqueue [item] - Add item to back
  dequeue - Remove item from front
  peek - Show front item
  push [item] - Add to front (deque/stack)
  pop - Remove from front (deque/stack)
  append [item] - Add to back (deque)
  remove - Remove from back (deque)
  clear - Clear queue
  size - Show queue size
  empty - Is queue empty?
  show - Show queue contents
  info - Show current queue info
  exit - Quit interactive mode
            `);
            break;

          case 'create':
            const type = args[0];
            const items = args.slice(args[0] === '--reverse' ? 1 : 2);
            
            switch (type) {
              case 'queue':
                currentQueue = createQueue(items.map(n => parseInt(n)));
                break;
              case 'priority':
                const comparator = args.includes('--reverse') 
                  ? (a, b) => b - a 
                  : (a, b) => a - b;
                currentQueue = createPriorityQueue({ comparator });
                items.map(n => parseInt(n)).forEach(n => currentQueue.enqueue(n));
                break;
              case 'circular':
                const capacity = parseInt(args[1]);
                currentQueue = createCircularQueue(capacity, items.map(n => parseInt(n)));
                break;
              case 'deque':
                currentQueue = createDeque(items.map(n => parseInt(n)));
                break;
              case 'stack':
                currentQueue = createStack(items.map(n => parseInt(n)));
                break;
              default:
                console.log('Unknown type. Use: queue, priority, circular, deque, stack');
                return;
            }
            console.log(`Created ${type}:`, currentQueue.toString());
            break;

          case 'enqueue':
            if (args.length > 0) {
              currentQueue.enqueue(parseInt(args[0]));
              console.log('Enqueued:', currentQueue.toString());
            }
            break;

          case 'dequeue':
            const item = currentQueue.dequeue();
            console.log('Dequeued:', item, '→', currentQueue.toString());
            break;

          case 'peek':
            console.log('Front item:', currentQueue.peek());
            break;

          case 'push':
            if (args.length > 0) {
              if (currentQueue instanceof Deque || currentQueue instanceof Stack) {
                currentQueue.push(parseInt(args[0]));
                console.log('Pushed:', currentQueue.toString());
              } else {
                console.log('Push only available for Deque and Stack');
              }
            }
            break;

          case 'pop':
            const popped = currentQueue.pop();
            console.log('Popped:', popped, '→', currentQueue.toString());
            break;

          case 'append':
            if (args.length > 0 && currentQueue instanceof Deque) {
              currentQueue.append(parseInt(args[0]));
              console.log('Appended:', currentQueue.toString());
            } else {
              console.log('Append only available for Deque');
            }
            break;

          case 'remove':
            const removed = currentQueue.remove();
            console.log('Removed:', removed, '→', currentQueue.toString());
            break;

          case 'clear':
            currentQueue.clear();
            console.log('Queue cleared');
            break;

          case 'size':
            console.log('Size:', currentQueue.size);
            break;

          case 'empty':
            console.log('Empty:', currentQueue.isEmpty);
            break;

          case 'show':
            console.log('Queue:', currentQueue.toString());
            break;

          case 'info':
            console.log('Type:', currentQueue.constructor.name);
            console.log('Size:', currentQueue.size);
            console.log('Empty:', currentQueue.isEmpty);
            if (currentQueue.peek() !== undefined) {
              console.log('Front:', currentQueue.peek());
            }
            break;

          case 'exit':
            rl.close();
            return;

          default:
            console.log('Unknown command. Type "help" for available commands.');
        }
      } catch (error) {
        console.error('Error:', error.message);
      }
    };

    rl.on('line', async (input) => {
      await processCommand(input);
      rl.prompt();
    });

    rl.on('close', () => {
      console.log('Goodbye! 👋');
      process.exit(0);
    });

    rl.prompt();
  }
};

// Main CLI logic
const main = async () => {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    commands.interactive();
    return;
  }

  const command = args[0];
  
  if (commands[command]) {
    await commands[command]();
  } else {
    console.log('Unknown command:', command);
    console.log('Available commands: demo, info, interactive');
    process.exit(1);
  }
};

// Run CLI
main().catch(error => {
  console.error('CLI Error:', error);
  process.exit(1);
});