/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/.claude/'],
  modulePathIgnorePatterns: ['<rootDir>/.claude/'],
  watchPathIgnorePatterns: ['<rootDir>/.claude/'],
  watchman: false
};
