import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runInspect } from "../src/cli/commands/inspect.js";
import { createDefaultRegistry } from "../src/core/createRegistry.js";
import { collectJsonl } from "../src/core/ingest/Ingestor.js";
import { normalizeRecord } from "../src/core/normalize/Normalizer.js";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const fixtures = path.join(root, "fixtures", "modbus");

describe("modbus ingest + inspect", () => {
  it("normalizes modbus JSONL records", async () => {
    const registry = createDefaultRegistry();
    const { records } = await collectJsonl(path.join(fixtures, "simple.jsonl"));
    expect(records).toHaveLength(3);

    const events = records.map((r) => normalizeRecord(registry, r));
    expect(events.every((e) => e.ok)).toBe(true);
    if (events[0]?.ok) {
      expect(events[0].value.source.protocol).toBe("modbus");
    }
  });

  it("inspect counts modbus events and address paths", async () => {
    const audit = await runInspect({
      path: path.join(fixtures, "simple.jsonl"),
      json: true,
    });

    expect(audit.result.events).toBe(3);
    expect(audit.result.protocols.modbus).toBe(3);
    expect(audit.result.devices).toBe(2);
    expect(audit.result.topics["1/holding/40001"]).toBe(1);
    expect(audit.result.topics["plc-01/input/30002"]).toBe(1);
    expect(audit.result.topics["coil/1"]).toBe(1);
  });

  it("handles mixed-protocol captures", async () => {
    const audit = await runInspect({
      path: path.join(fixtures, "mixed-protocol.jsonl"),
      json: true,
    });

    expect(audit.result.events).toBe(3);
    expect(audit.result.protocols.modbus).toBe(2);
    expect(audit.result.protocols.mqtt).toBe(1);
  });
});
