"use client";

import { useState, type FormEvent } from "react";
import { SubmitDeliveryInputSchema, type SubmitDeliveryInput } from "@/contracts/offers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function DeliveryForm({
  defaultLinks = [""],
  defaultNote = "",
  submitting = false,
  error,
  onSubmit,
}: {
  defaultLinks?: string[];
  defaultNote?: string;
  submitting?: boolean;
  error?: string;
  onSubmit?: (input: SubmitDeliveryInput) => void;
}) {
  const [links, setLinks] = useState(defaultLinks);
  const [note, setNote] = useState(defaultNote);
  const [formError, setFormError] = useState(error);

  function updateLink(index: number, value: string) {
    setLinks((current) => current.map((link, item) => (item === index ? value : link)));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = SubmitDeliveryInputSchema.safeParse({
      links: links.map((link) => link.trim()).filter(Boolean),
      note: note.trim() || undefined,
    });
    if (!parsed.success) {
      setFormError(parsed.error.issues[0]?.message ?? "Check the delivery links.");
      return;
    }
    setFormError(undefined);
    onSubmit?.(parsed.data);
  }

  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      {links.map((link, index) => (
        <div key={index} className="flex gap-2">
          <Input
            value={link}
            placeholder="https://"
            aria-label={`Link ${index + 1}`}
            aria-invalid={Boolean(formError)}
            onChange={(event) => updateLink(index, event.target.value)}
          />
          {links.length > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLinks((current) => current.filter((_, item) => item !== index))}
            >
              Remove
            </Button>
          ) : null}
        </div>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-fit"
        disabled={links.length >= 5}
        onClick={() => setLinks((current) => [...current, ""])}
      >
        {links.length >= 5 ? "5 links maximum" : "Add link"}
      </Button>
      <Textarea value={note} placeholder="Note for the buyer" aria-label="Delivery note" onChange={(event) => setNote(event.target.value)} />
      {formError ? <p className="text-sm text-danger">{formError}</p> : null}
      <Button type="submit" variant="primary" className="w-fit" loading={submitting}>
        Submit delivery
      </Button>
    </form>
  );
}
