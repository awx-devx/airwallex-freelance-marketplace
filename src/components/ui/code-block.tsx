import { cn } from "cn";

export function CodeBlock({ code, className }: { code: string; className?: string }) {
  return (
    <pre
      className={cn(
        "overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap break-all text-foreground",
        className,
      )}
    >
      {code}
    </pre>
  );
}
