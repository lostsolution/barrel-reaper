import js from '@eslint/js';
import { defineConfig } from 'eslint/config';

export default defineConfig([
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: 'module',
        },
        rules: {
            'no-console': 'off',
            curly: ['error', 'multi-line'],
        },
    },
]);
