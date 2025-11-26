import { lambdaHandler } from './lambda';

type TestEvent = {
  requestContext: {
    http: {
      method: string;
      path?: string;
    };
  };
  rawPath?: string;
  headers: Record<string, string> | null;
  queryStringParameters: Record<string, string> | null;
  body: string | null;
};

async function testLambda() {
  const event: TestEvent = {
    requestContext: {
      http: {
        method: 'GET',
        path: '/info/networks',
      },
    },
    rawPath: '/info/networks',
    headers: {
      'Content-Type': 'application/json',
    },
    queryStringParameters: null,
    body: null,
  };

  const context = { callbackWaitsForEmptyEventLoop: false };

  try {
    console.log("Invoking Lambda...");
    const response = await lambdaHandler(event, context);
    console.log("Lambda Response:", response);
  } catch (error) {
    console.error("Lambda Error:", error);
  }
}

testLambda();
