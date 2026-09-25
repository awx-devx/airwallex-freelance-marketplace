import type { FieldPath, FieldValues, UseFormReturn } from "react-hook-form";
import { ApiError } from "@/lib/api/errors";

export function applyApiFieldErrors<T extends FieldValues>(form: UseFormReturn<T>, error: unknown) {
  if (!(error instanceof ApiError) || !error.fieldErrors) return;
  for (const [path, messages] of Object.entries(error.fieldErrors)) {
    const message = messages[0];
    if (message) form.setError(path as FieldPath<T>, { message });
  }
}
