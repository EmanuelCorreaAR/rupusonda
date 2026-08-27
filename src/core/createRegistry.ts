import { withAdapter, emptyRegistry, type ProtocolRegistry } from "./protocol/ProtocolRegistry.js";
import { mqttAdapter } from "../protocols/mqtt/MqttAdapter.js";

/** Frozen default registry — built once, shared safely. */
export const createDefaultRegistry = (): ProtocolRegistry =>
  withAdapter(emptyRegistry(), mqttAdapter);
