import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { Loader2, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  minLevel?: number; // 0=CEO, 1=Diretor, 2=Gestor, 3=Colaborador
}

export function ProtectedRoute({ children, minLevel }: ProtectedRouteProps) {
  const { user, loading: authLoading, signOut } = useAuth();
  const { collaborator, loading: collabLoading, error, roleLevel } = useCollaborator();

  if (authLoading || collabLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (error || !collaborator) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <ShieldAlert className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold">Acesso Não Configurado</h2>
            <p className="text-muted-foreground">
              {error || "Seu usuário não está vinculado a nenhum colaborador. Contate o administrador do sistema."}
            </p>
            <Button onClick={signOut} variant="outline">Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (minLevel !== undefined && roleLevel > minLevel) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center space-y-4">
            <ShieldAlert className="h-12 w-12 text-warning mx-auto" />
            <h2 className="text-xl font-bold">Acesso Restrito</h2>
            <p className="text-muted-foreground">Você não tem permissão para acessar esta página.</p>
            <Button onClick={() => window.history.back()} variant="outline">Voltar</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
