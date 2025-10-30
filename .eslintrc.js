module.exports = {
  env: {
    node: true,
    es2022: true
  },
  extends: [
    'eslint:recommended',
    'plugin:sonarjs/recommended'
  ],
  plugins: ['unused-imports', 'sonarjs'],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'commonjs'
  },
  rules: {
    // === HIBÁK ===
    // A no-unused-vars-t kikapcsoljuk, mert az unused-imports plugin átveszi
    'no-unused-vars': 'off',
    // Unused imports plugin szabályai
    'unused-imports/no-unused-imports': 'error',
    'unused-imports/no-unused-vars': ['error', {
      vars: 'all',
      args: 'after-used',
      ignoreRestSiblings: false,
      // _param néven kezdődő paramétereket ignorálja
      argsIgnorePattern: '^_',
      varsIgnorePattern: '^_'
    }],
    // Development-ben megengedjük a console.log-ot
    'no-console': 'off',
    'no-debugger': 'error',
    'no-undef': 'error',
    'no-unreachable': 'error',
    // Let/const használata kötelező
    'no-var': 'error',
    // Const használata ahol lehetséges
    'prefer-const': 'error',

    // === BEST PRACTICES ===
    eqeqeq: ['error', 'always'],
    'no-eval': 'error',
    'no-implied-eval': 'error',
    'no-with': 'error',
    curly: ['error', 'all'],
    'dot-notation': 'error',
    'no-alert': 'error',
    'no-caller': 'error',
    'no-else-return': 'error',
    'no-empty-function': 'warn',
    'no-extra-bind': 'error',
    'no-floating-decimal': 'error',
    'no-implicit-coercion': 'error',
    'no-implicit-globals': 'error',
    'no-lone-blocks': 'error',
    'no-loop-func': 'error',
    'no-new': 'error',
    'no-new-func': 'error',
    'no-new-wrappers': 'error',
    'no-octal-escape': 'error',
    'no-param-reassign': 'error',
    'no-return-assign': 'error',
    'no-script-url': 'error',
    'no-self-compare': 'error',
    'no-sequences': 'error',
    'no-throw-literal': 'error',
    'no-unmodified-loop-condition': 'error',
    'no-unused-expressions': 'error',
    'no-useless-call': 'error',
    'no-useless-concat': 'error',
    'no-useless-return': 'error',
    'prefer-promise-reject-errors': 'error',
    'require-await': 'error',
    'wrap-iife': 'error',
    yoda: 'error',

    // === VÁLTOZÓK ===
    'no-delete-var': 'error',
    'no-shadow': 'error',
    'no-shadow-restricted-names': 'error',
    'no-use-before-define': ['error', { functions: false, classes: true, variables: true }],

    // === KÓDSTÍLUS ===
    indent: ['error', 2, { SwitchCase: 1 }],
    quotes: ['error', 'single', { avoidEscape: true }],
    semi: ['error', 'always'],
    'comma-dangle': ['error', 'never'],
    'comma-spacing': ['error', { before: false, after: true }],
    'comma-style': ['error', 'last'],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'brace-style': ['error', '1tbs', { allowSingleLine: true }],
    camelcase: ['error', { properties: 'always' }],
    'eol-last': ['error', 'always'],
    'func-call-spacing': ['error', 'never'],
    'key-spacing': ['error', { beforeColon: false, afterColon: true }],
    'keyword-spacing': ['error', { before: true, after: true }],
    'max-depth': ['error', 4],
    'max-len': ['error', { code: 120, tabWidth: 2, ignoreUrls: true }],
    'max-lines': ['warn', { max: 500, skipBlankLines: true, skipComments: true }],
    'max-nested-callbacks': ['error', 3],
    'max-params': ['error', 5],
    'max-statements': ['warn', 20],
    'new-cap': ['error', { newIsCap: true, capIsNew: false }],
    'new-parens': 'error',
    'no-array-constructor': 'error',
    'no-bitwise': 'error',
    'no-continue': 'error',
    'no-lonely-if': 'error',
    'no-mixed-operators': 'error',
    'no-multiple-empty-lines': ['error', { max: 2, maxEOF: 1 }],
    'no-negated-condition': 'error',
    'no-nested-ternary': 'error',
    'no-new-object': 'error',
    'no-plusplus': ['error', { allowForLoopAfterthoughts: true }],
    'no-tabs': 'error',
    'no-trailing-spaces': 'error',
    'no-underscore-dangle': ['error', {
      allowAfterThis: true,
      allow: ['_datePicker', '_timePicker', '_locationSearch', '_daysInMonth', '_geonameId', '__x', '_csrf']
    }],
    'no-unneeded-ternary': 'error',
    'no-whitespace-before-property': 'error',
    'object-curly-newline': ['error', { consistent: true }],
    'one-var': ['error', 'never'],
    'operator-assignment': ['error', 'always'],
    'operator-linebreak': ['error', 'before'],
    'padded-blocks': ['error', 'never'],
    'quote-props': ['error', 'as-needed'],
    'semi-spacing': ['error', { before: false, after: true }],
    'space-before-blocks': 'error',
    'space-before-function-paren': ['error', { anonymous: 'always', named: 'never', asyncArrow: 'always' }],
    'space-in-parens': ['error', 'never'],
    'space-infix-ops': 'error',
    'space-unary-ops': ['error', { words: true, nonwords: false }],
    'spaced-comment': ['error', 'always'],

    // === ES6+ SZABÁLYOK ===
    'arrow-body-style': ['error', 'as-needed'],
    'arrow-parens': ['error', 'always'],
    'arrow-spacing': ['error', { before: true, after: true }],
    'constructor-super': 'error',
    'generator-star-spacing': ['error', { before: false, after: true }],
    'no-class-assign': 'error',
    'no-confusing-arrow': 'error',
    'no-const-assign': 'error',
    'no-dupe-class-members': 'error',
    'no-new-symbol': 'error',
    'no-this-before-super': 'error',
    'no-useless-computed-key': 'error',
    'no-useless-constructor': 'error',
    'no-useless-rename': 'error',
    'object-shorthand': ['error', 'always'],
    'prefer-arrow-callback': 'error',
    'prefer-destructuring': ['error', { object: true, array: false }],
    'prefer-rest-params': 'error',
    'prefer-spread': 'error',
    'prefer-template': 'error',
    'rest-spread-spacing': ['error', 'never'],
    'symbol-description': 'error',
    'template-curly-spacing': ['error', 'never'],
    'yield-star-spacing': ['error', 'after']
  },
  ignorePatterns: [
    'node_modules/',
    'logs/',
    'public/js/vendor/',
    '*.min.js',
    'views/**/*.ejs'
  ],
  overrides: [
    {
      files: ['public/js/**/*.js'],
      env: {
        browser: true,
        node: false
      },
      globals: {
        Alpine: 'readonly',
        gtag: 'readonly'
      },
      rules: {
        // Frontend specifikus szabályok - enyhébbek
        camelcase: 'off',
        'max-len': ['error', { code: 200 }],
        'max-statements': ['error', 50],
        'no-use-before-define': 'off'
      }
    },
    {
      files: [
        'test-*.js',
        'debug-*.js',
        '*-test.js',
        'clean-*.js',
        'list-*.js',
        'raw-*.js',
        'search-*.js',
        'simple-*.js',
        'sync-*.js',
        'check-*.js',
        'find-*.js'
      ],
      rules: {
        'unused-imports/no-unused-vars': 'warn',
        'unused-imports/no-unused-imports': 'warn',
        'no-undef': 'warn'
      }
    }
  ]
};
