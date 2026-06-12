import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    // Guardrail: src/sim must stay pure TS — no React allowed.
    files: ['src/sim/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message:
                'src/sim must stay framework-agnostic pure TS — no React imports.',
            },
            {
              name: 'react-dom',
              message:
                'src/sim must stay framework-agnostic pure TS — no React imports.',
            },
          ],
          patterns: [
            {
              group: ['react', 'react/*', 'react-dom', 'react-dom/*'],
              message:
                'src/sim must stay framework-agnostic pure TS — no React imports.',
            },
          ],
        },
      ],
    },
  },
);
