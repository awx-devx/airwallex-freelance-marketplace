import { Avatar, AvatarFallback, AvatarGroup } from "@/components/ui/avatar";

const palette = ["#612fff", "#2563eb", "#16a34a", "#d97706", "#0f172a"];

function colorFor(name: string) {
  const index = [...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % palette.length;
  return palette[index] ?? palette[0];
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function InitialsAvatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const avatarSize = size === "md" ? "default" : size;
  return (
    <Avatar size={avatarSize}>
      <AvatarFallback style={{ backgroundColor: colorFor(name), color: "#ffffff" }}>{initials(name)}</AvatarFallback>
    </Avatar>
  );
}

export function InitialsAvatarGroup({ names }: { names: string[] }) {
  return (
    <AvatarGroup>
      {names.map((name) => (
        <InitialsAvatar key={name} name={name} />
      ))}
    </AvatarGroup>
  );
}
