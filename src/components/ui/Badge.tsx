import type { ReactNode } from "react";
import { cx } from "@/components/ui/cx";

export type BadgeTone = "neutral" | "gold" | "main" | "sub" | "ananthi" | "arthy" | "santosh" | "mahi";

export function Badge({
  tone = "neutral",
  children,
  testId,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <span className={cx("badge", `badge-${tone}`)} data-testid={testId}>
      {children}
    </span>
  );
}
