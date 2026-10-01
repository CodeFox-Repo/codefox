// Real React components, with only network/navigation/platform boundaries mocked.
module.exports = {
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: {
          jsx: 'react-jsx',
          module: 'CommonJS',
          moduleResolution: 'node',
        },
        isolatedModules: true,
      },
    ],
  },
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  testMatch: ['<rootDir>/src/components/__tests__/project-feedback.test.tsx'],
};
