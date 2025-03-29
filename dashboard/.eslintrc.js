/* eslint-disable no-undef */
module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 2021,
    sourceType: 'module',
    project: './tsconfig.json'
  },
  env: {
    browser: true,
    es2021: true
  },
  extends: [
    'plugin:react/recommended',
    'airbnb-typescript',
    'plugin:react/jsx-runtime',
    'plugin:prettier/recommended'
  ],
  plugins: ['@typescript-eslint', 'react'],
  settings: {
    react: {
      version: 'detect'
    }
  },
  rules: {
    'prettier/prettier': 'off',
    'react/jsx-filename-extension': 'off',
    'import/no-unresolved': 'off',
    'import/extensions': 'off',
    'react/display-name': 'off',
    '@typescript-eslint/comma-dangle': 'off',
    'import/prefer-default-export': 'off',
    'jsx-a11y/anchor-is-valid': 'off',
    'comma-dangle': 'off',
    'max-len': 'off',
    'no-console': 'off',
    'no-param-reassign': 'off',
    'no-plusplus': 'off',
    'no-return-assign': 'off',
    'object-curly-newline': 'off',
    'react/jsx-props-no-spreading': 'off',
    'react/react-in-jsx-scope': 'off',
    'react/require-default-props': 'off',
    'typescript-eslint/no-unused-vars': 'off',
    'import/no-extraneous-dependencies': 'off',
    'react/no-unescaped-entities': 'off',
    'react/forbid-prop-types': 'off',
    'react/jsx-max-props-per-line': [
      1,
      {
        maximum: 2,
        when: 'multiline'
      }
    ],
    indent: 'off',
    '@typescript-eslint/indent': [0],
    'no-use-before-define': 'off',
    '@typescript-eslint/no-use-before-define': ['off'],
    '@typescript-eslint/no-unused-vars': ['off'],
    '@typescript-eslint/no-shadow': ['off'],
    '@typescript-eslint/dot-notation': ['off'],
    'react/prop-types': ['off'],
    '@typescript-eslint/naming-convention': ['off']
  }
};
