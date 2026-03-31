import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { EDGE_BASE, LOGO_URL } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

interface InviteInfo {
  company: { name: string } | null;
  role: { name: string } | null;
  invited_name: string | null;
  invited_email: string | null;
  expires_at: string | null;
  active: boolean;
}

export default function AceitarConvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [inviteLoading, setInviteLoading] = useState(true);
  const [inviteError, setInviteError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!token) { setInviteError("Token inválido."); setInviteLoading(false); return; }

    supabase
      .from("invite_links")
      .select("active, expires_at, max_uses, used_count, invited_name, invited_email, company:companies(name), role:roles(name)")
      .eq("token", token)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          setInviteError("Convite não encontrado.");
        } else if (!data.active) {
          setInviteError("Este convite foi revogado.");
        } else if (data.expires_at && new Date(data.expires_at) < new Date()) {
          setInviteError("Este convite expirou.");
        } else if (data.max_uses !== null && data.used_count >= data.max_uses) {
          setInviteError("Este convite atingiu o limite de usos.");
        } else {
          setInvite(data as unknown as InviteInfo);
          if (data.invited_name) setName(data.invited_name);
          if (data.invited_email) setEmail(data.invited_email);
        }
        setInviteLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Informe seu nome completo"); return; }
    if (!email.trim()) { toast.error("Informe seu email"); return; }
    if (password.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres"); return; }
    if (password !== confirm) { toast.error("As senhas não conferem"); return; }

    setSubmitting(true);

    try {
      const res = await fetch(`${EDGE_BASE}/accept-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim(), email: email.trim(), password }),
      });

      const data = await res.json();
      if (!data.ok) {
        toast.error(data.error || "Erro ao criar conta");
      } else {
        setSuccess(true);
        setTimeout(() => navigate("/login?invited=1"), 3000);
      }
    } catch {
      toast.error("Erro de rede. Tente novamente.");
    }

    setSubmitting(false);
  };

  if (inviteLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <XCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Convite Inválido</h2>
            <p className="text-muted-foreground">{inviteError}</p>
            <Button variant="outline" onClick={() => navigate("/login")}>Ir para Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold">Conta criada com sucesso!</h2>
            <p className="text-muted-foreground">Redirecionando para o login...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-2">
          <img src={LOGO_URL} alt="LuxSales" className="h-12 w-auto object-contain" />
          <p className="text-xs text-muted-foreground tracking-widest uppercase">LuxSales</p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-xl">Você foi convidado!</CardTitle>
            {invite && (
              <CardDescription>
                Junte-se a <strong>{(invite.company as any)?.name || "uma empresa"}</strong> como{" "}
                <strong>{(invite.role as any)?.name || "colaborador"}</strong>
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  placeholder="Seu nome completo"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Confirmar senha</Label>
                <Input
                  id="confirm"
                  type="password"
                  placeholder="Repita a senha"
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar minha conta
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
