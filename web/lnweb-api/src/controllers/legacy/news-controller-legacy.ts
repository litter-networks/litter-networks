// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  ScanCommand,
  QueryCommandInput,
  ScanCommandInput,
} from "@aws-sdk/lib-dynamodb";
import { format } from "@fast-csv/format";
import type { Request, Response } from "express";

type PressCutting = {
  scope?: string;
  scopeId?: string;
  sourceUrl?: string;
  title?: string;
  description?: string;
  imageUrl?: string;
  siteName?: string;
  articleDate?: string;
};

// Initialize the DynamoDB client
const dynamoDBClient = new DynamoDBClient({ region: 'eu-west-2' });
const docClient = DynamoDBDocumentClient.from(dynamoDBClient);


const getPressCuttingsCsvDeprecated = async (req: Request, res: Response) => {
    const scope = (req.query.scope as string) || null;
    const scopeId = (req.query.scopeId as string) || null;
    let documents: PressCutting[] = [];

    try {
        if (!scope && !scopeId) {
            // Perform a table scan if no conditions are provided
            const scanParams: ScanCommandInput = {
                TableName: 'LN-PressCuttings'
            };

            const scanCommand = new ScanCommand(scanParams);
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
            const expressionValues: NonNullable<QueryCommandInput["ExpressionAttributeValues"]> = {};
            const expressionNames: NonNullable<QueryCommandInput["ExpressionAttributeNames"]> = {};
            let keyConditionExpression = '';

            if (scopeId) {
                keyConditionExpression += '#scopeId = :scopeId';
                expressionValues[':scopeId'] = scopeId;
                expressionNames['#scopeId'] = 'scopeId';
            }

            if (scope) {
                if (keyConditionExpression.length > 0) keyConditionExpression += ' AND ';
                keyConditionExpression += '#scope = :scope';
                expressionValues[':scope'] = scope;
                expressionNames['#scope'] = 'scope';
            }

            const queryParams: QueryCommandInput = {
                TableName: 'LN-PressCuttings',
                KeyConditionExpression: keyConditionExpression,
                ExpressionAttributeValues: expressionValues,
                ExpressionAttributeNames: expressionNames,
                ScanIndexForward: false, // for descending order
                ConsistentRead: true
            };

            const queryCommand = new QueryCommand(queryParams);
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
        documents.sort((a, b) => (b.articleDate ?? '') > (a.articleDate ?? '') ? 1 : -1);

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
