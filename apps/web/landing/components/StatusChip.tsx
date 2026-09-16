import { Badge } from "@/components/ui/badge";

export type StatusLabel = "Available" | "Beta" | "Planned" | "Custom";

const STATUS_VARIANT: Record<StatusLabel, "default" | "secondary" | "outline"> = {
  Available: "default",
  Beta: "secondary",
  Planned: "outline",
  Custom: "outline",
};

export default function StatusChip({ status }: { status: StatusLabel }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} className="font-mono text-xs">
      {status}
    </Badge>
  );
}
