import { describe, expect, it } from "vitest";
import { inspectEvents } from "../src/core/inspect/Inspector.js";
import { decodeMqttMessage } from "../src/protocols/mqtt/MqttAdapter.js";
import { ok, err, map, flatMap, isOk } from "../src/core/result.js";

describe("inspectEvents (pure)", () => {
  it("is referentially transparent", () => {
    const events = [
      decodeMqttMessage({
        topic: "sensors/temperature/device-01",
        payload: '{"value":23.4,"unit":"C"}',
        timestamp: "2026-08-27T14:00:00.000Z",
      }),
      decodeMqttMessage({
        topic: "sensors/temperature/device-02",
        payload: '{"value":24.1,"unit":"C"}',
        timestamp: "2026-08-27T14:00:01.000Z",
      }),
    ];

    const a = inspectEvents(events, 0);
    const b = inspectEvents(events, 0);
    expect(a).toEqual(b);
    expect(a.topics["sensors/temperature/device-01"]).toBe(1);
    expect(a.topics["sensors/temperature/#"]).toBeUndefined();
    expect(a.devices).toBe(2);
  });
});

describe("Result", () => {
  it("composes with map / flatMap without throwing", () => {
    const doubled = map((n: number) => n * 2)(ok(21));
    expect(doubled).toEqual(ok(42));

    const failed = flatMap((n: number) => err(new Error(`bad:${n}`)))(ok(1));
    expect(isOk(failed)).toBe(false);
  });
});
