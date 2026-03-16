# Changelog

All notable changes to this project will be documented in this file.

The release workflow uses semantic versioning. Each shipped feature should bump the version and add an entry here.

## [1.2.2] - 2026-03-16

### Added
- Added copyright attribution and report URL to exported PDF reports.

## [1.2.1] - 2026-03-16

### Added
- Removed Volta-specific example and placeholder references from the public interface.

## [1.2.0] - 2026-03-16

### Added
- Redesigned the frontend into a public-facing standalone service with a hero search layout, trust signals, and a polished information architecture.
- Unified domain, organization, and tenant searches into one search experience with mode switching, example shortcuts, and shareable URLs.
- Added structured result summaries with grouped domain sections, source highlights, tenant copy, CSV export, and PDF export actions.
- Added public product sections for How It Works, Privacy, and API transparency.

## [1.1.0] - 2026-03-16

### Added
- Added dynamic footer version display sourced from package metadata.
- Added a metadata API endpoint for the app version.
- Added release automation that bumps semantic versioning and prepends CHANGELOG entries.
- Improved tenant lookup behavior to enrich domain searches from the upstream dataset without requiring prefer_upstream=1.

## [1.0.0] - 2026-03-16

### Added
- Initial import of the Microsoft 365 tenant domain finder application.



