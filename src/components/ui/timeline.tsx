import type { ReactNode } from "react";

export type TimelineItem = {
  id: string;
  icon?: ReactNode;
  actor: string;
  time: string;
  title: string;
  description?: string;
};

export function Timeline({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="flex flex-col">
      {items.map((item) => (
        <li key={item.id} className="flex gap-3 border-l border-border py-3 pl-4">
          <span className="-ml-[1.4rem] mt-0.5 flex size-5 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border">
            {item.icon}
          </span>
          <div className="min-w-0">
            <p className="text-sm">
              <span className="font-medium">{item.actor}</span>
              <span className="text-muted-foreground"> · {item.time}</span>
            </p>
            <p className="text-sm">{item.title}</p>
            {item.description ? <p className="text-sm text-muted-foreground">{item.description}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
