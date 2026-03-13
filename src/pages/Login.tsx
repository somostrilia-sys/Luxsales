import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, Lock, Loader2 } from "lucide-react";

const LOGO_URL = "https://ecaduzwautlpzpvjognr.supabase.co/storage/v1/object/public/painel-agente/logos/logo-walk-holding-transparent.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error("Erro ao entrar", { description: error.message });
    } else {
      toast.success("Login realizado com sucesso!");
      navigate("/");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="text-center space-y-6 pt-8 pb-4">
          <div className="mx-auto">
            <img
              src={LOGO_URL}
              alt="Walk Holding Corporation"
              className="h-20 w-auto object-contain mx-auto"
              style={{ filter: "drop-shadow(0 0 8px rgba(212,175,55,0.25))" }}
            />
          </div>
          <div className="space-y-1">
            <p className="text-muted-foreground text-sm">Entre na sua conta para continuar</p>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="search" autoComplete="new-password" placeholder="seu@email.com" className="pl-10" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" autoComplete="new-password" placeholder="••••••••" className="pl-10" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            </div>
            <div className="flex justify-end">
              <Link to="/forgot-password" className="text-sm text-primary hover:underline">Esqueceu a senha?</Link>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4 pb-8">
            <Button type="submit" className="w-full btn-modern" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Entrar
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
