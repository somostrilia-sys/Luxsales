import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";

const NOTIFICATION_SOUND_URL = "data:audio/wav;base64,UklGRl9vT19teleVBVkFWRWZtdCAQAAAAAQABAESEAAARAAACABAAZGF0YUhNTk0A";

export function useRealtimeMessages() {
  const { collaborator } = useCollaborator();
  const [unreadCount, setUnreadCount] = useState(0);
  const lastNotifiedRef = useRef<string | null>(null);

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio(NOTIFICATION_SOUND_URL);
      audio.volume = 0.3;
      audio.play().catch(() => {});
    } catch {}
  }, []);

  const showBrowserNotification = useCallback((title: string, body: string) => {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted" && document.hidden) {
      new Notification(title, { body, icon: "/placeholder.svg" });
    } else if (Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!collaborator?.company_id) return;

    const channel = supabase
      .channel("realtime-messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "whatsapp_meta_messages",
          filter: `company_id=eq.${collaborator.company_id}`,
        },
        (payload) => {
          const msg = payload.new as any;
          // Only count inbound messages
          if (msg.direction === "inbound" || msg.phone_from !== msg.waba_phone) {
            setUnreadCount((prev) => prev + 1);

            if (lastNotifiedRef.current !== msg.id) {
              lastNotifiedRef.current = msg.id;
              if (!document.hidden) {
                playNotificationSound();
              } else {
                showBrowserNotification(
                  "Nova mensagem",
                  msg.body?.slice(0, 80) || "Você recebeu uma nova mensagem"
                );
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [collaborator?.company_id, playNotificationSound, showBrowserNotification]);

  const resetUnread = useCallback(() => setUnreadCount(0), []);

  return { unreadCount, resetUnread };
}
