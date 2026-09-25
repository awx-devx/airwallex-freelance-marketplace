import type { DeliveryDTO } from "@/contracts/offers";
import { formatDay } from "@/components/domain/format";

export function DeliveryView({ delivery }: { delivery: DeliveryDTO }) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-background p-3 text-sm">
      <p className="text-xs text-muted-foreground">Submitted {formatDay(delivery.submittedAt)}</p>
      <ul className="flex flex-col gap-1">
        {delivery.links.map((link) => (
          <li key={link} className="truncate">
            <a href={link} className="text-primary underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
              {link}
            </a>
          </li>
        ))}
      </ul>
      {delivery.note ? <p>{delivery.note}</p> : null}
      {delivery.review?.comment ? (
        <p className="border-t border-border pt-2 text-muted-foreground">Review: {delivery.review.comment}</p>
      ) : null}
    </div>
  );
}
