import type { DecodedModbusValue, ModbusMessage, ModbusRegisterType } from "./ModbusMessage.js";

const REGISTER_TYPES: readonly ModbusRegisterType[] = [
  "holding",
  "input",
  "coil",
  "discrete",
];

export const isModbusRegisterType = (value: unknown): value is ModbusRegisterType =>
  typeof value === "string" && (REGISTER_TYPES as readonly string[]).includes(value);

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Pure value classification — no fieldbus I/O. */
export const decodeModbusValue = (value: unknown): DecodedModbusValue => {
  if (typeof value === "number") {
    return { value, kind: "number" };
  }
  if (typeof value === "boolean") {
    return { value, kind: "boolean" };
  }
  if (typeof value === "string") {
    return { value, kind: "string" };
  }
  if (Array.isArray(value) || isPlainObject(value)) {
    return { value, kind: "json" };
  }
  return { value, kind: "unknown" };
};

/**
 * Stable address path for inspect grouping (not a fieldbus address by itself).
 * Examples: holding/40001, coil/1, 40001
 */
export const formatModbusAddressPath = (
  address: number,
  registerType?: ModbusRegisterType,
  deviceId?: string,
): string => {
  const base = registerType ? `${registerType}/${address}` : String(address);
  return deviceId ? `${deviceId}/${base}` : base;
};

export const resolveModbusDeviceId = (
  message: Readonly<Pick<ModbusMessage, "deviceId" | "slaveId">>,
): string | undefined => {
  if (typeof message.deviceId === "string" && message.deviceId.length > 0) {
    return message.deviceId;
  }
  if (typeof message.slaveId === "number") {
    return String(message.slaveId);
  }
  return undefined;
};

export const valueFingerprint = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
};
