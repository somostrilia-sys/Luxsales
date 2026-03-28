import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useCollaborator } from "@/contexts/CollaboratorContext";
import { useCompanyFilter } from "@/contexts/CompanyFilterContext";
import { useGlobalShortcuts } from "@/hooks/useGlobalShortcuts";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Bell, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isCEO, collaborator } = useCollaborator();
  const { companies, selectedCompanyId, setSelectedCompanyId } = useCompanyFilter();
  useGlobalShortcuts();

  const initials = collaborator?.name
    ? collaborator.name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()
    : "U";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar — Omni-inspired */}
          <header className="h-16 flex items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur-md px-6 shrink-0 sticky top-0 z-20">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />

              {/* Search bar */}
              <div className="topbar-search flex items-center gap-2.5 px-4 py-2 w-[280px]">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  className="bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground w-full"
                />
                <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border/60 bg-secondary/60 px-1.5 text-[10px] font-medium text-muted-foreground">
                  ⌘K
                </kbd>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {isCEO && companies.length > 0 && (
                <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                  <SelectTrigger className="w-[160px] h-9 text-xs bg-secondary/60 border-border/60 rounded-xl">
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas Empresas</SelectItem>
                    {companies.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              {!isCEO && collaborator?.company && (
                <span className="text-xs text-muted-foreground font-medium bg-secondary/50 px-3 py-1.5 rounded-lg">{collaborator.company.name}</span>
              )}

              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60">
                <Bell className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary/60">
                <Settings className="h-4 w-4" />
              </Button>

              <Avatar className="h-9 w-9 border-2 border-border/60 cursor-pointer hover:border-primary/40 transition-colors">
                <AvatarFallback className="bg-primary/15 text-primary text-xs font-semibold">{initials}</AvatarFallback>
              </Avatar>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
