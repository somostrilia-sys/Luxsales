import { createClient } from '@supabase/supabase-js';

// Projeto fixo: trackit-hub (ecaduzwautlpzpvjognr) — NÃO usar variáveis de ambiente
const supabaseUrl = "https://ecaduzwautlpzpvjognr.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.LinR7PIoK7n79hWjbSJ3EgDwA_y6uN-HfQnOk7GgYi4";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
