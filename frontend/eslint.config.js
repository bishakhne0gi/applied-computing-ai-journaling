import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import sonarjs from 'eslint-plugin-sonarjs'
import betterTailwind from 'eslint-plugin-better-tailwindcss'
import { getDefaultSelectors } from 'eslint-plugin-better-tailwindcss/defaults'

// Every button comes from the Button primitive, which owns cursor-pointer / not-allowed + focus + touch size.
const STYLE_ATTR = { selector: "JSXAttribute[name.name='style']", message: 'Use token utilities; add a token instead of inline style.' }
const RAW_BUTTON = { selector: "JSXOpeningElement[name.name='button']", message: 'Use <Button> from @/components/ui/Button (cursor-pointer, focus ring, touch size). Missing? Create it first (design-system skill).' }

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'playwright-report', 'test-results', '.lighthouse', '.claude', 'public'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict, jsxA11y.flatConfigs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh, sonarjs, 'better-tailwindcss': betterTailwind },
    settings: { 'better-tailwindcss': {
      entryPoint: 'src/styles/tokens.css',
      // Also lint class strings kept in variant maps and *Class/*Classes variables (primitives' variants).
      selectors: [...getDefaultSelectors(), { kind: 'variable', name: '^(variants|sizes|.*(Class|Classes|ClassName|Styles))$', match: [{ type: 'strings' }, { type: 'objectValues' }] }],
    } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Static analysis gates
      complexity: ['error', 10],
      'max-lines': ['error', { max: 200, skipBlankLines: true, skipComments: true }],
      'max-lines-per-function': ['error', { max: 60, skipBlankLines: true, skipComments: true }],
      'max-depth': ['error', 3],
      'sonarjs/cognitive-complexity': ['error', 12],
      'sonarjs/no-identical-functions': 'error',
      'sonarjs/no-duplicate-string': ['error', { threshold: 4 }],
      '@typescript-eslint/no-explicit-any': 'error',
      'no-restricted-syntax': ['error', STYLE_ATTR, RAW_BUTTON],
      // Tailwind: semantic tokens only, no hard-coded values
      'better-tailwindcss/no-unknown-classes': 'error',
      'better-tailwindcss/no-conflicting-classes': 'error',
      'better-tailwindcss/no-duplicate-classes': 'error',
      'better-tailwindcss/no-deprecated-classes': 'error',
      'better-tailwindcss/enforce-consistent-class-order': 'warn',
      'better-tailwindcss/no-restricted-classes': ['error', { restrict: [
        { pattern: '\\[([^\\[\\]]*?)\\](?!:)', message: 'Arbitrary value: add a token in src/styles/tokens.css instead.' },
        { pattern: '\\((--[^)]*)\\)', message: 'Arbitrary value: add a token in src/styles/tokens.css instead.' },
        { pattern: '^([a-zA-Z0-9:/_-]*:)?-?z-(?!0$)\\d+$', message: 'Raw z-index: use z-dropdown/sticky/overlay/toast.' },
        { pattern: '^([a-zA-Z0-9:/_-]*:)?dark:', message: 'No dark: variants — tokens handle dark mode.' },
      ] }],
    },
  },
  // Folder boundaries, as regexes so `.ts` extensions, barrels and relative paths can't slip through.
  {
    files: ['src/components/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      { regex: '^(@/|(\\.\\./)+)(features|hooks|pages|providers)(/|\\.tsx?$|$)', message: 'components/ is a pure library: no data, hooks, stores or features.' },
      { regex: '(^|/)utils/(client|endpoints)(\\.tsx?)?$', message: 'components/ is a pure library: no data, hooks, stores or features.' },
    ] }] },
  },
  {
    files: ['src/features/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      { regex: '(^|/)utils/(client|endpoints)(\\.tsx?)?$', message: 'Features reach the API only through hooks/queries and hooks/mutations.' },
      { regex: '^(@/|(\\.\\./)+)(pages)(/|\\.tsx?$|$)', message: 'Features reach the API only through hooks/queries and hooks/mutations.' },
    ] }] },
  },
  {
    files: ['src/pages/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      { regex: '(^|/)utils/(client|endpoints)(\\.tsx?)?$', message: 'Pages are thin shells: compose features, no data access.' },
      { regex: '^(@/|(\\.\\./)+)(hooks/queries|hooks/mutations)(/|\\.tsx?$|$)', message: 'Pages are thin shells: compose features, no data access.' },
    ] }] },
  },
  {
    files: ['src/hooks/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      { regex: '^(@/|(\\.\\./)+)(features|components|pages)(/|\\.tsx?$|$)', message: 'Hooks sit below features: never import features, components or pages.' },
    ] }] },
  },
  {
    files: ['src/hooks/misc/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: { 'no-restricted-imports': ['error', { patterns: [
      { regex: '^(@/|(\\.\\./)+)(features|components|pages)(/|\\.tsx?$|$)', message: 'Misc hooks are data-free; data lives in hooks/queries and hooks/mutations.' },
      { regex: '(^|/)utils/(client|endpoints)(\\.tsx?)?$', message: 'Misc hooks are data-free; data lives in hooks/queries and hooks/mutations.' },
      { regex: '^(@/hooks/|(\\.\\./)+(hooks/)?)(queries|mutations)(/|$)', message: 'Misc hooks are data-free; data lives in hooks/queries and hooks/mutations.' },
    ] }] },
  },
  {
    files: ['src/components/ui/Button/Button.tsx'],
    rules: { 'no-restricted-syntax': ['error', STYLE_ATTR] },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'e2e/**/*.ts'],
    rules: { 'max-lines-per-function': 'off', 'sonarjs/no-duplicate-string': 'off' },
  },
)
