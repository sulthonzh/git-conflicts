// Global test setup for git-conflicts
import { jest, beforeEach } from '@jest/globals';

// Set longer timeout for git operations in tests
jest.setTimeout(15000);

// Reset mocks before each test
beforeEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
});