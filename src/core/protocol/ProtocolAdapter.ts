import type { IoTEvent } from "../event/IoTEvent.js";
import type { Protocol } from "./Protocol.js";

export interface ProtocolAdapter<TInput> {
  readonly protocol: Protocol;
  decode(input: TInput): IoTEvent;
}
