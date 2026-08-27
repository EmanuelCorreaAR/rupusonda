import { describe, expect, it } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseIoTEvent } from "../src/core/event/parseIoTEvent.js";
import { collectIoTEventJsonl } from "../src/core/event/readIoTEventJsonl.js";
import {
  encodeMqttReplayPayload,
  requireReplayTopic,
} from "../src/protocols/mqtt/MqttReplayCodec.js";
import { planMqttReplay, runMqttReplay } from "../src/cli/commands/mqtt-replay.js";
import { decodeMqttMessage } from "../src/protocols/mqtt/MqttAdapter.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = path.join(root, "fixtures", "mqtt");

describe("parseIoTEvent", () => {
  it("accepts a minimal mqtt event", () => {
    const event = parseIoTEvent({
      id: "abc",
      timestamp: "2026-08-27T14:00:00.000Z",
      source: { protocol: "mqtt" },
      data: { topic: "foo/bar", value: { whatever: "payload" } },
      metadata: {},
    });
    expect(event.ok).toBe(true);
    if (event.ok) {
      expect(event.value.source.deviceId).toBeUndefined();
      expect(event.value.data.metric).toBeUndefined();
      expect(event.value.data.topic).toBe("foo/bar");
    }
  });

  it("rejects missing value", () => {
    const result = parseIoTEvent({
      id: "abc",
      timestamp: "2026-08-27T14:00:00.000Z",
      source: { protocol: "mqtt" },
      data: { topic: "foo/bar" },
      metadata: {},
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toMatch(/data.value/);
    }
  });
});

describe("MqttReplayCodec", () => {
  it("round-trips JSON sensor payloads", () => {
    const event = decodeMqttMessage({
      topic: "sensors/temperature/device-01",
      payload: '{"value":23.4,"unit":"C"}',
      timestamp: "2026-08-27T14:00:00.000Z",
    });
    const encoded = encodeMqttReplayPayload(event);
    expect(JSON.parse(String(encoded))).toEqual({ value: 23.4, unit: "C" });
    const topic = requireReplayTopic(event);
    expect(topic.ok).toBe(true);
    if (topic.ok) {
      expect(topic.value).toBe("sensors/temperature/device-01");
    }
  });

  it("preserves arbitrary object payloads", () => {
    const event = decodeMqttMessage({
      topic: "foo/bar",
      payload: { whatever: "payload" },
      timestamp: "2026-08-27T14:00:00.000Z",
    });
    expect(JSON.parse(String(encodeMqttReplayPayload(event)))).toEqual({
      whatever: "payload",
    });
  });

  it("rejects subscription-filter topics", () => {
    const topic = requireReplayTopic({
      id: "x",
      timestamp: "2026-08-27T14:00:00.000Z",
      source: { protocol: "mqtt" },
      data: { topic: "sensors/#", value: 1 },
      metadata: {},
    });
    expect(topic.ok).toBe(false);
    if (!topic.ok) {
      expect(topic.error.message).toMatch(/subscription filter/);
    }
  });
});

describe("mqtt replay", () => {
  it("plans publishes from IoTEvent JSONL", async () => {
    const { plan, issues } = await planMqttReplay(path.join(fixtures, "events.jsonl"));
    expect(issues).toBe(0);
    expect(plan).toHaveLength(3);
    expect(plan[0]?.topic).toBe("sensors/temperature/device-01");
    expect(plan[2]?.topic).toBe("foo/bar");
  });

  it("streams IoTEvent captures", async () => {
    const { events, issues } = await collectIoTEventJsonl(path.join(fixtures, "events.jsonl"));
    expect(issues).toHaveLength(0);
    expect(events).toHaveLength(3);
  });

  it("dry-run emits deterministic audit envelope", async () => {
    const audit = await runMqttReplay({
      path: path.join(fixtures, "events.jsonl"),
      url: "mqtt://localhost:1883",
      dryRun: true,
      json: true,
    });

    expect(audit.command).toBe("mqtt.replay");
    expect(audit.tool).toBe("rupusonda");
    expect(audit.result.published).toBe(3);
    expect(audit.result.dryRun).toBe(true);
    expect(audit.input).toBeDefined();
    expect(audit.configuration).toBeDefined();
    expect(audit.method).toBeDefined();

    const again = await runMqttReplay({
      path: path.join(fixtures, "events.jsonl"),
      url: "mqtt://localhost:1883",
      dryRun: true,
      json: true,
    });
    expect(JSON.stringify(audit)).toBe(JSON.stringify(again));
  });
});
