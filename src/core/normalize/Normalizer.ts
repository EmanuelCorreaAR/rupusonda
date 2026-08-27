import type { IoTEvent } from "../event/IoTEvent.js";
import { RupuSondaError } from "../errors.js";
import { err, ok, type Result } from "../result.js";
import { requireAdapter, type ProtocolRegistry } from "../protocol/ProtocolRegistry.js";
import type { RawIngestRecord } from "../ingest/Ingestor.js";
import type { MqttMessage } from "../../protocols/mqtt/MqttMessage.js";
import type { ModbusMessage } from "../../protocols/modbus/ModbusMessage.js";
import { isModbusRegisterType } from "../../protocols/modbus/ModbusDecoder.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const readAddress = (
  raw: Readonly<Record<string, unknown>>,
  lineNumber: number,
): Result<number, RupuSondaError> => {
  const address = raw["address"] ?? raw["register"];
  if (typeof address !== "number" || !Number.isFinite(address)) {
    return err(
      new RupuSondaError(
        "data",
        `line ${lineNumber}: modbus record requires numeric address (or register)`,
      ),
    );
  }
  return ok(address);
};

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

const toModbusMessage = (
  raw: Readonly<Record<string, unknown>>,
  lineNumber: number,
): Result<ModbusMessage, RupuSondaError> => {
  const address = readAddress(raw, lineNumber);
  if (!address.ok) {
    return address;
  }

  if (!("value" in raw)) {
    return err(new RupuSondaError("data", `line ${lineNumber}: modbus record requires value`));
  }

  const registerType = raw["registerType"];
  if (registerType !== undefined && !isModbusRegisterType(registerType)) {
    return err(
      new RupuSondaError(
        "data",
        `line ${lineNumber}: modbus registerType must be holding|input|coil|discrete`,
      ),
    );
  }

  const deviceId = raw["deviceId"];
  const slaveId = raw["slaveId"];
  const functionCode = raw["functionCode"];
  const metric = raw["metric"];
  const unit = raw["unit"];

  return ok({
    address: address.value,
    value: raw["value"],
    ...(typeof raw["timestamp"] === "string" ? { timestamp: raw["timestamp"] } : {}),
    ...(typeof deviceId === "string" ? { deviceId } : {}),
    ...(typeof slaveId === "number" ? { slaveId } : {}),
    ...(isModbusRegisterType(registerType) ? { registerType } : {}),
    ...(typeof functionCode === "number" ? { functionCode } : {}),
    ...(typeof metric === "string" ? { metric } : {}),
    ...(typeof unit === "string" ? { unit } : {}),
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
    case "modbus": {
      const message = toModbusMessage(record.raw, record.lineNumber);
      if (!message.ok) {
        return message;
      }
      return ok(adapterResult.value.decode(message.value));
    }
    case "coap":
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
