import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2 } from "lucide-react";

export default function Registro() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [roleId, setRoleId] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [unitId, setUnitId] = useState("");
  const [reportsTo, setReportsTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");

  const [companies, setCompanies] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [sectors, setSectors] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("companies").select("id, name").order("name").then(({ data }) => {
      if (data) setCompanies(data);
    });
  }, []);

  useEffect(() => {
    if (!companyId) { setRoles([]); setSectors([]); setUnits([]); setCollaborators([]); setRoleId(""); setSectorId(""); setUnitId(""); setReportsTo(""); return; }
    setRoleId(""); setSectorId(""); setUnitId(""); setReportsTo("");
    supabase.from("roles").select("id, name, level").eq("company_id", companyId).eq("active", true).gte("level", 1).order("name").then(({ data }) => { if (data) setRoles(data); });
    supabase.from("sectors").select("id, name").eq("company_id", companyId).order("name").then(({ data }) => { if (data) setSectors(data); });
    supabase.from("units").select("id, name").eq("company_id", companyId).order("name").then(({ data }) => { if (data) setUnits(data); });
    supabase.from("collaborators").select("id, name, email").eq("company_id", companyId).eq("active", true).order("name").then(({ data }) => { if (data) setCollaborators(data); });
  }, [companyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !email || !companyId) { toast.error("Preencha os campos obrigatórios"); return; }
    setLoading(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL || "https://ecaduzwautlpzpvjognr.supabase.co"}/functions/v1/register-collaborator`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Public-Register": "true" },
        body: JSON.stringify({
          name: nome, email, phone, company_id: companyId,
          role_id: roleId || undefined, sector_id: sectorId || undefined, unit_id: unitId || undefined,
          reports_to: reportsTo || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Erro ao cadastrar");
      const firstName = nome.split(" ")[0];
      const pwd = data.results?.[0]?.password || `${firstName}@2026`;
      setGeneratedPassword(pwd);
      setSuccess(true);
    } catch (err: any) {
      toast.error("Erro ao cadastrar", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const copyPassword = () => {
    navigator.clipboard.writeText(generatedPassword);
    toast.success("Senha copiada!");
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md border-border/50">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-primary-foreground" />
            </div>
            <CardTitle className="text-xl">Cadastro realizado!</CardTitle>
            <CardDescription>Sua senha de acesso:</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-muted border border-border">
              <code className="flex-1 text-lg font-mono text-foreground">{generatedPassword}</code>
              <Button variant="ghost" size="icon" onClick={copyPassword}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">Guarde sua senha em local seguro. Use seu email e esta senha para fazer login.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-lg border-border/50">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">W</div>
          <div>
            <CardTitle className="text-xl">Cadastro de Colaborador</CardTitle>
            <CardDescription>Preencha seus dados para acessar o sistema</CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" required />
            </div>
            <div className="space-y-1.5">
              <Label>Email *</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa *</Label>
              <Select value={companyId} onValueChange={setCompanyId} required>
                <SelectTrigger><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                <SelectContent>{companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {companyId && (
              <>
                <div className="space-y-1.5">
                  <Label>Cargo</Label>
                  <Select value={roleId} onValueChange={setRoleId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                    <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Setor</Label>
                  <Select value={sectorId} onValueChange={setSectorId}>
                    <SelectTrigger><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                    <SelectContent>{sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Superior Direto</Label>
                  <Select value={reportsTo} onValueChange={setReportsTo}>
                    <SelectTrigger><SelectValue placeholder="Selecione o superior" /></SelectTrigger>
                    <SelectContent>{collaborators.map(c => <SelectItem key={c.id} value={c.id}>{c.name} ({c.email})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cadastrar
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
