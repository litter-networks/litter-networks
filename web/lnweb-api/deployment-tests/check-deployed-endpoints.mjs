import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(ROOT, 'endpoint-config.json');
const GOLDEN_DIR = path.join(ROOT, 'goldens');
const OUTPUT_DIR = path.join(ROOT, 'latest-responses');
const API_BASE = process.env.API_BASE_URL ?? 'https://aws.litternetworks.org/api';
const UPDATE = process.argv.includes('--update');

async function loadConfig() {
  const payload = await fs.readFile(CONFIG_PATH, 'utf8');
  return JSON.parse(payload);
}

async function ensureGoldenDir() {
  try {
    await fs.mkdir(GOLDEN_DIR, { recursive: true });
  } catch (err) {
    // ignore
  }
}

async function resetOutputDir() {
  try {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  } catch (err) {
    // ignore
  }
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function requestEndpoint(entry) {
  const url = `${API_BASE}${entry.path}`;
  const response = await fetch(url, {
    method: entry.method ?? 'GET',
    headers: entry.headers ?? { Accept: entry.type === 'json' ? 'application/json' : '*/*' },
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Endpoint ${entry.path} returned ${response.status}`);
  }
  return body;
}

async function run() {
  const config = await loadConfig();
  await ensureGoldenDir();
  await resetOutputDir();
  let failed = false;

  for (const entry of config) {
    const printLabel = `${entry.name} (${entry.path})`;
    process.stdout.write(`Checking ${printLabel} ... `);
    try {
      const body = await requestEndpoint(entry);
      const extension =
        entry.extension ??
        (entry.type === 'json' ? '.json' : entry.type === 'text' ? '.txt' : '.golden');
      const targetFile = path.join(GOLDEN_DIR, `${entry.name}${extension}`);
      const outputFile = path.join(OUTPUT_DIR, `${entry.name}${extension}`);
      await fs.writeFile(outputFile, body, 'utf8');

      if (UPDATE) {
        await fs.writeFile(targetFile, body, 'utf8');
        console.log('updated');
        continue;
      }

      const existing = await fs.readFile(targetFile, 'utf8');
      const normalizedBody = normalizeBody(body, entry);
      const normalizedExisting = normalizeBody(existing, entry);
      if (normalizedExisting !== normalizedBody) {
        console.log('✗ mismatch');
        console.error(`  ${printLabel} did not match golden file.`);
        failed = true;
      } else {
        console.log('OK');
      }
    } catch (error) {
      console.log('✗ error');
      console.error(`  ${printLabel} failed: ${error.message}`);
      failed = true;
    }
  }

  if (failed && !UPDATE) {
    throw new Error('One or more endpoint checks failed');
  }
}

const SCRIPT_PATH = fileURLToPath(import.meta.url);
if (process.argv[1] === SCRIPT_PATH) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

function normalizeBody(payload, entry) {
  const type = entry.type ?? 'text';
  if (type === 'json') {
    return normalizeJson(payload, entry.rules?.json ?? {});
  }
  return normalizeText(payload, entry.rules?.text ?? {});
}

function normalizeJson(payload, rules = {}) {
  let parsed;
  try {
    parsed = JSON.parse(payload);
  } catch (error) {
    throw new Error(`JSON response was invalid: ${error.message}`);
  }

  const ignorePaths = Array.isArray(rules.ignorePaths) ? rules.ignorePaths : [];
  for (const path of ignorePaths) {
    removeJsonPath(parsed, path);
  }

  const canonical = canonicalizeJson(parsed);
  return JSON.stringify(canonical);
}

function removeJsonPath(target, rawPath) {
  if (!rawPath) {
    return;
  }
  const parts = rawPath.split('.');
  removePathParts(target, parts);
}

function removePathParts(current, parts) {
  if (!parts.length || current == null) {
    return;
  }
  const [rawKey, ...rest] = parts;
  const isArray = rawKey.endsWith('[]');
  const key = isArray ? rawKey.slice(0, -2) : rawKey;

  if (!key) {
    return;
  }

  if (rest.length === 0) {
    if (isArray && Array.isArray(current[key])) {
      delete current[key];
    } else if (Object.prototype.hasOwnProperty.call(current, key)) {
      delete current[key];
    }
    return;
  }

  const next = current[key];
  if (next == null) {
    return;
  }

  if (isArray && Array.isArray(next)) {
    for (const item of next) {
      removePathParts(item, rest);
    }
  } else if (!isArray) {
    removePathParts(next, rest);
  }
}

function canonicalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalizeJson);
  }
  if (isPlainObject(value)) {
    const sorted = {};
    const keys = Object.keys(value).sort();
    for (const key of keys) {
      sorted[key] = canonicalizeJson(value[key]);
    }
    return sorted;
  }
  return value;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && value.constructor === Object;
}

function normalizeText(payload, rules = {}) {
  const shouldNormalizeNewlines = rules.normalizeNewlines ?? true;
  const lineNormalized = shouldNormalizeNewlines
    ? payload.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    : payload;
  const hasTrailingNewline = lineNormalized.endsWith('\n');
  if (!rules || Object.keys(rules).length === 0) {
    return lineNormalized;
  }

  let lines = lineNormalized.split('\n');
  if (!rules.keepTrailingEmptyLine && hasTrailingNewline && lines[lines.length - 1] === '') {
    lines.pop();
  }

  if (rules.trimLines) {
    lines = lines.map((line) => line.trim());
  }

  if (rules.skipEmptyLines) {
    lines = lines.filter((line) => line.length > 0);
  }

  let header;
  if (rules.skipHeader && lines.length) {
    header = lines.shift();
  }

  if (rules.sortRows) {
    lines.sort();
  }

  const normalizedRows = header !== undefined ? [header, ...lines] : lines;
  let result = normalizedRows.join('\n');
  if (hasTrailingNewline) {
    result += '\n';
  }
  return result;
}
