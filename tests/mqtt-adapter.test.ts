import { describe, expect, it } from "vitest";
import { MqttAdapter } from "../src/protocols/mqtt/MqttAdapter.js";
import { decodeMqttPayload, parseMqttTopic } from "../src/protocols/mqtt/MqttDecoder.js";

describe("MqttAdapter", () => {
  const adapter = new MqttAdapter();

  it("parses JSON payload and extracts device/metric", () => {
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

  it("extracts device id when possible", () => {
    const parsed = parseMqttTopic("sensors/temperature/device-01");
    expect(parsed.deviceId).toBe("device-01");
    expect(parsed.metric).toBe("temperature");
    expect(parsed.pattern).toBe("sensors/temperature/#");
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
