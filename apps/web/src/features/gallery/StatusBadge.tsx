import { AnimatedBadge, type AnimatedBadgeStatus } from "@/components/motion/animated-badge";
import { useT, type MessageKey } from "@/i18n";
import type { Status } from "@/lib/api";

const MAP: Record<Status, { label: MessageKey; status: AnimatedBadgeStatus }> = {
  waiting: { label: "status.waiting", status: "loading" },
  queuing: { label: "status.waiting", status: "loading" },
  generating: { label: "status.generating", status: "loading" },
  success: { label: "status.success", status: "success" },
  fail: { label: "status.fail", status: "danger" },
};

export function StatusBadge({ status }: { status: Status }) {
  const t = useT();
  const s = MAP[status];
  return (
    <AnimatedBadge status={s.status} size="sm" contentKey={status}>
      {t(s.label)}
    </AnimatedBadge>
  );
}
