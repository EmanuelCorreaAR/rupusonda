import type { ProtocolAdapter } from "./ProtocolAdapter.js";
import type { Protocol } from "./Protocol.js";
import { err, ok, type Result } from "../result.js";
import { RupuSondaError } from "../errors.js";

/**
 * Immutable protocol adapter table.
 * Construct once; never mutate — use {@link withAdapter} to extend.
 */
export type ProtocolRegistry = Readonly<{
  readonly adapters: ReadonlyMap<Protocol, ProtocolAdapter<unknown>>;
}>;

export const emptyRegistry = (): ProtocolRegistry =>
  Object.freeze({ adapters: new Map() });

export const withAdapter = <TInput>(
  registry: ProtocolRegistry,
  adapter: ProtocolAdapter<TInput>,
): ProtocolRegistry => {
  const adapters = new Map(registry.adapters);
  adapters.set(adapter.protocol, adapter as ProtocolAdapter<unknown>);
  return Object.freeze({ adapters });
};

export const getAdapter = (
  registry: ProtocolRegistry,
  protocol: Protocol,
): ProtocolAdapter<unknown> | undefined => registry.adapters.get(protocol);

export const requireAdapter = (
  registry: ProtocolRegistry,
  protocol: Protocol,
): Result<ProtocolAdapter<unknown>, RupuSondaError> => {
  const adapter = getAdapter(registry, protocol);
  if (!adapter) {
    return err(
      new RupuSondaError("protocol", `No protocol adapter registered for '${protocol}'`),
    );
  }
  return ok(adapter);
};

export const listProtocols = (registry: ProtocolRegistry): readonly Protocol[] =>
  Object.freeze([...registry.adapters.keys()].sort());
