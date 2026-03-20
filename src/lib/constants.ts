// Centralized constants — avoid hardcoding URLs across pages
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "https://ecaduzwautlpzpvjognr.supabase.co";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.LinR7PIoK7n79hWjbSJ3EgDwA_y6uN-HfQnOk7GgYi4";
export const EDGE_BASE = `${SUPABASE_URL}/functions/v1`;
export const LOGO_URL = import.meta.env.VITE_LOGO_URL || `${SUPABASE_URL}/storage/v1/object/public/painel-agente/logos/logo-walk-holding-transparent.png`;
