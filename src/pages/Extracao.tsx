import { useState, useCallback } from "react";
import { Navigate } from "react-router-dom";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { Search, Loader2, FileSearch, MapPin } from "lucide-react";

export default function Extracao() {
  const { roleLevel } = useCollaborator();
  const { companies } = useCompanyFilter();

  // Extraction form state
  const [cep, setCep] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [bairro, setBairro] = useState("");
  const [companyTarget, setCompanyTarget] = useState("all");
  const [sources, setSources] = useState<string[]>(["pj_base"]);
  const [radius, setRadius] = useState([10]);
  const [extracting, setExtracting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [lastResult, setLastResult] = useState<{ count: number; sources: string[] } | null>(null);

  if (roleLevel > 1) return <Navigate to="/" replace />;

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

  const toggleSource = useCallback((s: string) => {
    setSources(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }, []);

  const handleExtract = async () => {
    const digits = cep.replace("-", "");
    if (digits.length !== 8) { toast.error("CEP inválido"); return; }
    if (sources.length === 0) { toast.error("Selecione ao menos uma fonte"); return; }

    setExtracting(true);
    setProgress(10);
    setLastResult(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      setProgress(30);

      const res = await fetch(`https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/unified-extract`, {
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

      setProgress(100);
      const count = (data.leads || []).length;
      setLastResult({ count, sources: [...sources] });
      toast.success(`${count} leads extraídos com sucesso!`);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileSearch className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Extração de Leads</h1>
            <p className="text-muted-foreground text-sm">
              Busque novos leads externos por localização e fonte
            </p>
          </div>
        </div>

        {/* Extraction Form */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-5 w-5 text-primary" /> Nova Extração
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>CEP</Label>
                <Input placeholder="00000-000" value={cep} onChange={e => handleCepChange(e.target.value)} />
                {city && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {bairro && `${bairro}, `}{city}/{state}
                  </p>
                )}
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
                  <label key={s.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg border border-border hover:bg-muted/50 transition-colors">
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

        {/* Result feedback */}
        {lastResult && (
          <Card className="border-accent/30 bg-accent/5">
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-accent/20 text-accent">
                  <Search className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">
                    {lastResult.count} leads extraídos com sucesso!
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Fontes: {lastResult.sources.join(", ")} • Os leads foram salvos na base de dados e podem ser vistos no Motor de Leads
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Info card */}
        <Card className="border-border">
          <CardContent className="pt-5 pb-4">
            <p className="text-sm text-muted-foreground">
              💡 Os leads extraídos são salvos automaticamente na base de dados. 
              Para visualizar, distribuir e gerenciar os leads, acesse o <strong className="text-foreground">Motor de Leads</strong>.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
