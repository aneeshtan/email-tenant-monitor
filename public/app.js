const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const searchLabel = document.getElementById('search-label');
const searchButton = document.getElementById('search-button');
const modeDescription = document.getElementById('mode-description');
const exampleCaption = document.getElementById('example-caption');
const exampleList = document.getElementById('example-list');
const modeButtons = Array.from(document.querySelectorAll('.mode-button'));
const resultTitleEl = document.getElementById('result-title');
const resultGroupsEl = document.getElementById('result-groups');
const resultHighlightsEl = document.getElementById('result-highlights');
const statusEl = document.getElementById('status');
const summaryOrgEl = document.getElementById('summary-org');
const summaryTenantEl = document.getElementById('summary-tenant');
const summaryTotalEl = document.getElementById('summary-total');
const summarySourceEl = document.getElementById('summary-source');
const statsPill = document.getElementById('stats-pill');
const privacyPill = document.getElementById('privacy-pill');
const privacySummaryEl = document.getElementById('privacy-summary');
const copyTenantButton = document.getElementById('copy-tenant-button');
const shareLinkButton = document.getElementById('share-link-button');
const exportCsvButton = document.getElementById('export-csv-button');
const exportPdfButton = document.getElementById('export-pdf-button');
const appVersionEl = document.getElementById('app-version');
let appVersion = '?';

const modeConfig = {
  domain: {
    label: 'Domain',
    placeholder: 'contoso.com',
    description:
      'Resolve a domain, expand sibling domains when available, and see the tenant behind it.',
    exampleCaption: 'Tap to run a domain lookup',
    examples: [
      'contoso.com',
      'microsoft.com',
      'adatum.com'
    ]
  },
  organization: {
    label: 'Organization',
    placeholder: 'Centurion Shipping',
    description:
      'Search the local dataset by organization or brand name and inspect every matching domain.',
    exampleCaption: 'Tap to search by organization name',
    examples: [
      'Centurion Shipping',
      'House of Shipping',
      'Contoso'
    ]
  },
  tenant: {
    label: 'Tenant ID',
    placeholder: '8c3dbb07-e9c4-43cc-8656-d8b75b0b8b0f',
    description:
      'Inspect a known tenant directly and review all domains currently attached to it.',
    exampleCaption: 'Tap to search by tenant ID',
    examples: [
      '8c3dbb07-e9c4-43cc-8656-d8b75b0b8b0f',
      '00000000-0000-0000-0000-000000000000'
    ]
  }
};

const emptyReportState = {
  mode: 'domain',
  query: '',
  title: 'Ready when you are',
  tenantId: '',
  totalDomains: 0,
  rows: [],
  groups: [],
  organization: '-',
  sourceLabel: 'Awaiting search',
  shareUrl: '',
  highlights: []
};

