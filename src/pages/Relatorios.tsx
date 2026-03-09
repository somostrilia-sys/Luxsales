import { useState } from "react";
import { Search } from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "@/components/StatusBadge";
import { relatorios } from "@/lib/mock-data";

export default function Relatorios() {
  const [busca, setBusca] = useState("");
  const [filtroEmpresa, setFiltroEmpresa] = useState("todas");
  const [filtroAgente, setFiltroAgente] = useState("todos");

  const agentesUnicos = [...new Set(relatorios.map((r) => r.agenteNome))];

  const filtrados = relatorios.filter((r) => {
    const matchBusca = r.resumo.toLowerCase().includes(busca.toLowerCase()) || r.agenteNome.toLowerCase().includes(busca.toLowerCase());
    const matchEmpresa = filtroEmpresa === "todas" || r.empresa === filtroEmpresa;
    const matchAgente = filtroAgente === "todos" || r.agenteNome === filtroAgente;
    return matchBusca && matchEmpresa && matchAgente;
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="animate-fade-in">
          <h1 className="text-2xl font-bold">Relatórios</h1>
          <p className="text-muted-foreground text-sm">Todos os relatórios gerados pelos agentes</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar relatório..." className="pl-9" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Select value={filtroEmpresa} onValueChange={setFiltroEmpresa}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas</SelectItem>
              <SelectItem value="Objetivo">Objetivo</SelectItem>
              <SelectItem value="Trilia">Trilia</SelectItem>
              <SelectItem value="WALK">WALK</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filtroAgente} onValueChange={setFiltroAgente}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos Agentes</SelectItem>
              {agentesUnicos.map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Card className="shadow-sm overflow-hidden bg-card/80 backdrop-blur-sm" style={{ animation: 'fade-slide-up 0.5s ease-out 0.1s both' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium">Agente</th>
                  <th className="text-left p-3 font-medium">Empresa</th>
                  <th className="text-left p-3 font-medium">Tipo</th>
                  <th className="text-left p-3 font-medium">Data</th>
                  <th className="text-left p-3 font-medium">Resumo</th>
                  <th className="text-left p-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((r) => (
                  <tr key={r.id} className="border-t table-row-hover">
                    <td className="p-3">
                      <span className="mr-2">{r.agenteEmoji}</span>
                      <span className="font-medium">{r.agenteNome}</span>
                    </td>
                    <td className="p-3">{r.empresa}</td>
                    <td className="p-3">{r.tipo}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">{r.data}</td>
                    <td className="p-3 text-muted-foreground max-w-xs truncate">{r.resumo}</td>
                    <td className="p-3"><StatusBadge status={r.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  );
}
