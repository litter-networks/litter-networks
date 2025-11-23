const { DynamoDBClient, QueryCommand, BatchGetItemCommand } = require("@aws-sdk/client-dynamodb");
const { createHash } = require("crypto");
const NodeCache = require("node-cache");

// Initialize the DynamoDB client
const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-2' });

const cacheForNews = new NodeCache({ stdTTL: 5 * 60 }); // Cache for news batches (5 min limit)

function hashImageUrl(url) {
    return createHash('sha256').update(url).digest('hex').slice(0, 16);
}

const fetchNextNewsItems = async (maxNumItems, prevUniqueId, cdnHost) => {
    const cacheKey = `${maxNumItems}|${prevUniqueId}`;
    const cachedNewsItems = cacheForNews.get(cacheKey);
    if (cachedNewsItems) {
        return cachedNewsItems;
    }

    let keyConditionExpression = 'zero = :v_zero';
    let expressionAttributeValues = {
        ':v_zero': { S: '0' } // constant partition key
    };

    if (prevUniqueId) {
        keyConditionExpression += ' AND uniqueId < :v_startId';
        expressionAttributeValues[':v_startId'] = { S: prevUniqueId };
    }

    try {
        // Query newest-to-oldest from GlobalIndex
        const queryCommand = new QueryCommand({
            TableName: 'LN-PressCuttings',
            IndexName: 'GlobalIndex',
            KeyConditionExpression: keyConditionExpression,
            ExpressionAttributeValues: expressionAttributeValues,
            Limit: parseInt(maxNumItems),
            ScanIndexForward: false
        });

        const queryResponse = await dynamoDBClient.send(queryCommand);
        const items = queryResponse.Items.map(item => {
            const dictionary = {};
            for (const key in item) {
                if (key === 'imageUrl') {
                    const imageUrl = item[key].S;
                    dictionary[key] = cdnHost + "/proc/images/news/" + hashImageUrl(imageUrl || '') + ".jpg";
                } else {
                    dictionary[key] = item[key].S || item[key].N || "";
                }
            }
            return dictionary;
        });

        cacheForNews.set(cacheKey, items);
        return items;

    } catch (error) {
        console.error("Error fetching news feed: ", error);
        return null;
    }
};

exports.fetchNextNewsItems = fetchNextNewsItems;