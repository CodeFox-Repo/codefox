module.exports = {
  rootDir: '.',
  testEnvironment: 'jsdom',
  testMatch: ['<rootDir>/src/**/__tests__/auth-copy*.spec.ts?(x)'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  setupFilesAfterEnv: ['@testing-library/jest-dom'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          module: 'commonjs',
          moduleResolution: 'node',
        },
      },
    ],
  },
};
