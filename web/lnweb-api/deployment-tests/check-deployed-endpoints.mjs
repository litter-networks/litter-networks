import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = path.join(ROOT, 'endpoint-config.json');
const GOLDEN_DIR = path.join(ROOT, 'goldens');
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

      if (UPDATE) {
        await fs.writeFile(targetFile, body, 'utf8');
        console.log('updated');
        continue;
      }

      const existing = await fs.readFile(targetFile, 'utf8');
      if (existing !== body) {
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
