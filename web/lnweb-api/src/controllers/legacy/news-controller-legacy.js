const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");
const { format } = require("@fast-csv/format");

// Initialize the DynamoDB client
const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-2' });
const docClient = DynamoDBDocumentClient.from(dynamoDBClient);


const getPressCuttingsCsvDeprecated = async (req, res) => {
    const scope = req.query.scope || null;
    const scopeId = req.query.scopeId || null;
    let documents = [];

    try {
        if (!scope && !scopeId) {
            // Perform a table scan if no conditions are provided
            let scanParams = {
                TableName: 'LN-PressCuttings'
            };

            let scanCommand = new ScanCommand(scanParams);
            let data = await docClient.send(scanCommand);
            documents = data.Items || [];

            // Continue scanning if necessary (pagination)
            while (data.LastEvaluatedKey) {
                scanParams.ExclusiveStartKey = data.LastEvaluatedKey;
                data = await docClient.send(new ScanCommand(scanParams));
                documents = documents.concat(data.Items || []);
            }
        } else {
            // Perform a query if scope and/or scopeId are provided
            let queryParams = {
                TableName: 'LN-PressCuttings',
                KeyConditionExpression: '',
                ExpressionAttributeValues: {},
                ExpressionAttributeNames: {},
                ScanIndexForward: false, // for descending order
                ConsistentRead: true
            };

            if (scopeId) {
                queryParams.KeyConditionExpression += '#scopeId = :scopeId';
                queryParams.ExpressionAttributeValues[':scopeId'] = scopeId;
                queryParams.ExpressionAttributeNames['#scopeId'] = 'scopeId';
            }

            if (scope) {
                if (queryParams.KeyConditionExpression.length > 0) queryParams.KeyConditionExpression += ' AND ';
                queryParams.KeyConditionExpression += '#scope = :scope';
                queryParams.ExpressionAttributeValues[':scope'] = scope;
                queryParams.ExpressionAttributeNames['#scope'] = 'scope';
            }

            let queryCommand = new QueryCommand(queryParams);
            let data = await docClient.send(queryCommand);
            documents = data.Items || [];

            // Continue querying if necessary (pagination)
            while (data.LastEvaluatedKey) {
                queryParams.ExclusiveStartKey = data.LastEvaluatedKey;
                data = await docClient.send(new QueryCommand(queryParams));
                documents = documents.concat(data.Items || []);
            }
        }

        // Sort documents by articleDate in descending order
        documents.sort((a, b) => (b.articleDate > a.articleDate ? 1 : -1));

        // Stream CSV response
        const csvStream = format({ headers: ['scope', 'scopeId', 'sourceUrl', 'title', 'description', 'imageUrl', 'siteName', 'articleDate'] });

        // Set the response headers
        res.setHeader('Content-Type', 'text/csv');

        // Stream CSV content
        csvStream.pipe(res);

        // Write CSV rows
        documents.forEach((doc) => {
            csvStream.write({
                scope: doc.scope || '',
                scopeId: doc.scopeId || '',
                sourceUrl: doc.sourceUrl || '',
                title: doc.title || '',
                description: doc.description || '',
                imageUrl: doc.imageUrl || '',
                siteName: doc.siteName || '',
                articleDate: doc.articleDate || ''
            });
        });

        csvStream.end();
    } catch (error) {
        console.error('Error retrieving data:', error);
        res.status(500).send('Error retrieving data');
    }
};

exports.getPressCuttingsCsvDeprecated = getPressCuttingsCsvDeprecated;
