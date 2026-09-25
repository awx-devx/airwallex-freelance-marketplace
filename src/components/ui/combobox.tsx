"use client";

import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

export type ComboboxItem = {
  id: string;
  label: string;
  description?: string;
};

export function Combobox({
  query,
  onQueryChange,
  items,
  loading = false,
  onSelect,
  placeholder = "Search by name or email",
  minLength = 2,
  emptyMessage = "No matches",
  id,
}: {
  query: string;
  onQueryChange: (query: string) => void;
  items: ComboboxItem[];
  loading?: boolean;
  onSelect: (item: ComboboxItem) => void;
  placeholder?: string;
  minLength?: number;
  emptyMessage?: string;
  id?: string;
}) {
  const showPrompt = query.trim().length < minLength;

  return (
    <div className="flex flex-col gap-2">
      <Input
        id={id}
        value={query}
        placeholder={placeholder}
        role="combobox"
        aria-expanded={!showPrompt}
        aria-controls={id ? `${id}-listbox` : undefined}
        aria-autocomplete="list"
        onChange={(event) => onQueryChange(event.target.value)}
      />
      {showPrompt ? (
        <p className="text-sm text-muted-foreground">Type at least {minLength} characters.</p>
      ) : loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner size="sm" />
          Searching…
        </p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyMessage}</p>
      ) : (
        <ul
          id={id ? `${id}-listbox` : undefined}
          role="listbox"
          className="overflow-hidden rounded-md border border-border bg-background"
        >
          {items.map((item) => (
            <li key={item.id} role="option" aria-selected={false}>
              <button
                type="button"
                className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                onClick={() => onSelect(item)}
              >
                <span className="font-medium">{item.label}</span>
                {item.description ? (
                  <span className="text-muted-foreground">{item.description}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
