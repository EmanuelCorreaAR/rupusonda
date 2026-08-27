import type { Protocol } from "../protocol/Protocol.js";

export type EventSource = Readonly<{
  protocol: Protocol;
  /** Optional — only when there is enough evidence (payload or topic convention). */
  deviceId?: string;
}>;
