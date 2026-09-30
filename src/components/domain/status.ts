import {
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock,
  Inbox,
  Loader2,
  Lock,
  RotateCcw,
  Send,
  Undo2,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { MilestoneStatus, OfferStatus } from "@/contracts/offers";

export type AnyStatus = OfferStatus | MilestoneStatus;

export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger" | "violet";

export type StatusVisual = {
  label: string;
  tone: StatusTone;
  icon: LucideIcon;
  spinner: boolean;
  muted: boolean;
};

const STATUS_VISUAL = {
  SENT: { label: "Sent", tone: "neutral", icon: Send, spinner: false, muted: false },
  PENDING_FUNDING: { label: "Awaiting funding", tone: "neutral", icon: Clock, spinner: false, muted: false },
  AWAITING_PAYMENT: { label: "Awaiting payment", tone: "warning", icon: Loader2, spinner: true, muted: false },
  ACTIVE: { label: "Active", tone: "info", icon: CircleDot, spinner: false, muted: false },
  FUNDED: { label: "Held in escrow", tone: "info", icon: Lock, spinner: false, muted: false },
  SUBMITTED: { label: "Awaiting review", tone: "violet", icon: Inbox, spinner: false, muted: false },
  CHANGES_REQUESTED: { label: "Changes requested", tone: "warning", icon: RotateCcw, spinner: false, muted: false },
  RELEASING: { label: "Releasing…", tone: "warning", icon: Loader2, spinner: true, muted: false },
  PAID: { label: "Paid", tone: "success", icon: CheckCircle2, spinner: false, muted: false },
  COMPLETED: { label: "Completed", tone: "success", icon: CheckCircle2, spinner: false, muted: false },
  REFUNDING: { label: "Refunding…", tone: "warning", icon: Loader2, spinner: true, muted: false },
  REFUNDED: { label: "Refunded", tone: "neutral", icon: Undo2, spinner: false, muted: true },
  CANCELLED: { label: "Cancelled", tone: "neutral", icon: XCircle, spinner: false, muted: true },
  DECLINED: { label: "Declined", tone: "neutral", icon: XCircle, spinner: false, muted: true },
  WITHDRAWN: { label: "Withdrawn", tone: "neutral", icon: XCircle, spinner: false, muted: true },
  RELEASE_FAILED: { label: "Release failed", tone: "danger", icon: AlertTriangle, spinner: false, muted: false },
  REFUND_FAILED: { label: "Refund failed", tone: "danger", icon: AlertTriangle, spinner: false, muted: false },
} satisfies Record<AnyStatus, StatusVisual>;

export function statusVisual(status: AnyStatus): StatusVisual {
  return STATUS_VISUAL[status];
}

/** Card splits are RELEASED. Settlement to the wallet is still outstanding. */
export const releasedAwaitingSettlement: StatusVisual = {
  label: "Released",
  tone: "info",
  icon: CheckCircle2,
  spinner: false,
  muted: false,
};
