import { useEffect } from "react";

export function useGlobalShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K / Cmd+K: focus search bar
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        const searchInput = document.querySelector<HTMLInputElement>(".topbar-search input");
        searchInput?.focus();
      }

      // Esc: close modals (handled by radix, but also blur focused elements)
      if (e.key === "Escape") {
        const active = document.activeElement as HTMLElement;
        active?.blur?.();
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
