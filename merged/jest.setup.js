/* eslint-disable @typescript-eslint/no-require-imports -- CommonJS by design */
require('@testing-library/jest-dom');

// jsdom has no IntersectionObserver; framer-motion's viewport hooks need one.
class IntersectionObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() { return []; }
}
global.IntersectionObserver = IntersectionObserverMock;
