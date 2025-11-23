const { lambdaHandler } = require('./lambda'); // Adjust if your handler is in a different file

async function testLambda() {
    // Simulated API Gateway event
    const event = {
        httpMethod: 'GET', // Change to POST, PUT, etc., as needed
        rawPath: '/user/login', // Adjust to match the route you want to test
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
