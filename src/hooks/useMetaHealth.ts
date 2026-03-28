import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useCollaborator } from "@/contexts/CollaboratorContext";

export function useMetaHealth() {
  const { collaborator } = useCollaborator();
  const [isGreen, setIsGreen] = useState(true);

  useEffect(() => {
    if (!collaborator?.company_id) return;

    supabase
      .from("companies")
      .select("meta_quality_rating")
      .eq("id", collaborator.company_id)
      .single()
      .then(({ data }) => {
        const rating = (data as any)?.meta_quality_rating;
        setIsGreen(!rating || rating === "GREEN");
      });

    // Refresh every 5 min
    const interval = setInterval(() => {
      supabase
        .from("companies")
        .select("meta_quality_rating")
        .eq("id", collaborator.company_id)
        .single()
        .then(({ data }) => {
          const rating = (data as any)?.meta_quality_rating;
          setIsGreen(!rating || rating === "GREEN");
        });
    }, 300_000);

    return () => clearInterval(interval);
  }, [collaborator?.company_id]);

  return { isGreen };
}
