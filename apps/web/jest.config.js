import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: './',
})

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/convex/(.*)$': '<rootDir>/../../convex/$1',
    '^@/(.*)$': '<rootDir>/$1',
  },
  testMatch: [
    '**/shared/components/**/*.test.[jt]s?(x)',
    '**/shared/auth/*.integration.ts',
  ],
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
  ],
}

export default createJestConfig(customJestConfig)
