/** Tokens only, relative units only. Raw values live in src/styles/tokens.css. */
export default {
  extends: ['stylelint-config-standard'],
  plugins: ['stylelint-declaration-strict-value'],
  rules: {
    'color-no-hex': true,
    'color-named': 'never',
    'unit-disallowed-list': ['px', 'pt', 'cm', 'mm', 'in'],
    'scale-unlimited/declaration-strict-value': [
      ['/color$/', 'fill', 'stroke', 'background-color', 'z-index', 'font-size', 'font-family', 'font-weight', 'border-radius', 'box-shadow', '/^(margin|padding|gap)/'],
      { ignoreValues: ['0', 'auto', 'inherit', 'initial', 'unset', 'transparent', 'currentcolor', 'none', '100%'] },
    ],
    'selector-class-pattern': null,
    'import-notation': 'string',
    'at-rule-no-unknown': [true, { ignoreAtRules: ['theme', 'utility', 'variant', 'custom-variant', 'apply', 'source', 'reference', 'plugin', 'layer'] }],
  },
  overrides: [
    { files: ['src/styles/tokens.css'], rules: { 'color-no-hex': null, 'unit-disallowed-list': null, 'scale-unlimited/declaration-strict-value': null, 'custom-property-pattern': null, 'custom-property-empty-line-before': null } },
  ],
}
