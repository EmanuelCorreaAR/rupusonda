import type { IoTEvent } from "./IoTEvent.js";
import { isProtocol } from "../protocol/Protocol.js";
import { RupuSondaError } from "../errors.js";
import { err, ok, type Result } from "../result.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Pure parse of a canonical IoTEvent from unknown JSON.
 */
export const parseIoTEvent = (
  value: unknown,
  lineNumber?: number,
): Result<IoTEvent, RupuSondaError> => {
  const where = lineNumber !== undefined ? `line ${lineNumber}: ` : "";

  if (!isRecord(value)) {
    return err(new RupuSondaError("data", `${where}IoTEvent must be a JSON object`));
  }

  if (typeof value["id"] !== "string" || value["id"].length === 0) {
    return err(new RupuSondaError("data", `${where}IoTEvent.id must be a non-empty string`));
  }
  if (typeof value["timestamp"] !== "string" || value["timestamp"].length === 0) {
    return err(
      new RupuSondaError("data", `${where}IoTEvent.timestamp must be a non-empty string`),
    );
  }
  if (!isRecord(value["source"]) || !isProtocol(value["source"]["protocol"])) {
    return err(
      new RupuSondaError(
        "data",
        `${where}IoTEvent.source.protocol is missing or unsupported`,
      ),
    );
  }
  if (!isRecord(value["data"]) || !("value" in value["data"])) {
    return err(new RupuSondaError("data", `${where}IoTEvent.data.value is required`));
  }

  const deviceId = value["source"]["deviceId"];
  const topic = value["data"]["topic"];
  const metric = value["data"]["metric"];
  const unit = value["data"]["unit"];

  return ok(
    Object.freeze({
      id: value["id"],
      timestamp: value["timestamp"],
      source: Object.freeze({
        protocol: value["source"]["protocol"],
        ...(typeof deviceId === "string" ? { deviceId } : {}),
      }),
      data: Object.freeze({
        value: value["data"]["value"],
        ...(typeof topic === "string" ? { topic } : {}),
        ...(typeof metric === "string" ? { metric } : {}),
        ...(typeof unit === "string" ? { unit } : {}),
      }),
      metadata: Object.freeze(isRecord(value["metadata"]) ? value["metadata"] : {}),
    }),
  );
};
