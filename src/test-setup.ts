import { jest, beforeEach } from '@jest/globals';

jest.setTimeout(15000);

beforeEach(() => {
  jest.clearAllMocks();
});
