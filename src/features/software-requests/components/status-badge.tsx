import { SoftwareRequestStatus } from "@prisma/client";

import { cn } from "@/lib/utils";
import { SOFTWARE_REQUEST_STATUS_LABELS } from "@/features/software-requests/types";

const STATUS_STYLES: Record<SoftwareRequestStatus, string> = {
  [SoftwareRequestStatus.PENDING]:
    "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-200",
  [SoftwareRequestStatus.APPROVED]:
    "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-200",
  [SoftwareRequestStatus.REJECTED]:
    "border-destructive/40 bg-destructive/15 text-destructive",
  [SoftwareRequestStatus.CANCELLED]:
    "border-muted-foreground/40 bg-muted/40 text-muted-foreground",
};

interface SoftwareRequestStatusBadgeProps {
  status: SoftwareRequestStatus;
}

export function SoftwareRequestStatusBadge({ status }: SoftwareRequestStatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-wide",
        STATUS_STYLES[status],
      )}
    >
      {SOFTWARE_REQUEST_STATUS_LABELS[status]}
    </span>
  );
}
