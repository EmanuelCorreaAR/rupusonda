# Changelog

## [0.3.0] - 2026-08-27

### Added
- Modbus protocol adapter (`decodeModbusMessage`, JSONL ingest via `protocol: "modbus"`)
- Fixtures `fixtures/modbus/simple.jsonl`, `fixtures/modbus/mixed-protocol.jsonl`

### Changed
- `inspect` / `ingest` accept Modbus records alongside MQTT in the same capture

## [0.2.1] - 2026-08-27
### Changed
- Core rewritten as pure TypeScript FP: `Result<T,E>`, immutable registry, `inspectEvents` fold, `normalizeRecord` / `decodeMqttMessage` without side effects
- Clocks injected at the MQTT I/O boundary (`now?: Clock`) — core has no `Date.now`

## [0.2.0] - 2026-08-27
### Added
- `mqtt replay` — republish an IoTEvent JSONL capture to a broker (`--dry-run`, `--preserve-timing`, `--delay-ms`)
- IoTEvent JSONL reader (`readIoTEventJsonl`) and MQTT replay codec
- Fixture `fixtures/mqtt/events.jsonl` for replay/round-trip tests
### Changed
- `mqtt subscribe` framed as **record** (capture → IoTEvent JSONL)

## [0.1.2] - 2026-08-27
### Fixed
- `inspect` counts concrete event topics (never subscription filters with `#`)
- MQTT topic inference is best-effort only (`deviceId` / `metric` optional; arbitrary topics stay topic+value)
### Added
- `subscriptionFilterFromTopic()` helper — filters belong to capture/subscribe, not events

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
