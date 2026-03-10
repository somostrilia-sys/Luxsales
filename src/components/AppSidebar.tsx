import {
  LayoutDashboard, Users, FileSearch, Database,
  BarChart3, Settings, MessageSquare, Bot, LogOut, Palette
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

interface MenuItem {
  title: string;
  url: string;
  icon: any;
  maxLevel?: number; // show if roleLevel <= maxLevel
}

const allItems: MenuItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Extração de Leads", url: "/extracao", icon: FileSearch, maxLevel: 2 },
  { title: "Base de Dados", url: "/base-dados", icon: Database, maxLevel: 2 },
  { title: "Conversas", url: "/conversas", icon: MessageSquare },
  { title: "Meu Bot", url: "/meu-bot", icon: Bot },
  { title: "Métricas", url: "/metricas", icon: BarChart3, maxLevel: 2 },
  { title: "Colaboradores", url: "/colaboradores", icon: Users, maxLevel: 0 },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { collaborator, roleLevel } = useCollaborator();
  const { signOut } = useAuth();

  const items = allItems.filter(i => i.maxLevel === undefined || roleLevel <= i.maxLevel);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent className="pt-6 bg-sidebar">
        {/* Logo */}
        <div className="px-4 mb-6 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center shrink-0">
            <span className="text-primary-foreground font-extrabold text-sm">W</span>
          </div>
          {!collapsed && (
            <span className="font-extrabold text-lg text-primary tracking-tight">WALK</span>
          )}
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
                      className="hover:bg-sidebar-accent transition-colors"
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

        <SidebarFooter className="mt-auto p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2">
            {!collapsed && collaborator && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate">{collaborator.name}</p>
                <p className="text-[10px] text-sidebar-foreground/60 truncate">{collaborator.role?.name}</p>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="shrink-0 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SidebarFooter>
      </SidebarContent>
    </Sidebar>
  );
}
