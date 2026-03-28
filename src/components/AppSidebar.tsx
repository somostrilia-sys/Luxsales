import {
  LayoutDashboard, Users, FileSearch, Database,
  BarChart3, Settings, MessageSquare, Bot, LogOut, Palette, UserPlus, Cpu, Crown, Rocket, Phone, Mic, PhoneCall, Network, Building2, Building,
  Headphones, Contact, MessageCircle, FileBarChart, ShieldCheck, Wrench, Megaphone, FileText, Smartphone, Zap,
  Send, ClipboardList, UserCog,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LOGO_URL } from "@/lib/constants";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  levels: number[];
}

const managementItems: MenuItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, levels: [0, 1, 2] },
  { title: "Agentes de IA", url: "/agentes", icon: Cpu, levels: [0, 1] },
  { title: "Colaboradores", url: "/colaboradores", icon: Users, levels: [0] },
  { title: "Meu Time", url: "/meu-time", icon: Users, levels: [0, 1] },
  { title: "Cadastro", url: "/cadastro", icon: UserPlus, levels: [0, 1] },
  { title: "Extração de Leads", url: "/extracao", icon: FileSearch, levels: [0, 1] },
  { title: "Base de Dados", url: "/base-dados", icon: Database, levels: [0, 1] },
  { title: "Métricas", url: "/metricas", icon: BarChart3, levels: [0, 1] },
  { title: "Identidade Visual", url: "/identidade-visual", icon: Palette, levels: [0] },
  { title: "Configurações", url: "/configuracoes", icon: Settings, levels: [0] },
  { title: "CEO / Bolt", url: "/ceo", icon: Crown, levels: [0] },
  { title: "Empresas", url: "/empresas", icon: Building2, levels: [0] },
  { title: "Minha Empresa", url: "/minha-empresa", icon: Building, levels: [0, 1] },
];

const consultantItems: MenuItem[] = [
  { title: "Conversas", url: "/conversas", icon: MessageSquare, levels: [0, 1, 2, 3] },
  { title: "Meu Bot", url: "/meu-bot", icon: Bot, levels: [0, 1, 2, 3] },
  { title: "Prospecção", url: "/extracao", icon: FileSearch, levels: [3] },
];

const whatsappBusinessItems: MenuItem[] = [
  { title: "Dashboard WB", url: "/dashboard-wb", icon: BarChart3, levels: [0] },
  { title: "Meus Leads", url: "/my-leads", icon: ClipboardList, levels: [0, 1, 2, 3] },
  { title: "Templates", url: "/templates", icon: FileText, levels: [0] },
  { title: "Distribuição", url: "/lead-distribution", icon: Send, levels: [0] },
  { title: "Equipe WB", url: "/team", icon: UserCog, levels: [0] },
  { title: "Opt-ins", url: "/opt-ins", icon: ShieldCheck, levels: [0] },
];

const voiceItems: MenuItem[] = [
  { title: "Dashboard VoIP", url: "/dashboard-voip", icon: BarChart3, levels: [0, 1] },
  { title: "Discador", url: "/discador", icon: Phone, levels: [0, 1, 2] },
  { title: "Campanhas", url: "/call-campaigns", icon: Megaphone, levels: [0, 1] },
  { title: "Leads", url: "/leads-discador", icon: Users, levels: [0, 1] },
  { title: "Ligações IA", url: "/voice-ai", icon: PhoneCall, levels: [0] },
  { title: "WhatsApp", url: "/whatsapp-meta", icon: MessageCircle, levels: [0] },
  { title: "Relatórios", url: "/relatorios-voz", icon: FileText, levels: [0, 1] },
  { title: "Compliance", url: "/compliance-voz", icon: ShieldCheck, levels: [0] },
  { title: "Config. Voz", url: "/configuracoes-voz", icon: Settings, levels: [0] },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { collaborator, roleLevel } = useCollaborator();
  const { signOut } = useAuth();
  const { unreadCount, resetUnread } = useRealtimeMessages();

  const visibleManagement = managementItems.filter(i => i.levels.includes(roleLevel));
  const visibleVoice = voiceItems.filter(i => i.levels.includes(roleLevel));
  const visibleConsultant = consultantItems.filter(i => i.levels.includes(roleLevel));
  const visibleWB = whatsappBusinessItems.filter(i => i.levels.includes(roleLevel));

  const renderItems = (items: MenuItem[]) =>
    items.map((item) => {
      const isConversas = item.url === "/conversas";
      return (
        <SidebarMenuItem key={item.title + item.url}>
          <SidebarMenuButton asChild>
            <NavLink
              to={item.url}
              end={item.url === "/"}
              className="hover:bg-sidebar-accent/70 transition-all duration-150 rounded-xl gap-3 px-3 py-2"
              activeClassName="sidebar-active-gradient text-gold font-semibold"
              onClick={isConversas ? resetUnread : undefined}
            >
              <item.icon className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
              {!collapsed && (
                <span className="text-[13px] flex-1 flex items-center justify-between">
                  {item.title}
                  {isConversas && unreadCount > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1 text-[10px] font-bold">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </Badge>
                  )}
                </span>
              )}
              {collapsed && isConversas && unreadCount > 0 && (
                <span className="absolute top-0 right-0 h-2.5 w-2.5 bg-destructive rounded-full" />
              )}
            </NavLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    });

  const SectionLabel = ({ children }: { children: React.ReactNode }) =>
    !collapsed ? (
      <SidebarGroupLabel className="text-muted-foreground/60 text-[10px] uppercase tracking-[0.12em] font-semibold px-4 mb-1">
        {children}
      </SidebarGroupLabel>
    ) : null;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-5 bg-sidebar border-r border-sidebar-border/60">
        {/* Logo */}
        <div className="px-4 mb-5 flex flex-col items-center justify-center gap-1">
          <img
            src={LOGO_URL}
            alt="LuxSales"
            className="h-12 w-auto object-contain max-w-[180px] shrink-0 drop-shadow-[0_0_16px_hsl(43,65%,55%,0.12)]"
          />
          {!collapsed && (
            <span className="text-[10px] text-muted-foreground/50 tracking-widest uppercase">LuxSales</span>
          )}
        </div>

        {visibleManagement.length > 0 && (
          <SidebarGroup>
            <SectionLabel>Gestão</SectionLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">{renderItems(visibleManagement)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleWB.length > 0 && (
          <SidebarGroup>
            <SectionLabel>WhatsApp Business</SectionLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">{renderItems(visibleWB)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleVoice.length > 0 && (
          <SidebarGroup>
            <SectionLabel>Voz e Ligações</SectionLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">{renderItems(visibleVoice)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleConsultant.length > 0 && (
          <SidebarGroup>
            <SectionLabel>Consultor</SectionLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">{renderItems(visibleConsultant)}</SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarFooter className="mt-auto p-3 border-t border-sidebar-border/50">
          <div className="flex items-center gap-2.5">
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
              className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent rounded-xl"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
          {!collapsed && (
            <p className="text-[9px] text-muted-foreground/40 text-center mt-2">LuxSales © 2026 — Digital Lux</p>
          )}
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
