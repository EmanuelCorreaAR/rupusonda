export type ModbusRegisterType = "holding" | "input" | "coil" | "discrete";

export type ModbusMessage = Readonly<{
  /** Register address (Modbus address space). */
  address: number;
  value: unknown;
  timestamp?: string;
  /** Explicit device id (preferred over slaveId when both present). */
  deviceId?: string;
  /** Modbus unit/slave id — mapped to deviceId only when deviceId is absent. */
  slaveId?: number;
  registerType?: ModbusRegisterType;
  functionCode?: number;
  /** Optional human label; never inferred from address alone in v0.3. */
  metric?: string;
  unit?: string;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type DecodedModbusValue = Readonly<{
  value: unknown;
  kind: "number" | "boolean" | "string" | "json" | "unknown";
}>;
