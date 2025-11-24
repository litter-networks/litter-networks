const { lambdaHandler } = require('./lambda'); /**
 * Simulates an API Gateway invocation of the local `lambdaHandler` for manual testing.
 *
 * Builds a configurable API Gateway–style event, invokes `lambdaHandler` with an empty context,
 * and logs the response or any error. Adjust `httpMethod`, `rawPath`, `headers`,
 * `queryStringParameters`, and `body` in the event to test different requests.
 */

async function testLambda() {
    // Simulated API Gateway event
    const event = {
        httpMethod: 'GET', // Change to POST, PUT, etc., as needed
        rawPath: '/info/networks', // Adjust to match the route you want to test
        headers: {
            'Content-Type': 'application/json'
        },
        queryStringParameters: {
            key: 'value' // Modify as needed
        },
        body: null // Add JSON.stringify({ data }) if testing a POST request
    };

    const context = {}; // Context can be empty for local testing

    try {
        console.log("Invoking Lambda...");
        const response = await lambdaHandler(event, context);
        console.log("Lambda Response:", response);
    } catch (error) {
        console.error("Lambda Error:", error);
    }
}

testLambda();
