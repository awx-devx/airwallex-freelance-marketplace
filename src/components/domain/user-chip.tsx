import type { UserSummaryDTO } from "@/contracts/users";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "cn";

export function UserChip({
  user,
  subtitle,
  size = "sm",
  className,
  labelClassName,
}: {
  user: UserSummaryDTO;
  subtitle?: string;
  size?: "sm" | "md";
  className?: string;
  labelClassName?: string;
}) {
  const line = subtitle ?? user.headline;

  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <Avatar size={size === "md" ? "default" : "sm"}>
        <AvatarFallback style={{ backgroundColor: user.avatarColor, color: "var(--avatar-foreground)" }}>
          {user.initials}
        </AvatarFallback>
      </Avatar>
      <span className={cn("min-w-0", labelClassName)}>
        <span className="block truncate text-sm font-medium">{user.name}</span>
        {line ? <span className="block truncate text-xs text-muted-foreground">{line}</span> : null}
      </span>
    </span>
  );
}
