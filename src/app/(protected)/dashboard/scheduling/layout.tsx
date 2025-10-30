import type { ReactNode } from "react";

import { SchedulingSectionLayout } from "@/features/scheduling/components/scheduling-section-layout";

export default function SchedulingLayout({ children }: { children: ReactNode }) {
  return <SchedulingSectionLayout>{children}</SchedulingSectionLayout>;
}
