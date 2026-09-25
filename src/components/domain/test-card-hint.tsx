import type { PublicConfigDTO } from "@/contracts/users";
import { CopyButton } from "@/components/ui/copy-button";

export function TestCardHint({ cards }: { cards: PublicConfigDTO["testCards"] }) {
  return (
    <ul className="flex flex-col gap-2">
      {cards.map((card) => (
        <li key={card.number} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm">
          <span>
            <span className="font-mono">{card.number}</span>
            <span className="ml-2 text-muted-foreground">{card.label}</span>
          </span>
          <CopyButton value={card.number.replace(/\s/g, "")} />
        </li>
      ))}
    </ul>
  );
}
