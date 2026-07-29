const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'node',
  setupFiles: ['<rootDir>/jest.setup.js'],
  resetModules: true,
};

module.exports = createJestConfig(customJestConfig);
