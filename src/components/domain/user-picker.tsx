"use client";

import { useState } from "react";
import type { UserSummaryDTO } from "@/contracts/users";
import { UserChip } from "@/components/domain/user-chip";
import { Combobox } from "@/components/ui/combobox";
import { useUserSearch } from "@/hooks/session";

export function UserPicker({
  value,
  onChange,
}: {
  value?: UserSummaryDTO;
  onChange?: (user: UserSummaryDTO) => void;
}) {
  const [query, setQuery] = useState("");
  const search = useUserSearch(query);

  return (
    <div className="flex flex-col gap-3">
      {value ? <UserChip user={value} size="md" /> : null}
      {search.isError ? <p className="text-sm text-danger">Sign in from the mock panel to search people.</p> : null}
      <Combobox
        query={query}
        onQueryChange={setQuery}
        loading={search.isFetching}
        items={(search.data ?? []).map((user) => ({
          id: user.id,
          label: user.name,
          description: user.headline,
        }))}
        onSelect={(item) => {
          const user = search.data?.find((entry) => entry.id === item.id);
          if (user) onChange?.(user);
          setQuery("");
        }}
      />
    </div>
  );
}
