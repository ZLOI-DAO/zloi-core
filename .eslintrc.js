const path = require('path');

module.exports = {
  extends: ['plugin:@typescript-eslint/recommended', 'plugin:prettier/recommended', 'prettier'],
  plugins: ['@typescript-eslint', 'prettier'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    sourceType: 'module',
    project: [path.resolve(__dirname, 'tsconfig.json')],
  },
  ignorePatterns: ['node_modules', '.eslintrc.js', '.prettierrc.js', 'LICENSE', 'artifacts', 'cache', 'typechain-types'],
  rules: {
    'no-underscore-dangle': 0,
    'arrow-body-style': 0,
    'no-unused-expressions': 0,
    'no-plusplus': 0,
    'no-console': 0,
    'func-names': 0,
    'comma-dangle': [
      'error',
      {
        arrays: 'always-multiline',
        objects: 'always-multiline',
        imports: 'always-multiline',
        exports: 'always-multiline',
        functions: 'ignore',
      },
    ],
    'no-prototype-builtins': 0,
    'prefer-destructuring': 0,
    'no-else-return': 0,
    'lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: true }],
    '@typescript-eslint/explicit-member-accessibility': 0,
    '@typescript-eslint/no-explicit-any': 0,
    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        vars: 'all',
        args: 'after-used',
        argsIgnorePattern: '^(_|doc$|req$|res$|next$|props$|params$|opts$|e$)',
      },
    ],
  },
};
