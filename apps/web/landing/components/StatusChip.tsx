import { Badge } from "@/shared/ui/badge";

export type StatusLabel = "Available" | "Beta" | "Planned" | "Custom";

export default function StatusChip({ status }: { status: StatusLabel }) {
  return (
    <Badge
      variant="outline"
      className="landing-status-badge font-mono text-xs"
      data-status={status.toLowerCase()}
    >
      {status}
    </Badge>
  );
}
