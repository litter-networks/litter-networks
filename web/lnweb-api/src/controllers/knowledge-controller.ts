const { DynamoDBClient, GetItemCommand } = require("@aws-sdk/client-dynamodb");
const { S3Client, GetObjectCommand } = require("@aws-sdk/client-s3");
const NodeCache = require("node-cache");

type KnowledgeMetadata = Record<string, string>;

type KnowledgePage = {
  bodyContent: string;
  metadata: {
    title: string;
    description: string;
  };
};

type ChildPageRef = {
  pageUrl: string;
  pageTitle: string;
  pageDescription?: string;
  childPages?: ChildPageRef[];
};

const dynamoDbClient = new DynamoDBClient({ region: "eu-west-2" });
const s3Client = new S3Client({ region: "eu-west-2" });
const childPagesCache: InstanceType<typeof NodeCache> = new NodeCache({
  stdTTL: 5 * 60,
  checkperiod: 120,
});
const metadataCache: InstanceType<typeof NodeCache> = new NodeCache({
  stdTTL: 5 * 60,
  checkperiod: 120,
});
const pageCache: InstanceType<typeof NodeCache> = new NodeCache({
  stdTTL: 5 * 60,
  checkperiod: 120,
});
const TABLE_NAME = "LN-Knowledge";
const S3_BUCKET_NAME = "lnweb-docs";

/**
 * Normalize an input into a canonical knowledge page path.
 *
 * Trims whitespace, removes leading and trailing slashes, and ensures the path begins with `knowledge/`.
 * If `path` is falsy, returns `"knowledge"`.
 *
 */
function normalizePath(path?: string): string {
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
 */
/**
 * Extracts the inner HTML of the document's <body> element.
 */
function extractBodyContent(htmlContent: string): string {
    const match = htmlContent.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    return match ? match[1] : htmlContent;
}

async function streamToString(body: unknown): Promise<string> {
    if (!body) {
        return "";
    }
    if (typeof (body as any).transformToString === "function") {
        return (body as any).transformToString("utf-8");
    }
    if (typeof body === "string") {
        return body;
    }
    if (Buffer.isBuffer(body)) {
        return body.toString("utf-8");
    }
    const chunks: Buffer[] = [];
    for await (const chunk of body as AsyncIterable<Uint8Array> | Iterable<Uint8Array>) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Retrieve a knowledge page's HTML body and its metadata, using S3 fetch with in-memory caching.
 *
 * @throws {Error} When the S3 fetch fails.
 */
async function getKnowledgePage(path?: string): Promise<KnowledgePage> {
    const normalizedPath = normalizePath(path);
    const cacheKey = `knowledge-page:${normalizedPath}`;
    const cached = pageCache.get(cacheKey) as KnowledgePage | undefined;
    if (cached) {
        return cached;
    }

    const key = `docs/${normalizedPath}.html`;
    const command = new GetObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
    });
    const response = await s3Client.send(command);
    if (!response.Body) {
        throw new Error(`Failed to fetch knowledge page: ${normalizedPath}`);
    }
    const html = await streamToString(response.Body);
    const metadataFromDynamo = await fetchMetadata(normalizedPath);
    const bodyContent = extractBodyContent(html);

    const result: KnowledgePage = {
      bodyContent,
      metadata: {
        title: metadataFromDynamo.title || "Knowledge",
        description: metadataFromDynamo.description || "",
      },
    };

    pageCache.set(cacheKey, result);
    return result;
}

/**
 * Retrieve the child page references for a knowledge page.
 */
function cacheMetadata(normalizedPath: string, title?: string, description?: string): void {
  const cacheKey = `knowledge-meta:${normalizedPath}`;
  const metadata = metadataCache.get(cacheKey) as KnowledgeMetadata | undefined;
  const next: KnowledgeMetadata = {
    ...(metadata ?? {}),
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
  };
  metadataCache.set(cacheKey, next);
}

async function fetchMetadata(normalizedPath: string): Promise<KnowledgeMetadata> {
  const cacheKey = `knowledge-meta:${normalizedPath}`;
  const cached = metadataCache.get(cacheKey) as KnowledgeMetadata | undefined;
  if (cached) {
    return cached;
  }

  const command = new GetItemCommand({
    TableName: TABLE_NAME,
    Key: {
      uniqueId: { S: `docs/${normalizedPath}` },
    },
    ProjectionExpression: "title, description",
  });
  const data = await dynamoDbClient.send(command);
  const title = data.Item?.title?.S;
  const description = data.Item?.description?.S;
  cacheMetadata(normalizedPath, title, description);
  return metadataCache.get(cacheKey) as KnowledgeMetadata;
}

async function getChildPages(path?: string): Promise<ChildPageRef[]> {
  const normalizedPath = normalizePath(path);
  const cacheKey = `child-pages:${normalizedPath}`;
  const cached = childPagesCache.get(cacheKey) as ChildPageRef[] | undefined;
  if (cached) {
    return cached;
  }

    const command = new GetItemCommand({
      TableName: TABLE_NAME,
      Key: {
        uniqueId: { S: `docs/${normalizedPath}` },
      },
    ProjectionExpression: "childPages, title, description",
    });

    const data = await dynamoDbClient.send(command);
    let childPages: ChildPageRef[] = [];

    if (data.Item?.childPages?.S) {
      try {
        const normalizedJson = data.Item.childPages.S.replace(/docs\//g, "");
        childPages = JSON.parse(normalizedJson) as ChildPageRef[];
      } catch (error: any) {
        console.error("Failed to parse knowledge child pages:", error);
        childPages = [];
      }
    }

    cacheMetadata(normalizedPath, data.Item?.title?.S, data.Item?.description?.S);

    childPagesCache.set(cacheKey, childPages);
    return childPages;
  }

function resetCachesForTests(): void {
    childPagesCache.flushAll();
    metadataCache.flushAll();
    pageCache.flushAll();
}

module.exports = {
    getChildPages,
    getKnowledgePage,
    // Export utility functions for targeted unit tests
    normalizePath,
    extractBodyContent,
    __resetCaches: resetCachesForTests,
};
