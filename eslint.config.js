const globals = require("globals");
const pluginJs = require("@eslint/js");

module.exports = [
  pluginJs.configs.recommended, // Apply recommended rules first
  {
    languageOptions: {
      ecmaVersion: 2025,
      sourceType: "commonjs",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.mocha
      }
    },
    rules: {
      // Variable and scope rules
      "no-unused-vars": ["error", { 
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }],
      "no-undef": "error",
      "no-redeclare": "error",
      
      // Code quality rules
      "no-console": "warn",
      "no-debugger": "error",
      "no-alert": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      
      // Style and consistency
      "indent": ["error", 2, { "SwitchCase": 1 }],
      "quotes": ["error", "single", { "avoidEscape": true }],
      "semi": ["error", "always"],
      "comma-dangle": ["error", "never"],
      "no-trailing-spaces": "error",
      "eol-last": "error",
      
      // Best practices
      "eqeqeq": ["error", "always"],
      "no-var": "error",
      "prefer-const": "error",
      "no-duplicate-imports": "error",
      "no-useless-return": "error",
      "no-unreachable": "error",
      
      // Security
      "no-new-func": "error",
      "no-new-wrappers": "error"
    }
  },
  {
    // Test-specific overrides
    files: ["test/**/*.js"],
    rules: {
      "no-console": "off", // Allow console.log in tests
      "no-unused-expressions": "off" // Allow chai expect assertions
    }
  }
];