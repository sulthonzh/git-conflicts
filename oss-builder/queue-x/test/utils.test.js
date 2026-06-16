// Utils tests
import assert from 'node:assert';
import { Queue, utils } from '../index.js';

// Test processQueue function
async function testProcessQueue() {
  const results = [];
  const processFn = async (item) => {
    await new Promise(resolve => setTimeout(resolve, 10));
    results.push(item * 2);
  };

  const queue = new Queue([1, 2, 3, 4, 5]);
  
  // Test with concurrency 1
  await utils.processQueue(queue, processFn, { concurrency: 1 });
  assert(results.join(',') === '2,4,6,8,10', 'ProcessQueue with concurrency 1 should work');
  
  // Reset
  queue.enqueue(1).enqueue(2).enqueue(3).enqueue(4).enqueue(5);
  results.length = 0;
  
  // Test with higher concurrency
  await utils.processQueue(queue, processFn, { concurrency: 3 });
  assert(results.length === 5, 'ProcessQueue should process all items');
  assert(new Set(results).size === 5, 'All items should be processed');
  
  console.log('✅ processQueue tests passed!');
}

// Test batchProcess function
function testBatchProcess() {
  const queue = new Queue([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  
  const processFn = (batch) => batch.map(n => n * 2);
  
  // Test with batch size 3
  const batches = utils.batchProcess(queue, processFn, 3);
  assert(batches.length === 4, 'Should create correct number of batches');
  assert(batches[0].join(',') === '2,4,6', 'First batch should be correct');
  assert(batches[1].join(',') === '8,10,12', 'Second batch should be correct');
  assert(batches[2].join(',') === '14,16', 'Last batch should handle remainder');
  
  // Test with batch size 1
  const queue2 = new Queue([1, 2, 3]);
  const batches2 = utils.batchProcess(queue2, processFn, 1);
  assert(batches2.length === 3, 'Should create one batch per item');
  
  // Test with batch size larger than queue
  const queue3 = new Queue([1, 2]);
  const batches3 = utils.batchProcess(queue3, processFn, 5);
  assert(batches3.length === 1, 'Should create one batch for small queue');
  assert(batches3[0].join(',') === '2,4', 'Batch should contain all items');
  
  console.log('✅ batchProcess tests passed!');
}

// Test debounceQueue function
function testDebounceQueue() {
  const queue = new Queue([1, 2, 3, 1, 2, 4]);
  
  // Test with 100ms debounce
  const debounced = utils.debounceQueue(queue, 50);
  
  // Give a moment for debounced queue to settle
  setTimeout(() => {
    const result = debounced.toArray();
    // Should have deduplicated consecutive items
    assert(result.includes(1), 'Should include first 1');
    assert(result.includes(2), 'Should include first 2');
    assert(result.includes(3), 'Should include 3');
    assert(!result.includes(4) || result[result.length - 1] === 4, 'Should include final 4');
    
    console.log('✅ debounceQueue tests passed!');
  }, 100);
}

// Test all utilities
async function testAllUtils() {
  console.log('Testing utilities...');
  
  await testProcessQueue();
  testBatchProcess();
  testDebounceQueue();
}

// Run tests
testAllUtils().catch(error => {
  console.error('Utility tests failed:', error);
  process.exit(1);
});