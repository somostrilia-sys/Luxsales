import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

import { toast } from "sonner";
import { Lock, Loader2 } from "lucide-react";
import { LOGO_URL } from "@/lib/constants";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if this is a password recovery flow
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    } else {
      toast.error("Link inválido ou expirado");
      navigate("/login");
    }
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    
    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    
    setLoading(true);
    const { error } = await updatePassword(password);
    
    if (error) {
      toast.error("Erro ao atualizar senha", { description: error.message });
    } else {
      toast.success("Senha atualizada com sucesso!");
      navigate("/");
    }
    setLoading(false);
  };

  if (!isRecovery) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 login-bg">
      <div className="w-full max-w-md space-y-8">
        <div className="flex justify-center">
          <img src={LOGO_URL} alt="LuxSales" className="h-28 object-contain drop-shadow-[0_0_30px_hsl(43,65%,55%,0.2)]" />
        </div>

      <Card variant="gradient" className="card-accent-top">
        <CardHeader className="text-center space-y-2">
          <div>
            <CardTitle className="text-2xl font-bold">Nova senha</CardTitle>
            <CardDescription>Digite sua nova senha</CardDescription>
          </div>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  className="pl-10"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full h-11 btn-modern font-semibold" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Atualizar senha
            </Button>
          </CardFooter>
        </form>
      </Card>
      </div>
    </div>
  );
}
