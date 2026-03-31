import { useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { useCompany } from "@/contexts/CompanyContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { EDGE_BASE, SUPABASE_ANON_KEY } from "@/lib/constants";
import { supabase } from "@/lib/supabase";
import { toast } from "sonner";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import {
  Upload, FileUp, ArrowLeft, ArrowRight, Check, Loader2,
  AlertTriangle, CheckCircle, XCircle, Table2, Settings,
  MapPin, ChevronLeft,
} from "lucide-react";

// ── helpers ──
async function getAuthHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  return { "Content-Type": "application/json", Authorization: `Bearer ${token || SUPABASE_ANON_KEY}`, apikey: SUPABASE_ANON_KEY };
}

async function callEdge(body: Record<string, unknown>) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${EDGE_BASE}/lead-distributor`, { method: "POST", headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Erro");
  return res.json();
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  try { return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); } catch { return iso; }
}

const systemFields = [
  { key: "phone_number", label: "Telefone*", required: true },
  { key: "lead_name", label: "Nome", required: false },
  { key: "email", label: "Email", required: false },
  { key: "city", label: "Cidade", required: false },
  { key: "state", label: "Estado", required: false },
  { key: "segment", label: "Segmento", required: false },
  { key: "tags", label: "Tags (vírgula)", required: false },
];

const sourceOptions = [
  { value: "import", label: "Importação Manual" },
  { value: "purchased", label: "Lista Comprada" },
  { value: "facebook_ad", label: "Facebook Ads" },
  { value: "google_ad", label: "Google Ads" },
  { value: "organic", label: "Orgânico" },
  { value: "referral", label: "Indicação" },
  { value: "website", label: "Website" },
  { value: "event", label: "Evento" },
];

// ── phone normalization (JS equivalent of normalize_phone SQL) ──
function normalizePhone(raw: string): { normalized: string | null; wasFixed: boolean } {
  const cleaned = raw.replace(/\D/g, "");
  let normalized: string | null = null;
  let wasFixed = false;

  if (cleaned.length >= 12 && cleaned.startsWith("55")) {
    normalized = "+" + cleaned;
    wasFixed = !raw.trim().startsWith("+");
  } else if (cleaned.length === 11 && cleaned[2] === "9") {
    normalized = "+55" + cleaned;
    wasFixed = true;
  } else if (cleaned.length === 10) {
    normalized = "+55" + cleaned.slice(0, 2) + "9" + cleaned.slice(2);
    wasFixed = true;
  }

  // Validate: +55XX9XXXXXXXX = 14 chars, index 4 = '9' (celular)
  if (normalized !== null && (normalized.length !== 14 || normalized[4] !== "9")) {
    normalized = null;
    wasFixed = false;
  }

  return { normalized, wasFixed };
}

function computePhoneStats(rows: Record<string, string>[], phoneCol: string) {
  let accepted = 0, corrected = 0, discarded = 0;
  rows.forEach(row => {
    const raw = (row[phoneCol] || "").trim();
    if (!raw) { discarded++; return; }
    const { normalized, wasFixed } = normalizePhone(raw);
    if (!normalized) discarded++;
    else if (wasFixed) corrected++;
    else accepted++;
  });
  return { accepted, corrected, discarded };
}

interface ImportHistory {
  id: string; started_at: string; file_name: string; total: number;
  imported: number; duplicates: number; invalid: number; status: string;
}

export default function ImportLeads() {
  const { company_id, user_role } = useCompany();
  const navigate = useNavigate();

  // wizard
  const [step, setStep] = useState(1);

  // step 1
  const [rawRows, setRawRows] = useState<Record<string, string>[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [pasteData, setPasteData] = useState("");

  // step 2
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // step 3
  const [source, setSource] = useState("import");
  const [sourceDesc, setSourceDesc] = useState("");
  const [defaultSegment, setDefaultSegment] = useState("all");
  const [defaultPriority, setDefaultPriority] = useState([5]);
  const [extraTags, setExtraTags] = useState("");

  // import state
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState<{ imported: number; duplicates: number; invalid: number; errors: string[] } | null>(null);

  // history
  const [history, setHistory] = useState<ImportHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const base = { company_id, requester_role: user_role || "ceo" };

  // ── parse file ──
  const parseCSV = (text: string) => {
    const result = Papa.parse(text, { header: true, skipEmptyLines: true });
    if (result.data.length === 0) { toast.error("Arquivo vazio"); return; }
    setHeaders(result.meta.fields || []);
    setRawRows(result.data as Record<string, string>[]);
    autoMap(result.meta.fields || []);
  };

  const parseXLSX = (buffer: ArrayBuffer) => {
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });
    if (json.length === 0) { toast.error("Arquivo vazio"); return; }
    const cols = Object.keys(json[0]);
    setHeaders(cols);
    setRawRows(json);
    autoMap(cols);
  };

  const autoMap = (cols: string[]) => {
    const m: Record<string, string> = {};
    const lower = cols.map(c => c.toLowerCase().trim());
    const match = (patterns: string[], sysKey: string) => {
      const idx = lower.findIndex(c => patterns.some(p => c.includes(p)));
      if (idx !== -1) m[sysKey] = cols[idx];
    };
    match(["telefone", "phone", "celular", "fone", "whatsapp"], "phone_number");
    match(["nome", "name"], "lead_name");
    match(["email", "e-mail"], "email");
    match(["cidade", "city"], "city");
    match(["estado", "state", "uf"], "state");
    match(["segmento", "segment", "categoria"], "segment");
    match(["tag"], "tags");
    setMapping(m);
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "csv" || ext === "txt") {
      // try utf-8 first, fallback latin1
      const reader = new FileReader();
      reader.onload = (e) => parseCSV(e.target?.result as string);
      reader.readAsText(file, "UTF-8");
    } else if (ext === "xlsx" || ext === "xls") {
      const reader = new FileReader();
      reader.onload = (e) => parseXLSX(e.target?.result as ArrayBuffer);
      reader.readAsArrayBuffer(file);
    } else {
      toast.error("Formato não suportado. Use CSV ou XLSX.");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const handlePaste = () => {
    if (!pasteData.trim()) return;
    parseCSV(pasteData);
    setFileName("colado.csv");
  };

  // ── mapped preview ──
  const getMappedRows = () => {
    return rawRows.slice(0, 5).map(row => {
      const mapped: Record<string, string> = {};
      systemFields.forEach(f => {
        const col = mapping[f.key];
        mapped[f.key] = col ? (row[col] || "") : "";
      });
      return mapped;
    });
  };

  // ── import ──
  const doImport = async () => {
    if (!mapping.phone_number) { toast.error("Mapeie o campo Telefone"); return; }
    setImporting(true);
    setImportProgress(0);
    setImportResult(null);

    const allLeads = rawRows.map(row => {
      const lead: Record<string, unknown> = {};
      systemFields.forEach(f => {
        const col = mapping[f.key];
        if (col && row[col]) {
          if (f.key === "tags") {
            lead[f.key] = row[col].split(",").map(t => t.trim()).filter(Boolean);
          } else {
            lead[f.key] = row[col];
          }
        }
      });
      // normalize phone
      if (lead.phone_number) {
        const { normalized } = normalizePhone(String(lead.phone_number));
        if (normalized) lead.phone_normalized = normalized;
        else { lead.phone_normalized = null; }
      }
      // extra data
      const mappedCols = new Set(Object.values(mapping));
      const extra: Record<string, string> = {};
      headers.forEach(h => {
        if (!mappedCols.has(h) && row[h]) extra[h] = row[h];
      });
      if (Object.keys(extra).length > 0) lead.extra_data = extra;
      // defaults
      lead.source = source;
      if (sourceDesc) lead.source_description = sourceDesc;
      if (defaultSegment !== "all") lead.segment = lead.segment || defaultSegment;
      lead.priority = defaultPriority[0];
      if (extraTags) {
        const et = extraTags.split(",").map(t => t.trim()).filter(Boolean);
        lead.tags = [...((lead.tags as string[]) || []), ...et];
      }
      return lead;
    }).filter(l => l.phone_number && l.phone_normalized !== null);

    if (allLeads.length === 0) { toast.error("Nenhum lead válido encontrado"); setImporting(false); return; }

    const BATCH = 500;
    let imported = 0, duplicates = 0, invalid = 0;
    const errors: string[] = [];
    const totalBatches = Math.ceil(allLeads.length / BATCH);

    for (let i = 0; i < totalBatches; i++) {
      const batch = allLeads.slice(i * BATCH, (i + 1) * BATCH);
      try {
        const res = await callEdge({ action: "import", ...base, leads: batch, file_name: fileName });
        imported += res.imported || 0;
        duplicates += res.duplicates || 0;
        invalid += res.invalid || 0;
        if (res.errors) errors.push(...res.errors);
      } catch (e: any) {
        errors.push(`Batch ${i + 1}: ${e.message}`);
      }
      setImportProgress(Math.round(((i + 1) / totalBatches) * 100));
    }

    setImportResult({ imported, duplicates, invalid, errors });
    setImporting(false);
    toast.success(`${imported} leads importados`);
    loadHistory();
  };

  // ── history ──
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const { data } = await supabase
        .from("lead_import_batches")
        .select("id, started_at, file_name, total, imported, duplicates, invalid, status")
        .order("started_at", { ascending: false })
        .limit(20);
      setHistory((data as ImportHistory[]) || []);
    } catch { /* silent */ }
    setHistoryLoading(false);
  };

  // load history on mount-ish
  useState(() => { loadHistory(); });

  // ── download template ──
  const downloadTemplate = () => {
    const csv = "telefone,nome,email,cidade,estado,segmento\n+5511999999999,João Silva,joao@email.com,São Paulo,SP,protecao_veicular\n11988887777,Maria Santos,,Campinas,SP,protecao_veicular\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "modelo-importacao-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── validação: planilha PRECISA ter coluna de telefone ──
  const phonePatterns = ["telefone", "phone", "celular", "fone", "whatsapp", "tel", "mobile"];
  const hasPhoneColumn = headers.some(h => phonePatterns.some(p => h.toLowerCase().trim().includes(p)));
  // Checar se alguma coluna tem dados que parecem telefone BR (começa com +55, 55, ou DDD 2 dígitos + 9)
  const hasPhoneData = rawRows.length > 0 && headers.some(col =>
    rawRows.slice(0, 10).filter(row => {
      const v = String(row[col] || "").replace(/\D/g, "");
      // Telefone BR: 10-13 dígitos, e o padrão: 55+DDD+9XXXX ou DDD+9XXXX
      return v.length >= 10 && v.length <= 13 && /^(55)?[1-9]\d9/.test(v);
    }).length >= 3 // pelo menos 3 das 10 primeiras linhas tem telefone
  );
  const phoneColumnDetected = hasPhoneColumn || hasPhoneData;

  // ── render steps ──
  const canNext = step === 1 ? (rawRows.length > 0 && phoneColumnDetected) : step === 2 ? !!mapping.phone_number : true;

  return (
    <DashboardLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/leads")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <PageHeader title="Importar Leads" subtitle="Suba uma planilha com a coluna telefone — o sistema normaliza automaticamente" />
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {[
            { n: 1, label: "Upload", icon: FileUp },
            { n: 2, label: "Mapeamento", icon: Table2 },
            { n: 3, label: "Configurações", icon: Settings },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-px ${step >= s.n ? "bg-primary" : "bg-border"}`} />}
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors
                ${step === s.n ? "bg-primary text-primary-foreground" : step > s.n ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                {step > s.n ? <Check className="h-3 w-3" /> : <s.icon className="h-3 w-3" />}
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Step 1: Upload */}
        {step === 1 && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Upload do Arquivo</CardTitle>
                <Button variant="outline" size="sm" onClick={downloadTemplate} className="text-xs">
                  <FileUp className="h-3.5 w-3.5 mr-1.5" /> Baixar Modelo CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Info box */}
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20 text-xs space-y-1">
                <p className="font-medium">📋 Como funciona:</p>
                <p>1. Suba um CSV ou XLSX com pelo menos a coluna <strong>telefone</strong></p>
                <p>2. O sistema normaliza automaticamente para +55XX9XXXXXXXX</p>
                <p>3. Telefones fixos são descartados — apenas celular (+55XX<strong>9</strong>)</p>
                <p>4. Colunas extras (nome, email, cidade) são mapeadas no próximo passo</p>
              </div>
              {/* Drag & drop */}
              <div
                className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
                onDragOver={e => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Arraste um CSV/XLSX ou clique para selecionar</p>
                {fileName && <Badge variant="secondary" className="mt-2">{fileName}</Badge>}
                <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" className="hidden"
                  onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              </div>

              {/* Paste */}
              <div className="space-y-2">
                <Label className="text-xs">Ou cole dados de planilha</Label>
                <Textarea
                  placeholder="Cole os dados aqui (formato CSV com cabeçalho)..."
                  className="text-xs h-24"
                  value={pasteData}
                  onChange={e => setPasteData(e.target.value)}
                />
                <Button variant="outline" size="sm" onClick={handlePaste} disabled={!pasteData.trim()}>
                  Processar texto colado
                </Button>
              </div>

              {/* Preview */}
              {rawRows.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    {rawRows.length.toLocaleString("pt-BR")} linhas detectadas · {headers.length} colunas
                  </p>
                  {!phoneColumnDetected && rawRows.length > 0 && (
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400">
                      <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium">Coluna de telefone não encontrada</p>
                        <p className="text-xs text-red-400/80 mt-0.5">A planilha precisa ter uma coluna com telefones (ex: "telefone", "phone", "celular"). Verifique o arquivo e tente novamente.</p>
                      </div>
                    </div>
                  )}
                  <div className="overflow-x-auto rounded border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {headers.slice(0, 8).map(h => <th key={h} className="text-left py-1.5 px-2 font-medium">{h}</th>)}
                          {headers.length > 8 && <th className="py-1.5 px-2 text-muted-foreground">+{headers.length - 8}</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {rawRows.slice(0, 5).map((row, i) => (
                          <tr key={i} className="border-b border-border/50">
                            {headers.slice(0, 8).map(h => <td key={h} className="py-1 px-2 truncate max-w-[120px]">{row[h]}</td>)}
                            {headers.length > 8 && <td className="py-1 px-2 text-muted-foreground">…</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 2: Mapping */}
        {step === 2 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Mapeamento de Colunas</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {systemFields.map(f => (
                  <div key={f.key} className="space-y-1">
                    <Label className="text-xs">
                      {f.label} {f.required && <span className="text-red-400">*</span>}
                    </Label>
                    <Select value={mapping[f.key] || "__none"} onValueChange={v => setMapping(prev => ({ ...prev, [f.key]: v === "__none" ? "" : v }))}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Não mapeado" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none">— Não mapeado —</SelectItem>
                        {headers.map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {/* Mapped preview */}
              {mapping.phone_number && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Preview mapeado</p>
                  <div className="overflow-x-auto rounded border border-border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border bg-muted/30">
                          {systemFields.map(f => <th key={f.key} className="text-left py-1.5 px-2 font-medium">{f.label.replace("*", "")}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {getMappedRows().map((row, i) => (
                          <tr key={i} className="border-b border-border/50">
                            {systemFields.map(f => <td key={f.key} className="py-1 px-2 truncate max-w-[120px]">{row[f.key] || "—"}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Step 3: Config */}
        {step === 3 && (
          <Card>
            <CardHeader><CardTitle className="text-base">Configurações da Importação</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Fonte (Source)</Label>
                  <Select value={source} onValueChange={setSource}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {sourceOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Descrição da fonte</Label>
                  <Input className="h-8 text-xs" placeholder="Ex: Lista Jan/2026" value={sourceDesc} onChange={e => setSourceDesc(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Segmento padrão</Label>
                  <Select value={defaultSegment} onValueChange={setDefaultSegment}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Manter do arquivo</SelectItem>
                      <SelectItem value="protecao_veicular">Proteção Veicular</SelectItem>
                      <SelectItem value="clinica">Clínica</SelectItem>
                      <SelectItem value="imobiliaria">Imobiliária</SelectItem>
                      <SelectItem value="ecommerce">E-commerce</SelectItem>
                      <SelectItem value="saas">SaaS</SelectItem>
                      <SelectItem value="educacao">Educação</SelectItem>
                      <SelectItem value="financeiro">Financeiro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Tags adicionais (vírgula)</Label>
                  <Input className="h-8 text-xs" placeholder="tag1, tag2" value={extraTags} onChange={e => setExtraTags(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Prioridade padrão: {defaultPriority[0]}</Label>
                <Slider value={defaultPriority} onValueChange={setDefaultPriority} min={1} max={10} step={1} className="w-full max-w-xs" />
              </div>

              {/* Summary */}
              {(() => {
                const phoneStats = mapping.phone_number ? computePhoneStats(rawRows, mapping.phone_number) : null;
                return (
                  <div className="rounded-lg bg-muted/30 border border-border p-4 space-y-2 text-sm">
                    <p><strong>{rawRows.length.toLocaleString("pt-BR")}</strong> leads para importar</p>
                    <p>Arquivo: <Badge variant="secondary" className="text-xs">{fileName}</Badge></p>
                    <p>Fonte: {sourceOptions.find(o => o.value === source)?.label}</p>
                    {phoneStats && (
                      <div className="pt-1 border-t border-border/50 grid grid-cols-3 gap-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle className="h-3.5 w-3.5 text-green-400" />
                          <span><strong className="text-green-400">{phoneStats.accepted.toLocaleString("pt-BR")}</strong> aceitos</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
                          <span><strong className="text-yellow-400">{phoneStats.corrected.toLocaleString("pt-BR")}</strong> corrigidos</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <XCircle className="h-3.5 w-3.5 text-red-400" />
                          <span><strong className="text-red-400">{phoneStats.discarded.toLocaleString("pt-BR")}</strong> descartados</span>
                        </div>
                        {phoneStats.discarded > 0 && (
                          <p className="col-span-3 text-muted-foreground">Telefones fixos ou inválidos são descartados automaticamente.</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Import button */}
              <Button onClick={doImport} disabled={importing} className="w-full">
                {importing ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Importando...</> : <><Upload className="h-4 w-4 mr-2" /> Importar {rawRows.length.toLocaleString("pt-BR")} Leads</>}
              </Button>

              {/* Progress */}
              {importing && (
                <div className="space-y-1">
                  <Progress value={importProgress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">{importProgress}%</p>
                </div>
              )}

              {/* Result */}
              {importResult && (
                <div className="rounded-lg border border-border p-4 space-y-3">
                  <div className="flex gap-4 text-sm">
                    <div className="flex items-center gap-1.5"><CheckCircle className="h-4 w-4 text-green-400" /> <span>{importResult.imported} importados</span></div>
                    <div className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-yellow-400" /> <span>{importResult.duplicates} duplicatas</span></div>
                    <div className="flex items-center gap-1.5"><XCircle className="h-4 w-4 text-red-400" /> <span>{importResult.invalid} inválidos</span></div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <Accordion type="single" collapsible>
                      <AccordionItem value="errors">
                        <AccordionTrigger className="text-xs text-red-400">
                          {importResult.errors.length} erro(s) detalhado(s)
                        </AccordionTrigger>
                        <AccordionContent>
                          <div className="space-y-1 max-h-40 overflow-y-auto">
                            {importResult.errors.map((err, i) => (
                              <p key={i} className="text-xs text-muted-foreground">{err}</p>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    </Accordion>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <Button variant="outline" disabled={step === 1} onClick={() => setStep(s => s - 1)}>
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Anterior
          </Button>
          {step < 3 && (
            <Button disabled={!canNext} onClick={() => setStep(s => s + 1)}>
              Próximo <ArrowRight className="h-4 w-4 ml-1.5" />
            </Button>
          )}
        </div>

        {/* Import History */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de Importações</CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma importação registrada</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border text-muted-foreground">
                      <th className="text-left py-2 px-2">Data</th>
                      <th className="text-left py-2 px-2">Arquivo</th>
                      <th className="text-center py-2 px-2">Total</th>
                      <th className="text-center py-2 px-2">Importados</th>
                      <th className="text-center py-2 px-2">Duplicatas</th>
                      <th className="text-center py-2 px-2">Inválidos</th>
                      <th className="text-center py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map(h => (
                      <tr key={h.id} className="border-b border-border/50">
                        <td className="py-1.5 px-2">{fmtDate(h.started_at)}</td>
                        <td className="py-1.5 px-2 truncate max-w-[140px]">{h.file_name || "—"}</td>
                        <td className="py-1.5 px-2 text-center">{h.total}</td>
                        <td className="py-1.5 px-2 text-center text-green-400">{h.imported}</td>
                        <td className="py-1.5 px-2 text-center text-yellow-400">{h.duplicates}</td>
                        <td className="py-1.5 px-2 text-center text-red-400">{h.invalid}</td>
                        <td className="py-1.5 px-2 text-center">
                          <Badge variant="outline" className={`text-[10px] ${h.status === "completed" ? "text-green-400 border-green-500/30" : h.status === "failed" ? "text-red-400 border-red-500/30" : "text-yellow-400 border-yellow-500/30"}`}>
                            {h.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
