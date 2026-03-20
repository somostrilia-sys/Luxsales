import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Upload, X, Plus } from "lucide-react";

interface BrandIdentity {
  colors: { primary: string; secondary: string; accent: string; background: string };
  typography: { heading: string; body: string };
  logo_url: string;
  tagline: string;
  tone_of_voice: string;
  target_audience: string;
  differentials: string[];
  competitors: string[];
  content_pillars: string[];
  never_do: string[];
  price_range: string;
  social: { instagram: string; linkedin: string; website: string };
  needs_setup: boolean;
}

const defaultBrand: BrandIdentity = {
  colors: { primary: "#3b82f6", secondary: "#6366f1", accent: "#f59e0b", background: "#ffffff" },
  typography: { heading: "", body: "" },
  logo_url: "",
  tagline: "",
  tone_of_voice: "",
  target_audience: "",
  differentials: [],
  competitors: [],
  content_pillars: [],
  never_do: [],
  price_range: "",
  social: { instagram: "", linkedin: "", website: "" },
  needs_setup: true,
};

export default function IdentidadeVisual() {
  const { collaborator, isCEO } = useCollaborator();
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompany, setSelectedCompany] = useState("");
  const [brand, setBrand] = useState<BrandIdentity>(defaultBrand);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tagInputs, setTagInputs] = useState({ differentials: "", competitors: "", content_pillars: "", never_do: "" });

  useEffect(() => {
    loadCompanies();
  }, [collaborator]);

  useEffect(() => {
    if (selectedCompany) loadBrand();
  }, [selectedCompany]);

  const loadCompanies = async () => {
    const { data } = await supabase.from("companies").select("id, name").order("name");
    const list = data || [];
    setCompanies(list);
    if (list.length > 0) setSelectedCompany(list[0].id);
  };

  const loadBrand = async () => {
    setLoading(true);
    const { data } = await supabase.from("companies").select("brand_identity").eq("id", selectedCompany).single();
    if (data?.brand_identity) {
      setBrand({ ...defaultBrand, ...data.brand_identity });
    } else {
      setBrand(defaultBrand);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!isCEO) { toast.error("Apenas CEOs podem editar."); return; }
    setSaving(true);
    const payload = { ...brand, needs_setup: false };
    const { error } = await supabase.from("companies").update({ brand_identity: payload }).eq("id", selectedCompany);
    if (error) toast.error("Erro ao salvar: " + error.message);
    else toast.success("Identidade visual salva com sucesso!");
    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${selectedCompany}/logo.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });
    if (error) {
      toast.error("Erro no upload: " + error.message);
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from("logos").getPublicUrl(path);
    setBrand(b => ({ ...b, logo_url: urlData.publicUrl }));
    toast.success("Logo enviado!");
    setUploading(false);
  };

  const addTag = (field: "differentials" | "competitors" | "content_pillars" | "never_do") => {
    const val = tagInputs[field].trim();
    if (!val) return;
    setBrand(b => ({ ...b, [field]: [...(b[field] || []), val] }));
    setTagInputs(t => ({ ...t, [field]: "" }));
  };

  const removeTag = (field: "differentials" | "competitors" | "content_pillars" | "never_do", idx: number) => {
    setBrand(b => ({ ...b, [field]: b[field].filter((_, i) => i !== idx) }));
  };

  const TagInput = ({ field, label }: { field: "differentials" | "competitors" | "content_pillars" | "never_do"; label: string }) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input
          value={tagInputs[field]}
          onChange={e => setTagInputs(t => ({ ...t, [field]: e.target.value }))}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(field); } }}
          placeholder={`Adicionar ${label.toLowerCase()}...`}
          disabled={!isCEO}
        />
        <Button type="button" size="icon" variant="outline" onClick={() => addTag(field)} disabled={!isCEO}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(brand[field] || []).map((tag, i) => (
          <Badge key={i} variant="secondary" className="gap-1">
            {tag}
            {isCEO && <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(field, i)} />}
          </Badge>
        ))}
      </div>
    </div>
  );

  if (!isCEO) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[50vh]">
          <p className="text-muted-foreground">Acesso restrito a CEOs.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold">Identidade Visual</h1>
          <p className="text-muted-foreground text-sm">Gerencie a identidade da marca de cada empresa</p>
        </div>

        <Select value={selectedCompany} onValueChange={setSelectedCompany}>
          <SelectTrigger className="w-full sm:w-[300px]">
            <SelectValue placeholder="Selecione a empresa" />
          </SelectTrigger>
          <SelectContent>
            {companies.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {loading ? (
          <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* CORES */}
            <Card className="shadow-sm">
              <CardHeader><CardTitle className="text-lg">Cores</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {(["primary", "secondary", "accent", "background"] as const).map(key => (
                    <div key={key} className="space-y-2">
                      <Label className="capitalize">{key}</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={brand.colors[key]}
                          onChange={e => setBrand(b => ({ ...b, colors: { ...b.colors, [key]: e.target.value } }))}
                          className="w-10 h-10 rounded border border-input cursor-pointer"
                        />
                        <Input
                          value={brand.colors[key]}
                          onChange={e => setBrand(b => ({ ...b, colors: { ...b.colors, [key]: e.target.value } }))}
                          className="font-mono text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                {/* Preview */}
                <div className="mt-4 flex gap-2">
                  {Object.entries(brand.colors).map(([key, val]) => (
                    <div key={key} className="flex-1 h-12 rounded-md border border-input" style={{ backgroundColor: val }} title={key} />
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* TIPOGRAFIA */}
            <Card className="shadow-sm">
              <CardHeader><CardTitle className="text-lg">Tipografia</CardTitle></CardHeader>
              <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fonte Heading</Label>
                  <Input value={brand.typography.heading} onChange={e => setBrand(b => ({ ...b, typography: { ...b.typography, heading: e.target.value } }))} placeholder="Ex: Montserrat" />
                </div>
                <div className="space-y-2">
                  <Label>Fonte Body</Label>
                  <Input value={brand.typography.body} onChange={e => setBrand(b => ({ ...b, typography: { ...b.typography, body: e.target.value } }))} placeholder="Ex: Inter" />
                </div>
              </CardContent>
            </Card>

            {/* MARCA */}
            <Card className="shadow-sm">
              <CardHeader><CardTitle className="text-lg">Marca</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Logomarca</Label>
                  <div className="flex items-center gap-4">
                    {brand.logo_url && (
                      <img src={brand.logo_url} alt="Logo" className="h-16 w-16 object-contain rounded border border-input" />
                    )}
                    <label className="cursor-pointer">
                      <div className="flex items-center gap-2 px-4 py-2 rounded-md border border-input bg-background hover:bg-muted transition-colors text-sm">
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                        {uploading ? "Enviando..." : "Upload Logo"}
                      </div>
                      <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                    </label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input value={brand.tagline} onChange={e => setBrand(b => ({ ...b, tagline: e.target.value }))} placeholder="Slogan da empresa" />
                </div>
              </CardContent>
            </Card>

            {/* COMUNICAÇÃO */}
            <Card className="shadow-sm">
              <CardHeader><CardTitle className="text-lg">Comunicação</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tom de Voz</Label>
                  <Textarea value={brand.tone_of_voice} onChange={e => setBrand(b => ({ ...b, tone_of_voice: e.target.value }))} placeholder="Descreva o tom de voz da marca..." rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>Público-Alvo</Label>
                  <Textarea value={brand.target_audience} onChange={e => setBrand(b => ({ ...b, target_audience: e.target.value }))} placeholder="Descreva o público-alvo..." rows={3} />
                </div>
                <TagInput field="differentials" label="Diferenciais" />
                <TagInput field="competitors" label="Concorrentes" />
                <TagInput field="content_pillars" label="Pilares de Conteúdo" />
                <TagInput field="never_do" label="O Que Nunca Fazer" />
                <div className="space-y-2">
                  <Label>Faixa de Preço</Label>
                  <Input value={brand.price_range} onChange={e => setBrand(b => ({ ...b, price_range: e.target.value }))} placeholder="Ex: R$ 500 - R$ 5.000" />
                </div>
              </CardContent>
            </Card>

            {/* REDES SOCIAIS */}
            <Card className="shadow-sm">
              <CardHeader><CardTitle className="text-lg">Redes Sociais</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Instagram</Label>
                  <Input value={brand.social.instagram} onChange={e => setBrand(b => ({ ...b, social: { ...b.social, instagram: e.target.value } }))} placeholder="@empresa" />
                </div>
                <div className="space-y-2">
                  <Label>LinkedIn</Label>
                  <Input value={brand.social.linkedin} onChange={e => setBrand(b => ({ ...b, social: { ...b.social, linkedin: e.target.value } }))} placeholder="URL do LinkedIn" />
                </div>
                <div className="space-y-2">
                  <Label>Site</Label>
                  <Input value={brand.social.website} onChange={e => setBrand(b => ({ ...b, social: { ...b.social, website: e.target.value } }))} placeholder="https://..." />
                </div>
              </CardContent>
            </Card>

            <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : "Salvar Identidade Visual"}
            </Button>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
