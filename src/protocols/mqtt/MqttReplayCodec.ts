import type { IoTEvent } from "../../core/event/IoTEvent.js";
import { RupuSondaError } from "../../core/errors.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBinaryEnvelope(value: unknown): value is {
  type: "binary";
  encoding: "base64";
  data: string;
} {
  return (
    isRecord(value) &&
    value["type"] === "binary" &&
    value["encoding"] === "base64" &&
    typeof value["data"] === "string"
  );
}

function isScalar(value: unknown): value is string | number | boolean | null {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  );
}

/**
 * Encode an IoTEvent value back into an MQTT publish payload.
 * Best-effort inverse of decode — reconstructs `{value, unit}` when unit was lifted.
 */
export function encodeMqttReplayPayload(event: IoTEvent): Buffer | string {
  const value = event.data.value;

  if (isBinaryEnvelope(value)) {
    return Buffer.from(value.data, "base64");
  }
  if (Buffer.isBuffer(value)) {
    return value;
  }
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  if (typeof value === "string" && event.data.unit === undefined) {
    return value;
  }

  if (event.data.unit !== undefined && isScalar(value)) {
    return JSON.stringify({ value, unit: event.data.unit });
  }

  if (isScalar(value)) {
    if (typeof value === "string") {
      return value;
    }
    return JSON.stringify(value);
  }

  return JSON.stringify(value);
}

export function requireReplayTopic(event: IoTEvent): string {
  const topic = event.data.topic;
  if (typeof topic !== "string" || topic.length === 0) {
    throw new RupuSondaError(
      "data",
      `IoTEvent ${event.id} has no data.topic — cannot replay to MQTT`,
    );
  }
  if (topic.includes("#") || topic.includes("+")) {
    throw new RupuSondaError(
      "data",
      `IoTEvent ${event.id} topic looks like a subscription filter (${topic})`,
    );
  }
  return topic;
}
