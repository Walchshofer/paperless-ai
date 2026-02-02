import globals from "globals";
import pluginJs from "@eslint/js";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

/** @type {import('eslint').Linter.Config[]} */
export default [
  // Ignore patterns
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "build/**",
      "coverage/**",
      "*.min.js",
      ".claude/**",
      ".venv*/**",
      "containers/**",
      "public/js/vendor/**",
      "public/js/dist/**",
      "migrations/**",
      // Auto-generated test reports (not source code)
      "test-results/**",
      "playwright-report/**",
    ],
  },

  // Base recommended config
  pluginJs.configs.recommended,

  // Global rule overrides for existing codebase patterns
  {
    rules: {
      // Relax unused variable rules for catch blocks and prefixed vars
      // Using "warn" for gradual codebase cleanup
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrors: "none",  // Don't warn about unused catch parameters
      }],
      // Allow empty catch blocks (common pattern)
      "no-empty": ["error", { allowEmptyCatch: true }],
      // Warn instead of error for prototype builtins
      "no-prototype-builtins": "warn",
      // Allow useless escapes (common in regex strings)
      "no-useless-escape": "warn",
      // Warn on useless catch (can be refactored later)
      "no-useless-catch": "warn",
    },
  },

  // JavaScript files
  {
    files: ["**/*.js", "**/*.jsx"],
    languageOptions: {
      sourceType: "commonjs",
      ecmaVersion: "latest",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },

  // Browser scripts with external libraries
  {
    files: ["public/js/**/*.js"],
    languageOptions: {
      sourceType: "script",
      globals: {
        ...globals.browser,
        Chart: "readonly",
        marked: "readonly",
        Prism: "readonly",
        hljs: "readonly",
        Swal: "readonly",
        Sortable: "readonly",
        bootstrap: "readonly",
        event: "readonly",
      },
    },
  },

  // TypeScript files
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: "latest",
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        // DOM types that TypeScript provides
        EventListener: "readonly",
        CustomEventInit: "readonly",
        ParentNode: "readonly",
        JSX: "readonly",
        // Preact globals (used in islands)
        h: "readonly",
        Fragment: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      // Disable base rule in favor of TypeScript version
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_|^h$|^Fragment$|^set[A-Z]",
        caughtErrors: "none",
      }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },

  // Test files (JS and TS)
  {
    files: [
      "**/*.test.js",
      "**/*.spec.js",
      "**/*.test.ts",
      "**/*.spec.ts",
      "test/**/*.js",
      "test/**/*.ts",
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.mocha,
        // Common test globals
        expect: "readonly",
        assert: "readonly",
        sinon: "readonly",
        // Playwright globals for e2e tests
        page: "readonly",
        browser: "readonly",
        context: "readonly",
        test: "readonly",
      },
    },
    rules: {
      // More relaxed for test files
      "no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrors: "none",
      }],
    },
  },

  // Scripts directory (uses Node.js globals)
  {
    files: ["scripts/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        console: "readonly",
      },
    },
  },

  // ESM test files
  {
    files: ["**/*.mjs", "**/*.test.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: {
        ...globals.node,
        console: "readonly",
      },
    },
  },

  // Prettier integration (must be last)
  prettier,
];
