import { ProtocolRegistry } from "../core/protocol/ProtocolRegistry.js";
import { MqttAdapter } from "../protocols/mqtt/MqttAdapter.js";

export function createDefaultRegistry(): ProtocolRegistry {
  const registry = new ProtocolRegistry();
  registry.register(new MqttAdapter());
  return registry;
}
