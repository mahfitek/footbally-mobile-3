// ESLint (flat config). Expo'nun SDK 58 varsayılan kuralları kullanılır.
const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  {
    ignores: ['dist/**', 'node_modules/**', 'supabase/**', 'scripts/**', '.expo/**'],
  },
]);
