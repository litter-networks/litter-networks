const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const NodeCache = require("node-cache");

const dynamoDbClient = new DynamoDBClient({ region: "eu-west-2" });
const childPagesCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 120 });
const pageCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 120 });
const TABLE_NAME = "LN-Knowledge";
const CDN_BASE_URL = "https://cdn.litternetworks.org";

function normalizePath(path) {
    if (!path) {
        return "knowledge";
    }
    let normalized = path.trim().replace(/^\/+/, "").replace(/\/+$/, "");
    if (!normalized.startsWith("knowledge")) {
        normalized = `knowledge/${normalized}`;
    }
    return normalized;
}

function extractMetadata(htmlContent) {
    const metadata = {};
    const headContent = htmlContent.match(/<head[^>]*>[\s\S]*?<\/head>/i);
    if (headContent) {
        const metaTags = headContent[0].match(/<meta[^>]+>/gi) || [];
        metaTags.forEach((tag) => {
            const propertyMatch = tag.match(/property="([^"]+)"/i);
            const contentMatch = tag.match(/content="([^"]+)"/i);
            if (propertyMatch && contentMatch) {
                metadata[propertyMatch[1]] = contentMatch[1];
            }
        });
    }
    return metadata;
}

function extractBodyContent(htmlContent) {
    const match = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return match ? match[1] : htmlContent;
}

async function getKnowledgePage(path) {
    const normalizedPath = normalizePath(path);
    const cacheKey = `knowledge-page:${normalizedPath}`;
    const cached = pageCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const url = `${CDN_BASE_URL}/docs/${normalizedPath}.html`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch knowledge page: ${normalizedPath}`);
    }
    const html = await response.text();
    const metadata = extractMetadata(html);
    const bodyContent = extractBodyContent(html);

    const result = {
        bodyContent,
        metadata: {
            title: metadata["og:title"] || "Knowledge",
            description: metadata["og:description"] || "",
        },
    };

    pageCache.set(cacheKey, result);
    return result;
}

async function getChildPages(path) {
    const normalizedPath = normalizePath(path);
    const cacheKey = `child-pages:${normalizedPath}`;
    const cached = childPagesCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const command = new GetItemCommand({
        TableName: TABLE_NAME,
        Key: {
            uniqueId: { S: `docs/${normalizedPath}` },
        },
        ProjectionExpression: "childPages",
    });

    const data = await dynamoDbClient.send(command);
    let childPages = [];

    if (data.Item?.childPages?.S) {
        try {
            const normalizedJson = data.Item.childPages.S.replace(/docs\//g, "");
            childPages = JSON.parse(normalizedJson);
        } catch (error) {
            console.error("Failed to parse knowledge child pages:", error);
            childPages = [];
        }
    }

    childPagesCache.set(cacheKey, childPages);
    return childPages;
}

module.exports = {
    getChildPages,
    getKnowledgePage,
};
