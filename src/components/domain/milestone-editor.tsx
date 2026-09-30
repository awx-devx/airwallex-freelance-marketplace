"use client";

import { useFieldArray, useForm, useFormContext, type Control, type UseFormRegister } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Row = { title: string; amount: string; description?: string; dueDate?: string };
type MilestoneForm = { milestones: Row[] };

function MilestoneFields({
  control,
  register,
  max,
  fieldErrors,
  detailed,
}: {
  control: Control<MilestoneForm>;
  register: UseFormRegister<MilestoneForm>;
  max: number;
  fieldErrors: Record<string, string>;
  detailed: boolean;
}) {
  const fields = useFieldArray({ control, name: "milestones" });
  const atMax = fields.fields.length >= max;

  return (
    <div className="flex flex-col gap-3">
      {fields.fields.map((field, index) => {
        const amountError = fieldErrors[`milestones.${index}.amount`];
        const titleError = fieldErrors[`milestones.${index}.title`];
        const descriptionError = fieldErrors[`milestones.${index}.description`];
        const dueError = fieldErrors[`milestones.${index}.dueDate`];
        return (
          <div key={field.id} className={detailed ? "flex flex-col gap-2 rounded-md border border-border p-3" : "grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem_auto]"}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem_auto]">
              <div>
                <Input placeholder="Milestone title" aria-label={`Milestone ${index + 1} title`} aria-invalid={Boolean(titleError)} {...register(`milestones.${index}.title`)} />
                {titleError ? <p className="mt-1 text-xs text-danger">{titleError}</p> : null}
              </div>
              <div>
                <Input placeholder="450.00" aria-label={`Milestone ${index + 1} amount`} aria-invalid={Boolean(amountError)} {...register(`milestones.${index}.amount`)} />
                {amountError ? <p className="mt-1 text-xs text-danger">{amountError}</p> : null}
              </div>
              <Button type="button" variant="ghost" size="sm" disabled={fields.fields.length === 1} onClick={() => fields.remove(index)}>
                Remove
              </Button>
            </div>
            {detailed ? (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem]">
                <div>
                  <Textarea placeholder="What you'll deliver" aria-label={`Milestone ${index + 1} description`} aria-invalid={Boolean(descriptionError)} {...register(`milestones.${index}.description`)} />
                  {descriptionError ? <p className="mt-1 text-xs text-danger">{descriptionError}</p> : null}
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground" htmlFor={`milestone-${index}-due`}>
                    Due date
                  </label>
                  <Input id={`milestone-${index}-due`} type="date" aria-label={`Milestone ${index + 1} due date`} aria-invalid={Boolean(dueError)} {...register(`milestones.${index}.dueDate`)} />
                  {dueError ? <p className="mt-1 text-xs text-danger">{dueError}</p> : null}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" className="w-fit" disabled={atMax} onClick={() => fields.append({ title: "", amount: "" })}>
        {atMax ? `Maximum is ${max} milestones` : "Add milestone"}
      </Button>
    </div>
  );
}

function StandaloneEditor({
  defaultRows,
  max,
  fieldErrors,
  detailed,
}: {
  defaultRows: Row[];
  max: number;
  fieldErrors: Record<string, string>;
  detailed: boolean;
}) {
  const form = useForm<MilestoneForm>({ defaultValues: { milestones: defaultRows } });
  return <MilestoneFields control={form.control} register={form.register} max={max} fieldErrors={fieldErrors} detailed={detailed} />;
}

function ConnectedEditor({ max, fieldErrors }: { max: number; fieldErrors: Record<string, string> }) {
  const form = useFormContext<MilestoneForm>();
  return <MilestoneFields control={form.control} register={form.register} max={max} fieldErrors={fieldErrors} detailed />;
}

export function MilestoneEditor({
  defaultRows = [{ title: "", amount: "" }],
  max = 10,
  fieldErrors = {},
  detailed = false,
  connected = false,
}: {
  defaultRows?: Row[];
  max?: number;
  fieldErrors?: Record<string, string>;
  detailed?: boolean;
  connected?: boolean;
}) {
  if (connected) return <ConnectedEditor max={max} fieldErrors={fieldErrors} />;
  return <StandaloneEditor defaultRows={defaultRows} max={max} fieldErrors={fieldErrors} detailed={detailed} />;
}
