# Changelog

All notable changes to this project will be documented in this file.

The release workflow uses semantic versioning. Each shipped feature should bump the version and add an entry here.

## [1.1.0] - 2026-03-16

### Added
- Added dynamic footer version display sourced from package metadata.
- Added a metadata API endpoint for the app version.
- Added release automation that bumps semantic versioning and prepends CHANGELOG entries.
- Improved tenant lookup behavior to enrich domain searches from the upstream dataset without requiring prefer_upstream=1.

## [1.0.0] - 2026-03-16

### Added
- Initial import of the Microsoft 365 tenant domain finder application.
