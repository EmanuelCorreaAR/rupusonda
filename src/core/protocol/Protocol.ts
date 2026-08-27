export type Protocol = "mqtt" | "coap" | "modbus";

export function isProtocol(value: unknown): value is Protocol {
  return value === "mqtt" || value === "coap" || value === "modbus";
}
