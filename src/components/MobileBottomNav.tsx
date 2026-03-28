import { LayoutDashboard, Phone, MessageSquare, Users, ClipboardList } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useRealtimeMessages } from "@/hooks/useRealtimeMessages";

const tabs = [
  { title: "Home", url: "/", icon: LayoutDashboard },
  { title: "Ligações", url: "/calls", icon: Phone },
  { title: "WhatsApp", url: "/meta", icon: MessageSquare },
  { title: "Leads", url: "/leads", icon: Users },
  { title: "Conversas", url: "/conversas", icon: ClipboardList },
];

export function MobileBottomNav() {
  const { unreadCount, resetUnread } = useRealtimeMessages();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-border/60 bg-sidebar/95 backdrop-blur-md safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {tabs.map((tab) => {
          const isConversas = tab.url === "/conversas";
          return (
            <NavLink
              key={tab.url}
              to={tab.url}
              end={tab.url === "/"}
              className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-muted-foreground transition-colors relative"
              activeClassName="text-primary"
              onClick={isConversas ? resetUnread : undefined}
            >
              <tab.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{tab.title}</span>
              {isConversas && unreadCount > 0 && (
                <span className="absolute top-1.5 right-1/4 h-2 w-2 bg-destructive rounded-full" />
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
