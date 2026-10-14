/* Database integration tests: real PostgreSQL engine (PGlite, WASM) — run with
   `npm run test:db`. They need Node's --experimental-vm-modules, so they are kept out of the normal `jest` run. */
/* eslint-disable @typescript-eslint/no-require-imports */
const base = require('./jest.config.js');
module.exports = {
  ...base,
  testEnvironment: 'node',
  testMatch: ['**/*.db.test.ts'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
};
