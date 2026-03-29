import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ecaduzwautlpzpvjognr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYWR1endhdXRscHpwdmpvZ25yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwMDQ1MTcsImV4cCI6MjA4ODU4MDUxN30.pF2XU3pFDc98GSJzA1xyf7d4pHbkrxf3sRDX1jh5Vrg";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export default supabase;
