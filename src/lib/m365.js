const TENANT_GUID_PATTERN =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/;

export function normalizeDomain(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '');
}

export function extractTenantIdFromOpenIdConfig(json) {
  if (!json || typeof json !== 'object') {
    return null;
  }

  const candidates = [
    json.token_endpoint,
    json.authorization_endpoint,
    json.issuer
  ].filter(Boolean);

  for (const candidate of candidates) {
    const match = String(candidate).match(TENANT_GUID_PATTERN);
    if (match) {
      return match[0].toLowerCase();
    }
  }

  return null;
}

function buildAbortController(timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return { controller, timer };
}

export async function resolveTenantProfile(domain, timeoutMs = 12000) {
  const normalizedDomain = normalizeDomain(domain);

  if (!normalizedDomain || !normalizedDomain.includes('.')) {
    throw new Error('Invalid domain value.');
  }

  const { controller, timer } = buildAbortController(timeoutMs);

  try {
    const [openidResponse, realmResponse] = await Promise.all([
      fetch(`https://login.microsoftonline.com/${encodeURIComponent(normalizedDomain)}/v2.0/.well-known/openid-configuration`, {
        signal: controller.signal,
        headers: { accept: 'application/json' }
      }),
      fetch(`https://login.microsoftonline.com/getuserrealm.srf?login=user@${encodeURIComponent(normalizedDomain)}&json=1`, {
        signal: controller.signal,
        headers: { accept: 'application/json' }
      })
    ]);

    if (!openidResponse.ok) {
      throw new Error(`OpenID metadata request failed with ${openidResponse.status}`);
    }

    const openidJson = await openidResponse.json();
    const realmJson = realmResponse.ok ? await realmResponse.json() : {};

    const tenantId = extractTenantIdFromOpenIdConfig(openidJson);

    if (!tenantId) {
      throw new Error('Unable to extract tenant ID from OpenID metadata response.');
    }

    const organizationName = realmJson?.FederationBrandName || null;

    return {
      domain: normalizedDomain,
      tenant_id: tenantId,
      organization_name: organizationName
    };
  } finally {
    clearTimeout(timer);
  }
}

export function isTenantId(value) {
  return TENANT_GUID_PATTERN.test(String(value || '').trim());
}
