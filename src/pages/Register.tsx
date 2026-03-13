import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Copy, CheckCircle2, AlertTriangle, Link2, ArrowRight, ShieldAlert } from "lucide-react";

interface InviteData {
  id: string;
  token: string;
  company_id: string | null;
  role_id: string | null;
  max_uses: number;
  used_count: number;
  expires_at: string;
  active: boolean;
}

export default function Register() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  if (!token) return <NoTokenPage />;
  return <InviteRegistration token={token} />;
}

function NoTokenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 login-bg">
      <Card variant="gradient" className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-warning/10 border border-warning/20 flex items-center justify-center">
            <ShieldAlert className="h-7 w-7 text-warning" />
          </div>
          <CardTitle className="text-xl">Link de Cadastro Necessário</CardTitle>
          <CardDescription>
            Para se cadastrar, você precisa de um link de convite fornecido pelo administrador do sistema.
          </CardDescription>
        </CardHeader>
        <CardFooter className="flex flex-col gap-3">
          <Link to="/login" className="w-full">
            <Button variant="outline" className="w-full">Ir para Login</Button>
          </Link>
          <p className="text-xs text-muted-foreground text-center">
            Solicite um link de cadastro ao seu gestor ou administrador.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

function InviteRegistration({ token }: { token: string }) {
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [inviteError, setInviteError] = useState("");
  const [loadingInvite, setLoadingInvite] = useState(true);

  // All companies and roles for dropdowns when not pre-set
  const [allCompanies, setAllCompanies] = useState<any[]>([]);
  const [allRoles, setAllRoles] = useState<any[]>([]);

  // Pre-set names (when invite has them)
  const [presetCompanyName, setPresetCompanyName] = useState("");
  const [presetRoleName, setPresetRoleName] = useState("");
  const [presetRoleLevel, setPresetRoleLevel] = useState<number | null>(null);

  // Form fields
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [roleLevel, setRoleLevel] = useState<number | null>(null);

  const [sectors, setSectors] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [collaborators, setCollaborators] = useState<any[]>([]);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [sectorId, setSectorId] = useState("");
  const [selectedUnitIds, setSelectedUnitIds] = useState<string[]>([]);
  const [reportsTo, setReportsTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [generatedPassword, setGeneratedPassword] = useState("");

  const companyFixed = !!invite?.company_id;
  const roleFixed = !!invite?.role_id;

  useEffect(() => { validateInvite(); }, [token]);
  useEffect(() => { if (phone && !whatsapp) setWhatsapp(phone); }, [phone]);

  // When company changes, load related data
  const effectiveCompanyId = companyFixed ? invite?.company_id : selectedCompanyId;
  const effectiveRoleId = roleFixed ? invite?.role_id : selectedRoleId;

  useEffect(() => {
    if (!effectiveCompanyId) {
      setSectors([]); setUnits([]); setCollaborators([]);
      return;
    }
    loadCompanyData(effectiveCompanyId);
  }, [effectiveCompanyId]);

  // When role changes (user-selected), update roleLevel
  useEffect(() => {
    if (roleFixed) {
      setRoleLevel(presetRoleLevel);
      return;
    }
    if (!selectedRoleId) { setRoleLevel(null); return; }
    const role = allRoles.find(r => r.id === selectedRoleId);
    setRoleLevel(role?.level ?? null);
  }, [selectedRoleId, roleFixed, presetRoleLevel, allRoles]);

  const validateInvite = async () => {
    setLoadingInvite(true);
    try {
      const { data, error } = await supabase
        .from("invite_links")
        .select("*")
        .eq("token", token)
        .eq("is_active", true)
        .single();

      if (error || !data) { setInviteError("Link inválido ou expirado."); return; }
      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setInviteError("Este link de cadastro expirou. Solicite um novo ao administrador."); return;
      }
      if (data.current_uses >= data.max_uses) {
        setInviteError("Este link já atingiu o limite de cadastros. Solicite um novo ao administrador."); return;
      }

      setInvite(data);

      // Load companies and roles lists for dropdowns
      const [compRes, roleRes] = await Promise.all([
        supabase.from("companies").select("id, name").order("name"),
        supabase.from("roles").select("id, name, level, company_id").order("level"),
      ]);
      setAllCompanies(compRes.data || []);
      setAllRoles(roleRes.data || []);

      // If company is pre-set
      if (data.company_id) {
        setSelectedCompanyId(data.company_id);
        const comp = (compRes.data || []).find((c: any) => c.id === data.company_id);
        setPresetCompanyName(comp?.name || "");
      }

      // If role is pre-set
      if (data.role) {
        setSelectedRoleId(data.role);
        const role = (roleRes.data || []).find((r: any) => r.id === data.role);
        setPresetRoleName(role?.name || "");
        setPresetRoleLevel(role?.level ?? null);
        setRoleLevel(role?.level ?? null);
      }
    } catch {
      setInviteError("Erro ao validar o link de cadastro.");
    } finally {
      setLoadingInvite(false);
    }
  };

  const loadCompanyData = async (companyId: string) => {
    const [sectorRes, unitRes, collabRes] = await Promise.all([
      supabase.from("sectors").select("id, name").eq("company_id", companyId).order("name"),
      supabase.from("units").select("id, name").eq("company_id", companyId).eq("active", true).order("name"),
      supabase.from("collaborators").select("id, name, company_id, company_ids, role:roles!collaborators_role_id_fkey(name)")
        .eq("active", true).order("name").limit(1000),
    ]);
    setSectors(sectorRes.data || []);
    setUnits(unitRes.data || []);
    setCollaborators(
      (collabRes.data || []).filter((c: any) =>
        c.company_id === companyId ||
        (Array.isArray(c.company_ids) && c.company_ids.includes(companyId))
      )
    );
    // Reset dependent fields
    setSectorId(""); setSelectedUnitIds([]); setReportsTo("");
  };

  const formatPhoneBR = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handlePhoneChange = (value: string) => setPhone(formatPhoneBR(value));
  const handleWhatsappChange = (value: string) => setWhatsapp(formatPhoneBR(value));

  const toggleUnit = (unitId: string) => {
    setSelectedUnitIds(prev =>
      prev.includes(unitId) ? prev.filter(id => id !== unitId) : [...prev, unitId]
    );
  };

  const filteredRoles = allRoles.filter(r => !effectiveCompanyId || r.company_id === effectiveCompanyId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome || !email || !phone || !invite) {
      toast.error("Preencha os campos obrigatórios"); return;
    }
    if (!effectiveCompanyId) {
      toast.error("Selecione uma empresa"); return;
    }
    if (!effectiveRoleId) {
      toast.error("Selecione um cargo"); return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `https://ecaduzwautlpzpvjognr.supabase.co/functions/v1/register-collaborator`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Public-Register": "true" },
          body: JSON.stringify({
            name: nome,
            email,
            phone: phone.replace(/\D/g, ""),
            whatsapp: whatsapp ? whatsapp.replace(/\D/g, "") : undefined,
            company_id: effectiveCompanyId,
            role_id: effectiveRoleId,
            sector_id: sectorId || undefined,
            unit_id: selectedUnitIds.length > 0 ? selectedUnitIds[0] : undefined,
            unit_ids: selectedUnitIds.length > 0 ? selectedUnitIds : undefined,
            reports_to: reportsTo || undefined,
          }),
        }
      );
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || "Erro ao cadastrar");

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

  if (loadingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 login-bg">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 login-bg">
        <Card variant="gradient" className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <CardTitle className="text-xl">Link Inválido</CardTitle>
            <CardDescription>{inviteError}</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link to="/login"><Button variant="outline">Ir para Login</Button></Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 login-bg">
        <Card variant="gradient" className="w-full max-w-md">
          <CardHeader className="text-center space-y-4">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center shadow-[var(--shadow-glow-accent)]">
              <CheckCircle2 className="h-7 w-7 text-success" />
            </div>
            <CardTitle className="text-xl">Cadastro realizado com sucesso!</CardTitle>
            <CardDescription>Sua senha de acesso ao sistema:</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2 p-3 rounded-lg bg-secondary/50 border border-border">
              <code className="flex-1 text-lg font-mono text-foreground">{generatedPassword}</code>
              <Button variant="ghost" size="icon" onClick={copyPassword}><Copy className="h-4 w-4" /></Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Guarde sua senha em local seguro. Use seu email e esta senha para fazer login.
            </p>
          </CardContent>
          <CardFooter className="justify-center">
            <Link to="/login">
              <Button className="btn-modern">
                Ir para Login <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    );
  }

  // Derive display names
  const displayCompanyName = companyFixed
    ? presetCompanyName
    : allCompanies.find(c => c.id === selectedCompanyId)?.name || "";
  const displayRoleName = roleFixed
    ? presetRoleName
    : allRoles.find(r => r.id === selectedRoleId)?.name || "";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 login-bg">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[var(--shadow-glow-primary)]">
            <Link2 className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Cadastro de Colaborador</h1>
          {(displayCompanyName || displayRoleName) && (
            <p className="text-sm text-muted-foreground">
              {displayCompanyName && <>Empresa: <span className="text-foreground font-medium">{displayCompanyName}</span></>}
              {displayCompanyName && displayRoleName && " · "}
              {displayRoleName && <>Cargo: <span className="text-foreground font-medium">{displayRoleName}</span></>}
            </p>
          )}
        </div>

        <Card variant="gradient" className="card-accent-top accent-green">
          <form onSubmit={handleSubmit}>
            <CardContent className="pt-6 space-y-4">
              {/* Pre-filled badges (only for fixed values) */}
              {(companyFixed || roleFixed) && (
                <div className="flex flex-wrap gap-2">
                  {companyFixed && (
                    <div className="px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-medium text-primary">
                      🏢 {presetCompanyName}
                    </div>
                  )}
                  {roleFixed && (
                    <div className="px-3 py-1.5 rounded-full bg-success/10 border border-success/20 text-xs font-medium text-success">
                      👤 {presetRoleName}
                    </div>
                  )}
                </div>
              )}

              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome completo *</Label>
                <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" className="h-11 bg-secondary/50" required />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email *</Label>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" className="h-11 bg-secondary/50" required />
              </div>

              {/* Phone / WhatsApp */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Telefone *</Label>
                  <Input value={phone} onChange={e => handlePhoneChange(e.target.value)} placeholder="(00) 00000-0000" className="h-11 bg-secondary/50" required />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">WhatsApp pessoal</Label>
                  <Input value={whatsapp} onChange={e => handleWhatsappChange(e.target.value)} placeholder="(00) 00000-0000" className="h-11 bg-secondary/50" />
                </div>
              </div>

              {/* Company: fixed or dropdown */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Empresa *</Label>
                {companyFixed ? (
                  <Input value={presetCompanyName} disabled className="h-11 bg-muted/50" />
                ) : (
                  <Select value={selectedCompanyId} onValueChange={v => { setSelectedCompanyId(v); setSelectedRoleId(""); }}>
                    <SelectTrigger className="h-11 bg-secondary/50"><SelectValue placeholder="Selecione a empresa" /></SelectTrigger>
                    <SelectContent>
                      {allCompanies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Role: fixed or dropdown */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cargo *</Label>
                {roleFixed ? (
                  <Input value={presetRoleName} disabled className="h-11 bg-muted/50" />
                ) : (
                  <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                    <SelectTrigger className="h-11 bg-secondary/50"><SelectValue placeholder="Selecione o cargo" /></SelectTrigger>
                    <SelectContent>
                      {filteredRoles.map(r => <SelectItem key={r.id} value={r.id}>{r.name} (Nível {r.level})</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Sector */}
              {sectors.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Setor</Label>
                  <Select value={sectorId} onValueChange={setSectorId}>
                    <SelectTrigger className="h-11 bg-secondary/50"><SelectValue placeholder="Selecione o setor" /></SelectTrigger>
                    <SelectContent>{sectors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}

              {/* Units (level >= 2) */}
              {units.length > 0 && roleLevel !== null && roleLevel >= 2 && (
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
                    <p className="text-xs text-muted-foreground">{selectedUnitIds.length} unidade(s)</p>
                  )}
                </div>
              )}

              {/* Superior (level >= 2) */}
              {collaborators.length > 0 && roleLevel !== null && roleLevel >= 2 && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Superior Direto</Label>
                  <Select value={reportsTo} onValueChange={setReportsTo}>
                    <SelectTrigger className="h-11 bg-secondary/50"><SelectValue placeholder="Selecione o superior" /></SelectTrigger>
                    <SelectContent>{collaborators.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.role?.name ? ` - ${c.role.name}` : ""}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full h-11 btn-modern font-semibold" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Cadastrar
              </Button>
            </CardFooter>
          </form>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Já tem conta?{" "}
          <Link to="/login" className="text-primary hover:underline font-medium">Fazer Login</Link>
        </p>
      </div>
    </div>
  );
}
