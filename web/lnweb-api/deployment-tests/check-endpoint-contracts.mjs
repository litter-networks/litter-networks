// Copyright Litter Networks / Clean and Green Communities CIC
// SPDX-License-Identifier: Apache-2.0

import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(ROOT, '..');
const CONFIG_PATH = path.join(ROOT, 'endpoint-config.json');
const OUTPUT_DIR = path.join(ROOT, 'latest-responses');
const API_BASE = process.env.API_BASE_URL ?? 'https://aws.litternetworks.org/api';
const SUPPORTS_COLOR = process.stdout.isTTY;
const COLOR_GREEN = '\u001b[32m';
const COLOR_RED = '\u001b[31m';
const COLOR_RESET = '\u001b[0m';

async function loadConfig() {
  const payload = await fs.readFile(CONFIG_PATH, 'utf8');
  return JSON.parse(payload);
}

async function resetOutputDir() {
  try {
    await fs.rm(OUTPUT_DIR, { recursive: true, force: true });
  } catch (err) {
    // ignore
  }
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
}

async function requestEndpoint(url, entry) {
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
  await ensureTypeScriptBuild();
  const config = await loadConfig();
  await resetOutputDir();
  let failed = false;

  for (const entry of config) {
    const url = `${API_BASE}${entry.path}`;
    process.stdout.write(`Checking [${url}] ... `);
    const outputFile = path.join(
      OUTPUT_DIR,
      `${entry.name}${entry.type === 'json' ? '.json' : entry.type === 'csv' ? '.csv' : '.txt'}`
    );
    try {
      const body = await requestEndpoint(url, entry);
      await fs.writeFile(outputFile, body, 'utf8');

      if (entry.type === 'csv') {
        const parsed = parseCsv(body);
        if (entry.schema) {
          validateCsvSchema(parsed, entry.schema, entry.name);
        }
        if (entry.anchors) {
          checkCsvAnchors(parsed, entry.anchors, entry.name);
        }
      } else {
        const parsed = JSON.parse(body);
        if (entry.schema) {
          validateSchema(parsed, entry.schema, entry.name);
        }
        if (entry.anchors) {
          checkAnchors(parsed, entry.anchors, entry.name);
        }
      }
      console.log(colorize('OK', COLOR_GREEN));
    } catch (error) {
      console.log(colorize('✗ error', COLOR_RED));
      console.error(`  ${entry.name} (${entry.path}) failed: ${error.message}`);
      failed = true;
    }
  }

  if (failed) {
    throw new Error('One or more endpoint checks failed');
  }
}

async function ensureTypeScriptBuild() {
  if (process.env.SKIP_TS_BUILD === 'true') {
    return;
  }
  await runCommand('npm', ['run', 'build'], { cwd: PROJECT_ROOT });
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
    child.on('error', reject);
  });
}

function colorize(text, color) {
  if (!SUPPORTS_COLOR) {
    return text;
  }
  return `${color}${text}${COLOR_RESET}`;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim() !== '');
  const rows = lines.map(splitCsvLine);
  const headers = rows.shift() ?? [];
  return { headers, rows };
}

function splitCsvLine(line) {
  const values = [];
  let buffer = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && !inQuotes) {
      inQuotes = true;
      continue;
    }
    if (char === '"' && inQuotes) {
      if (line[i + 1] === '"') {
        buffer += '"';
        i += 1;
        continue;
      }
      inQuotes = false;
      continue;
    }
    if (char === ',' && !inQuotes) {
      values.push(buffer);
      buffer = '';
      continue;
    }
    buffer += char;
  }
  values.push(buffer);
  return values.map((value) => value.trim());
}

function validateCsvSchema(parsed, schema, name) {
  const headers = parsed.headers;
  if (Array.isArray(schema.headers)) {
    for (const header of schema.headers) {
      if (!headers.includes(header)) {
        throw new Error(`CSV schema violation for ${name}: missing column "${header}"`);
      }
    }
  }
}

function checkCsvAnchors(parsed, anchors, name) {
  for (const anchor of anchors) {
    const index = parsed.headers.indexOf(anchor.column);
    if (index === -1) {
      throw new Error(`CSV anchor column not found for ${name}: ${anchor.column}`);
    }
    const exists = parsed.rows.some((row) => matchesValue(row[index], anchor.value));
    if (!exists) {
      throw new Error(
        `CSV anchor missing for ${name}: no row with ${anchor.column}=${anchor.value}`
      );
    }
  }
}

function validateSchema(value, schema, name, pathTrace = 'root') {
  if (!schema || schema.type === undefined) {
    return;
  }
  if (schema.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error(`Schema violation for ${name} at ${pathTrace}: expected object`);
    }
    if (Array.isArray(schema.required)) {
      for (const key of schema.required) {
        if (!Object.prototype.hasOwnProperty.call(value, key)) {
          throw new Error(`Schema violation for ${name} at ${pathTrace}: missing key ${key}`);
        }
      }
    }
    if (schema.properties) {
      for (const [key, propertySchema] of Object.entries(schema.properties)) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
          validateSchema(value[key], propertySchema, name, `${pathTrace}.${key}`);
        }
      }
    }
  } else if (schema.type === 'array') {
    if (!Array.isArray(value)) {
      throw new Error(`Schema violation for ${name} at ${pathTrace}: expected array`);
    }
    if (schema.minItems && value.length < schema.minItems) {
      throw new Error(
        `Schema violation for ${name} at ${pathTrace}: expected at least ${schema.minItems} items`
      );
    }
    if (schema.itemSchema) {
      value.forEach((item, index) =>
        validateSchema(item, schema.itemSchema, name, `${pathTrace}[${index}]`)
      );
    }
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') {
      throw new Error(`Schema violation for ${name} at ${pathTrace}: expected string`);
    }
  } else if (schema.type === 'number') {
    if (typeof value !== 'number') {
      throw new Error(`Schema violation for ${name} at ${pathTrace}: expected number`);
    }
  }
}

function checkAnchors(value, anchors, name) {
  for (const anchor of anchors) {
    const pathSegments = anchor.path.split('.');
    const nodes = collectNodes(value, pathSegments);
    const found = nodes.some(
      (node) =>
        typeof node === 'object' &&
        node !== null &&
        Object.entries(anchor.matches ?? {}).every(([key, expected]) =>
          matchesValue(node[key], expected)
        )
    );
    if (!found) {
      throw new Error(`Anchor validation failed for ${name}: ${JSON.stringify(anchor)}`);
    }
  }
}

function collectNodes(current, parts) {
  if (!parts.length) {
    return [current];
  }
  const [segment, ...rest] = parts;
  const arrayMatch = segment.match(/^(.+)\[\*\]$/);
  if (arrayMatch) {
    const key = arrayMatch[1];
    const next = current?.[key];
    if (!Array.isArray(next)) {
      return [];
    }
    return next.flatMap((item) => collectNodes(item, rest));
  }
  if (segment === '[*]') {
    if (!Array.isArray(current)) {
      return [];
    }
    return current.flatMap((item) => collectNodes(item, rest));
  }
  if (typeof current === 'object' && current !== null && segment in current) {
    return collectNodes(current[segment], rest);
  }
  return [];
}

function matchesValue(actual, expected) {
  if (expected === '*') {
    return true;
  }
  if (typeof expected === 'object' && expected !== null && expected.pattern) {
    return new RegExp(expected.pattern).test(String(actual ?? ''));
  }
  return String(actual ?? '') === String(expected);
}

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const CALLER_PATH = process.argv[1] ? path.resolve(process.cwd(), process.argv[1]) : null;
if (CALLER_PATH === SCRIPT_PATH) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
