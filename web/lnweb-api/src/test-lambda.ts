// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { lambdaHandler } from './lambda';

type TestEvent = Parameters<typeof lambdaHandler>[0];
type TestContext = Parameters<typeof lambdaHandler>[1];

async function testLambda() {
  const event: TestEvent = {
    requestContext: {
      http: {
        method: 'GET',
        path: '/info/networks',
      },
    },
    rawPath: '/info/networks',
    rawQueryString: '',
    headers: {
      'Content-Type': 'application/json',
    },
    body: null,
  };

  const context: TestContext = { callbackWaitsForEmptyEventLoop: false };

  try {
    console.log("Invoking Lambda...");
    const response = await lambdaHandler(event, context);
    console.log("Lambda Response:", response);
  } catch (error) {
    console.error("Lambda Error:", error);
  }
}

testLambda();
