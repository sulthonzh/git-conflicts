const { CircularQueue } = require('./index.js');

const cq = new CircularQueue(2, [1, 2]);
console.log('Before:', cq.toArray());
console.log('Size:', cq.size, 'Full:', cq.isFull);

try {
  cq.enqueue(3, true);
  console.log('After:', cq.toArray());
  console.log('Size:', cq.size, 'Full:', cq.isFull);
} catch (error) {
  console.log('Error:', error.message);
}