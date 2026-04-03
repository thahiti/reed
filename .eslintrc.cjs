module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: { project: './tsconfig.json' },
  plugins: ['@typescript-eslint', 'functional'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:functional/recommended',
    'prettier',
  ],
  rules: {
    // 함수형 스타일 강제
    'functional/no-let': 'warn',
    'functional/immutable-data': 'warn',
    'functional/no-loop-statements': 'warn',
    'functional/prefer-readonly-type': 'warn',
    // 최소 코드 / 방어 코드 관련
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-non-null-assertion': 'error',
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': 'error',
    // Electron 보안
    'no-eval': 'error',
  },
};
