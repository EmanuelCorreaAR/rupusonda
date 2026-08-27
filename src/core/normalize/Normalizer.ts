import type { IoTEvent } from "../event/IoTEvent.js";
import { RupuSondaError } from "../errors.js";
import { err, ok, type Result } from "../result.js";
import { requireAdapter, type ProtocolRegistry } from "../protocol/ProtocolRegistry.js";
import type { RawIngestRecord } from "../ingest/Ingestor.js";
import type { MqttMessage } from "../../protocols/mqtt/MqttMessage.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const toMqttMessage = (
  raw: Readonly<Record<string, unknown>>,
  lineNumber: number,
): Result<MqttMessage, RupuSondaError> => {
  const topic = raw["topic"];
  if (typeof topic !== "string" || topic.length === 0) {
    return err(
      new RupuSondaError("data", `line ${lineNumber}: mqtt record requires non-empty topic`),
    );
  }

  return ok({
    topic,
    payload: raw["payload"],
    ...(typeof raw["timestamp"] === "string" ? { timestamp: raw["timestamp"] } : {}),
    ...(typeof raw["qos"] === "number" ? { qos: raw["qos"] } : {}),
    ...(typeof raw["retain"] === "boolean" ? { retain: raw["retain"] } : {}),
    ...(isRecord(raw["metadata"]) ? { metadata: raw["metadata"] } : {}),
  });
};

/**
 * Pure normalize: raw ingest record → IoTEvent (or typed error).
 * No I/O. Adapters must themselves be pure.
 */
export const normalizeRecord = (
  registry: ProtocolRegistry,
  record: RawIngestRecord,
): Result<IoTEvent, RupuSondaError> => {
  const adapterResult = requireAdapter(registry, record.protocol);
  if (!adapterResult.ok) {
    return adapterResult;
  }

  switch (record.protocol) {
    case "mqtt": {
      const message = toMqttMessage(record.raw, record.lineNumber);
      if (!message.ok) {
        return message;
      }
      return ok(adapterResult.value.decode(message.value));
    }
    case "coap":
    case "modbus":
      return err(
        new RupuSondaError(
          "protocol",
          `Protocol '${record.protocol}' is declared but not implemented yet`,
        ),
      );
    default: {
      const _exhaustive: never = record.protocol;
      return err(new RupuSondaError("internal", `Unhandled protocol: ${String(_exhaustive)}`));
    }
  }
};
