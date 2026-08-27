import type { IoTEvent } from "../../core/event/IoTEvent.js";
import type { ProtocolAdapter } from "../../core/protocol/ProtocolAdapter.js";
import { deriveEventId } from "../../core/event/deriveEventId.js";
import {
  decodeModbusValue,
  formatModbusAddressPath,
  resolveModbusDeviceId,
  valueFingerprint,
} from "./ModbusDecoder.js";
import type { ModbusMessage } from "./ModbusMessage.js";

/** Pure Modbus record → IoTEvent (no I/O, no clocks). */
export const decodeModbusMessage = (input: Readonly<ModbusMessage>): IoTEvent => {
  const decoded = decodeModbusValue(input.value);
  const timestamp = input.timestamp ?? "1970-01-01T00:00:00.000Z";
  const deviceId = resolveModbusDeviceId(input);
  const addressPath = formatModbusAddressPath(input.address, input.registerType, deviceId);

  return Object.freeze({
    id: deriveEventId([
      "modbus",
      timestamp,
      addressPath,
      valueFingerprint(input.value),
      ...(input.functionCode !== undefined ? [String(input.functionCode)] : []),
    ]),
    timestamp,
    source: Object.freeze({
      protocol: "modbus" as const,
      ...(deviceId !== undefined ? { deviceId } : {}),
    }),
    data: Object.freeze({
      topic: addressPath,
      ...(input.metric !== undefined ? { metric: input.metric } : {}),
      value: decoded.value,
      ...(input.unit !== undefined ? { unit: input.unit } : {}),
    }),
    metadata: Object.freeze({
      payloadKind: decoded.kind,
      address: input.address,
      ...(input.registerType !== undefined ? { registerType: input.registerType } : {}),
      ...(input.functionCode !== undefined ? { functionCode: input.functionCode } : {}),
      ...(typeof input.slaveId === "number" ? { slaveId: input.slaveId } : {}),
      ...(input.metadata ?? {}),
    }),
  });
};

export const modbusAdapter: ProtocolAdapter<ModbusMessage> = Object.freeze({
  protocol: "modbus",
  decode: decodeModbusMessage,
});
