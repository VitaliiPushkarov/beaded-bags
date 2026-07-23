import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypescript from 'eslint-config-next/typescript'

// eslint-config-next v16 ships native flat configs, so we consume them directly.
// The old FlatCompat wrapper double-wraps these and crashes at config load
// ("Converting circular structure to JSON"), which silently disabled linting.
export default [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    // Flat-config ignores
    ignores: [
      'node_modules/**',
      '.next/**',
      'out/**',
      'build/**',
      'next-env.d.ts',
    ],
  },
  {
    rules: {
      'react/no-unescaped-entities': 'off',
      '@next/next/no-page-custom-font': 'off',
      // Pre-existing debt surfaced when linting was restored. Kept visible as
      // warnings so the lint gate stays green while the cleanup happens
      // incrementally rather than in one risky sweep.
      '@typescript-eslint/no-explicit-any': 'warn',
      // Newly-added react-hooks recommended rules (react-hooks v6): noisy and
      // flag several legitimate patterns (e.g. useIsMounted). Warn for now.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/immutability': 'warn',
    },
  },
]
