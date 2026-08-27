/**
 * Deterministic Result — no exceptions for expected domain failures.
 * Side effects stay at the CLI / I/O boundary.
 */
export type Ok<T> = { readonly ok: true; readonly value: T };
export type Err<E> = { readonly ok: false; readonly error: E };
export type Result<T, E> = Ok<T> | Err<E>;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = <E>(error: E): Err<E> => ({ ok: false, error });

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;

export const map =
  <T, U, E>(fn: (value: T) => U) =>
  (result: Result<T, E>): Result<U, E> =>
    result.ok ? ok(fn(result.value)) : result;

export const flatMap =
  <T, U, E>(fn: (value: T) => Result<U, E>) =>
  (result: Result<T, E>): Result<U, E> =>
    result.ok ? fn(result.value) : result;

export const mapError =
  <T, E, F>(fn: (error: E) => F) =>
  (result: Result<T, E>): Result<T, F> =>
    result.ok ? result : err(fn(result.error));

/** Escape hatch for the I/O boundary only. */
export function unwrapOrThrow<T, E extends Error>(result: Result<T, E>): T {
  if (result.ok) {
    return result.value;
  }
  throw result.error;
}
