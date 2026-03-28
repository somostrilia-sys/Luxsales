import {
  LayoutDashboard, Phone, MessageSquare, LogOut, Settings,
  FileText, Send, UserCog, Users, ShieldCheck, Sparkles,
  ClipboardList, PhoneCall, Upload, Loader2,
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
import { useCallsToday } from "@/hooks/useCallsToday";
import { useMetaHealth } from "@/hooks/useMetaHealth";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  levels: number[];
  badgeKey?: "calls" | "conversas" | "metaAlert";
}

const sections: { label: string; items: MenuItem[]; ceoOnly?: boolean }[] = [
  {
    label: "Visão Geral",
    items: [
      { title: "Dashboard", url: "/", icon: LayoutDashboard, levels: [0, 1, 2, 3] },
    ],
  },
  {
    label: "Canais",
    items: [
      { title: "Ligações", url: "/calls", icon: Phone, levels: [0, 1], badgeKey: "calls" },
      { title: "WhatsApp", url: "/meta", icon: MessageSquare, levels: [0, 1], badgeKey: "metaAlert" },
    ],
  },
  {
    label: "Leads",
    items: [
      { title: "Leads Master", url: "/leads", icon: Users, levels: [0] },
      { title: "Importar", url: "/import", icon: Upload, levels: [0] },
    ],
  },
  {
    label: "Operação",
    items: [
      { title: "Meus Leads", url: "/my-leads", icon: ClipboardList, levels: [0, 1, 2, 3] },
      { title: "Conversas", url: "/conversas", icon: MessageSquare, levels: [0, 1, 2, 3], badgeKey: "conversas" },
      { title: "Templates", url: "/templates", icon: FileText, levels: [0] },
    ],
  },
  {
    label: "Filas",
    items: [
      { title: "Filas Ligação", url: "/call-queues", icon: PhoneCall, levels: [0] },
      { title: "Filas Disparo", url: "/dispatch-queues", icon: Send, levels: [0] },
    ],
  },
  {
    label: "Gestão",
    ceoOnly: true,
    items: [
      { title: "Equipe", url: "/team", icon: UserCog, levels: [0] },
      { title: "Opt-ins", url: "/opt-ins", icon: ShieldCheck, levels: [0] },
      { title: "Configuração", url: "/config", icon: Sparkles, levels: [0] },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { collaborator, roleLevel } = useCollaborator();
  const { signOut } = useAuth();
  const { unreadCount, resetUnread } = useRealtimeMessages();
  const { callsToday } = useCallsToday();
  const { isGreen } = useMetaHealth();

  const filterByLevel = (items: MenuItem[]) => items.filter(i => i.levels.includes(roleLevel));

  const getBadge = (item: MenuItem) => {
    if (!item.badgeKey) return null;
    if (item.badgeKey === "calls" && callsToday > 0) {
      return (
        <Badge variant="secondary" className="ml-1 h-5 min-w-[20px] px-1 text-[10px] font-bold">
          {callsToday > 99 ? "99+" : callsToday}
        </Badge>
      );
    }
    if (item.badgeKey === "conversas" && unreadCount > 0) {
      return (
        <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1 text-[10px] font-bold">
          {unreadCount > 99 ? "99+" : unreadCount}
        </Badge>
      );
    }
    if (item.badgeKey === "metaAlert" && !isGreen) {
      return <span className="ml-1 h-2.5 w-2.5 rounded-full bg-destructive inline-block" />;
    }
    return null;
  };

  const getCollapsedDot = (item: MenuItem) => {
    if (item.badgeKey === "conversas" && unreadCount > 0) return true;
    if (item.badgeKey === "calls" && callsToday > 0) return true;
    if (item.badgeKey === "metaAlert" && !isGreen) return true;
    return false;
  };

  const renderItems = (items: MenuItem[]) =>
    items.map((item) => {
      const isConversas = item.url === "/conversas";
      return (
        <SidebarMenuItem key={item.title + item.url}>
          <SidebarMenuButton asChild>
            <NavLink
              to={item.url}
              end={item.url === "/"}
              className="hover:bg-sidebar-accent/70 transition-all duration-150 rounded-xl gap-3 px-3 py-2 relative"
              activeClassName="sidebar-active-gradient text-gold font-semibold"
              onClick={isConversas ? resetUnread : undefined}
            >
              <item.icon className="h-[18px] w-[18px] text-muted-foreground shrink-0" />
              {!collapsed && (
                <span className="text-[13px] flex-1 flex items-center justify-between">
                  {item.title}
                  {getBadge(item)}
                </span>
              )}
              {collapsed && getCollapsedDot(item) && (
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

        {sections.map((section) => {
          const visible = filterByLevel(section.items);
          if (visible.length === 0) return null;
          if (section.ceoOnly && roleLevel !== 0) return null;
          return (
            <SidebarGroup key={section.label}>
              <SectionLabel>{section.label}</SectionLabel>
              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">{renderItems(visible)}</SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}

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
