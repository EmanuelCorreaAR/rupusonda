import type { IoTEvent } from "./IoTEvent.js";
import { isProtocol } from "../protocol/Protocol.js";
import { RupuSondaError } from "../errors.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parse a canonical IoTEvent from unknown JSON.
 * Used by replay (and any consumer of IoTEvent JSONL).
 */
export function parseIoTEvent(value: unknown, lineNumber?: number): IoTEvent {
  const where = lineNumber !== undefined ? `line ${lineNumber}: ` : "";

  if (!isRecord(value)) {
    throw new RupuSondaError("data", `${where}IoTEvent must be a JSON object`);
  }

  if (typeof value["id"] !== "string" || value["id"].length === 0) {
    throw new RupuSondaError("data", `${where}IoTEvent.id must be a non-empty string`);
  }
  if (typeof value["timestamp"] !== "string" || value["timestamp"].length === 0) {
    throw new RupuSondaError("data", `${where}IoTEvent.timestamp must be a non-empty string`);
  }
  if (!isRecord(value["source"]) || !isProtocol(value["source"]["protocol"])) {
    throw new RupuSondaError("data", `${where}IoTEvent.source.protocol is missing or unsupported`);
  }
  if (!isRecord(value["data"]) || !("value" in value["data"])) {
    throw new RupuSondaError("data", `${where}IoTEvent.data.value is required`);
  }

  const deviceId = value["source"]["deviceId"];
  const topic = value["data"]["topic"];
  const metric = value["data"]["metric"];
  const unit = value["data"]["unit"];

  return {
    id: value["id"],
    timestamp: value["timestamp"],
    source: {
      protocol: value["source"]["protocol"],
      ...(typeof deviceId === "string" ? { deviceId } : {}),
    },
    data: {
      value: value["data"]["value"],
      ...(typeof topic === "string" ? { topic } : {}),
      ...(typeof metric === "string" ? { metric } : {}),
      ...(typeof unit === "string" ? { unit } : {}),
    },
    metadata: isRecord(value["metadata"]) ? value["metadata"] : {},
  };
}
