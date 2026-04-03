import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import functional from 'eslint-plugin-functional';
import prettier from 'eslint-config-prettier';

export default [
  {
    ignores: ['out/**', 'dist/**', 'node_modules/**', '*.config.*'],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      functional,
    },
    rules: {
      ...tseslint.configs['strict-type-checked']?.rules,
      // 함수형 스타일 강제
      'functional/no-let': 'warn',
      'functional/immutable-data': 'warn',
      'functional/no-loop-statements': 'warn',
      'functional/prefer-readonly-type': 'off',
      // 최소 코드 / 방어 코드 관련
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'error',
      // Electron 보안
      'no-eval': 'error',
    },
  },
  prettier,
];
