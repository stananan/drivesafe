const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*', '.expo/*'],
  },
  {
    // SDK 57's config turned the React Compiler's rules on as errors, and they
    // flag patterns this codebase used deliberately — latest-value refs assigned
    // during render, state resets inside effects. Those predate the rules and
    // work; when the compiler meets one it skips optimising that component
    // rather than miscompiling it. Warnings keep them visible without blocking
    // every commit behind a thirteen-site refactor. Migrating the patterns
    // properly is in TODO.md.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/purity': 'warn',
    },
  },
]);
