import { LayoutDashboard, Bot, Users, FileText, Settings, ChevronDown, Smartphone, Target, MessageSquare, MessagesSquare, BarChart3 } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { empresas } from "@/lib/mock-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const adminItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Agentes", url: "/agentes", icon: Bot },
  { title: "Consultores", url: "/consultores", icon: Users },
  { title: "Relatórios", url: "/relatorios", icon: FileText },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

const consultorItems = [
  { title: "Meus Canais", url: "/meus-canais", icon: Smartphone },
  { title: "Prospecção", url: "/prospeccao", icon: Target },
  { title: "Meu Bot", url: "/meu-bot", icon: MessageSquare },
  { title: "Conversas", url: "/conversas", icon: MessagesSquare },
  { title: "Minhas Métricas", url: "/minhas-metricas", icon: BarChart3 },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { empresa, setEmpresa } = useEmpresa();
  const empresaInfo = empresas.find((e) => e.id === empresa)!;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-6 glass-sidebar bg-sidebar/90">
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

        {/* Company Selector */}
        <div className="px-3 mb-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors text-sidebar-foreground border border-sidebar-border/30">
                <span className="text-lg shrink-0">{empresaInfo.emoji}</span>
                {!collapsed && (
                  <>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-semibold text-xs truncate">{empresaInfo.nome}</p>
                      <p className="text-[10px] text-sidebar-foreground/60 truncate">{empresaInfo.descricao}</p>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {empresas.map((e) => (
                <DropdownMenuItem
                  key={e.id}
                  onClick={() => setEmpresa(e.id)}
                  className={empresa === e.id ? "bg-accent" : ""}
                >
                  <span className="mr-2 text-lg">{e.emoji}</span>
                  <div>
                    <p className="font-medium text-sm">{e.nome}</p>
                    <p className="text-xs text-muted-foreground">{e.descricao}</p>
                  </div>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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
      </SidebarContent>
    </Sidebar>
  );
}
