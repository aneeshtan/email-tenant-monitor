# Microsoft 365 Tenant Domain Finder

A web tool to search domains that belong to the same Microsoft 365 tenant as an input domain.

## Why this architecture

Microsoft changed historical federation behavior (`GetFederationInformation` / Autodiscover tenant-wide domain disclosure). That means this tool must be treated as **dataset-backed search** plus **live tenant resolution for single domains**, not guaranteed tenant-wide live enumeration.

## Features

- Search by domain or tenant GUID.
- Search by organization/brand name.
- SQLite-backed fast lookups.
- Optional upstream fallback to a large prebuilt tenant-domain dataset API.
- Live domain-to-tenant resolution (cached) using:
  - OpenID metadata endpoint (`/v2.0/.well-known/openid-configuration`)
  - `getuserrealm.srf` for organization branding hints.

## Quick start

```bash
npm install
cp .env.example .env
npm run start
```

Open `http://localhost:3000`.

## Versioning and changelog

This repo now uses a simple semantic-version release workflow backed by `package.json` and `CHANGELOG.md`.

For every shipped feature, run:

```bash
npm run release -- --type patch --message "Describe the feature"
```

Use `patch` for fixes, `minor` for new features, and `major` for breaking changes.

Examples:

```bash
npm run release -- --type patch --message "Fixed upstream timeout handling"
npm run release -- --type minor --message "Added organization report export"
npm run release -- --type minor --message "Added footer version display" --message "Added metadata API endpoint"
```

What it updates:

- `package.json`
- `package-lock.json`
- `CHANGELOG.md`

The UI footer version is read from `/api/meta`, which is sourced from `package.json`.

## Privacy mode (safe searches)

This project supports local-only search mode:

- `PRIVACY_MODE=true` blocks external lookup traffic.
- `UPSTREAM_ENABLED=true|false` controls third-party dataset fallback.
- Frontend assets are served locally (no CDN script/font dependencies).
- PDF export uses browser print-to-PDF and does not load external JS libraries.

With defaults in `.env.example`, Microsoft live lookup and upstream fallback are enabled.

## Data ingestion

### 1) Ingest from a plaintext domain list

Create a file with one domain per line:

```txt
contoso.com
fabrikam.com
microsoft.com
```

Run:

```bash
npm run ingest -- --file ./domains.txt
```

### 2) Import from CSV

Expected columns:

```csv
domain,tenant_id,organization_name,source
contoso.com,00000000-0000-0000-0000-000000000000,Contoso,crowdsource
```

Run:

```bash
npm run import:csv -- --file ./tenant-domains.csv
```

## API

- `GET /api/stats`
- `GET /api/privacy`
- `GET /api/lookup?q=<domain-or-tenant-guid>`
- `GET /api/search/org?q=<organization-name>&limit=250`
- `GET /api/search/tenant-name?q=<organization-name>`

To force upstream refresh for a lookup:

- `GET /api/lookup?q=<domain-or-tenant-guid>&prefer_upstream=1`

## Deployment notes

- Works on any Node.js host (Render, Fly.io, Railway, VPS, etc.).
- Use persistent disk for SQLite (`DB_PATH`).
- For production scale, consider Postgres + background workers for ingestion.

## Important limitations

- Querying one domain live does **not** imply all sibling domains can be discovered live (when privacy mode is disabled).
- Coverage depends on your ingested dataset.
- If `UPSTREAM_ENABLED=true`, missing tenant siblings can be backfilled from `UPSTREAM_API_BASE`.
- Rate limit and respect Microsoft services in ingestion workflows.
