import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runSchema } from "../src/cli/commands/schema.js";
import { inferSchema, classifyValue } from "../src/core/schema/inferSchema.js";
import { decodeMqttMessage } from "../src/protocols/mqtt/MqttAdapter.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = path.join(root, "fixtures", "mqtt");

describe("classifyValue", () => {
  it("classifies primitives and binary shape", () => {
    expect(classifyValue(1)).toBe("number");
    expect(classifyValue("C")).toBe("string");
    expect(classifyValue(true)).toBe("boolean");
    expect(classifyValue(null)).toBe("null");
    expect(classifyValue([1])).toBe("array");
    expect(classifyValue({ a: 1 })).toBe("object");
    expect(
      classifyValue({ type: "binary", encoding: "base64", data: "YQ==" }),
    ).toBe("binary");
  });
});

describe("inferSchema (pure)", () => {
  it("groups by concrete topic and observes value/unit/deviceId", () => {
    const events = [
      decodeMqttMessage({
        topic: "sensors/temperature/device-01",
        payload: '{"value":23.4,"unit":"C"}',
        timestamp: "2026-08-27T14:00:00.000Z",
      }),
      decodeMqttMessage({
        topic: "sensors/temperature/device-01",
        payload: '{"value":24.0,"unit":"C"}',
        timestamp: "2026-08-27T14:00:01.000Z",
      }),
      decodeMqttMessage({
        topic: "sensors/humidity/device-01",
        payload: '{"value":40,"unit":"%"}',
        timestamp: "2026-08-27T14:00:02.000Z",
      }),
    ];

    const schema = inferSchema(events, 0);

    expect(schema.events).toBe(3);
    expect(schema.topics["sensors/temperature/#"]).toBeUndefined();
    expect(schema.topics["sensors/temperature/device-01"]?.events).toBe(2);

    const temp = schema.topics["sensors/temperature/device-01"];
    expect(temp?.fields["value"]?.type).toBe("number");
    expect(temp?.fields["value"]?.observed).toBe(1);
    expect(temp?.fields["value"]?.min).toBe(23.4);
    expect(temp?.fields["value"]?.max).toBe(24);
    expect(temp?.fields["unit"]?.type).toBe("string");
    expect(temp?.fields["unit"]?.values).toEqual(["C"]);
    expect(temp?.fields["deviceId"]?.values).toEqual(["device-01"]);
    expect(schema.coverage).toBe(1);
  });

  it("is referentially transparent", () => {
    const events = [
      decodeMqttMessage({
        topic: "foo/bar",
        payload: "hello",
        timestamp: "2026-08-27T14:00:00.000Z",
      }),
    ];
    expect(inferSchema(events, 0)).toEqual(inferSchema(events, 0));
  });

  it("records mixed types and lowers coverage", () => {
    const events = [
      decodeMqttMessage({
        topic: "sensors/battery/device-01",
        payload: '{"value":80}',
        timestamp: "2026-08-27T14:00:00.000Z",
      }),
      decodeMqttMessage({
        topic: "sensors/battery/device-01",
        payload: '{"value":"full"}',
        timestamp: "2026-08-27T14:00:01.000Z",
      }),
    ];

    const schema = inferSchema(events, 0);
    const field = schema.topics["sensors/battery/device-01"]?.fields["value"];
    expect(field?.types).toEqual({ number: 1, string: 1 });
    // Equal counts → alphabetical tie-break keeps the first max (number).
    expect(field?.type).toBe("number");
    // value contributes 1/2; deviceId + metric stay pure → 5/6
    expect(schema.coverage).toBe(0.8333);
  });

  it("flattens one level of object values", () => {
    const events = [
      decodeMqttMessage({
        topic: "devices/status",
        payload: '{"temp":21.5,"ok":true}',
        timestamp: "2026-08-27T14:00:00.000Z",
      }),
    ];
    const schema = inferSchema(events, 0);
    const topic = schema.topics["devices/status"];
    expect(topic?.fields["value"]?.type).toBe("object");
    expect(topic?.fields["value.temp"]?.type).toBe("number");
    expect(topic?.fields["value.ok"]?.type).toBe("boolean");
  });
});

describe("schema CLI", () => {
  it("infers schema from fixture with audit envelope", async () => {
    const audit = await runSchema({
      path: path.join(fixtures, "simple.jsonl"),
      json: true,
    });

    expect(audit.tool).toBe("rupusonda");
    expect(audit.command).toBe("schema");
    expect(audit.method.schema).toBe("schema_inference_v1");
    expect(audit.result.events).toBe(2);
    expect(audit.result.topics["sensors/temperature/device-01"]?.fields["value"]?.type).toBe(
      "number",
    );
    expect(audit.result.topics["sensors/temperature/device-02"]?.fields["unit"]?.values).toEqual([
      "C",
    ]);
  });

  it("produces deterministic JSON", async () => {
    const pathSimple = path.join(fixtures, "simple.jsonl");
    const a = await runSchema({ path: pathSimple, json: true });
    const b = await runSchema({ path: pathSimple, json: true });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});
