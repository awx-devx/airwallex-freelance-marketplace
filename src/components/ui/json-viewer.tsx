"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/ui/code-block";

export function JsonViewer({
  value,
  defaultExpanded = false,
}: {
  value: unknown;
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const pretty = JSON.stringify(value, null, 2) ?? "";
  const compact = pretty.replace(/\s+/g, " ");

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={() => setExpanded((open) => !open)}>
        {expanded ? "Collapse" : "Expand"} JSON
      </Button>
      {expanded ? (
        <CodeBlock code={pretty} />
      ) : (
        <p className="truncate font-mono text-xs text-muted-foreground">{compact}</p>
      )}
    </div>
  );
}
