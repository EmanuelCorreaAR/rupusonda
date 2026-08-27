export const EXIT_OK = 0;
export const EXIT_ERROR = 1;
export const EXIT_POLICY = 2;

export type ErrorKind =
  | "usage"
  | "data"
  | "protocol"
  | "internal";

export class RupuSondaError extends Error {
  readonly kind: ErrorKind;
  readonly exitCode: number;

  constructor(kind: ErrorKind, message: string, exitCode: number = EXIT_ERROR) {
    super(message);
    this.name = "RupuSondaError";
    this.kind = kind;
    this.exitCode = exitCode;
  }
}

export function toRupuSondaError(error: unknown): RupuSondaError {
  if (error instanceof RupuSondaError) {
    return error;
  }
  if (error instanceof Error) {
    return new RupuSondaError("internal", error.message);
  }
  return new RupuSondaError("internal", String(error));
}
