import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileSearch, Upload, Loader2, FileText } from "lucide-react";

export default function Extracao() {
  const { collaborator } = useCollaborator();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState("cep");
  const [params, setParams] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [stats, setStats] = useState({ total: 0, today: 0 });

  useEffect(() => { loadLogs(); }, [collaborator]);

  const loadLogs = async () => {
    if (!collaborator) return;
    const { data } = await supabase
      .from("extraction_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);
    setLogs(data || []);

    const { count } = await supabase.from("extraction_logs").select("id", { count: "exact", head: true });
    const today = new Date().toISOString().slice(0, 10);
    const { count: todayCount } = await supabase.from("extraction_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", today);

    setStats({ total: count || 0, today: todayCount || 0 });
    setLoading(false);
  };

  const handleExtract = async () => {
    if (!params.trim()) { toast.error("Preencha os parâmetros"); return; }
    setSubmitting(true);
    const { error } = await supabase.from("extraction_logs").insert({
      type: tipo,
      parameters: { query: params },
      status: "pending",
      extracted_by: collaborator!.id,
      results_count: 0,
    });
    if (error) toast.error("Erro ao criar extração", { description: error.message });
    else { toast.success("Extração registrada!"); setParams(""); loadLogs(); }
    setSubmitting(false);
  };

  const paramLabels: Record<string, string> = {
    cep: "CEP ou faixa (ex: 01000-000)",
    cidade: "Cidade / UF (ex: São Paulo/SP)",
    cnae: "Código CNAE (ex: 4711-3/02)",
    csv: "URL ou caminho do arquivo CSV",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Extração de Contatos</h1>
          <p className="text-muted-foreground text-sm">Extraia leads por CEP, Cidade, CNAE ou CSV</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="kpi-card border-0 bg-gradient-to-br from-[hsl(var(--kpi-from))] to-[hsl(var(--kpi-to))] text-primary-foreground">
            <CardContent className="pt-6 flex items-center justify-between">
              <div><p className="text-sm text-primary-foreground/70">Total Extrações</p><p className="text-3xl font-bold">{stats.total}</p></div>
              <FileSearch className="h-8 w-8 text-primary-foreground/50" />
            </CardContent>
          </Card>
          <Card className="kpi-card border-0 bg-gradient-to-br from-[hsl(var(--kpi-from))] to-[hsl(var(--kpi-to))] text-primary-foreground">
            <CardContent className="pt-6 flex items-center justify-between">
              <div><p className="text-sm text-primary-foreground/70">Extrações Hoje</p><p className="text-3xl font-bold">{stats.today}</p></div>
              <FileText className="h-8 w-8 text-primary-foreground/50" />
            </CardContent>
          </Card>
        </div>

        {/* Form */}
        <Card>
          <CardHeader><CardTitle>Nova Extração</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={tipo} onValueChange={setTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cep">CEP</SelectItem>
                    <SelectItem value="cidade">Cidade</SelectItem>
                    <SelectItem value="cnae">CNAE</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>{paramLabels[tipo]}</Label>
                <Input value={params} onChange={e => setParams(e.target.value)} placeholder={paramLabels[tipo]} />
              </div>
            </div>
            <Button onClick={handleExtract} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Upload className="h-4 w-4 mr-2" />}
              Iniciar Extração
            </Button>
          </CardContent>
        </Card>

        {/* History */}
        <Card>
          <CardHeader><CardTitle>Histórico de Extrações</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Parâmetros</TableHead>
                    <TableHead>Resultados</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id}>
                      <TableCell className="capitalize font-medium">{log.type}</TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {JSON.stringify(log.parameters)}
                      </TableCell>
                      <TableCell>{log.results_count}</TableCell>
                      <TableCell>
                        <Badge variant={log.status === "completed" ? "default" : log.status === "error" ? "destructive" : "secondary"}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">{new Date(log.created_at).toLocaleString("pt-BR")}</TableCell>
                    </TableRow>
                  ))}
                  {logs.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma extração registrada</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
