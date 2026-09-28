import type { MeDTO, UserSummaryDTO } from "@/contracts/users";
import { DemoAccountSchema, MeSchema, UserSummarySchema } from "@/contracts/users";
import type { UserDocument } from "@/models/user";

export function initialsFromName(name: string): string {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
  return initials.slice(0, 4) || "U";
}

type UserView = Pick<UserDocument, "email" | "name" | "avatarColor" | "kind" | "airwallex"> & {
  _id: { toString(): string };
  headline?: string | null;
  demoRole?: UserDocument["demoRole"] | null;
};

export function toUserSummary(user: UserView): UserSummaryDTO {
  return UserSummarySchema.parse({
    id: user._id.toString(),
    name: user.name,
    headline: user.headline || undefined,
    avatarColor: user.avatarColor,
    initials: initialsFromName(user.name),
  });
}

export function toMe(user: UserView, isGuest: boolean): MeDTO {
  if (user.kind === "REVENUE") {
    throw new Error("Revenue accounts cannot be a session.");
  }
  return MeSchema.parse({
    ...toUserSummary(user),
    email: user.email,
    kind: user.kind,
    isGuest,
    airwallex: {
      accountId: user.airwallex.accountId || undefined,
      accountStatus: user.airwallex.accountStatus || undefined,
    },
    provisioning: {
      step: user.airwallex.provisioning.step,
      error: user.airwallex.provisioning.lastError || undefined,
      failedStep: user.airwallex.provisioning.step === "FAILED" ? user.airwallex.provisioning.failedStep : undefined,
    },
  });
}

export function toDemoAccount(user: UserView) {
  if (!user.demoRole) {
    throw new Error("Demo accounts need a role.");
  }
  return DemoAccountSchema.parse({
    ...toUserSummary(user),
    email: user.email,
    role: user.demoRole,
  });
}
