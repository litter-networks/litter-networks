// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

// Configure environment variables for tests
process.env.NODE_ENV = 'test';

// Silence noisy console output during Jest runs unless explicitly allowed.
if (process.env.JEST_ALLOW_CONSOLE !== 'true') {
  const suppressedMethods = ['error', 'warn', 'log'];
  const consoleSpies = {};

  beforeAll(() => {
    suppressedMethods.forEach((method) => {
      if (typeof console[method] === 'function') {
        consoleSpies[method] = jest.spyOn(console, method).mockImplementation(() => {});
      }
    });
  });

  afterAll(() => {
    suppressedMethods.forEach((method) => {
      const spy = consoleSpies[method];
      if (spy && typeof spy.mockRestore === 'function') {
        spy.mockRestore();
      }
    });
  });
}
