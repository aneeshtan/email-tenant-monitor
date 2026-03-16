import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const DEFAULT_DB_PATH = process.env.DB_PATH || './data/tenant-domains.db';

function ensureParentDirectory(filePath) {
  const absolutePath = path.resolve(filePath);
  const directory = path.dirname(absolutePath);
  fs.mkdirSync(directory, { recursive: true });
  return absolutePath;
}

export function createDb(dbPath = DEFAULT_DB_PATH) {
  const absoluteDbPath = ensureParentDirectory(dbPath);
  const db = new Database(absoluteDbPath);

  db.exec(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS domains (
      domain TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      organization_name TEXT,
      source TEXT,
      confidence TEXT DEFAULT 'observed',
      last_checked TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_domains_tenant_id ON domains(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_domains_organization_name ON domains(organization_name);
  `);

  return db;
}

export function upsertDomain(db, record) {
  const stmt = db.prepare(`
    INSERT INTO domains (
      domain,
      tenant_id,
      organization_name,
      source,
      confidence,
      last_checked,
      created_at
    ) VALUES (
      @domain,
      @tenant_id,
      @organization_name,
      @source,
      @confidence,
      @last_checked,
      @created_at
    )
    ON CONFLICT(domain) DO UPDATE SET
      tenant_id = excluded.tenant_id,
      organization_name = COALESCE(excluded.organization_name, domains.organization_name),
      source = excluded.source,
      confidence = excluded.confidence,
      last_checked = excluded.last_checked
  `);

  stmt.run(record);
}

export function findTenantByDomain(db, domain) {
  const stmt = db.prepare(`
    SELECT tenant_id, organization_name
    FROM domains
    WHERE lower(domain) = lower(?)
    LIMIT 1
  `);

  return stmt.get(domain) || null;
}

export function findDomainsByTenant(db, tenantId) {
  const stmt = db.prepare(`
    SELECT domain, tenant_id, organization_name, source, confidence, last_checked
    FROM domains
    WHERE tenant_id = ?
    ORDER BY domain COLLATE NOCASE ASC
  `);

  return stmt.all(tenantId);
}

export function findDomainsByOrganization(db, organizationName, limit = 250) {
  const stmt = db.prepare(`
    SELECT domain, tenant_id, organization_name, source, confidence, last_checked
    FROM domains
    WHERE organization_name LIKE '%' || ? || '%'
    ORDER BY organization_name COLLATE NOCASE ASC, domain COLLATE NOCASE ASC
    LIMIT ?
  `);

  return stmt.all(organizationName, limit);
}

export function stats(db) {
  const row = db.prepare('SELECT COUNT(*) AS total_domains, COUNT(DISTINCT tenant_id) AS total_tenants FROM domains').get();
  return row;
}
