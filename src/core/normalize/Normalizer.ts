import type { IoTEvent } from "../event/IoTEvent.js";
import { RupuSondaError } from "../errors.js";
import type { ProtocolRegistry } from "../protocol/ProtocolRegistry.js";
import type { RawIngestRecord } from "../ingest/Ingestor.js";
import type { MqttMessage } from "../../protocols/mqtt/MqttMessage.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toMqttMessage(raw: Record<string, unknown>, lineNumber: number): MqttMessage {
  const topic = raw["topic"];
  if (typeof topic !== "string" || topic.length === 0) {
    throw new RupuSondaError("data", `line ${lineNumber}: mqtt record requires non-empty topic`);
  }

  const message: MqttMessage = {
    topic,
    payload: raw["payload"],
  };

  if (typeof raw["timestamp"] === "string") {
    message.timestamp = raw["timestamp"];
  }
  if (typeof raw["qos"] === "number") {
    message.qos = raw["qos"];
  }
  if (typeof raw["retain"] === "boolean") {
    message.retain = raw["retain"];
  }
  if (isRecord(raw["metadata"])) {
    message.metadata = raw["metadata"];
  }

  return message;
}

export class Normalizer {
  constructor(private readonly registry: ProtocolRegistry) {}

  normalize(record: RawIngestRecord): IoTEvent {
    const adapter = this.registry.require(record.protocol);

    switch (record.protocol) {
      case "mqtt": {
        const message = toMqttMessage(record.raw, record.lineNumber);
        return adapter.decode(message);
      }
      case "coap":
      case "modbus":
        throw new RupuSondaError(
          "protocol",
          `Protocol '${record.protocol}' is declared but not implemented in v0.1`,
        );
      default: {
        const _exhaustive: never = record.protocol;
        throw new RupuSondaError("internal", `Unhandled protocol: ${String(_exhaustive)}`);
      }
    }
  }
}