let activeMode = 'domain';
let reportState = { ...emptyReportState };
let privacyState = {
  privacyMode: true,
  liveLookupEnabled: false,
  upstreamEnabled: false
};

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function formatDate(value) {
  if (!value) {
    return '-';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function formatGeneratedTimestamp() {
  return new Date().toLocaleString();
}

function reportAttributionText() {
  return `© Tenant Domain Finder (v${appVersion}) · Created by AI, prompted by F&G.`;
}

function reportUrl() {
  return reportState.shareUrl || buildShareUrl() || window.location.href;
}

function sourceLabel(source) {
  const map = {
    'live-openid+realm': 'Live Microsoft',
    'upstream-tenant-api': 'Upstream dataset'
  };

  return map[source] || source || '-';
}

function setStatus(message, variant = 'neutral') {
  statusEl.textContent = message;
  statusEl.className = `status status-${variant}`;
}

function setActionState() {
  const hasRows = reportState.rows.length > 0;
  copyTenantButton.disabled = !reportState.tenantId;
  shareLinkButton.disabled = !reportState.shareUrl;
  exportCsvButton.disabled = !hasRows;
  exportPdfButton.disabled = !hasRows;
}

function setSummary({ organization, tenantId, totalDomains, source }) {
  summaryOrgEl.textContent = organization || '-';
  summaryTenantEl.textContent = tenantId || '-';
  summaryTotalEl.textContent = String(totalDomains || 0);
  summarySourceEl.textContent = source || 'Awaiting search';
}

function renderHighlights(highlights) {
  if (!highlights.length) {
    resultHighlightsEl.innerHTML = '';
    return;
  }

  resultHighlightsEl.innerHTML = highlights
    .map((item) => `<span class="highlight-chip">${escapeHtml(item)}</span>`)
    .join('');
}

function renderEmptyState(title, description) {
  resultGroupsEl.innerHTML = `
    <article class="empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </article>
  `;
}

function buildTableMarkup(rows) {
  const body = rows
    .map(
      (row) => `
        <tr>
          <td><code>${escapeHtml(row.domain || '-')}</code></td>
          <td><code>${escapeHtml(row.tenant_id || '-')}</code></td>
          <td>${escapeHtml(row.organization_name || '-')}</td>
          <td><span class="source-badge">${escapeHtml(sourceLabel(row.source))}</span></td>
          <td>${escapeHtml(formatDate(row.last_checked))}</td>
        </tr>
      `
    )
    .join('');

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Domain</th>
            <th>Tenant ID</th>
            <th>Organization</th>
            <th>Source</th>
            <th>Last Checked</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function renderGroups(groups) {
  if (!groups.length) {
    renderEmptyState(
      'No records matched this search',
      'Try a different spelling, a broader organization name, or a domain that belongs to Microsoft 365.'
    );
    return;
  }

  resultGroupsEl.innerHTML = groups
    .map(
      (group) => `
        <article class="group-card">
          <div class="group-head">
            <div>
              <h3>${escapeHtml(group.title)}</h3>
              <p>${escapeHtml(group.description)}</p>
            </div>
            <span class="group-meta">${escapeHtml(group.meta)}</span>
          </div>
          ${buildTableMarkup(group.rows)}
        </article>
      `
    )
    .join('');
}

function updateReportState(nextState) {
  reportState = {
    ...emptyReportState,
    ...nextState
  };

  resultTitleEl.textContent = reportState.title;
  setSummary({
    organization: reportState.organization,
    tenantId: reportState.tenantId,
    totalDomains: reportState.totalDomains,
    source: reportState.sourceLabel
  });
  renderHighlights(reportState.highlights);
  renderGroups(reportState.groups);
  setActionState();
}

function resetReportState() {
  updateReportState({ ...emptyReportState, mode: activeMode });
}

function buildLookupGroups(rows, query, mode) {
  const normalizedQuery = String(query || '').trim().toLowerCase();
  const primary = [];
  const observed = [];
  const imported = [];
  const other = [];

  for (const row of rows) {
    const domain = String(row.domain || '').trim().toLowerCase();

    if (mode === 'domain' && domain === normalizedQuery) {
      primary.push(row);
      continue;
    }

    if (row.source === 'live-openid+realm') {
      observed.push(row);
      continue;
    }

    if (row.source === 'upstream-tenant-api') {
      imported.push(row);
      continue;
    }

    other.push(row);
  }

  const groups = [];

  if (primary.length) {
    groups.push({
      title: 'Primary match',
      description: 'The exact domain you searched for.',
      meta: `${primary.length} domain`,
      rows: primary
    });
  }

  if (observed.length) {
    groups.push({
      title: primary.length ? 'Observed sibling domains' : 'Locally observed domains',
      description: 'Domains resolved or confirmed through local live lookup history.',
      meta: `${observed.length} domain${observed.length === 1 ? '' : 's'}`,
      rows: observed
    });
  }

  if (imported.length) {
    groups.push({
      title: 'Expanded tenant footprint',
      description: 'Additional sibling domains imported from the upstream tenant dataset.',
      meta: `${imported.length} domain${imported.length === 1 ? '' : 's'}`,
      rows: imported
    });
  }

  if (other.length) {
    groups.push({
      title: 'Additional records',
      description: 'Tenant domains available from other stored sources.',
      meta: `${other.length} domain${other.length === 1 ? '' : 's'}`,
      rows: other
    });
  }

  if (!groups.length && rows.length) {
    groups.push({
      title: 'Tenant domains',
      description: 'All domains currently associated with this tenant.',
      meta: `${rows.length} domain${rows.length === 1 ? '' : 's'}`,
      rows
    });
  }

  return groups;
}

function buildOrganizationGroups(rows) {
  const byOrganization = new Map();

  for (const row of rows) {
    const key = String(row.organization_name || 'Unlabeled organization').trim() || 'Unlabeled organization';
    const groupRows = byOrganization.get(key) || [];
    groupRows.push(row);
    byOrganization.set(key, groupRows);
  }

  return Array.from(byOrganization.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([organization, organizationRows]) => {
      const tenantIds = new Set(organizationRows.map((row) => row.tenant_id).filter(Boolean));

      return {
        title: organization,
        description:
          tenantIds.size === 1
            ? `All matches currently map to tenant ${Array.from(tenantIds)[0]}.`
            : `Matches span ${tenantIds.size} tenants in the local database.`,
        meta: `${organizationRows.length} domain${organizationRows.length === 1 ? '' : 's'}`,
        rows: organizationRows
      };
    });
}

function buildLookupView(result, query, mode) {
  const rows = Array.isArray(result.domains) ? result.domains : [];
  const organization =
    rows.find((row) => row.organization_name)?.organization_name || 'Unknown organization';
  const highlights = [];

  highlights.push(result.source === 'live' ? 'Live Microsoft resolution used' : 'Local database hit');

  if (result.upstream_used) {
    highlights.push(`Upstream enrichment added ${result.upstream_domains_added} domains`);
  }

  if (privacyState.privacyMode) {
    highlights.push('Privacy mode is active');
  }

  if (result.upstream_error) {
    highlights.push(`Upstream unavailable: ${result.upstream_error}`);
  }

  return {
    mode,
    query,
    title: organization !== 'Unknown organization' ? organization : `Tenant results for ${query}`,
    tenantId: result.tenant_id || '',
    totalDomains: result.total_domains || rows.length,
    rows,
    groups: buildLookupGroups(rows, query, mode),
    organization,
    sourceLabel: result.upstream_used
      ? 'Database + upstream enrichment'
      : result.source === 'live'
        ? 'Live Microsoft resolution'
        : 'Local tenant database',
    highlights
  };
}

function buildOrganizationView(result, query) {
  const rows = Array.isArray(result.domains) ? result.domains : [];
  const tenantIds = new Set(rows.map((row) => row.tenant_id).filter(Boolean));
  const organizations = new Set(rows.map((row) => row.organization_name).filter(Boolean));
  const highlights = ['Organization search uses the local database'];

  if (privacyState.privacyMode) {
    highlights.push('Privacy mode is active');
  }

  return {
    mode: 'organization',
    query,
    title: `Organization matches for "${query}"`,
    tenantId: tenantIds.size === 1 ? Array.from(tenantIds)[0] : '',
    totalDomains: result.total_domains || rows.length,
    rows,
    groups: buildOrganizationGroups(rows),
    organization:
      organizations.size === 1 ? Array.from(organizations)[0] : `${organizations.size || 0} organizations`,
    sourceLabel: 'Local organization search',
    highlights
  };
}

function buildShareUrl() {
  if (!reportState.query) {
    return '';
  }

  const url = new URL(window.location.href);
  url.search = '';
  url.searchParams.set('mode', reportState.mode);
  url.searchParams.set('q', reportState.query);
  return url.toString();
}

function syncUrlWithState() {
  const url = new URL(window.location.href);

  if (!reportState.query) {
    url.search = '';
  } else {
    url.search = '';
    url.searchParams.set('mode', reportState.mode);
    url.searchParams.set('q', reportState.query);
  }

  window.history.replaceState({}, '', `${url.pathname}${url.search}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  const json = await response.json();

  if (!response.ok) {
    const message = json?.detail || json?.error || `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return json;
}

function setMode(mode, preserveValue = true) {
  activeMode = mode in modeConfig ? mode : 'domain';

  for (const button of modeButtons) {
    button.classList.toggle('active', button.dataset.mode === activeMode);
    button.setAttribute('aria-selected', String(button.dataset.mode === activeMode));
  }

  const config = modeConfig[activeMode];
  searchLabel.textContent = config.label;
  searchInput.placeholder = config.placeholder;
  modeDescription.textContent = config.description;
  exampleCaption.textContent = config.exampleCaption;

  if (!preserveValue) {
    searchInput.value = '';
  }

  renderExamples(activeMode);
}

function renderExamples(mode) {
  exampleList.innerHTML = '';

  for (const example of modeConfig[mode].examples) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'example-button';
    button.textContent = example;
    button.addEventListener('click', () => {
      setMode(mode, true);
      searchInput.value = example;
      void performSearch(mode, example);
    });
    exampleList.appendChild(button);
  }
}

function serializeCsvRow(values) {
  return values
    .map((value) => `"${String(value ?? '').replaceAll('"', '""')}"`)
    .join(',');
}

function downloadBlob(filename, type, content) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportCsvReport() {
  if (!reportState.rows.length) {
    setStatus('No rows are available for CSV export yet.', 'error');
    return;
  }

  const lines = [
    serializeCsvRow(['domain', 'tenant_id', 'organization_name', 'source', 'last_checked']),
    ...reportState.rows.map((row) =>
      serializeCsvRow([
        row.domain,
        row.tenant_id,
        row.organization_name,
        row.source,
        row.last_checked
      ])
    )
  ];

  downloadBlob(
    `tenant-domain-report-${slugify(reportState.query) || 'report'}.csv`,
    'text/csv;charset=utf-8',
    `${lines.join('\n')}\n`
  );
  setStatus('CSV export generated.', 'success');
}

function createPdfWithJsPdf() {
  if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function') {
    return false;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const generatedAt = formatGeneratedTimestamp();
  const sourceUrl = reportUrl();
  const sourceUrlLines = doc.splitTextToSize(`URL: ${sourceUrl}`, 740);
  const attributionLines = doc.splitTextToSize(reportAttributionText(), 740);
  const headerBaseY = reportState.tenantId ? 128 : 112;
  const headerExtraLines = sourceUrlLines.length > 1 ? sourceUrlLines.length - 1 : 0;

  doc.setFontSize(18);
  doc.text('Tenant Domain Finder Report', 40, 44);
  doc.setFontSize(10);
  doc.text(`Generated: ${generatedAt}`, 40, 64);
  doc.text(`Search mode: ${reportState.mode}`, 40, 80);
  doc.text(`Query: ${reportState.query || '-'}`, 40, 96);
  if (reportState.tenantId) {
    doc.text(`Tenant ID: ${reportState.tenantId}`, 40, 112);
  }
  doc.text(`Total domains: ${reportState.totalDomains}`, 40, headerBaseY);
  doc.text(sourceUrlLines, 40, headerBaseY + 16);

  const tableRows = reportState.rows.map((row) => [
    row.domain || '-',
    row.tenant_id || '-',
    row.organization_name || '-',
    sourceLabel(row.source),
    formatDate(row.last_checked)
  ]);

  doc.autoTable({
    head: [['Domain', 'Tenant ID', 'Organization', 'Source', 'Last Checked']],
    body: tableRows,
    startY: headerBaseY + 32 + headerExtraLines * 12,
    styles: {
      fontSize: 8,
      cellPadding: 4
    },
    headStyles: {
      fillColor: [13, 91, 215]
    },
    didDrawPage(data) {
      const pageHeight = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(93, 103, 120);
      doc.text(attributionLines, data.settings.margin.left, pageHeight - 22);
      doc.text(`Page ${data.pageNumber}`, doc.internal.pageSize.getWidth() - 56, pageHeight - 22);
      doc.setTextColor(0, 0, 0);
    }
  });

  doc.save(`tenant-domain-report-${slugify(reportState.query) || 'report'}.pdf`);
  return true;
}

function createPrintableFallback() {
  const generatedAt = formatGeneratedTimestamp();
  const reportWindow = window.open('', '_blank', 'noopener,noreferrer');
  const sourceUrl = reportUrl();
  const attributionText = reportAttributionText();

  if (!reportWindow) {
    throw new Error('Pop-up blocked. Allow pop-ups and try again.');
  }

  const rowsHtml = reportState.rows
    .map(
      (row) => `
        <tr>
          <td>${escapeHtml(row.domain || '-')}</td>
          <td>${escapeHtml(row.tenant_id || '-')}</td>
          <td>${escapeHtml(row.organization_name || '-')}</td>
          <td>${escapeHtml(sourceLabel(row.source))}</td>
          <td>${escapeHtml(formatDate(row.last_checked))}</td>
        </tr>
      `
    )
    .join('');

  reportWindow.document.write(`
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <title>Tenant Domain Finder Report</title>
        <style>
          body { font-family: Helvetica, Arial, sans-serif; color: #111827; margin: 24px; }
          h1 { margin: 0 0 12px; }
          p { margin: 0 0 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f3f4f6; text-transform: uppercase; letter-spacing: 0.08em; font-size: 11px; }
        </style>
      </head>
      <body>
        <h1>Tenant Domain Finder Report</h1>
        <p><strong>Generated:</strong> ${escapeHtml(generatedAt)}</p>
        <p><strong>Mode:</strong> ${escapeHtml(reportState.mode)}</p>
        <p><strong>Query:</strong> ${escapeHtml(reportState.query || '-')}</p>
        <p><strong>Tenant ID:</strong> ${escapeHtml(reportState.tenantId || '-')}</p>
        <p><strong>Total domains:</strong> ${escapeHtml(String(reportState.totalDomains))}</p>
        <p><strong>URL:</strong> ${escapeHtml(sourceUrl)}</p>
        <table>
          <thead>
            <tr>
              <th>Domain</th>
              <th>Tenant ID</th>
              <th>Organization</th>
              <th>Source</th>
              <th>Last Checked</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <p style="margin-top: 18px; color: #6b7280; font-size: 11px;">
          ${escapeHtml(attributionText)}
        </p>
      </body>
    </html>
  `);

  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
}

function exportPdfReport() {
  if (!reportState.rows.length) {
    setStatus('No results are available for PDF export yet.', 'error');
    return;
  }

  try {
    const generated = createPdfWithJsPdf();
    if (!generated) {
      createPrintableFallback();
    }
    setStatus('PDF export generated.', 'success');
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  }
}

async function writeToClipboard(value, successMessage) {
  try {
    await navigator.clipboard.writeText(value);
    setStatus(successMessage, 'success');
  } catch (_error) {
    setStatus('Clipboard access is unavailable in this browser.', 'error');
  }
}

async function performSearch(mode, rawQuery) {
  const query = String(rawQuery || '').trim();

  if (!query) {
    return;
  }

  const isLookupMode = mode === 'domain' || mode === 'tenant';
  const endpoint = isLookupMode
    ? `/api/lookup?q=${encodeURIComponent(query)}`
    : `/api/search/org?q=${encodeURIComponent(query)}`;

  searchButton.disabled = true;
  setStatus(
    isLookupMode ? 'Searching tenant domains...' : 'Searching organization matches...',
    'neutral'
  );

  try {
    const result = await fetchJson(endpoint);
    const nextState = isLookupMode
      ? buildLookupView(result, query, mode)
      : buildOrganizationView(result, query);

    nextState.shareUrl = new URL(window.location.href).toString();
    nextState.shareUrl = `${window.location.origin}${window.location.pathname}?mode=${encodeURIComponent(
      nextState.mode
    )}&q=${encodeURIComponent(nextState.query)}`;

    updateReportState(nextState);
    syncUrlWithState();
    setStatus(
      `Found ${nextState.totalDomains} domain${nextState.totalDomains === 1 ? '' : 's'} for ${nextState.query}.`,
      'success'
    );
    document.getElementById('results-panel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (error) {
    resetReportState();
    setStatus(error instanceof Error ? error.message : String(error), 'error');
  } finally {
    searchButton.disabled = false;
    setActionState();
  }
}

modeButtons.forEach((button) => {
  button.addEventListener('click', () => {
    setMode(button.dataset.mode || 'domain', false);
  });
});

searchForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  await performSearch(activeMode, searchInput.value);
});

copyTenantButton.addEventListener('click', async () => {
  if (!reportState.tenantId) {
    return;
  }

  await writeToClipboard(reportState.tenantId, 'Tenant ID copied to clipboard.');
});

shareLinkButton.addEventListener('click', async () => {
  if (!reportState.shareUrl) {
    return;
  }

  await writeToClipboard(reportState.shareUrl, 'Shareable result link copied to clipboard.');
});

exportCsvButton.addEventListener('click', exportCsvReport);
exportPdfButton.addEventListener('click', exportPdfReport);

(async function init() {
  setMode(activeMode, false);
  resetReportState();

  try {
    const [metrics, privacy, meta] = await Promise.all([
      fetchJson('/api/stats'),
      fetchJson('/api/privacy'),
      fetchJson('/api/meta')
    ]);

    privacyState = {
      privacyMode: Boolean(privacy.privacy_mode),
      liveLookupEnabled: Boolean(privacy.live_microsoft_lookup_enabled),
      upstreamEnabled: Boolean(privacy.upstream_enabled)
    };

    statsPill.textContent = `${metrics.total_domains} domains across ${metrics.total_tenants} tenants`;
    privacyPill.textContent = privacyState.privacyMode
      ? 'Privacy mode is on: local-only results'
      : privacyState.upstreamEnabled
        ? 'Live lookup and upstream enrichment are enabled'
        : 'Live lookup is enabled without upstream enrichment';
    privacySummaryEl.textContent = privacyState.privacyMode
      ? 'Privacy mode is active, so searches stay inside the local database and no external requests are made.'
      : 'Privacy mode is off, so the service may use live Microsoft resolution and optional upstream enrichment.';

    if (appVersionEl) {
      appVersion = meta.version || '?';
      appVersionEl.textContent = `(v${appVersion})`;
    }
  } catch (_error) {
    statsPill.textContent = 'Stats unavailable';
    privacyPill.textContent = 'Privacy mode status unavailable';
    if (appVersionEl) {
      appVersionEl.textContent = '(version unavailable)';
    }
  }

  const params = new URLSearchParams(window.location.search);
  const modeFromUrl = params.get('mode');
  const queryFromUrl = params.get('q');

  if (modeFromUrl && modeFromUrl in modeConfig) {
    setMode(modeFromUrl, false);
  }

  if (queryFromUrl) {
    searchInput.value = queryFromUrl;
    await performSearch(activeMode, queryFromUrl);
  }
})();
