'use strict';

const awsServerlessExpress = require('aws-serverless-express');
const initializeApp = require('./app');

let serverInitialization = initializeApp().then(app => awsServerlessExpress.createServer(app));
let server = null;

exports.lambdaHandler = async (event, context) => {
    try {    
        // Initialize server if not already done
        if (!server) {
            server = await serverInitialization;
        }
    
        // Ensure Lambda returns immediately once the response is sent.
        context.callbackWaitsForEmptyEventLoop = false;
    
        // Extract the path and method from the incoming event.
        let path = event.rawPath || (event.requestContext?.http?.path) || '';
        const method = event.requestContext?.http?.method || 'GET';

        console.log(`Received Path: ${path}, Method: ${method}`);
    
        // Remove any '/api' prefix if present.
        path = path.replace(/^\/api/, '');
    
        console.log(`Transformed Path: ${path}, Method: ${method}`);
    
        // Transform the API Gateway v2 event into a format that aws-serverless-express expects.
        const transformedEvent = {
            path: path,
            httpMethod: method,
            headers: event.headers || {},
            queryStringParameters: event.rawQueryString
                ? Object.fromEntries(new URLSearchParams(event.rawQueryString))
                : {},
            body: event.body,
            isBase64Encoded: event.isBase64Encoded || false
        };
    
        // Proxy the transformed event to the Express server using the PROMISE mode so we can await the API Gateway response.
        const proxyResult = awsServerlessExpress.proxy(server, transformedEvent, context, 'PROMISE');
        const response = await proxyResult.promise;

        // Debug log the response before returning it
        console.log(`Lambda Response [from Path: ${path}, Method: ${method}]:`, JSON.stringify(response, null, 2));

        return response;

    } catch (error) {
        console.error("Lambda error:", error);

        // Ensure a properly formatted API Gateway response
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                message: "Internal server error",
                error: error.message
            })
        };        
    }
};
