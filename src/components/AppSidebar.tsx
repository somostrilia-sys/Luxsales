import {
  LayoutDashboard, Building2, Users, Bot, FileSearch, Database,
  BarChart3, Settings, MessageSquare, Target, TrendingUp, LogOut, ChevronDown
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const menuByLevel: Record<number, Array<{ title: string; url: string; icon: any }>> = {
  0: [ // CEO
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Empresas", url: "/empresas", icon: Building2 },
    { title: "Colaboradores", url: "/colaboradores", icon: Users },
    { title: "Agentes", url: "/agentes", icon: Bot },
    { title: "Extração de Contatos", url: "/extracao", icon: FileSearch },
    { title: "Base de Dados", url: "/base-dados", icon: Database },
    { title: "Métricas", url: "/metricas", icon: BarChart3 },
    { title: "Configurações", url: "/configuracoes", icon: Settings },
  ],
  1: [ // Diretor
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Colaboradores", url: "/colaboradores", icon: Users },
    { title: "Agentes", url: "/agentes", icon: Bot },
    { title: "Métricas", url: "/metricas", icon: BarChart3 },
  ],
  2: [ // Gestor
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Equipe", url: "/colaboradores", icon: Users },
    { title: "Agentes", url: "/agentes", icon: Bot },
    { title: "Métricas", url: "/metricas", icon: BarChart3 },
  ],
  3: [ // Colaborador
    { title: "Meus Agentes", url: "/meus-agentes", icon: MessageSquare },
    { title: "Meus Leads", url: "/meus-leads", icon: Target },
    { title: "Meu Desempenho", url: "/meu-desempenho", icon: TrendingUp },
  ],
};

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { collaborator, roleLevel } = useCollaborator();
  const { signOut } = useAuth();

  const items = menuByLevel[roleLevel] || menuByLevel[3];
  const companyName = collaborator?.company?.name || "Sistema";
  const companyEmoji = collaborator?.company?.emoji || "🏢";
  const roleName = collaborator?.role?.name || "";

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-6 glass-sidebar bg-sidebar/90">
        {/* Branding */}
        <div className="px-4 mb-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-sidebar-primary flex items-center justify-center text-sidebar-primary-foreground font-bold text-lg shrink-0 shadow-lg shadow-primary/20">
            IA
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <p className="font-bold text-sidebar-primary-foreground text-sm leading-tight">Painel IA</p>
              <p className="text-xs text-sidebar-foreground/60">Controle de Agentes</p>
            </div>
          )}
        </div>

        {/* Company badge */}
        <div className="px-3 mb-4">
          <div className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm bg-sidebar-accent/50 text-sidebar-foreground border border-sidebar-border/30">
            <span className="text-lg shrink-0">{companyEmoji}</span>
            {!collapsed && (
              <div className="flex-1 text-left min-w-0">
                <p className="font-semibold text-xs truncate">{companyName}</p>
                <p className="text-[10px] text-sidebar-foreground/60 truncate">{roleName}</p>
              </div>
            )}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent transition-all duration-200"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-semibold"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarFooter className="mt-auto p-3 border-t border-sidebar-border/30">
          <div className="flex items-center gap-2">
            {!collapsed && collaborator && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{collaborator.name}</p>
                <p className="text-[10px] text-sidebar-foreground/60 truncate">{collaborator.email}</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span className="ml-2">Sair</span>}
            </Button>
          </div>
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
