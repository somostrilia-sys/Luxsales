import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  ativo: "bg-success text-success-foreground",
  pausado: "bg-warning text-warning-foreground",
  erro: "bg-destructive text-destructive-foreground",
  completo: "bg-success text-success-foreground",
  parcial: "bg-warning text-warning-foreground",
  inativo: "bg-muted text-muted-foreground",
};

const statusLabels: Record<string, string> = {
  ativo: "Ativo",
  pausado: "Pausado",
  erro: "Erro",
  completo: "Completo",
  parcial: "Parcial",
  inativo: "Inativo",
};

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={cn(
        "border-0",
        statusStyles[status] || "bg-muted text-muted-foreground",
        status === "ativo" && "status-glow-ativo"
      )}
    >
      {statusLabels[status] || status}
    </Badge>
  );
}
