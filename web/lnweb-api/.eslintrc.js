module.exports = {
  env: {
    node: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "script",
  },
  extends: ["eslint:recommended"],
  rules: {
    "no-undef": "error",
    "security/detect-object-injection": "off",
  },
  overrides: [
    {
      files: ["**/__tests__/**/*.js", "**/*.test.js"],
      env: {
        jest: true,
      },
    },
  ],
};
