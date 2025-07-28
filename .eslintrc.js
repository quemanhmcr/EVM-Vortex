module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint', 'prettier'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  rules: {
    'prettier/prettier': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
  env: {
    node: true,
    es2022: true,
  },
  ignorePatterns: [
    '**/dist/**',
    '**/node_modules/**',
    '**/.turbo/**',
    'packages/contracts/artifacts/**',
    'packages/contracts/cache/**',
    'packages/contracts/typechain-types/**',
  ],
};
