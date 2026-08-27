import { withAdapter, emptyRegistry, type ProtocolRegistry } from "./protocol/ProtocolRegistry.js";
import { mqttAdapter } from "../protocols/mqtt/MqttAdapter.js";
import { modbusAdapter } from "../protocols/modbus/ModbusAdapter.js";

/** Frozen default registry — built once, shared safely. */
export const createDefaultRegistry = (): ProtocolRegistry =>
  withAdapter(withAdapter(emptyRegistry(), mqttAdapter), modbusAdapter);
