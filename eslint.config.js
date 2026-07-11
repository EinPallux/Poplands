import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

/**
 * Flat ESLint config. Layering rules (TECHNICAL_ARCHITECTURE §2) are enforced with
 * no-restricted-imports per zone: core/content/sim must stay three.js-free.
 */
const threeFreeZone = (files) => ({
  files,
  rules: {
    'no-restricted-imports': [
      'error',
      {
        paths: [{ name: 'three', message: 'This layer must stay three.js-free (TECH §2).' }],
        patterns: [
          { group: ['three/*'], message: 'This layer must stay three.js-free (TECH §2).' },
        ],
      },
    ],
  },
});

export default [
  { ignores: ['dist/', 'node_modules/', 'public/', 'coverage/'] },
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.mts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { sourceType: 'module' },
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        performance: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        localStorage: 'readonly',
        navigator: 'readonly',
        devicePixelRatio: 'readonly',
        HTMLElement: 'readonly',
        HTMLDivElement: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLButtonElement: 'readonly',
        HTMLInputElement: 'readonly',
        HTMLSelectElement: 'readonly',
        HTMLTextAreaElement: 'readonly',
        SVGCircleElement: 'readonly',
        SVGElement: 'readonly',
        Storage: 'readonly',
        File: 'readonly',
        Blob: 'readonly',
        AudioContext: 'readonly',
        GainNode: 'readonly',
        Audio: 'readonly',
        HTMLAudioElement: 'readonly',
        FileReader: 'readonly',
        PointerEvent: 'readonly',
        WebGL2RenderingContext: 'readonly',
        WheelEvent: 'readonly',
        KeyboardEvent: 'readonly',
        MouseEvent: 'readonly',
        Event: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        fetch: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        CompressionStream: 'readonly',
        DecompressionStream: 'readonly',
        Response: 'readonly',
        btoa: 'readonly',
        atob: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        process: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error', 'info'] }],
    },
  },
  threeFreeZone(['src/core/**/*.ts', 'src/content/**/*.ts', 'src/sim/**/*.ts']),
  {
    files: ['scripts/**/*.mts', 'tests/**/*.ts'],
    rules: { 'no-console': 'off' },
  },
  prettier,
];
