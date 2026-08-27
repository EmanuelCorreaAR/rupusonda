import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runInspect } from "../src/cli/commands/inspect.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = path.join(root, "fixtures", "mqtt");

describe("inspect", () => {
  it("counts events, protocols, and devices", async () => {
    const audit = await runInspect({
      path: path.join(fixtures, "multiple-devices.jsonl"),
      json: true,
    });

    expect(audit.tool).toBe("rupusonda");
    expect(audit.command).toBe("inspect");
    expect(audit.result.events).toBe(5);
    expect(audit.result.protocols.mqtt).toBe(5);
    expect(audit.result.devices).toBe(3);
    expect(audit.result.deviceIds).toEqual(["device-01", "device-02", "device-03"]);
    expect(audit.result.topics["sensors/temperature/device-01"]).toBe(1);
    expect(audit.result.topics["sensors/temperature/device-02"]).toBe(1);
    expect(audit.result.topics["sensors/temperature/device-03"]).toBe(1);
    expect(audit.result.topics["sensors/humidity/device-01"]).toBe(1);
    expect(audit.result.topics["sensors/humidity/device-03"]).toBe(1);
    expect(audit.result.topics["sensors/temperature/#"]).toBeUndefined();
  });

  it("produces deterministic JSON", async () => {
    const pathSimple = path.join(fixtures, "simple.jsonl");
    const a = await runInspect({ path: pathSimple, json: true });
    const b = await runInspect({ path: pathSimple, json: true });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("counts payload kinds for text fixture", async () => {
    const audit = await runInspect({
      path: path.join(fixtures, "text-payload.jsonl"),
      json: true,
    });
    expect(audit.result.payloads.text).toBe(2);
    expect(audit.result.payloads.json).toBe(0);
  });
});
