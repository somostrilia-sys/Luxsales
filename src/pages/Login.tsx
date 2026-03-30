import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, Lock, Loader2, ArrowRight } from "lucide-react";

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
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">
      {/* Vídeo de fundo em loop */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
      >
        <source src="/login-bg.mp4" type="video/mp4" />
      </video>

      {/* Sem overlay — vídeo direto */}

      {/* Formulário centralizado por cima */}
      <div className="relative z-20 w-full max-w-md px-4 space-y-5">

        <Card variant="gradient" className="card-accent-top accent-gold bg-black/50 backdrop-blur-md border-white/10">
          <form onSubmit={handleSubmit}>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium text-white/70 uppercase tracking-wider">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    className="pl-10 h-11 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-gold"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium text-white/70 uppercase tracking-wider">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/40" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10 h-11 bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-gold"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Link to="/forgot-password" className="text-xs text-gold hover:underline">Esqueceu a senha?</Link>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4 pb-6">
              <Button type="submit" className="w-full h-11 btn-modern font-semibold bg-gold hover:bg-gold/90 text-gold-foreground" disabled={loading}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </>
                )}
              </Button>
              <p className="text-xs text-white/50 text-center">
                Não tem conta?{" "}
                <Link to="/register" className="text-gold hover:underline font-medium">Cadastre-se</Link>
              </p>
            </CardFooter>
          </form>
        </Card>


      </div>
    </div>
  );
}
