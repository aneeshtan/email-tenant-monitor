import 'dotenv/config';
import fs from 'node:fs';
import readline from 'node:readline';
import pLimit from 'p-limit';
import { createDb, upsertDomain } from '../db.js';
import { normalizeDomain, resolveTenantProfile } from '../lib/m365.js';

const fileArgIndex = process.argv.findIndex((arg) => arg === '--file' || arg === '-f');
const filePath = fileArgIndex >= 0 ? process.argv[fileArgIndex + 1] : null;

if (!filePath) {
  console.error('Usage: npm run ingest -- --file ./domains.txt');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const db = createDb();
const timeoutMs = Number(process.env.INGEST_TIMEOUT_MS || 12000);
const concurrency = Number(process.env.INGEST_CONCURRENCY || 6);
const limiter = pLimit(concurrency);

const stream = fs.createReadStream(filePath);
const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

const jobs = [];
let processed = 0;
let succeeded = 0;
let failed = 0;

for await (const line of rl) {
  const domain = normalizeDomain(line);

  if (!domain || domain.startsWith('#')) {
    continue;
  }

  const job = limiter(async () => {
    processed += 1;

    try {
      const resolved = await resolveTenantProfile(domain, timeoutMs);
      const nowIso = new Date().toISOString();

      upsertDomain(db, {
        ...resolved,
        source: 'bulk-ingest',
        confidence: 'observed',
        last_checked: nowIso,
        created_at: nowIso
      });

      succeeded += 1;

      if (processed % 50 === 0) {
        console.log(`Processed ${processed} domains (ok=${succeeded}, fail=${failed})`);
      }
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${domain}] ${message}`);
    }
  });

  jobs.push(job);
}

await Promise.all(jobs);

console.log('Ingest complete');
console.log(`Total: ${processed}`);
console.log(`Success: ${succeeded}`);
console.log(`Failed: ${failed}`);
