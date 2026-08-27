import { describe, expect, it } from "vitest";
import { decodeModbusMessage, modbusAdapter } from "../src/protocols/modbus/ModbusAdapter.js";
import {
  decodeModbusValue,
  formatModbusAddressPath,
  resolveModbusDeviceId,
} from "../src/protocols/modbus/ModbusDecoder.js";

describe("decodeModbusMessage", () => {
  it("decodes holding register with slaveId", () => {
    const event = decodeModbusMessage({
      address: 40001,
      value: 235,
      timestamp: "2026-08-27T14:00:00.000Z",
      slaveId: 1,
      registerType: "holding",
      unit: "0.1C",
    });

    expect(event.source.protocol).toBe("modbus");
    expect(event.source.deviceId).toBe("1");
    expect(event.data.topic).toBe("1/holding/40001");
    expect(event.data.value).toBe(235);
    expect(event.data.unit).toBe("0.1C");
    expect(event.metadata["address"]).toBe(40001);
    expect(event.metadata["registerType"]).toBe("holding");
    expect(event.metadata["payloadKind"]).toBe("number");
  });

  it("prefers explicit deviceId over slaveId", () => {
    const event = decodeModbusMessage({
      address: 30002,
      value: 42.5,
      deviceId: "plc-01",
      slaveId: 9,
      registerType: "input",
      metric: "pressure",
    });

    expect(event.source.deviceId).toBe("plc-01");
    expect(event.data.topic).toBe("plc-01/input/30002");
    expect(event.data.metric).toBe("pressure");
    expect(event.metadata["slaveId"]).toBe(9);
  });

  it("does not invent deviceId when only address is present", () => {
    const event = decodeModbusMessage({
      address: 1,
      value: true,
      registerType: "coil",
    });

    expect(event.source).toEqual({ protocol: "modbus" });
    expect(event.data.topic).toBe("coil/1");
    expect(event.metadata["payloadKind"]).toBe("boolean");
  });

  it("is deterministic for identical inputs", () => {
    const input = {
      address: 40001,
      value: 235,
      timestamp: "2026-08-27T14:00:00.000Z",
      slaveId: 1,
      registerType: "holding" as const,
    };
    const a = modbusAdapter.decode(input);
    const b = modbusAdapter.decode(input);
    expect(a).toEqual(b);
    expect(a.id).toBe(b.id);
  });
});

describe("ModbusDecoder helpers", () => {
  it("classifies values", () => {
    expect(decodeModbusValue(42).kind).toBe("number");
    expect(decodeModbusValue(true).kind).toBe("boolean");
    expect(decodeModbusValue([1, 2]).kind).toBe("json");
  });

  it("formats address paths", () => {
    expect(formatModbusAddressPath(40001, "holding", "plc-01")).toBe("plc-01/holding/40001");
    expect(formatModbusAddressPath(99)).toBe("99");
  });

  it("resolves device id conservatively", () => {
    expect(resolveModbusDeviceId({ deviceId: "plc-01", slaveId: 1 })).toBe("plc-01");
    expect(resolveModbusDeviceId({ slaveId: 3 })).toBe("3");
    expect(resolveModbusDeviceId({})).toBeUndefined();
  });
});
