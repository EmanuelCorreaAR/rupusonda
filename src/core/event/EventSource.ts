import type { Protocol } from "../protocol/Protocol.js";

export type EventSource = {
  protocol: Protocol;
  deviceId?: string;
};
