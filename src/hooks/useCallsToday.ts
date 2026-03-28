import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";

export function useCallsToday() {
  const { collaborator } = useCollaborator();
  const [callsToday, setCallsToday] = useState(0);

  useEffect(() => {
    if (!collaborator?.company_id) return;

    const today = new Date().toISOString().split("T")[0];

    supabase
      .from("call_logs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", collaborator.company_id)
      .gte("created_at", `${today}T00:00:00`)
      .then(({ count }) => setCallsToday(count || 0));

    // Refresh every 60s
    const interval = setInterval(() => {
      supabase
        .from("call_logs")
        .select("id", { count: "exact", head: true })
        .eq("company_id", collaborator.company_id)
        .gte("created_at", `${today}T00:00:00`)
        .then(({ count }) => setCallsToday(count || 0));
    }, 60_000);

    return () => clearInterval(interval);
  }, [collaborator?.company_id]);

  return { callsToday };
}
