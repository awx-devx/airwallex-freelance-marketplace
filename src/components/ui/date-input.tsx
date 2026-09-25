import type { ComponentProps } from "react";
import { Input } from "@/components/ui/input";

export function DateInput({
  invalid = false,
  ...props
}: ComponentProps<typeof Input> & { invalid?: boolean }) {
  return <Input type="date" aria-invalid={invalid || undefined} {...props} />;
}
