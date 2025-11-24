const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const NodeCache = require("node-cache");

const dynamoDbClient = new DynamoDBClient({ region: "eu-west-2" });
const childPagesCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 120 });
const pageCache = new NodeCache({ stdTTL: 5 * 60, checkperiod: 120 });
const TABLE_NAME = "LN-Knowledge";
const CDN_BASE_URL = "https://cdn.litternetworks.org";

/**
 * Normalize an input into a canonical knowledge page path.
 *
 * Trims whitespace, removes leading and trailing slashes, and ensures the path begins with `knowledge/`.
 * If `path` is falsy, returns `"knowledge"`.
 *
 * @param {string} path - The path to normalize; may be empty or include extra slashes/whitespace.
 * @returns {string} The normalized knowledge path (e.g., `knowledge/foo/bar`), or `"knowledge"` when input is falsy.
 */
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

/**
 * Extracts meta tag properties from the document head and returns them as a key/value map.
 * @param {string} htmlContent - The full HTML document to scan for meta tags.
 * @returns {Object.<string,string>} An object mapping meta `property` attributes (e.g., `og:title`) to their `content` values; returns an empty object if no matching meta tags are found.
 */
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

/**
 * Extracts the inner HTML of the document's <body> element.
 * @param {string} htmlContent - The full HTML document or fragment to search.
 * @returns {string} The inner HTML of the `<body>` element if present; otherwise returns the original `htmlContent`.
 */
function extractBodyContent(htmlContent) {
    const match = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return match ? match[1] : htmlContent;
}

/**
 * Retrieve a knowledge page's HTML body and its metadata, using CDN fetch with in-memory caching.
 *
 * @param {string} path - The requested page path (will be normalized; falsy values yield the default knowledge page).
 * @returns {{ bodyContent: string, metadata: { title: string, description: string } }} An object containing the page's body HTML and metadata (title defaults to "Knowledge", description defaults to "").
 * @throws {Error} When the CDN fetch fails (non-OK response).
 */
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

/**
 * Retrieve the child page references for a knowledge page.
 * @param {string} [path] - The knowledge page path to query; if falsy, the root knowledge path is used.
 * @returns {Array<Object>} An array of child page reference objects parsed from the stored JSON, or an empty array if none are found or parsing fails.
 */
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

function resetCachesForTests() {
    childPagesCache.flushAll();
    pageCache.flushAll();
}

module.exports = {
    getChildPages,
    getKnowledgePage,
    // Export utility functions for targeted unit tests
    normalizePath,
    extractMetadata,
    extractBodyContent,
    __resetCaches: resetCachesForTests,
};
