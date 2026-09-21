import { describe, expect, it } from "vitest";
import { decodeCoapMessage, coapAdapter } from "../src/protocols/coap/CoapAdapter.js";
import {
  decodeCoapPayload,
  normalizeCoapPath,
  parseCoapUri,
  resolveCoapDeviceId,
  resolveCoapPath,
} from "../src/protocols/coap/CoapDecoder.js";

describe("decodeCoapMessage", () => {
  it("decodes GET response with JSON payload", () => {
    const event = decodeCoapMessage({
      path: "/sensors/temperature",
      payload: '{"value":23.4,"unit":"C"}',
      timestamp: "2026-08-27T14:00:00.000Z",
      method: "GET",
      code: "2.05",
      contentFormat: 50,
      deviceId: "node-01",
    });

    expect(event.source.protocol).toBe("coap");
    expect(event.source.deviceId).toBe("node-01");
    expect(event.data.topic).toBe("/sensors/temperature");
    expect(event.data.value).toBe(23.4);
    expect(event.data.unit).toBe("C");
    expect(event.metadata["method"]).toBe("GET");
    expect(event.metadata["code"]).toBe("2.05");
    expect(event.metadata["contentFormat"]).toBe(50);
    expect(event.metadata["payloadKind"]).toBe("json");
  });

  it("derives path and deviceId from coap URI", () => {
    const event = decodeCoapMessage({
      path: "/actuators/open",
      uri: "coap://valve-02/actuators/open",
      method: "PUT",
      payload: true,
      metric: "open",
    });

    expect(event.source.deviceId).toBe("valve-02");
    expect(event.data.topic).toBe("/actuators/open");
    expect(event.data.metric).toBe("open");
    expect(event.data.value).toBe(true);
    expect(event.metadata["uri"]).toBe("coap://valve-02/actuators/open");
  });

  it("does not invent deviceId from path alone", () => {
    const event = decodeCoapMessage({
      path: "sensors/humidity",
      payload: 55.2,
      unit: "%",
    });

    expect(event.source).toEqual({ protocol: "coap" });
    expect(event.data.topic).toBe("/sensors/humidity");
    expect(event.data.unit).toBe("%");
    expect(event.metadata["payloadKind"]).toBe("number");
  });

  it("is deterministic for identical inputs", () => {
    const input = {
      path: "/sensors/temperature",
      payload: 23.4,
      timestamp: "2026-08-27T14:00:00.000Z",
      method: "GET" as const,
    };
    const a = coapAdapter.decode(input);
    const b = coapAdapter.decode(input);
    expect(a).toEqual(b);
    expect(a.id).toBe(b.id);
  });

  it("allows empty payload (GET without body)", () => {
    const event = decodeCoapMessage({
      path: "/well-known/core",
      method: "GET",
    });
    expect(event.data.value).toBeNull();
    expect(event.metadata["payloadKind"]).toBe("null");
  });
});

describe("CoapDecoder helpers", () => {
  it("normalizes paths", () => {
    expect(normalizeCoapPath("sensors/temp")).toBe("/sensors/temp");
    expect(normalizeCoapPath("/sensors/temp/")).toBe("/sensors/temp");
    expect(normalizeCoapPath("/")).toBe("/");
    expect(normalizeCoapPath("")).toBeUndefined();
  });

  it("parses coap URIs", () => {
    expect(parseCoapUri("coap://node-01:5683/sensors/temp")).toEqual({
      host: "node-01",
      path: "/sensors/temp",
    });
    expect(parseCoapUri("coaps://gw.local/a")).toEqual({
      host: "gw.local",
      path: "/a",
    });
    expect(parseCoapUri("http://nope")).toEqual({});
  });

  it("resolves path and deviceId conservatively", () => {
    expect(resolveCoapPath({ uri: "coap://dev/x" })).toBe("/x");
    expect(resolveCoapDeviceId({ uri: "coap://dev/x" })).toBe("dev");
    expect(resolveCoapDeviceId({ uri: "coap://localhost/x" })).toBeUndefined();
    expect(resolveCoapDeviceId({ deviceId: "explicit", uri: "coap://other/x" })).toBe("explicit");
  });

  it("classifies payloads", () => {
    expect(decodeCoapPayload(42).kind).toBe("number");
    expect(decodeCoapPayload('{"value":1}').kind).toBe("json");
  });
});
