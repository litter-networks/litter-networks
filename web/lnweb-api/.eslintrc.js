module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  plugins: ["@typescript-eslint"],
  extends: ["eslint:recommended", "plugin:@typescript-eslint/recommended"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-require-imports": "off",
  },
  overrides: [
    {
      files: ["**/__tests__/**/*.{ts,js}", "**/*.test.{ts,js}"],
      env: {
        jest: true,
      },
    },
  ],
};
