import { FAMILY, METHOD, TOOL, VERSION } from "../brand.js";

export type AuditEnvelope<TResult> = {
  tool: typeof TOOL;
  version: typeof VERSION;
  family: typeof FAMILY;
  command: string;
  input: Record<string, unknown>;
  configuration: Record<string, unknown>;
  method: typeof METHOD;
  result: TResult;
};

export function buildAudit<TResult>(
  command: string,
  input: Record<string, unknown>,
  configuration: Record<string, unknown>,
  result: TResult,
): AuditEnvelope<TResult> {
  return {
    tool: TOOL,
    version: VERSION,
    family: FAMILY,
    command,
    input,
    configuration,
    method: METHOD,
    result,
  };
}
