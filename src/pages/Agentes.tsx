import { useState } from "react";
import { Play, Pause, History, Search } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/StatusBadge";
import { agentes as initialAgentes, type Agente } from "@/lib/mock-data";
import { toast } from "sonner";

export default function Agentes() {
  const [lista, setLista] = useState<Agente[]>(initialAgentes);
  const [busca, setBusca] = useState("");

  const filtrados = lista.filter(
    (a) =>
      a.nome.toLowerCase().includes(busca.toLowerCase()) ||
      a.empresa.toLowerCase().includes(busca.toLowerCase())
  );

  const toggleStatus = (id: string) => {
    setLista((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, status: a.status === "ativo" ? "pausado" : "ativo" }
          : a
      )
    );
    toast.success("Status do agente atualizado");
  };

  const rodarManualmente = (nome: string) => {
    toast.success(`Agente "${nome}" executado manualmente`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold">Agentes</h1>
            <p className="text-muted-foreground text-sm">Gerencie seus agentes de IA</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar agente ou empresa..."
              className="pl-9"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-4 animate-stagger">
          {filtrados.map((a) => (
            <Card key={a.id} className="shadow-sm bg-card/80 backdrop-blur-sm border hover:shadow-md transition-all duration-200">
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{a.emoji}</span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{a.nome}</p>
                        <StatusBadge status={a.status} />
                      </div>
                      <p className="text-sm text-muted-foreground">{a.descricao}</p>
                      <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                        <span>Empresa: <span className="font-medium text-foreground">{a.empresa}</span></span>
                        <span>Último: {a.ultimoRelatorio}</span>
                        <span>Próximo: {a.proximaExecucao}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" className="btn-shimmer" onClick={() => rodarManualmente(a.nome)}>
                      <Play className="h-3 w-3 mr-1" /> Rodar
                    </Button>
                    <Button
                      size="sm"
                      variant={a.status === "ativo" ? "outline" : "default"}
                      className="btn-shimmer"
                      onClick={() => toggleStatus(a.id)}
                    >
                      <Pause className="h-3 w-3 mr-1" />
                      {a.status === "ativo" ? "Pausar" : "Ativar"}
                    </Button>
                    <Button size="sm" variant="ghost">
                      <History className="h-3 w-3 mr-1" /> Histórico
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
