import { describe, expect, it } from "vitest";
import { MqttAdapter } from "../src/protocols/mqtt/MqttAdapter.js";
import {
  decodeMqttPayload,
  inferMqttTopicSemantics,
  subscriptionFilterFromTopic,
} from "../src/protocols/mqtt/MqttDecoder.js";

describe("MqttAdapter", () => {
  const adapter = new MqttAdapter();

  it("parses JSON payload and extracts device/metric when topic evidence exists", () => {
    const event = adapter.decode({
      topic: "sensors/temperature/device-01",
      payload: '{"value":23.4,"unit":"C"}',
      timestamp: "2026-08-27T14:00:00.000Z",
    });

    expect(event.source.protocol).toBe("mqtt");
    expect(event.source.deviceId).toBe("device-01");
    expect(event.data.topic).toBe("sensors/temperature/device-01");
    expect(event.data.metric).toBe("temperature");
    expect(event.data.value).toBe(23.4);
    expect(event.data.unit).toBe("C");
    expect(event.metadata["payloadKind"]).toBe("json");
  });

  it("does not force deviceId/metric on arbitrary topics", () => {
    const event = adapter.decode({
      topic: "foo/bar",
      payload: { whatever: "payload" },
      timestamp: "2026-08-27T14:00:00.000Z",
    });

    expect(event.source).toEqual({ protocol: "mqtt" });
    expect(event.data.topic).toBe("foo/bar");
    expect(event.data.metric).toBeUndefined();
    expect(event.data.value).toEqual({ whatever: "payload" });
  });

  it("preserves text payload", () => {
    const event = adapter.decode({
      topic: "sensors/status/device-01",
      payload: "online",
      timestamp: "2026-08-27T14:00:00.000Z",
    });

    expect(event.data.value).toBe("online");
    expect(event.metadata["payloadKind"]).toBe("text");
  });

  it("handles malformed JSON payload as text", () => {
    const event = adapter.decode({
      topic: "sensors/temperature/device-01",
      payload: '{"value":23.4',
      timestamp: "2026-08-27T14:00:00.000Z",
    });

    expect(event.data.value).toBe('{"value":23.4');
    expect(event.metadata["payloadKind"]).toBe("text");
    expect(event.metadata["rawPreserved"]).toBe(true);
  });

  it("infers device id only with enough topic evidence", () => {
    const parsed = inferMqttTopicSemantics("sensors/temperature/device-01");
    expect(parsed.deviceId).toBe("device-01");
    expect(parsed.metric).toBe("temperature");

    expect(inferMqttTopicSemantics("foo/bar")).toEqual({});
    expect(inferMqttTopicSemantics("sensors/#")).toEqual({});
  });

  it("keeps subscription filters separate from event topics", () => {
    expect(subscriptionFilterFromTopic("sensors/temperature/device-01")).toBe(
      "sensors/temperature/#",
    );
  });

  it("preserves original topic", () => {
    const topic = "factory/line-1/sensors/temp/device-99";
    const event = adapter.decode({
      topic,
      payload: 42,
      timestamp: "2026-08-27T14:00:00.000Z",
    });
    expect(event.data.topic).toBe(topic);
  });

  it("is deterministic for identical inputs", () => {
    const input = {
      topic: "sensors/temperature/device-01",
      payload: '{"value":23.4,"unit":"C"}',
      timestamp: "2026-08-27T14:00:00.000Z",
    };
    const a = adapter.decode(input);
    const b = adapter.decode(input);
    expect(a).toEqual(b);
    expect(a.id).toBe(b.id);
  });
});

describe("decodeMqttPayload", () => {
  it("decodes binary buffers", () => {
    const decoded = decodeMqttPayload(Buffer.from([0, 1, 2, 255]));
    expect(decoded.kind).toBe("binary");
    expect(decoded.value).toEqual({
      type: "binary",
      encoding: "base64",
      data: Buffer.from([0, 1, 2, 255]).toString("base64"),
    });
  });
});
