import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { runInspect } from "../src/cli/commands/inspect.js";
import { collectJsonl } from "../src/core/ingest/Ingestor.js";
import { createDefaultRegistry } from "../src/core/createRegistry.js";
import { normalizeRecord } from "../src/core/normalize/Normalizer.js";

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "fixtures", "coap");

describe("coap inspect / ingest", () => {
  it("normalizes coap fixture lines", async () => {
    const { records, issues } = await collectJsonl(path.join(fixtures, "simple.jsonl"));
    expect(issues).toHaveLength(0);
    expect(records).toHaveLength(3);

    const registry = createDefaultRegistry();
    const events = records.map((r) => normalizeRecord(registry, r));
    expect(events.every((e) => e.ok)).toBe(true);
    if (events[0]?.ok) {
      expect(events[0].value.source.protocol).toBe("coap");
      expect(events[0].value.data.topic).toBe("/sensors/temperature");
    }
    if (events[1]?.ok) {
      expect(events[1].value.source.deviceId).toBe("valve-02");
    }
  });

  it("inspects coap simple capture", async () => {
    const audit = await runInspect({
      path: path.join(fixtures, "simple.jsonl"),
      json: true,
    });
    expect(audit.result.events).toBe(3);
    expect(audit.result.protocols.coap).toBe(3);
    expect(audit.result.devices).toBe(2);
  });

  it("handles mixed-protocol captures with coap", async () => {
    const audit = await runInspect({
      path: path.join(fixtures, "mixed-protocol.jsonl"),
      json: true,
    });
    expect(audit.result.events).toBe(3);
    expect(audit.result.protocols.coap).toBe(1);
    expect(audit.result.protocols.mqtt).toBe(1);
    expect(audit.result.protocols.modbus).toBe(1);
  });
});
