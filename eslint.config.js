// @ts-check

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
  // Global ignores
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.turbo/**',
      'packages/contracts/artifacts/**',
      'packages/contracts/cache/**',
      'packages/contracts/typechain-types/**',
    ],
  },

  // Base configurations
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // Prettier config to disable conflicting rules
  eslintConfigPrettier,
);
