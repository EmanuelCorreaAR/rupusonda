# RupuSonda

**Probe the signal. Understand the data.**

Part of the **Rupu** family.

Local CLI. Deterministic JSON reports. Stream IoT protocol captures into a canonical event model — inspect, normalize, schema, compose. Technical signals — not a dashboard, not a device manager, not an LLM in the loop.


## Install

Requires Node.js 18+.

```bash
npm install -g rupu-sonda
rupusonda --help
```


## Quick start

```bash
rupusonda inspect fixtures/mqtt/simple.jsonl
rupusonda schema fixtures/mqtt/simple.jsonl
rupusonda schema fixtures/mqtt/simple.jsonl --json
rupusonda ingest fixtures/mqtt/simple.jsonl -o events.jsonl
rupusonda mqtt replay fixtures/mqtt/events.jsonl --url mqtt://localhost:1883 --dry-run
```

Exit **1** is reserved for usage/data errors. Exit **2** is reserved for policy/validation failure (gates land in later versions).


## Commands

| Command | Role |
|---------|------|
| `inspect capture.jsonl` | Summarize protocols, devices, topics, payloads |
| `schema capture.jsonl` | Infer evidence-based schema (types, presence, ranges) |
| `ingest capture.jsonl` | Normalize to canonical `IoTEvent` JSONL |
| `mqtt subscribe` | **Record** live MQTT → `IoTEvent` JSONL |
| `mqtt replay` | **Replay** an `IoTEvent` capture back to a broker |

MQTT is the **first protocol adapter**, not the product. The core stays protocol-independent. CoAP and Modbus follow the same adapter contract (JSONL ingest first; live I/O lands later).


## Record / replay

Capture once, reproduce forever:

```bash
rupusonda mqtt subscribe \
  --url mqtt://localhost:1883 \
  --topic 'sensors/#' \
  -o capture.jsonl

rupusonda inspect capture.jsonl

rupusonda mqtt replay capture.jsonl \
  --url mqtt://localhost:1883
```

Useful replay flags: `--dry-run`, `--preserve-timing`, `--delay-ms`, `--max-messages`, `--json`.

Subscription filters (`sensors/#`) belong to **capture**. Event topics (`sensors/temperature/device-01`) belong to the **stream**.


## Schema inference

Evidence only — no LLM, no invented topic wildcards. Groups by **concrete** event topics and observes field shapes after normalize:

```bash
rupusonda schema fixtures/mqtt/simple.jsonl
rupusonda schema fixtures/mqtt/simple.jsonl -o schema.json
rupusonda schema fixtures/mqtt/simple.jsonl --json
```

For each topic you get field types, presence (`observed`), numeric `min`/`max`, and low-cardinality string `values`. Dataset `coverage` is the fraction of type observations that match each field's dominant type (a pure ratio, not a model score).

`-o` writes the schema `result` JSON (portable artifact for upcoming validation gates). `--json` emits the full audit envelope.


## Input format (JSONL)

One line per raw protocol record. Streaming — the file is not loaded as one blob.

```jsonl
{"protocol":"mqtt","timestamp":"2026-08-27T14:00:00.000Z","topic":"sensors/temperature/device-01","payload":"{\"value\":23.4,\"unit\":\"C\"}"}
{"protocol":"modbus","timestamp":"2026-08-27T14:00:00.000Z","slaveId":1,"registerType":"holding","address":40001,"value":235,"unit":"0.1C"}
{"protocol":"coap","timestamp":"2026-08-27T14:00:00.000Z","method":"GET","path":"/sensors/temperature","code":"2.05","contentFormat":50,"payload":"{\"value\":23.4,\"unit\":\"C\"}","deviceId":"node-01"}
```

MQTT uses `topic` + `payload`. Modbus uses `address` (or `register`) + `value`; `deviceId` / `slaveId` / `registerType` are optional. CoAP uses `path` (or `coap(s)://` `uri`) + optional `payload`; `method` / `code` / `contentFormat` / `deviceId` are optional.


## Canonical model

Everything normalizes to **IoTEvent**:

```json
{
  "id": "63881bff6a975b8fb0970d5298761202",
  "timestamp": "2026-08-27T14:00:00.000Z",
  "source": {
    "protocol": "mqtt",
    "deviceId": "device-01"
  },
  "data": {
    "topic": "sensors/temperature/device-01",
    "metric": "temperature",
    "value": 23.4,
    "unit": "C"
  },
  "metadata": {
    "payloadKind": "json"
  }
}
```

Event `id` is derived from content (deterministic). Same input + same configuration → same result.

`deviceId` / `metric` are **optional** inferred semantics when evidence exists (payload fields or a clear `…/metric/deviceId` topic path). Arbitrary topics like `foo/bar` stay topic + value only — RupuSonda must swallow real MQTT without assuming a naming convention.


## Audit report

Reports follow: `input → configuration → method → result`.

```bash
rupusonda inspect fixtures/mqtt/simple.jsonl --json
```

```json
{
  "tool": "rupusonda",
  "version": "0.2.0",
  "family": "rupu",
  "command": "inspect",
  "input": {
    "path": "fixtures/mqtt/simple.jsonl",
    "events": 2,
    "issues": 0
  },
  "configuration": {
    "json": true
  },
  "method": {
    "unit": "iot_event",
    "ingest": "jsonl_stream_v1",
    "normalize": "protocol_adapter_v1",
    "inspect": "dataset_summary_v1",
    "schema": "schema_inference_v1",
    "replay": "mqtt_replay_v1"
  },
  "result": {
    "events": 2,
    "protocols": { "mqtt": 2 },
    "devices": 2,
    "deviceIds": ["device-01", "device-02"],
    "timeRange": {
      "start": "2026-08-27T14:00:00.000Z",
      "end": "2026-08-27T14:00:01.000Z"
    },
    "topics": {
      "sensors/temperature/device-01": 1,
      "sensors/temperature/device-02": 1
    },
    "payloads": {
      "json": 2,
      "text": 0,
      "number": 0,
      "boolean": 0,
      "null": 0,
      "binary": 0,
      "unknown": 0
    },
    "issues": 0
  }
}
```

`result.topics` counts **concrete event topics**. Subscription filters (`sensors/#`) belong to capture/subscribe metadata, not to the event stream.


## Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | Usage or data error |
| `2` | Policy/validation failure |


## What it is not

- Not an IoT platform or device manager
- Not a dashboard or cloud service
- Not packet capture / Wireshark
- Not ML, LLM, or anomaly detection (yet)

If you cannot export a JSONL capture (or subscribe to a broker), you're not the user yet.


## Development

```bash
git clone https://github.com/EmanuelCorreaAR/rupusonda.git
cd rupusonda
npm install
npm test
npm run build
```


## Status

**0.5.0** — Schema inference (`schema` / `schema_inference_v1`); CoAP + Modbus + MQTT adapters; record/replay; pure FP core.

**Next:** validation gates (`validate` + exit 2), schema/capture diff.


## Apoyar el proyecto

Si RupuSonda te sirve, podés invitarme un cafecito: [cafecito.app/emacorreadev](https://cafecito.app/emacorreadev)


## License

Apache License 2.0
