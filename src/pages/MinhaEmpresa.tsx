import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageHeader } from "@/components/PageHeader";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Building, Upload, Loader2, Save } from "lucide-react";

interface CompanyData {
  id: string;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  description: string | null;
  logo_url: string | null;
  dpo_name: string | null;
  dpo_email: string | null;
  plan: string | null;
}

export default function MinhaEmpresa() {
  const { collaborator } = useCollaborator();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [company, setCompany] = useState<CompanyData | null>(null);

  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [dpoName, setDpoName] = useState("");
  const [dpoEmail, setDpoEmail] = useState("");

  useEffect(() => {
    if (!collaborator?.company_id) return;
    loadCompany();
  }, [collaborator?.company_id]);

  const loadCompany = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .eq("id", collaborator!.company_id)
      .single();

    if (error) {
      toast.error("Erro ao carregar empresa", { description: error.message });
      setLoading(false);
      return;
    }

    setCompany(data);
    setName(data.name || "");
    setCnpj(data.cnpj || "");
    setEmail(data.email || "");
    setPhone(data.phone || "");
    setDescription(data.description || "");
    setLogoUrl(data.logo_url || "");
    setDpoName(data.dpo_name || "");
    setDpoEmail(data.dpo_email || "");
    setLoading(false);
  };

  const handleSave = async () => {
    if (!company) return;
    setSaving(true);

    const { error } = await supabase
      .from("companies")
      .update({
        name,
        cnpj,
        email,
        phone,
        description,
        logo_url: logoUrl,
        dpo_name: dpoName,
        dpo_email: dpoEmail,
      })
      .eq("id", company.id);

    if (error) {
      toast.error("Erro ao salvar", { description: error.message });
    } else {
      toast.success("Empresa atualizada com sucesso!");
    }
    setSaving(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !company) return;

    setUploading(true);
    const path = `${company.id}/logo.png`;

    const { error: uploadError } = await supabase.storage
      .from("logos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      toast.error("Erro no upload", { description: uploadError.message });
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("logos")
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl + "?t=" + Date.now();
    setLogoUrl(publicUrl);

    // Salvar URL no banco
    await supabase.from("companies").update({ logo_url: publicUrl }).eq("id", company.id);
    toast.success("Logo enviado com sucesso!");
    setUploading(false);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageHeader title="Minha Empresa" subtitle="Gerencie os dados da sua empresa" />

      <div className="max-w-3xl mx-auto space-y-6">
        {/* Plano */}
        <div className="flex items-center gap-3">
          <Building className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Plano atual:</span>
          <Badge variant="secondary" className="text-sm">{company?.plan || "N/A"}</Badge>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            {/* Logo */}
            <div className="flex items-center gap-6">
              <div className="shrink-0">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="h-[120px] w-[120px] rounded-xl object-cover border border-border"
                  />
                ) : (
                  <div className="h-[120px] w-[120px] rounded-xl bg-secondary flex items-center justify-center border border-border">
                    <Building className="h-10 w-10 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Logo da Empresa</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {uploading ? "Enviando..." : "Enviar Logo"}
                </Button>
              </div>
            </div>

            {/* Logo URL manual */}
            <div className="space-y-2">
              <Label htmlFor="logoUrl" className="text-xs uppercase tracking-wider text-muted-foreground">Logo URL</Label>
              <Input id="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs uppercase tracking-wider text-muted-foreground">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da empresa" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cnpj" className="text-xs uppercase tracking-wider text-muted-foreground">CNPJ</Label>
                <Input id="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs uppercase tracking-wider text-muted-foreground">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="contato@empresa.com" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-xs uppercase tracking-wider text-muted-foreground">Telefone</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-xs uppercase tracking-wider text-muted-foreground">Descri\u00e7\u00e3o</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva sua empresa..."
                rows={3}
              />
            </div>

            {/* DPO */}
            <div className="border-t pt-4 mt-4">
              <p className="text-sm font-medium mb-3 text-muted-foreground">Encarregado de Dados (DPO)</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="dpoName" className="text-xs uppercase tracking-wider text-muted-foreground">Nome do DPO</Label>
                  <Input id="dpoName" value={dpoName} onChange={(e) => setDpoName(e.target.value)} placeholder="Nome" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dpoEmail" className="text-xs uppercase tracking-wider text-muted-foreground">Email do DPO</Label>
                  <Input id="dpoEmail" type="email" value={dpoEmail} onChange={(e) => setDpoEmail(e.target.value)} placeholder="dpo@empresa.com" />
                </div>
              </div>
            </div>

            {/* Salvar */}
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving} className="bg-gold hover:bg-gold/90 text-gold-foreground">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
