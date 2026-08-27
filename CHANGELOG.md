# Changelog

## [0.1.1] - 2026-08-27
### Changed
- CLI help aligned with Rupu family (no family slogan in `--help` / npm description)
- Terminal reports use a Rich-style panel header (`rupusonda vX` + tagline)

## [0.1.0] - 2026-08-27

### Added
- CLI (`rupusonda`): `inspect`, `ingest`, `mqtt subscribe`
- Canonical `IoTEvent` model and protocol-independent core
- MQTT adapter/decoder (JSON, text, number, binary payloads)
- Streaming JSONL ingestion
- Deterministic JSON audit envelope for `inspect` / `ingest`
- Fixtures and Vitest coverage for adapter, ingest, and inspect
