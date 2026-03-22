import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, User, Mail, Phone, Lock, Loader2, ArrowRight } from "lucide-react";
import { LOGO_URL } from "@/lib/constants";

const PLAN_LABELS: Record<string, { label: string; color: string }> = {
  starter: { label: "Starter", color: "bg-emerald-600 text-white" },
  business: { label: "Business", color: "bg-blue-600 text-white" },
  enterprise: { label: "Enterprise", color: "bg-purple-600 text-white" },
};

export default function CriarConta() {
  const [searchParams] = useSearchParams();
  const plano = searchParams.get("plano") || "starter";
  const planInfo = PLAN_LABELS[plano] || PLAN_LABELS.starter;

  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const slugify = (text: string) =>
    text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }
    setLoading(true);

    try {
      // 1. Criar user no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error("Erro ao obter ID do usuário.");

      // 2. Criar empresa
      const slug = slugify(companyName);
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({ name: companyName, slug, plan: plano, active: true, is_active: true })
        .select("id")
        .single();

      if (companyError) throw companyError;

      // 3. Criar role padrão "Diretor"
      const { data: role, error: roleError } = await supabase
        .from("roles")
        .insert({ name: "Diretor", level: 1, company_id: company.id })
        .select("id")
        .single();

      if (roleError) throw roleError;

      // 4. Criar collaborator
      const { error: collabError } = await supabase
        .from("collaborators")
        .insert({
          auth_user_id: userId,
          name: fullName,
          email,
          phone,
          active: true,
          company_id: company.id,
          role_id: role.id,
        });

      if (collabError) throw collabError;

      // Deslogar para que o user faça login normalmente
      await supabase.auth.signOut();

      toast.success("Conta criada! Faça login.");
      navigate("/login");
    } catch (err: any) {
      console.error(err);
      toast.error("Erro ao criar conta", { description: err.message || "Tente novamente." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col login-bg">
      {/* Logo */}
      <div className="flex flex-col items-center gap-1.5 mt-10">
        <h1 className="text-[1.7rem] font-extralight tracking-[0.25em] uppercase text-foreground">
          Lux<span className="font-semibold text-gold">Sales</span>
        </h1>
        <div className="w-10 h-px bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
        <span className="text-[10px] font-light text-muted-foreground/70 tracking-[0.35em] uppercase">by Digital Lux</span>
      </div>

      <div className="flex-1 flex items-start justify-center px-4 mt-6">
        <div className="w-full max-w-md space-y-5">

          <Card variant="gradient" className="card-accent-top accent-gold">
            <form onSubmit={handleSubmit}>
              <CardContent className="pt-6 space-y-4">
                {/* Badge do plano */}
                <div className="flex items-center justify-center">
                  <Badge className={planInfo.color + " text-sm px-4 py-1"}>
                    Plano {planInfo.label}
                  </Badge>
                </div>

                <p className="text-center text-sm text-muted-foreground">
                  Crie sua empresa e comece a usar agora
                </p>

                {/* Nome da Empresa */}
                <div className="space-y-2">
                  <Label htmlFor="companyName" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome da Empresa</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="companyName"
                      type="text"
                      placeholder="Minha Empresa Ltda"
                      className="pl-10 h-11 bg-secondary/50 border-border"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Nome Completo */}
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Nome Completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="João da Silva"
                      className="pl-10 h-11 bg-secondary/50 border-border"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">E-mail</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="seu@email.com"
                      className="pl-10 h-11 bg-secondary/50 border-border"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Telefone / WhatsApp */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Telefone / WhatsApp</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(11) 99999-9999"
                      className="pl-10 h-11 bg-secondary/50 border-border"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Senha */}
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      className="pl-10 h-11 bg-secondary/50 border-border"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col gap-4 pb-6">
                <Button
                  type="submit"
                  className="w-full h-11 btn-modern font-semibold bg-gold hover:bg-gold/90 text-gold-foreground"
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <>
                      Criar Conta
                      <ArrowRight className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  Já tem conta?{" "}
                  <Link to="/login" className="text-gold hover:underline font-medium">Faça login</Link>
                </p>
              </CardFooter>
            </form>
          </Card>

          <p className="text-center text-[10px] text-muted-foreground/60">LuxSales © 2026 — Digital Lux</p>
        </div>
      </div>
    </div>
  );
}
