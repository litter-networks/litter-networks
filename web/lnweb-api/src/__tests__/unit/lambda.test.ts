export {};

const mockCreateServer = jest.fn();
const mockProxy = jest.fn();
const mockInitializeApp = jest.fn();

jest.mock('aws-serverless-express', () => ({
    createServer: mockCreateServer,
    proxy: mockProxy
}));
jest.mock('../../app', () => mockInitializeApp);

describe('lambdaHandler', () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
    });

    it('returns the HTTP response resolved from aws-serverless-express proxy promise', async () => {
        const { lambdaHandler } = require('../../lambda');
        const fakeApp = { name: 'fake-app' };
        const fakeServer = Symbol('server');
        const requestBody = JSON.stringify({ foo: 'bar' });
        const expectedHttpResponse = {
            statusCode: 200,
            headers: { 'content-type': 'application/json' },
            body: requestBody
        };
        const fakeProxyResult = {
            promise: Promise.resolve(expectedHttpResponse)
        };

        mockInitializeApp.mockResolvedValue(fakeApp);
        mockCreateServer.mockReturnValue(fakeServer);
        mockProxy.mockReturnValue(fakeProxyResult);

        const event = {
            rawPath: '/api/test-path',
            rawQueryString: 'foo=bar',
            headers: { host: 'example.com' },
            requestContext: {
                http: {
                    method: 'POST',
                    path: '/api/test-path'
                }
            },
            body: requestBody,
            isBase64Encoded: false
        };
        const context = {};

        const response = await lambdaHandler(event, context);

        expect(response).toEqual(expectedHttpResponse);
        // sanity check that the returned body still contains the original "foo=bar" payload
        expect(JSON.parse(response.body)).toEqual({ foo: 'bar' });
        const proxyCall = mockProxy.mock.calls[0][1];
        expect(proxyCall.path).toBe('/test-path');
        expect(proxyCall.httpMethod).toBe('POST');
        expect(proxyCall.queryStringParameters).toEqual({ foo: 'bar' });
        expect(proxyCall.body).toBe('{"foo":"bar"}');
    });
});
