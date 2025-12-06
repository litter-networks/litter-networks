// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { createHash } from "crypto";
import NodeCache from "node-cache";

// Initialize the DynamoDB client
const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-2' });

type NewsItem = {
  [key: string]: string;
};

const cacheForNews = new NodeCache({ stdTTL: 5 * 60 });

function hashImageUrl(url: string): string {
    return createHash('sha256').update(url).digest('hex').slice(0, 16);
}

const fetchNextNewsItems = async (
    maxNumItems: number | string,
    prevUniqueId: string | null,
    cdnHost: string
): Promise<NewsItem[] | null> => {
    const cacheKey = `${maxNumItems}|${prevUniqueId}`;
    const cachedNewsItems = cacheForNews.get(cacheKey) as NewsItem[] | undefined;
    if (cachedNewsItems) {
        return cachedNewsItems;
    }

    let keyConditionExpression = 'zero = :v_zero';
    const expressionAttributeValues: Record<string, { S: string }> = {
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
            Limit: typeof maxNumItems === 'string' ? parseInt(maxNumItems, 10) : maxNumItems,
            ScanIndexForward: false
        });

        const queryResponse = await dynamoDBClient.send(queryCommand);
        const items: NewsItem[] = (queryResponse.Items ?? []).map(item => {
            const dictionary: NewsItem = {};
            for (const key in item) {
                if (key === 'imageUrl') {
                    const imageUrl = item[key]?.S ?? '';
                    dictionary[key] = cdnHost + "/proc/images/news/" + hashImageUrl(imageUrl) + ".jpg";
                } else {
                    dictionary[key] = item[key]?.S ?? item[key]?.N ?? "";
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
