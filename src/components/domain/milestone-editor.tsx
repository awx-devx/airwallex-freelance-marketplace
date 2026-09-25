"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Row = { title: string; amount: string };

export function MilestoneEditor({
  defaultRows,
  max = 10,
  fieldErrors = {},
}: {
  defaultRows: Row[];
  max?: number;
  fieldErrors?: Record<string, string>;
}) {
  const form = useForm<{ milestones: Row[] }>({ defaultValues: { milestones: defaultRows } });
  const fields = useFieldArray({ control: form.control, name: "milestones" });
  const atMax = fields.fields.length >= max;

  return (
    <div className="flex flex-col gap-3">
      {fields.fields.map((field, index) => {
        const amountError = fieldErrors[`milestones.${index}.amount`];
        const titleError = fieldErrors[`milestones.${index}.title`];
        return (
          <div key={field.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem_auto]">
            <div>
              <Input aria-label={`Milestone ${index + 1} title`} aria-invalid={Boolean(titleError)} {...form.register(`milestones.${index}.title`)} />
              {titleError ? <p className="mt-1 text-xs text-danger">{titleError}</p> : null}
            </div>
            <div>
              <Input aria-label={`Milestone ${index + 1} amount`} aria-invalid={Boolean(amountError)} {...form.register(`milestones.${index}.amount`)} />
              {amountError ? <p className="mt-1 text-xs text-danger">{amountError}</p> : null}
            </div>
            <Button type="button" variant="ghost" size="sm" disabled={fields.fields.length === 1} onClick={() => fields.remove(index)}>
              Remove
            </Button>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" className="w-fit" disabled={atMax} onClick={() => fields.append({ title: "", amount: "" })}>
        {atMax ? `Maximum is ${max} milestones` : "Add milestone"}
      </Button>
    </div>
  );
}
