// Copyright 2025 Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  QueryCommandInput,
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


type PressCuttingsParams = {
  scope?: string;
  scopeId?: string;
};

const PRESS_CUTTINGS_TABLE = 'LN-PressCuttings';

const getPressCuttingsCsvDeprecated = async (req: Request<PressCuttingsParams>, res: Response) => {
    const { scope, scopeId } = req.params;

    let documents: PressCutting[] = [];

    try {
        const expressionValues: NonNullable<QueryCommandInput["ExpressionAttributeValues"]> = {
            ':zero': '0',
        };
        const expressionNames: NonNullable<QueryCommandInput["ExpressionAttributeNames"]> = {
            '#zero': 'zero',
        };
        const filterExpressions: string[] = [];
        if (scope) {
            expressionNames['#scope'] = 'scope';
            expressionValues[':scope'] = scope;
            filterExpressions.push('#scope = :scope');
        }
        if (scopeId) {
            expressionNames['#scopeId'] = 'scopeId';
            expressionValues[':scopeId'] = scopeId;
            filterExpressions.push('#scopeId = :scopeId');
        }

        const queryParams: QueryCommandInput = {
            TableName: PRESS_CUTTINGS_TABLE,
            IndexName: 'GlobalIndex',
            KeyConditionExpression: '#zero = :zero',
            ExpressionAttributeValues: expressionValues,
            ExpressionAttributeNames: expressionNames,
            ScanIndexForward: false, // newest first
            ConsistentRead: false,
        };
        if (filterExpressions.length > 0) {
            queryParams.FilterExpression = filterExpressions.join(' AND ');
        }

        const queryCommand = new QueryCommand(queryParams);
        let data = await docClient.send(queryCommand);
        documents = data.Items || [];

        while (data.LastEvaluatedKey) {
            queryParams.ExclusiveStartKey = data.LastEvaluatedKey;
            data = await docClient.send(new QueryCommand(queryParams));
            documents = documents.concat(data.Items || []);
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
