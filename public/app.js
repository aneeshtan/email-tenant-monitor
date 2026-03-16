const lookupForm = document.getElementById('lookup-form');
const orgForm = document.getElementById('org-form');
const resultsBody = document.getElementById('results-body');
const statusEl = document.getElementById('status');
const statsPill = document.getElementById('stats-pill');
const exportPdfButton = document.getElementById('export-pdf-button');
const appVersionEl = document.getElementById('app-version');
let privacyModeEnabled = true;

const emptyReportState = {
  mode: '',
  query: '',
  tenantId: '',
  totalDomains: 0,
  rows: []
};

let reportState = { ...emptyReportState };

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle('muted', !isError);
  statusEl.style.color = isError ? '#9b2226' : '';
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

function renderRows(rows) {
  resultsBody.innerHTML = '';

  if (!rows || rows.length === 0) {
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const row of rows) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><code>${row.domain || '-'}</code></td>
      <td><code>${row.tenant_id || '-'}</code></td>
      <td>${row.organization_name || '-'}</td>
      <td>${row.source || '-'}</td>
      <td>${formatDate(row.last_checked)}</td>
    `;
    fragment.appendChild(tr);
  }

  resultsBody.appendChild(fragment);
}

function resetReportState() {
  reportState = { ...emptyReportState };
  exportPdfButton.disabled = true;
}

function setReportState(nextState) {
  reportState = {
    mode: nextState.mode || '',
    query: nextState.query || '',
    tenantId: nextState.tenantId || '',
    totalDomains: Number(nextState.totalDomains || 0),
    rows: Array.isArray(nextState.rows) ? nextState.rows : []
  };

  exportPdfButton.disabled = reportState.rows.length === 0;
}

function formatGeneratedTimestamp() {
  return new Date().toLocaleString();
}

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
    .slice(0, 64);
}

function createPdfWithJsPdf() {
  if (!window.jspdf || typeof window.jspdf.jsPDF !== 'function') {
    return false;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const generatedAt = formatGeneratedTimestamp();

  doc.setFontSize(16);
  doc.text('M365 Tenant Domain Report', 40, 42);
  doc.setFontSize(10);
  doc.text(`Generated: ${generatedAt}`, 40, 60);
  doc.text(`Query: ${reportState.query || '-'}`, 40, 76);
  if (reportState.tenantId) {
    doc.text(`Tenant ID: ${reportState.tenantId}`, 40, 92);
  }
  doc.text(`Total domains: ${reportState.totalDomains}`, 40, reportState.tenantId ? 108 : 92);

  const tableRows = reportState.rows.map((row) => [
    row.domain || '-',
    row.tenant_id || '-',
    row.organization_name || '-',
    row.source || '-',
    formatDate(row.last_checked)
  ]);

  doc.autoTable({
    head: [['Domain', 'Tenant ID', 'Organization', 'Source', 'Last Checked']],
    body: tableRows,
    startY: reportState.tenantId ? 122 : 106,
    styles: {
      fontSize: 8,
      cellPadding: 4
    },
    headStyles: {
      fillColor: [15, 123, 80]
    }
  });

  const querySlug = slugify(reportState.query) || 'report';
  doc.save(`tenant-domain-report-${querySlug}.pdf`);
  return true;
}

function createPrintableFallback() {
  const generatedAt = formatGeneratedTimestamp();
  const reportWindow = window.open('', '_blank', 'noopener,noreferrer');

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
          <td>${escapeHtml(row.source || '-')}</td>
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
        <title>M365 Tenant Domain Report</title>
        <style>
          body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
          h1 { margin: 0 0 8px; }
          p { margin: 0 0 6px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 12px; }
          th { background: #f3f3f3; }
        </style>
      </head>
      <body>
        <h1>M365 Tenant Domain Report</h1>
        <p><strong>Generated:</strong> ${escapeHtml(generatedAt)}</p>
        <p><strong>Query:</strong> ${escapeHtml(reportState.query || '-')}</p>
        ${
          reportState.tenantId
            ? `<p><strong>Tenant ID:</strong> ${escapeHtml(reportState.tenantId)}</p>`
            : ''
        }
        <p><strong>Total domains:</strong> ${escapeHtml(String(reportState.totalDomains))}</p>
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
      </body>
    </html>
  `);

  reportWindow.document.close();
  reportWindow.focus();
  reportWindow.print();
}

function exportPdfReport() {
  if (!reportState.rows.length) {
    setStatus('No results to export yet. Run a search first.', true);
    return;
  }

  try {
    const generated = createPdfWithJsPdf();
    if (!generated) {
      createPrintableFallback();
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
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

lookupForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const q = new FormData(lookupForm).get('q');
  if (!q) {
    return;
  }

  setStatus('Searching tenant domains...');

  try {
    const result = await fetchJson(`/api/lookup?q=${encodeURIComponent(q)}`);
    renderRows(result.domains);
    setReportState({
      mode: 'lookup',
      query: q,
      tenantId: result.tenant_id,
      totalDomains: result.total_domains,
      rows: result.domains
    });

    const notes = [];
    notes.push(result.source === 'live' ? 'live resolution used' : 'database hit');
    if (result.upstream_used) {
      notes.push(`upstream cache sync +${result.upstream_domains_added}`);
    }
    if (privacyModeEnabled) {
      notes.push('privacy mode: local-only');
    }
    setStatus(
      `Found ${result.total_domains} domain(s) for tenant ${result.tenant_id} (${notes.join('; ')}).`
    );
  } catch (error) {
    renderRows([]);
    resetReportState();
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
});

orgForm.addEventListener('submit', async (event) => {
  event.preventDefault();

  const q = new FormData(orgForm).get('q');
  if (!q) {
    return;
  }

  setStatus('Searching organization names...');

  try {
    const result = await fetchJson(`/api/search/org?q=${encodeURIComponent(q)}`);
    renderRows(result.domains);
    setReportState({
      mode: 'organization',
      query: q,
      tenantId: '',
      totalDomains: result.total_domains,
      rows: result.domains
    });
    setStatus(`Found ${result.total_domains} domain(s) that match organization name '${q}'.`);
  } catch (error) {
    renderRows([]);
    resetReportState();
    setStatus(error instanceof Error ? error.message : String(error), true);
  }
});

exportPdfButton.addEventListener('click', exportPdfReport);

(async function init() {
  try {
    const [metrics, privacy, meta] = await Promise.all([
      fetchJson('/api/stats'),
      fetchJson('/api/privacy'),
      fetchJson('/api/meta')
    ]);
    statsPill.textContent = `${metrics.total_domains} domains / ${metrics.total_tenants} tenants`;
    privacyModeEnabled = Boolean(privacy.privacy_mode);
    if (appVersionEl) {
      appVersionEl.textContent = `(v${meta.version || '?'})`;
    }
  } catch (_error) {
    statsPill.textContent = 'Stats unavailable';
    if (appVersionEl) {
      appVersionEl.textContent = '(version unavailable)';
    }
  }
})();
