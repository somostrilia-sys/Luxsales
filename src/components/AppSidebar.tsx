// v2.5 — Refined dark dashboard sidebar
import {
  LayoutDashboard, Users, FileSearch, Database,
  BarChart3, Settings, MessageSquare, Bot, LogOut, Palette, UserPlus, Cpu, Crown, Rocket, Phone, Mic, PhoneCall
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  levels: number[];
}

const managementItems: MenuItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, levels: [0, 1, 2] },
  { title: "Agentes de IA", url: "/agentes", icon: Cpu, levels: [0, 1] },
  { title: "Bots / WhatsApp", url: "/bots", icon: Bot, levels: [0, 1, 2, 3] },
  { title: "Colaboradores", url: "/colaboradores", icon: Users, levels: [0, 1] },
  { title: "Cadastro", url: "/cadastro", icon: UserPlus, levels: [0, 1] },
  { title: "Extração de Leads", url: "/extracao", icon: FileSearch, levels: [0, 1] },
  { title: "Base de Dados ⚠️", url: "/base-dados", icon: Database, levels: [0, 1] },
  { title: "Métricas", url: "/metricas", icon: BarChart3, levels: [0, 1] },
  { title: "Identidade Visual", url: "/identidade-visual", icon: Palette, levels: [0] },
  { title: "Configurações", url: "/configuracoes", icon: Settings, levels: [0, 1] },
  { title: "CEO / Bolt", url: "/ceo", icon: Crown, levels: [0] },
  { title: "Leads & Disparo", url: "/motor-leads", icon: Rocket, levels: [0, 1, 2, 3] },
];

const consultantItems: MenuItem[] = [
  { title: "Atendimento", url: "/atendimento", icon: Phone, levels: [0, 1, 2, 3] },
  { title: "Conversas IA", url: "/conversas", icon: MessageSquare, levels: [0, 1, 2, 3] },
  { title: "Meu Bot", url: "/meu-bot", icon: Bot, levels: [0, 1, 2, 3] },

  { title: "Prospecção", url: "/extracao", icon: FileSearch, levels: [3] },
];

const voiceItems: MenuItem[] = [
  { title: "Voice AI", url: "/voice-ai", icon: Mic, levels: [0, 1] },
  { title: "Ligações IA", url: "/call-campaigns", icon: PhoneCall, levels: [0, 1] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { collaborator, roleLevel } = useCollaborator();
  const { signOut } = useAuth();

  const visibleManagement = managementItems.filter(i => i.levels.includes(roleLevel));
  const visibleVoice = voiceItems.filter(i => i.levels.includes(roleLevel));
  const visibleConsultant = consultantItems.filter(i => i.levels.includes(roleLevel));

  const renderItems = (items: MenuItem[]) =>
    items.map((item) => (
      <SidebarMenuItem key={item.title + item.url}>
        <SidebarMenuButton asChild>
          <NavLink
            to={item.url}
            end={item.url === "/"}
            className="hover:bg-sidebar-accent/60 transition-all duration-200 rounded-lg"
            activeClassName="sidebar-active-gradient text-primary font-semibold"
          >
            <item.icon className="mr-2 h-4 w-4 text-muted-foreground" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-6 bg-sidebar border-r border-sidebar-border">
        {/* Logo */}
        <div className="px-4 mb-6 flex items-center justify-center">
          {collaborator?.company?.logo_url ? (
            <img
              src={collaborator.company.logo_url}
              alt={collaborator.company.name}
              className="h-12 shrink-0 object-contain"
            />
          ) : (
            <img
              src="https://ecaduzwautlpzpvjognr.supabase.co/storage/v1/object/public/assets/logos/logo-walk-holding-transparent.png"
              alt="Walk Holding"
              className="h-20 w-auto object-contain max-w-[200px] shrink-0 drop-shadow-[0_0_20px_hsl(217,91%,53%,0.1)]"
            />
          )}
        </div>

        {visibleManagement.length > 0 && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold px-4 mb-1">Gestão</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(visibleManagement)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleConsultant.length > 0 && (
          <SidebarGroup>
            {!collapsed && <SidebarGroupLabel className="text-muted-foreground text-[10px] uppercase tracking-widest font-semibold px-4 mb-1">Consultor</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>{renderItems(visibleConsultant)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarFooter className="mt-auto p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2">
            {!collapsed && collaborator && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{collaborator.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{collaborator.role?.name}</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
