import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import { toast } from "sonner";
import { Bot, Mail, Loader2, ArrowLeft } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    const { error } = await resetPassword(email);
    
    if (error) {
      toast.error("Erro ao enviar e-mail", { description: error.message });
    } else {
      setSent(true);
      toast.success("E-mail enviado!", { description: "Verifique sua caixa de entrada." });
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 login-bg">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <img src="https://ecaduzwautlpzpvjognr.supabase.co/storage/v1/object/public/painel-agente/logos/logo-walk-holding-transparent.png" alt="Walk Holding" className="h-28 object-contain drop-shadow-[0_0_30px_hsl(217,91%,53%,0.15)]" />
        </div>

      <Card variant="gradient" className="card-accent-top">
        <CardHeader className="text-center space-y-2">
          <div>
            <CardTitle className="text-2xl font-bold">Recuperar senha</CardTitle>
            <CardDescription>
              {sent ? "Verifique seu e-mail" : "Digite seu e-mail para receber o link"}
            </CardDescription>
          </div>
        </CardHeader>
        {!sent ? (
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full btn-shimmer bg-gradient-to-r from-kpi-from to-kpi-to" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Enviar link
              </Button>
              <Link to="/login" className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" /> Voltar ao login
              </Link>
            </CardFooter>
          </form>
        ) : (
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Enviamos um link de recuperação para <strong>{email}</strong>
            </p>
            <Link to="/login">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao login
              </Button>
            </Link>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
