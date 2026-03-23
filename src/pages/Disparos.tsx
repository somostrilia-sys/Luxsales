import { useState, useEffect, useCallback, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Upload, Save, Play, Pause, Clock, AlertTriangle, FileSpreadsheet, Send, Users } from "lucide-react";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// ─── Helpers ────────────────────────────────
const edgePost = async (fn: string, body: any) => {
  const res = await fetch(`${EDGE_BASE}/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Erro na requisição");
  return data;
};

const PHONE_HEADERS = ["telefone", "phone", "celular", "whatsapp", "fone", "tel"];
const NAME_HEADERS = ["nome", "name", "cliente", "razao_social", "razão social"];
const detectCol = (headers: string[], candidates: string[]) =>
  headers.find(h => candidates.some(c => h.toLowerCase().includes(c))) || null;

// ─── Upload Section ─────────────────────────
function UploadSection({ collaboratorId }: { collaboratorId: string }) {
  const [preview, setPreview] = useState<any[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [phoneCol, setPhoneCol] = useState<string | null>(null);
  const [nameCol, setNameCol] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imported, setImported] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImported(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const wb = XLSX.read(ev.target?.result, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
      if (json.length === 0) { toast.error("Arquivo vazio"); return; }
      const hdrs = Object.keys(json[0]);
      setHeaders(hdrs);
      setPhoneCol(detectCol(hdrs, PHONE_HEADERS));
      setNameCol(detectCol(hdrs, NAME_HEADERS));
      setAllRows(json);
      setPreview(json.slice(0, 10));
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmUpload = async () => {
    if (!phoneCol) { toast.error("Coluna de telefone não detectada"); return; }
    setUploading(true);
    try {
      const contacts = allRows.map(r => ({ name: nameCol ? String(r[nameCol]) : "", phone: String(r[phoneCol!]) })).filter(c => c.phone);
      const data = await edgePost("upload-contacts", { collaborator_id: collaboratorId, contacts });
      setImported(data.imported ?? contacts.length);
      toast.success(`${data.imported ?? contacts.length} contatos importados`);
      setPreview([]); setAllRows([]); setHeaders([]);
      if (fileRef.current) fileRef.current.value = "";
    } catch (e: any) { toast.error(e.message); }
    setUploading(false);
  };

  return (
    <Card variant="gradient">
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Upload className="h-4 w-4" /> Upload de Contatos</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Input ref={fileRef} type="file" accept=".xlsx,.csv,.xls" onChange={handleFile} className="cursor-pointer" />
        {preview.length > 0 && (
          <>
            <div className="flex gap-2 flex-wrap text-xs text-muted-foreground">
              <span>📞 Telefone: <Badge variant="secondary">{phoneCol || "Não detectado"}</Badge></span>
              <span>👤 Nome: <Badge variant="secondary">{nameCol || "Não detectado"}</Badge></span>
              <span>Total: <Badge variant="secondary">{allRows.length} linhas</Badge></span>
            </div>
            <div className="overflow-auto max-h-60 rounded border border-border">
              <Table>
                <TableHeader>
                  <TableRow>{headers.slice(0, 5).map(h => <TableHead key={h} className="text-xs whitespace-nowrap">{h}</TableHead>)}</TableRow>
                </TableHeader>
                <TableBody>
                  {preview.map((row, i) => (
                    <TableRow key={i}>{headers.slice(0, 5).map(h => <TableCell key={h} className="text-xs py-1">{String(row[h]).slice(0, 30)}</TableCell>)}</TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <Button onClick={confirmUpload} disabled={uploading || !phoneCol}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
              Confirmar Importação ({allRows.length} contatos)
            </Button>
          </>
        )}
        {imported !== null && <p className="text-sm text-green-400">✅ {imported} contatos importados com sucesso</p>}
      </CardContent>
    </Card>
  );
}

// ─── Messages Section ───────────────────────
function MessagesSection({ collaboratorId }: { collaboratorId: string }) {
  const [msgs, setMsgs] = useState<string[]>(["", "", "", "", ""]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await edgePost("blast-messages", { action: "load", collaborator_id: collaboratorId });
        if (data.messages) setMsgs(data.messages.concat(Array(5)).slice(0, 5));
      } catch {}
      setLoading(false);
    })();
  }, [collaboratorId]);

  const save = async () => {
    setSaving(true);
    try {
      await edgePost("blast-messages", { action: "save", collaborator_id: collaboratorId, messages: msgs });
      toast.success("Mensagens salvas!");
    } catch (e: any) { toast.error(e.message); }
    setSaving(false);
  };

  if (loading) return <Card variant="gradient"><CardContent className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></CardContent></Card>;

  return (
    <Card variant="gradient">
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Send className="h-4 w-4" /> Mensagens de Disparo</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {msgs.map((m, i) => (
          <div key={i}>
            <label className="text-xs text-muted-foreground mb-1 block">Mensagem {i + 1}</label>
            <Textarea value={m} onChange={e => { const n = [...msgs]; n[i] = e.target.value; setMsgs(n); }} rows={2} placeholder={`Variação ${i + 1} da mensagem...`} />
          </div>
        ))}
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar Mensagens
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── Campaign Section ───────────────────────
function CampaignSection({ collaboratorId }: { collaboratorId: string }) {
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const intervalRef = useRef<any>(null);

  const fetchJob = useCallback(async () => {
    try {
      const data = await edgePost("campaign-engine", { action: "my_job", collaborator_id: collaboratorId });
      setJob(data.job || data);
      if (data.job?.next_delay_ms) setCountdown(Math.ceil(data.job.next_delay_ms / 1000));
    } catch { setJob(null); }
    setLoading(false);
  }, [collaboratorId]);

  useEffect(() => {
    fetchJob();
    const poll = setInterval(fetchJob, 30000);
    return () => clearInterval(poll);
  }, [fetchJob]);

  useEffect(() => {
    if (countdown <= 0) return;
    intervalRef.current = setInterval(() => setCountdown(p => (p <= 1 ? 0 : p - 1)), 1000);
    return () => clearInterval(intervalRef.current);
  }, [countdown]);

  const startJob = async () => {
    setActionLoading(true);
    try {
      await edgePost("campaign-engine", {
        action: "create_job", collaborator_id: collaboratorId,
        message_templates: [], daily_limit: 240,
      });
      toast.success("Disparos iniciados!");
      fetchJob();
    } catch (e: any) { toast.error(e.message); }
    setActionLoading(false);
  };

  const stopJob = async () => {
    if (!job?.id) return;
    setActionLoading(true);
    try {
      await edgePost("campaign-engine", { action: "stop", job_id: job.id });
      toast.success("Disparos pausados");
      fetchJob();
    } catch (e: any) { toast.error(e.message); }
    setActionLoading(false);
  };

  const hour = new Date().getHours();
  const outsideHours = hour < 8 || hour >= 20;

  if (loading) return <Card variant="gradient"><CardContent className="p-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></CardContent></Card>;

  const isRunning = job?.status === "running" || job?.status === "active";

  return (
    <Card variant="gradient">
      <CardHeader><CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" /> Campanha de Disparo</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {outsideHours && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-xs text-warning">Disparos funcionam das 08h às 20h</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Enviadas hoje", value: job?.sent_today ?? 0 },
            { label: "Total enviadas", value: job?.sent_count ?? job?.total_sent ?? 0 },
            { label: "Leads restantes", value: job?.remaining ?? job?.leads_remaining ?? 0 },
            { label: "Status", value: job?.status || "inativo" },
          ].map(kpi => (
            <div key={kpi.label} className="p-3 rounded-lg bg-secondary/50 text-center">
              <p className="text-lg font-bold text-foreground">{kpi.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase">{kpi.label}</p>
            </div>
          ))}
        </div>

        {isRunning && countdown > 0 && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-primary" />
            Próximo envio em <span className="font-mono text-primary">{countdown}s</span>
          </div>
        )}

        <div className="flex gap-2">
          {!isRunning ? (
            <Button onClick={startJob} disabled={actionLoading || outsideHours}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Iniciar Disparos
            </Button>
          ) : (
            <Button variant="destructive" onClick={stopJob} disabled={actionLoading}>
              {actionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
              Pausar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────
export default function Disparos() {
  const { collaborator } = useCollaborator();
  if (!collaborator) return <DashboardLayout><PageHeader title="Disparos" subtitle="Carregando..." /></DashboardLayout>;

  return (
    <DashboardLayout>
      <PageHeader title="Disparos" subtitle="Gerencie campanhas de mensagens em massa" />
      <Tabs defaultValue="upload" className="space-y-4">
        <TabsList>
          <TabsTrigger value="upload">📤 Upload</TabsTrigger>
          <TabsTrigger value="mensagens">💬 Mensagens</TabsTrigger>
          <TabsTrigger value="campanha">🚀 Campanha</TabsTrigger>
        </TabsList>
        <TabsContent value="upload"><UploadSection collaboratorId={collaborator.id} /></TabsContent>
        <TabsContent value="mensagens"><MessagesSection collaboratorId={collaborator.id} /></TabsContent>
        <TabsContent value="campanha"><CampaignSection collaboratorId={collaborator.id} /></TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
