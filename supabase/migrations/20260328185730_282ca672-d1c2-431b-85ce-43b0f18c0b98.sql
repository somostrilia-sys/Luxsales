-- Call Queues
CREATE TABLE IF NOT EXISTS public.call_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  segment TEXT,
  filter_tags TEXT[] DEFAULT '{}',
  max_attempts INT NOT NULL DEFAULT 3,
  calls_per_hour INT NOT NULL DEFAULT 30,
  daily_limit INT NOT NULL DEFAULT 200,
  schedule_start TIME DEFAULT '08:00',
  schedule_end TIME DEFAULT '20:00',
  active_days INT[] DEFAULT '{1,2,3,4,5}',
  retry_no_answer_min INT DEFAULT 120,
  retry_busy_min INT DEFAULT 30,
  voice_key TEXT,
  system_prompt TEXT,
  opening_script TEXT,
  priority_min INT DEFAULT 1,
  priority_max INT DEFAULT 10,
  total_leads INT DEFAULT 0,
  leads_called INT DEFAULT 0,
  leads_answered INT DEFAULT 0,
  leads_opted_in INT DEFAULT 0,
  leads_converted INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.call_queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage call_queues for their company"
  ON public.call_queues FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM collaborators WHERE user_id = auth.uid()));

-- Dispatch Queues
CREATE TABLE IF NOT EXISTS public.dispatch_queues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  template_name TEXT,
  template_slot TEXT,
  segment TEXT,
  filter_tags TEXT[] DEFAULT '{}',
  filter_temperatures TEXT[] DEFAULT '{}',
  max_per_hour INT NOT NULL DEFAULT 50,
  daily_limit INT NOT NULL DEFAULT 500,
  respect_tier_limit BOOLEAN DEFAULT true,
  safety_pct INT DEFAULT 50,
  schedule_start TIME DEFAULT '08:00',
  schedule_end TIME DEFAULT '20:00',
  active_days INT[] DEFAULT '{1,2,3,4,5}',
  total_leads INT DEFAULT 0,
  leads_dispatched INT DEFAULT 0,
  leads_delivered INT DEFAULT 0,
  leads_read INT DEFAULT 0,
  leads_replied INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.dispatch_queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage dispatch_queues for their company"
  ON public.dispatch_queues FOR ALL TO authenticated
  USING (company_id IN (SELECT company_id FROM collaborators WHERE user_id = auth.uid()));