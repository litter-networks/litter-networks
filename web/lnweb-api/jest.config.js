module.exports = {
  testEnvironment: "node",
  collectCoverage: false,
  coverageDirectory: "coverage",
  coveragePathIgnorePatterns: ["/node_modules/"],
  testMatch: ["**/?(*.)+(test).[jt]s"],
  modulePaths: [
    "<rootDir>/node_modules",
    "<rootDir>/lambda-layer/nodejs/node_modules"
  ],
  moduleDirectories: [
    "<rootDir>/node_modules",
    "<rootDir>/lambda-layer/nodejs/node_modules"
  ],
  globals: {
    "process.env.NODE_PATH":
      "<rootDir>/node_modules:<rootDir>/lambda-layer/nodejs/node_modules"
  },
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"]
};
