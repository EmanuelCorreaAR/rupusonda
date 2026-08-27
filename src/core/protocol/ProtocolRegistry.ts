import type { ProtocolAdapter } from "./ProtocolAdapter.js";
import type { Protocol } from "./Protocol.js";

export class ProtocolRegistry {
  private readonly adapters = new Map<Protocol, ProtocolAdapter<unknown>>();

  register<TInput>(adapter: ProtocolAdapter<TInput>): void {
    this.adapters.set(adapter.protocol, adapter as ProtocolAdapter<unknown>);
  }

  get(protocol: Protocol): ProtocolAdapter<unknown> | undefined {
    return this.adapters.get(protocol);
  }

  require(protocol: Protocol): ProtocolAdapter<unknown> {
    const adapter = this.get(protocol);
    if (!adapter) {
      throw new Error(`No protocol adapter registered for '${protocol}'`);
    }
    return adapter;
  }

  list(): Protocol[] {
    return [...this.adapters.keys()].sort();
  }
}
