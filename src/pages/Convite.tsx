import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2, AlertTriangle, Link2 } from "lucide-react";

interface InviteData {
  id: string;
  token: string;
  company_id: string;
  role: string; // stores role_id
  max_uses: number;
  current_uses: number;
  expires_at: string;
  is_active: boolean;
}

export default function Convite() {
  const { token } = useParams<{ token: string }>();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [loadingInvite, setLoadingInvite] = useState(true);

  const [companyName, setCompanyName] = useState("");
  const [roleName, setRoleName] = useState("");
  const [sectors, setSectors] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState<any[]>([]);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [reportsTo, setReportsTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");

  useEffect(() => {
    validateInvite();
  }, [token]);

  const validateInvite = async () => {
    setLoadingInvite(true);
    try {
      // Use anon key to fetch invite
      const { data, error } = await supabase
        .from("invite_links")
        .select("*")
        .eq("token", token)
        .eq("is_active", true)
        .single();

      if (error || !data) {
        setInviteError("Convite não encontrado ou inválido.");
        return;
      }

      // Check expiration
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setInviteError("Este convite expirou.");
        return;
      }

      // Check uses
      if (data.current_uses >= data.max_uses) {
        setInviteError("Este convite já atingiu o limite de usos.");
        return;
      }

      setInvite(data);

      // Load company name, role name, sectors, units, collaborators
      const [compRes, roleRes, sectorRes, unitRes, collabRes] = await Promise.all([
        supabase.from("companies").select("name").eq("id", data.company_id).single(),
        supabase.from("roles").select("name").eq("id", data.role).single(),
        supabase.from("sectors").select("id, name").eq("company_id", data.company_id).order("name"),
        supabase.from("units").select("id, name").eq("company_id", data.company_id).order("name"),
        supabase.from("collaborators").select("id, name, company_id, company_ids, role:roles!collaborators_role_id_fkey(name)")
          .eq("active", true).order("name").limit(1000),
      ]);

      setCompanyName(compRes.data?.name || "");
      setRoleName(roleRes.data?.name || "");
      setSectors(sectorRes.data || []);
      setUnits(unitRes.data || []);
      setCollaborators(
        (collabRes.data || []).filter((c: any) =>
          c.company_id === data.company_id ||
          (Array.isArray(c.company_ids) && c.company_ids.includes(data.company_id))
        )
      );
    } catch (e) {
      setInviteError("Erro ao validar convite.");
    } finally {
      setLoadingInvite(false);
    }
  };

  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds(prev =>
      prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !email || !invite) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL || "https://ecaduzwautlpzpvjognr.supabase.co"}/functions/v1/register-collaborator`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Public-Register": "true" },
          body: JSON.stringify({
            name: nome,
            email,
            phone: phone || undefined,
            company_id: invite.company_id,
            role_id: invite.role,
            sector_id: sectorId || undefined,
            unit_id: selectedUnitIds.length > 0 ? selectedUnitIds[0] : undefined,
            unit_ids: selectedUnitIds.length > 0 ? selectedUnitIds : undefined,
            reports_to: reportsTo || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Erro ao cadastrar");

      // Increment invite usage
      await supabase
        .from("invite_links")
        .update({ current_uses: (invite.current_uses || 0) + 1 })
        .eq("id", invite.id);

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

  // Loading state
  if (loadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 login-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state
  if (inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 login-bg">
        <Card variant="gradient" className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <CardTitle className="text-xl">Convite Inválido</CardTitle>
            <CardDescription>{inviteError}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link to="/login">
              <Button variant="outline">Ir para Login</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 login-bg">
        <Card variant="gradient" className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center shadow-[var(--shadow-glow-accent)]">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <CardTitle className="text-xl">Cadastro realizado!</CardTitle>
            <CardDescription>Sua senha de acesso:</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
              <code className="flex-1 text-lg font-mono text-foreground">{generatedPassword}</code>
              <Button variant="ghost" size="icon" onClick={copyPassword}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">Guarde sua senha em local seguro. Use seu email e esta senha para fazer login.</p>
          </CardContent>
          <CardFooter className="justify-center">
            <Link to="/login">
              <Button className="btn-modern">Ir para Login</Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Registration form
  return (
    <div className="min-h-screen flex items-center justify-center p-4 login-bg">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[var(--shadow-glow-primary)]">
            <Link2 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Cadastro via Convite</h1>
          <p className="text-sm text-muted-foreground">
            Você foi convidado para <span className="text-foreground font-medium">{companyName}</span> como <span className="text-foreground font-medium">{roleName}</span>
          </p>
        </div>

        <Card variant="gradient" className="card-accent-top accent-green">
          <form onSubmit={handleSubmit}>
            <CardContent className="pt-6 space-y-4">
              {/* Pre-filled info badges */}
              <div className="flex flex-wrap gap-2">
                <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
                  {companyName}
                </div>
                <div className="px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-xs font-medium text-success">
                  {roleName}
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome completo *</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" className="h-11 bg-secondary/50" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email *</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="h-11 bg-secondary/50" required />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Telefone</Label>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(00) 00000-0000" className="h-11 bg-secondary/50" />
              </div>

              {sectors.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Setor</Label>
                  <Select value={sectorId} onValueChange={setSectorId}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                    <SelectContent>{sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              {units.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Unidades</Label>
                  <div className="rounded-lg border border-border bg-secondary/30 max-h-48 overflow-y-auto">
                    <div className="p-2 space-y-1">
                      {units.map(u => (
                        <label key={u.id} className="flex items-center gap-2.5 px-2 py-1.5 rounded-md cursor-pointer hover:bg-muted/50 transition-colors">
                          <Checkbox checked={selectedUnitIds.includes(u.id)} onCheckedChange={() => toggleUnit(u.id)} />
                          <span className="text-sm">{u.name}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {selectedUnitIds.length > 0 && (
                    <p className="text-xs text-muted-foreground">{selectedUnitIds.length} unidade(s) selecionada(s)</p>
                  )}
                </div>
              )}

              {collaborators.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Superior Direto</Label>
                  <Select value={reportsTo} onValueChange={setReportsTo}>
                    <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Selecione o superior" /></SelectTrigger>
                    <SelectContent>{collaborators.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.role?.name ? ` - ${c.role.name}` : ""}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full h-11 btn-modern font-semibold" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Cadastrar
              </Button>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
