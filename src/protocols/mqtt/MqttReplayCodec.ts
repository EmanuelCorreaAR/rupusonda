import type { IoTEvent } from "../../core/event/IoTEvent.js";
import { RupuSondaError } from "../../core/errors.js";
import { err, ok, type Result } from "../../core/result.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isBinaryEnvelope = (
  value: unknown,
): value is { type: "binary"; encoding: "base64"; data: string } =>
  isRecord(value) &&
  value["type"] === "binary" &&
  value["encoding"] === "base64" &&
  typeof value["data"] === "string";

const isScalar = (value: unknown): value is string | number | boolean | null =>
  value === null ||
  typeof value === "string" ||
  typeof value === "number" ||
  typeof value === "boolean";

/**
 * Pure encode: IoTEvent value → MQTT publish payload.
 */
export const encodeMqttReplayPayload = (event: IoTEvent): Buffer | string => {
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
};

export const requireReplayTopic = (event: IoTEvent): Result<string, RupuSondaError> => {
  const topic = event.data.topic;
  if (typeof topic !== "string" || topic.length === 0) {
    return err(
      new RupuSondaError(
        "data",
        `IoTEvent ${event.id} has no data.topic — cannot replay to MQTT`,
      ),
    );
  }
  if (topic.includes("#") || topic.includes("+")) {
    return err(
      new RupuSondaError(
        "data",
        `IoTEvent ${event.id} topic looks like a subscription filter (${topic})`,
      ),
    );
  }
  return ok(topic);
};
