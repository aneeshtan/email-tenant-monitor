const DEFAULT_UPSTREAM_BASE = 'https://tenant-api.micahvandeusen.com';

function withTimeout(timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timer };
}

function normalizeBaseUrl(baseUrl) {
  return String(baseUrl || DEFAULT_UPSTREAM_BASE).replace(/\/$/, '');
}

export function isUpstreamEnabled() {
  return String(process.env.UPSTREAM_ENABLED || 'true').toLowerCase() !== 'false';
}

export function upstreamBaseUrl() {
  return normalizeBaseUrl(process.env.UPSTREAM_API_BASE || DEFAULT_UPSTREAM_BASE);
}

export async function searchTenantDomainsUpstream(tenantId, timeoutMs = 15000) {
  if (!isUpstreamEnabled()) {
    return null;
  }

  const url = `${upstreamBaseUrl()}/search?tenant_id=${encodeURIComponent(tenantId)}`;
  const { controller, timer } = withTimeout(timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' }
    });

    if (!response.ok) {
      return null;
    }

    const body = await response.json();
    const domains = Array.isArray(body?.domains) ? body.domains : [];

    return {
      tenant_id: String(body?.tenant || tenantId).toLowerCase(),
      total: Number(body?.total || domains.length),
      domains: domains
        .map((value) => String(value || '').trim().toLowerCase())
        .filter(Boolean)
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function searchTenantNameUpstream(nameQuery, timeoutMs = 15000) {
  if (!isUpstreamEnabled()) {
    return [];
  }

  const url = `${upstreamBaseUrl()}/search_tenant_name?q=${encodeURIComponent(nameQuery)}`;
  const { controller, timer } = withTimeout(timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' }
    });

    if (!response.ok) {
      return [];
    }

    const body = await response.json();

    if (!Array.isArray(body)) {
      return [];
    }

    return body
      .map((row) => ({
        tenant_id: String(row?.tenant_id || '').trim().toLowerCase(),
        tenant_name: String(row?.tenant_name || '').trim()
      }))
      .filter((row) => row.tenant_id && row.tenant_name);
  } finally {
    clearTimeout(timer);
  }
}
