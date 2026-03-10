import { useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { Search, Download, Loader2 } from "lucide-react";

interface Lead {
  name: string;
  phone: string;
  email?: string;
  tipo_pessoa: string;
  city?: string;
  category?: string;
  source: string;
  score: number;
}

export default function Extracao() {
  const { companies } = useCompanyFilter();
  const [cep, setCep] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [bairro, setBairro] = useState("");
  const [companyTarget, setCompanyTarget] = useState("all");
  const [sources, setSources] = useState<string[]>(["pj_base"]);
  const [radius, setRadius] = useState([10]);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<Lead[]>([]);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [page, setPage] = useState(0);

  const perPage = 50;

  const formatCep = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 8);
    if (digits.length > 5) return digits.slice(0, 5) + "-" + digits.slice(5);
    return digits;
  };

  const handleCepChange = async (val: string) => {
    const formatted = formatCep(val);
    setCep(formatted);
    const digits = formatted.replace("-", "");
    if (digits.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
        const data = await res.json();
        if (!data.erro) {
          setCity(data.localidade || "");
          setState(data.uf || "");
          setBairro(data.bairro || "");
        }
      } catch {}
    }
  };

  const toggleSource = (s: string) => {
    setSources(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  const handleExtract = async () => {
    const digits = cep.replace("-", "");
    if (digits.length !== 8) { toast.error("CEP inválido"); return; }
    if (sources.length === 0) { toast.error("Selecione ao menos uma fonte"); return; }

    setExtracting(true);
    setProgress(10);
    setResults([]);

    try {
      const projectId = "ecaduzwautlpzpvjognr";
      const { data: { session } } = await supabase.auth.getSession();

      setProgress(30);
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/unified-extract`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          cep: digits,
          sources,
          company_target: companyTarget === "all" ? null : companyTarget,
          radius_km: radius[0],
        }),
      });

      setProgress(80);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro na extração");

      setResults(data.leads || []);
      setProgress(100);
      toast.success(`${(data.leads || []).length} leads extraídos!`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setExtracting(false);
    }
  };

  const toggleSelect = (idx: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    const pageItems = results.slice(page * perPage, (page + 1) * perPage);
    if (selected.size === pageItems.length) setSelected(new Set());
    else setSelected(new Set(pageItems.map((_, i) => page * perPage + i)));
  };

  const exportCSV = () => {
    const items = selected.size > 0 ? Array.from(selected).map(i => results[i]) : results;
    const header = "Nome,Telefone,Email,Tipo,Cidade,Categoria,Fonte,Score\n";
    const rows = items.map(l => `"${l.name}","${l.phone}","${l.email || ""}","${l.tipo_pessoa}","${l.city || ""}","${l.category || ""}","${l.source}","${l.score}"`).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "leads.csv"; a.click();
  };

  const scoreBadge = (score: number) => {
    if (score >= 80) return <Badge className="bg-success text-success-foreground">{score}</Badge>;
    if (score >= 60) return <Badge className="bg-warning text-warning-foreground">{score}</Badge>;
    return <Badge variant="secondary">{score}</Badge>;
  };

  const sourceBadge = (source: string) => {
    const colors: Record<string, string> = {
      pj_base: "bg-primary text-primary-foreground",
      google_maps: "bg-success text-success-foreground",
      olx: "bg-warning text-warning-foreground",
      instagram: "bg-purple-600 text-white",
    };
    return <Badge className={colors[source] || "bg-muted text-muted-foreground"}>{source}</Badge>;
  };

  const pageResults = results.slice(page * perPage, (page + 1) * perPage);
  const totalPages = Math.ceil(results.length / perPage);
  const totalPF = results.filter(l => l.tipo_pessoa === "PF").length;
  const totalPJ = results.filter(l => l.tipo_pessoa === "PJ").length;
  const totalEmail = results.filter(l => l.email).length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Extração de Leads</h1>

        <Card className="shadow-sm">
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>CEP</Label>
                <Input placeholder="00000-000" value={cep} onChange={e => handleCepChange(e.target.value)} />
                {city && <p className="text-xs text-muted-foreground mt-1">{bairro && `${bairro}, `}{city}/{state}</p>}
              </div>
              <div>
                <Label>Empresa Alvo</Label>
                <Select value={companyTarget} onValueChange={setCompanyTarget}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Raio: {radius[0]} km</Label>
                <Slider value={radius} onValueChange={setRadius} min={5} max={50} step={5} className="mt-2" />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Fontes</Label>
              <div className="flex flex-wrap gap-4">
                {[
                  { id: "pj_base", label: "PJ Base" },
                  { id: "google_maps", label: "Google Maps" },
                  { id: "olx", label: "OLX" },
                  { id: "instagram", label: "Instagram" },
                ].map(s => (
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={sources.includes(s.id)} onCheckedChange={() => toggleSource(s.id)} />
                    <span className="text-sm">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <Button onClick={handleExtract} disabled={extracting} className="w-full md:w-auto" size="lg">
              {extracting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
              Extrair Leads
            </Button>

            {extracting && <Progress value={progress} className="h-2" />}
          </CardContent>
        </Card>

        {results.length > 0 && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: "Total", value: results.length },
                { label: "PF", value: totalPF },
                { label: "PJ", value: totalPJ },
                { label: "Com Email", value: totalEmail },
              ].map(s => (
                <Card key={s.label} className="shadow-sm">
                  <CardContent className="pt-4 pb-3 text-center">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold">{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="h-4 w-4 mr-1" /> Exportar CSV
              </Button>
            </div>

            <Card className="shadow-sm">
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={selected.size === pageResults.length && pageResults.length > 0} onCheckedChange={toggleAll} />
                      </TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Cidade</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Fonte</TableHead>
                      <TableHead>Score</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageResults.map((lead, i) => {
                      const idx = page * perPage + i;
                      return (
                        <TableRow key={idx} className="table-row-hover">
                          <TableCell><Checkbox checked={selected.has(idx)} onCheckedChange={() => toggleSelect(idx)} /></TableCell>
                          <TableCell className="font-medium">{lead.name}</TableCell>
                          <TableCell>{lead.phone}</TableCell>
                          <TableCell><Badge variant={lead.tipo_pessoa === "PJ" ? "default" : "secondary"}>{lead.tipo_pessoa}</Badge></TableCell>
                          <TableCell>{lead.city || "—"}</TableCell>
                          <TableCell>{lead.category || "—"}</TableCell>
                          <TableCell>{sourceBadge(lead.source)}</TableCell>
                          <TableCell>{scoreBadge(lead.score)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Anterior</Button>
                <span className="text-sm text-muted-foreground">{page + 1} de {totalPages}</span>
                <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Próxima</Button>
              </div>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
