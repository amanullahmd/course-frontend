import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { isApiError } from "@/lib/api/client";

/**
 * Maps ProblemDetail field errors onto react-hook-form fields.
 * Returns true when at least one field error could be attached.
 */
export function applyServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
): boolean {
  if (!isApiError(error)) return false;
  let applied = false;
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    const match = fields.find((f) => f === field);
    if (match) {
      setError(match, { type: "server", message });
      applied = true;
    }
  }
  return applied;
}
