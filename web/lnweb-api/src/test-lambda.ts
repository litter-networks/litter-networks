const { lambdaHandler } = require('./lambda');

type TestEvent = {
  httpMethod: string;
  rawPath: string;
  headers: Record<string, string>;
  queryStringParameters: Record<string, string>;
  body: string | null;
};

async function testLambda() {
  const event: TestEvent = {
    httpMethod: 'GET',
    rawPath: '/info/networks',
    headers: {
      'Content-Type': 'application/json',
    },
    queryStringParameters: {
      key: 'value',
    },
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
