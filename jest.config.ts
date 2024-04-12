module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  testPathIgnorePatterns: ['/node_modules/', '/jspm_packages'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  globalSetup: '../jest.setup.ts',
  globalTeardown: '../jest.cleanup.ts',
  globals: {
    'ts-jest': {
      isolatedModules: false,
    },
  },

  maxWorkers: 5,
  workerIdleMemoryLimit: '1500MB',
  testTimeout: 10000,
};
