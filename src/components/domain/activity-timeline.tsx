import type { ActivityItemDTO } from "@/contracts/activity";
import { formatDay } from "@/components/domain/format";
import { EmptyState } from "@/components/ui/empty-state";

export function ActivityTimeline({ items }: { items: ActivityItemDTO[] }) {
  if (items.length === 0) {
    return <EmptyState title="No activity yet" description="Updates appear here as the offer moves." />;
  }

  return (
    <ol className="flex flex-col gap-4 border-l border-border pl-4">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span className="absolute top-1.5 -left-[1.3rem] size-2 rounded-full bg-foreground" aria-hidden />
          <p className="text-sm">
            {item.actor ? <span className="font-medium">{item.actor.name}</span> : null}
            {item.actor ? " · " : null}
            <span className="text-muted-foreground">{formatDay(item.createdAt)}</span>
          </p>
          <p className="text-sm">{item.message}</p>
        </li>
      ))}
    </ol>
  );
}
