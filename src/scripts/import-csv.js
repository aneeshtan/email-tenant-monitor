import 'dotenv/config';
import fs from 'node:fs';
import readline from 'node:readline';
import { createDb, upsertDomain } from '../db.js';
import { normalizeDomain } from '../lib/m365.js';

const fileArgIndex = process.argv.findIndex((arg) => arg === '--file' || arg === '-f');
const filePath = fileArgIndex >= 0 ? process.argv[fileArgIndex + 1] : null;

if (!filePath) {
  console.error('Usage: npm run import:csv -- --file ./tenant-domains.csv');
  process.exit(1);
}

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const db = createDb();
const stream = fs.createReadStream(filePath);
const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

let total = 0;
let inserted = 0;

for await (const line of rl) {
  total += 1;

  if (total === 1 && /domain/i.test(line) && /tenant/i.test(line)) {
    continue;
  }

  const [rawDomain, rawTenantId, rawOrgName, rawSource] = line.split(',');
  const domain = normalizeDomain(rawDomain || '');
  const tenantId = String(rawTenantId || '').trim().toLowerCase();
  const organizationName = String(rawOrgName || '').trim() || null;

  if (!domain || !tenantId) {
    continue;
  }

  const nowIso = new Date().toISOString();

  upsertDomain(db, {
    domain,
    tenant_id: tenantId,
    organization_name: organizationName,
    source: rawSource ? rawSource.trim() : 'csv-import',
    confidence: 'imported',
    last_checked: nowIso,
    created_at: nowIso
  });

  inserted += 1;

  if (inserted % 1000 === 0) {
    console.log(`Imported ${inserted} rows...`);
  }
}

console.log(`CSV rows read: ${total}`);
console.log(`Rows imported: ${inserted}`);
