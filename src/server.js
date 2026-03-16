import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createDb,
  findTenantByDomain,
  findDomainsByOrganization,
  findDomainsByTenant,
  stats,
  upsertDomain
} from './db.js';
import { isTenantId, normalizeDomain, resolveTenantProfile } from './lib/m365.js';
import {
  isUpstreamEnabled,
  searchTenantDomainsUpstream,
  searchTenantNameUpstream
} from './lib/upstream.js';

const app = express();
const port = Number(process.env.PORT || 3000);
const db = createDb();
const privacyMode = String(process.env.PRIVACY_MODE || 'false').toLowerCase() !== 'false';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/stats', (_req, res) => {
  res.json(stats(db));
});

app.get('/api/privacy', (_req, res) => {
  res.json({
    privacy_mode: privacyMode,
    live_microsoft_lookup_enabled: !privacyMode,
    upstream_enabled: !privacyMode && isUpstreamEnabled()
  });
});

app.get('/api/lookup', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const preferUpstream = String(req.query.prefer_upstream || '').trim() === '1';

  if (!q) {
    return res.status(400).json({ error: 'Missing required query parameter: q' });
  }

  let tenantId = null;
  let domain = null;
  let organizationName = null;
  let profileSource = 'database';
  let upstreamUsed = false;
  let upstreamDomainsAdded = 0;
  let upstreamDomainTotal = null;
  let upstreamError = null;

  try {
    if (isTenantId(q)) {
      tenantId = q.toLowerCase();
    } else {
      domain = normalizeDomain(q);

      if (!domain || !domain.includes('.')) {
        return res.status(400).json({ error: 'Provide a valid domain or tenant GUID.' });
      }

      const existing = findTenantByDomain(db, domain);

      if (existing) {
        tenantId = existing.tenant_id;
        organizationName = existing.organization_name || null;
      } else {
        if (privacyMode) {
          return res.status(404).json({
            error: 'No local match for this domain in privacy mode.',
            detail:
              'Privacy mode is enabled, so external lookups are blocked. Import or ingest this domain into the local database first.'
          });
        }

        const resolved = await resolveTenantProfile(
          domain,
          Number(process.env.INGEST_TIMEOUT_MS || 12000)
        );

        const nowIso = new Date().toISOString();

        upsertDomain(db, {
          ...resolved,
          source: 'live-openid+realm',
          confidence: 'observed',
          last_checked: nowIso,
          created_at: nowIso
        });

        tenantId = resolved.tenant_id;
        organizationName = resolved.organization_name || null;
        profileSource = 'live';
      }
    }

    let domains = findDomainsByTenant(db, tenantId);

    const shouldAttemptUpstream =
      !privacyMode &&
      isUpstreamEnabled() &&
      (preferUpstream || Boolean(domain) || domains.length <= 1);

    if (shouldAttemptUpstream) {
      try {
        const upstreamResult = await searchTenantDomainsUpstream(
          tenantId,
          Number(process.env.UPSTREAM_TIMEOUT_MS || 15000)
        );

        if (upstreamResult?.domains?.length) {
          upstreamUsed = true;
          upstreamDomainTotal = Number(upstreamResult.total || upstreamResult.domains.length);

          const nowIso = new Date().toISOString();

          for (const upstreamDomain of upstreamResult.domains) {
            upsertDomain(db, {
              domain: upstreamDomain,
              tenant_id: upstreamResult.tenant_id,
              organization_name: organizationName,
              source: 'upstream-tenant-api',
              confidence: 'imported',
              last_checked: nowIso,
              created_at: nowIso
            });
            upstreamDomainsAdded += 1;
          }

          domains = findDomainsByTenant(db, tenantId);
        }
      } catch (error) {
        upstreamError = error instanceof Error ? error.message : String(error);
      }
    }

    return res.json({
      query: q,
      tenant_id: tenantId,
      source: profileSource,
      upstream_used: upstreamUsed,
      upstream_domains_added: upstreamDomainsAdded,
      upstream_total: upstreamDomainTotal,
      upstream_error: upstreamError,
      total_domains: domains.length,
      domains
    });
  } catch (error) {
    return res.status(502).json({
      error: 'Lookup failed',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.get('/api/search/org', (req, res) => {
  const q = String(req.query.q || '').trim();
  const limit = Math.min(Number(req.query.limit || 250), 1000);

  if (!q) {
    return res.status(400).json({ error: 'Missing required query parameter: q' });
  }

  const domains = findDomainsByOrganization(db, q, limit);

  return res.json({
    query: q,
    total_domains: domains.length,
    domains
  });
});

app.get('/api/search/tenant-name', async (req, res) => {
  const q = String(req.query.q || '').trim();

  if (!q) {
    return res.status(400).json({ error: 'Missing required query parameter: q' });
  }

  if (privacyMode) {
    return res.status(403).json({
      error: 'Tenant name search is disabled in privacy mode.',
      detail: 'Disable PRIVACY_MODE to use upstream tenant-name search.'
    });
  }

  try {
    const tenants = await searchTenantNameUpstream(
      q,
      Number(process.env.UPSTREAM_TIMEOUT_MS || 15000)
    );

    return res.json({
      query: q,
      total_tenants: tenants.length,
      tenants
    });
  } catch (error) {
    return res.status(502).json({
      error: 'Tenant name lookup failed',
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

app.use((error, _req, res, _next) => {
  res.status(500).json({
    error: 'Unhandled server error',
    detail: error instanceof Error ? error.message : String(error)
  });
});

app.listen(port, () => {
  console.log(`Tenant domain finder running on http://localhost:${port}`);
});
