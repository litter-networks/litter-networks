'use strict';

const awsServerlessExpress = require('aws-serverless-express');
const initializeApp = require('./app');

type LambdaEvent = {
  rawPath?: string;
  requestContext?: { http?: { path?: string; method?: string } };
  headers?: Record<string, string>;
  rawQueryString?: string;
  body?: string | null;
  isBase64Encoded?: boolean;
};

type LambdaContext = {
  callbackWaitsForEmptyEventLoop: boolean;
};

const serverInitialization = initializeApp().then((app: any) => awsServerlessExpress.createServer(app));
let server: any = null;

export const lambdaHandler = async (event: LambdaEvent, context: LambdaContext) => {
  try {
    if (!server) {
      server = await serverInitialization;
    }

    context.callbackWaitsForEmptyEventLoop = false;

    let path = event.rawPath || event.requestContext?.http?.path || '';
    const method = event.requestContext?.http?.method || 'GET';

    console.log(`Received Path: ${path}, Method: ${method}`);
    path = path.replace(/^\/api/, '');
    console.log(`Transformed Path: ${path}, Method: ${method}`);

    const transformedEvent = {
      path,
      httpMethod: method,
      headers: event.headers || {},
      queryStringParameters: event.rawQueryString
        ? Object.fromEntries(new URLSearchParams(event.rawQueryString))
        : {},
      body: event.body,
      isBase64Encoded: event.isBase64Encoded || false,
    };

    const proxyResult = awsServerlessExpress.proxy(server, transformedEvent, context, 'PROMISE');
    const response = await proxyResult.promise;
    console.log(`Lambda Response [from Path: ${path}, Method: ${method}]:`, JSON.stringify(response, null, 2));
    return response;
  } catch (error: any) {
    console.error("Lambda error:", error);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Internal server error",
        error: error?.message ?? 'Unknown error',
      }),
    };
  }
};

module.exports.lambdaHandler = lambdaHandler;
